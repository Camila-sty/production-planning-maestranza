export type SalesPlanning = {
  id: string;
  ot: string | null;
  clte_interno: string | null;
  cliente: string | null;
  codigo_plazo: string | null;
  equipo: string | null;
  modelo_capacidad: string | null;
  camion: string | null;
  modelo: string | null;
  vin: string | null;
  llegada: Date | null;
  entrega: Date | null;
  venta: string | null;
  color_eq: string | null;
  oc: string | null;
  factura: string | null;
  proximo_a_entrega: boolean;
  cotizacion: boolean;
  correo: string | null;
  patente: string | null;
  neumatico_de_repuesto: string | null;
  n_recepcion: string | null;
  color_cabina: string | null;
  atraso: number | null;
  prioridad: number | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
};

export type LeadTimeByCode = {
  id: string;
  codigo_plazo: string;
  descripcion_equipo: string | null;
  proceso: string;
  duracion_dias: number;
  created_at: Date;
  updated_at: Date;
};

export type ProcessCapacity = {
  id: string;
  proceso: string;
  orden: number;
  capacidad_por_dia: number;
  created_at: Date;
  updated_at: Date;
};

export type OptimizedResult = {
  id: string;
  sales_planning_id: string | null;
  position: number;
  start_date: Date | null;
  end_date: Date | null;
  prioridad: number | null;
  codigo_plazo: string | null;
  created_at: Date;
  sales_planning?: SalesPlanning | null;
};
