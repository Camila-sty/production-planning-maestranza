import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

async function getPythonDiagnostics(): Promise<Record<string, string>> {
  const diag: Record<string, string> = {};
  try {
    const { stdout: pyVer } = await execFileAsync("python3", ["--version"]);
    diag.python_version = pyVer.trim();
  } catch (e) {
    diag.python_version = `ERROR: ${(e as Error).message}`;
  }
  try {
    const { stdout: ortVer } = await execFileAsync("python3", [
      "-c",
      "import ortools; print(ortools.__version__)",
    ]);
    diag.ortools_version = ortVer.trim();
  } catch (e) {
    diag.ortools_version = `ERROR: ${(e as Error).message}`;
  }
  return diag;
}

export async function POST() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json({ error: "No autorizado: requiere rol administrador." }, { status: 403 });

  const cwd        = process.cwd();
  const scriptPath = path.resolve(cwd, "..", "scripts", "planner.py");
  const scriptExists = fs.existsSync(scriptPath);

  console.log("[planner] === DIAGNOSTIC INFO ===");
  console.log("[planner] cwd:", cwd);
  console.log("[planner] scriptPath:", scriptPath);
  console.log("[planner] scriptExists:", scriptExists);
  console.log("[planner] NODE_ENV:", process.env.NODE_ENV);
  console.log("[planner] platform:", process.platform);

  const diag = await getPythonDiagnostics();
  console.log("[planner] python_version:", diag.python_version);
  console.log("[planner] ortools_version:", diag.ortools_version);

  try {
    console.log("[planner] Running:", "python3", scriptPath);
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [scriptPath],
      { timeout: 120_000 }
    );
    console.log("[planner] exit_code: 0");
    console.log("[planner] stdout:", stdout);
    if (stderr) console.log("[planner] stderr:", stderr);
    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : "");
    return NextResponse.json({ success: true, output });
  } catch (e: unknown) {
    const err = e as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: number | string;
      signal?: string;
      killed?: boolean;
    };
    console.error("[planner] === EXECUTION FAILED ===");
    console.error("[planner] exit_code:", err.code);
    console.error("[planner] signal:", err.signal);
    console.error("[planner] killed (timeout):", err.killed);
    console.error("[planner] message:", err.message);
    console.error("[planner] stdout:", err.stdout ?? "(empty)");
    console.error("[planner] stderr:", err.stderr ?? "(empty)");
    console.error("[planner] diagnostics:", JSON.stringify(diag));
    console.error("[planner] scriptExists:", scriptExists);

    const detail = [
      `exit_code: ${err.code}`,
      `killed: ${err.killed}`,
      `python: ${diag.python_version}`,
      `ortools: ${diag.ortools_version}`,
      `script_exists: ${scriptExists}`,
      `cwd: ${cwd}`,
      `script: ${scriptPath}`,
      "",
      "--- STDOUT ---",
      err.stdout ?? "(empty)",
      "--- STDERR ---",
      err.stderr ?? "(empty)",
    ].join("\n");

    return NextResponse.json(
      { error: "El planificador falló", detail },
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
