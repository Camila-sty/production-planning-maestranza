"use client";

import { useState } from "react";
import {
  createProcessCapacity,
  updateProcessCapacity,
  deleteProcessCapacity,
} from "@/actions/process-capacity";
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
import { Pencil, Trash2, Plus } from "lucide-react";
import type { ProcessCapacity } from "@/types";

interface Props {
  records: ProcessCapacity[];
  isAdmin: boolean;
}

const EMPTY: Omit<ProcessCapacity, "id" | "created_at" | "updated_at"> = {
  proceso: "",
  orden: 0,
  capacidad_por_dia: 0,
};

export function ProcessCapacityTable({ records, isAdmin }: Props) {
  const [editing, setEditing] = useState<ProcessCapacity | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProcessCapacity | null>(null);

  const sorted = [...records].sort((a, b) => a.orden - b.orden);

  function openAdd() {
    setForm(EMPTY);
    setAdding(true);
  }

  function openEdit(r: ProcessCapacity) {
    setForm({ proceso: r.proceso, orden: r.orden, capacidad_por_dia: r.capacidad_por_dia });
    setEditing(r);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const result = editing
        ? await updateProcessCapacity(editing.id, form)
        : await createProcessCapacity(form);

      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Error de validación");
      } else {
        toast.success(editing ? "Proceso actualizado" : "Proceso creado");
        setEditing(null);
        setAdding(false);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(r: ProcessCapacity) {
    setLoading(true);
    try {
      const result = await deleteProcessCapacity(r.id);
      if (result.error) toast.error(result.error);
      else toast.success("Proceso eliminado");
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  }

  const isOpen = editing !== null || adding;

  return (
    <div className="space-y-3">
      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Proceso a eliminar
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <p className="text-sm text-zinc-400">
              ¿Eliminar el proceso{" "}
              <span className="text-white font-medium">{confirmDelete?.proceso}</span>?
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex gap-2 pt-2 items-center border-t border-zinc-800">
            <Button
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6"
              disabled={loading}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Eliminar
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setConfirmDelete(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit dialog */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setEditing(null); setAdding(false); } }}>
        <DialogContent className="w-[90vw] max-w-[640px] bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? "Editar proceso" : "Nuevo proceso"}
            </DialogTitle>
          </DialogHeader>

          <div className="pt-2">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                Información del proceso
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <div className="grid items-center gap-x-6 gap-y-2" style={{ gridTemplateColumns: "160px 1fr" }}>
              {[
                { key: "proceso", label: "Proceso", type: "text" },
                { key: "orden", label: "Orden", type: "number" },
                { key: "capacidad_por_dia", label: "Capacidad / Día", type: "number" },
              ].map(({ key, label, type }) => [
                <Label key={`l-${key}`} className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                  {label}
                </Label>,
                <Input
                  key={`f-${key}`}
                  type={type}
                  value={String(form[key as keyof typeof form])}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      [key]: type === "number" ? Number(e.target.value) : e.target.value,
                    }))
                  }
                  className="etp-modal-input"
                />,
              ])}
            </div>
          </div>

          <div className="flex gap-2 pt-3 items-center border-t border-zinc-800">
            <Button
              disabled={loading}
              onClick={handleSave}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6"
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => { setEditing(null); setAdding(false); }}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {["Proceso", "Orden", "Cap./Día"].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider font-medium">
                  {h}
                </th>
              ))}
              {isAdmin && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-zinc-600">Sin datos</td></tr>
            )}
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-200 font-medium">{r.proceso}</td>
                <td className="px-3 py-2 text-zinc-400 tabular-nums">{r.orden}</td>
                <td className="px-3 py-2 text-amber-400 tabular-nums font-semibold">{r.capacidad_por_dia}</td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)} className="w-7 h-7 text-zinc-400 hover:text-white hover:bg-zinc-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)} className="w-7 h-7 text-zinc-600 hover:text-red-400 hover:bg-red-950/30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
