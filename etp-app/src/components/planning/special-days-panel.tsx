"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { SpecialWorkingDay } from "@/types";
import { CalendarPlus, Trash2 } from "lucide-react";

interface Props {
  specialDays: SpecialWorkingDay[];
  activePlanRunCreatedAt: Date | null;
}

const TYPE_LABELS: Record<string, string> = {
  HOLIDAY_WORKING: "Feriado trabajable",
  WEEKEND_WORKING: "Fin de semana trabajable",
  EXTRA_WORKING_DAY: "Día extra",
};

export function SpecialDaysPanel({ specialDays, activePlanRunCreatedAt }: Props) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [type, setType] = useState("WEEKEND_WORKING");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/special-days/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al eliminar");
      } else {
        toast.success("Día eliminado");
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Agrega feriados o fines de semana que se deben tratar como días hábiles en la próxima planificación.
        Las fechas ya usadas en la planificación activa aparecen bloqueadas.
      </p>

      {/* Add form */}
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

      {/* List */}
      {specialDays.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">No hay días especiales registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {["Fecha", "Tipo", "Descripción", "Estado", ""].map((h) => (
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
                const dateStr = new Date(d.date).toLocaleDateString("es-CL");
                const usedInActive =
                  d.used_in_planning &&
                  d.planning_run_id != null;
                const blocked =
                  activePlanRunCreatedAt != null &&
                  usedInActive;
                return (
                  <tr key={d.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-300">{dateStr}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{TYPE_LABELS[d.type] ?? d.type}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{d.description ?? "—"}</td>
                    <td className="px-3 py-2">
                      {blocked ? (
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
                      {!blocked && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(d.id)}
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
