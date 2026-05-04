"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  salesPlanningSchema,
  type SalesPlanningInput,
  type SalesPlanningFormInput,
} from "@/lib/validations";
import { createRecord, updateRecord } from "@/actions/sales-planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { SalesPlanning } from "@/types";
import { useState } from "react";

interface PlanningFormProps {
  record?: SalesPlanning;
  onSuccess?: () => void;
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function n2u<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

// Required fields (marked with *)
const REQUIRED = new Set(["codigo_plazo", "llegada", "prioridad", "atraso"]);

const textFields: {
  name: keyof SalesPlanningFormInput;
  label: string;
  type?: string;
}[] = [
  { name: "ot", label: "OT" },
  { name: "clte_interno", label: "Cliente Interno" },
  { name: "cliente", label: "Cliente" },
  { name: "codigo_plazo", label: "Código Plazo" },
  { name: "equipo", label: "Equipo" },
  { name: "modelo_capacidad", label: "Modelo / Capacidad" },
  { name: "camion", label: "Camión" },
  { name: "modelo", label: "Modelo" },
  { name: "vin", label: "VIN" },
  { name: "llegada", label: "Llegada", type: "date" },
  { name: "entrega", label: "Entrega", type: "date" },
  { name: "venta", label: "Venta" },
  { name: "color_eq", label: "Color Equipo" },
  { name: "oc", label: "OC" },
  { name: "factura", label: "Factura" },
  { name: "correo", label: "Correo", type: "email" },
  { name: "patente", label: "Patente" },
  { name: "neumatico_de_repuesto", label: "Neumático Repuesto" },
  { name: "n_recepcion", label: "N° Recepción" },
  { name: "color_cabina", label: "Color Cabina" },
  { name: "atraso", label: "Atraso (días buffer)", type: "number" },
  { name: "prioridad", label: "Prioridad (1=alta)", type: "number" },
];

const checkboxFields: { name: keyof SalesPlanningFormInput; label: string }[] = [
  { name: "proximo_a_entrega", label: "Próx. Entrega" },
  { name: "cotizacion", label: "Cotización" },
];

export function PlanningForm({ record, onSuccess }: PlanningFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SalesPlanningFormInput>({
    resolver: zodResolver(salesPlanningSchema),
    defaultValues: record
      ? {
          ot: n2u(record.ot),
          clte_interno: n2u(record.clte_interno),
          cliente: n2u(record.cliente),
          codigo_plazo: n2u(record.codigo_plazo),
          equipo: n2u(record.equipo),
          modelo_capacidad: n2u(record.modelo_capacidad),
          camion: n2u(record.camion),
          modelo: n2u(record.modelo),
          vin: n2u(record.vin),
          llegada: formatDate(record.llegada) || undefined,
          entrega: formatDate(record.entrega) || undefined,
          venta: n2u(record.venta),
          color_eq: n2u(record.color_eq),
          oc: n2u(record.oc),
          factura: n2u(record.factura),
          proximo_a_entrega: record.proximo_a_entrega ?? false,
          cotizacion: record.cotizacion ?? false,
          correo: n2u(record.correo),
          patente: n2u(record.patente),
          neumatico_de_repuesto: n2u(record.neumatico_de_repuesto),
          n_recepcion: n2u(record.n_recepcion),
          color_cabina: n2u(record.color_cabina),
          atraso: n2u(record.atraso) ?? 0,
          prioridad: record.prioridad ?? 5,
        }
      : {
          prioridad: 5,
          atraso: 0,
          proximo_a_entrega: false,
          cotizacion: false,
        },
  });

  async function onSubmit(data: SalesPlanningFormInput) {
    setLoading(true);
    try {
      const result = record
        ? await updateRecord(record.id, data as SalesPlanningInput)
        : await createRecord(data as SalesPlanningInput);

      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Error de validación"
        );
      } else {
        toast.success(record ? "Registro actualizado" : "Registro creado");
        if (!record) reset();
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {textFields.map(({ name, label, type }) => {
          const required = REQUIRED.has(name);
          return (
            <div key={name} className="space-y-1">
              <Label
                htmlFor={name}
                className="text-xs text-zinc-400 uppercase tracking-wide flex items-center gap-1"
              >
                {label}
                {required && <span className="text-amber-500">*</span>}
              </Label>
              <Input
                id={name}
                type={type || "text"}
                {...register(name)}
                className={`bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-8 text-sm ${
                  required ? "border-zinc-600" : ""
                }`}
              />
              {errors[name] && (
                <p className="text-xs text-red-400">
                  {String(errors[name]?.message)}
                </p>
              )}
            </div>
          );
        })}

        {checkboxFields.map(({ name, label }) => (
          <div key={name} className="space-y-1">
            <Label className="text-xs text-zinc-400 uppercase tracking-wide">
              {label}
            </Label>
            <div className="flex items-center gap-2 h-8">
              <input
                type="checkbox"
                {...register(name)}
                className="accent-amber-500 w-4 h-4"
              />
              <span className="text-sm text-zinc-400">Sí</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 items-center">
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold"
        >
          {loading ? "Guardando..." : record ? "Actualizar" : "Crear Registro"}
        </Button>
        {!record && (
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Limpiar
          </Button>
        )}
        <span className="text-xs text-zinc-600 ml-2">
          <span className="text-amber-500">*</span> campos requeridos para planificación
        </span>
      </div>
    </form>
  );
}
