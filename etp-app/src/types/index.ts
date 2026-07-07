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
  inicio: Date | null;
  entregado: boolean;
  fecha_entrega_real: Date | null;
  venta: string | null;
  color_eq: string | null;
  oc: string | null;
  factura: string | null;
  cotizacion: boolean;
  patente: string | null;
  neumatico_de_repuesto: string | null;
  n_recepcion: string | null;
  color_cabina: string | null;
  atraso: number | null;
  prioridad: number | null;
  planning_buffer_days: number | null;
  planning_buffer_note: string | null;
  planning_buffer_at: Date | null;
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
  planning_run_id: string | null;
  position: number;
  start_date: Date | null;
  end_date: Date | null;
  prioridad: number | null;
  codigo_plazo: string | null;
  created_at: Date;
  sales_planning?: SalesPlanning | null;
};

export type PlanningRun = {
  id: string;
  version: number;
  status: string;
  created_at: Date;
  created_by: string | null;
  notes: string | null;
};

export type PlanRunHistoryEntry = {
  version: number;
  runDate: string;   // ISO string
  endDate: string;   // ISO string
  status: string;    // ACTIVE | PREVIOUS | ARCHIVED
};

export type SpecialWorkingDay = {
  id: string;
  date: Date;
  type: string;
  description: string | null;
  created_at: Date;
  created_by: string | null;
  planning_run_id: string | null;
  used_in_planning: boolean;
};
