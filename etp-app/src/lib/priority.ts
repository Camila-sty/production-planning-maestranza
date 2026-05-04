/**
 * Priority color scale — semaphore logic
 *
 * P1–P2  → RED    (critical — must ship first)
 * P3     → ORANGE (urgent)
 * P4–P5  → AMBER  (normal planning)
 * P6+    → GRAY   (low urgency / backlog)
 *
 * Lower prioridad number = higher importance (same convention as CP-SAT planner).
 */

/** Full classes for an outline badge (text + border). */
export function priorityBadgeClass(p: number): string {
  if (p <= 2) return "text-red-400 border-red-700";
  if (p === 3) return "text-orange-400 border-orange-700";
  if (p <= 5) return "text-amber-400 border-amber-700";
  return "text-zinc-400 border-zinc-600";
}

/** Text-only class for plain (no-border) priority display. */
export function priorityTextClass(p: number): string {
  if (p <= 2) return "text-red-400";
  if (p === 3) return "text-orange-400";
  if (p <= 5) return "text-amber-400";
  return "text-zinc-400";
}
