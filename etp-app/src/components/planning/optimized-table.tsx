"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/utils";
import { priorityTextClass } from "@/lib/priority";
import type { OptimizedResult } from "@/types";
import { TablePagination } from "@/components/ui/table-pagination";

const PAGE_SIZE = 10;

// ── Sort helpers ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";

const OPT_COL_TYPE: Record<string, "text" | "number" | "date"> = {
  pos: "number",
  ot: "text",
  cliente: "text",
  codigo_plazo: "number",
  equipo: "text",
  inicio: "date",
  fin: "date",
  prioridad: "number",
};

function getOptSortValue(o: OptimizedResult, key: string): unknown {
  const r = o.sales_planning;
  switch (key) {
    case "pos": return o.position ?? null;
    case "ot": return r?.ot ?? null;
    case "cliente": return r?.cliente ?? null;
    case "codigo_plazo": return o.codigo_plazo ?? r?.codigo_plazo ?? null;
    case "equipo": return r?.equipo ?? null;
    case "inicio": return o.start_date ?? null;
    case "fin": return o.end_date ?? null;
    case "prioridad": return o.prioridad ?? null;
    default: return null;
  }
}

function compareSort(a: unknown, b: unknown, type: "text" | "number" | "date", dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  let result: number;
  if (type === "number") {
    result = Number(a) - Number(b);
  } else if (type === "date") {
    result = new Date(a as string).getTime() - new Date(b as string).getTime();
  } else {
    result = String(a).localeCompare(String(b), "es");
  }
  return dir === "asc" ? result : -result;
}

const OPT_COL_DEFS = [
  { key: "pos",          label: "Pos." },
  { key: "ot",           label: "OT" },
  { key: "cliente",      label: "Cliente" },
  { key: "codigo_plazo", label: "Cód. Plazo" },
  { key: "equipo",       label: "Equipo" },
  { key: "inicio",       label: "Inicio" },
  { key: "fin",          label: "Fecha Entrega" },
  { key: "prioridad",    label: "Prioridad" },
];

interface Props {
  records: OptimizedResult[];
}

export function OptimizedTable({ records }: Props) {
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  if (records.length === 0) {
    return (
      <p className="text-center py-8 text-zinc-600 text-sm">
        Sin resultados — haz clic en <span className="text-amber-500 font-medium">Planificar</span> para generar el plan.
      </p>
    );
  }

  const sorted = sortCol
    ? [...records].sort((a, b) =>
        compareSort(
          getOptSortValue(a, sortCol),
          getOptSortValue(b, sortCol),
          OPT_COL_TYPE[sortCol] ?? "text",
          sortDir
        )
      )
    : records;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {OPT_COL_DEFS.map(({ key, label }) => {
                const isActive = sortCol === key;
                return (
                  <th
                    key={key}
                    onDoubleClick={() => handleSort(key)}
                    className={`text-left px-3 py-2.5 text-xs uppercase tracking-wider font-medium whitespace-nowrap cursor-pointer select-none transition-colors ${
                      isActive ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {label}{isActive ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginated.map((o, i) => {
              const r = o.sales_planning;
              return (
                <tr
                  key={o.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-3 py-2.5 text-zinc-500 tabular-nums text-xs">{o.position}</td>
                  <td className="px-3 py-2.5 font-mono text-amber-400 text-xs">{r?.ot ?? "—"}</td>
                  <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap">{r?.cliente ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{o.codigo_plazo ?? r?.codigo_plazo ?? "—"}</td>
                  <td className="px-3 py-2.5 text-zinc-300">{r?.equipo ?? "—"}</td>
                  <td className="px-3 py-2.5 text-green-400 whitespace-nowrap tabular-nums">{fmtDate(o.start_date)}</td>
                  <td className="px-3 py-2.5 text-green-400 whitespace-nowrap tabular-nums">{fmtDate(o.end_date)}</td>
                  <td className="px-3 py-2.5">
                    {o.prioridad != null ? (
                      <span className={`text-xs font-semibold ${priorityTextClass(o.prioridad)}`}>
                        P{o.prioridad}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={safePage}
        totalPages={totalPages}
        totalRecords={sorted.length}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
}
