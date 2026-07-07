import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import ExcelJS from "exceljs";
import { fmtDate as _fmtDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date | string | null | undefined): string {
  return _fmtDate(d, "");
}

const DIAS_ES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

const PROCESS_SHORT: Record<string, string> = {
  "INGENIERÍA":          "ING",
  "INGENIERIA":          "ING",
  "CORTE":               "COR",
  "PLEGADO":             "PLE",
  "ARMADO":              "ARM",
  "MONTAJE":             "MON",
  "HIDRÁULICA":          "HID",
  "HIDRAULICA":          "HID",
  "PINTURA":             "PINT",
  "TERMINACIONES":       "TER",
  "CONTROL DE CALIDAD":  "CC",
  "REMATE":              "REM",
  "INSPECCIÓN":          "INS",
  "INSPECCION":          "INS",
};

function shortLabel(proceso: string): string {
  return PROCESS_SHORT[proceso.toUpperCase().trim()] ?? proceso.slice(0, 4).toUpperCase();
}

function slotLabel(proceso: string, slot: number): string {
  return `${shortLabel(proceso)}${slot}`;
}

/**
 * Returns array of working days between start and end inclusive.
 * Includes Mon–Fri plus any date present in specialDays (YYYY-MM-DD keys).
 * Mirrors the logic of build_working_calendar() in planner.py.
 */
