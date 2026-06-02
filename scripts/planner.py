#!/usr/bin/env python3
"""
CP-SAT Planning Engine for ETP Maestranza — v4 (PostgreSQL)

Changes from v3:
  - Database: SQLite → Supabase PostgreSQL via psycopg2
  - Objective fix: start_weight now scales correctly for priorities 1..N (was hardcoded for 1..10)
  - SQL: PostgreSQL-compatible syntax (no ORDER BY/LIMIT in UPDATE, %s placeholders)

Eligibility for planning:
  - requires: codigo_plazo, llegada, prioridad
  - atraso defaults to 0 if null
"""

import sys
import os
from datetime import date, timedelta, datetime, timezone
from pathlib import Path

try:
    from ortools.sat.python import cp_model
except ImportError:
    print("ERROR: ortools not installed. Run: pip3 install ortools")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip3 install psycopg2-binary")
    sys.exit(1)

# --- Path / env resolution ---
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH     = PROJECT_ROOT / "etp-app" / ".env.local"


def load_db_url() -> str:
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                return url.replace("%21", "!")
    raise RuntimeError("DATABASE_URL not found in .env.local")


# ---------------------------------------------------------------------------
# Working-day helpers (unchanged)
# ---------------------------------------------------------------------------

def build_working_calendar(ref_date: date, horizon_days: int, special_days: set) -> list:
    calendar = []
    cur = ref_date
    safety = horizon_days + 500
    while len(calendar) < safety:
        dow = cur.weekday()
        if dow < 5 or cur in special_days:
            calendar.append(cur)
        cur += timedelta(days=1)
    return calendar


def build_date_index(calendar: list) -> dict:
    return {d: i for i, d in enumerate(calendar)}


def date_to_workday(d: date, calendar: list, date_index: dict) -> int:
    if d in date_index:
        return date_index[d]
    for i, cal_d in enumerate(calendar):
        if cal_d >= d:
            return i
    return len(calendar)


def workday_to_date(n: int, calendar: list) -> date:
    if n <= 0:
        return calendar[0]
    if n < len(calendar):
        return calendar[n]
    return calendar[-1]


def add_workdays(d: date, n: int, calendar: list, date_index: dict) -> date:
    idx = date_to_workday(d, calendar, date_index)
    return workday_to_date(idx + n, calendar)


def subtract_workdays(d: date, n: int, calendar: list, date_index: dict) -> date:
    idx = date_to_workday(d, calendar, date_index)
    return workday_to_date(max(0, idx - n), calendar)


# ---------------------------------------------------------------------------
# Slot assignment (unchanged)
# ---------------------------------------------------------------------------

