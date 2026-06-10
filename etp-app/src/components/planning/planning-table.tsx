"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteRecord, upsertBuffer } from "@/actions/sales-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanningEditForm } from "./planning-form";
import { toast } from "sonner";
import type { SalesPlanning, PlanRunHistoryEntry } from "@/types";
import { Pencil, Trash2, Search, Timer } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { priorityBadgeClass } from "@/lib/priority";
import { TablePagination } from "@/components/ui/table-pagination";

const PAGE_SIZE = 10;

// ── Sort helpers ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

const COL_TYPE: Record<string, "text" | "number" | "date"> = {
  ot: "text",
  codigo_plazo: "number",
  cliente: "text",
  equipo: "text",
  vin: "text",
  llegada: "date",
  inicio: "date",
  entregado: "text",
  prioridad: "number",
  buffer: "number",
  entrega_estimada: "date",
  estado: "text",
  creado_por: "text",
};

function getSortValue(
  r: SalesPlanning,
  key: string,
  endDateMap: Record<string, string>
): unknown {
  switch (key) {
    case "ot": return r.ot ?? null;
    case "codigo_plazo": return r.codigo_plazo ?? null;
    case "cliente": return r.cliente ?? null;
    case "equipo": return r.equipo ?? null;
    case "vin": return r.vin ?? null;
    case "llegada": return r.llegada ? new Date(r.llegada).toISOString() : null;
    case "inicio": return r.inicio ? new Date(r.inicio).toISOString() : null;
    case "entregado": return r.entregado ? "SÍ" : "NO";
    case "prioridad": return r.prioridad ?? null;
    case "buffer": return r.planning_buffer_days ?? null;
    case "entrega_estimada": return endDateMap[r.id] ?? null;
    case "estado": return (r.planning_buffer_days ?? 0) < 0 ? "Atrasado" : "Al día";
    case "creado_por": return r.created_by ?? null;
    default: return null;
  }
}

function compareSort(a: unknown, b: unknown, type: "text" | "number" | "date", dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;  // nulls always last
  if (b == null) return -1;
  let result: number;
  if (type === "number") {
    result = Number(a) - Number(b);
  } else if (type === "date") {
    result = new Date(a as string).getTime() - new Date(b as string).getTime();
  } else {
    result = String(a).localeCompare(String(b), "es");
  }
  return dir === "asc" ? result : -result;
}

interface PlanningTableProps {
  records: SalesPlanning[];
  endDateMap: Record<string, string>;
  historyMap: Record<string, PlanRunHistoryEntry[]>;
  isAdmin: boolean;
}

