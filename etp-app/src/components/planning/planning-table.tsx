"use client";

import { useState, useEffect } from "react";
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

interface PlanningTableProps {
  records: SalesPlanning[];
  endDateMap: Record<string, string>;
  historyMap: Record<string, PlanRunHistoryEntry[]>;
  isAdmin: boolean;
}

function fmtShort(iso: string): string {
  // Use slice(0,10) to read the calendar date directly from the ISO string,
  // avoiding timezone shifts (dates from the planner are UTC midnight).
  const datePart = iso.slice(0, 10); // "YYYY-MM-DD"
  const [y, m, day] = datePart.split("-").map(Number);
  if (!y || !m || !day) return "—";
  return `${String(day).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

/** Tooltip with history of estimated end dates */
function HistoryTooltip({ history }: { history: PlanRunHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="text-zinc-400 italic">Sin historial anterior de fechas estimadas</div>
    );
  }

  // Show all entries — mark ACTIVE as "Actual"
  return (
    <div className="space-y-1">
      <div className="text-zinc-300 font-medium mb-2">Historial de fechas estimadas:</div>
      {history.map((h, i) => {
        const isActive = h.status === "ACTIVE";
        return (
          <div key={i} className={`flex justify-between gap-4 ${isActive ? "text-amber-400 font-semibold" : "text-zinc-400"}`}>
            <span>{isActive ? "Actual" : fmtShort(h.runDate)}</span>
            <span>{fmtShort(h.endDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PlanningTable({ records, endDateMap, historyMap, isAdmin }: PlanningTableProps) {
  const router = useRouter();
  const [localRecords, setLocalRecords] = useState(records);
  const [search, setSearch] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState<"all" | "with" | "without">("all");
  const [editingRecord, setEditingRecord] = useState<SalesPlanning | null>(null);
  const [bufferRecord, setBufferRecord] = useState<SalesPlanning | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<SalesPlanning | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bufferDays, setBufferDays] = useState("");
  const [bufferNote, setBufferNote] = useState("");
  const [savingBuffer, setSavingBuffer] = useState(false);
  const [page, setPage] = useState(1);

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
      (arrivalFilter === "with" && r.llegada != null) ||
      (arrivalFilter === "without" && r.llegada == null);
    return matchesText && matchesArrival;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const COLS = ["OT", "Cód. Plazo", "Cliente", "Equipo", "VIN", "Llegada", "Prioridad", ...(isAdmin ? ["Buffer"] : []), "Entrega Estimada", "Estado", "Creado por", "Acciones"];

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
          <option value="all">Todos</option>
          <option value="with">Con llegada</option>
          <option value="without">Sin llegada</option>
        </select>
        <span className="text-xs text-zinc-500">{filtered.length} registro{filtered.length !== 1 ? "s" : ""} en total</span>
      </div>

      {/* Table + Pagination */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {COLS.map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs text-zinc-500 uppercase tracking-wider font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="text-center py-10 text-zinc-600">
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
                    {r.llegada ? fmtDate(r.llegada) : <span className="text-zinc-600 italic text-xs">Sin fecha</span>}
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

                  {/* Entrega Estimada — from active planning run */}
                  <td className="px-3 py-2.5 text-zinc-300 whitespace-nowrap tabular-nums text-xs">
                    {estimatedEnd ? fmtShort(estimatedEnd) : <span className="text-zinc-700">—</span>}
                  </td>

                  {/* Estado — Al día / Atrasado based on buffer */}
                  <td className="px-3 py-2.5">
                    {isAtrasado ? (
                      <div className="relative group inline-block">
                        <Badge className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 cursor-help select-none">
                          Atrasado
                        </Badge>
                        {/* Tooltip */}
                        <div className="absolute z-50 hidden group-hover:block bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-2xl pointer-events-none">
                          <HistoryTooltip history={history} />
                          {/* Arrow */}
                          <div className="absolute top-full left-4 w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 -mt-1" />
                        </div>
                      </div>
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
        totalRecords={filtered.length}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
}
