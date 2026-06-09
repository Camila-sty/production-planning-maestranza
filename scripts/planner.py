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
    # 1. Environment variable — used in Railway / CI (no .env.local present)
    env_val = os.environ.get("DATABASE_URL", "").strip()
    if env_val:
        return env_val.replace("%21", "!")
    # 2. .env.local file — used in local development
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                return url.replace("%21", "!")
    raise RuntimeError("DATABASE_URL not found in environment or .env.local")


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
# Daily finite-capacity dispatch heuristic
# ---------------------------------------------------------------------------

def run_dispatch(
    jobs: list,
    job_tasks: list,
    proc_list: list,
    calendar: list,
    date_index: dict,
    pre_scheduled: "dict | None" = None,
    delayed_min_start: "dict | None" = None,
) -> dict:
    """
    Forward-pass finite-capacity dispatch heuristic.

    Each working day, for each process (in proc order):
      1. Count active slots (tasks already running today).
      2. Collect eligible jobs: next pending process = this process,
         arrived, predecessor finished at or before today.
      3. Sort eligible: prioridad ASC, llegada ASC, id ASC.
      4. Assign available slots in priority order.
         No capacity is left idle while eligible work exists.
         Priority only competes among jobs eligible on the same day —
         higher-priority jobs that are not yet ready cannot block slots.

    Parameters
    ----------
    pre_scheduled : dict (ji, ti) -> (start_day, end_day), optional
        Tasks already fixed before the forward pass begins (e.g. processes
        that a buffered job completed before its buf_at date).  These slots
        count against capacity exactly like normally scheduled tasks.
    delayed_min_start : dict ji -> workday_index, optional
        For the first non-pre-scheduled task of job ji, it cannot start
        before workday_index.  Applies only to that first task; subsequent
        tasks are constrained only by the predecessor-done rule.

    Returns
    -------
    scheduled : dict (ji, ti) -> (start_day, end_day)  [end_day exclusive]
    """
    ordered_procs = sorted(proc_list, key=lambda p: p["orden"])
    proc_cap      = {p["proceso"]: p["capacidad_por_dia"] for p in proc_list}
    llegada_days  = [
        date_to_workday(j["llegada"], calendar, date_index) for j in jobs
    ]

    # Seed scheduled with any frozen (pre-scheduled) tasks
    scheduled: dict = dict(pre_scheduled) if pre_scheduled else {}

    # For each delayed job, find the first task index that is NOT pre-scheduled
    first_delayed_ti: dict = {}
    if delayed_min_start:
        for ji in delayed_min_start:
            fft = 0
            while fft < len(job_tasks[ji]) and (ji, fft) in scheduled:
                fft += 1
            first_delayed_ti[ji] = fft

    # ── Validation targets ────────────────────────────────────────────────
    WATCH_OTS  = {"2372", "2411", "2412"}
    watch_ji   = {ji for ji, j in enumerate(jobs) if j.get("ot", "") in WATCH_OTS}
    target_day = date_index.get(date(2026, 5, 28))  # None when outside calendar

    # ── Forward pass: one working day at a time ───────────────────────────
    for d in range(len(calendar)):
        for proc in ordered_procs:
            pname = proc["proceso"]
            cap   = proc_cap[pname]

            # Slots already occupied today by in-progress tasks
            active = sum(
                1 for (jj, tt), (sd, ed) in scheduled.items()
                if job_tasks[jj][tt]["proceso"] == pname and sd <= d < ed
            )
            avail = cap - active

            # Build eligible list for this process on day d
            eligible = []
            for ji2, (job2, jtasks) in enumerate(zip(jobs, job_tasks)):
                # Next unscheduled task index
                ti = 0
                while ti < len(jtasks) and (ji2, ti) in scheduled:
                    ti += 1
                if ti >= len(jtasks):
                    continue                        # all tasks done
                if jtasks[ti]["proceso"] != pname:
                    continue                        # next task is a different process
                if llegada_days[ji2] > d:
                    continue                        # equipment not arrived yet
                # Buffer delay: the first non-frozen task has a min start day
                if (delayed_min_start and ji2 in delayed_min_start
                        and ti == first_delayed_ti.get(ji2, 0)
                        and d < delayed_min_start[ji2]):
                    continue                        # buffer delay window not open
                if ti > 0:
                    ps2 = scheduled.get((ji2, ti - 1))
                    if ps2 is None or ps2[1] > d:
                        continue                    # predecessor not finished
                eligible.append(ji2)

            eligible.sort(key=lambda ji2: (
                jobs[ji2]["prioridad"],
                jobs[ji2]["llegada"],
                jobs[ji2]["id"],
            ))

            # Validation logging — PINTURA on 28-05-2026
            if d == target_day and pname == "PINTURA":
                print(f"  [VALIDATE] PINTURA on {calendar[d]}:"
                      f" cap={cap}, active={active}, avail={avail},"
                      f" eligible={len(eligible)}")
                for wji in sorted(watch_ji, key=lambda x: jobs[x].get("ot", "")):
                    wj   = jobs[wji]
                    wot  = wj.get("ot", "?")
                    wti  = 0
                    while wti < len(job_tasks[wji]) and (wji, wti) in scheduled:
                        wti += 1
                    if wti >= len(job_tasks[wji]):
                        wreason = "already finished"
                    elif job_tasks[wji][wti]["proceso"] != pname:
                        wreason = f"next process={job_tasks[wji][wti]['proceso']}"
                    elif llegada_days[wji] > d:
                        wreason = f"not arrived (llegada day {llegada_days[wji]} > {d})"
                    elif (delayed_min_start and wji in delayed_min_start
                          and wti == first_delayed_ti.get(wji, 0)
                          and d < delayed_min_start[wji]):
                        wreason = f"buffer delay (min day {delayed_min_start[wji]} > {d})"
                    elif wti > 0:
                        ps3 = scheduled.get((wji, wti - 1))
                        if ps3 is None or ps3[1] > d:
                            wreason = (f"predecessor ends day "
                                       f"{ps3[1] if ps3 else 'unscheduled'} > {d}")
                        else:
                            wreason = "ELIGIBLE"
                    else:
                        wreason = "ELIGIBLE"
                    if wreason == "ELIGIBLE":
                        rank = eligible.index(wji) if wji in eligible else -1
                        wreason += (f" rank={rank + 1}"
                                    + (" → ASSIGNED" if 0 <= rank < avail
                                       else " → capacity full"))
                    print(f"    OT {wot} (P{wj['prioridad']}): {wreason}")

            if avail <= 0:
                continue

            # Assign available slots in priority order (no idle capacity)
            for ji2 in eligible[:avail]:
                jtasks2 = job_tasks[ji2]
                ti = 0
                while ti < len(jtasks2) and (ji2, ti) in scheduled:
                    ti += 1
                dur = jtasks2[ti]["duration"]
                scheduled[(ji2, ti)] = (d, d + dur)

    return scheduled


