"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrainCircuit, Download, Loader2, Undo2 } from "lucide-react";

interface Props {
  hasResults: boolean;
  hasPrevious: boolean;
  isAdmin: boolean;
}

export function PlanButton({ hasResults, hasPrevious, isAdmin }: Props) {
  const [planning, setPlanning] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const router = useRouter();

  async function handlePlan() {
    setPlanning(true);
    const toastId = toast.loading("Ejecutando planificación CP-SAT…");
    try {
      const res = await fetch("/api/plan", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error en el planificador", { id: toastId });
        if (data.detail) console.error("Planner detail:", data.detail);
      } else {
        toast.success("Planificación completada", { id: toastId });
        router.refresh();
      }
    } catch {
      toast.error("Error de red", { id: toastId });
    } finally {
      setPlanning(false);
    }
  }

  async function handleUndo() {
    if (!confirm("¿Deshacer la última planificación y restaurar la anterior?")) return;
    setUndoing(true);
    const toastId = toast.loading("Deshaciendo planificación…");
    try {
      const res = await fetch("/api/plan/undo", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al deshacer", { id: toastId });
      } else {
        toast.success("Planificación anterior restaurada", { id: toastId });
        router.refresh();
      }
    } catch {
      toast.error("Error de red", { id: toastId });
    } finally {
      setUndoing(false);
    }
  }

  if (!isAdmin) {
    return (
      <a href="/api/export" download>
        <Button
          variant="outline"
          disabled={!hasResults}
          className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2 disabled:opacity-30"
        >
          <Download className="w-4 h-4" />
          Descargar planificación
        </Button>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        onClick={handlePlan}
        disabled={planning || undoing}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold gap-2"
      >
        {planning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BrainCircuit className="w-4 h-4" />
        )}
        {planning ? "Planificando…" : "Planificar"}
      </Button>

      <Button
        onClick={handleUndo}
        disabled={!hasPrevious || undoing || planning}
        variant="outline"
        className="border-zinc-700 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 gap-2 disabled:opacity-30"
      >
        {undoing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Undo2 className="w-4 h-4" />
        )}
        {undoing ? "Deshaciendo…" : "Deshacer Última Planificación"}
      </Button>

      <a href="/api/export" download>
        <Button
          variant="outline"
          disabled={!hasResults}
          className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 gap-2 disabled:opacity-30"
        >
          <Download className="w-4 h-4" />
          Descargar planificación
        </Button>
      </a>
    </div>
  );
}
