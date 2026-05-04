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
}

const EMPTY: Omit<ProcessCapacity, "id" | "created_at" | "updated_at"> = {
  proceso: "",
  orden: 0,
  capacidad_por_dia: 0,
};

export function ProcessCapacityTable({ records }: Props) {
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
        <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            ¿Eliminar el proceso <span className="text-white font-medium">{confirmDelete?.proceso}</span>?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white" disabled={loading} onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit dialog */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setEditing(null); setAdding(false); } }}>
        <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar proceso" : "Nuevo proceso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {[
              { key: "proceso", label: "Proceso", type: "text" },
              { key: "orden", label: "Orden", type: "number" },
              { key: "capacidad_por_dia", label: "Capacidad / día", type: "number" },
            ].map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-zinc-400 uppercase tracking-wide">{label}</Label>
                <Input
                  type={type}
                  value={String(form[key as keyof typeof form])}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="bg-zinc-800/50 border-zinc-700 text-white h-8 text-sm focus:border-amber-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={loading} onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold">
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => { setEditing(null); setAdding(false); }}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd} className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 h-7 text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Nuevo
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {["Proceso", "Orden", "Cap./Día", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider font-medium">
                  {h}
                </th>
              ))}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