# ---------------------------------------------------------------------------
# Main
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
    # Load ALL existing days regardless of used_in_planning status.
    # The status field is informational only — a day should be included in
    # every planning run as long as it exists in the table.
    cur.execute("SELECT id, date FROM special_working_day")
    special_rows = cur.fetchall()

    special_days: set = set()
    for row in special_rows:
        d = to_date(row["date"])
        if d:
            special_days.add(d)

    if special_days:
        print(f"  Special working days loaded: {sorted(special_days)}")

    # --- Load buffer history (delta-based) ---
    # Reads the full change log from planning_buffer_adjustment.
    # Each row is one incremental change: delta_days = new_total - prev_total.
    #
    # The planner applies each delta from its own registration date so that
    # changing buffer from -2 to -3 adds only 1 more day of delay from the
    # change date, not 3 days from scratch.  Multiple changes accumulate:
    #
    #   delta(-2, D1) → effective min_start ≥ D1 + 2
    #   delta(-1, D2) → effective min_start ≥ max(D1+2, D2+1) = D2+1 (if D2>D1)
    #   delta(+2, D3) → effective min_start reduced by 2 (recovery)
    cur.execute("""
        SELECT sales_planning_id, delta_days, created_at
        FROM planning_buffer_adjustment
        WHERE delta_days IS NOT NULL
        ORDER BY created_at ASC
    """)
    buf_hist_rows = cur.fetchall()

    # Per-job delta history: job_id -> [(delta_days, date), ...] ASC
    buffer_history: dict = {}
    for row in buf_hist_rows:
        jid   = row["sales_planning_id"]
        d     = to_date(row["created_at"])
        delta = row["delta_days"]
        if jid and d and delta is not None:
            if jid not in buffer_history:
                buffer_history[jid] = []
            buffer_history[jid].append((int(delta), d))

    # Accumulated total per job (used for job["buffer"] eligibility check and log)
    buffer_total_map: dict = {
        jid: sum(dlt for dlt, _ in hist)
        for jid, hist in buffer_history.items()
    }

    if buffer_total_map:
        print(f"  Buffer history loaded: {len(buffer_total_map)} jobs with adjustments")

    # --- Load jobs ---
    cur.execute("""
        SELECT id, ot, codigo_plazo, llegada, prioridad, atraso
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
            "ot":           str(j["ot"]).strip() if j["ot"] is not None else "",
            "codigo_plazo": str(j["codigo_plazo"]).strip(),
            "llegada":      llegada_date,
            "prioridad":    int(j["prioridad"]) if j["prioridad"] else 5,
            "atraso":       int(j["atraso"])    if j["atraso"]    else 0,
            "buffer":       buffer_total_map.get(j["id"], 0),
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

    # --- Load previous run's process schedules (for buffer freeze logic) ---
    # We use the ACTUAL previous run's optimized_process_schedule to determine
    # which tasks a buffered job had completed before its buffer date.
    # A hypothetical fresh base dispatch is wrong: it re-schedules all jobs from
    # scratch under current conditions, so the resulting dates can differ from
    # the PREVIOUS run's actual dates, causing tasks that genuinely ran on
    # e.g. 08-06 to be missed by the freeze check.
    prev_run_id = active_run["id"] if active_run else None
    prev_process_sched: dict = {}  # job_id -> {proceso: start_date (Python date)}
    if prev_run_id:
        cur.execute("""
            SELECT sales_planning_id, proceso, start_date
            FROM optimized_process_schedule
            WHERE planning_run_id = %s
        """, (prev_run_id,))
        for row in cur.fetchall():
            jid = row["sales_planning_id"]
            if jid not in prev_process_sched:
                prev_process_sched[jid] = {}
            prev_process_sched[jid][row["proceso"]] = to_date(row["start_date"])

    # --- Compute buffer constraints from delta history ---
    # For each job with a non-zero accumulated negative buffer:
    #   • effective_min_start is computed by applying each delta from its own date.
    #   • Tasks that started BEFORE buf_at in the previous run are frozen at their
    #     actual previous-run dates (pre_scheduled). They are not re-planned.
    #   • The first task that started ON or AFTER buf_at (or has no previous record)
    #     is the first "pending" task; it cannot start before delay_end_day.
    pre_scheduled:     dict = {}
    delayed_min_start: dict = {}
    end_date_floor:    dict = {}

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        job_id  = job["id"]
        history = buffer_history.get(job_id)

        if not history or not tasks:
            continue

        buf_total = job["buffer"]  # accumulated sum of all deltas

        # Compute effective min_start by processing each delta in chronological order.
        effective_min_start = 0
        for (delta_i, at_i) in history:  # already sorted ASC by created_at
            at_day_i = date_to_workday(at_i, calendar, date_index)
            if delta_i < 0:
                # Delay: this change adds |delta| workdays of constraint from at_i
                candidate = at_day_i + abs(delta_i)
                effective_min_start = max(effective_min_start, candidate)
            elif delta_i > 0:
                # Recovery: reduce accumulated constraint by delta workdays
                effective_min_start = max(0, effective_min_start - delta_i)

        # No effective delay → skip.
        # Also skip if the net accumulated buffer is non-negative (full recovery).
        if effective_min_start <= 0 or buf_total >= 0:
            continue

        # latest_at = date of the most recent buffer change (freeze boundary).
        # Tasks that started BEFORE this date in the previous run are frozen.
        # Tasks starting ON this date or later are "pending" (subject to delay).
        latest_at     = history[-1][1]
        buf_at_day    = date_to_workday(latest_at, calendar, date_index)
        delay_end_day = max(effective_min_start, buf_at_day)

        prev_job_sched = prev_process_sched.get(job_id, {})  # {proceso: start_date}

        first_pending_ti = None
        for ti, task in enumerate(tasks):
            pname           = task["proceso"]
            prev_start_date = prev_job_sched.get(pname)

            if prev_start_date is not None and prev_start_date < latest_at:
                # Task started before buf_at in the previous run → freeze it.
                prev_start_day = date_to_workday(prev_start_date, calendar, date_index)
                pre_scheduled[(ji, ti)] = (prev_start_day, prev_start_day + task["duration"])
            else:
                # No previous record, or started on/after buf_at → first pending.
                first_pending_ti = ti
                break

        if first_pending_ti is not None:
            delayed_min_start[ji] = delay_end_day
            floor_date = workday_to_date(delay_end_day, calendar)
            print(f"  Buffer OT {job['ot']}: frozen {first_pending_ti} task(s), "
                  f"first pending ti={first_pending_ti} "
                  f"({tasks[first_pending_ti]['proceso']}), "
                  f"min_start=day {delay_end_day} ({floor_date}) "
                  f"[total_buf={buf_total:+d}d, {len(history)} change(s)]")
        else:
            # All tasks started before buf_at → floor the end date
            end_date_floor[ji] = workday_to_date(delay_end_day, calendar)
            print(f"  Buffer OT {job['ot']}: all tasks started before buf_at, "
                  f"end_date floored at {end_date_floor[ji]}")

    # --- Actual dispatch (with buffer constraints) ---
    print("Dispatching (finite-capacity daily heuristic)...")
    scheduled = run_dispatch(
        jobs, job_tasks, proc_list, calendar, date_index,
        pre_scheduled=pre_scheduled,
        delayed_min_start=delayed_min_start,
    )

    incomplete = [
        ji for ji, tasks in enumerate(job_tasks)
        if tasks and not all((ji, ti) in scheduled for ti in range(len(tasks)))
    ]
    if incomplete:
        cur.execute("""
            UPDATE planning_run SET status = 'ACTIVE'
            WHERE id = (
                SELECT id FROM planning_run WHERE status = 'PREVIOUS'
                ORDER BY created_at DESC LIMIT 1
            )
        """)
        cur.execute("UPDATE planning_run SET status = 'ARCHIVED' WHERE id = %s", (new_run_id,))
        conn.commit()
        for ji in incomplete:
            print(f"  ERROR: Job {jobs[ji]['id'][:8]}… tasks unscheduled (calendar too short?).")
        print("Planning rolled back.")
        conn.close()
        sys.exit(1)

    print(f"Dispatch complete.  {len(jobs)} jobs scheduled.")

    # --- Compute slot assignments per process ---
    proc_task_list: dict = {p["proceso"]: [] for p in proc_list}
    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        for ti, task in enumerate(tasks):
            pname              = task["proceso"]
            start_day, end_day = scheduled[(ji, ti)]
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

            job_start_day  = scheduled[(ji, first_ti)][0]
            job_end_day    = scheduled[(ji, last_ti)][1]
            job_start_date = workday_to_date(job_start_day,   calendar)
            job_end_date   = workday_to_date(job_end_day - 1, calendar)
            if ji in end_date_floor and job_end_date < end_date_floor[ji]:
                job_end_date = end_date_floor[ji]

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
                task_start_day, task_end_day = scheduled[(ji, ti)]
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
            tag = f" | buf={buf:+d}d" if buf != 0 else ""
            if ji in end_date_floor:
                tag += " [floored]"
            print(f"  Job {ji+1}: {job['id'][:8]}… | {job['codigo_plazo']:>4} | "
                  f"{job_start_date} → {job_end_date} | P{job['prioridad']}{tag}")

        # --- Mark ALL special working days as used in this run ---
        # All existing days were loaded and applied to the calendar above.
        # Update every row so planning_run_id reflects the latest run that
        # consumed them, and used_in_planning stays TRUE once set.
        cur.execute("SELECT id FROM special_working_day")
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
