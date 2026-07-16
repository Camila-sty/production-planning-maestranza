-- CreateTable
CREATE TABLE "local_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_planning" (
    "id" TEXT NOT NULL,
    "ot" TEXT,
    "clte_interno" TEXT,
    "cliente" TEXT,
    "codigo_plazo" TEXT,
    "equipo" TEXT,
    "modelo_capacidad" TEXT,
    "camion" TEXT,
    "modelo" TEXT,
    "vin" TEXT,
    "llegada" TIMESTAMP(3),
    "inicio" TIMESTAMP(3),
    "entregado" BOOLEAN NOT NULL DEFAULT false,
    "venta" TEXT,
    "color_eq" TEXT,
    "oc" TEXT,
    "factura" TEXT,
    "cotizacion" BOOLEAN NOT NULL DEFAULT false,
    "correo" TEXT,
    "patente" TEXT,
    "neumatico_de_repuesto" TEXT,
    "n_recepcion" TEXT,
    "color_cabina" TEXT,
    "atraso" INTEGER,
    "prioridad" INTEGER DEFAULT 5,
    "fecha_entrega_real" TIMESTAMP(3),
    "planning_buffer_days" INTEGER,
    "planning_buffer_note" TEXT,
    "planning_buffer_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "sales_planning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_run" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "planning_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_planning_optimized" (
    "id" TEXT NOT NULL,
    "sales_planning_id" TEXT,
    "planning_run_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "prioridad" INTEGER,
    "codigo_plazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_planning_optimized_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_time_by_code" (
    "id" TEXT NOT NULL,
    "codigo_plazo" TEXT NOT NULL,
    "descripcion_equipo" TEXT,
    "proceso" TEXT NOT NULL,
    "duracion_dias" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_time_by_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_capacity" (
    "id" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "capacidad_por_dia" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_capacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimized_process_schedule" (
    "id" TEXT NOT NULL,
    "sales_planning_id" TEXT NOT NULL,
    "planning_run_id" TEXT,
    "proceso" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optimized_process_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_buffer_adjustment" (
    "id" TEXT NOT NULL,
    "sales_planning_id" TEXT NOT NULL,
    "buffer_days" INTEGER NOT NULL,
    "prev_buffer_days" INTEGER,
    "delta_days" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "planning_buffer_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_working_day" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WEEKEND_WORKING',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "planning_run_id" TEXT,
    "used_in_planning" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "special_working_day_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "local_users_email_key" ON "local_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lead_time_by_code_codigo_plazo_proceso_key" ON "lead_time_by_code"("codigo_plazo", "proceso");

-- CreateIndex
CREATE UNIQUE INDEX "process_capacity_proceso_key" ON "process_capacity"("proceso");

-- AddForeignKey
ALTER TABLE "sales_planning_optimized" ADD CONSTRAINT "sales_planning_optimized_sales_planning_id_fkey" FOREIGN KEY ("sales_planning_id") REFERENCES "sales_planning"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_planning_optimized" ADD CONSTRAINT "sales_planning_optimized_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimized_process_schedule" ADD CONSTRAINT "optimized_process_schedule_sales_planning_id_fkey" FOREIGN KEY ("sales_planning_id") REFERENCES "sales_planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimized_process_schedule" ADD CONSTRAINT "optimized_process_schedule_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_buffer_adjustment" ADD CONSTRAINT "planning_buffer_adjustment_sales_planning_id_fkey" FOREIGN KEY ("sales_planning_id") REFERENCES "sales_planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_working_day" ADD CONSTRAINT "special_working_day_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
