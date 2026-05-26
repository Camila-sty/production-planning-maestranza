import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { specialWorkingDaySchema } from "@/lib/validations";

export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const days = await prisma.specialWorkingDay.findMany({
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ data: days });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json({ error: "No autorizado: requiere rol administrador." }, { status: 403 });

  const body = await req.json();
  const parsed = specialWorkingDaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { date, type, description } = parsed.data;

  // Check for active planning run to block past-used dates
  const activeRun = await prisma.planningRun.findFirst({
    where: { status: "ACTIVE" },
  });

  const dateObj = new Date(date + "T00:00:00");

  // Check if this date already exists and was used in active planning
  const existing = await prisma.specialWorkingDay.findFirst({
    where: {
      date: dateObj,
      used_in_planning: true,
      planning_run_id: activeRun?.id ?? undefined,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Esta fecha ya fue usada en la planificación activa" },
      { status: 409 }
    );
  }

  const day = await prisma.specialWorkingDay.create({
    data: {
      date: dateObj,
      type,
      description: description ?? null,
      created_by: user.email,
    },
  });

  return NextResponse.json({ data: day }, { status: 201 });
}
