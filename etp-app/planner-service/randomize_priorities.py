#!/usr/bin/env python3
"""
randomize_priorities.py
Asigna prioridades ÚNICAS (1..N) a todos los registros de sales_planning.

Orden: mayor score → prioridad 1 (máxima), menor score → prioridad N (mínima).

Scoring:
  Llegada pasada (ya en taller)        : +30
  Llegada próximos 30 días             : +25
  Llegada próximos 31-90 días          : +15
  Llegada lejana (> 90 días)           : +5
  Cliente SCANIA / SALFA               : +15
  Cliente VOLVO / BESALCO / KAUFMANN   : +10
  Código plazo [9,10,16]               : +10
  Código plazo [12,14]                 : +5
  Jitter determinista por OT           : 0-8  (evita empates, reproducible)
"""

import sys
import random
from datetime import datetime, timezone
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("ERROR: pip3 install psycopg2-binary"); sys.exit(1)

SCRIPT_DIR   = Path(__file__).resolve().parent
ENV_PATH     = SCRIPT_DIR.parent / ".env.local"
SEED_USER    = "auto_prioridad_seed"
TODAY        = datetime.now(timezone.utc)

CLIENTES_ALTA  = {"SCANIA", "SALFA"}
CLIENTES_MEDIA = {"VOLVO", "BESALCO", "KAUFMANN"}
CP_ALTO        = {"9", "10", "16"}
CP_MED         = {"12", "14"}

def load_db_url() -> str:
    with open(ENV_PATH) as f:
        for line in f:
            if line.strip().startswith("DATABASE_URL="):
                url = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                return url.replace("%21", "!")
    raise RuntimeError("DATABASE_URL no encontrado")

def score(ot, cliente, llegada_dt, codigo_plazo) -> int:
    pts = 0
    if llegada_dt is not None:
        if llegada_dt.tzinfo is None:
            llegada_dt = llegada_dt.replace(tzinfo=timezone.utc)
        dias = (llegada_dt - TODAY).days
        if dias < 0:    pts += 30
        elif dias <= 30: pts += 25
        elif dias <= 90: pts += 15
        else:            pts += 5
    cu = (cliente or "").upper()
    if any(k in cu for k in CLIENTES_ALTA):   pts += 15
    elif any(k in cu for k in CLIENTES_MEDIA): pts += 10
    cp = str(codigo_plazo) if codigo_plazo else ""
    if cp in CP_ALTO: pts += 10
    elif cp in CP_MED: pts += 5
    pts += random.Random(str(ot)).randint(0, 8)
    return pts

def main():
    print("=" * 60)
    print("  ETP — Prioridades únicas 1..N")
    print("=" * 60)

    conn = psycopg2.connect(load_db_url(), sslmode="require")
    cur  = conn.cursor()

    cur.execute("SELECT id, ot, cliente, llegada, codigo_plazo FROM sales_planning ORDER BY ot")
    rows = cur.fetchall()
    n = len(rows)
    print(f"\n  Registros leídos: {n}")

    # Calcular score y ordenar desc → el de mayor score recibe prioridad 1
    scored = sorted(
        [(score(ot, cli, ll, cp), rid, ot, cli) for rid, ot, cli, ll, cp in rows],
        key=lambda x: -x[0]
    )

    # Asignar prioridades únicas 1..N
    now = datetime.now(timezone.utc)
    updates = []
    for rank, (pts, rid, ot, cli) in enumerate(scored, start=1):
        updates.append((rank, SEED_USER, now, rid, ot, cli, pts))

    for rank, seed_user, ts, rid, ot, cli, pts in updates:
        cur.execute(
            "UPDATE sales_planning SET prioridad=%s, updated_by=%s, updated_at=%s WHERE id=%s",
            (rank, seed_user, ts, rid)
        )
    conn.commit()

    # Validar en DB
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT prioridad), MIN(prioridad), MAX(prioridad) FROM sales_planning")
    total, distintas, pmin, pmax = cur.fetchone()
    cur.execute("SELECT COUNT(*) FROM sales_planning WHERE prioridad IS NULL")
    nulls = cur.fetchone()[0]
    cur.execute("""
        SELECT prioridad, COUNT(*) FROM sales_planning
        GROUP BY prioridad HAVING COUNT(*) > 1
    """)
    duplicados = cur.fetchall()

    cur.close()
    conn.close()

    # Resumen
    print()
    print("=" * 60)
    print("  RESUMEN")
    print("=" * 60)
    print(f"  Registros actualizados : {n}")
    print(f"  Prioridad mínima       : {pmin}")
    print(f"  Prioridad máxima       : {pmax}")
    print(f"  Prioridades distintas  : {distintas}")
    print(f"  Duplicados             : {'NINGUNO ✅' if not duplicados else str(duplicados)}")
    print(f"  Nulos                  : {'NINGUNO ✅' if nulls == 0 else nulls}")
    print()
    print("  Top 10 prioridad más alta:")
    for rank, seed_user, ts, rid, ot, cli, pts in updates[:10]:
        print(f"    P{rank:>2}  OT {ot}  cliente={cli!r}  score={pts}")

    print()
    print("  ✅ Refrescar la app en http://localhost:3000")
    print("=" * 60)

if __name__ == "__main__":
    main()
