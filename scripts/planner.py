#!/usr/bin/env python3
"""
CP-SAT Planning Engine for ETP Maestranza.

Each sales_planning record with codigo_plazo + llegada + prioridad is a JOB.
Each JOB has an ordered sequence of processes defined by its codigo_plazo.
Processes are ordered globally by process_capacity.orden.
Capacity constraints limit how many jobs can be in a process on any given working day.

Usage: python3 scripts/planner.py [db_path]
Default db_path: etp-app/dev.db
"""

import sys
import os
import sqlite3
from datetime import date, timedelta, datetime

try:
    from ortools.sat.python import cp_model
except ImportError:
    print("ERROR: ortools not installed. Run: pip3 install ortools")
    sys.exit(1)

# --- Path resolution ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PROJECT_ROOT, "etp-app", "dev.db")


# ---------------------------------------------------------------------------
# Working-day helpers
# ---------------------------------------------------------------------------

def find_prev_monday(d: date) -> date:
    """Return d if Monday, else the most recent Monday before d."""
    return d - timedelta(days=d.weekday())


def date_to_workday(d: date, ref: date) -> int:
    """Count working days (Mon-Fri) in [ref, d).  ref must be a Monday."""
    if d <= ref:
        return 0
    total_days = (d - ref).days
    full_weeks, extra = divmod(total_days, 7)
    workdays = full_weeks * 5 + min(extra, 5)
    return workdays


def workday_to_date(n: int, ref: date) -> date:
    """Return the date that is exactly n working days after ref."""
    if n <= 0:
        return ref
    full_weeks, extra = divmod(n, 5)
    result = ref + timedelta(weeks=full_weeks, days=extra)
    # If extra lands on a weekend, advance to Monday
    wd = result.weekday()
    if wd == 5:          # Saturday
        result += timedelta(days=2)
    elif wd == 6:        # Sunday
        result += timedelta(days=1)
    return result


# ---------------------------------------------------------------------------
# Main solver
# ---------------------------------------------------------------------------

