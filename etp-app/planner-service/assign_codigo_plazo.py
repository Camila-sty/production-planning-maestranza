#!/usr/bin/env python3
"""
assign_codigo_plazo.py
Asigna codigo_plazo a registros de sales_planning con ese campo null/vacío.

Reglas basadas en equipo + modelo_capacidad (texto normalizado a mayúsculas sin tildes).

Tabla de referencia lead_time_by_code:
  1  Aljibe 10 m3
  2  Aljibes 15-30 m3
  3  Alzahombre
  4  Atmosferico basico
  5  Atmosférico full
  6  Carroceria
  7  Clinicas
  8  Combustible basico
  9  Combustible alto flujo
  10 Combustible med flujo
  11 Compactador
  12 Lubricador cerrado
  13 Lubricador chico y abierto
  14 Lubricador mediano y abierto
  15 Polibrazo
  16 Tolvas 15 m3 a 25 mineras
  17 Tolvas 4-15 m3 aridos
"""

import sys
import re
from datetime import datetime, timezone
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("ERROR: pip3 install psycopg2-binary")
    sys.exit(1)

# ─── Rutas ────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH     = SCRIPT_DIR.parent / ".env.local"
SEED_USER    = "auto_codigo_plazo_seed"

def load_db_url() -> str:
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                return url.replace("%21", "!")
    raise RuntimeError("DATABASE_URL no encontrado en .env.local")

# ─── Normalización de texto ───────────────────────────────────────────────────
_TILDE_MAP = str.maketrans("áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜ",
                            "aeiouaeiouaeiouAEIOUAEIOUAEIOU")

def norm(v: "str | None") -> str:
    """Mayúsculas, sin tildes, espacios colapsados."""
    if not v:
        return ""
    return v.translate(_TILDE_MAP).upper().strip()

def has(text: str, *terms: str) -> bool:
    return any(t in text for t in terms)

