-- CreateTable
CREATE TABLE "sales_planning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ot" TEXT,
    "clte_interno" TEXT,
    "cliente" TEXT,
    "codigo_plazo" TEXT,
    "equipo" TEXT,
    "modelo_capacidad" TEXT,
    "camion" TEXT,
    "modelo" TEXT,
    "vin" TEXT,
    "llegada" DATETIME,
    "entrega" DATETIME,
    "venta" DATETIME,
    "color_eq" TEXT,
    "oc" TEXT,
    "factura" TEXT,
    "proximo_a_entrega" BOOLEAN NOT NULL DEFAULT false,
    "cotizacion" TEXT,
    "correo" TEXT,
    "patente" TEXT,
    "neumatico_de_repuesto" BOOLEAN NOT NULL DEFAULT false,
    "n_recepcion" TEXT,
    "color_cabina" TEXT,
    "atraso" INTEGER,
    "prioridad" INTEGER DEFAULT 5,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT
);

-- CreateTable
CREATE TABLE "sales_planning_optimized" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sales_planning_id" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_planning_optimized_sales_planning_id_fkey" FOREIGN KEY ("sales_planning_id") REFERENCES "sales_planning" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
