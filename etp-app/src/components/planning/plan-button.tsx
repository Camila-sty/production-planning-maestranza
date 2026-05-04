"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrainCircuit, Download, Loader2 } from "lucide-react";

interface Props {
  hasResults: boolean;
}

export function PlanButton({ hasResults }: Props) {
  const [planning, setPlanning] = useState(false);
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

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handlePlan}
        disabled={planning}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold gap-2"
      >
        {planning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BrainCircuit className="w-4 h-4" />
        )}
        {planning ? "Planificando…" : "Planificar"}
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
