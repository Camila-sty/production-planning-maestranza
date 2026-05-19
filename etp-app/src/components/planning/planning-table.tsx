"use client";

import { useState } from "react";
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
import { PlanningForm } from "./planning-form";
import { toast } from "sonner";
import type { SalesPlanning, PlanRunHistoryEntry } from "@/types";
import { Pencil, Trash2, Search, Timer } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { priorityBadgeClass } from "@/lib/priority";

interface PlanningTableProps {
  records: SalesPlanning[];
  endDateMap: Record<string, string>;
  historyMap: Record<string, PlanRunHistoryEntry[]>;
}

function fmtShort(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
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

export function PlanningTable({ records, endDateMap, historyMap }: PlanningTableProps) {
  const [search, setSearch] = useState("");
  const [editingRecord, setEditingRecord] = useState<SalesPlanning | null>(null);
  const [bufferRecord, setBufferRecord] = useState<SalesPlanning | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bufferDays, setBufferDays] = useState("");
  const [bufferNote, setBufferNote] = useState("");
  const [savingBuffer, setSavingBuffer] = useState(false);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.ot?.toLowerCase().includes(q) ||
      r.cliente?.toLowerCase().includes(q) ||
      r.equipo?.toLowerCase().includes(q) ||
      r.vin?.toLowerCase().includes(q) ||
      r.patente?.toLowerCase().includes(q) ||
      r.modelo?.toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    setDeletingId(id);
    try {
      const result = await deleteRecord(id);
      if (result.error) toast.error(result.error);
      else toast.success("Registro eliminado");
    } finally {
      setDeletingId(null);
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
      else { toast.success("Buffer guardado"); setBufferRecord(null); }
    } finally {
      setSavingBuffer(false);
    }
  }

  const COLS = ["OT", "Cliente", "Equipo", "VIN", "Llegada", "Prioridad", "Buffer", "Entrega Estimada", "Estado", "Creado por", "Acciones"];

  return (
    <div className="space-y-4">
      {/* Edit dialog */}
      <Dialog open={editingRecord !== null} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="max-w-5xl bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Registro — OT {editingRecord?.ot ?? ""}</DialogTitle>
          </DialogHeader>
          {editingRecord && <PlanningForm record={editingRecord} onSuccess={() => setEditingRecord(null)} />}
        </DialogContent>
      </Dialog>

      {/* Buffer dialog */}
      <Dialog open={bufferRecord !== null} onOpenChange={(open) => !open && setBufferRecord(null)}>
        <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Buffer de planificación — OT {bufferRecord?.ot ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500">
              Ajuste manual en días hábiles. Positivo = atraso, negativo = adelanto.
              Se aplica solo si se guarda <span className="text-amber-400">después</span> de la última planificación activa.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400 uppercase tracking-wide">Buffer (días)</Label>
              <Input
                type="number"
                value={bufferDays}
                onChange={(e) => setBufferDays(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-white h-8 text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400 uppercase tracking-wide">Nota (opcional)</Label>
              <Input
                type="text"
                value={bufferNote}
                onChange={(e) => setBufferNote(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-white h-8 text-sm"
                placeholder="Motivo del ajuste"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveBuffer} disabled={savingBuffer} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold">
                {savingBuffer ? "Guardando..." : "Guardar Buffer"}
              </Button>
              <Button variant="outline" onClick={() => setBufferRecord(null)} className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar por OT, cliente, equipo, VIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-8 text-sm"
          />
        </div>
        <span className="text-xs text-zinc-500">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="text-center py-10 text-zinc-600">
                  {search ? "Sin resultados para la búsqueda" : "No hay registros aún"}
                </td>
              </tr>
            )}
            {filtered.map((r, i) => {
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

                  {/* Buffer */}
                  <td className="px-3 py-2.5">
                    {r.planning_buffer_days != null ? (
                      <span className={`text-xs font-mono ${
                        r.planning_buffer_days > 0 ? "text-red-400" :
                        r.planning_buffer_days < 0 ? "text-green-400" :
                        "text-zinc-500"
                      }`}>
                        {r.planning_buffer_days > 0 ? "+" : ""}{r.planning_buffer_days}d
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </td>

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
                      <Button size="icon" variant="ghost" onClick={() => openBuffer(r)}
                        className="w-7 h-7 text-zinc-500 hover:text-amber-400 hover:bg-amber-950/30" title="Ajustar buffer">
                        <Timer className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}
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
    </div>
  );
}
