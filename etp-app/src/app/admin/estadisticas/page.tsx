import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { ThemedToaster } from "@/components/themed-toaster";
import { StatsView, type DelayEvent } from "@/components/stats/stats-view";

export const dynamic = "force-dynamic";

// ── Canonical process list (order matches ProcessCapacity.orden) ─────────────

const PROCESSES = [
  "INSPECCIÓN",
  "INGENIERÍA",
  "CORTE",
  "PLEGADO",
  "ARMADO",
  "REMATE",
  "MONTAJE",
  "HIDRÁULICA",
  "PINTURA",
  "TERMINACIONES",
  "CONTROL DE CALIDAD",
] as const;

// Normalize accented/unaccented variants to canonical form
function canonicalProcess(p: string): string {
  const norm = p
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");          // strip accents
  const found = PROCESSES.find(
    (cp) =>
      cp
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") === norm
  );
  return found ?? p.toUpperCase().trim();
}

function toDateKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

// ── Determine which process a job was in on a given date ──────────────────────

type SchedEntry = {
  proceso: string;
  start_date: Date;
  end_date: Date;
  run_created_at: Date;
};

function determineProcess(
  entries: SchedEntry[],
  eventDate: Date
): string {
  // Only consider schedules from runs created at or before the event
  const relevant = entries.filter((s) => s.run_created_at <= eventDate);
  if (relevant.length === 0) return "Sin proceso";

  // Use the most recently created planning run
  const latestAt = relevant.reduce(
    (max, s) => (s.run_created_at > max ? s.run_created_at : max),
    relevant[0].run_created_at
  );
  const forLatestRun = relevant.filter(
    (s) => s.run_created_at.getTime() === latestAt.getTime()
  );

  // Exact: event date falls within a process window
  const active = forLatestRun.find(
    (s) => s.start_date <= eventDate && eventDate <= s.end_date
  );
  if (active) return active.proceso;

  // Next upcoming process after the event date
  const upcoming = forLatestRun
    .filter((s) => s.start_date > eventDate)
    .sort((a, b) => a.start_date.getTime() - b.start_date.getTime())[0];
  if (upcoming) return upcoming.proceso;

  // Most recently completed process before the event date
  const past = forLatestRun
    .filter((s) => s.end_date < eventDate)
    .sort((a, b) => b.end_date.getTime() - a.end_date.getTime())[0];
  if (past) return past.proceso;

  return "Sin proceso";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function EstadisticasPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!user.isAdmin) redirect("/");

  // Load all buffer adjustments where the delta is negative
  // (delta_days = buffer_nuevo - buffer_anterior < 0 → worsening delay)
  const adjustments = await prisma.planningBufferAdjustment.findMany({
    where: { delta_days: { lt: 0 } },
    orderBy: { created_at: "asc" },
    include: {
      sales_planning: { select: { ot: true } },
    },
  });

  // Load all process schedules with their planning run timestamps
  const rawSchedules = await prisma.optimizedProcessSchedule.findMany({
    include: {
      planning_run: { select: { id: true, created_at: true } },
    },
    orderBy: { start_date: "asc" },
  });

  // Build map: salesPlanningId → SchedEntry[]
  const scheduleMap: Record<string, SchedEntry[]> = {};
  for (const s of rawSchedules) {
    if (!scheduleMap[s.sales_planning_id])
      scheduleMap[s.sales_planning_id] = [];
    scheduleMap[s.sales_planning_id].push({
      proceso: canonicalProcess(s.proceso),
      start_date: new Date(s.start_date),
      end_date: new Date(s.end_date),
      run_created_at: new Date(s.planning_run?.created_at ?? 0),
    });
  }

  // Build delay events
  const events: DelayEvent[] = adjustments.map((adj) => ({
    id: adj.id,
    date: toDateKey(adj.created_at),
    proceso: determineProcess(
      scheduleMap[adj.sales_planning_id] ?? [],
      new Date(adj.created_at)
    ),
    ot: adj.sales_planning?.ot ?? null,
    buffer_days: adj.buffer_days,
    prev_buffer_days: adj.prev_buffer_days,
    note: adj.note ?? null,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <ThemedToaster />
      <AppHeader user={user} />
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-1 h-5 bg-amber-500 rounded-full" />
          <h2 className="text-base font-semibold text-white">
            Estadísticas de Atrasos
          </h2>
          <span className="text-xs text-zinc-600 ml-1">por proceso</span>
        </div>
        <StatsView
          processes={PROCESSES as unknown as string[]}
          events={events}
        />
      </main>
    </div>
  );
}