function fmtShort(iso: string): string {
  // Full timestamps (runDate from planning_run.created_at) must be converted
  // to America/Santiago before extracting the date — otherwise UTC midnight
  // rolls over to the wrong day for Chilean users.
  // Pure calendar dates (endDate, estimatedEnd) are stored as UTC midnight
  // and read directly from the ISO chars to avoid any TZ shift.
  if (iso.length > 10) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
      timeZone: "America/Santiago",
    }).format(new Date(iso)); // → "YYYY-MM-DD"
    const [y, m, day] = parts.split("-").map(Number);
    if (!y || !m || !day) return "—";
    return `${String(day).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
  }
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return "—";
  return `${String(day).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

/** Content rendered inside the tooltip panel */
function HistoryTooltip({ history }: { history: PlanRunHistoryEntry[] }) {
  // Deduplicate by endDate: keep the FIRST occurrence (oldest runDate = earliest
  // moment that endDate appeared). Mark the row as "current" if any run with
  // that endDate is ACTIVE, so we can highlight it without showing a status label.
  // History arrives sorted oldest→newest (created_at ASC from page.tsx query).
  const seen = new Map<string, { entry: PlanRunHistoryEntry; isCurrent: boolean }>();
  for (const h of history) {
    const key = fmtShort(h.endDate);
    if (!seen.has(key)) {
      seen.set(key, { entry: h, isCurrent: h.status === "ACTIVE" });
    } else if (h.status === "ACTIVE") {
      // Keep the original (oldest) entry's runDate but flag as current run
      const prev = seen.get(key)!;
      seen.set(key, { entry: prev.entry, isCurrent: true });
    }
  }
  const unique = Array.from(seen.values());

  if (unique.length === 0) {
    return <p className="text-zinc-400 italic text-xs">Sin historial de fechas de entrega</p>;
  }
  return (
    <div className="text-xs">
      <p className="text-zinc-300 font-semibold pb-1.5 mb-1.5 border-b border-zinc-700/80">
        Historial de fechas de entrega
      </p>
      {/* Column headers */}
      <div className="flex justify-between gap-4 mb-1 text-zinc-500 font-medium">
        <span>Modificación</span>
        <span>Fecha Entrega</span>
      </div>
      {unique.map(({ entry: h, isCurrent }, i) => (
        <div
          key={i}
          className={`flex items-center justify-between gap-4 py-0.5 ${
            isCurrent ? "text-amber-400 font-semibold" : "text-zinc-400"
          }`}
        >
          <span className="tabular-nums font-mono">{fmtShort(h.runDate)}</span>
          <span className="tabular-nums font-mono">{fmtShort(h.endDate)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Badge "Atrasado" with a portal-based tooltip that:
 * - Renders at position:fixed via createPortal (escapes overflow:hidden ancestors)
 * - Stays open while the mouse is over the badge OR the tooltip
 * - Closes after a 250 ms delay once the mouse leaves both
 * - Flips horizontally / vertically to stay within the viewport
 * - Supports internal scroll for long history lists
 */
function AtrasadoBadge({ history }: { history: PlanRunHistoryEntry[] }) {
  const [open, setOpen]   = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const badgeRef          = useRef<HTMLSpanElement>(null);
  const hideTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending close timer
  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  // Schedule close after 250 ms (cancelled if mouse re-enters badge or tooltip)
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setOpen(false), 250);
  }, [cancelHide]);

  // Open tooltip: measure badge position, compute flip, set fixed coords
  const handleBadgeEnter = useCallback(() => {
    cancelHide();
    const el = badgeRef.current;
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const TW = 296;
    const flipX      = r.left + TW > window.innerWidth - 12;
    const spaceAbove = r.top;
    const spaceBelow = window.innerHeight - r.bottom;
    const flipY      = spaceAbove < 180 && spaceBelow > spaceAbove;
    setStyle({
      position: "fixed",
      width: TW,
      zIndex: 9999,
      ...(flipX ? { right: window.innerWidth - r.right } : { left: r.left }),
      ...(flipY ? { top: r.bottom + 8 }                 : { bottom: window.innerHeight - r.top + 8 }),
    });
    setOpen(true);
  }, [cancelHide]);

  // Cleanup timer on unmount
  useEffect(() => cancelHide, [cancelHide]);

  return (
    <span
      ref={badgeRef}
      onMouseEnter={handleBadgeEnter}
      onMouseLeave={scheduleHide}
      className="inline-block cursor-help"
    >
      <Badge className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 select-none">
        Atrasado
      </Badge>
      {open && createPortal(
        <div
          style={style}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-3 shadow-2xl max-h-72 overflow-y-auto"
        >
          <HistoryTooltip history={history} />
        </div>,
        document.body,
      )}
    </span>
  );
}

export function PlanningTable({ records, endDateMap, historyMap, isAdmin }: PlanningTableProps) {
  const router = useRouter();
  const [localRecords, setLocalRecords] = useState(records);
  const [search, setSearch] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState<"all" | "with" | "without">("all");
  const [estadoFilter, setEstadoFilter] = useState<"all" | "al-dia" | "atrasado">("all");
  const [entregadoFilter, setEntregadoFilter] = useState<"all" | "no" | "si">("all");
  const [editingRecord, setEditingRecord] = useState<SalesPlanning | null>(null);
  const [bufferRecord, setBufferRecord] = useState<SalesPlanning | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<SalesPlanning | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bufferDays, setBufferDays] = useState("");
  const [bufferNote, setBufferNote] = useState("");
  const [savingBuffer, setSavingBuffer] = useState(false);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  // Keep local copy in sync when the server refreshes the records prop
  useEffect(() => { setLocalRecords(records); }, [records]);

  const filtered = localRecords.filter((r) => {
    const q = search.toLowerCase();
    const matchesText =
      !q ||
      r.ot?.toLowerCase().includes(q) ||
      r.cliente?.toLowerCase().includes(q) ||
      r.equipo?.toLowerCase().includes(q) ||
      r.vin?.toLowerCase().includes(q) ||
      r.patente?.toLowerCase().includes(q) ||
      r.modelo?.toLowerCase().includes(q);
    const matchesArrival =
      arrivalFilter === "all" ||
      (arrivalFilter === "with" && r.inicio != null) ||
      (arrivalFilter === "without" && r.inicio == null);
    const isAtrasadoRecord = (r.planning_buffer_days ?? 0) < 0;
    const matchesEstado =
      estadoFilter === "all" ||
      (estadoFilter === "atrasado" && isAtrasadoRecord) ||
      (estadoFilter === "al-dia" && !isAtrasadoRecord);
    const matchesEntregado =
      entregadoFilter === "all" ||
      (entregadoFilter === "si" && r.entregado) ||
      (entregadoFilter === "no" && !r.entregado);
    return matchesText && matchesArrival && matchesEstado && matchesEntregado;
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) =>
        compareSort(
          getSortValue(a, sortCol, endDateMap),
          getSortValue(b, sortCol, endDateMap),
          COL_TYPE[sortCol] ?? "text",
          sortDir
        )
      )
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleDelete(record: SalesPlanning) {
    setDeletingId(record.id);
    try {
      const result = await deleteRecord(record.id);
      if (result.error) toast.error(result.error);
      else toast.success("Registro eliminado");
    } finally {
      setDeletingId(null);
      setConfirmDeleteRecord(null);
    }
  }

  function openBuffer(r: SalesPlanning) {
    setBufferRecord(r);
    setBufferDays(r.planning_buffer_days != null ? String(r.planning_buffer_days) : "0");
    setBufferNote(r.planning_buffer_note ?? "");
  }

  async function handleSaveBuffer() {
    if (!bufferRecord) return;
    const days = parseInt(bufferDays, 10);
    if (isNaN(days)) { toast.error("Ingresa un número válido de días"); return; }
    setSavingBuffer(true);
    try {
      const result = await upsertBuffer(bufferRecord.id, {
        buffer_days: days,
        note: bufferNote || undefined,
      });
      if (result.error) toast.error(typeof result.error === "string" ? result.error : "Error al guardar");
      else {
        // Optimistic update: patch the record locally so the table reflects it immediately
        setLocalRecords((prev) =>
          prev.map((r) =>
            r.id === bufferRecord.id
              ? { ...r, planning_buffer_days: days, planning_buffer_note: bufferNote || null, planning_buffer_at: new Date() }
              : r
          )
        );
        toast.success("Buffer guardado");
        setBufferRecord(null);
        router.refresh(); // sync server state in background
      }
    } finally {
      setSavingBuffer(false);
    }
  }

  const COL_DEFS = [
    { key: "ot",               label: "OT" },
    { key: "codigo_plazo",     label: "Cód. Plazo" },
    { key: "cliente",          label: "Cliente" },
    { key: "equipo",           label: "Equipo" },
    { key: "vin",              label: "VIN" },
    { key: "llegada",          label: "Llegada" },
    { key: "inicio",           label: "Inicio" },
    { key: "entregado",        label: "Entregado" },
    { key: "prioridad",        label: "Prioridad" },
    ...(isAdmin ? [{ key: "buffer", label: "Buffer" }] : []),
    { key: "entrega_estimada", label: "Fecha Entrega" },
    { key: "estado",           label: "Estado" },
    { key: "creado_por",       label: "Creado por" },
    { key: "acciones",         label: "Acciones" },
  ];

  return (
    <div className="space-y-4">
      {/* Edit dialog */}
      <Dialog open={editingRecord !== null} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Registro — OT {editingRecord?.ot ?? ""}</DialogTitle>
          </DialogHeader>
          {editingRecord && <PlanningEditForm record={editingRecord} onSuccess={() => setEditingRecord(null)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDeleteRecord !== null} onOpenChange={(open) => !open && setConfirmDeleteRecord(null)}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Registro a eliminar</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <p className="text-sm text-zinc-400">
              ¿Eliminar el registro{" "}
              <span className="text-amber-400 font-mono font-semibold">OT {confirmDeleteRecord?.ot ?? "—"}</span>
              {confirmDeleteRecord?.cliente ? (
                <> — <span className="text-white font-medium">{confirmDeleteRecord.cliente}</span></>
              ) : null}
              ? Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex gap-2 pt-3 items-center border-t border-zinc-800">
            <Button
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6"
              disabled={deletingId === confirmDeleteRecord?.id}
              onClick={() => confirmDeleteRecord && handleDelete(confirmDeleteRecord)}
            >
              {deletingId === confirmDeleteRecord?.id ? "Eliminando..." : "Eliminar"}
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setConfirmDeleteRecord(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buffer dialog */}
      <Dialog open={bufferRecord !== null} onOpenChange={(open) => !open && setBufferRecord(null)}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Buffer de planificación — OT {bufferRecord?.ot ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Ajuste manual</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
              <span className="text-red-400">Negativo = atrasado</span>,{" "}
              <span className="text-green-400">positivo = adelantado</span>.
              Se aplica en la próxima ejecución del planificador.
            </p>
            <div className="grid items-center gap-x-6 gap-y-2" style={{ gridTemplateColumns: "160px 1fr" }}>
              <Label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Buffer (días)</Label>
              <Input
                type="number"
                value={bufferDays}
                onChange={(e) => setBufferDays(e.target.value)}
                className="etp-modal-input"
                placeholder="0"
              />
              <Label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Nota (opcional)</Label>
              <Input
                type="text"
                value={bufferNote}
                onChange={(e) => setBufferNote(e.target.value)}
                className="etp-modal-input"
                placeholder="Motivo del ajuste"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-3 items-center border-t border-zinc-800">
            <Button onClick={handleSaveBuffer} disabled={savingBuffer} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6">
              {savingBuffer ? "Guardando..." : "Guardar Buffer"}
            </Button>
            <Button variant="outline" onClick={() => setBufferRecord(null)} className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search + Arrival filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar por OT, cliente, equipo, VIN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-8 text-sm"
          />
        </div>
        <select
          value={arrivalFilter}
          onChange={(e) => { setArrivalFilter(e.target.value as "all" | "with" | "without"); setPage(1); }}
          className="h-8 px-2.5 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="all">Inicio</option>
          <option value="with">Con inicio</option>
          <option value="without">Sin inicio</option>
        </select>
        <select
          value={estadoFilter}
          onChange={(e) => { setEstadoFilter(e.target.value as "all" | "al-dia" | "atrasado"); setPage(1); }}
          className="h-8 px-2.5 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="all">Estado</option>
          <option value="al-dia">Al día</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <select
          value={entregadoFilter}
          onChange={(e) => { setEntregadoFilter(e.target.value as "all" | "no" | "si"); setPage(1); }}
          className="h-8 px-2.5 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="all">Entregado</option>
          <option value="no">No entregado</option>
          <option value="si">Entregado</option>
        </select>
        <span className="text-xs text-zinc-500">{filtered.length} registro{filtered.length !== 1 ? "s" : ""} en total</span>
      </div>

      {/* Table + Pagination */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {COL_DEFS.map(({ key, label }) => {
                const sortable = key in COL_TYPE;
                const isActive = sortCol === key;
                return (
                  <th
                    key={key}
                    onDoubleClick={sortable ? () => handleSort(key) : undefined}
                    className={`text-left px-3 py-2.5 text-xs uppercase tracking-wider font-medium whitespace-nowrap select-none transition-colors ${
                      sortable ? "cursor-pointer" : ""
                    } ${isActive ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {label}{isActive ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={COL_DEFS.length} className="text-center py-10 text-zinc-600">
                  {search ? "Sin resultados para la búsqueda" : "No hay registros aún"}
                </td>
              </tr>
            )}
            {paginated.map((r, i) => {
              const bufferDaysVal = r.planning_buffer_days ?? 0;
              const isAtrasado = bufferDaysVal < 0;
              const estimatedEnd = endDateMap[r.id] ?? null;
              const history = historyMap[r.id] ?? [];

              return (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-zinc-900/20"}`}
                >
                  {/* OT */}
                  <td className="px-3 py-2.5 font-mono text-amber-400 text-xs">{r.ot || "—"}</td>

                  {/* Código Plazo */}
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">
                    {r.codigo_plazo ?? <span className="text-zinc-700">—</span>}
                  </td>

                  {/* Cliente */}
                  <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap">{r.cliente || "—"}</td>

                  {/* Equipo */}
                  <td className="px-3 py-2.5 text-zinc-300">{r.equipo || "—"}</td>

                  {/* VIN */}
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{r.vin || "—"}</td>

                  {/* Llegada */}
                  <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                    {r.llegada ? fmtDate(r.llegada) : <span className="text-zinc-600 italic text-xs">—</span>}
                  </td>

                  {/* Inicio */}
                  <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap">
                    {r.inicio ? fmtDate(r.inicio) : <span className="text-zinc-600 italic text-xs">Sin fecha</span>}
                  </td>

                  {/* Entregado */}
                  <td className="px-3 py-2.5">
                    {r.entregado ? (
                      <Badge className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        SÍ
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-zinc-700/40 text-zinc-500 border border-zinc-700/50">
                        NO
                      </Badge>
                    )}
                  </td>

                  {/* Prioridad */}
                  <td className="px-3 py-2.5">
                    {r.prioridad != null ? (
                      <Badge variant="outline" className={`text-xs ${priorityBadgeClass(r.prioridad)}`}>
                        P{r.prioridad}
                      </Badge>
                    ) : "—"}
                  </td>

                  {/* Buffer — admin only */}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      {r.planning_buffer_days != null ? (
                        <span className={`text-xs font-mono ${
                          r.planning_buffer_days < 0 ? "text-red-400" :
                          r.planning_buffer_days > 0 ? "text-green-400" :
                          "text-zinc-500"
                        }`}>
                          {r.planning_buffer_days > 0 ? "+" : ""}{r.planning_buffer_days}d
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-xs">—</span>
                      )}
                    </td>
                  )}

                  {/* Entrega Estimada — from active planning run, or stored fecha_entrega_real for delivered */}
                  <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap tabular-nums text-xs">
                    {estimatedEnd
                      ? fmtShort(estimatedEnd)
                      : r.fecha_entrega_real
                        ? fmtShort(new Date(r.fecha_entrega_real).toISOString().slice(0, 10))
                        : <span className="text-zinc-700">—</span>}
                  </td>

                  {/* Estado — Al día / Atrasado based on buffer */}
                  <td className="px-3 py-2.5">
                    {isAtrasado ? (
                      <AtrasadoBadge history={history} />
                    ) : (
                      <Badge className="text-xs bg-green-500/15 text-green-400 border border-green-500/25">
                        Al día
                      </Badge>
                    )}
                  </td>

                  {/* Creado por */}
                  <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">{r.created_by || "—"}</td>

                  {/* Acciones */}
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditingRecord(r)}
                        className="w-7 h-7 text-zinc-400 hover:text-white hover:bg-zinc-700" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" onClick={() => openBuffer(r)}
                          className="w-7 h-7 text-zinc-500 hover:text-amber-400 hover:bg-amber-950/30" title="Ajustar buffer">
                          <Timer className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteRecord(r)}
                        disabled={deletingId === r.id}
                        className="w-7 h-7 text-zinc-600 hover:text-red-400 hover:bg-red-950/30" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={safePage}
        totalPages={totalPages}
        totalRecords={sorted.length}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
}
