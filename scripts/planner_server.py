#!/usr/bin/env python3
"""
ETP Planner Microservice — v2
========================
Flask server that runs planner.py on demand.
Deploy to Railway with the variables below.

Required env vars:
  PLANNER_SERVICE_TOKEN  — shared secret; requests without it are rejected
  DATABASE_URL           — Supabase PostgreSQL URL (same as in etp-app/.env.local)
  PORT                   — set automatically by Railway

Start command (Railway / gunicorn):
  gunicorn planner_server:app
"""

import os
import subprocess
import sys
from pathlib import Path

from flask import Flask, jsonify, request

app = Flask(__name__)

SCRIPT_DIR = Path(__file__).resolve().parent
PLANNER_PY = SCRIPT_DIR / "planner.py"
TOKEN      = os.environ.get("PLANNER_SERVICE_TOKEN", "")
PORT       = int(os.environ.get("PORT", 5001))


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _authorized() -> bool:
    if not TOKEN:
        return False
    auth = request.headers.get("Authorization", "")
    return auth == f"Bearer {TOKEN}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    """Public health check — no auth required."""
    return jsonify({
        "status":         "ok",
        "planner_exists": PLANNER_PY.exists(),
        "planner_path":   str(PLANNER_PY),
        "python":         sys.version,
    })


@app.route("/run", methods=["POST"])
def run_planner():
    """
    Trigger a full planning run.
    Protected by Bearer token (PLANNER_SERVICE_TOKEN).

    Returns JSON:
      { success, exit_code, stdout, stderr }   on success / planner failure
      { error }                                 on auth or config error
    """
    if not _authorized():
        return jsonify({"error": "Unauthorized"}), 401

    if not PLANNER_PY.exists():
        return jsonify({
            "success":   False,
            "error":     f"planner.py not found at {PLANNER_PY}",
            "exit_code": -1,
            "stdout":    "",
            "stderr":    "",
        }), 500

    try:
        result = subprocess.run(
            [sys.executable, str(PLANNER_PY)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        ok = result.returncode == 0
        return jsonify({
            "success":   ok,
            "exit_code": result.returncode,
            "stdout":    result.stdout,
            "stderr":    result.stderr,
        }), 200 if ok else 500

    except subprocess.TimeoutExpired:
        return jsonify({
            "success":   False,
            "error":     "Planner timed out (120 s)",
            "exit_code": -1,
            "stdout":    "",
            "stderr":    "",
        }), 500

    except Exception as exc:
        return jsonify({
            "success":   False,
            "error":     str(exc),
            "exit_code": -1,
            "stdout":    "",
            "stderr":    "",
        }), 500


# ---------------------------------------------------------------------------
# Entry point (dev only — Railway uses gunicorn)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not TOKEN:
        print(
            "WARNING: PLANNER_SERVICE_TOKEN is not set — every request will be rejected.",
            file=sys.stderr,
        )
    print(f"Starting ETP Planner server on port {PORT} …")
    app.run(host="0.0.0.0", port=PORT, debug=False)