def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # --- Load process capacities (only valid: orden>0, capacidad>0) ---
    processes = conn.execute("""
        SELECT proceso, orden, capacidad_por_dia
        FROM process_capacity
        WHERE orden > 0 AND capacidad_por_dia > 0
        ORDER BY orden ASC
    """).fetchall()

    if not processes:
        print("ERROR: No process capacity data found. Run seed_rules.py first.")
        conn.close()
        sys.exit(1)

    proc_list = [dict(p) for p in processes]
    proc_order = {p["proceso"]: p for p in proc_list}  # name -> data

    # --- Load lead times (only duracion > 0) ---
    lt_rows = conn.execute("""
        SELECT codigo_plazo, proceso, duracion_dias
        FROM lead_time_by_code
        WHERE duracion_dias > 0
    """).fetchall()

    # Build lookup: codigo_plazo (str) -> {proceso: duracion_dias}
    lt_lookup: dict[str, dict[str, int]] = {}
    for lt in lt_rows:
        cp = str(lt["codigo_plazo"]).strip()
        if cp not in lt_lookup:
            lt_lookup[cp] = {}
        lt_lookup[cp][lt["proceso"]] = lt["duracion_dias"]

    # --- Load jobs ---
    jobs_raw = conn.execute("""
        SELECT id, codigo_plazo, llegada, prioridad, atraso
        FROM sales_planning
        WHERE codigo_plazo IS NOT NULL
          AND llegada    IS NOT NULL
          AND prioridad  IS NOT NULL
    """).fetchall()

    jobs = []
    for j in jobs_raw:
        llegada_str = str(j["llegada"])[:10]
        try:
            llegada_date = date.fromisoformat(llegada_str)
        except ValueError:
            print(f"  Skipping job {j['id']}: invalid llegada '{j['llegada']}'")
            continue
        jobs.append({
            "id":           j["id"],
            "codigo_plazo": str(j["codigo_plazo"]).strip(),
            "llegada":      llegada_date,
            "prioridad":    int(j["prioridad"]) if j["prioridad"] else 5,
            "atraso":       int(j["atraso"])    if j["atraso"]    else 0,
        })

    if not jobs:
        print("No plannable jobs found (need codigo_plazo + llegada + prioridad).")
        conn.close()
        return

    # --- Build task list per job ---
    # A task exists only when duracion > 0 AND proceso has valid capacity & order
    job_tasks: list[list[dict]] = []
    for job in jobs:
        cp = job["codigo_plazo"]
        lt = lt_lookup.get(cp, {})
        tasks = []
        for proc in proc_list:
            pname = proc["proceso"]
            dur = lt.get(pname, 0)
            if dur > 0:
                tasks.append({
                    "proceso":  pname,
                    "orden":    proc["orden"],
                    "duration": dur,
                    "capacity": proc["capacidad_por_dia"],
                })
        job_tasks.append(tasks)
        if not tasks:
            print(f"  WARNING: Job {job['id']} (codigo_plazo={cp}) has no applicable processes.")

    # --- Reference date (Monday at or before earliest llegada) ---
    min_llegada = min(j["llegada"] for j in jobs)
    ref_date = find_prev_monday(min_llegada)

    # --- Compute planning horizon ---
    max_sum_dur = max((sum(t["duration"] for t in tasks) for tasks in job_tasks if tasks), default=100)
    max_llegada_day = max(date_to_workday(j["llegada"], ref_date) for j in jobs)
    HORIZON = max_llegada_day + max_sum_dur * 3 + 200

    print(f"Jobs: {len(jobs)}  |  Processes: {len(proc_list)}  |  Horizon: {HORIZON} working days")
    print(f"Reference date: {ref_date}")

    # --- Build CP-SAT model ---
    model = cp_model.CpModel()

    starts:    dict[tuple[int, int], cp_model.IntVar] = {}
    ends:      dict[tuple[int, int], cp_model.IntVar] = {}
    intervals: dict[tuple[int, int], cp_model.IntervalVar] = {}

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        llegada_day = date_to_workday(job["llegada"], ref_date)
        for ti, task in enumerate(tasks):
            dur = task["duration"]
            s = model.new_int_var(llegada_day, HORIZON,        f"s_{ji}_{ti}")
            e = model.new_int_var(llegada_day, HORIZON + dur,  f"e_{ji}_{ti}")
            iv = model.new_interval_var(s, dur, e,             f"iv_{ji}_{ti}")
            starts[(ji, ti)]    = s
            ends[(ji, ti)]      = e
            intervals[(ji, ti)] = iv

        if tasks:
            # First task must start on or after llegada
            model.add(starts[(ji, 0)] >= llegada_day)
            # Precedence: task ti starts after task ti-1 finishes
            for ti in range(1, len(tasks)):
                model.add(starts[(ji, ti)] >= ends[(ji, ti - 1)])

    # --- Capacity constraints (cumulative per process) ---
    for proc in proc_list:
        pname    = proc["proceso"]
        capacity = proc["capacidad_por_dia"]
        ivs  = []
        dmds = []
        for ji, tasks in enumerate(job_tasks):
            for ti, task in enumerate(tasks):
                if task["proceso"] == pname:
                    ivs.append(intervals[(ji, ti)])
                    dmds.append(1)
        if ivs:
            model.add_cumulative(ivs, dmds, capacity)

    # --- Objective: priority-ordered starts + weighted tardiness ---
    #
    # Two-component objective:
    #   1. START-TIME component (dominates): minimise sum(start[j][0] * priority_weight[j])
    #      priority_weight = (11 - prioridad) * PRIORITY_SCALE
    #      prioridad=1 → weight=10*SCALE  (solver strongly pulls it to earliest slot)
    #      prioridad=10 → weight=1*SCALE  (least pull)
    #      This forces high-priority jobs to win capacity conflicts by starting first.
    #
    #   2. TARDINESS component: minimise sum(tardiness[j] * weight[j])
    #      Same logic as before; subordinate to component 1 via PRIORITY_SCALE.
    #
    # PRIORITY_SCALE must exceed the maximum tardiness weight (100) so that saving
    # one working day for a high-priority job always beats any tardiness benefit.
    PRIORITY_SCALE = 1_000  # >> max tardiness weight (100)

    tard_terms:  list = []
    start_terms: list = []

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        if not tasks:
            continue
        total_dur   = sum(t["duration"] for t in tasks)
        llegada_day = date_to_workday(job["llegada"], ref_date)
        atraso      = job["atraso"]
        due_day     = llegada_day + total_dur + atraso
        prioridad   = job["prioridad"]

        # Tardiness term
        last_ti = len(tasks) - 1
        tard = model.new_int_var(0, HORIZON, f"tard_{ji}")
        # tard = max(0, end_of_last_task - due_day)
        model.add_max_equality(tard, [ends[(ji, last_ti)] - due_day, 0])
        tard_weight = max(1, 100 // max(1, prioridad))
        tard_terms.append(tard * tard_weight)

        # Start-time ordering term
        # Higher-importance jobs (low prioridad) get a larger coefficient so the
        # solver prefers to schedule them into earlier slots when capacity is tight.
        start_weight = (11 - prioridad) * PRIORITY_SCALE
        start_terms.append(starts[(ji, 0)] * start_weight)

    all_terms = start_terms + tard_terms
    if all_terms:
        model.minimize(sum(all_terms))

    # --- Solve ---
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers  = 4
    solver.parameters.log_search_progress = False

    print("Solving...")
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        print(f"No solution found. Status: {solver.status_name(status)}")
        conn.close()
        sys.exit(1)

    print(f"Solution: {solver.status_name(status)}  |  Objective: {solver.objective_value:.1f}")

    # --- Write results ---
    now = datetime.utcnow().isoformat()

    conn.execute("DELETE FROM optimized_process_schedule")
    conn.execute("DELETE FROM sales_planning_optimized")

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        if not tasks:
            continue

        first_ti = 0
        last_ti  = len(tasks) - 1

        job_start_day  = solver.value(starts[(ji, first_ti)])
        job_end_day    = solver.value(ends[(ji, last_ti)])
        job_start_date = workday_to_date(job_start_day,       ref_date)
        # end_day from CP-SAT is exclusive (first slot NOT in job).
        # Subtract 1 to get the last inclusive working day.
        job_end_date   = workday_to_date(job_end_day - 1, ref_date)

        opt_id = f"opt_{job['id'][:16]}_{ji}"
        conn.execute("""
            INSERT INTO sales_planning_optimized
                (id, sales_planning_id, position, start_date, end_date, prioridad, codigo_plazo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            opt_id,
            job["id"],
            ji + 1,
            job_start_date.isoformat(),
            job_end_date.isoformat(),
            job["prioridad"],
            job["codigo_plazo"],
            now, now,
        ))

        for ti, task in enumerate(tasks):
            task_start_day  = solver.value(starts[(ji, ti)])
            task_end_day    = solver.value(ends[(ji, ti)])
            task_start_date = workday_to_date(task_start_day,       ref_date)
            # end_day is exclusive; store last inclusive working day.
            task_end_date   = workday_to_date(task_end_day - 1, ref_date)

            sched_id = f"ops_{job['id'][:14]}_{ji}_{ti}"
            conn.execute("""
                INSERT INTO optimized_process_schedule
                    (id, sales_planning_id, proceso, orden, start_date, end_date, duration_days, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sched_id,
                job["id"],
                task["proceso"],
                task["orden"],
                task_start_date.isoformat(),
                task_end_date.isoformat(),
                task["duration"],
                now,
            ))

        print(f"  Job {ji+1}: {job['id'][:8]}… | {job['codigo_plazo']:>4} | "
              f"{job_start_date} → {job_end_date} | P{job['prioridad']}")

    conn.commit()
    conn.close()
    print("Planning complete. Results written to DB.")


if __name__ == "__main__":
    main()
