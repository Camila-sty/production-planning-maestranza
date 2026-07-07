"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type DelayEvent = {
  id: string;
  date: string;     // YYYY-MM-DD
  proceso: string;
  ot: string | null;
  buffer_days: number;
  prev_buffer_days: number | null;
  note: string | null;
};

type SortKey = "date" | "ot" | "proceso" | "buffer_days" | "prev_buffer_days" | "delta" | "note";
type SortDir = "asc" | "desc";

type ChartPoint = {
  date: string;
  counts: Record<string, number>;
};

interface StatsViewProps {
  processes: string[];
  events: DelayEvent[];
}

// ── Constants ────────────────────────────────────────────────────────────────

// 11 hues spread ~33° apart on the color wheel — maximally distinct on dark bg
const PROC_COLORS: Record<string, string> = {
  "INSPECCIÓN":         "#EF4444", // red        0°
  "INGENIERÍA":         "#F97316", // orange    33°
  "CORTE":              "#FBBF24", // amber     65°
  "PLEGADO":            "#84CC16", // lime      98°
  "ARMADO":             "#10B981", // emerald  131°
  "REMATE":             "#14B8A6", // teal     164°
  "MONTAJE":            "#38BDF8", // sky      196°
  "HIDRÁULICA":         "#3B82F6", // blue     229°
  "PINTURA":            "#8B5CF6", // violet   262°
  "TERMINACIONES":      "#D946EF", // fuchsia  295°
  "CONTROL DE CALIDAD": "#F43F5E", // rose     327°
};

