/**
 * Payslip month naming from a From–To range.
 * Prefer the month with more days; on a tie, use the earlier (first) month.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function monthDayCountsInRange(
  fromYmd: string,
  toYmd: string,
): Map<string, number> {
  const from = fromYmd.trim();
  const to = toYmd.trim();
  const counts = new Map<string, number>();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return counts;
  }
  if (to < from) return counts;

  const [fy, fm, fd] = from.split("-").map(Number);
  const cursor = new Date(fy, fm - 1, fd);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = new Date(ty, tm - 1, td);

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    cursor.setDate(cursor.getDate() + 1);
  }
  return counts;
}

export function namedMonthFromPayRange(
  fromYmd: string,
  toYmd: string,
): { periodKey: string; monthName: string; dayCount: number } {
  const counts = monthDayCountsInRange(fromYmd, toYmd);
  let bestKey: string | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && (bestKey == null || key < bestKey))
    ) {
      bestKey = key;
      bestCount = count;
    }
  }
  if (!bestKey) {
    bestKey = fromYmd.trim().slice(0, 7) || "0000-01";
    bestCount = 0;
  }
  const monthIndex = Number(bestKey.slice(5, 7)) - 1;
  return {
    periodKey: bestKey,
    monthName: MONTH_NAMES[monthIndex] || bestKey,
    dayCount: bestCount,
  };
}

/** Inclusive calendar days in [fromYmd, toYmd]. */
export function inclusiveDayCount(fromYmd: string, toYmd: string): number {
  const from = fromYmd.trim();
  const to = toYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return 0;
  }
  if (to < from) return 0;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.floor((b - a) / 86400000) + 1;
}

/** Weeks covered by a From–To range (days ÷ 7, 2 decimal places). */
export function payrollWeeksInRange(fromYmd: string, toYmd: string): number {
  const days = inclusiveDayCount(fromYmd, toYmd);
  if (days <= 0) return 0;
  return Math.round((days / 7) * 100) / 100;
}

export function formatPayrollWeeksLabel(weeks: number): string {
  const n = Number(weeks) || 0;
  if (n === 1) return "1 week";
  return `${n} weeks`;
}
