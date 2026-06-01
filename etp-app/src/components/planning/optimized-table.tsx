"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/utils";
import { priorityTextClass } from "@/lib/priority";
import type { OptimizedResult } from "@/types";
import { TablePagination } from "@/components/ui/table-pagination";

const PAGE_SIZE = 10;

interface Props {
  records: OptimizedResult[];
}

export function OptimizedTable({ records }: Props) {
  const [page, setPage] = useState(1);

  if (records.length === 0) {
    return (
      <p className="text-center py-8 text-zinc-600 text-sm">
        Sin resultados — haz clic en <span className="text-amber-500 font-medium">Planificar</span> para generar el plan.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = records.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              {["Pos.", "OT", "Cliente", "Cód. Plazo", "Equipo", "Inicio", "Fin", "Prioridad"].map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2.5 text-xs text-zinc-500 uppercase tracking-wider font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
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
        totalRecords={records.length}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
}
