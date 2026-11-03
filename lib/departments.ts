export const HOTEL_DEPARTMENT_CODES = [
  "KITCHEN",
  "BAR",
  "HOUSE_KEEPING_ROOM",
  "HOUSE_KEEPING_PUBLIC",
  "SECURITY",
  "MAINTENANCE",
  "FINANCE",
  "HR",
  "GM",
  "FB_SERVICE",
  "STORE",
  "PURCHASER",
] as const;

export type HotelDepartmentCode = (typeof HOTEL_DEPARTMENT_CODES)[number];

/** @deprecated Renamed to HOUSE_KEEPING_ROOM — kept for receipt snapshots. */
export const LEGACY_HOUSE_KEEPING_CODE = "HOUSE_KEEPING";

/** Store staff submitted the request (not a department leader). */
export const STAFF_REQUESTED_BY_CODE = "STAFF";

/** Item registrations received by store, kitchen, or bar only. */
export const REGISTRATION_RECEIVED_BY_CODES = [
  "STORE",
  "KITCHEN",
  "BAR",
] as const satisfies readonly HotelDepartmentCode[];

/** Stock movements — staff option plus all departments except Store / Purchaser. */
export const REQUESTED_BY_DEPARTMENT_CODES = [
  STAFF_REQUESTED_BY_CODE,
  ...HOTEL_DEPARTMENT_CODES.filter((c) => c !== "STORE" && c !== "PURCHASER"),
];

/**
 * Store→station destinations that feed Cost Control daily counts (Kitchen / Bar / Room).
 * Room is not a HotelDepartmentCode — use these option values on stock-out forms.
 * Do not include F&B Service or other departments here — those are “requested by” only.
 */
export const STOCK_OUT_STATION_OPTIONS = [
  { value: "KITCHEN", label: "Kitchen" },
  { value: "BAR", label: "Bar" },
  { value: "ROOM", label: "Room" },
] as const;

/** Kitchen / Bar only — for DepartmentLeaderSelect when Room is handled separately. */
export const STOCK_OUT_STATION_DESTINATION_CODES = [
  "KITCHEN",
  "BAR",
] as const satisfies readonly HotelDepartmentCode[];

/** Purchase requests — staff option plus all departments including Store. */
export const PURCHASE_REQUESTED_BY_DEPARTMENT_CODES = [
  STAFF_REQUESTED_BY_CODE,
  ...HOTEL_DEPARTMENT_CODES,
];

/**
 * Departments listed in the manager's Department leaders registry.
 * Staff is a real registry entry (so it can carry leader names) but stays out of
 * HOTEL_DEPARTMENT_CODES — that list seeds the request/registration option lists,
 * which already add Staff explicitly as their own entry.
 */
export const LEADER_DEPARTMENT_CODES = [
  ...HOTEL_DEPARTMENT_CODES,
  STAFF_REQUESTED_BY_CODE,
] as const;

export const DEPARTMENT_LABELS: Record<HotelDepartmentCode, string> = {
  KITCHEN: "Kitchen",
  BAR: "Bar",
  HOUSE_KEEPING_ROOM: "House Keeping (Room)",
  HOUSE_KEEPING_PUBLIC: "House Keeping (Public)",
  SECURITY: "Security",
  MAINTENANCE: "Maintenance",
  FINANCE: "Finance",
  HR: "Human Resource (HR)",
  GM: "General Manager (GM)",
  FB_SERVICE: "Food and Beverage Service (F&B service)",
  STORE: "Store",
  PURCHASER: "Purchaser",
};

const LEGACY_DEPARTMENT_LABELS: Record<string, string> = {
  [LEGACY_HOUSE_KEEPING_CODE]: DEPARTMENT_LABELS.HOUSE_KEEPING_ROOM,
};

export function normalizeDepartmentCode(code: string): string {
  const key = String(code ?? "").trim();
  if (key === LEGACY_HOUSE_KEEPING_CODE) return "HOUSE_KEEPING_ROOM";
  return key;
}