function procColor(p: string): string {
  return PROC_COLORS[p] ?? "#71717A";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

// ── Chart constants ───────────────────────────────────────────────────────────

const W = 900, H = 300;
const M = { top: 16, right: 20, bottom: 68, left: 44 };
const cW = W - M.left - M.right;
const cH = H - M.top - M.bottom;

// ── Component ────────────────────────────────────────────────────────────────

export function StatsView({ processes, events }: StatsViewProps) {
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ── Filtered events ────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() =>
    events.filter(e => (!from || e.date >= from) && (!to || e.date <= to)),
    [events, from, to]
  );

  const filteredTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of processes) t[p] = 0;
    for (const e of filteredEvents) {
      t[e.proceso] = (t[e.proceso] ?? 0) + 1;
    }
    return t;
  }, [filteredEvents, processes]);

  const filteredChartData = useMemo((): ChartPoint[] => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const e of filteredEvents) {
      if (!byDate[e.date]) byDate[e.date] = {};
      byDate[e.date][e.proceso] = (byDate[e.date][e.proceso] ?? 0) + 1;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, counts }));
  }, [filteredEvents]);

  const grandTotal = Object.values(filteredTotals).reduce((s, v) => s + v, 0);
  const dates      = filteredChartData.map(p => p.date);

  // ── Chart scales ───────────────────────────────────────────────────────────

  const maxY = Math.max(1, ...filteredChartData.flatMap(p => Object.values(p.counts)));

  const xPos = useCallback((i: number) =>
    dates.length <= 1 ? cW / 2 : (i / (dates.length - 1)) * cW,
    [dates.length]
  );
  const yPos = (v: number) => cH - (v / maxY) * cH;

  const yTicks = useMemo(() => {
    if (maxY <= 4) return Array.from({ length: maxY + 1 }, (_, i) => i);
    const step = Math.ceil(maxY / 4);
    const ticks = [0];
    for (let t = step; t <= maxY; t += step) ticks.push(t);
    if (ticks[ticks.length - 1] < maxY) ticks.push(maxY);
    return ticks;
  }, [maxY]);

  // Show every N-th x-label to avoid crowding
  const xStep = Math.max(1, Math.ceil(dates.length / 10));

  // Active processes (at least 1 event in filtered range)
  const activeProcs = useMemo(
    () => processes.filter(p => filteredChartData.some(d => (d.counts[p] ?? 0) > 0)),
    [processes, filteredChartData]
  );

  // ── Mouse hover ────────────────────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!chartRef.current || dates.length === 0) return;
    const rect = chartRef.current.getBoundingClientRect();
    const svgX  = (e.clientX - rect.left) / rect.width * W - M.left;
    if (svgX < 0 || svgX > cW) { setHoverIdx(null); return; }
    const raw = dates.length <= 1 ? 0 : (svgX / cW) * (dates.length - 1);
    setHoverIdx(Math.max(0, Math.min(dates.length - 1, Math.round(raw))));
  }

  const hoverDate  = hoverIdx !== null ? dates[hoverIdx] : null;
  const hoverCounts = hoverDate ? filteredChartData[hoverIdx!]?.counts ?? {} : null;
  const hoverXPct  = hoverIdx !== null && dates.length > 0
    ? ((M.left + xPos(hoverIdx)) / W) * 100
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Filtrar
        </span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Desde</label>
          <input
            type="date" value={from}
            onChange={e => setFrom(e.target.value)}
            className="h-8 px-2 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-300 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Hasta</label>
          <input
            type="date" value={to}
            onChange={e => setTo(e.target.value)}
            className="h-8 px-2 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm text-zinc-300 focus:outline-none focus:border-amber-500"
          />
        </div>
        {(from || to) && (
          <button
            onClick={() => { setFrom(""); setTo(""); }}
            className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
          >
            Limpiar filtro
          </button>
        )}
        <span className="text-xs text-zinc-600 ml-auto">
          {grandTotal} evento{grandTotal !== 1 ? "s" : ""} de atraso
        </span>
      </div>

      {/* Summary table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
          <div className="w-0.5 h-4 bg-amber-500 rounded-full" />
          <h3 className="text-sm font-medium text-white">Atrasos por Proceso</h3>
          <span className="text-xs text-zinc-600 ml-1">total acumulado</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {processes.map(p => (
                  <th key={p} className="px-4 py-3 text-center min-w-[80px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: procColor(p) }}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 whitespace-nowrap leading-tight">
                        {p}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {processes.map(p => {
                  const v = filteredTotals[p] ?? 0;
                  return (
                    <td key={p} className="px-4 py-4 text-center">
                      <span className={`text-3xl font-bold tabular-nums ${v > 0 ? "text-red-400" : "text-zinc-700"}`}>
                        {v}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Line chart */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-0.5 h-4 bg-amber-500 rounded-full" />
          <h3 className="text-sm font-medium text-white">Evolución de Atrasos por Proceso</h3>
        </div>

        {filteredChartData.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-zinc-600 text-sm italic">
            Sin eventos de atraso registrados
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4">
              {(activeProcs.length > 0 ? activeProcs : processes).map(p => (
                <div key={p} className="flex items-center gap-1.5">
                  <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: procColor(p) }} />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{p}</span>
                </div>
              ))}
            </div>

            {/* SVG chart */}
            <div
              ref={chartRef}
              className="relative select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
                <g transform={`translate(${M.left},${M.top})`}>

                  {/* Y-axis grid lines + labels */}
                  {yTicks.map(tick => (
                    <g key={tick}>
                      <line
                        x1={0} y1={yPos(tick)} x2={cW} y2={yPos(tick)}
                        stroke="#27272A" strokeWidth={1}
                      />
                      <text x={-8} y={yPos(tick) + 4} textAnchor="end" fill="#52525B" fontSize={10}>
                        {tick}
                      </text>
                    </g>
                  ))}

                  {/* X-axis labels */}
                  {dates.map((d, i) => {
                    if (i % xStep !== 0 && i !== dates.length - 1) return null;
                    const px = xPos(i);
                    return (
                      <text
                        key={d}
                        x={px} y={cH + 14}
                        textAnchor="end"
                        fill="#52525B"
                        fontSize={9}
                        transform={`rotate(-40, ${px}, ${cH + 14})`}
                      >
                        {fmtShort(d)}
                      </text>
                    );
                  })}

                  {/* Lines per process */}
                  {processes.map(proceso => {
                    const color  = procColor(proceso);
                    const points = filteredChartData.map((pt, i) => ({
                      x: xPos(i),
                      y: yPos(pt.counts[proceso] ?? 0),
                      v: pt.counts[proceso] ?? 0,
                    }));
                    if (!points.some(p => p.v > 0)) return null;
                    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                    return (
                      <g key={proceso}>
                        <path
                          d={pathD} fill="none"
                          stroke={color} strokeWidth={1.8}
                          strokeLinejoin="round" strokeLinecap="round"
                          opacity={0.9}
                        />
                        {points.map((p, i) =>
                          p.v > 0 ? (
                            <circle
                              key={i} cx={p.x} cy={p.y} r={3.5}
                              fill={color} opacity={0.95}
                            />
                          ) : null
                        )}
                      </g>
                    );
                  })}

                  {/* Hover guide line */}
                  {hoverIdx !== null && (
                    <line
                      x1={xPos(hoverIdx)} y1={0}
                      x2={xPos(hoverIdx)} y2={cH}
                      stroke="#52525B" strokeWidth={1} strokeDasharray="4,3"
                    />
                  )}

                </g>
              </svg>

              {/* Hover tooltip */}
              {hoverDate && hoverCounts && hoverXPct !== null && (
                <div
                  className="absolute top-1 pointer-events-none bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2.5 shadow-2xl text-xs z-10"
                  style={{
                    left: `clamp(4px, calc(${hoverXPct}% - 80px), calc(100% - 168px))`,
                    minWidth: 160,
                  }}
                >
                  <p className="text-zinc-200 font-semibold mb-2">{fmtShort(hoverDate)}</p>
                  {processes
                    .filter(p => (hoverCounts[p] ?? 0) > 0)
                    .map(p => (
                      <div key={p} className="flex items-center justify-between gap-3 py-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: procColor(p) }} />
                          <span className="text-zinc-400">{p}</span>
                        </div>
                        <span className="text-white font-semibold tabular-nums">{hoverCounts[p]}</span>
                      </div>
                    ))}
                  {Object.values(hoverCounts).every(v => v === 0) && (
                    <span className="text-zinc-600">Sin atrasos</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail events table */}
      {filteredEvents.length > 0 && (() => {
        const columns: { key: SortKey; label: string }[] = [
          { key: "date",             label: "Fecha" },
          { key: "ot",               label: "OT" },
          { key: "proceso",          label: "Proceso" },
          { key: "buffer_days",      label: "Buffer nuevo" },
          { key: "prev_buffer_days", label: "Buffer anterior" },
          { key: "delta",            label: "Delta" },
          { key: "note",             label: "Nota" },
        ];

        const sorted = [...filteredEvents].sort((a, b) => {
          let av: string | number | null;
          let bv: string | number | null;
          if (sortKey === "delta") {
            av = a.prev_buffer_days != null ? a.buffer_days - a.prev_buffer_days : null;
            bv = b.prev_buffer_days != null ? b.buffer_days - b.prev_buffer_days : null;
          } else if (sortKey === "note") {
            av = a.note ?? "";
            bv = b.note ?? "";
          } else {
            av = a[sortKey] as string | number | null;
            bv = b[sortKey] as string | number | null;
          }
          // nulls last
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
          return sortDir === "asc" ? cmp : -cmp;
        });

        return (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
              <div className="w-0.5 h-4 bg-amber-500 rounded-full" />
              <h3 className="text-sm font-medium text-white">Detalle de Eventos</h3>
              <span className="text-xs text-zinc-600 ml-1">({filteredEvents.length})</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900/95">
                  <tr className="border-b border-zinc-800">
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 whitespace-nowrap transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key
                            ? <span className="text-amber-400">{sortDir === "asc" ? "↑" : "↓"}</span>
                            : <span className="text-zinc-700">↕</span>
                          }
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(e => {
                    const delta = e.prev_buffer_days != null ? e.buffer_days - e.prev_buffer_days : null;
                    return (
                      <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-2 text-zinc-400 text-xs tabular-nums whitespace-nowrap">
                          {fmtShort(e.date)}
                        </td>
                        <td className="px-4 py-2 text-amber-400 font-mono text-xs">{e.ot ?? "—"}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: procColor(e.proceso) }} />
                            <span className="text-zinc-300 text-xs">{e.proceso}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-red-400 font-mono text-xs">{e.buffer_days}d</td>
                        <td className="px-4 py-2 text-zinc-500 font-mono text-xs">
                          {e.prev_buffer_days != null ? `${e.prev_buffer_days}d` : "—"}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs font-semibold">
                          <span className={delta != null && delta < 0 ? "text-red-400" : "text-zinc-400"}>
                            {delta != null ? `${delta}d` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-zinc-400 text-xs max-w-[200px]">
                          {e.note ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
