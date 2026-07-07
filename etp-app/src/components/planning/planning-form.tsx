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
  defaultPrioridad?: number;
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function n2u<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

// Required fields for planning (marked with *)
const REQUIRED = new Set(["codigo_plazo", "prioridad"]);

// ─── Create form: flat list (original layout) ───────────────────────────────

const textFields: {
  name: keyof SalesPlanningFormInput;
  label: string;
  type?: string;
  hint?: string;
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
  { name: "llegada", label: "Llegada", type: "date", hint: "Solo informativa" },
  { name: "inicio", label: "Inicio", type: "date", hint: "Sin fecha → excluido de planificación" },
  { name: "venta", label: "Venta" },
  { name: "color_eq", label: "Color Equipo" },
  { name: "oc", label: "OC" },
  { name: "factura", label: "Factura" },
  { name: "patente", label: "Patente" },
  { name: "neumatico_de_repuesto", label: "Neumático Repuesto" },
  { name: "n_recepcion", label: "N° Recepción" },
  { name: "color_cabina", label: "Color Cabina" },
  { name: "prioridad", label: "Prioridad (1=alta)", type: "number" },
];

/** "Nuevo Registro" — original flat grid layout */
export function PlanningForm({ onSuccess, defaultPrioridad }: Pick<PlanningFormProps, "onSuccess" | "defaultPrioridad">) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SalesPlanningFormInput>({
    resolver: zodResolver(salesPlanningSchema),
    defaultValues: {
      prioridad: defaultPrioridad ?? 1,
      atraso: 0,
      cotizacion: false,
    },
  });

  async function onSubmit(data: SalesPlanningFormInput) {
    setLoading(true);
    try {
      const result = await createRecord(data as SalesPlanningInput);
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Error de validación"
        );
      } else {
        toast.success("Registro creado");
        reset();
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("atraso")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {textFields.map(({ name, label, type, hint }) => {
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
              {hint && !errors[name] && (
                <p className="text-xs text-zinc-600">{hint}</p>
              )}
              {errors[name] && (
                <p className="text-xs text-red-400">
                  {String(errors[name]?.message)}
                </p>
              )}
            </div>
          );
        })}

        <div className="space-y-1">
          <Label className="text-xs text-zinc-400 uppercase tracking-wide">
            Cotización
          </Label>
          <div className="flex items-center gap-2 h-8">
            <input
              type="checkbox"
              {...register("cotizacion")}
              className="accent-amber-500 w-4 h-4"
            />
            <span className="text-sm text-zinc-400">Sí</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6"
        >
          {loading ? "Guardando..." : "Crear Registro"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          Limpiar
        </Button>
        <span className="text-xs text-zinc-600 ml-auto">
          <span className="text-amber-500">*</span> campos requeridos para planificación
        </span>
      </div>
    </form>
  );
}

// ─── Edit modal: sectioned layout ────────────────────────────────────────────

type FieldDef = {
  name: keyof SalesPlanningFormInput;
  label: string;
  type?: string;
  hint?: string;
};

const EDIT_SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Identificación",
    fields: [
      { name: "ot", label: "OT" },
      { name: "clte_interno", label: "Cliente Interno" },
      { name: "cliente", label: "Cliente" },
      { name: "codigo_plazo", label: "Código Plazo" },
    ],
  },
  {
    title: "Equipo",
    fields: [
      { name: "equipo", label: "Equipo" },
      { name: "modelo_capacidad", label: "Modelo / Capacidad" },
      { name: "camion", label: "Camión" },
      { name: "modelo", label: "Modelo" },
      { name: "vin", label: "VIN" },
      { name: "patente", label: "Patente" },
    ],
  },
  {
    title: "Fechas y planificación",
    fields: [
      { name: "llegada", label: "Llegada", type: "date", hint: "Solo informativa" },
      { name: "inicio", label: "Inicio", type: "date", hint: "Sin fecha → excluido de planificación" },
      { name: "prioridad", label: "Prioridad (1=alta)", type: "number" },
    ],
  },
  {
    title: "Comercial / Documentos",
    fields: [
      { name: "venta", label: "Venta" },
      { name: "oc", label: "OC" },
      { name: "factura", label: "Factura" },
    ],
  },
  {
    title: "Detalles físicos",
    fields: [
      { name: "color_eq", label: "Color Equipo" },
      { name: "neumatico_de_repuesto", label: "Neumático Repuesto" },
      { name: "n_recepcion", label: "N° Recepción" },
      { name: "color_cabina", label: "Color Cabina" },
    ],
  },
];

