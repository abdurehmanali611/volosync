/** Parse YYYY-MM-DD in local calendar components (not UTC). */
export function parseYmdToDate(ymd: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * Combine a calendar day (YYYY-MM-DD) with the time-of-day of a reference instant.
 *
 * A bare day-picker value is otherwise turned into midnight, so a record's saved
 * timestamp loses the real moment it was created (and `new Date("YYYY-MM-DD")` is
 * parsed as UTC midnight, which displays as an offset hour like 03:00 in UTC+3).
 * Anchoring the chosen day to a real time-of-day keeps both the right date AND a
 * meaningful time.
 */
export function ymdWithTimeOf(ymd: string, reference: Date | string): Date {
  const ref = reference instanceof Date ? reference : new Date(reference);
  const safeRef = Number.isNaN(ref.getTime()) ? new Date() : ref;
  const base = parseYmdToDate(ymd);
  if (!base) return safeRef;
  base.setHours(
    safeRef.getHours(),
    safeRef.getMinutes(),
    safeRef.getSeconds(),
    safeRef.getMilliseconds(),
  );
  return base;
}

/**
 * Timestamp for a brand-new registration/movement: keep the chosen day but stamp the
 * current local time so the "initiation" time reflects when the record was actually made.
 */
export function ymdToRegistrationTimestamp(ymd: string, now: Date = new Date()): Date {
  return ymdWithTimeOf(ymd, now);
}
