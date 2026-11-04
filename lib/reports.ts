/**
 * Reporting maths shared by the Finance and Manager workspaces.
 *
 * Everything here is pure: the callers hand in the settlement rows the API
 * already returns (approved sales carry their item, category, unit cost and VAT
 * rate) and get grouped figures back, so a period filter never needs a
 * round-trip and exports always describe what is on screen.
 */

export type ReportPeriod = "daily" | "monthly" | "quarterly" | "halfyear" | "annual";

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "halfyear", label: "Half a year" },
  { value: "annual", label: "Annual" },
];

export type DateRange = { from: string; to: string };

/** The payment channels a settlement can be cleared through. */
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "TELEBIRR", label: "Telebirr" },
  { value: "BANK", label: "Bank" },
  { value: "RECEIPT", label: "Receipt (cash)" },
];

/** One settlement as far as reporting is concerned. */
export type SaleLikeRow = {
  id: number;
  status: string;
  created_at: string;
  agent_id: number | null;
  agent_name: string;
  item_name: string;
  category: string;
  voucher_number: string;
  sold_quantity: string;
  returned_quantity: string;
  sales_amount: string;
  /** What the sold units should have cost the customer: price × sold quantity. */
  expected_amount: string;
  penalty: boolean;
  penalty_amount: string;
  penalty_reason: string;
  unit_cost: string;
  vat_rate: string;
};

export type PenaltyEntry = {
  id: number;
  amount: number;
  reason: string;
  item: string;
  voucher: string;
  day: string;
};

export type SaleGroup = {
  key: string;
  label: string;
  /** Item groups carry their category; category groups carry their item count. */
  sublabel: string;
  lines: number;
  units: number;
  returned: number;
  revenue: number;
  cost: number;
  profit: number;
  vat: number;
  /** What the agent physically brought in: expected gross minus every penalty. */
  collected: number;
  penaltyAmount: number;
  penalties: PenaltyEntry[];
};

const pad = (value: number) => String(value).padStart(2, "0");

export const ymd = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local calendar day of an ISO timestamp, so filters match the wall clock. */
export function dayOf(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : ymd(date);
}

function partsOf(value: string): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  }
  return [year, month, day];
}

