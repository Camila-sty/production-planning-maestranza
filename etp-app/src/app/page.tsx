import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanningForm } from "@/components/planning/planning-form";
import { PlanningTable } from "@/components/planning/planning-table";
import { ProcessCapacityTable } from "@/components/planning/process-capacity-table";
import { LeadTimeTable } from "@/components/planning/lead-time-table";
import { PlanButton } from "@/components/planning/plan-button";
import { OptimizedTable } from "@/components/planning/optimized-table";
import { SpecialDaysPanel } from "@/components/planning/special-days-panel";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedToaster } from "@/components/themed-toaster";
import type { SalesPlanning, LeadTimeByCode, ProcessCapacity, OptimizedResult, SpecialWorkingDay, PlanRunHistoryEntry } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");

  // Find active and previous planning runs
  const [activeRun, previousRun] = await Promise.all([
    prisma.planningRun.findFirst({ where: { status: "ACTIVE" } }),
    prisma.planningRun.findFirst({ where: { status: "PREVIOUS" } }),
  ]);

  const [records, processCapacities, leadTimes, optimizedRaw, specialDays, allOptimized] = await Promise.all([
    prisma.salesPlanning.findMany({ orderBy: { created_at: "asc" } }),
    prisma.processCapacity.findMany({ orderBy: { orden: "asc" } }),
    prisma.leadTimeByCode.findMany({ orderBy: [{ codigo_plazo: "asc" }, { proceso: "asc" }] }),
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
    // All optimized records with run info — for entrega estimada + history tooltip
    prisma.salesPlanningOptimized.findMany({
      where: { start_date: { not: null } },
      orderBy: { created_at: "asc" },
      include: { planning_run: { select: { id: true, version: true, status: true, created_at: true } } },
    }),
  ]);

  const hasResults = optimizedRaw.length > 0;
  const hasPrevious = previousRun != null;

  // Build endDateMap: salesPlanningId → end_date from ACTIVE run
  const endDateMap: Record<string, string> = {};
  for (const o of optimizedRaw) {
    if (o.sales_planning_id && o.end_date) {
      endDateMap[o.sales_planning_id] = new Date(o.end_date).toISOString();
    }
  }

  // Build historyMap: salesPlanningId → [{runDate, endDate, version}] sorted oldest→newest
  const historyMap: Record<string, PlanRunHistoryEntry[]> = {};
  for (const o of allOptimized) {
    const sid = o.sales_planning_id;
    if (!sid || !o.end_date || !o.planning_run) continue;
    if (!historyMap[sid]) historyMap[sid] = [];
    historyMap[sid].push({
      version: o.planning_run.version,
      runDate: new Date(o.planning_run.created_at).toISOString(),
      endDate: new Date(o.end_date).toISOString(),
      status: o.planning_run.status,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <ThemedToaster />

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-md px-2 py-1 shadow shadow-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logos/logo-etp-equipos.jpeg" alt="ETP Equipos" className="h-7 w-auto object-contain" />
            </div>
            <div className="w-px h-7 bg-zinc-700" />
            <div className="bg-white rounded-md px-2 py-1 shadow shadow-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logos/logo-centro-equipos.jpeg" alt="Centro Equipos" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-none">
                Sistema de Planificación
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">Producción de Equipos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden sm:block">{user.email}</span>
            <ThemeToggle />
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-white hover:bg-zinc-800 text-xs"
              >
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-10">

        {/* ── 1. Nuevo Registro ── */}
        <section>
          <SectionTitle>Nuevo Registro</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <PlanningForm />
          </div>
        </section>

        {/* ── 2. Historial ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle count={records.length}>Historial de Planificación</SectionTitle>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <PlanningTable
              records={records as unknown as SalesPlanning[]}
              endDateMap={endDateMap}
              historyMap={historyMap}
            />
          </div>
        </section>

        {/* ── 3. Motor de Planificación ── */}
        <section>
          <SectionTitle>Motor de Planificación (CP-SAT)</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-6">
            <div>
              <p className="text-xs text-zinc-500 mb-3">
                Ejecuta el solucionador OR-Tools CP-SAT sobre todos los equipos con Código Plazo, Llegada y Prioridad definidos.
                Respeta capacidades por proceso y optimiza según prioridad y atraso.
                Equipos sin fecha de llegada son excluidos automáticamente.
              </p>
              <PlanButton hasResults={hasResults} hasPrevious={hasPrevious} />
            </div>

            {activeRun && (
              <div className="text-xs text-zinc-600">
                Planificación activa v{activeRun.version} — generada el{" "}
                {new Date(activeRun.created_at).toLocaleString("es-CL")}
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

            {/* Días especiales */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-0.5 h-4 bg-amber-500/60 rounded-full" />
                <h3 className="text-sm font-medium text-zinc-300">Días Especiales de Trabajo</h3>
              </div>
              <SpecialDaysPanel
                specialDays={specialDays as unknown as SpecialWorkingDay[]}
                activePlanRunCreatedAt={activeRun ? new Date(activeRun.created_at) : null}
              />
            </div>
          </div>
        </section>

        {/* ── 4. Capacidad por Proceso ── */}
        <section>
          <SectionTitle count={processCapacities.length}>Capacidad por Proceso</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 mb-3">
              Define el orden global de procesos y cuántos equipos pueden estar simultáneamente en cada proceso (días hábiles).
              Procesos con orden=0 o capacidad=0 son ignorados por el planificador.
            </p>
            <ProcessCapacityTable records={processCapacities as unknown as ProcessCapacity[]} />
          </div>
        </section>

        {/* ── 5. Tiempos por Código Plazo ── */}
        <section>
          <SectionTitle count={leadTimes.length}>Tiempos por Código Plazo</SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 mb-3">
              Duración en días hábiles de cada proceso según el tipo de equipo (código plazo).
              Filas con duración=0 son ignoradas por el planificador.
            </p>
            <LeadTimeTable
              records={leadTimes as unknown as LeadTimeByCode[]}
              processes={processCapacities as unknown as ProcessCapacity[]}
            />
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
