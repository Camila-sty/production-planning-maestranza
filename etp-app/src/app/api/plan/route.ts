import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export async function POST() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // cwd() = etp-app directory
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const scriptPath = path.resolve(process.cwd(), "..", "scripts", "planner.py");

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [scriptPath, dbPath],
      { timeout: 120_000 }
    );
    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : "");
    return NextResponse.json({ success: true, output });
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = (err.stdout ?? "") + "\n" + (err.stderr ?? "");
    console.error("Planner error:", output || err.message);
    return NextResponse.json(
      { error: "El planificador falló", detail: output || err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");

  const [activeRun, previousRun] = await Promise.all([
    prisma.planningRun.findFirst({ where: { status: "ACTIVE" } }),
    prisma.planningRun.findFirst({ where: { status: "PREVIOUS" } }),
  ]);

  const count = activeRun
    ? await prisma.salesPlanningOptimized.count({
        where: { planning_run_id: activeRun.id, start_date: { not: null } },
      })
    : 0;

  return NextResponse.json({
    planned: count > 0,
    count,
    hasPrevious: previousRun != null,
    activeRunId: activeRun?.id ?? null,
  });
}
