import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import ExcelJS from "exceljs";
import { fmtDate as _fmtDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Wrap shared utility — returns empty string instead of "—" for spreadsheet cells
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

/** Returns array of working days (Mon–Fri) between start and end inclusive. */
function workingDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const dow = cur.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** "2026-02-23" → Date at midnight local */
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

// Colors per process (amber palette)
const PROC_COLORS: Record<string, string> = {
  ING:  "FFFDE68A", // yellow-100
  COR:  "FFFEF3C7", // yellow-50
  PLE:  "FFF5F3FF", // violet-50
  ARM:  "FFEDE9FE", // violet-100
  MON:  "FFDBEAFE", // sky-100
  HID:  "FFE0F2FE", // sky-50
  PINT: "FFBFDBFE", // blue-100
  TER:  "FFD1FAE5", // green-100
  CC:   "FFBBF7D0", // green-200
  REM:  "FFFCE7F3", // pink-50
  INS:  "FFFEE2E2", // red-50
};

function procColor(label: string): string {
  return PROC_COLORS[label] ?? "FFFFF7ED";
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // --- Data ---
  const [optimized, schedules] = await Promise.all([
    prisma.salesPlanningOptimized.findMany({
      where: { start_date: { not: null } },
      orderBy: { position: "asc" },
      include: { sales_planning: true },
    }),
    prisma.optimizedProcessSchedule.findMany({
      orderBy: [{ orden: "asc" }, { start_date: "asc" }],
      include: { sales_planning: true },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "ETP Sistema de Planificación";
  wb.created = new Date();

  // =========================================================================
  // Sheet 1 — Planificación (summary)
  // =========================================================================
  const ws1 = wb.addWorksheet("Planificación");

  const summaryHeaders = [
    "Posición", "OT", "Cliente Interno", "Cliente", "Código Plazo",
    "Equipo", "Modelo/Capacidad", "Camión", "Modelo", "VIN",
    "Llegada", "Entrega", "Inicio Planif.", "Fin Planif.",
    "Prioridad", "Atraso (días)", "Color", "OC", "Factura",
  ];

  ws1.addRow(summaryHeaders);
  styleHeaderRow(ws1.getRow(1), summaryHeaders.length);

  for (const o of optimized) {
    const r = o.sales_planning;
    ws1.addRow([
      o.position,
      r?.ot ?? "",
      r?.clte_interno ?? "",
      r?.cliente ?? "",
      r?.codigo_plazo ?? "",
      r?.equipo ?? "",
      r?.modelo_capacidad ?? "",
      r?.camion ?? "",
      r?.modelo ?? "",
      r?.vin ?? "",
      fmtDate(r?.llegada),
      fmtDate(r?.entrega),
      fmtDate(o.start_date),
      fmtDate(o.end_date),
      o.prioridad ?? r?.prioridad ?? "",
      r?.atraso ?? "",
      r?.color_eq ?? "",
      r?.oc ?? "",
      r?.factura ?? "",
    ]);
  }

  autoWidthSheet(ws1);
  ws1.views = [{ state: "frozen", ySplit: 1 }];

  // =========================================================================
  // Sheet 2 — Detalle por Proceso
  // =========================================================================
  const ws2 = wb.addWorksheet("Detalle por Proceso");

  const detailHeaders = [
    "OT", "Cliente", "Código Plazo", "Proceso", "Orden",
    "Inicio", "Fin", "Duración (días)", "Prioridad",
  ];

  ws2.addRow(detailHeaders);
  styleHeaderRow(ws2.getRow(1), detailHeaders.length);

  for (const s of schedules) {
    const r = s.sales_planning;
    ws2.addRow([
      r?.ot ?? "",
      r?.cliente ?? "",
      r?.codigo_plazo ?? "",
      s.proceso,
      s.orden,
      fmtDate(s.start_date),
      fmtDate(s.end_date),
      s.duration_days,
      r?.prioridad ?? "",
    ]);
  }

  autoWidthSheet(ws2);
  ws2.views = [{ state: "frozen", ySplit: 1 }];

  // =========================================================================
  // Sheet 3 — Planificación Gantt (matrix)
  // =========================================================================
  const ws3 = wb.addWorksheet("Planificación Optima");

  if (schedules.length > 0) {
    // Compute date range
    const allStarts = schedules.map((s) => parseDate(s.start_date)).filter(Boolean) as Date[];
    const allEnds   = schedules.map((s) => parseDate(s.end_date)).filter(Boolean) as Date[];

    const rangeStart = new Date(Math.min(...allStarts.map((d) => d.getTime())));
    const rangeEnd   = new Date(Math.max(...allEnds.map((d) => d.getTime())));

    const days = workingDays(rangeStart, rangeEnd);

    // Fixed info columns
    const INFO_COLS = ["Cód. Plazo", "OT", "Clte. Interno", "Cliente", "Equipo", "Modelo", "Prioridad"];
    const INFO_COUNT = INFO_COLS.length;
    const TOTAL_COLS = INFO_COUNT + days.length;

    // --- Header row ---
    const headerValues: string[] = [...INFO_COLS];
    for (const d of days) {
      const dow = DIAS_ES[d.getDay()];
      const dd  = String(d.getDate()).padStart(2, "0");
      const mm  = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      headerValues.push(`${dow}\n${dd}-${mm}-${yyyy}`);
    }

    const headerRow = ws3.addRow(headerValues);
    headerRow.height = 40;

    // Style info header cells
    for (let c = 1; c <= INFO_COUNT; c++) {
      const cell = headerRow.getCell(c);
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C1917" } }; // zinc-900
      cell.font   = { bold: true, color: { argb: "FFFBBF24" }, size: 9 };  // amber
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }

    // Style date header cells — alternate week shading
    for (let i = 0; i < days.length; i++) {
      const cell = headerRow.getCell(INFO_COUNT + i + 1);
      const weekNum = Math.floor(i / 5);
      const bgColor = weekNum % 2 === 0 ? "FF27272A" : "FF3F3F46"; // zinc-800 / zinc-700
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.font      = { bold: true, color: { argb: "FFE4E4E7" }, size: 7.5 };
      cell.border    = BORDER_THIN;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }

    // Build a lookup: salesPlanningId → { dayKey: shortLabel }
    // dayKey = "YYYY-MM-DD"
    type DayMap = Record<string, string>;
    const jobDayMap: Record<string, DayMap> = {};

    for (const s of schedules) {
      const sid   = s.sales_planning_id;
      const start = parseDate(s.start_date);
      const end   = parseDate(s.end_date);
      if (!start || !end) continue;

      if (!jobDayMap[sid]) jobDayMap[sid] = {};
      const label = shortLabel(s.proceso);

      // Fill every working day the process is active
      const cur = new Date(start);
      while (cur <= end) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) {
          const key = cur.toISOString().split("T")[0];
          // If multiple processes overlap on same day, keep first (by orden)
          if (!jobDayMap[sid][key]) jobDayMap[sid][key] = label;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Pre-compute day keys for fast lookup
    const dayKeys = days.map((d) => d.toISOString().split("T")[0]);

    // --- Data rows (one per job) ---
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

      const dataRow = ws3.addRow(rowValues);
      dataRow.height = 18;

      // Style info cells
      for (let c = 1; c <= INFO_COUNT; c++) {
        const cell = dataRow.getCell(c);
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18181B" } }; // zinc-900
        cell.font      = { color: { argb: "FFD4D4D8" }, size: 9 };
        cell.border    = BORDER_THIN;
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }

      // Style day cells
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
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF09090B" } }; // near-black
        }
      }
    }

    // --- Column widths ---
    // Info columns
    const infoWidths = [8, 10, 12, 18, 16, 14, 8];
    for (let i = 0; i < INFO_COUNT; i++) {
      ws3.getColumn(i + 1).width = infoWidths[i];
    }
    // Day columns — narrow
    for (let i = 0; i < days.length; i++) {
      ws3.getColumn(INFO_COUNT + i + 1).width = 5.5;
    }

    // --- Freeze: first row + info columns ---
    ws3.views = [
      {
        state: "frozen",
        xSplit: INFO_COUNT,
        ySplit: 1,
        topLeftCell: `${columnLetter(INFO_COUNT + 1)}2`,
        activeCell: `${columnLetter(INFO_COUNT + 1)}2`,
      },
    ];
  } else {
    ws3.addRow(["Sin datos de planificación. Ejecuta el planificador primero."]);
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

/** Convert 1-based column index to Excel letter (A, B, ... Z, AA ...) */
function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