function workingDays(start: Date, end: Date, specialDays?: Set<string>): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const dow = cur.getDay();
    const key = cur.toISOString().split("T")[0];
    if (dow !== 0 && dow !== 6 || specialDays?.has(key)) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function parseDate(s: Date | string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(new Date(s).toISOString().split("T")[0] + "T00:00:00");
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const BORDER_THIN = {
  top:      { style: "thin" as const, color: { argb: "FFB0B0B0" } },
  left:     { style: "thin" as const, color: { argb: "FFB0B0B0" } },
  bottom:   { style: "thin" as const, color: { argb: "FFB0B0B0" } },
  right:    { style: "thin" as const, color: { argb: "FFB0B0B0" } },
  diagonal: { style: "thin" as const, color: { argb: "FFB0B0B0" } },
};

const PROC_COLORS: Record<string, string> = {
  ING:  "FFFDE68A",
  COR:  "FFFEF3C7",
  PLE:  "FFF5F3FF",
  ARM:  "FFEDE9FE",
  MON:  "FFDBEAFE",
  HID:  "FFE0F2FE",
  PINT: "FFBFDBFE",
  TER:  "FFD1FAE5",
  CC:   "FFBBF7D0",
  REM:  "FFFCE7F3",
  INS:  "FFFEE2E2",
};

function procColor(label: string): string {
  // Strip trailing digits to get the base short code
  const base = label.replace(/\d+$/, "");
  return PROC_COLORS[base] ?? "FFFFF7ED";
}

// ---------------------------------------------------------------------------
// Priority sort helper
// ---------------------------------------------------------------------------

/**
 * Parse a priority value to a sortable number.
 * Handles: number (14), string "14", string "P14".
 * Null / invalid → Infinity (sorted to the end).
 */
function parsePriority(val: number | string | null | undefined): number {
  if (val == null || val === "") return Infinity;
  if (typeof val === "number") return isNaN(val) ? Infinity : val;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : Infinity;
}

function sortByPriority<T extends OptRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = parsePriority(a.prioridad ?? a.sales_planning?.prioridad);
    const pb = parsePriority(b.prioridad ?? b.sales_planning?.prioridad);
    return pa - pb;
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Find planning runs
  const [activeRun, previousRun] = await Promise.all([
    prisma.planningRun.findFirst({ where: { status: "ACTIVE" } }),
    prisma.planningRun.findFirst({ where: { status: "PREVIOUS" } }),
  ]);

  // Load data for active run (or fallback to all records if no run exists)
  const activeFilter = activeRun
    ? { planning_run_id: activeRun.id }
    : { start_date: { not: null as null } };

  const allRecords = await prisma.salesPlanning.findMany({
    orderBy: { created_at: "asc" },
  });

  const [optimized, schedules] = await Promise.all([
    prisma.salesPlanningOptimized.findMany({
      where: { ...activeFilter, start_date: { not: null } },
      orderBy: { position: "asc" },
      include: { sales_planning: true },
    }),
    prisma.optimizedProcessSchedule.findMany({
      where: activeRun ? { planning_run_id: activeRun.id } : {},
      orderBy: [{ orden: "asc" }, { start_date: "asc" }],
      include: { sales_planning: true },
    }),
  ]);

  // Load previous run data if it exists
  const [prevOptimized, prevSchedules] = previousRun
    ? await Promise.all([
        prisma.salesPlanningOptimized.findMany({
          where: { planning_run_id: previousRun.id, start_date: { not: null } },
          orderBy: { position: "asc" },
          include: { sales_planning: true },
        }),
        prisma.optimizedProcessSchedule.findMany({
          where: { planning_run_id: previousRun.id },
          orderBy: [{ orden: "asc" }, { start_date: "asc" }],
          include: { sales_planning: true },
        }),
      ])
    : [[], []];

  // Each planning run should use only the special working days that existed
  // at the moment that run was created.  We compare created_at timestamps so
  // a day added after a run never appears in that run's Gantt calendar.
  const toDateKey = (d: Date | string) =>
    new Date(new Date(d).toISOString().split("T")[0] + "T00:00:00").toISOString().split("T")[0];

  const allSpecialDays = await prisma.specialWorkingDay.findMany();

  const activeSpecialSet = new Set(
    allSpecialDays
      .filter((d) => !activeRun || d.created_at <= activeRun.created_at)
      .map((d) => toDateKey(d.date))
  );
  const prevSpecialSet = new Set(
    allSpecialDays
      .filter((d) => !previousRun || d.created_at <= previousRun.created_at)
      .map((d) => toDateKey(d.date))
  );

  // Build endDateMap from active run: salesPlanningId → end_date string
  const endDateMap: Record<string, Date | null> = {};
  for (const o of optimized) {
    if (o.sales_planning_id && o.end_date) {
      endDateMap[o.sales_planning_id] = new Date(o.end_date);
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "ETP Sistema de Planificación";
  wb.created = new Date();

  // =========================================================================
  // Sheet 1 — Registros (all records)
  // =========================================================================
  const ws1 = wb.addWorksheet("Registros");

  const summaryHeaders = [
    "OT", "Cliente Interno", "Cliente", "Código Plazo",
    "Equipo", "Modelo/Capacidad", "Camión", "Modelo", "VIN",
    "Llegada", "Inicio", "Fecha Entrega",
    "Venta", "Color Equipo", "OC", "Factura",
    "Patente", "N° Recepción", "Color Cabina",
    "Neumático Repuesto", "Cotización", "Entregado",
    "Prioridad", "Atraso (días)",
    "Creado por", "Fecha Creación",
  ];

  ws1.addRow(summaryHeaders);
  styleHeaderRow(ws1.getRow(1), summaryHeaders.length);

  for (const r of allRecords) {
    const dataRow = ws1.addRow([
      r.ot ?? "",
      r.clte_interno ?? "",
      r.cliente ?? "",
      r.codigo_plazo ?? "",
      r.equipo ?? "",
      r.modelo_capacidad ?? "",
      r.camion ?? "",
      r.modelo ?? "",
      r.vin ?? "",
      fmtDate(r.llegada),
      fmtDate(r.inicio),
      r.fecha_entrega_real ? fmtDate(r.fecha_entrega_real) : fmtDate(endDateMap[r.id] ?? null),
      r.venta ?? "",
      r.color_eq ?? "",
      r.oc ?? "",
      r.factura ?? "",
      r.patente ?? "",
      r.n_recepcion ?? "",
      r.color_cabina ?? "",
      r.neumatico_de_repuesto ?? "",
      r.cotizacion ? "SÍ" : "NO",
      r.entregado ? "SÍ" : "NO",
      r.prioridad ?? "",
      r.atraso ?? "",
      r.created_by ?? "",
      fmtDate(r.created_at),
    ]);
    if (r.entregado) {
      for (let c = 1; c <= summaryHeaders.length; c++) {
        const cell = dataRow.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" } };
        cell.font = { ...cell.font, color: { argb: "FF5D4037" } };
      }
    }
  }

  autoWidthSheet(ws1);
  ws1.views = [{ state: "frozen", ySplit: 1 }];

  // =========================================================================
  // Sheet 2 — Detalle por Proceso (with slot)
  // =========================================================================
  const ws2 = wb.addWorksheet("Detalle por Proceso");

  const detailHeaders = [
    "OT", "Cliente", "Código Plazo", "Proceso", "Orden",
    "Slot", "Proceso+Slot",
    "Inicio", "Fin", "Duración (días)", "Prioridad",
  ];

  ws2.addRow(detailHeaders);
  styleHeaderRow(ws2.getRow(1), detailHeaders.length);

  for (const s of schedules) {
    const r = s.sales_planning;
    const label = slotLabel(s.proceso, s.slot);
    ws2.addRow([
      r?.ot ?? "",
      r?.cliente ?? "",
      r?.codigo_plazo ?? "",
      s.proceso,
      s.orden,
      s.slot,
      label,
      fmtDate(s.start_date),
      fmtDate(s.end_date),
      s.duration_days,
      r?.prioridad ?? "",
    ]);
  }

  autoWidthSheet(ws2);
  ws2.views = [{ state: "frozen", ySplit: 1 }];

  // =========================================================================
  // Sheet 3 — Planificación Optima (Gantt with slots)
  // =========================================================================
  buildGanttSheet(wb, "Planificación Optima", sortByPriority(optimized), schedules, activeRun?.created_at, activeSpecialSet);

  // =========================================================================
  // Sheet 4 — Planificación Optima Anterior (if exists)
  // =========================================================================
  if (previousRun && prevOptimized.length > 0) {
    buildGanttSheet(wb, "Planificación Optima Anterior", sortByPriority(prevOptimized), prevSchedules, previousRun.created_at, prevSpecialSet);
  } else if (previousRun) {
    const wsPrev = wb.addWorksheet("Planificación Optima Anterior");
    wsPrev.addRow(["Sin datos de planificación anterior disponibles."]);
  }

  // =========================================================================
  // Stream response
  // =========================================================================
  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="planificacion_etp.xlsx"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Gantt sheet builder
// ---------------------------------------------------------------------------

type OptRow = {
  position: number;
  sales_planning_id: string | null;
  start_date: Date | null;
  end_date: Date | null;
  prioridad: number | null;
  codigo_plazo: string | null;
  sales_planning: {
    ot: string | null;
    clte_interno: string | null;
    cliente: string | null;
    equipo: string | null;
    modelo: string | null;
    prioridad: number | null;
    codigo_plazo: string | null;
  } | null;
};

type SchedRow = {
  sales_planning_id: string;
  proceso: string;
  slot: number;
  start_date: Date;
  end_date: Date;
};

function buildGanttSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  optimized: OptRow[],
  schedules: SchedRow[],
  runCreatedAt?: Date,
  specialDays?: Set<string>,
) {
  const ws = wb.addWorksheet(sheetName);

  if (schedules.length === 0) {
    ws.addRow(["Sin datos de planificación. Ejecuta el planificador primero."]);
    return;
  }

  const allStarts = schedules.map((s) => parseDate(s.start_date)).filter(Boolean) as Date[];
  const allEnds   = schedules.map((s) => parseDate(s.end_date)).filter(Boolean) as Date[];

  const rangeStart = new Date(Math.min(...allStarts.map((d) => d.getTime())));
  const rangeEnd   = new Date(Math.max(...allEnds.map((d) => d.getTime())));

  const days = workingDays(rangeStart, rangeEnd, specialDays);

  const INFO_COLS = ["Cód. Plazo", "OT", "Clte. Interno", "Cliente", "Equipo", "Modelo", "Prioridad"];
  const INFO_COUNT = INFO_COLS.length;

  // --- Header row ---
  const headerValues: string[] = [...INFO_COLS];
  for (const d of days) {
    const dow  = DIAS_ES[d.getDay()];
    const dd   = String(d.getDate()).padStart(2, "0");
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    headerValues.push(`${dow}\n${dd}-${mm}-${yyyy}`);
  }

  const headerRow = ws.addRow(headerValues);
  headerRow.height = 40;

  for (let c = 1; c <= INFO_COUNT; c++) {
    const cell = headerRow.getCell(c);
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C1917" } };
    cell.font   = { bold: true, color: { argb: "FFFBBF24" }, size: 9 };
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  for (let i = 0; i < days.length; i++) {
    const cell = headerRow.getCell(INFO_COUNT + i + 1);
    const weekNum = Math.floor(i / 5);
    const bgColor = weekNum % 2 === 0 ? "FF27272A" : "FF3F3F46";
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    cell.font      = { bold: true, color: { argb: "FFE4E4E7" }, size: 7.5 };
    cell.border    = BORDER_THIN;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  // Add run date as second row if available
  if (runCreatedAt) {
    const metaRow = ws.addRow([
      `Generado: ${new Date(runCreatedAt).toLocaleString("es-CL", { timeZone: "America/Santiago" })}`,
      ...Array(INFO_COUNT - 1 + days.length).fill(""),
    ]);
    metaRow.height = 14;
    metaRow.getCell(1).font = { italic: true, color: { argb: "FF71717A" }, size: 8 };
  }

  // Build lookup: salesPlanningId → { dayKey: slotLabel }
  type DayMap = Record<string, string>;
  const jobDayMap: Record<string, DayMap> = {};

  for (const s of schedules) {
    const sid   = s.sales_planning_id;
    const start = parseDate(s.start_date);
    const end   = parseDate(s.end_date);
    if (!start || !end) continue;

    if (!jobDayMap[sid]) jobDayMap[sid] = {};
    const label = slotLabel(s.proceso, s.slot);

    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      const key = cur.toISOString().split("T")[0];
      if (dow !== 0 && dow !== 6 || specialDays?.has(key)) {
        if (!jobDayMap[sid][key]) jobDayMap[sid][key] = label;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const dayKeys = days.map((d) => d.toISOString().split("T")[0]);

  // --- Data rows ---
  for (const o of optimized) {
    const r   = o.sales_planning;
    const sid = o.sales_planning_id ?? "";
    const dayMap = jobDayMap[sid] ?? {};

    const rowValues: (string | number)[] = [
      r?.codigo_plazo ?? "",
      r?.ot ?? "",
      r?.clte_interno ?? "",
      r?.cliente ?? "",
      r?.equipo ?? "",
      r?.modelo ?? "",
      o.prioridad ?? r?.prioridad ?? "",
    ];

    for (const key of dayKeys) {
      rowValues.push(dayMap[key] ?? "");
    }

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 18;

    for (let c = 1; c <= INFO_COUNT; c++) {
      const cell = dataRow.getCell(c);
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } };
      cell.font      = { color: { argb: "FFD4D4D8" }, size: 9 };
      cell.border    = BORDER_THIN;
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }

    for (let i = 0; i < days.length; i++) {
      const cell  = dataRow.getCell(INFO_COUNT + i + 1);
      const label = String(rowValues[INFO_COUNT + i] ?? "");

      cell.border    = BORDER_THIN;
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.font      = { bold: !!label, size: 8 };

      if (label) {
        cell.value = label;
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: procColor(label) } };
        cell.font  = { bold: true, color: { argb: "FF1C1917" }, size: 8 };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF09090B" } };
      }
    }
  }

  // Column widths
  const infoWidths = [8, 10, 12, 18, 16, 14, 8];
  for (let i = 0; i < INFO_COUNT; i++) {
    ws.getColumn(i + 1).width = infoWidths[i];
  }
  for (let i = 0; i < days.length; i++) {
    ws.getColumn(INFO_COUNT + i + 1).width = 6;
  }

  ws.views = [
    {
      state: "frozen",
      xSplit: INFO_COUNT,
      ySplit: 1,
      topLeftCell: `${columnLetter(INFO_COUNT + 1)}2`,
      activeCell: `${columnLetter(INFO_COUNT + 1)}2`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C1917" } };
    cell.font      = { bold: true, color: { argb: "FFFBBF24" }, size: 10 };
    cell.border    = BORDER_THIN;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
}

function autoWidthSheet(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value ? String(cell.value) : "";
      if (v.length > max) max = v.length;
    });
    col.width = Math.min(max + 2, 40);
  });
}

function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