def assign_slots(proc_tasks: list, capacity: int) -> dict:
    sorted_tasks = sorted(proc_tasks, key=lambda x: (x[1], x[0]))
    slot_available = [0] * capacity
    result = {}
    for job_id, start_day, end_day in sorted_tasks:
        assigned = None
        for i in range(capacity):
            if slot_available[i] <= start_day:
                assigned = i
                break
        if assigned is None:
            assigned = 0
        slot_available[assigned] = end_day
        result[job_id] = assigned + 1
    return result


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def to_date(v) -> "date | None":
    """Normalize PostgreSQL date/datetime/string to a Python date."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Main solver
# ---------------------------------------------------------------------------

def main():
    conn = psycopg2.connect(load_db_url(), sslmode="require")
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    now     = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # --- Cleanup orphan records from pre-versioning era ---
    cur.execute("SELECT COUNT(*) as c FROM optimized_process_schedule WHERE planning_run_id IS NULL")
    orphan_ops = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM sales_planning_optimized WHERE planning_run_id IS NULL")
    orphan_opt = cur.fetchone()["c"]
    if orphan_ops > 0 or orphan_opt > 0:
        print(f"  Cleaning up {orphan_ops} orphan process schedules, {orphan_opt} orphan optimized records...")
        cur.execute("DELETE FROM optimized_process_schedule WHERE planning_run_id IS NULL")
        cur.execute("DELETE FROM sales_planning_optimized WHERE planning_run_id IS NULL")
        conn.commit()

    # --- Manage planning run versioning ---
    cur.execute("SELECT id, created_at FROM planning_run WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1")
    active_run = cur.fetchone()

    cur.execute("UPDATE planning_run SET status = 'ARCHIVED' WHERE status = 'PREVIOUS'")

    if active_run:
        cur.execute("UPDATE planning_run SET status = 'PREVIOUS' WHERE id = %s", (active_run["id"],))

    cur.execute("SELECT MAX(version) as max_v FROM planning_run")
    max_version = cur.fetchone()["max_v"] or 0
    new_version = max_version + 1

    new_run_id = f"run_{now_iso.replace(':', '').replace('-', '').replace('.', '')[:20]}"
    cur.execute(
        "INSERT INTO planning_run (id, version, status, created_at) VALUES (%s, %s, 'ACTIVE', %s)",
        (new_run_id, new_version, now)
    )
    conn.commit()

    print(f"PlanningRun created: {new_run_id} (v{new_version})")
    if active_run:
        print(f"  Previous run {active_run['id']} demoted to PREVIOUS")

    # --- Load process capacities ---
    cur.execute("""
        SELECT proceso, orden, capacidad_por_dia
        FROM process_capacity
        WHERE orden > 0 AND capacidad_por_dia > 0
        ORDER BY orden ASC
    """)
    processes = cur.fetchall()

    if not processes:
        print("ERROR: No process capacity data found. Run seed_rules.py first.")
        conn.close()
        sys.exit(1)

    proc_list = [dict(p) for p in processes]

    # --- Load lead times ---
    cur.execute("""
        SELECT codigo_plazo, proceso, duracion_dias
        FROM lead_time_by_code
        WHERE duracion_dias > 0
    """)
    lt_rows = cur.fetchall()

    lt_lookup: dict = {}
    for lt in lt_rows:
        cp = str(lt["codigo_plazo"]).strip()
        if cp not in lt_lookup:
            lt_lookup[cp] = {}
        lt_lookup[cp][lt["proceso"]] = lt["duracion_dias"]

    # --- Load special working days ---
    cur.execute("SELECT id, date FROM special_working_day WHERE used_in_planning = FALSE")
    special_rows = cur.fetchall()

    special_days: set = set()
    for row in special_rows:
        d = to_date(row["date"])
        if d:
            special_days.add(d)

    if special_days:
        print(f"  Special working days loaded: {sorted(special_days)}")

    # --- Load buffer adjustments ---
    buffer_cutoff = active_run["created_at"] if active_run else None

    if buffer_cutoff:
        cur.execute("""
            SELECT id, planning_buffer_days, planning_buffer_at
            FROM sales_planning
            WHERE planning_buffer_days IS NOT NULL
              AND planning_buffer_at IS NOT NULL
              AND planning_buffer_at > %s
        """, (buffer_cutoff,))
    else:
        cur.execute("""
            SELECT id, planning_buffer_days, planning_buffer_at
            FROM sales_planning
            WHERE planning_buffer_days IS NOT NULL
        """)
    buffer_rows = cur.fetchall()

    buffer_map: dict     = {}
    buffer_at_map: dict  = {}

    for row in buffer_rows:
        buffer_map[row["id"]] = int(row["planning_buffer_days"])
        d = to_date(row["planning_buffer_at"])
        if d:
            buffer_at_map[row["id"]] = d

    if buffer_map:
        print(f"  Buffer adjustments loaded: {len(buffer_map)} records")

    # --- Load previous run's process schedule for buffered jobs ---
    prev_schedule_map: dict = {}
    if active_run and buffer_map:
        cur.execute("""
            SELECT sales_planning_id, proceso, orden, start_date, end_date, duration_days
            FROM optimized_process_schedule
            WHERE planning_run_id = %s
            ORDER BY sales_planning_id, orden
        """, (active_run["id"],))
        prev_sched_rows = cur.fetchall()
        for row in prev_sched_rows:
            jid = row["sales_planning_id"]
            if jid not in buffer_map:
                continue
            if jid not in prev_schedule_map:
                prev_schedule_map[jid] = {}
            s = to_date(row["start_date"])
            e = to_date(row["end_date"])
            if s and e:
                prev_schedule_map[jid][row["proceso"]] = {
                    "start_date": s,
                    "end_date":   e,
                    "duration":   row["duration_days"],
                }

    # --- Load jobs ---
    cur.execute("""
        SELECT id, codigo_plazo, llegada, prioridad, atraso
        FROM sales_planning
        WHERE codigo_plazo IS NOT NULL
          AND llegada    IS NOT NULL
          AND prioridad  IS NOT NULL
    """)
    jobs_raw = cur.fetchall()

    jobs = []
    for j in jobs_raw:
        llegada_date = to_date(j["llegada"])
        if not llegada_date:
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

    cur.execute(
        "SELECT COUNT(*) as c FROM sales_planning WHERE codigo_plazo IS NOT NULL AND prioridad IS NOT NULL"
    )
    total_records = cur.fetchone()["c"]
    excluded_count = total_records - len(jobs)
    if excluded_count > 0:
        print(f"  Excluded {excluded_count} record(s) without llegada from planning")

    if not jobs:
        print("No plannable jobs found (need codigo_plazo + llegada + prioridad).")
        conn.close()
        return

    # Max priority value across jobs — used to scale objective correctly for any range (e.g. 1..67)
    max_prio = max(j["prioridad"] for j in jobs)

    # --- Build task list per job ---
    job_tasks: list = []
    for job in jobs:
        cp  = job["codigo_plazo"]
        lt  = lt_lookup.get(cp, {})
        tasks = []
        for proc in proc_list:
            pname = proc["proceso"]
            dur   = lt.get(pname, 0)
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
    ref_date    = min_llegada - timedelta(days=min_llegada.weekday())

    max_sum_dur         = max((sum(t["duration"] for t in tasks) for tasks in job_tasks if tasks), default=100)
    max_llegada_offset  = max((j["llegada"] - ref_date).days for j in jobs)
    HORIZON             = max_llegada_offset + max_sum_dur * 3 + 300

    calendar   = build_working_calendar(ref_date, HORIZON, special_days)
    date_index = build_date_index(calendar)
    CAL_SIZE   = len(calendar)

    print(f"Jobs: {len(jobs)}  |  Processes: {len(proc_list)}  |  Calendar size: {CAL_SIZE} working days")
    print(f"Reference date: {ref_date}")

    # --- Build CP-SAT model ---
    model = cp_model.CpModel()

    starts:    dict = {}
    ends:      dict = {}
    intervals: dict = {}

    restart_job_ids: set = set()

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        jid         = job["id"]
        buf         = job["buffer"]
        buf_at      = buffer_at_map.get(jid)
        prev_sched  = prev_schedule_map.get(jid, {})
        llegada_day = date_to_workday(job["llegada"], calendar, date_index)

        use_restart = buf != 0 and buf_at is not None and bool(prev_sched) and bool(tasks)

        if use_restart:
            restart_job_ids.add(jid)
            fmask = []
            for task in tasks:
                prev = prev_sched.get(task["proceso"])
                fmask.append(bool(prev and prev["end_date"] < buf_at))

            if buf < 0:
                restart_d = add_workdays(buf_at, abs(buf), calendar, date_index)
            else:
                restart_d = subtract_workdays(buf_at, buf, calendar, date_index)
            restart_day = date_to_workday(restart_d, calendar, date_index)
        else:
            fmask       = [False] * len(tasks)
            restart_day = None

        for ti, task in enumerate(tasks):
            if fmask[ti]:
                prev = prev_sched[task["proceso"]]
                fs   = date_to_workday(prev["start_date"], calendar, date_index)
                fe   = date_to_workday(prev["end_date"],   calendar, date_index) + 1
                dur  = max(1, fe - fs)
                s    = model.new_int_var(fs, fs, f"s_{ji}_{ti}")
                e    = model.new_int_var(fe, fe, f"e_{ji}_{ti}")
                iv   = model.new_interval_var(s, dur, e, f"iv_{ji}_{ti}")
            else:
                dur = task["duration"]
                s   = model.new_int_var(llegada_day, CAL_SIZE,       f"s_{ji}_{ti}")
                e   = model.new_int_var(llegada_day, CAL_SIZE + dur, f"e_{ji}_{ti}")
                iv  = model.new_interval_var(s, dur, e,              f"iv_{ji}_{ti}")

            starts[(ji, ti)]    = s
            ends[(ji, ti)]      = e
            intervals[(ji, ti)] = iv

        if tasks:
            if not fmask[0]:
                model.add(starts[(ji, 0)] >= llegada_day)

            for ti in range(1, len(tasks)):
                model.add(starts[(ji, ti)] >= ends[(ji, ti - 1)])

            if restart_day is not None:
                first_free = next((ti for ti, f in enumerate(fmask) if not f), None)
                if first_free is not None:
                    model.add(starts[(ji, first_free)] >= restart_day)

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
    # start_weight: higher-priority jobs (lower prioridad number) must start earlier.
    # Formula uses max_prio so the scale is always positive regardless of priority range (1..5 or 1..67).
    PRIORITY_SCALE = 1_000

    tard_terms:  list = []
    start_terms: list = []

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        if not tasks:
            continue
        total_dur   = sum(t["duration"] for t in tasks)
        llegada_day = date_to_workday(job["llegada"], calendar, date_index)

        effective_buf = 0 if job["id"] in restart_job_ids else job["buffer"]
        atraso        = job["atraso"] + effective_buf
        due_day       = llegada_day + total_dur + atraso
        prioridad     = job["prioridad"]

        last_ti = len(tasks) - 1
        tard    = model.new_int_var(0, CAL_SIZE * 2, f"tard_{ji}")
        model.add_max_equality(tard, [ends[(ji, last_ti)] - due_day, 0])

        # tard_weight: P1 penalizes tardiness most; decreases with priority number
        tard_weight  = max(1, 100 // max(1, prioridad))
        tard_terms.append(tard * tard_weight)

        # start_weight: ensures higher-priority jobs are scheduled first.
        # (max_prio + 1 - prioridad) → P1 gets max_prio, P(max_prio) gets 1. Always ≥ 1.
        start_weight = max(1, max_prio + 1 - prioridad) * PRIORITY_SCALE
        start_terms.append(starts[(ji, 0)] * start_weight)

        # Gap tiebreaker: penalize late starts for all subsequent tasks (weight=1).
        # Eliminates unnecessary idle time between consecutive processes when capacity
        # is available but the solver has no other reason to start the next process
        # early (e.g. when tardiness is the same regardless of gap).
        # Weight=1 << PRIORITY_SCALE=1000, so priority ordering is always preserved.
        # Uses weighted_sum (ortools explicit API) instead of appending raw IntVar
        # objects to avoid type-mixing issues with Python sum() across ortools versions.
        if len(tasks) > 1:
            gap_vars    = [starts[(ji, ti)] for ti in range(1, len(tasks))]
            gap_weights = [1] * len(gap_vars)
            start_terms.append(cp_model.LinearExpr.weighted_sum(gap_vars, gap_weights))

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
        # Rollback
        cur.execute("""
            UPDATE planning_run SET status = 'ACTIVE'
            WHERE id = (
                SELECT id FROM planning_run WHERE status = 'PREVIOUS'
                ORDER BY created_at DESC LIMIT 1
            )
        """)
        cur.execute("UPDATE planning_run SET status = 'ARCHIVED' WHERE id = %s", (new_run_id,))
        conn.commit()
        print(f"No solution found. Status: {solver.status_name(status)}")
        conn.close()
        sys.exit(1)

    print(f"Solution: {solver.status_name(status)}  |  Objective: {solver.objective_value:.1f}")

    # --- Compute slot assignments per process ---
    proc_task_list: dict = {p["proceso"]: [] for p in proc_list}
    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        for ti, task in enumerate(tasks):
            pname     = task["proceso"]
            start_day = solver.value(starts[(ji, ti)])
            end_day   = solver.value(ends[(ji, ti)])
            proc_task_list[pname].append((job["id"], start_day, end_day))

    slot_assignments: dict = {}
    for proc in proc_list:
        pname    = proc["proceso"]
        capacity = proc["capacidad_por_dia"]
        slots    = assign_slots(proc_task_list[pname], capacity)
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
            cur.execute("""
                INSERT INTO sales_planning_optimized
                    (id, sales_planning_id, planning_run_id, position, start_date, end_date,
                     prioridad, codigo_plazo, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                slot            = slot_assignments.get((job["id"], task["proceso"]), 1)

                sched_id = f"ops_{new_run_id[-8:]}_{job['id'][:10]}_{ji}_{ti}"
                cur.execute("""
                    INSERT INTO optimized_process_schedule
                        (id, sales_planning_id, planning_run_id, proceso, orden, slot,
                         start_date, end_date, duration_days, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    sched_id, job["id"], new_run_id,
                    task["proceso"], task["orden"], slot,
                    task_start_date.isoformat(), task_end_date.isoformat(),
                    task["duration"], now,
                ))

            buf = job["buffer"]
            tag = ""
            if job["id"] in restart_job_ids:
                tag = " [restart]"
            elif buf != 0:
                tag = f" | buf={buf:+d}d"
            print(f"  Job {ji+1}: {job['id'][:8]}… | {job['codigo_plazo']:>4} | "
                  f"{job_start_date} → {job_end_date} | P{job['prioridad']}{tag}")

        # --- Mark special working days as used ---
        cur.execute("SELECT id FROM special_working_day WHERE used_in_planning = FALSE")
        special_day_ids = cur.fetchall()
        for row in special_day_ids:
            cur.execute(
                "UPDATE special_working_day SET used_in_planning = TRUE, planning_run_id = %s WHERE id = %s",
                (new_run_id, row["id"])
            )

    except Exception as e:
        conn.rollback()
        cur.execute("""
            UPDATE planning_run SET status = 'ACTIVE'
            WHERE id = (
                SELECT id FROM planning_run WHERE status = 'PREVIOUS'
                ORDER BY created_at DESC LIMIT 1
            )
        """)
        cur.execute("DELETE FROM planning_run WHERE id = %s", (new_run_id,))
        conn.commit()
        conn.close()
        print(f"ERROR writing results: {e}")
        sys.exit(1)

    conn.commit()
    conn.close()
    print(f"Planning complete. {len(jobs)} jobs written to DB (run {new_run_id}).")


if __name__ == "__main__":
    main()
