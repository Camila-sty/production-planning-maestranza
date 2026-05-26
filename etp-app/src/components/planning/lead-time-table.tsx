"use client";

import { useState, useMemo } from "react";
import {
  createLeadTime,
  updateLeadTime,
  deleteLeadTime,
} from "@/actions/lead-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import type { LeadTimeByCode, ProcessCapacity } from "@/types";

interface Props {
  records: LeadTimeByCode[];
  processes: ProcessCapacity[];
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Pivot row type
// ---------------------------------------------------------------------------
type PivotRow = {
  codigo_plazo: string;
  descripcion: string;
  byProc: Map<string, LeadTimeByCode>; // proceso → record
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildPivot(records: LeadTimeByCode[]): Map<string, PivotRow> {
  const map = new Map<string, PivotRow>();
  for (const r of records) {
    if (!map.has(r.codigo_plazo)) {
      map.set(r.codigo_plazo, {
        codigo_plazo: r.codigo_plazo,
        descripcion: r.descripcion_equipo ?? "",
        byProc: new Map(),
      });
    }
    map.get(r.codigo_plazo)!.byProc.set(r.proceso, r);
  }
  return map;
}

type CellForm = {
  codigo_plazo: string;
  descripcion_equipo: string;
  proceso: string;
  duracion_dias: number;
  existingId?: string;
};

type EquipForm = {
  codigo_plazo: string;
  descripcion_equipo: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LeadTimeTable({ records, processes, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [cellDialog, setCellDialog] = useState<CellForm | null>(null);
  const [equipDialog, setEquipDialog] = useState<EquipForm | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<PivotRow | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Ordered column list (by process_capacity.orden, then any extras) ---
  const orderedProcs = useMemo(() => {
    const fromCap = [...processes]
      .sort((a, b) => a.orden - b.orden)
      .map((p) => p.proceso);

    // Processes in lead times not covered by process_capacity
    const extras = [...new Set(records.map((r) => r.proceso))].filter(
      (p) => !fromCap.includes(p)
    );

    return [...fromCap, ...extras];
  }, [processes, records]);

  // --- Pivot map ---
  const pivotMap = useMemo(() => buildPivot(records), [records]);

  // --- Sorted, filtered rows ---
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return [...pivotMap.values()]
      .filter(
        (r) =>
          !q ||
          r.codigo_plazo.toLowerCase().includes(q) ||
          r.descripcion.toLowerCase().includes(q)
      )
      .sort((a, b) => Number(a.codigo_plazo) - Number(b.codigo_plazo));
  }, [pivotMap, search]);

  // ---------------------------------------------------------------------------
  // Cell click: open dialog to set/edit duration for (codigo_plazo, proceso)
  // ---------------------------------------------------------------------------
  function handleCellClick(row: PivotRow, proceso: string) {
    const existing = row.byProc.get(proceso);
    setCellDialog({
      codigo_plazo: row.codigo_plazo,
      descripcion_equipo: row.descripcion,
      proceso,
      duracion_dias: existing?.duracion_dias ?? 0,
      existingId: existing?.id,
    });
  }

  async function handleCellSave() {
    if (!cellDialog) return;
    setLoading(true);
    try {
      const result = cellDialog.existingId
        ? await updateLeadTime(cellDialog.existingId, cellDialog)
        : await createLeadTime(cellDialog);

      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Error de validación");
      } else {
        toast.success("Guardado");
        setCellDialog(null);
      }
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // New equipment row: open dialog, then create one record per process
  // ---------------------------------------------------------------------------
  function handleOpenEquip() {
    setEquipDialog({ codigo_plazo: "", descripcion_equipo: "" });
  }

  async function handleEquipSave() {
    if (!equipDialog) return;
    const { codigo_plazo, descripcion_equipo } = equipDialog;
    if (!codigo_plazo.trim()) {
      toast.error("El código plazo es requerido");
      return;
    }
    setLoading(true);
    try {
      // Create a record with duration=0 for every process so the row appears
      for (const proc of orderedProcs) {
        await createLeadTime({
          codigo_plazo: codigo_plazo.trim(),
          descripcion_equipo: descripcion_equipo.trim() || undefined,
          proceso: proc,
          duracion_dias: 0,
        });
      }
      toast.success(`Equipo ${codigo_plazo} creado con ${orderedProcs.length} procesos`);
      setEquipDialog(null);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete entire row (all processes for a codigo_plazo)
  // ---------------------------------------------------------------------------
  async function handleDeleteRow(row: PivotRow) {
    setLoading(true);
    try {
      for (const rec of row.byProc.values()) {
        await deleteLeadTime(rec.id);
      }
      toast.success(`Código ${row.codigo_plazo} eliminado`);
    } finally {
      setLoading(false);
      setConfirmDeleteRow(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-3">

      {/* Cell edit dialog */}
      <Dialog open={cellDialog !== null} onOpenChange={(o) => !o && setCellDialog(null)}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Editar lead time —{" "}
              <span className="text-amber-400">{cellDialog?.codigo_plazo}</span>
              {" / "}
              {cellDialog?.proceso}
            </DialogTitle>
          </DialogHeader>

          <div className="pt-2">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                Duración del proceso
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <div className="grid items-center gap-x-6 gap-y-2" style={{ gridTemplateColumns: "160px 1fr" }}>
              <Label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                Duración (días hábiles)
              </Label>
              <div>
                <Input
                  type="number"
                  min={0}
                  value={cellDialog?.duracion_dias ?? 0}
                  onChange={(e) =>
                    setCellDialog((f) =>
                      f ? { ...f, duracion_dias: Number(e.target.value) } : f
                    )
                  }
                  className="etp-modal-input"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-600 leading-tight mt-1">
                  0 = proceso no aplica para este equipo (ignorado por el planificador)
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 items-center border-t border-zinc-800">
            <Button
              disabled={loading}
              onClick={handleCellSave}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6"
            >
              {loading ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setCellDialog(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New equipment dialog */}
      <Dialog open={equipDialog !== null} onOpenChange={(o) => !o && setEquipDialog(null)}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Nuevo tipo de equipo</DialogTitle>
          </DialogHeader>

          <div className="pt-2">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                Identificación del equipo
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <div className="grid items-center gap-x-6 gap-y-2" style={{ gridTemplateColumns: "160px 1fr" }}>
              {[
                { key: "codigo_plazo", label: "Código Plazo", type: "text" },
                { key: "descripcion_equipo", label: "Descripción equipo", type: "text" },
              ].map(({ key, label, type }) => [
                <Label key={`l-${key}`} className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                  {label}
                </Label>,
                <Input
                  key={`f-${key}`}
                  type={type}
                  value={String(equipDialog?.[key as keyof EquipForm] ?? "")}
                  onChange={(e) =>
                    setEquipDialog((f) => f ? { ...f, [key]: e.target.value } : f)
                  }
                  className="etp-modal-input"
                />,
              ])}
            </div>
            <p className="text-[11px] text-zinc-600 leading-tight mt-4">
              Se crearán {orderedProcs.length} procesos con duración 0. Edita cada celda para asignar días.
            </p>
          </div>

          <div className="flex gap-2 pt-3 items-center border-t border-zinc-800">
            <Button
              disabled={loading}
              onClick={handleEquipSave}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6"
            >
              {loading ? "Creando…" : "Crear"}
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setEquipDialog(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete row */}
      <Dialog
        open={confirmDeleteRow !== null}
        onOpenChange={() => setConfirmDeleteRow(null)}
      >
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Equipo a eliminar
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <p className="text-sm text-zinc-400">
              ¿Eliminar todos los procesos de{" "}
              <span className="text-white font-medium">
                {confirmDeleteRow?.codigo_plazo} — {confirmDeleteRow?.descripcion}
              </span>
              ?{" "}
              <span className="text-zinc-500">({confirmDeleteRow?.byProc.size} registros)</span>
              {" "}Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex gap-2 pt-3 items-center border-t border-zinc-800">
            <Button
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6"
              disabled={loading}
              onClick={() => confirmDeleteRow && handleDeleteRow(confirmDeleteRow)}
            >
              Eliminar
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setConfirmDeleteRow(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar código o equipo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-8 text-sm"
          />
        </div>
        <span className="text-xs text-zinc-500">{rows.length} equipos</span>
        {isAdmin && (
          <Button
            size="sm"
            onClick={handleOpenEquip}
            className="ml-auto bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 h-7 text-xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo equipo
          </Button>
        )}
      </div>

      {/* Pivot table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800 max-h-[520px] overflow-y-auto">
        <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-zinc-900">
              {/* Sticky info columns */}
              <th
                className="sticky left-0 z-30 bg-zinc-900 border-b border-r border-zinc-700 px-3 py-2.5 text-left text-zinc-500 uppercase tracking-wider font-medium whitespace-nowrap"
                style={{ minWidth: 64 }}
              >
                Cód.
              </th>
              <th
                className="sticky bg-zinc-900 border-b border-r border-zinc-700 px-3 py-2.5 text-left text-zinc-500 uppercase tracking-wider font-medium whitespace-nowrap"
                style={{ left: 64, minWidth: 180, zIndex: 30 }}
              >
                Equipo
              </th>
              {/* Process columns */}
              {orderedProcs.map((proc) => (
                <th
                  key={proc}
                  className="border-b border-zinc-800 px-3 py-2.5 text-center text-xs text-zinc-500 uppercase tracking-wider font-medium whitespace-nowrap"
                >
                  {proc}
                </th>
              ))}
              {/* Delete col — admin only */}
              {isAdmin && <th className="border-b border-zinc-800 px-2 py-2.5" style={{ minWidth: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={orderedProcs.length + 3}
                  className="text-center py-8 text-zinc-600"
                >
                  Sin datos
                </td>
              </tr>
            )}
            {rows.map((row, ri) => (
              <tr
                key={row.codigo_plazo}
                className={ri % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30"}
              >
                {/* Sticky: código */}
                <td
                  className="sticky left-0 z-10 border-r border-zinc-800 px-3 py-2 font-mono text-amber-400 font-semibold whitespace-nowrap"
                  style={{
                    minWidth: 64,
                    background: ri % 2 === 0 ? "var(--etp-sticky-even)" : "var(--etp-sticky-odd)",
                  }}
                >
                  {row.codigo_plazo}
                </td>

                {/* Sticky: descripción */}
                <td
                  className="sticky border-r border-zinc-800 px-3 py-2 text-zinc-300 whitespace-nowrap"
                  style={{
                    left: 64,
                    minWidth: 180,
                    zIndex: 10,
                    background: ri % 2 === 0 ? "var(--etp-sticky-even)" : "var(--etp-sticky-odd)",
                  }}
                >
                  {row.descripcion || <span className="text-zinc-600">—</span>}
                </td>

                {/* Process cells */}
                {orderedProcs.map((proc) => {
                  const rec = row.byProc.get(proc);
                  const dias = rec?.duracion_dias ?? 0;
                  const active = dias > 0;

                  return (
                    <td
                      key={proc}
                      onClick={isAdmin ? () => handleCellClick(row, proc) : undefined}
                      title={isAdmin ? `${row.codigo_plazo} / ${proc}: ${dias} días — clic para editar` : undefined}
                      className={[
                        "border border-zinc-800/60 text-center tabular-nums select-none transition-colors",
                        "py-2 px-1",
                        isAdmin ? "cursor-pointer" : "cursor-default",
                        active
                          ? isAdmin ? "text-zinc-100 font-medium hover:bg-amber-500/20" : "text-zinc-100 font-medium"
                          : isAdmin ? "text-zinc-700 hover:bg-zinc-800/60" : "text-zinc-700",
                      ].join(" ")}
                      style={{
                        background: active ? "rgba(245,158,11,0.08)" : undefined,
                      }}
                    >
                      {active ? dias : <span className="opacity-30">0</span>}
                    </td>
                  );
                })}

                {/* Delete row — admin only */}
                {isAdmin && (
                  <td className="border border-zinc-800/60 px-1 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setConfirmDeleteRow(row)}
                      className="w-6 h-6 text-zinc-700 hover:text-red-400 hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">
        {isAdmin
          ? "Haz clic en cualquier celda para editar la duración. Celdas activas (días > 0) tienen fondo ámbar tenue."
          : "Celdas activas (días > 0) tienen fondo ámbar tenue. Solo administradores pueden editar."}
      </p>
    </div>
  );
}