export function departmentCodesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeDepartmentCode(String(a ?? "")) === normalizeDepartmentCode(String(b ?? ""));
}

export function departmentLabel(code: string): string {
  const key = String(code ?? "").trim();
  if (key === STAFF_REQUESTED_BY_CODE) return "Staff";
  if (LEGACY_DEPARTMENT_LABELS[key]) return LEGACY_DEPARTMENT_LABELS[key];
  const normalized = normalizeDepartmentCode(key);
  return DEPARTMENT_LABELS[normalized as HotelDepartmentCode] ?? key;
}

/** Stable key for grouping receipts and vouchers by department. */
export function receiptDepartmentGroupKey(code: string | null | undefined): string {
  const normalized = normalizeDepartmentCode(String(code ?? "").trim());
  return normalized || "unknown";
}

/** First accountable leader name, lowercased (empty if none). */
export function accountableLeaderKey(leaderName?: string | null): string {
  return (splitLeaderNames(String(leaderName ?? ""))[0] ?? "").toLowerCase();
}

/**
 * Group key that keeps each selected leader separate
 * (e.g. Kitchen+Abebe vs Kitchen+Kebede).
 */
export function accountabilityGroupKey(
  department?: string | null,
  leaderName?: string | null,
): string {
  const dept = receiptDepartmentGroupKey(department);
  const leader = accountableLeaderKey(leaderName);
  return leader ? `${dept}|${leader}` : dept;
}

export function accountabilityMatches(
  aDepartment?: string | null,
  aLeaderName?: string | null,
  bDepartment?: string | null,
  bLeaderName?: string | null,
): boolean {
  return (
    departmentCodesMatch(aDepartment, bDepartment) &&
    accountableLeaderKey(aLeaderName) === accountableLeaderKey(bLeaderName)
  );
}

/**
 * Filter value may be a department code or encoded dept+leader.
 * When a leader is included, only that leader matches.
 */
export function matchesDepartmentLeaderFilter(
  rowDepartment: string | null | undefined,
  rowLeaderName: string | null | undefined,
  filterValue: string,
): boolean {
  const filter = String(filterValue ?? "").trim();
  if (!filter) return true;
  const { department, leaderName } = parseDepartmentLeaderValue(filter);
  const dept = department || filter;
  if (!departmentCodesMatch(rowDepartment, dept)) return false;
  if (!leaderName) return true;
  return accountableLeaderKey(rowLeaderName) === accountableLeaderKey(leaderName);
}

/** Human label for a department filter value (possibly encoded with a leader). */
export function formatDepartmentFilterLabel(filterValue: string): string {
  const raw = String(filterValue ?? "").trim();
  if (!raw) return "";
  const { department, leaderName } = parseDepartmentLeaderValue(raw);
  if (leaderName) return formatDepartmentWithLeader(department, leaderName);
  return departmentLabel(department || raw);
}

/**
 * Expand comma-separated registry names into separate signature lines
 * so each leader signs / is listed individually.
 */
export function expandLeaderSignatureBlocks(
  label: string,
  namesRaw: string | null | undefined,
): { label: string; name: string }[] {
  const names = splitLeaderNames(String(namesRaw ?? ""));
  if (!names.length) return [{ label, name: "" }];
  if (names.length === 1) return [{ label, name: names[0]! }];
  return names.map((name) => ({ label, name }));
}

export function formatDepartmentWithLeader(
  code: string,
  leaderName?: string | null,
): string {
  const normalized = normalizeDepartmentCode(String(code ?? "").trim());
  const label = departmentLabel(normalized);
  // Display a single accountable leader (not the full comma-separated registry).
  const names = splitLeaderNames(String(leaderName ?? ""));
  const name = names[0] ?? "";
  return name ? `${label} (${name})` : label;
}

/**
 * Split a department leader field into individual names.
 * Manager may store multiple leaders as comma-separated values.
 */
