import { z } from "zod";

export const localLoginSchema = z.object({
  username: z.string().min(1, "Ingresa tu usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const localRegisterSchema = z
  .object({
    username: z
      .string()
      .min(3, "Mínimo 3 caracteres")
      .max(30, "Máximo 30 caracteres")
      .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, puntos o guiones"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LocalLoginInput = z.infer<typeof localLoginSchema>;
export type LocalRegisterInput = z.infer<typeof localRegisterSchema>;

export const salesPlanningSchema = z.object({
  ot: z.string().optional(),
  clte_interno: z.string().optional(),
  cliente: z.string().optional(),
  // Required for planning
  codigo_plazo: z.string().min(1, "Requerido"),
  llegada: z.string().min(1, "Requerido"),
  prioridad: z.coerce.number().int().min(1, "Mínimo 1").max(10, "Máximo 10"),
  atraso: z.coerce.number().int().min(0, "Mínimo 0 días"),
  // Optional fields
  equipo: z.string().optional(),
  modelo_capacidad: z.string().optional(),
  camion: z.string().optional(),
  modelo: z.string().optional(),
  vin: z.string().optional(),
  entrega: z.string().optional(),
  venta: z.string().optional(),
  color_eq: z.string().optional(),
  oc: z.string().optional(),
  factura: z.string().optional(),
  proximo_a_entrega: z.boolean().optional().default(false),
  cotizacion: z.boolean().optional().default(false),
  correo: z.string().email("Email inválido").optional().or(z.literal("")),
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