# ─── Reglas de asignación ─────────────────────────────────────────────────────
def assign(equipo: "str|None", modelo_cap: "str|None", modelo: "str|None") -> "str|None":
    eq  = norm(equipo)
    mc  = norm(modelo_cap)
    mdl = norm(modelo)
    combined = f"{eq} {mc} {mdl}"

    # ── ALJIBE ────────────────────────────────────────────────────────────────
    if has(eq, "ALJIBE"):
        # Buscar número de m3 explícito
        m = re.search(r'(\d+)\s*M', mc)
        if m:
            vol = int(m.group(1))
            return "1" if vol <= 10 else "2"
        return "2"  # default a 15-30 si no hay dato

    # ── MIXTO con aljibe ──────────────────────────────────────────────────────
    if eq == "MIXTO" and has(mc, "ALJIBE"):
        m = re.search(r'(\d+)\s*M', mc)
        vol = int(m.group(1)) if m else 99
        return "1" if vol <= 10 else "2"

    # ── COMBUSTIBLE ───────────────────────────────────────────────────────────
    if has(eq, "COMBUSTIBLE"):
        if has(mc, "ALTO FLUJO"):
            return "9"
        if has(mc, "MEDIANO FLUJO", "MED FLUJO"):
            return "10"
        if has(mc, "BASICO", "BÁSICO"):
            return "8"
        # ADBLUE: determinar por volumen principal
        if has(mc, "ADBLUE"):
            m = re.search(r'(\d+)\s*M', mc)
            vol = int(m.group(1)) if m else 0
            if vol >= 15:
                return "9"   # 18m³ + ADBLUE → alto flujo
            return "8"       # 9m³ + ADBLUE → básico
        # Por volumen sin etiqueta de flujo
        m = re.search(r'(\d+)\s*M', mc)
        if m:
            vol = int(m.group(1))
            if vol >= 18:
                return "9"
            if vol >= 15:
                return "10"
        return "8"           # default básico

    # ── TOLVA ─────────────────────────────────────────────────────────────────
    if has(eq, "TOLVA"):
        if has(mc, "MINERA", "MINERO"):
            return "16"
        m = re.search(r'(\d+)\s*M', mc)
        if m:
            vol = int(m.group(1))
            if vol > 15:
                return "16"  # 15-25 m3 mineras
            return "17"      # 4-15 m3 áridos
        return "16"          # default

    # ── LUBRICADOR ────────────────────────────────────────────────────────────
    if has(eq, "LUBRICADOR"):
        if has(mc, "CERRADO") or (has(mc, "FURGON") and not has(mc, "MIXTO", "ABIERTO")):
            return "12"
        if has(mc, "ABIERTO", "MIXTO"):
            # chico vs mediano por volumen
            m = re.search(r'(\d+)\s*M', mc)
            vol = int(m.group(1)) if m else 0
            if vol <= 2:
                return "13"   # chico y abierto
            return "14"       # mediano y abierto
        if has(mc, "FURGON"):
            return "12"
        return "14"           # default mediano

    # ── CARROCERIA ────────────────────────────────────────────────────────────
    if has(eq, "CARROCERIA", "CARROCERÍA"):
        return "6"

    # ── COMPACTADOR ───────────────────────────────────────────────────────────
    if has(eq, "COMPACTADOR"):
        return "11"

    # ── POLIBRAZO ─────────────────────────────────────────────────────────────
    if has(eq, "POLIBRAZO"):
        return "15"

    # ── CLINICA ───────────────────────────────────────────────────────────────
    if has(eq, "CLINICA", "CLÍNICA"):
        return "7"

    # ── ALZAHOMBRE ────────────────────────────────────────────────────────────
    if has(eq, "ALZAHOMBRE"):
        return "3"

    # ── ATMOSFERICO ───────────────────────────────────────────────────────────
    if has(eq, "ATMOSFERICO", "ATMOSFÉRICO"):
        if has(eq, mc, "FULL"):
            return "5"
        return "4"

    # ── No identificado ───────────────────────────────────────────────────────
    return None

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  ETP — Asignación automática de codigo_plazo")
    print("=" * 60)

    conn = psycopg2.connect(load_db_url(), sslmode="require")
    cur  = conn.cursor()

    # Leer registros con codigo_plazo null
    cur.execute("""
        SELECT id, ot, equipo, modelo_capacidad, modelo
        FROM sales_planning
        WHERE codigo_plazo IS NULL OR codigo_plazo = ''
        ORDER BY ot
    """)
    rows = cur.fetchall()
    print(f"\n  Registros con codigo_plazo vacío: {len(rows)}")

    assigned     = []
    unassigned   = []
    distribution = {}

    for row_id, ot, equipo, modelo_cap, modelo in rows:
        codigo = assign(equipo, modelo_cap, modelo)
        if codigo:
            assigned.append((row_id, ot, equipo, modelo_cap, codigo))
            distribution[codigo] = distribution.get(codigo, 0) + 1
        else:
            unassigned.append((ot, equipo, modelo_cap))

    print(f"  Asignables:   {len(assigned)}")
    print(f"  Sin asignar:  {len(unassigned)}")

    # Actualizar en DB
    now = datetime.now(timezone.utc)
    updated = 0
    for row_id, ot, equipo, modelo_cap, codigo in assigned:
        cur.execute("""
            UPDATE sales_planning
            SET codigo_plazo = %s,
                updated_by   = %s,
                updated_at   = %s
            WHERE id = %s
        """, (codigo, SEED_USER, now, row_id))
        updated += 1

    conn.commit()

    # ── Resumen ───────────────────────────────────────────────────────────────
    NOMBRES = {
        "1":  "Aljibe 10 m3",
        "2":  "Aljibes 15-30 m3",
        "3":  "Alzahombre",
        "4":  "Atmosferico basico",
        "5":  "Atmosférico full",
        "6":  "Carroceria",
        "7":  "Clinicas",
        "8":  "Combustible basico",
        "9":  "Combustible alto flujo",
        "10": "Combustible med flujo",
        "11": "Compactador",
        "12": "Lubricador cerrado",
        "13": "Lubricador chico y abierto",
        "14": "Lubricador mediano y abierto",
        "15": "Polibrazo",
        "16": "Tolvas 15m3 a 25 mineras",
        "17": "Tolvas 4-15 m3 aridos",
    }

    print()
    print("=" * 60)
    print("  RESUMEN")
    print("=" * 60)
    print(f"  Total revisados:   {len(rows)}")
    print(f"  Asignados:         {updated}")
    print(f"  Sin asignar:       {len(unassigned)}")

    print()
    print("  Distribución por codigo_plazo:")
    for codigo in sorted(distribution, key=lambda x: int(x)):
        nombre = NOMBRES.get(codigo, "?")
        print(f"    Código {codigo:>2}  ({nombre:<30}) → {distribution[codigo]} OT(s)")

    if unassigned:
        print()
        print(f"  OTs sin asignar ({len(unassigned)}):")
        for ot, eq, mc in unassigned:
            print(f"    OT {ot}  equipo={eq!r}  modelo_cap={mc!r}")

    print()
    print("  Reglas aplicadas:")
    reglas = [
        "ALJIBE           : vol ≤ 10m³ → 1  |  > 10m³ → 2",
        "MIXTO+ALJIBE     : misma lógica de volumen",
        "COMBUSTIBLE      : ALTO FLUJO → 9  |  MED FLUJO → 10  |  ADBLUE ≥15m³ → 9  |  resto → 8",
        "TOLVA            : > 15m³ o MINERA → 16  |  ≤ 15m³ → 17",
        "LUBRICADOR       : FURGON puro → 12  |  ABIERTO/MIXTO ≤2m³ → 13  |  > 2m³ → 14",
        "CARROCERIA*      : → 6",
        "COMPACTADOR      : → 11",
        "POLIBRAZO*       : → 15",
        "CLINICA*         : → 7",
        "ALZAHOMBRE       : → 3",
        "ATMOSFERICO*FULL : → 5  |  resto → 4",
    ]
    for r in reglas:
        print(f"    {r}")

    print()
    print("  ✅ Refrescar la app en http://localhost:3000")
    print("=" * 60)

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
