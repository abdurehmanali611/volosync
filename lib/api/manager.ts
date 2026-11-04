// Manager-only fetch layer: agent ranking periods, the full inventory lot
// edit, asset photo/register/list and the HR Manager approval queue.
// Mirrors lib/api.ts's request() envelope handling ({data}/{errors}) without
// touching that file.

import { ApiError, getToken, type Asset, type Lot, type Summary } from "@/lib/api";

import { scheduleSessionExpiredRedirect } from "@/lib/sessionExpiry";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://volosync-backend.vercel.app";

function messageFrom(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    const first = Object.values(record).find(
      (value) => typeof value === "string" || Array.isArray(value),
    );
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return "Something went wrong.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login/")) {
      scheduleSessionExpiredRedirect();
    }
    const detail = body?.errors ?? body;
    throw new ApiError(messageFrom(detail), detail);
  }
  return body as T;
}

// ------------------------------------------------------------------- ranking

export type RankingPeriod =
  | "alltime"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "halfyear"
  | "yearly";

/** One penalty Finance raised, kept with the document that carried it. */
export type PenaltyMark = {
  amount: string;
  reason: string;
  item: string;
  voucher: string;
  at: string;
};

// Exactly the serializer output of GET /api/sales/agents/ranking/.
export type RankRow = {
  agent_id: number;
  name: string;
  revenue: string;
  units_sold: string;
  returned_quantity: string;
  penalty_count: number;
  penalty_amount: string;
  has_penalty: boolean;
  penalty_reasons: PenaltyMark[];
  rank: number;
};

// ---------------------------------------------------------------- inventory

// PATCH /api/inventory/lots/<id>/ body (all fields optional, voucher immutable).
export type LotPatch = {
  remaining_quantity?: string;
  unit_sales?: string;
  unit_cost?: string;
  item_name?: string;
  category?: string;
  unit?: string;
  note?: string;
  image?: string;
  expiry_date?: string | null;
  supplier_name?: string;
  supplier_phone?: string;
  supplier_address?: string;
  supplier_tin?: string;
};

// Lot rows carry the supplier block even though lib/api's Lot type stops short.
export type LotDetail = Lot & {
  supplier_phone: string;
  supplier_address: string;
  supplier_tin: string;
  image?: string | null;
};

// ------------------------------------------------------------------- assets

export type AssetRow = Asset & { photo?: string | null };

export type AssetCreatePayload = {
  name: string;
  category: string;
  serial_number?: string;
  quantity?: string;
  brand_model?: string;
  photo?: string;
  unit_cost: string;
  condition_at_registration: string;
  useful_life_years: number;
};

export type AssetUpdatePayload = Partial<AssetCreatePayload>;

export type AssetFilters = {
  category?: string;
  status?: string;
  condition?: string;
};

// --------------------------------------------------------------- hr approvals

export type HrQueueType =
  | "leave"
  | "payroll_period"
  | "incident"
  | "document"
  | "attendance_correction"
  | "people_event"
  | "checklist_run";

export interface HrQueuePayload {
  [key: string]: unknown;
  leave_type?: string;
  from_ymd?: string;
  to_ymd?: string;
  days?: string | number;
  reason?: string;
  period?: string;
  period_key?: string;
  created_by?: string;
  month_name?: string;
  payslip_count?: number;
  counts?: { unpaid: number; awaiting_finance: number; marked_paid: number };
  totals?: { gross: string; deductions: string; net: string };
  gross?: string;
  deductions?: string;
  net?: string;
  kind?: string;
  title?: string;
  detail?: string;
  occurred_ymd?: string;
  salary_deduct?: boolean;
  amount_etb?: string;
  file_url?: string;
  file?: string | null;
  uploaded_by?: string;
  uploaded_at?: string;
  day?: string;
  new_status?: string;
  new_check_in?: string | null;
  new_check_out?: string | null;
  from_department_label?: string | null;
  to_department_label?: string | null;
  from_title?: string;
  to_title?: string;
  effective_ymd?: string | null;
  items?: { id: number; label: string; required: boolean; done: boolean }[];
}

export type HrQueueItem = {
  type: HrQueueType;
  id: number;
  employee_id: number | null;
  employee_name: string | null;
  title: string;
  detail: string;
  status: string;
  created_at: string | null;
  payload: HrQueuePayload;
};

export type HrQueue = {
  count: number;
  items: HrQueueItem[];
  role: string;
  who: string;
};

// Exact decision routes confirmed in BackEnd/hr/urls.py.
const HR_DECISION_PATHS: Record<HrQueueType, string> = {
  leave: "/api/hr/leaves",
  payroll_period: "/api/hr/payroll-periods",
  incident: "/api/hr/incidents",
  document: "/api/hr/documents",
  attendance_correction: "/api/hr/attendance/corrections",
  people_event: "/api/hr/people-events",
  checklist_run: "/api/hr/checklist-runs",
};

// ------------------------------------------------------ extended summary rows

export type SummaryTotals = Summary["totals"] & {
  base_value: string;
  inclusive_amount: string;
  output_vat: string;
  total_input_vat: string;
  total_output_vat: string;
  net_vat: string;
};

export type SummaryExt = Summary & { totals: SummaryTotals };

// ------------------------------------------------------------------- client

export const managerApi = {
  /** `period` is the preset window; an explicit from/to pair overrides it. */
  ranking: (period: RankingPeriod = "alltime", from?: string, to?: string) => {
    const params = new URLSearchParams({ period });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request<{ data: RankRow[] }>(
      `/api/sales/agents/ranking/?${params.toString()}`,
    );
  },

  patchLot: (id: number, payload: LotPatch) =>
    request<{ data: Lot }>(`/api/inventory/lots/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteLot: (id: number) =>
    request<{ data: { id: number; deleted: boolean } }>(
      `/api/inventory/lots/${id}/`,
      { method: "DELETE" },
    ),

  createAsset: (payload: AssetCreatePayload) =>
    request<{ data: AssetRow }>("/api/assets/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAsset: (id: number, payload: AssetUpdatePayload) =>
    request<{ data: AssetRow }>(`/api/assets/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteAsset: (id: number) =>
    request<{ data: { id: number; deleted: boolean } }>(`/api/assets/${id}/`, {
      method: "DELETE",
    }),

  listAssets: (filters: AssetFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.condition) params.set("condition", filters.condition);
    const query = params.toString();
    return request<{ data: AssetRow[] }>(`/api/assets/${query ? `?${query}` : ""}`);
  },

  hrQueue: () => request<{ data: HrQueue }>("/api/hr/approvals/queue/"),

  decideHr: (
    type: HrQueueType,
    id: number,
    decision: "APPROVED" | "REJECTED",
    note = "",
  ) =>
    request<{ data: unknown }>(`${HR_DECISION_PATHS[type]}/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
};
