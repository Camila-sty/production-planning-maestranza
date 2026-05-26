import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json({ error: "No autorizado: requiere rol administrador." }, { status: 403 });

  // Find active and previous runs
  const [activeRun, previousRun] = await Promise.all([
    prisma.planningRun.findFirst({ where: { status: "ACTIVE" } }),
    prisma.planningRun.findFirst({ where: { status: "PREVIOUS" } }),
  ]);

  if (!activeRun) {
    return NextResponse.json(
      { error: "No hay planificación activa para deshacer" },
      { status: 400 }
    );
  }

  if (!previousRun) {
    return NextResponse.json(
      { error: "No hay planificación anterior para restaurar" },
      { status: 400 }
    );
  }

  // Delete active run's records
  await prisma.optimizedProcessSchedule.deleteMany({
    where: { planning_run_id: activeRun.id },
  });
  await prisma.salesPlanningOptimized.deleteMany({
    where: { planning_run_id: activeRun.id },
  });

  // Restore special days used in the active run (mark as unused so they can be reused)
  await prisma.specialWorkingDay.updateMany({
    where: { planning_run_id: activeRun.id },
    data: { used_in_planning: false, planning_run_id: null },
  });

  // Clear buffer adjustments that were applied in the undone run
  // (those set after the previous run was created — they fed into the active run)
  await prisma.salesPlanning.updateMany({
    where: { planning_buffer_at: { gt: previousRun.created_at } },
    data: { planning_buffer_days: null, planning_buffer_note: null, planning_buffer_at: null },
  });

  // Delete active run
  await prisma.planningRun.delete({ where: { id: activeRun.id } });

  // Promote previous run to active
  await prisma.planningRun.update({
    where: { id: previousRun.id },
    data: { status: "ACTIVE" },
  });

  return NextResponse.json({ success: true });
}
