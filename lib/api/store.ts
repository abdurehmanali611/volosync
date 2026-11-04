// Thin typed helpers for the Store screen, mirroring lib/api.ts's request()
// ({data}/{errors} envelope). Reuse everything that already exists in
// lib/api.ts; this file only covers the new Payment & tax summary contract,
// whose tab filter and extended totals are not part of the base Summary type.

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

export type SummaryTab = "all" | "with_vat" | "without_vat";

/** One lot in GET /api/inventory/summary/?tab=… (input/output VAT split). */
export type SummaryTabRow = {
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

/** Totals always follow the filtered rows, so the panel reconciles per tab. */
export type SummaryTabTotals = {
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

export type TabSummary = {
  tab: SummaryTab;
  rows: SummaryTabRow[];
  totals: SummaryTabTotals;
};

export const storeApi = {
  summaryByTab: (tab: SummaryTab = "all") =>
    request<{ data: TabSummary }>(`/api/inventory/summary/?tab=${tab}`),
};
