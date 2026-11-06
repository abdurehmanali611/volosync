import { resetSessionExpiryGuard, scheduleSessionExpiredRedirect } from "@/lib/sessionExpiry";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://volosync-backend.vercel.app";

export type Role = "STORE" | "FINANCE" | "MANAGER" | "HR" | "SALES" | "OWNER";

/** Every role lands on its own portal - never a route that does not exist. */
export const ROLE_HOME: Record<Role, string> = {
  STORE: "/store",
  FINANCE: "/finance",
  MANAGER: "/manager",
  HR: "/hr",
  SALES: "/sales",
  OWNER: "/manager?view=reports",
};

/** Route roots a role may open; anything else redirects back home. */
export const ROLE_ROOTS: Record<Role, string[]> = {
  STORE: ["/store"],
  FINANCE: ["/finance"],
  MANAGER: ["/manager", "/hr"],
  HR: ["/hr"],
  SALES: ["/sales"],
  OWNER: ["/manager"],
};

export function roleHome(role: Role | string): string {
  return ROLE_HOME[role as Role] ?? ROLE_HOME.STORE;
}

export type SessionUser = {
  id: number;
  username?: string;
  name: string;
  role: Role;
  tenant: string;
  tenant_id?: number;
  must_change_password?: boolean;
};

const TOKEN_KEY = "volosync.token";
const USER_KEY = "volosync.user";

export type TenantInfo = {
  id: number;
  name: string;
  logo_url?: string;
  tin?: string;
  phone?: string;
  address?: string;
  vat_rate?: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser) {
  resetSessionExpiryGuard();
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  detail: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(
        response.ok
          ? "The server returned an unexpected response."
          : `The server failed this request (HTTP ${response.status}). Please try again.`,
        text.slice(0, 400),
      );
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login/")) {
      scheduleSessionExpiredRedirect();
    }
    const detail: unknown =
      body && typeof body === "object" && "errors" in body
        ? (body as { errors: unknown }).errors
        : body;
    const stated =
      typeof detail === "string"
        ? detail
        : (detail as { message?: unknown } | null | undefined)?.message;
    throw new ApiError(String(stated ?? "Something went wrong."), detail);
  }
  return body as T;
}

