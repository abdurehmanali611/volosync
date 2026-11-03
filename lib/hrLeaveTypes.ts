export type HrLeaveTypeSetting = {
  code: string;
  label: string;
  paid: boolean;
  defaultDays: number;
  active: boolean;
};

function tenantKey() {
  if (typeof window === "undefined") return "default";
  return (
    localStorage.getItem("hotel_name")?.trim() ||
    localStorage.getItem("tin_number")?.trim() ||
    "default"
  );
}

function storageKey() {
  return `hotcol.hrLeaveTypes.v2.${tenantKey()}`;
}

function normalize(types: HrLeaveTypeSetting[]): HrLeaveTypeSetting[] {
  const seen = new Set<string>();
  const next: HrLeaveTypeSetting[] = [];
  for (const row of types) {
    const code = slugLeaveTypeCode(row.code || row.label);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    next.push({
      code,
      label: (row.label || code).trim() || code,
      paid: Boolean(row.paid),
      defaultDays: Math.max(0, Math.min(366, Number(row.defaultDays) || 0)),
      active: row.active !== false,
    });
  }
  return next;
}

export function slugLeaveTypeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function readHrLeaveTypeSettings(): HrLeaveTypeSetting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HrLeaveTypeSetting[];
    if (!Array.isArray(parsed)) return [];
    return normalize(parsed);
  } catch {
    return [];
  }
}

export function writeHrLeaveTypeSettings(types: HrLeaveTypeSetting[]) {
  const next = normalize(types);
  localStorage.setItem(storageKey(), JSON.stringify(next));
  return next;
}

export function activeHrLeaveTypes(types = readHrLeaveTypeSettings()) {
  return types.filter((t) => t.active);
}

export function leaveTypeLabel(
  code: string,
  types = readHrLeaveTypeSettings(),
) {
  return types.find((t) => t.code === code)?.label || code.replaceAll("_", " ");
}

export function findLeaveType(
  code: string,
  types = readHrLeaveTypeSettings(),
) {
  return types.find((t) => t.code === code) || null;
}
