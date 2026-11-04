// Typed fetch helpers for the endpoints the Finance workspace newly consumes:
// settlements with filters, the Payment & tax summary with its `tab` slice,
// the assets list with category/status/branch filters and the tenant list used
// to build the branch picker.
//
// Thin envelope wrapper — mirrors lib/api.ts's request() behaviour
// (successes are `{ data }`, errors are `{ errors }`) without touching that
// module. lib/api.ts keeps the BASE private, so the env lookup is replicated.

import { ApiError, getToken } from "@/lib/api";

import { scheduleSessionExpiredRedirect } from "@/lib/sessionExpiry";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://volosync-backend.vercel.app";

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
    const message =
      detail?.message ??
      (typeof detail === "string" ? detail : null) ??
      "Something went wrong.";
    throw new ApiError(String(message), detail);
  }
  return body as T;
}

// ------------------------------------------------------------------ sales

export type ApprovalStamp = {
  decision: string;
  decided_by: string;
  decided_at: string;
  note: string;
} | null;

export type SettlementRow = {
  id: number;
  assignment: number;
  lot: number;
  voucher_number: string;
  item_name: string;
  category: string;
  agent_name: string;
  agent_id: number | null;
  assigned_quantity: string;
  sold_quantity: string;
  returned_quantity: string;
  payment_method: string;
  sales_amount: string;
  expected_amount: string;
  variance: string;
  penalty: boolean;
  /** Finance's verdict: both figures exist only together with a penalty. */
  penalty_amount: string;
  penalty_reason: string;
  unit_cost: string;
  vat_rate: string;
  note: string;
  status: string;
  entered_by: number | null;
  entered_by_name: string;
  entered_at: string;
  created_at: string;
  finance_approval: ApprovalStamp;
  manager_approval: ApprovalStamp;
};

export type SettlementFilters = {
  from?: string;
  to?: string;
  agent_id?: string | number;
  item_id?: string | number;
  status?: string;
  payment_method?: string;
  queue?: boolean;
};

export const SETTLEMENT_STATUSES = [
  "PENDING_FINANCE",
  "PENDING_MANAGER",
  "APPROVED",
  "REJECTED",
] as const;

export const PAYMENT_METHODS = ["TELEBIRR", "BANK", "RECEIPT"] as const;

// ------------------------------------------------- inventory / payment & tax

export type SummaryTab = "all" | "with_vat" | "without_vat";

export type SummaryTaxRow = {
  id: number;
  voucher_number: string;
  item_name: string;
  category: string;
  unit: string;
  quantity: string;
  remaining_quantity: string;
  stocked_out_quantity: string;
  unit_cost: string;
  paid_amount: string;
  price_with_vat: string;
  registered_qty: string;
  in_store_qty: string;
  stocked_out_qty: string;
  registered_value: string;
  in_store_value: string;
  stocked_out_value: string;
  base_value: string;
  vat_amount: string;
  inclusive_amount: string;
  output_vat: string;
  vat: string;
  vat_rate: string;
  supplier_name: string;
  registration_date: string;
};

export type SummaryTotals = {
  registered_value: string;
  in_store_value: string;
  stocked_out_value: string;
  base_value: string;
  vat: string;
  inclusive_amount: string;
  output_vat: string;
  total_input_vat: string;
  total_output_vat: string;
  net_vat: string;
};

export type SummaryPayload = {
  tab: string;
  rows: SummaryTaxRow[];
  totals: SummaryTotals;
};

// ------------------------------------------------------------------ assets

export const ASSET_CATEGORIES = [
  { value: "IT_EQUIPMENT", label: "IT equipment" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "MACHINERY", label: "Machinery" },
  { value: "TOOL", label: "Tool" },
  { value: "OTHER", label: "Other" },
] as const;

export type AssetFilters = {
  category?: string;
  status?: string;
  branch?: string | number;
};

export type FinanceAsset = {
  id: number;
  asset_tag: string;
  name: string;
  category: string;
  serial_number: string;
  quantity: string;
  brand_model: string;
  photo: string;
  unit_cost: string;
  book_value: string;
  condition_at_registration: string;
  useful_life_years: number;
  status: string;
  assignee_name: string | null;
  created_at: string;
  assignments: {
    id: number;
    assignee_name: string;
    assigned_at: string;
    expected_return_date: string | null;
    is_active: boolean;
    removed_at: string | null;
  }[];
};

export type TenantOption = {
  id: number;
  name: string;
  parent: number | null;
  is_branch?: boolean;
};

// ------------------------------------------------------------------- api

export const financeApi = {
  /** `GET /api/sales/settlements/` — every filter is optional and combinable. */
  settlements: (filters: SettlementFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.agent_id) params.set("agent_id", String(filters.agent_id));
    if (filters.item_id) params.set("item_id", String(filters.item_id));
    if (filters.status) params.set("status", filters.status);
    if (filters.payment_method) params.set("payment_method", filters.payment_method);
    if (filters.queue) params.set("queue", "1");
    const query = params.toString();
    return request<{ data: SettlementRow[] }>(
      `/api/sales/settlements/${query ? `?${query}` : ""}`,
    );
  },

  /** `GET /api/inventory/summary/?tab=…` — totals always follow the slice. */
  summary: (tab: SummaryTab = "all") =>
    request<{ data: SummaryPayload }>(`/api/inventory/summary/?tab=${tab}`),

  /** `GET /api/assets/` — category / status / branch filters. */
  assets: (filters: AssetFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.branch) params.set("branch", String(filters.branch));
    const query = params.toString();
    return request<{ data: FinanceAsset[] }>(`/api/assets/${query ? `?${query}` : ""}`);
  },

  /** Platform tenant list — used to pick the viewer's own branches. */
  tenants: () => request<{ data: TenantOption[] }>("/api/tenants/"),

  /** Media files are served from `<api>/media/<path>`. */
  mediaUrl: (path?: string | null) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `${BASE}/media/${String(path).replace(/^\/+/, "")}`;
  },
};