export type StaffRow = {
  id: number;
  profile_id: number;
  username: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login: string | null;
};
export const api = {
  login: (username: string, password: string) =>
    request<{ access: string; user: SessionUser }>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  tenantMe: () => request<{ data: TenantInfo | null }>("/api/tenants/me/"),
  /* Manager Access section — staff logins for the manager's own tenant. */
  staff: () => request<{ data: StaffRow[] }>("/api/user/staff/"),
  createStaff: (payload: { username: string; password: string; role: string; phone?: string }) =>
    request<{ data: StaffRow }>("/api/user/staff/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateStaff: (id: number, payload: { is_active: boolean }) =>
    request<{ data: StaffRow }>(`/api/user/staff/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteStaff: (id: number) =>
    request<{ data: { id: number; deleted: boolean } }>(`/api/user/staff/${id}/`, {
      method: "DELETE",
    }),
  /* Any signed-in role rotates its own password (backend verifies the old one). */
  changePassword: (payload: { old_password: string; new_password: string }) =>
    request<{ data: { detail: string } }>("/api/user/change_password/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patchTenant: (id: number, payload: Record<string, unknown>) =>
    request<{ data: unknown }>(`/api/tenants/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  lots: (search = "") =>
    request<{ data: Lot[] }>(
      `/api/inventory/lots/${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  editLot: (id: number, payload: Partial<Lot>) =>
    request<{ data: Lot }>(`/api/inventory/lots/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  summary: () => request<{ data: Summary }>("/api/inventory/summary/"),
  movements: () => request<{ data: Movement[] }>("/api/inventory/movements/"),
  agents: () =>
    request<{ data: { id: number; name: string; phone: string }[] }>(
      "/api/inventory/agents/",
    ),
  registrations: (queue = false) =>
    request<{ data: Registration[] }>(
      `/api/inventory/registrations/${queue ? "?queue=1" : ""}`,
    ),
  createRegistration: (payload: unknown) =>
    request<{ data: Registration }>("/api/inventory/registrations/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  registrationDrafts: () =>
    request<{ data: Registration[] }>("/api/inventory/registrations/?status=DRAFT"),
  updateRegistrationDraft: (id: number, payload: unknown) =>
    request<{ data: Registration }>(`/api/inventory/registrations/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteRegistrationDraft: (id: number) =>
    request<{ data: { id: number; deleted: boolean } }>(
      `/api/inventory/registrations/${id}/`,
      { method: "DELETE" },
    ),
  submitRegistrationDraft: (id: number) =>
    request<{ data: Registration }>(
      `/api/inventory/registrations/${id}/submit/`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  decideRegistration: (id: number, decision: string, note = "") =>
    request<{ data: Registration }>(
      `/api/inventory/registrations/${id}/decision/`,
      { method: "POST", body: JSON.stringify({ decision, note }) },
    ),
  stockouts: (queue = false) =>
    request<{ data: StockOut[] }>(
      `/api/inventory/stockouts/${queue ? "?queue=1" : ""}`,
    ),
  createStockOut: (payload: unknown) =>
    request<{ data: StockOut }>("/api/inventory/stockouts/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  stockoutDrafts: () =>
    request<{ data: StockOut[] }>("/api/inventory/stockouts/?status=DRAFT"),
  updateStockOutDraft: (id: number, payload: unknown) =>
    request<{ data: StockOut }>(`/api/inventory/stockouts/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteStockOutDraft: (id: number) =>
    request<{ data: { id: number; deleted: boolean } }>(
      `/api/inventory/stockouts/${id}/`,
      { method: "DELETE" },
    ),
  submitStockOutDraft: (id: number) =>
    request<{ data: StockOut }>(`/api/inventory/stockouts/${id}/submit/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  decideStockOut: (id: number, decision: string, note = "") =>
    request<{ data: StockOut }>(`/api/inventory/stockouts/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
  pending: () =>
    Promise.all([
      request<{ data: Registration[] }>("/api/inventory/registrations/?queue=1"),
      request<{ data: StockOut[] }>("/api/inventory/stockouts/?queue=1"),
    ]),
  dashboard: () => request<{ data: Dashboard }>("/api/inventory/dashboard/"),
};

export type Dashboard = {
  tenant: { name: string; tin: string; vat_rate: string; sales_role_enabled: boolean };
  tenant_id?: number;
  role: Role;
  lots: number;
  stock_value: string;
  pending: { registrations: number; stockouts: number };
};

export type Lot = {
  id: number;
  voucher_number: string;
  item_name: string;
  category: string;
  unit: string;
  quantity: string;
  remaining_quantity: string;
  stocked_out_quantity: string;
  unit_cost: string;
  unit_sales: string;
  vat_rate: string;
  price_with_vat: string;
  paid_amount: string;
  registration_date: string;
  expiry_date: string | null;
  supplier_name: string;
  note?: string;
  image?: string | null;
};

export type Summary = {
  rows: (Lot & {
    registered_value: string;
    registered_qty: string;
    in_store_qty: string;
    stocked_out_qty: string;
    in_store_value: string;
    stocked_out_value: string;
    vat: string;
  })[];
  totals: {
    registered_value: string;
    in_store_value: string;
    stocked_out_value: string;
    vat: string;
  };
};

export type RegistrationLine = {
  id?: number;
  item_name: string;
  category: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  unit_sales: string;
  vat_rate?: string;
  price_with_vat?: string;
  paid_amount?: string;
  registration_date: string;
  expiry_date?: string | null;
  note?: string;
  image?: string | null;
  image_url?: string | null;
};

export type Registration = {
  id: number;
  voucher_number: string;
  status: string;
  supplier_name: string;
  supplier_phone: string;
  supplier_address: string;
  supplier_tin: string;
  note: string;
  created_at: string;
  created_by_name: string;
  total_value: string;
  lines: RegistrationLine[];
};

export type StockOut = {
  id: number;
  voucher_number: string;
  mode: string;
  date: string;
  status: string;
  note?: string;
  created_at?: string;
  created_by_name: string;
  assignments: {
    id: number;
    lot: number;
    voucher_number: string;
    item_name: string;
    sales_agent: number | null;
    agent_name: string;
    quantity: string;
    changing_amount: string;
    change_reason: string;
    /** Lot's selling price when the stock left the store. */
    unit_sales_at_assignment?: string;
  }[];
};

export type Movement = {
  id: number;
  type: string;
  voucher_number: string;
  item_name: string;
  quantity_delta: string;
  role: string;
  note: string;
  at: string;
};

/** The currency word trails the figure — "1,234.00 ETB", never in front of it. */
export const money = (value: string | number, currency = "ETB") =>
  `${amount(value)} ${currency}`;

/** Amount without the currency word, for cells that show "1,234.00 ETB". */
export const amount = (value: string | number) =>
  Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const qty = (value: string | number) =>
  Number(value).toLocaleString("en-GB", { maximumFractionDigits: 3 });

export const statusTone = (status: string) => {
  switch (status) {
    case "APPROVED":
      return "emerald";
    case "REJECTED":
      return "rose";
    case "PENDING_FINANCE":
      return "amber";
    case "PENDING_MANAGER":
      return "violet";
    default:
      return "slate";
  }
};

// ---------------------------------------------------------------- promotions

export type PromotionLine = {
  id: number;
  lot: number;
  item_name: string;
  voucher_number: string;
  unit_sales: string;
  manufacturer: string;
  remaining: string;
  quantity: string;
  changing_amount: string;
  change_reason: string;
  printed_price: string;
  line_total: string;
};

export type Promotion = {
  id: number;
  voucher_number: string;
  mode: string;
  date: string;
  status: string;
  note: string;
  created_at: string;
  created_by_name: string;
  manufacturers: string[];
  total: string;
  lines: PromotionLine[];
};

export const promoApi = {
  list: (options: { from?: string; to?: string; queue?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    if (options.queue) params.set("queue", "1");
    const query = params.toString();
    return request<{ data: Promotion[] }>(
      `/api/inventory/promotions/${query ? `?${query}` : ""}`,
    );
  },
  create: (payload: {
    mode: "SINGLE" | "BATCH";
    date: string;
    note?: string;
    lines: {
      lot: number;
      quantity: string;
      changing_amount: string;
      change_reason: string;
    }[];
  }) =>
    request<{ data: Promotion }>("/api/inventory/promotions/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decide: (id: number, decision: string, note = "") =>
    request<{ data: Promotion }>(`/api/inventory/promotions/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
};

// -------------------------------------------------------------------- sales

export type OpenAssignment = {
  assignment: number;
  lot: number;
  item_name: string;
  voucher_number: string;
  agent: number | null;
  agent_name: string;
  assigned_quantity: string;
  unit_price: string;
  expected_amount: string;
  date: string;
};

export type OpenAssignmentItem = {
  lot: number;
  item_name: string;
  voucher_number: string;
  unit_price: string;
  assigned_quantity: string;
  agents: number[];
};

export type Settlement = {
  id: number;
  assignment: number;
  lot: number;
  agent_id: number | null;
  agent_name: string;
  item_name: string;
  category: string;
  voucher_number: string;
  sold_quantity: string;
  returned_quantity: string;
  payment_method: string;
  sales_amount: string;
  expected_amount: string;
  collected_amount: string;
  variance: string;
  penalty: boolean;
  penalty_amount: string;
  penalty_reason: string;
  unit_cost: string;
  vat_rate: string;
  note: string;
  status: string;
  entered_at: string;
  created_at: string;
};

export type SalesAgentRow = {
  id: number;
  name: string;
  login_username: string;
  first_name: string;
  last_name: string;
  phone: string;
  sex: string;
  years_experience: number;
  is_active: boolean;
  assigned_count: number;
};

export type AgentRanking = {
  id: number;
  name: string;
  revenue: string;
  units: string;
  penalties: number;
  rank: number;
};

export const salesApi = {
  openAssignments: (item?: string) =>
    request<{ data: { items: OpenAssignmentItem[]; assignments: OpenAssignment[] } }>(
      `/api/sales/open-assignments/${item ? `?item=${item}` : ""}`,
    ),
  settlements: (queue = false) =>
    request<{ data: Settlement[] }>(`/api/sales/settlements/${queue ? "?queue=1" : ""}`),
  createSettlement: (payload: {
    assignment: number;
    sold_quantity: string;
    payment_method: string;
    sales_amount: string;
    penalty?: boolean;
    penalty_amount?: string;
    penalty_reason?: string;
    note?: string;
  }) =>
    request<{ data: Settlement }>("/api/sales/settlements/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /**
   * Finance's verdict. A penalty is only recorded as a pair — amount and
   * reason — so both travel with the tick.
   */
  decideSettlement: (
    id: number,
    decision: string,
    note = "",
    penalty?: boolean,
    penaltyAmount?: string,
    penaltyReason?: string,
  ) =>
    request<{ data: Settlement }>(`/api/sales/settlements/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify(
        penalty === undefined
          ? { decision, note }
          : {
              decision,
              note,
              penalty,
              ...(penalty ? { penalty_amount: penaltyAmount, penalty_reason: penaltyReason } : {}),
            },
      ),
    }),
  agents: () =>
    request<{ data: SalesAgentRow[]; sales_username?: string }>("/api/sales/agents/"),
  createAgent: (payload: {
    first_name: string;
    last_name: string;
    phone: string;
    sex: string;
    years_experience: number;
  }) =>
    request<{ data: SalesAgentRow }>("/api/sales/agents/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  ranking: () => request<{ data: AgentRanking[] }>("/api/sales/agents/ranking/"),
};

// ----------------------------------------------------------------------- hr

export type HrDashboard = {
  headcount: number;
  departments: number;
  on_leave: number;
  pending_leaves: number;
  pending_payroll: number;
  open_incidents: number;
  attendance_today: number;
  present_today: number;
  salary_mass: string;
  role: Role;
};

export type HrDepartment = { id: number; code: string; label: string; leader: string; staff?: number };

export type HrEmployee = {
  id: number;
  employee_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  sex: string;
  phone: string;
  email: string;
  department: number | null;
  department_label: string;
  job_title: string;
  hired_on: string | null;
  salary: string;
  status: string;
  portal_otp: string;
};

export type HrLeave = {
  id: number;
  employee_id: number;
  employee_name: string;
  leave_type: string;
  from_ymd: string;
  to_ymd: string;
  days: string;
  reason: string;
  status: string;
  current_step_index: number;
  step_kind: string;
  decided_by: string;
  decision_note: string;
  decided_at: string | null;
  created_at: string;
};

export type HrAttendance = {
  id: number;
  employee_id: number;
  employee_name: string;
  day: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  note: string;
};

export type HrPayroll = {
  id: number;
  employee_id: number;
  employee_name: string;
  job_title: string;
  period_id: number;
  period_key: string;
  gross: string;
  deductions: string;
  net: string;
  status: string;
  hr_marked_paid_at: string | null;
  hr_marked_paid_by: string;
  manager_approved_at: string | null;
  manager_approved_by: string;
  created_at: string;
};

export type HrPayrollPeriod = {
  id: number;
  period_key: string;
  month_name: string;
  from_ymd: string;
  to_ymd: string;
  status: string;
  created_by: string;
  created_at: string;
  decided_by: string;
  decided_at: string | null;
  decision_note: string;
  closed_by: string;
  closed_at: string | null;
  wage_type: number | null;
  wage_type_label: string;
  payslip_count: number;
  counts: { unpaid: number; awaiting_finance: number; marked_paid: number };
  totals: { gross: string; deductions: string; net: string };
  payslips?: HrPayroll[];
};

export type HrDocument = {
  id: number;
  employee: number | null;
  employee_name: string | null;
  title: string;
  kind: string;
  file_url: string;
  uploaded_at: string;
};

export type HrIncident = {
  id: number;
  employee: number | null;
  employee_name: string | null;
  kind: string;
  title: string;
  detail: string;
  occurred_ymd: string;
  salary_deduct: boolean;
  amount_etb: string;
  status: string;
};

export const hrApi = {
  dashboard: () => request<{ data: HrDashboard }>("/api/hr/dashboard/"),
  departments: () => request<{ data: HrDepartment[] }>("/api/hr/departments/"),
  createDepartment: (payload: { code: string; label: string; leader?: string }) =>
    request<{ data: HrDepartment }>("/api/hr/departments/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  employees: (search = "") =>
    request<{ data: HrEmployee[] }>(
      `/api/hr/employees/${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  createEmployee: (payload: Record<string, unknown>) =>
    request<{ data: HrEmployee }>("/api/hr/employees/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateEmployee: (id: number, payload: Record<string, unknown>) =>
    request<{ data: HrEmployee }>(`/api/hr/employees/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  leaveTypes: () =>
    request<{ data: { id: number; code: string; label: string; paid: boolean; quota_days: string }[] }>(
      "/api/hr/leave-types/",
    ),
  createLeaveType: (payload: Record<string, unknown>) =>
    request<{ data: unknown }>("/api/hr/leave-types/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  leaves: (queue = false) =>
    request<{ data: HrLeave[] }>(`/api/hr/leaves/${queue ? "?queue=1" : ""}`),
  createLeave: (payload: Record<string, unknown>) =>
    request<{ data: HrLeave }>("/api/hr/leaves/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decideLeave: (id: number, decision: string, note = "") =>
    request<{ data: HrLeave }>(`/api/hr/leaves/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
  attendance: (from = "", to = "") => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return request<{ data: HrAttendance[] }>(
      `/api/hr/attendance/${query ? `?${query}` : ""}`,
    );
  },
  markAttendance: (payload: Record<string, unknown>) =>
    request<{ data: HrAttendance }>("/api/hr/attendance/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  payroll: (periodId = "", status = "") => {
    const params = new URLSearchParams();
    if (periodId) params.set("period", String(periodId));
    if (status) params.set("status", status);
    const query = params.toString();
    return request<{ data: HrPayroll[] }>(
      `/api/hr/payroll/${query ? `?${query}` : ""}`,
    );
  },
  /* Payroll runs: HR generates, the Manager approves, Finance settles. */
  payrollPeriods: () =>
    request<{ data: HrPayrollPeriod[] }>("/api/hr/payroll-periods/"),
  payrollPeriod: (id: number) =>
    request<{ data: HrPayrollPeriod }>(`/api/hr/payroll-periods/${id}/`),
  createPayrollPeriod: (payload: {
    period_key: string;
    from_ymd?: string;
    to_ymd?: string;
    month_name?: string;
    wage_type?: number | null;
  }) =>
    request<{ data: HrPayrollPeriod }>("/api/hr/payroll-periods/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decidePayrollPeriod: (id: number, decision: string, note = "") =>
    request<{ data: HrPayrollPeriod }>(
      `/api/hr/payroll-periods/${id}/decision/`,
      { method: "POST", body: JSON.stringify({ decision, note }) },
    ),
  markPayrollPaid: (id: number, payslipIds: number[] = []) =>
    request<{ data: HrPayrollPeriod }>(
      `/api/hr/payroll-periods/${id}/mark-paid/`,
      { method: "POST", body: JSON.stringify({ payslip_ids: payslipIds }) },
    ),
  decidePayrollPayment: (
    id: number,
    decision: string,
    payslipIds: number[] = [],
  ) =>
    request<{ data: HrPayrollPeriod }>(
      `/api/hr/payroll-periods/${id}/payment-decision/`,
      {
        method: "POST",
        body: JSON.stringify({ decision, payslip_ids: payslipIds }),
      },
    ),
  closePayrollPeriod: (id: number) =>
    request<{ data: HrPayrollPeriod }>(
      `/api/hr/payroll-periods/${id}/close/`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  deletePayrollPeriod: (id: number) =>
    request<null>(`/api/hr/payroll-periods/${id}/`, { method: "DELETE" }),
  documents: () => request<{ data: HrDocument[] }>("/api/hr/documents/"),
  createDocument: (payload: Record<string, unknown>) =>
    request<{ data: HrDocument }>("/api/hr/documents/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  incidents: (queue = false) =>
    request<{ data: HrIncident[] }>(`/api/hr/incidents/${queue ? "?queue=1" : ""}`),
  createIncident: (payload: Record<string, unknown>) =>
    request<{ data: HrIncident }>("/api/hr/incidents/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decideIncident: (id: number, decision: string) =>
    request<{ data: HrIncident }>(`/api/hr/incidents/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
};

// ------------------------------------------------------------------- assets

export type Asset = {
  id: number;
  asset_tag: string;
  name: string;
  category: string;
  serial_number: string;
  quantity: string;
  brand_model: string;
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

export const assetsApi = {
  list: () => request<{ data: Asset[] }>("/api/assets/"),
  create: (payload: {
    name: string;
    category: string;
    serial_number?: string;
    quantity?: string;
    brand_model?: string;
    unit_cost: string;
    condition_at_registration: string;
    useful_life_years: number;
  }) =>
    request<{ data: Asset }>("/api/assets/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  assign: (
    id: number,
    payload: { assignee_name: string; expected_return_date?: string },
  ) =>
    request<{ data: Asset }>(`/api/assets/${id}/assign/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: number) =>
    request<{ data: Asset }>(`/api/assets/${id}/remove/`, { method: "POST" }),
};

/** Read watermarks for the bell's queue notifications. */
export type NoticeAckRow = { key: string; count: number };

export const noticeApi = {
  acks: () => request<{ data: NoticeAckRow[] }>("/api/user/notice-acks/"),
  markRead: (items: NoticeAckRow[]) =>
    request<{ data: NoticeAckRow[] }>("/api/user/notice-acks/", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};

/** The manager workspace's direct line to the Apex team. */
export type ApexChatMessage = {
  id: number;
  side: "APEX" | "TENANT";
  body: string;
  image_url?: string | null;
  sender: string;
  created_at: string;
};

export type ApexChatThread = {
  subject: string;
  status: "OPEN" | "CLOSED";
  messages: number;
  unread_for_tenant: number;
  created_at: string;
  updated_at: string;
};

export type ApexChatTranscript = {
  thread: ApexChatThread | null;
  messages: ApexChatMessage[];
};

export const apexChatApi = {
  load: () => request<{ data: ApexChatTranscript }>("/api/apex-chat/"),
  send: (body: string) =>
    request<{ data: ApexChatTranscript }>("/api/apex-chat/", {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  markRead: () =>
    request<{ data: { marked_read: boolean } }>("/api/apex-chat/", {
      method: "PATCH",
      body: JSON.stringify({ action: "read" }),
    }),
};
