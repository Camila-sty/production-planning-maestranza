import { z } from "zod";

export const ALLOWED_EMAIL_DOMAINS = [
  "equiposycamiones.cl",
  "pto.cl",
  "etpequipos.cl",
] as const;

export const ADMIN_EMAIL_EXCEPTIONS = [
  "camila.estay.callealta@gmail.com",
  "cpestay@uc.cl",
] as const;

const DOMAIN_ERROR =
  "Solo se permiten correos corporativos con los dominios @equiposycamiones.cl, @pto.cl o @etpequipos.cl.";

function hasAllowedDomain(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if ((ADMIN_EMAIL_EXCEPTIONS as readonly string[]).includes(normalized)) return true;
  const domain = normalized.split("@")[1];
  return !!domain && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export const localLoginSchema = z
  .object({
    email: z.string().email("Correo inválido"),
    password: z.string().min(1, "Ingresa tu contraseña"),
  })
  .refine((d) => hasAllowedDomain(d.email), {
    message: DOMAIN_ERROR,
    path: ["email"],
  });

export const localRegisterSchema = z
  .object({
    email: z.string().email("Correo inválido"),
    name: z.string().min(2, "Mínimo 2 caracteres").optional(),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((d) => hasAllowedDomain(d.email), {
    message: DOMAIN_ERROR,
    path: ["email"],
  });

export type LocalLoginInput = z.infer<typeof localLoginSchema>;
export type LocalRegisterInput = z.infer<typeof localRegisterSchema>;

export const salesPlanningSchema = z.object({
  ot: z.string().optional(),
  clte_interno: z.string().optional(),
  cliente: z.string().optional(),
  // Required for planning
  codigo_plazo: z.string().min(1, "Requerido"),
  prioridad: z.coerce.number().int().min(1, "Mínimo 1"),
  atraso: z.coerce.number().int(),
  // llegada is informational only
  llegada: z.string().optional(),
  // inicio drives planning — records without inicio are excluded
  inicio: z.string().optional(),
  // entregado: excluded from planning when true
  entregado: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional().default(false),
  // Optional fields
  equipo: z.string().optional(),
  modelo_capacidad: z.string().optional(),
  camion: z.string().optional(),
  modelo: z.string().optional(),
  vin: z.string().optional(),
  venta: z.string().optional(),
  color_eq: z.string().optional(),
  oc: z.string().optional(),
  factura: z.string().optional(),
  cotizacion: z.boolean().optional().default(false),
  patente: z.string().optional(),
  neumatico_de_repuesto: z.string().optional(),
  n_recepcion: z.string().optional(),
  color_cabina: z.string().optional(),
});

export type SalesPlanningInput = z.infer<typeof salesPlanningSchema>;
export type SalesPlanningFormInput = z.input<typeof salesPlanningSchema>;

// --- Lead time schema ---
export const leadTimeSchema = z.object({
  codigo_plazo: z.string().min(1, "Requerido"),
  descripcion_equipo: z.string().optional(),
  proceso: z.string().min(1, "Requerido"),
  duracion_dias: z.coerce.number().int().min(0, "Mínimo 0"),
});
export type LeadTimeInput = z.infer<typeof leadTimeSchema>;

// --- Process capacity schema ---
export const processCapacitySchema = z.object({
  proceso: z.string().min(1, "Requerido"),
  orden: z.coerce.number().int().min(0, "Mínimo 0"),
  capacidad_por_dia: z.coerce.number().int().min(0, "Mínimo 0"),
});
export type ProcessCapacityInput = z.infer<typeof processCapacitySchema>;

// --- Buffer schema ---
export const planningBufferSchema = z.object({
  buffer_days: z.coerce.number().int().min(-365, "Mínimo -365").max(365, "Máximo 365"),
  note: z.string().optional(),
});
export type PlanningBufferInput = z.infer<typeof planningBufferSchema>;

// --- Special working day schema ---
export const specialWorkingDaySchema = z.object({
  date: z.string().min(1, "Requerido"),
  type: z.enum(["HOLIDAY_WORKING", "WEEKEND_WORKING", "EXTRA_WORKING_DAY"]).default("WEEKEND_WORKING"),
  description: z.string().optional(),
});
export type SpecialWorkingDayInput = z.infer<typeof specialWorkingDaySchema>;
