#!/usr/bin/env python3
"""
CP-SAT Planning Engine for ETP Maestranza — v2

Changes from v1:
  - Planning versioning: creates a PlanningRun record, archives old runs.
  - Buffer adjustments: applies planning_buffer_days if set after last active run.
  - Special working days: user-defined working days (e.g. weekends, holidays).
  - Slot assignment: each process task gets a slot number (1..capacity).
  - Does NOT delete previous runs — supports undo via the web UI.

Eligibility for planning:
  - requires: codigo_plazo, llegada, prioridad
  - atraso defaults to 0 if null

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
# Working-day helpers (calendar-based to support special days)
# ---------------------------------------------------------------------------

def build_working_calendar(ref_date: date, horizon_days: int, special_days: set) -> list:
    """
    Build an ordered list of working days starting at ref_date.
    special_days: set of date objects treated as working days even if Sat/Sun.
    Returns list of dates (at least horizon_days long).
    """
    calendar = []
    cur = ref_date
    # Build enough days to cover the horizon
    safety = horizon_days + 500
    while len(calendar) < safety:
        dow = cur.weekday()  # 0=Mon, 6=Sun
        if dow < 5 or cur in special_days:
            calendar.append(cur)
        cur += timedelta(days=1)
    return calendar


def build_date_index(calendar: list) -> dict:
    """Map date -> workday index."""
    return {d: i for i, d in enumerate(calendar)}


def date_to_workday(d: date, calendar: list, date_index: dict) -> int:
    """Convert a calendar date to a workday index (0-based)."""
    if d in date_index:
        return date_index[d]
    # Find the first working day on or after d
    for i, cal_d in enumerate(calendar):
        if cal_d >= d:
            return i
    return len(calendar)


def workday_to_date(n: int, calendar: list) -> date:
    """Convert workday index to date."""
    if n <= 0:
        return calendar[0]
    if n < len(calendar):
        return calendar[n]
    return calendar[-1]


# ---------------------------------------------------------------------------
# Slot assignment
# ---------------------------------------------------------------------------

def assign_slots(proc_tasks: list, capacity: int) -> dict:
    """
    Greedy slot assignment for tasks in a single process.

    proc_tasks: list of (job_id, start_day, end_day)
    capacity: max concurrent tasks in this process

    Returns: {job_id: slot_number (1-indexed)}
    """
    # Sort by start day, then job_id for determinism
    sorted_tasks = sorted(proc_tasks, key=lambda x: (x[1], x[0]))

    # slot_available[i] = next free workday for slot i (0-indexed slots)
    slot_available = [0] * capacity
    result = {}

    for job_id, start_day, end_day in sorted_tasks:
        assigned = None
        # Find the earliest free slot
        for i in range(capacity):
            if slot_available[i] <= start_day:
                assigned = i
                break
        if assigned is None:
            assigned = 0  # fallback (CP-SAT guarantees capacity)
        slot_available[assigned] = end_day
        result[job_id] = assigned + 1  # 1-indexed

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

    # --- Cleanup orphan records from pre-versioning era ---
    orphan_ops = conn.execute(
        "SELECT COUNT(*) FROM optimized_process_schedule WHERE planning_run_id IS NULL"
    ).fetchone()[0]
    orphan_opt = conn.execute(
        "SELECT COUNT(*) FROM sales_planning_optimized WHERE planning_run_id IS NULL"
    ).fetchone()[0]
    if orphan_ops > 0 or orphan_opt > 0:
        print(f"  Cleaning up {orphan_ops} orphan process schedules, {orphan_opt} orphan optimized records (pre-versioning)...")
        conn.execute("DELETE FROM optimized_process_schedule WHERE planning_run_id IS NULL")
        conn.execute("DELETE FROM sales_planning_optimized WHERE planning_run_id IS NULL")
        conn.commit()

    # --- Manage planning run versioning ---
    # Find current active run
    active_run = conn.execute(
        "SELECT id, created_at FROM planning_run WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1"
    ).fetchone()

    # Archive old PREVIOUS runs
    conn.execute("UPDATE planning_run SET status = 'ARCHIVED' WHERE status = 'PREVIOUS'")

    # Demote current ACTIVE to PREVIOUS
    if active_run:
        conn.execute(
            "UPDATE planning_run SET status = 'PREVIOUS' WHERE id = ?",
            (active_run["id"],)
        )

    # Determine next version number
    max_version = conn.execute(
        "SELECT MAX(version) FROM planning_run"
    ).fetchone()[0] or 0
    new_version = max_version + 1

    # Create new ACTIVE planning run
    now = datetime.utcnow().isoformat()
    new_run_id = f"run_{now.replace(':', '').replace('-', '').replace('.', '')[:20]}"
    conn.execute(
        "INSERT INTO planning_run (id, version, status, created_at) VALUES (?, ?, 'ACTIVE', ?)",
        (new_run_id, new_version, now)
    )
    conn.commit()

    print(f"PlanningRun created: {new_run_id} (v{new_version})")
    if active_run:
        print(f"  Previous run {active_run['id']} archived as PREVIOUS")

    # --- Load process capacities ---
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
    proc_order = {p["proceso"]: p for p in proc_list}

    # --- Load lead times ---
    lt_rows = conn.execute("""
        SELECT codigo_plazo, proceso, duracion_dias
        FROM lead_time_by_code
        WHERE duracion_dias > 0
    """).fetchall()

    lt_lookup: dict = {}
    for lt in lt_rows:
        cp = str(lt["codigo_plazo"]).strip()
        if cp not in lt_lookup:
            lt_lookup[cp] = {}
        lt_lookup[cp][lt["proceso"]] = lt["duracion_dias"]

    # --- Load special working days (not yet used in any planning run) ---
    special_rows = conn.execute("""
        SELECT date FROM special_working_day
        WHERE used_in_planning = 0
    """).fetchall()

    special_days: set = set()
    for row in special_rows:
        date_str = str(row["date"])[:10]
        try:
            special_days.add(date.fromisoformat(date_str))
        except ValueError:
            pass

    if special_days:
        print(f"  Special working days loaded: {sorted(special_days)}")

    # --- Load buffer adjustments (only buffers set AFTER the previous active run) ---
    # active_run here is the OLD active run (now PREVIOUS), so buffers must be newer
    buffer_cutoff = active_run["created_at"] if active_run else None

    if buffer_cutoff:
        buffer_rows = conn.execute("""
            SELECT id, planning_buffer_days, planning_buffer_at
            FROM sales_planning
            WHERE planning_buffer_days IS NOT NULL
              AND planning_buffer_at IS NOT NULL
              AND planning_buffer_at > datetime(?)
        """, (buffer_cutoff,)).fetchall()
    else:
        buffer_rows = conn.execute("""
            SELECT id, planning_buffer_days, planning_buffer_at
            FROM sales_planning
            WHERE planning_buffer_days IS NOT NULL
        """).fetchall()

    buffer_map: dict = {}
    for row in buffer_rows:
        buffer_map[row["id"]] = int(row["planning_buffer_days"])

    if buffer_map:
        print(f"  Buffer adjustments applied: {len(buffer_map)} records")

    # --- Load jobs (must have codigo_plazo + llegada + prioridad) ---
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
            "buffer":       buffer_map.get(j["id"], 0),
        })

    # Count excluded records (no llegada)
    total_records = conn.execute(
        "SELECT COUNT(*) FROM sales_planning WHERE codigo_plazo IS NOT NULL AND prioridad IS NOT NULL"
    ).fetchone()[0]
    excluded_count = total_records - len(jobs)
    if excluded_count > 0:
        print(f"  Excluded {excluded_count} record(s) without llegada from planning")

    if not jobs:
        print("No plannable jobs found (need codigo_plazo + llegada + prioridad).")
        conn.close()
        return

    # --- Build task list per job ---
    job_tasks: list = []
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

    # --- Build working calendar ---
    min_llegada = min(j["llegada"] for j in jobs)
    # ref_date = first working day on or before min_llegada
    # Start from the Monday of the week of min_llegada
    ref_date = min_llegada - timedelta(days=min_llegada.weekday())

    max_sum_dur = max((sum(t["duration"] for t in tasks) for tasks in job_tasks if tasks), default=100)
    max_llegada_offset = max((j["llegada"] - ref_date).days for j in jobs)
    HORIZON = max_llegada_offset + max_sum_dur * 3 + 300  # in calendar days

    calendar = build_working_calendar(ref_date, HORIZON, special_days)
    date_index = build_date_index(calendar)
    CAL_SIZE = len(calendar)

    print(f"Jobs: {len(jobs)}  |  Processes: {len(proc_list)}  |  Calendar size: {CAL_SIZE} working days")
    print(f"Reference date: {ref_date}")

    # --- Build CP-SAT model ---
    model = cp_model.CpModel()

    starts:    dict = {}
    ends:      dict = {}
    intervals: dict = {}

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        llegada_day = date_to_workday(job["llegada"], calendar, date_index)
        for ti, task in enumerate(tasks):
            dur = task["duration"]
            s  = model.new_int_var(llegada_day, CAL_SIZE,          f"s_{ji}_{ti}")
            e  = model.new_int_var(llegada_day, CAL_SIZE + dur,    f"e_{ji}_{ti}")
            iv = model.new_interval_var(s, dur, e,                 f"iv_{ji}_{ti}")
            starts[(ji, ti)]    = s
            ends[(ji, ti)]      = e
            intervals[(ji, ti)] = iv

        if tasks:
            model.add(starts[(ji, 0)] >= llegada_day)
            for ti in range(1, len(tasks)):
                model.add(starts[(ji, ti)] >= ends[(ji, ti - 1)])

    # --- Capacity constraints ---
    for proc in proc_list:
        pname    = proc["proceso"]
        capacity = proc["capacidad_por_dia"]
        ivs, dmds = [], []
        for ji, tasks in enumerate(job_tasks):
            for ti, task in enumerate(tasks):
                if task["proceso"] == pname:
                    ivs.append(intervals[(ji, ti)])
                    dmds.append(1)
        if ivs:
            model.add_cumulative(ivs, dmds, capacity)

    # --- Objective ---
    PRIORITY_SCALE = 1_000

    tard_terms:  list = []
    start_terms: list = []

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        if not tasks:
            continue
        total_dur   = sum(t["duration"] for t in tasks)
        llegada_day = date_to_workday(job["llegada"], calendar, date_index)
        atraso      = job["atraso"] + job["buffer"]  # apply buffer to atraso
        due_day     = llegada_day + total_dur + atraso
        prioridad   = job["prioridad"]

        last_ti = len(tasks) - 1
        tard = model.new_int_var(0, CAL_SIZE * 2, f"tard_{ji}")
        model.add_max_equality(tard, [ends[(ji, last_ti)] - due_day, 0])
        tard_weight = max(1, 100 // max(1, prioridad))
        tard_terms.append(tard * tard_weight)

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
        # Rollback: restore old active run
        conn.execute(
            "UPDATE planning_run SET status = 'ACTIVE' WHERE status = 'PREVIOUS' ORDER BY created_at DESC LIMIT 1"
        )
        conn.execute(
            "UPDATE planning_run SET status = 'ARCHIVED' WHERE id = ?",
            (new_run_id,)
        )
        conn.commit()
        print(f"No solution found. Status: {solver.status_name(status)}")
        conn.close()
        sys.exit(1)

    print(f"Solution: {solver.status_name(status)}  |  Objective: {solver.objective_value:.1f}")

    # --- Compute slot assignments per process ---
    # For each process, collect (job_id, start_day, end_day) and assign slots
    proc_task_list: dict = {p["proceso"]: [] for p in proc_list}
    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        for ti, task in enumerate(tasks):
            pname = task["proceso"]
            start_day = solver.value(starts[(ji, ti)])
            end_day   = solver.value(ends[(ji, ti)])
            proc_task_list[pname].append((job["id"], start_day, end_day))

    slot_assignments: dict = {}  # (job_id, proceso) -> slot
    for proc in proc_list:
        pname    = proc["proceso"]
        capacity = proc["capacidad_por_dia"]
        slots = assign_slots(proc_task_list[pname], capacity)
        for job_id, slot_num in slots.items():
            slot_assignments[(job_id, pname)] = slot_num

    # --- Write results (all-or-nothing) ---
    try:
        for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
            if not tasks:
                continue

            first_ti = 0
            last_ti  = len(tasks) - 1

            job_start_day  = solver.value(starts[(ji, first_ti)])
            job_end_day    = solver.value(ends[(ji, last_ti)])
            job_start_date = workday_to_date(job_start_day,   calendar)
            job_end_date   = workday_to_date(job_end_day - 1, calendar)

            opt_id = f"opt_{new_run_id[-8:]}_{job['id'][:12]}_{ji}"
            conn.execute("""
                INSERT INTO sales_planning_optimized
                    (id, sales_planning_id, planning_run_id, position, start_date, end_date, prioridad, codigo_plazo, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                opt_id, job["id"], new_run_id, ji + 1,
                job_start_date.isoformat(), job_end_date.isoformat(),
                job["prioridad"], job["codigo_plazo"], now, now,
            ))

            for ti, task in enumerate(tasks):
                task_start_day  = solver.value(starts[(ji, ti)])
                task_end_day    = solver.value(ends[(ji, ti)])
                task_start_date = workday_to_date(task_start_day,   calendar)
                task_end_date   = workday_to_date(task_end_day - 1, calendar)
                slot = slot_assignments.get((job["id"], task["proceso"]), 1)

                sched_id = f"ops_{new_run_id[-8:]}_{job['id'][:10]}_{ji}_{ti}"
                conn.execute("""
                    INSERT INTO optimized_process_schedule
                        (id, sales_planning_id, planning_run_id, proceso, orden, slot, start_date, end_date, duration_days, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    sched_id, job["id"], new_run_id,
                    task["proceso"], task["orden"], slot,
                    task_start_date.isoformat(), task_end_date.isoformat(),
                    task["duration"], now,
                ))

            print(f"  Job {ji+1}: {job['id'][:8]}… | {job['codigo_plazo']:>4} | "
                  f"{job_start_date} → {job_end_date} | P{job['prioridad']}"
                  + (f" | buf={job['buffer']:+d}d" if job['buffer'] != 0 else ""))

        # --- Mark special working days as used ---
        special_day_ids = conn.execute(
            "SELECT id FROM special_working_day WHERE used_in_planning = 0"
        ).fetchall()
        for row in special_day_ids:
            conn.execute(
                "UPDATE special_working_day SET used_in_planning = 1, planning_run_id = ? WHERE id = ?",
                (new_run_id, row["id"])
            )

    except Exception as e:
        conn.rollback()
        # Restore previous ACTIVE run and delete failed run
        conn.execute(
            "UPDATE planning_run SET status = 'ACTIVE' WHERE status = 'PREVIOUS' ORDER BY created_at DESC LIMIT 1"
        )
        conn.execute("DELETE FROM planning_run WHERE id = ?", (new_run_id,))
        conn.commit()
        conn.close()
        print(f"ERROR writing results: {e}")
        sys.exit(1)

    conn.commit()
    conn.close()
    print(f"Planning complete. {len(jobs)} jobs written to DB (run {new_run_id}).")


if __name__ == "__main__":
    main()
