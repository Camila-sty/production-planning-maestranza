"use client";

import { useState } from "react";
import { deleteRecord } from "@/actions/sales-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanningForm } from "./planning-form";
import { toast } from "sonner";
import type { SalesPlanning } from "@/types";
import { Pencil, Trash2, Search } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { priorityBadgeClass } from "@/lib/priority";

interface PlanningTableProps {
  records: SalesPlanning[];
}

export function PlanningTable({ records }: PlanningTableProps) {
  const [search, setSearch] = useState("");
  const [editingRecord, setEditingRecord] = useState<SalesPlanning | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Registro eliminado");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Edit dialog — rendered once at component level */}
      <Dialog
        open={editingRecord !== null}
        onOpenChange={(open) => !open && setEditingRecord(null)}
      >
        <DialogContent className="max-w-5xl bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Editar Registro — OT {editingRecord?.ot ?? ""}
            </DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <PlanningForm
              record={editingRecord}
              onSuccess={() => setEditingRecord(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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
        <span className="text-xs text-zinc-500">
          {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {[
                "OT",
                "Cliente",
                "Equipo",
                "VIN",
                "Llegada",
                "Entrega",
                "Prioridad",
                "Estado",
                "Creado por",
                "Acciones",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2.5 text-xs text-zinc-500 uppercase tracking-wider font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-zinc-600">
                  {search
                    ? "Sin resultados para la búsqueda"
                    : "No hay registros aún"}
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                  i % 2 === 0 ? "" : "bg-zinc-900/20"
                }`}
              >
                <td className="px-3 py-2.5 font-mono text-amber-400 text-xs">
                  {r.ot || "—"}
                </td>
                <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap">
                  {r.cliente || "—"}
                </td>
                <td className="px-3 py-2.5 text-zinc-300">
                  {r.equipo || "—"}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">
                  {r.vin || "—"}
                </td>
                <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                  {fmtDate(r.llegada)}
                </td>
                <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">
                  {fmtDate(r.entrega)}
                </td>
                <td className="px-3 py-2.5">
                  {r.prioridad != null ? (
                    <Badge
                      variant="outline"
                      className={`text-xs ${priorityBadgeClass(r.prioridad)}`}
                    >
                      P{r.prioridad}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {/*
                     * Estado: Próx. entrega
                     * Campo booleano manual (proximo_a_entrega).
                     * Se marca en el formulario cuando el equipo tiene entrega próxima.
                     * No se calcula automáticamente.
                     */}
                    {r.proximo_a_entrega && (
                      <Badge className="text-xs bg-amber-500/20 text-amber-400 border-0">
                        Próx. entrega
                      </Badge>
                    )}
                    {/*
                     * Estado: Cotización
                     * Campo booleano manual (cotizacion).
                     * Indica que el equipo está en etapa de cotización, no confirmado.
                     */}
                    {r.cotizacion && (
                      <Badge className="text-xs bg-blue-500/20 text-blue-400 border-0">
                        Cotización
                      </Badge>
                    )}
                    {/*
                     * Estado: Atraso
                     * Campo numérico manual (atraso, en días).
                     * Representa un buffer de atraso conocido — NO es un cálculo automático
                     * comparando fecha planificada vs fecha de entrega.
                     * El CP-SAT usa este valor para ampliar el plazo objetivo del equipo:
                     *   due_day = llegada + duracion_total + atraso
                     * Se muestra el badge cuando atraso > 0.
                     */}
                    {r.atraso != null && r.atraso > 0 && (
                      <Badge className="text-xs bg-red-500/20 text-red-400 border-0">
                        Atraso
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-500 text-xs whitespace-nowrap">
                  {r.created_by || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingRecord(r)}
                      className="w-7 h-7 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="w-7 h-7 text-zinc-600 hover:text-red-400 hover:bg-red-950/30"
                    >
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
