import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date value as DD/MM/YYYY without any timezone conversion.
 *
 * Dates stored by the Python planner are pure calendar dates (YYYY-MM-DD).
 * Prisma/SQLite represent them as UTC midnight (2025-10-13T00:00:00.000Z).
 * Using `new Date(d).toLocaleDateString()` in a browser shifts UTC midnight
 * to local time and can display the previous day in UTC-offset timezones.
 *
 * This function always reads the ISO date characters directly (slice 0–10)
 * so the displayed date matches the stored calendar date regardless of
 * server or browser timezone.
 */
export function fmtDate(d: Date | string | null | undefined, fallback = "—"): string {
  if (!d) return fallback;
  const iso = typeof d === "string" ? d : d.toISOString();
  const datePart = iso.slice(0, 10); // "YYYY-MM-DD"
  const [y, m, day] = datePart.split("-").map(Number);
  if (!y || !m || !day) return fallback;
  return `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