const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** The window a period preset covers around the picked calendar day. */
export function reportRange(period: ReportPeriod, anchor: string): DateRange {
  const [year, month, day] = partsOf(anchor);
  switch (period) {
    case "monthly":
      return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}` };
    case "quarterly": {
      const first = Math.floor((month - 1) / 3) * 3 + 1;
      const last = first + 2;
      return {
        from: `${year}-${pad(first)}-01`,
        to: `${year}-${pad(last)}-${pad(lastDayOfMonth(year, last))}`,
      };
    }
    case "halfyear": {
      const first = month <= 6 ? 1 : 7;
      const last = first + 5;
      return {
        from: `${year}-${pad(first)}-01`,
        to: `${year}-${pad(last)}-${pad(lastDayOfMonth(year, last))}`,
      };
    }
    case "annual":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "daily":
    default:
      return { from: `${year}-${pad(month)}-${pad(day)}`, to: `${year}-${pad(month)}-${pad(day)}` };
  }
}

export const periodLabel = (period: ReportPeriod) =>
  REPORT_PERIODS.find((option) => option.value === period)?.label ?? "Daily";

export function inRange(value: string, range: DateRange): boolean {
  const day = dayOf(value);
  return day >= range.from && day <= range.to;
}

/** VAT already inside a VAT-inclusive selling price. */
export const vatWithin = (revenue: number, rate: number) =>
  rate > 0 ? (revenue * rate) / (100 + rate) : 0;

/** Selling price × sold units — what this settlement should have brought in. */
export const expectedOf = (row: SaleLikeRow) =>
  Number(row.expected_amount || 0) || Number(row.sales_amount || 0);

/** The cash the agent did not hand over. */
export const shortfallOf = (row: SaleLikeRow) =>
  row.penalty ? Number(row.penalty_amount || 0) : 0;

/** What the agent physically brought in: expected gross, never below zero. */
export const collectedOf = (row: SaleLikeRow) =>
  Math.max(expectedOf(row) - shortfallOf(row), 0);

function blankGroup(key: string, label: string, sublabel: string): SaleGroup {
  return {
    key,
    label,
    sublabel,
    lines: 0,
    units: 0,
    returned: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    vat: 0,
    collected: 0,
    penaltyAmount: 0,
    penalties: [],
  };
}

/** Adds one settlement to a group, deriving profit and the VAT inside revenue. */
function accumulate(group: SaleGroup, row: SaleLikeRow) {
  const sold = Number(row.sold_quantity || 0);
  const revenue = Number(row.sales_amount || 0);
  const shortfall = shortfallOf(row);
  const cost = Number(row.unit_cost || 0) * sold;
  group.lines += 1;
  group.units += sold;
  group.returned += Number(row.returned_quantity || 0);
  group.revenue += revenue;
  group.cost += cost;
  group.profit += revenue - cost;
  group.vat += vatWithin(revenue, Number(row.vat_rate || 0));
  group.collected += collectedOf(row);
  if (row.penalty) {
    group.penaltyAmount += shortfall;
    group.penalties.push({
      id: row.id,
      amount: shortfall,
      reason: row.penalty_reason || "No reason recorded",
      item: row.item_name,
      voucher: row.voucher_number,
      day: dayOf(row.created_at),
    });
  }
}

function finish(groups: Map<string, SaleGroup>, by: "revenue" | "label") {
  const rows = Array.from(groups.values());
  return by === "revenue"
    ? rows.sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label))
    : rows.sort((a, b) => a.label.localeCompare(b.label) || b.revenue - a.revenue);
}

/** Approved sales only: they are the ones that actually left the store. */
export function approvedInRange(rows: SaleLikeRow[], range: DateRange): SaleLikeRow[] {
  return rows.filter((row) => row.status === "APPROVED" && inRange(row.created_at, range));
}

export function summariseByCategory(rows: SaleLikeRow[], range: DateRange): SaleGroup[] {
  const groups = new Map<string, SaleGroup>();
  for (const row of approvedInRange(rows, range)) {
    const category = row.category?.trim() || "Uncategorised";
    const group =
      groups.get(category) ?? blankGroup(category.toLowerCase(), category, "category");
    accumulate(group, row);
    groups.set(category, group);
  }
  for (const group of groups.values()) {
    const distinct = new Set(
      approvedInRange(rows, range)
        .filter(
          (row) => (row.category?.trim() || "Uncategorised").toLowerCase() === group.key,
        )
        .map((row) => row.item_name.toLowerCase()),
    );
    group.sublabel = `${distinct.size} item${distinct.size === 1 ? "" : "s"}`;
  }
  return finish(groups, "revenue");
}

export function summariseByItem(rows: SaleLikeRow[], range: DateRange): SaleGroup[] {
  const groups = new Map<string, SaleGroup>();
  for (const row of approvedInRange(rows, range)) {
    const itemName = row.item_name.trim() || "Unnamed item";
    const key = `${itemName.toLowerCase()}::${(row.category || "").toLowerCase()}`;
    const group =
      groups.get(key) ?? blankGroup(key, itemName, row.category?.trim() || "Uncategorised");
    accumulate(group, row);
    groups.set(key, group);
  }
  return finish(groups, "revenue");
}

export type AgentGroup = SaleGroup & { agentId: number | null; agentName: string };

export function summariseByAgent(
  rows: SaleLikeRow[],
  range: DateRange,
  agents: { id: number; name: string }[] = [],
): AgentGroup[] {
  const groups = new Map<string, AgentGroup>();
  const touch = (agentId: number | null, agentName: string) => {
    const key = agentId === null ? "unassigned" : `agent-${agentId}`;
    const existing = groups.get(key);
    if (existing) return existing;
    const created: AgentGroup = {
      ...blankGroup(key, agentName || "Unassigned", agentId === null ? "" : String(agentId)),
      agentId,
      agentName,
    };
    groups.set(key, created);
    return created;
  };
  for (const row of approvedInRange(rows, range)) {
    accumulate(touch(row.agent_id, row.agent_name), row);
  }
  // Every agent in the team shows up, even with a quiet period.
  for (const agent of agents) {
    if (agent.id !== null) touch(agent.id, agent.name);
  }
  const list = Array.from(groups.values());
  list.sort(
    (a, b) =>
      a.penaltyAmount - b.penaltyAmount ||
      b.revenue - a.revenue ||
      b.units - a.units ||
      a.label.localeCompare(b.label),
  );
  // Competition ranking on the same standing the backend uses.
  let previous: [number, number, number] | null = null;
  let previousRank = 0;
  list.forEach((row, index) => {
    const key: [number, number, number] = [row.penaltyAmount, row.revenue, row.units];
    // A const copy: the captured `previous` is a `let`, which TypeScript cannot
    // narrow inside the callback below.
    const prior = previous;
    if (!prior || key.some((value, position) => value !== prior[position])) {
      previousRank = index + 1;
      previous = key;
    }
    row.sublabel = String(previousRank);
  });
  return list;
}

/** Totals of one grouped report, for the footer row, the export and the KPI strip. */
export function totalise(groups: SaleGroup[]) {
  return groups.reduce(
    (sum, group) => ({
      lines: sum.lines + group.lines,
      units: sum.units + group.units,
      returned: sum.returned + group.returned,
      revenue: sum.revenue + group.revenue,
      cost: sum.cost + group.cost,
      profit: sum.profit + group.profit,
      vat: sum.vat + group.vat,
      collected: sum.collected + group.collected,
      penaltyAmount: sum.penaltyAmount + group.penaltyAmount,
      penalties: sum.penalties + group.penalties.length,
    }),
    {
      lines: 0,
      units: 0,
      returned: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      vat: 0,
      collected: 0,
      penaltyAmount: 0,
      penalties: 0,
    },
  );
}

/** Expected gross, collected gross and the shortfall between them. */
export function collectionTotals(groups: SaleGroup[]) {
  const totals = totalise(groups);
  return {
    expected: totals.revenue,
    collected: totals.collected,
    penalty: totals.penaltyAmount,
    rate: totals.revenue > 0 ? (totals.collected / totals.revenue) * 100 : 0,
  };
}

// ------------------------------------------------------------- daily figures

export type DailyTotals = {
  revenue: number;
  units: number;
  lines: number;
  vat: number;
  profit: number;
  collected: number;
  penaltyAmount: number;
};

export function dailySales(rows: SaleLikeRow[], day = ymd(new Date())): DailyTotals {
  const today = rows.filter(
    (row) => row.status === "APPROVED" && dayOf(row.created_at) === day,
  );
  return today.reduce<DailyTotals>(
    (sum, row) => {
      const revenue = Number(row.sales_amount || 0);
      const shortfall = shortfallOf(row);
      sum.lines += 1;
      sum.units += Number(row.sold_quantity || 0);
      sum.revenue += revenue;
      sum.profit += revenue - Number(row.unit_cost || 0) * Number(row.sold_quantity || 0);
      sum.vat += vatWithin(revenue, Number(row.vat_rate || 0));
      sum.collected += collectedOf(row);
      if (row.penalty) sum.penaltyAmount += shortfall;
      return sum;
    },
    { revenue: 0, units: 0, lines: 0, vat: 0, profit: 0, collected: 0, penaltyAmount: 0 },
  );
}

/* ------------------------------------------------------------------ promotions *
 * Promotions move stock out without an agent, so they never join the sales
 * ledger — they get their own windowed roll-up for the KPI strip.
 */

export type PromotionLikeLine = {
  quantity: string;
  line_total: string;
  item_name: string;
};

export type PromotionLikeRow = {
  voucher_number: string;
  mode: string;
  date: string;
  status: string;
  created_at: string;
  total: string;
  lines: PromotionLikeLine[];
};

export function summarisePromotions(rows: PromotionLikeRow[], range: DateRange) {
  const inWindow = rows.filter((row) =>
    inRange(row.date || row.created_at, range),
  );
  const approved = inWindow.filter((row) => row.status === "APPROVED");
  const lines = (list: PromotionLikeRow[]) =>
    list.flatMap((row) => row.lines ?? []);
  const byItem = new Map<string, { name: string; units: number; amount: number }>();
  for (const line of lines(inWindow)) {
    const key = line.item_name.toLowerCase();
    const entry = byItem.get(key) ?? { name: line.item_name, units: 0, amount: 0 };
    entry.units += Number(line.quantity || 0);
    entry.amount += Number(line.line_total || 0);
    byItem.set(key, entry);
  }
  const top = Array.from(byItem.values()).sort(
    (a, b) => b.units - a.units || b.amount - a.amount || a.name.localeCompare(b.name),
  );
  const units = top.reduce((sum, item) => sum + item.units, 0);
  return {
    docs: inWindow.length,
    approved: approved.length,
    units,
    amount: lines(inWindow).reduce((sum, line) => sum + Number(line.line_total || 0), 0),
    approvedUnits: lines(approved).reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    approvedAmount: lines(approved).reduce((sum, line) => sum + Number(line.line_total || 0), 0),
    items: new Set(lines(inWindow).map((line) => line.item_name.toLowerCase())).size,
    /** Heaviest giveaways first, with the slice of promotion units each took. */
    top: top.map((item) => ({ ...item, pct: units > 0 ? (item.units / units) * 100 : 0 })),
  };
}

/* ----------------------------------------------------------- inventory window *
 * The value still sitting on the shelves, measured over the same window the
 * sales figures use.
 */

export type InventoryLikeRow = {
  registration_date: string;
  in_store_value: string;
  registered_value: string;
  stocked_out_value: string;
  in_store_qty: string;
};

export function summariseInventoryInRange(rows: InventoryLikeRow[], range: DateRange) {
  const inWindow = rows.filter(
    (row) => !row.registration_date || inRange(row.registration_date, range),
  );
  const sum = (pick: (row: InventoryLikeRow) => string) =>
    inWindow.reduce((total, row) => total + Number(pick(row) || 0), 0);
  return {
    lots: inWindow.length,
    inStoreValue: sum((row) => row.in_store_value),
    registeredValue: sum((row) => row.registered_value),
    stockedOutValue: sum((row) => row.stocked_out_value),
    inStoreQty: sum((row) => row.in_store_qty),
  };
}
