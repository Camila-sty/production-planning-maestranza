import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/plan — trigger a planning run
//
// Production (PLANNER_SERVICE_URL is set):
//   Calls the Railway microservice via HTTP.
//
// Development (PLANNER_SERVICE_URL is not set):
//   Falls back to running python3 scripts/planner.py locally via child_process.
// ---------------------------------------------------------------------------

export async function POST() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json({ error: "No autorizado: requiere rol administrador." }, { status: 403 });

  const serviceUrl   = process.env.PLANNER_SERVICE_URL?.replace(/\/$/, "");
  const serviceToken = process.env.PLANNER_SERVICE_TOKEN ?? "";

  // ── Production path: call Railway microservice ──────────────────────────
  if (serviceUrl) {
    let resp: Response;
    try {
      resp = await fetch(`${serviceUrl}/run`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${serviceToken}`,
          "Content-Type":  "application/json",
        },
        // Railway functions can run up to 120 s; match planner timeout
        signal: AbortSignal.timeout(130_000),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[planner] fetch error:", msg);
      return NextResponse.json(
        { error: "El planificador falló", detail: `fetch error: ${msg}` },
        { status: 500 }
      );
    }

    const data = await resp.json().catch(() => ({})) as Record<string, unknown>;

    if (!resp.ok || !data.success) {
      console.error("[planner] service error:", data);
      const detail = [
        `status: ${resp.status}`,
        data.error   ? `error: ${data.error}`    : "",
        data.stdout  ? `stdout: ${data.stdout}`  : "",
        data.stderr  ? `stderr: ${data.stderr}`  : "",
      ].filter(Boolean).join("\n");
      return NextResponse.json(
        { error: "El planificador falló", detail },
        { status: 500 }
      );
    }

    const output = String(data.stdout ?? "") + (data.stderr ? `\nSTDERR: ${data.stderr}` : "");
    return NextResponse.json({ success: true, output });
  }

  // ── Development path: run python3 locally ───────────────────────────────
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const path = await import("path");
  const execFileAsync = promisify(execFile);

  const scriptPath = path.resolve(process.cwd(), "..", "scripts", "planner.py");

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [scriptPath],
      { timeout: 120_000 }
    );
    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : "");
    return NextResponse.json({ success: true, output });
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = (err.stdout ?? "") + "\n" + (err.stderr ?? "");
    console.error("[planner] local exec error:", output || err.message);
    return NextResponse.json(
      { error: "El planificador falló", detail: output || err.message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/plan — current planning state
// ---------------------------------------------------------------------------

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
    planned:      count > 0,
    count,
    hasPrevious:  previousRun != null,
    activeRunId:  activeRun?.id ?? null,
  });
}
