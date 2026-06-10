import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanningForm } from "@/components/planning/planning-form";
import { PlanningTable } from "@/components/planning/planning-table";
import { PlanButton } from "@/components/planning/plan-button";
import { OptimizedTable } from "@/components/planning/optimized-table";
import { SpecialDaysPanel } from "@/components/planning/special-days-panel";
import { AppHeader } from "@/components/layout/app-header";
import { ThemedToaster } from "@/components/themed-toaster";
import type { SalesPlanning, OptimizedResult, SpecialWorkingDay, PlanRunHistoryEntry } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  const isAdmin = user.isAdmin;

  // Find active and previous planning runs
  const [activeRun, previousRun] = await Promise.all([
    prisma.planningRun.findFirst({ where: { status: "ACTIVE" } }),
    prisma.planningRun.findFirst({ where: { status: "PREVIOUS" } }),
  ]);

  const [records, optimizedRaw, specialDays, allOptimized] = await Promise.all([
    prisma.salesPlanning.findMany({ orderBy: { created_at: "asc" } }),
    activeRun
      ? prisma.salesPlanningOptimized.findMany({
          where: { planning_run_id: activeRun.id, start_date: { not: null } },
          orderBy: { position: "asc" },
          include: { sales_planning: true },
        })
      : prisma.salesPlanningOptimized.findMany({
          where: { start_date: { not: null } },
          orderBy: { position: "asc" },
          include: { sales_planning: true },
        }),
    prisma.specialWorkingDay.findMany({ orderBy: { date: "asc" } }),
    prisma.salesPlanningOptimized.findMany({
      where: { start_date: { not: null } },
      orderBy: { created_at: "asc" },
      include: { planning_run: { select: { id: true, version: true, status: true, created_at: true } } },
    }),
  ]);

  const hasResults = optimizedRaw.length > 0;
  const hasPrevious = previousRun != null;

  const maxPrioridad = records.reduce((m, r) => Math.max(m, (r as { prioridad?: number | null }).prioridad ?? 0), 0);

  // Build endDateMap: salesPlanningId → end_date from ACTIVE run
  // Store only the calendar date (YYYY-MM-DD) to avoid timezone shifts in fmtShort.
  const endDateMap: Record<string, string> = {};
  for (const o of optimizedRaw) {
    if (o.sales_planning_id && o.end_date) {
      endDateMap[o.sales_planning_id] = new Date(o.end_date).toISOString().slice(0, 10);
    }
  }

  // Build historyMap: salesPlanningId → [{runDate, endDate, version}]
  const historyMap: Record<string, PlanRunHistoryEntry[]> = {};
  for (const o of allOptimized) {
    const sid = o.sales_planning_id;
    if (!sid || !o.end_date || !o.planning_run) continue;
    if (!historyMap[sid]) historyMap[sid] = [];
    historyMap[sid].push({
      version: o.planning_run.version,
      runDate: new Date(o.planning_run.created_at).toISOString(),
      endDate: new Date(o.end_date).toISOString().slice(0, 10),
      status: o.planning_run.status,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <ThemedToaster />
      <AppHeader user={user} />

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-10">

        {/* ── 1. Nuevo Registro ── */}
        <section>
          <SectionTitle>Nuevo Registro</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <PlanningForm defaultPrioridad={maxPrioridad + 1} />
          </div>
        </section>

        {/* ── 2. Historial ── */}
        <section>
          <SectionTitle count={records.length}>Historial de Planificación</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <PlanningTable
              records={records as unknown as SalesPlanning[]}
              endDateMap={endDateMap}
              historyMap={historyMap}
              isAdmin={isAdmin}
            />
          </div>
        </section>

        {/* ── 3. Motor de Planificación ── */}
        <section>
          <SectionTitle>Motor de Planificación (CP-SAT)</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-6">
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Ejecuta el solucionador OR-Tools CP-SAT sobre todos los equipos con Código Plazo, Inicio y Prioridad definidos.
                Respeta capacidades por proceso y optimiza según prioridad y atraso.
                Equipos sin fecha de Inicio son excluidos automáticamente.
              </p>
              <PlanButton hasResults={hasResults} hasPrevious={hasPrevious} isAdmin={isAdmin} />
            </div>

            {activeRun && (
              <div className="text-xs text-zinc-600">
                Planificación activa v{activeRun.version} — generada el{" "}
                {new Date(activeRun.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago" })}
                {hasPrevious && (
                  <span className="ml-2 text-zinc-700">| Anterior disponible para restaurar</span>
                )}
              </div>
            )}

            {hasResults && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">
                  {optimizedRaw.length} equipos planificados
                </p>
                <OptimizedTable records={optimizedRaw as unknown as OptimizedResult[]} />
              </div>
            )}

            {/* Días especiales — admin only */}
            {isAdmin && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-0.5 h-4 bg-amber-500/60 rounded-full" />
                  <h3 className="text-sm font-medium text-zinc-300">Días Especiales de Trabajo</h3>
                </div>
                <SpecialDaysPanel
                  specialDays={specialDays as unknown as SpecialWorkingDay[]}
                  activePlanRunCreatedAt={activeRun ? new Date(activeRun.created_at) : null}
                  isAdmin={isAdmin}
                />
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-amber-500 rounded-full" />
      <h2 className="text-base font-semibold text-white">{children}</h2>
      {count != null && (
        <span className="text-xs text-zinc-600 ml-1">({count})</span>
      )}
    </div>
  );
}