/** "Editar Registro" — sectioned layout, no atraso field */
export function PlanningEditForm({ record, onSuccess }: { record: SalesPlanning; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalesPlanningFormInput>({
    resolver: zodResolver(salesPlanningSchema),
    defaultValues: {
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
      inicio: formatDate(record.inicio) || undefined,
      venta: n2u(record.venta),
      color_eq: n2u(record.color_eq),
      oc: n2u(record.oc),
      factura: n2u(record.factura),
      cotizacion: record.cotizacion ?? false,
      patente: n2u(record.patente),
      neumatico_de_repuesto: n2u(record.neumatico_de_repuesto),
      n_recepcion: n2u(record.n_recepcion),
      color_cabina: n2u(record.color_cabina),
      atraso: n2u(record.atraso) ?? 0,
      prioridad: record.prioridad ?? 5,
      entregado: record.entregado ? "true" : "false",
    },
  });

  async function onSubmit(data: SalesPlanningFormInput) {
    setLoading(true);
    try {
      const result = await updateRecord(record.id, data as SalesPlanningInput);
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Error de validación"
        );
      } else {
        toast.success("Registro actualizado");
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pt-2">
      <input type="hidden" {...register("atraso")} />

      {/* Single two-column grid: 160px label | 1fr input */}
      <div className="grid items-center gap-x-6 gap-y-2" style={{ gridTemplateColumns: "160px 1fr" }}>
        {EDIT_SECTIONS.flatMap(({ title, fields }) => [
          /* Section divider — spans both columns */
          <div key={`s-${title}`} className="col-span-2 flex items-center gap-3 pt-4 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">{title}</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>,
          /* Fields */
          ...fields.flatMap(({ name, label, type, hint }) => [
            <Label
              key={`l-${name}`}
              htmlFor={`edit-${name}`}
              className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide leading-tight flex items-center gap-1"
            >
              {label}{REQUIRED.has(name) && <span className="text-amber-500">*</span>}
            </Label>,
            <div key={`f-${name}`}>
              <Input
                id={`edit-${name}`}
                type={type || "text"}
                {...register(name)}
                className={`etp-modal-input ${errors[name] ? "!border-red-500/70" : ""}`}
              />
              {hint && !errors[name] && <p className="text-[11px] text-zinc-600 leading-tight mt-1">{hint}</p>}
              {errors[name] && <p className="text-[11px] text-red-400 leading-tight mt-1">{String(errors[name]?.message)}</p>}
            </div>,
          ]),
        ])}

        {/* Estado de entrega */}
        <div className="col-span-2 flex items-center gap-3 pt-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Estado de entrega</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
        <Label htmlFor="edit-entregado" className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
          Entregado
        </Label>
        <select
          id="edit-entregado"
          {...register("entregado")}
          className="etp-modal-input"
        >
          <option value="false">NO</option>
          <option value="true">SÍ</option>
        </select>
        <Label htmlFor="edit-cotizacion" className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
          Cotización
        </Label>
        <div className="flex items-center h-9">
          <input
            type="checkbox"
            id="edit-cotizacion"
            {...register("cotizacion")}
            className="accent-amber-500 w-4 h-4 rounded"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-3 mt-4 items-center border-t border-zinc-800">
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-6"
        >
          {loading ? "Guardando..." : "Actualizar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSuccess()}
          className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          Cancelar
        </Button>
        <span className="text-xs text-zinc-600 ml-auto">
          <span className="text-amber-500">*</span> campos requeridos para planificación
        </span>
      </div>
    </form>
  );
}