export function splitLeaderNames(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Normalize a department leader field: split on commas, trim each name,
 * drop empties, rejoin with ", ". Supports multiple leaders per department.
 */
export function normalizeLeaderNames(raw: string): string {
  return splitLeaderNames(raw).join(", ");
}

/** Separator for select values that encode department + one accountable leader. */
export const DEPARTMENT_LEADER_VALUE_SEP = "\u001f";

export function encodeDepartmentLeaderValue(
  department: string,
  leaderName = "",
): string {
  const dept = normalizeDepartmentCode(String(department ?? "").trim());
  if (!dept) return "";
  const leader = String(leaderName ?? "").trim();
  return leader ? `${dept}${DEPARTMENT_LEADER_VALUE_SEP}${leader}` : dept;
}

export function parseDepartmentLeaderValue(value: string): {
  department: string;
  leaderName: string;
} {
  const raw = String(value ?? "");
  const sep = raw.indexOf(DEPARTMENT_LEADER_VALUE_SEP);
  if (sep < 0) {
    return {
      department: normalizeDepartmentCode(raw.trim()),
      leaderName: "",
    };
  }
  return {
    department: normalizeDepartmentCode(raw.slice(0, sep).trim()),
    leaderName: raw.slice(sep + DEPARTMENT_LEADER_VALUE_SEP.length).trim(),
  };
}

/** Printed receipt / voucher label for who requested a purchase or stock movement. */
export function formatRequestedByReceiptLabel(row: {
  requestedByDepartment?: string | null;
  requestedByLeaderName?: string | null;
}): string {
  return formatDepartmentWithLeader(
    String(row.requestedByDepartment ?? "").trim(),
    row.requestedByLeaderName,
  );
}

export type DepartmentLeaderRow = {
  id: number;
  department: string;
  leaderName: string;
  departmentLabel?: string;
  HotelName: string;
};

export function leadersByDepartment(
  rows: DepartmentLeaderRow[],
): Map<string, DepartmentLeaderRow> {
  return new Map(rows.map((r) => [r.department, r]));
}

export function departmentLeaderDisplayLabel(row: {
  requestedByDepartment?: string | null;
  requestedByLeaderName?: string | null;
  requestedByDepartmentLabel?: string | null;
  receivedByDepartment?: string | null;
  receivedByLeaderName?: string | null;
}): string | null {
  const reqDept = normalizeDepartmentCode(
    String(row.requestedByDepartment ?? "").trim(),
  );
  const reqLeader = String(row.requestedByLeaderName ?? "").trim();
  if (reqDept === STAFF_REQUESTED_BY_CODE) {
    const one = splitLeaderNames(reqLeader)[0] || "";
    return one ? `Staff (${one})` : "Staff";
  }
  if (reqDept && reqLeader) {
    const deptLabel =
      String(row.requestedByDepartmentLabel ?? "").trim() ||
      departmentLabel(reqDept);
    // Prefer the single selected accountable leader on the row.
    const one = splitLeaderNames(reqLeader)[0] || reqLeader;
    return `${deptLabel} (${one})`;
  }
  const recvDept = String(row.receivedByDepartment ?? "").trim();
  const recvLeader = String(row.receivedByLeaderName ?? "").trim();
  if (recvDept && recvLeader) {
    return formatDepartmentWithLeader(recvDept, recvLeader);
  }
  return null;
}

export type DepartmentLeaderSelectOption = {
  value: string;
  label: string;
  department: string;
  leaderName: string;
};

/**
 * Build selector options. When `perLeader` is true (accountability selects),
 * each registered leader becomes its own option: "Kitchen (Abebe)", "Kitchen (Kebede)".
 * When false (destination-only), one option per department.
 */
export function selectOptionsForDepartments(
  leaders: DepartmentLeaderRow[],
  allowedCodes: readonly string[],
  opts?: { perLeader?: boolean },
): DepartmentLeaderSelectOption[] {
  const perLeader = opts?.perLeader !== false;
  const allowed = new Set(allowedCodes);
  // Staff is offered as its own plain option until the manager registers leader
  // names for it; once registered it behaves like every other department.
  const staffRegistered = leaders.some(
    (r) =>
      normalizeDepartmentCode(r.department) === STAFF_REQUESTED_BY_CODE &&
      splitLeaderNames(r.leaderName).length > 0,
  );
  const staffOption: DepartmentLeaderSelectOption[] =
    allowed.has(STAFF_REQUESTED_BY_CODE) && !staffRegistered
      ? [
          {
            value: STAFF_REQUESTED_BY_CODE,
            label: "Staff",
            department: STAFF_REQUESTED_BY_CODE,
            leaderName: "",
          },
        ]
      : [];

  const departmentOptions: DepartmentLeaderSelectOption[] = [];
  for (const r of leaders) {
    if (!allowed.has(r.department)) continue;
    const names = splitLeaderNames(r.leaderName);
    if (!names.length) continue;
    if (!perLeader) {
      departmentOptions.push({
        value: r.department,
        label: departmentLabel(r.department),
        department: r.department,
        leaderName: "",
      });
      continue;
    }
    for (const name of names) {
      departmentOptions.push({
        value: encodeDepartmentLeaderValue(r.department, name),
        label: formatDepartmentWithLeader(r.department, name),
        department: r.department,
        leaderName: name,
      });
    }
  }
  departmentOptions.sort((a, b) => a.label.localeCompare(b.label));
  return [...staffOption, ...departmentOptions];
}

/**
 * Merge registry select options with accountability pairs found on rows
 * (so historical leaders still appear in filters).
 * Callers must only pass rows already scoped to the current tenant.
 */
export function mergeAccountabilityFilterOptions(
  registryOptions: readonly DepartmentLeaderSelectOption[],
  rowPairs: readonly {
    department?: string | null;
    leaderName?: string | null;
  }[],
): DepartmentLeaderSelectOption[] {
  const map = new Map<string, DepartmentLeaderSelectOption>();
  for (const opt of registryOptions) {
    map.set(opt.value, opt);
  }
  for (const pair of rowPairs) {
    const dept = normalizeDepartmentCode(String(pair.department ?? "").trim());
    if (!dept) continue;
    const leader = splitLeaderNames(String(pair.leaderName ?? ""))[0] ?? "";
    const value = encodeDepartmentLeaderValue(dept, leader);
    if (!value || map.has(value)) continue;
    map.set(value, {
      value,
      label: formatDepartmentWithLeader(dept, leader),
      department: dept,
      leaderName: leader,
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Text stored on StockOutRequest.stakeHolderOrReason from a department select value. */
export function stockOutDestinationTextFromDepartmentCode(code: string): string {
  const raw = String(code ?? "").trim();
  const up = raw.toUpperCase();
  if (up === "KITCHEN") return "Kitchen";
  if (up === "BAR") return "Bar";
  if (up === "ROOM") return "Room";
  const { department } = parseDepartmentLeaderValue(raw);
  return departmentLabel(department || raw);
}

const LEGACY_STOCK_OUT_DESTINATION_TO_DEPARTMENT: Record<string, string> = {
  kitchen: "KITCHEN",
  barista: "BAR",
  bar: "BAR",
  juicer: "FB_SERVICE",
  "cleaning service": "HOUSE_KEEPING_PUBLIC",
  cleaning: "HOUSE_KEEPING_PUBLIC",
  housekeeping: "HOUSE_KEEPING_ROOM",
  maintenance: "MAINTENANCE",
};

/** Map saved destination text or department code back to a department select value. */
export function resolveStockOutDestinationDepartmentCode(
  raw: string,
): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  const normalized = normalizeDepartmentCode(trimmed);
  if (REQUESTED_BY_DEPARTMENT_CODES.includes(normalized)) {
    return normalized;
  }

  const lower = trimmed.toLowerCase();
  for (const code of REQUESTED_BY_DEPARTMENT_CODES) {
    if (departmentLabel(code).toLowerCase() === lower) return code;
  }

  const legacyCode = LEGACY_STOCK_OUT_DESTINATION_TO_DEPARTMENT[lower];
  if (
    legacyCode &&
    REQUESTED_BY_DEPARTMENT_CODES.includes(legacyCode)
  ) {
    return legacyCode;
  }

  return null;
}
