#!/usr/bin/env python3
"""
CP-SAT Planning Engine for ETP Maestranza — v5 (INICIO-based dispatch)

Changes from v4:
  - Eligibility: uses campo INICIO (not LLEGADA) as minimum start date
  - LLEGADA is now informational only — never used for dispatch logic
  - Variable renamed: llegada_days → inicio_days (avoids llegada confusion)
  - Priority cap removed: accepts any integer >= 1

Eligibility for planning:
  - requires: codigo_plazo, inicio, prioridad
  - llegada is informational only
  - atraso defaults to 0 if null
"""

PLANNER_VERSION = "6"

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
ENV_PATH     = SCRIPT_DIR.parent / ".env.local"


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
         arrived (inicio ≤ today), predecessor finished at or before today.
      3. Sort eligible: prioridad ASC, inicio ASC, id ASC.
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
    inicio_days  = [
        date_to_workday(j["inicio"], calendar, date_index) for j in jobs
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
                if inicio_days[ji2] > d:
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
                jobs[ji2]["inicio"],
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
                    elif inicio_days[wji] > d:
                        wreason = f"not arrived (inicio day {inicio_days[wji]} > {d})"
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
    print(f"=== ETP Planner v{PLANNER_VERSION} — eligibility: INICIO + entregado=FALSE ===")
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

    # --- Load buffer settings (total + first-ever registration date) ---
    #
    # Two values drive the buffer constraint:
    #
    #   buf_days     = planning_buffer_days  (current accumulated total, e.g. -3)
    #   first_buf_at = MIN(created_at) across all planning_buffer_adjustment rows
    #                  for this OT — i.e. the date the FIRST buffer was ever set.
    #                  Falls back to planning_buffer_at if no history row exists.
    #
    # Using first_buf_at (not planning_buffer_at which changes on every edit)
    # makes the constraint stable and non-compounding:
    #   min_start = workday(first_buf_at) + abs(buf_days)
    #
    # When the admin changes buffer from -2 to -3, first_buf_at stays fixed
    # (still the original 09-06), and abs(buf_days) grows from 2 to 3, so
    # min_start moves exactly 1 working day forward — not 3 days from scratch.
    # Re-planning with the same buffer values always gives the same min_start.
    cur.execute("""
        SELECT sp.id,
               sp.planning_buffer_days,
               sp.planning_buffer_at,
               MIN(pba.created_at) AS first_buf_at
        FROM sales_planning sp
        LEFT JOIN planning_buffer_adjustment pba
               ON pba.sales_planning_id = sp.id
        WHERE sp.planning_buffer_days IS NOT NULL
          AND sp.planning_buffer_days < 0
          AND sp.planning_buffer_at  IS NOT NULL
        GROUP BY sp.id, sp.planning_buffer_days, sp.planning_buffer_at
    """)
    buffer_settings: dict = {}  # job_id -> (buf_days int, first_buf_at date)
    for row in cur.fetchall():
        first_buf_at = to_date(row["first_buf_at"]) or to_date(row["planning_buffer_at"])
        if first_buf_at:
            buffer_settings[row["id"]] = (int(row["planning_buffer_days"]), first_buf_at)

    if buffer_settings:
        print(f"  Buffer settings loaded: {len(buffer_settings)} OTs with negative buffer")

    # --- Load jobs ---
    cur.execute("""
        SELECT id, ot, codigo_plazo, llegada, inicio, prioridad, atraso
        FROM sales_planning
        WHERE codigo_plazo IS NOT NULL
          AND inicio     IS NOT NULL
          AND prioridad  IS NOT NULL
          AND entregado  = FALSE
    """)
    jobs_raw = cur.fetchall()

    jobs = []
    for j in jobs_raw:
        inicio_date = to_date(j["inicio"])
        if not inicio_date:
            print(f"  Skipping job {j['id']}: invalid inicio '{j['inicio']}'")
            continue
        buf_setting = buffer_settings.get(j["id"], (0, None))
        jobs.append({
            "id":           j["id"],
            "ot":           str(j["ot"]).strip() if j["ot"] is not None else "",
            "codigo_plazo": str(j["codigo_plazo"]).strip(),
            "llegada":      to_date(j["llegada"]),  # informational only
            "inicio":       inicio_date,
            "prioridad":    int(j["prioridad"]) if j["prioridad"] else 5,
            "atraso":       int(j["atraso"])    if j["atraso"]    else 0,
            "buffer":       buf_setting[0],
            "buffer_at":    buf_setting[1],
        })

    cur.execute(
        "SELECT COUNT(*) as c FROM sales_planning WHERE codigo_plazo IS NOT NULL AND prioridad IS NOT NULL"
    )
    total_records = cur.fetchone()["c"]
    excluded_count = total_records - len(jobs)
    if excluded_count > 0:
        print(f"  Excluded {excluded_count} record(s) without inicio from planning")


    if not jobs:
        print("No plannable jobs found (need codigo_plazo + inicio + prioridad).")
        conn.close()
        return

    # Debug: log key fields for OT 2455 to verify correct field usage
    for _j in jobs:
        if _j.get("ot") == "2455":
            print(f"  [DEBUG OT 2455] llegada={_j['llegada']}  inicio={_j['inicio']}  "
                  f"earliest_dispatch=inicio  buffer={_j['buffer']:+d}d")

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
    min_inicio = min(j["inicio"] for j in jobs)
    ref_date   = min_inicio - timedelta(days=min_inicio.weekday())

    max_sum_dur        = max((sum(t["duration"] for t in tasks) for tasks in job_tasks if tasks), default=100)
    max_inicio_offset  = max((j["inicio"] - ref_date).days for j in jobs)
    HORIZON            = max_inicio_offset + max_sum_dur * 3 + 300

    calendar   = build_working_calendar(ref_date, HORIZON, special_days)
    date_index = build_date_index(calendar)
    CAL_SIZE   = len(calendar)

    print(f"Jobs: {len(jobs)}  |  Processes: {len(proc_list)}  |  Calendar size: {CAL_SIZE} working days")
    print(f"Reference date: {ref_date}")

    # --- Load baseline process schedules (for buffer freeze/delay) ---
    #
    # We need the schedule from the run that was active JUST BEFORE first_buf_at
    # (the date the buffer was first ever registered for each OT).
    # Using this as the baseline guarantees:
    #   - Freeze: processes that started before first_buf_at stay at their
    #             pre-buffer dates regardless of how many times we re-plan.
    #   - Delay:  min_start = baseline_pending_start + abs(buf_days) is stable —
    #             re-planning with the same buffer always yields the same min_start
    #             because the baseline never changes.
    #
    # Query: for each buffered OT, find the most recent schedule per process from
    # runs created STRICTLY BEFORE first_buf_at (i.e. the pre-buffer baseline).
    # Falls back to the most recent run overall if nothing pre-dates first_buf_at
    # (handles new OTs or edge cases where the baseline run was cleaned up).
    prev_process_sched: dict = {}  # job_id -> {proceso: start_date (Python date)}
    if buffer_settings:
        buf_job_ids = list(buffer_settings.keys())
        # Primary: most recent schedule per (OT, proceso) from runs before first_buf_at
        cur.execute("""
            SELECT DISTINCT ON (ops.sales_planning_id, ops.proceso)
                ops.sales_planning_id,
                ops.proceso,
                ops.start_date
            FROM optimized_process_schedule ops
            JOIN planning_run pr ON ops.planning_run_id = pr.id
            JOIN (
                SELECT sp.id AS sp_id,
                       MIN(pba.created_at) AS first_buf_at
                FROM sales_planning sp
                JOIN planning_buffer_adjustment pba
                       ON pba.sales_planning_id = sp.id
                WHERE sp.id = ANY(%s)
                GROUP BY sp.id
            ) buf ON ops.sales_planning_id = buf.sp_id
            WHERE pr.created_at < buf.first_buf_at
              AND ops.planning_run_id != %s
            ORDER BY ops.sales_planning_id, ops.proceso, pr.created_at DESC
        """, (buf_job_ids, new_run_id))
        for row in cur.fetchall():
            jid = row["sales_planning_id"]
            if jid not in prev_process_sched:
                prev_process_sched[jid] = {}
            prev_process_sched[jid][row["proceso"]] = to_date(row["start_date"])

        # Fallback: for OTs with no pre-buffer baseline, use the most recent run overall
        missing = [jid for jid in buf_job_ids if jid not in prev_process_sched]
        if missing:
            cur.execute("""
                SELECT DISTINCT ON (ops.sales_planning_id, ops.proceso)
                    ops.sales_planning_id,
                    ops.proceso,
                    ops.start_date
                FROM optimized_process_schedule ops
                JOIN planning_run pr ON ops.planning_run_id = pr.id
                WHERE ops.sales_planning_id = ANY(%s)
                  AND ops.planning_run_id   != %s
                ORDER BY ops.sales_planning_id, ops.proceso, pr.created_at DESC
            """, (missing, new_run_id))
            for row in cur.fetchall():
                jid = row["sales_planning_id"]
                if jid not in prev_process_sched:
                    prev_process_sched[jid] = {}
                prev_process_sched[jid][row["proceso"]] = to_date(row["start_date"])

    # --- Compute buffer constraints ---
    #
    # For each OT with negative planning_buffer_days:
    #
    #   Part A — Freeze completed tramo (processes that FINISH before first_buf_at)
    #     A process is frozen only if ALL its working days fall before first_buf_at,
    #     i.e. prev_end_day (exclusive) <= first_buf_at_day.
    #
    #     A process that STARTS before first_buf_at but EXTENDS INTO it is NOT
    #     frozen — it belongs to the pending tramo and will be shifted forward.
    #     This correctly handles tasks like TERMINACIONES starting 08-06 that run
    #     through 09-06, 10-06, 11-06 (all shift-able days).
    #
    #   Part B — Shift pending tramo from first_buf_at
    #     All tasks from the first pending process onward are constrained to start
    #     no earlier than:
    #
    #       min_start = workday(first_buf_at) + abs(planning_buffer_days)
    #
    #     This shifts the entire pending calendar by exactly abs(buf_days) workdays
    #     from the buffer anchor date.  The formula is stable and non-compounding:
    #     first_buf_at is always the oldest adjustment record, so re-planning with
    #     the same buffer always yields the same min_start regardless of which run
    #     the dispatcher produced last time.
    #
    #     delta semantics:
    #       buffer -2 → -3 : first_buf_at stays, abs grows → min_start +1 day ✓
    #       buffer -3 → -1 : first_buf_at stays, abs shrinks → min_start -2 days ✓
    #       re-plan same buf: same first_buf_at + same abs → same min_start ✓
    #
    pre_scheduled:        dict = {}
    delayed_min_start:    dict = {}
    end_date_floor:       dict = {}
    straddling_completed: dict = {}  # (ji,ti) -> (comp_start_day, comp_end_day_excl)

    for ji, (job, tasks) in enumerate(zip(jobs, job_tasks)):
        buf_days     = job["buffer"]    # total accumulated (e.g. -3)
        first_buf_at = job["buffer_at"] # oldest adjustment date (shift anchor)

        if buf_days >= 0 or first_buf_at is None or not tasks:
            continue

        first_buf_at_day = date_to_workday(first_buf_at, calendar, date_index)
        # Part B anchor: every pending process must start at or after this day.
        min_start_day = first_buf_at_day + abs(buf_days)

        prev_job_sched = prev_process_sched.get(job["id"], {})  # {proceso: start_date}

        # Part A: walk tasks in order; freeze only those that finish before first_buf_at.
        # IMPORTANT: baseline dates may predate `inicio` (e.g. when the field was changed
        # from llegada to a later date after the original plan was generated).  We clamp
        # each baseline start to max(baseline_start, inicio) so that no frozen task is
        # ever placed before the job's minimum start date.
        inicio_day       = date_to_workday(job["inicio"], calendar, date_index)
        first_pending_ti = None
        for ti, task in enumerate(tasks):
            prev_start = prev_job_sched.get(task["proceso"])
            if prev_start is not None:
                raw_start_day     = date_to_workday(prev_start, calendar, date_index)
                # Clamp: never freeze a task before inicio even if baseline predates it.
                prev_start_day    = max(raw_start_day, inicio_day)
                prev_end_day_excl = prev_start_day + task["duration"]  # exclusive end
                if prev_end_day_excl <= first_buf_at_day:
                    # Entire process completes before buffer anchor → freeze it.
                    pre_scheduled[(ji, ti)] = (prev_start_day, prev_end_day_excl)
                    if job["ot"] == "2455":
                        print(f"    [DEBUG OT 2455] freeze {task['proceso']}: "
                              f"raw_start={workday_to_date(raw_start_day, calendar)} "
                              f"clamped_start={workday_to_date(prev_start_day, calendar)} "
                              f"(inicio={job['inicio']})")
                    continue  # keep evaluating subsequent tasks
                if prev_start_day < first_buf_at_day:
                    # Process started before buffer_at but extends into it (straddles).
                    # Freeze only the completed days; schedule only the remaining days.
                    completed = first_buf_at_day - prev_start_day  # days already done
                    remaining = task["duration"] - completed
                    if remaining > 0:
                        straddling_completed[(ji, ti)] = (prev_start_day,
                                                          prev_start_day + completed)
                        task["duration"] = remaining  # dispatch only remaining days
            # Process starts on/after buffer_at, straddles, or has no prev data → pending.
            first_pending_ti = ti
            break

        # Part B: apply shift constraint to pending tramo.
        if first_pending_ti is not None:
            delayed_min_start[ji] = min_start_day
            floor_date = workday_to_date(min_start_day, calendar)
            print(f"  Buffer OT {job['ot']}: frozen {first_pending_ti} task(s), "
                  f"first pending: {tasks[first_pending_ti]['proceso']}, "
                  f"min_start={floor_date} "
                  f"[buf={buf_days:+d}d, first_buf_at={first_buf_at}]")
        else:
            # All processes finish before first_buf_at → nothing to shift in the
            # dispatch; floor the reported end_date so the UI reflects the delay.
            end_date_floor[ji] = workday_to_date(min_start_day, calendar)
            print(f"  Buffer OT {job['ot']}: all processes finish before first_buf_at, "
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

    # Debug: verify OT 2455 first-process start
    for ji, job in enumerate(jobs):
        if job.get("ot") == "2455" and job_tasks[ji]:
            first_start_day = scheduled[(ji, 0)][0]
            first_date      = workday_to_date(first_start_day, calendar)
            print(f"  [DEBUG OT 2455] first process start_date={first_date}  "
                  f"(must be >= inicio={job['inicio']})")

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
            # If the very first task straddles buffer_at, its historical start
            # (the completed portion) is earlier than the dispatched start.
            if (ji, first_ti) in straddling_completed:
                job_start_day = min(job_start_day, straddling_completed[(ji, first_ti)][0])
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

                # If this task straddles buffer_at, write the completed portion first
                # (the days already worked before buffer_at) as a separate DB row.
                if (ji, ti) in straddling_completed:
                    cs_day, ce_day = straddling_completed[(ji, ti)]
                    comp_id = f"ops_{new_run_id[-8:]}_{job['id'][:10]}_{ji}_{ti}_c"
                    cur.execute("""
                        INSERT INTO optimized_process_schedule
                            (id, sales_planning_id, planning_run_id, proceso, orden, slot,
                             start_date, end_date, duration_days, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        comp_id, job["id"], new_run_id,
                        task["proceso"], task["orden"], slot,
                        workday_to_date(cs_day, calendar).isoformat(),
                        workday_to_date(ce_day - 1, calendar).isoformat(),
                        ce_day - cs_day, now,
                    ))

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
