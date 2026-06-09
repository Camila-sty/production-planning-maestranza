"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { SpecialWorkingDay } from "@/types";
import { CalendarPlus, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/utils";

/** Format a full timestamp as DD-MM-YYYY in America/Santiago. */
function fmtChileDate(d: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(d as string)); // "YYYY-MM-DD"
  const [y, m, day] = parts.split("-").map(Number);
  if (!y || !m || !day) return "—";
  return `${String(day).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

interface Props {
  specialDays: SpecialWorkingDay[];
  activePlanRunCreatedAt: Date | null;
  isAdmin: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  HOLIDAY_WORKING: "Feriado trabajable",
  WEEKEND_WORKING: "Fin de semana trabajable",
  EXTRA_WORKING_DAY: "Día extra",
};

export function SpecialDaysPanel({ specialDays, activePlanRunCreatedAt, isAdmin }: Props) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [type, setType] = useState("WEEKEND_WORKING");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<SpecialWorkingDay | null>(null);

  async function handleAdd() {
    if (!date) {
      toast.error("Selecciona una fecha");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/special-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, type, description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al agregar día especial");
      } else {
        toast.success("Día especial agregado");
        setDate("");
        setDescription("");
        router.refresh();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(day: SpecialWorkingDay) {
    setDeletingId(day.id);
    setConfirmDeleteDay(null);
    try {
      const res = await fetch(`/api/special-days/${day.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al eliminar");
      } else {
        toast.success("Día especial eliminado");
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  // Use Chile's current date for the min constraint — toISOString() gives UTC
  // which can be "tomorrow" in Chile when it's past midnight UTC.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
  }).format(new Date());

  return (
    <div className="space-y-4">
      {/* Confirm delete dialog */}
      <Dialog open={confirmDeleteDay !== null} onOpenChange={(open) => !open && setConfirmDeleteDay(null)}>
        <DialogContent className="w-[90vw] max-w-[480px] bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400 pt-1">
            ¿Eliminar el día especial{" "}
            <span className="text-amber-400 font-mono font-semibold">
              {confirmDeleteDay ? fmtDate(confirmDeleteDay.date) : ""}
            </span>
            ? La próxima planificación ya no lo considerará como día hábil.
          </p>
          <div className="flex gap-2 pt-3 border-t border-zinc-800">
            <Button
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6"
              disabled={deletingId === confirmDeleteDay?.id}
              onClick={() => confirmDeleteDay && handleDelete(confirmDeleteDay)}
            >
              {deletingId === confirmDeleteDay?.id ? "Eliminando..." : "Eliminar"}
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setConfirmDeleteDay(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-zinc-500">
        Agrega feriados o fines de semana que se deben tratar como días hábiles en la planificación.
        Todos los días registrados se aplican en cada planificación mientras existan.
      </p>

      {/* Add form — admin only */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400 uppercase tracking-wide">Fecha</Label>
            <Input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-white h-8 text-sm w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400 uppercase tracking-wide">Tipo</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-zinc-800/50 border border-zinc-700 text-white text-sm h-8 rounded-md px-2 focus:outline-none focus:border-amber-500"
            >
              <option value="WEEKEND_WORKING">Fin de semana trabajable</option>
              <option value="HOLIDAY_WORKING">Feriado trabajable</option>
              <option value="EXTRA_WORKING_DAY">Día extra</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-zinc-400 uppercase tracking-wide">Descripción (opcional)</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Sábado de emergencia"
              className="bg-zinc-800/50 border-zinc-700 text-white h-8 text-sm w-52"
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={adding}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold gap-2 h-8"
          >
            <CalendarPlus className="w-4 h-4" />
            {adding ? "Agregando..." : "Agregar"}
          </Button>
        </div>
      )}

      {/* List */}
      {specialDays.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">No hay días especiales registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {["Fecha de registro", "Fecha extra", "Tipo", "Descripción", "Estado", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-xs text-zinc-500 uppercase tracking-wider font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {specialDays.map((d) => {
                const isUsed = d.used_in_planning;
                return (
                  <tr key={d.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{fmtChileDate(d.created_at)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-300">{fmtDate(d.date)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{TYPE_LABELS[d.type] ?? d.type}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{d.description ?? "—"}</td>
                    <td className="px-3 py-2">
                      {isUsed ? (
                        <Badge className="text-xs bg-green-500/20 text-green-400 border-0">
                          Usado en planificación
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-amber-500/20 text-amber-400 border-0">
                          Pendiente
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDeleteDay(d)}
                          disabled={deletingId === d.id}
                          className="w-6 h-6 text-zinc-600 hover:text-red-400 hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
