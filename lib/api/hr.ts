// Typed fetch client for the HR-module backend additions (HotCol parity pass).
// Mirrors lib/api.ts: a thin request() over the {data}/{errors} envelope.
// Existing hrApi in lib/api.ts stays untouched; import and reuse it there.

import { ApiError, getToken, type HrDashboard, type HrDepartment, type HrEmployee } from "@/lib/api";

import { scheduleSessionExpiredRedirect } from "@/lib/sessionExpiry";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://volosync-backend.vercel.app";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  // Multipart bodies keep the browser's own Content-Type (with boundary).
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
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
      (detail && typeof detail === "object"
        ? Object.entries(detail as Record<string, unknown>)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
            .join(" · ")
        : null) ??
      "Something went wrong.";
    throw new ApiError(String(message), detail);
  }
  return body as T;
}

// ------------------------------------------------------------------- types

export type HrDashboardFull = HrDashboard & {
  pending_documents: number;
  pending_corrections: number;
};

export type HrShiftTemplate = {
  id: number;
  code: string;
  name: string;
  department: number | null;
  department_label: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  note: string;
  active: boolean;
};

export type HrEmployeeFull = HrEmployee & {
  shift: number | null;
  shift_label: string;
  team: number | null;
  team_label: string;
  org_position: string;
  must_change_otp: boolean;
  portal_first_login_at: string | null;
  profile_image_url: string;
  otp_reset_by?: string;
  otp_reset_at?: string | null;
};

export type HrTeam = {
  id: number;
  code: string;
  label: string;
  leader: string;
  department: number | null;
  department_label: string;
  active: boolean;
  staff: number;
};

export type HrLeaveBalanceRow = {
  id: number | null;
  leave_type: string;
  label: string;
  paid: boolean;
  year: number;
  entitled_days: string;
  adjustment_days: string;
  used_days: string;
  pending_days: string;
  available_days: string;
  note: string;
};

export type HrEmployeeBalance = {
  employee_id: number;
  employee_name: string;
  year: number;
  balances: HrLeaveBalanceRow[];
};

export type HrNotification = {
  id: number;
  employee: number;
  employee_name: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  action_status: string;
  read_at: string | null;
  created_at: string;
};

export type HrChatPeer = {
  id: number;
  full_name: string;
  department: string;
  job_title: string;
  status: string;
};

export type HrChatMember = {
  id: number;
  thread: number;
  employee: number | null;
  is_manager: boolean;
  member_key: string;
  employee_name: string;
  joined_at: string;
  last_read_at: string | null;
};

export type HrChatMessage = {
  id: number;
  thread: number;
  sender: number | null;
  sender_is_manager: boolean;
  sender_name: string;
  body: string;
  image_url: string;
  created_at: string;
};

export type HrChatThread = {
  id: number;
  tenant_name: string;
  kind: string;
  title: string;
  created_by_employee: number | null;
  created_by_role: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  members: HrChatMember[];
  last_message: HrChatMessage | null;
  message_count: number;
};

export type HrAtsCredential = {
  provisioned: boolean;
  tenant_id: number;
  otp?: string;
  must_change_otp?: boolean;
  role?: string;
  message?: string;
};

export type HrOtpReset = {
  employee_id: number;
  full_name: string;
  portal_otp: string;
  reset_by: string;
  reset_at: string | null;
};

export type HrLeaveType = {
  id: number;
  code: string;
  label: string;
  paid: boolean;
  quota_days: string;
  active: boolean;
};

export type HrIncidentType = {
  id: number;
  code: string;
  label: string;
  deduct: boolean;
  percent_of_salary: string | number;
  attendance_link: string;
  active: boolean;
};

export type HrDocumentFull = {
  id: number;
  employee: number | null;
  employee_name: string | null;
  title: string;
  kind: string;
  file_url: string;
  file?: string;
  status: string;
  decided_by: string;
  decided_at: string | null;
  decision_note: string;
  uploaded_by: string;
  uploaded_at: string;
};

export type HrAttendanceFull = {
  id: number;
  employee_id: number;
  employee_name: string;
  day: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  shift: number | null;
  shift_label: string;
  note: string;
};

export type HrAttendanceCorrection = {
  id: number;
  employee: number;
  employee_id: number;
  employee_name: string;
  attendance: number | null;
  day: string;
  new_status: string;
  new_check_in: string | null;
  new_check_out: string | null;
  reason: string;
  status: string;
  requested_by: string;
  decided_by: string;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
};

export const HR_STEP_KINDS = ["team_leader", "department_leader", "hr", "manager", "admin"] as const;
export type HrStepKind = (typeof HR_STEP_KINDS)[number];

export const HR_STEP_LABELS: Record<HrStepKind, string> = {
  team_leader: "Team leader",
  department_leader: "Department leader",
  hr: "HR Manager",
  manager: "Manager",
  admin: "Admin",
};

export type HrWorkflowStep = { kind: string };

export type HrWorkflow = {
  id: number;
  request_type: string;
  department: number | null;
  department_label: string;
  require_team_leader_first: boolean;
  steps: HrWorkflowStep[];
  active: boolean;
};

export const PEOPLE_EVENT_KINDS = ["promotion", "transfer", "termination", "disciplinary", "other"] as const;
export type PeopleEventKind = (typeof PEOPLE_EVENT_KINDS)[number];

export const PEOPLE_EVENT_LABELS: Record<PeopleEventKind, string> = {
  promotion: "Promotion",
  transfer: "Transfer",
  termination: "Termination",
  disciplinary: "Disciplinary",
  other: "Other",
};

export type HrPeopleEvent = {
  id: number;
  employee: number;
  employee_id: number;
  employee_name: string;
  kind: string;
  detail: string;
  from_department: number | null;
  from_department_label: string;
  to_department: number | null;
  to_department_label: string;
  from_title: string;
  to_title: string;
  effective_ymd: string | null;
  status: string;
  created_by: string;
  decided_by: string;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
};

export const CHECKLIST_KINDS = ["onboarding", "exit"] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export type HrChecklistTemplateItem = {
  id: number;
  label: string;
  required: boolean;
  owner_role: string;
  sort_order: number;
};

export type HrChecklistTemplate = {
  id: number;
  kind: string;
  name: string;
  department: number | null;
  department_label: string;
  team: number | null;
  team_label: string;
  job_title: string;
  active: boolean;
  items: HrChecklistTemplateItem[];
  created_at: string;
};

export type HrChecklistRunItem = {
  id: number;
  label: string;
  required: boolean;
  owner_role: string;
  done: boolean;
  completed_by: string;
  completed_at: string | null;
  note: string;
  sort_order: number;
};

export type HrChecklistRun = {
  id: number;
  template: number | null;
  employee: number;
  employee_id: number;
  employee_name: string;
  kind: string;
  status: string;
  created_by: string;
  decided_by: string;
  decided_at: string | null;
  items: HrChecklistRunItem[];
  created_at: string;
};

export const DOCUMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type HrBulkResult<T> = {
  created: T[];
  skipped: Record<string, unknown>[];
};

export type HrOtpResetRequest = {
  id: number;
  employee: number;
  employee_name: string;
  employee_no: string;
  department_label: string;
  reason: string;
  status: string;
  otp_code: string;
  requested_by: string;
  decided_by: string;
  decided_at: string | null;
  decision_note: string;
  used_at: string | null;
  created_at: string;
};

export type HrAtsOtp = {
  id: number;
  role: string;
  code: string;
  status: string;
  must_change_otp: boolean;
  generated_by: string;
  generated_at: string;
  used_at: string | null;
};

export type HrManagerDashboard = {
  headcount: number;
  active: number;
  on_leave: number;
  terminated: number;
  departments: { label: string; count: number }[];
  attendance: {
    day: string;
    total: number;
    present: number;
    late: number;
    absent: number;
  }[];
  leave_usage: { code: string; label: string; days: number }[];
  payroll: {
    id: number;
    period_key: string;
    status: string;
    payslips: number;
    gross: string;
    deductions: string;
    net: string;
  } | null;
  pending: {
    terminations: number;
    attendance: number;
    payroll: number;
    otp_resets: number;
    otp_issued: number;
  };
  otp: {
    portal_ready: number;
    first_login_pending: number;
    ats_active: number;
    resets_30d: number;
  };
  recent_terminations: {
    id: number;
    employee: string;
    effective_ymd: string | null;
    status: string;
  }[];
};

export type HrChatHistoryRow = {
  id: number;
  thread: number;
  thread_title: string;
  thread_kind: string;
  sender: number | null;
  sender_name: string;
  sender_is_manager: boolean;
  body: string;
  image_url: string;
  created_at: string;
};

export type HrChatBlock = {
  id: number;
  employee_a: number;
  employee_a_name: string;
  employee_b: number | null;
  employee_b_name: string;
  note: string;
  active: boolean;
  created_by: string;
  created_at: string;
};

export type HrChatBlockInput = {
  employee_a: number;
  employee_b: number | null;
  note?: string;
};

export type HrWageType = {
  id: number;
  code: string;
  name: string;
  frequency: string;
  min_day: number;
  to_day: number;
  active: boolean;
};

export type HrPayrollAdjustment = {
  id: number;
  kind: string;
  label: string;
  percent_of_salary: string | number;
  when_mode: string;
  salary_from: string | number;
  salary_to: string | number | null;
  start_ymd: string | null;
  end_ymd: string | null;
  active: boolean;
  created_at: string;
};

export type HrCompensation = {
  id: number;
  employee: number;
  employee_id: number;
  employee_name: string;
  department_label: string;
  kind: string;
  amount: string;
  effective_ymd: string | null;
  detail: string;
  status: string;
  created_by: string;
  decided_by: string;
  decided_at: string | null;
  decision_note: string;
  applied_period: number | null;
  applied_period_key: string;
  created_at: string;
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

// --------------------------------------------------------------------- api

export const hrExt = {
  dashboard: () => request<{ data: HrDashboardFull }>("/api/hr/dashboard/"),
  managerDashboard: () =>
    request<{ data: HrManagerDashboard }>("/api/hr/manager-dashboard/"),

  // ------------------------------------------------------------- otp reset
  otpReset: (id: number) =>
    request<{ data: HrOtpReset }>(`/api/hr/employees/${id}/otp-reset/`, { method: "POST" }),
  otpResetRequests: (queue = false) =>
    request<{ data: HrOtpResetRequest[] }>(
      `/api/hr/otp-resets/${queue ? "?queue=1" : ""}`,
    ),
  decideOtpReset: (id: number, decision: string, note = "") =>
    request<{ data: HrOtpResetRequest }>(`/api/hr/otp-resets/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  // Employees incl. shift fields the shared HrEmployee type predates.
  employees: (search = "") =>
    request<{ data: HrEmployeeFull[] }>(
      `/api/hr/employees/${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),

  // ------------------------------------------------------------------ teams
  teams: (department?: number | null) =>
    request<{ data: HrTeam[] }>(
      `/api/hr/teams/${department ? `?department=${department}` : ""}`,
    ),
  createTeam: (payload: {
    code?: string;
    label: string;
    leader?: string;
    department?: number | null;
    active?: boolean;
  }) =>
    request<{ data: HrTeam }>("/api/hr/teams/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTeam: (
    id: number,
    payload: Partial<{
      code: string;
      label: string;
      leader: string;
      department: number | null;
      active: boolean;
    }>,
  ) =>
    request<{ data: HrTeam }>(`/api/hr/teams/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTeam: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/teams/${id}/`, { method: "DELETE" }),

  // ------------------------------------------------------------ departments
  updateDepartment: (id: number, payload: { label: string; leader?: string }) =>
    request<{ data: HrDepartment }>(`/api/hr/departments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteDepartment: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/departments/${id}/`, {
      method: "DELETE",
    }),

  // --------------------------------------------------------- leave balances
  leaveBalances: (employee: number, year?: number) => {
    const params = new URLSearchParams({ employee: String(employee) });
    if (year) params.set("year", String(year));
    return request<{ data: HrEmployeeBalance }>(`/api/hr/leave-balances/?${params.toString()}`);
  },
  saveLeaveBalance: (payload: {
    employee: number;
    leave_type: string;
    year: number;
    entitled_days?: string | number;
    adjustment_days?: string | number;
    note?: string;
  }) =>
    request<{ data: HrLeaveBalanceRow }>("/api/hr/leave-balances/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ---------------------------------------------------------- notifications
  notifications: (filters: { employee?: number; unread?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.employee) params.set("employee", String(filters.employee));
    if (filters.unread) params.set("unread", "1");
    const query = params.toString();
    return request<{ data: HrNotification[] }>(
      `/api/hr/notifications/${query ? `?${query}` : ""}`,
    );
  },
  sendNotification: (payload: {
    employee: number;
    title: string;
    body?: string;
    kind?: string;
    href?: string;
  }) =>
    request<{ data: HrNotification }>("/api/hr/notifications/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  markNotificationRead: (id: number) =>
    request<{ data: HrNotification }>(`/api/hr/notifications/${id}/read/`, { method: "POST" }),

  // ------------------------------------------------------------------- chat
  chatPeers: () => request<{ data: HrChatPeer[] }>("/api/hr/chat/peers/"),
  chatThreads: () => request<{ data: HrChatThread[] }>("/api/hr/chat/threads/"),
  createChatThread: (payload: { employee_ids: number[]; title?: string; group?: boolean }) =>
    request<{ data: HrChatThread }>("/api/hr/chat/threads/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  chatMessages: (threadId: number) =>
    request<{ data: HrChatMessage[] }>(`/api/hr/chat/threads/${threadId}/messages/`),
  sendChatMessage: (threadId: number, payload: { body: string; image_url?: string }) =>
    request<{ data: HrChatMessage }>(`/api/hr/chat/threads/${threadId}/messages/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  markChatRead: (threadId: number) =>
    request<{ data: HrChatThread }>(`/api/hr/chat/threads/${threadId}/read/`, { method: "POST" }),
  chatBlocks: (all = false) =>
    request<{ data: HrChatBlock[] }>(
      `/api/hr/chat/blocks/${all ? "?all=1" : ""}`,
    ),
  createChatBlocks: (blocks: HrChatBlockInput[]) =>
    request<{ data: HrBulkResult<HrChatBlock> }>("/api/hr/chat/blocks/", {
      method: "POST",
      body: JSON.stringify({ blocks }),
    }),
  updateChatBlock: (id: number, note: string) =>
    request<{ data: HrChatBlock }>(`/api/hr/chat/blocks/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),
  deleteChatBlock: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/chat/blocks/${id}/`, {
      method: "DELETE",
    }),
  chatHistory: (filters: {
    from?: string;
    to?: string;
    employee?: number | null;
    thread_type?: string;
    manager?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.employee) params.set("employee", String(filters.employee));
    if (filters.thread_type) params.set("thread_type", filters.thread_type);
    if (filters.manager) params.set("manager", filters.manager);
    const query = params.toString();
    return request<{ data: HrChatHistoryRow[] }>(
      `/api/hr/chat/history/${query ? `?${query}` : ""}`,
    );
  },

  // ------------------------------------------------------------ hiring desk
  atsCredential: () => request<{ data: HrAtsCredential }>("/api/hr/ats-credential/"),
  issueAtsCredential: (role: string) =>
    request<{ data: HrAtsCredential }>("/api/hr/ats-credential/", {
      method: "POST",
      body: JSON.stringify({ role }),
    }),
  atsOtps: (status = "ACTIVE") =>
    request<{ data: HrAtsOtp[] }>(
      `/api/hr/ats-otps/?status=${encodeURIComponent(status)}`,
    ),
  createAtsOtp: (role: string) =>
    request<{ data: HrAtsOtp }>("/api/hr/ats-otps/", {
      method: "POST",
      body: JSON.stringify({ role }),
    }),
  resetAtsOtp: (id: number) =>
    request<{ data: HrAtsOtp }>(`/api/hr/ats-otps/${id}/reset/`, { method: "POST" }),
  deleteAtsOtp: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/ats-otps/${id}/`, {
      method: "DELETE",
    }),

  // ------------------------------------------------------- shift templates
  shiftTemplates: () => request<{ data: HrShiftTemplate[] }>("/api/hr/shift-templates/"),
  createShiftTemplate: (payload: {
    code: string;
    name: string;
    start_time: string;
    end_time: string;
    weekdays: number[];
    department?: number | null;
    note?: string;
    active?: boolean;
  }) =>
    request<{ data: HrShiftTemplate }>("/api/hr/shift-templates/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateShiftTemplate: (
    id: number,
    payload: Partial<{
      code: string;
      name: string;
      start_time: string;
      end_time: string;
      weekdays: number[];
      department: number | null;
      note: string;
      active: boolean;
    }>,
  ) =>
    request<{ data: HrShiftTemplate }>(`/api/hr/shift-templates/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteShiftTemplate: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/shift-templates/${id}/`, { method: "DELETE" }),
  bulkShiftTemplates: (payload: {
    shifts: {
      name: string;
      code?: string;
      department?: number | null;
      start_time?: string;
      end_time?: string;
      weekdays?: number[];
      note?: string;
      active?: boolean;
    }[];
  }) =>
    request<{ data: HrBulkResult<HrShiftTemplate> }>("/api/hr/shift-templates/bulk/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ---------------------------------------------------------- leave types
  leaveTypes: () => request<{ data: HrLeaveType[] }>("/api/hr/leave-types/"),
  createLeaveType: (payload: {
    code?: string;
    label: string;
    paid?: boolean;
    quota_days?: string | number;
    active?: boolean;
  }) =>
    request<{ data: HrLeaveType }>("/api/hr/leave-types/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLeaveType: (
    id: number,
    payload: Partial<{ code: string; label: string; paid: boolean; quota_days: string | number; active: boolean }>,
  ) =>
    request<{ data: HrLeaveType }>(`/api/hr/leave-types/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteLeaveType: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/leave-types/${id}/`, { method: "DELETE" }),

  // -------------------------------------------------------- incident types
  incidentTypes: () => request<{ data: HrIncidentType[] }>("/api/hr/incident-types/"),
  createIncidentType: (payload: {
    code?: string;
    label: string;
    deduct?: boolean;
    percent_of_salary?: string | number;
    attendance_link?: string;
    active?: boolean;
  }) =>
    request<{ data: HrIncidentType }>("/api/hr/incident-types/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  bulkIncidentTypes: (
    types: {
      label: string;
      code?: string;
      deduct?: boolean;
      percent_of_salary?: string | number;
      attendance_link?: string;
      active?: boolean;
    }[],
  ) =>
    request<{ data: HrBulkResult<HrIncidentType> }>("/api/hr/incident-types/bulk/", {
      method: "POST",
      body: JSON.stringify({ types }),
    }),
  updateIncidentType: (
    id: number,
    payload: Partial<{
      label: string;
      deduct: boolean;
      percent_of_salary: string | number;
      attendance_link: string;
      active: boolean;
    }>,
  ) =>
    request<{ data: HrIncidentType }>(`/api/hr/incident-types/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteIncidentType: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/incident-types/${id}/`, { method: "DELETE" }),

  // ------------------------------------------------------------ documents
  documents: (status = "", queue = false) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (queue) params.set("queue", "1");
    const query = params.toString();
    return request<{ data: HrDocumentFull[] }>(`/api/hr/documents/${query ? `?${query}` : ""}`);
  },
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ data: { path: string; url: string } }>("/api/hr/documents/upload/", {
      method: "POST",
      body: form,
    });
  },
  // Direct multipart create (views.py accepts `file` on POST /documents/),
  // or plain JSON create when only a pre-uploaded `path`/URL is available.
  createDocument: (
    payload: { employee?: number | null; title: string; kind?: string; file?: string; file_url?: string },
    file?: File,
  ) => {
    if (file) {
      const form = new FormData();
      form.append("title", payload.title);
      if (payload.kind) form.append("kind", payload.kind);
      if (payload.employee) form.append("employee", String(payload.employee));
      form.append("file", file);
      return request<{ data: HrDocumentFull }>("/api/hr/documents/", { method: "POST", body: form });
    }
    return request<{ data: HrDocumentFull }>("/api/hr/documents/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteDocument: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/documents/${id}/`, { method: "DELETE" }),
  decideDocument: (id: number, decision: string, note = "") =>
    request<{ data: HrDocumentFull }>(`/api/hr/documents/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  // ------------------------------------------------------ attendance bits
  attendance: (
    range:
      | string
      | { from?: string; to?: string; employee?: number | null } = "",
    to = "",
  ) => {
    const filters =
      typeof range === "string"
        ? { from: range, to, employee: null }
        : { from: range.from ?? "", to: range.to ?? "", employee: range.employee ?? null };
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.employee) params.set("employee", String(filters.employee));
    const query = params.toString();
    return request<{ data: HrAttendanceFull[] }>(`/api/hr/attendance/${query ? `?${query}` : ""}`);
  },
  corrections: (status = "", queue = false) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (queue) params.set("queue", "1");
    const query = params.toString();
    return request<{ data: HrAttendanceCorrection[] }>(
      `/api/hr/attendance/corrections/${query ? `?${query}` : ""}`,
    );
  },
  createCorrection: (payload: {
    employee: number;
    day: string;
    new_status: string;
    new_check_in?: string;
    new_check_out?: string;
    reason?: string;
  }) =>
    request<{ data: HrAttendanceCorrection }>("/api/hr/attendance/corrections/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decideCorrection: (id: number, decision: string, note = "") =>
    request<{ data: HrAttendanceCorrection }>(`/api/hr/attendance/corrections/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  // ------------------------------------------------------------ workflows
  workflows: (requestType = "") => {
    const query = requestType ? `?request_type=${encodeURIComponent(requestType)}` : "";
    return request<{ data: HrWorkflow[] }>(`/api/hr/workflows/${query}`);
  },
  // POST upserts by request_type (department is an attribute, not part of the key).
  saveWorkflow: (payload: {
    request_type: string;
    department?: number | null;
    require_team_leader_first?: boolean;
    steps: HrWorkflowStep[];
    active?: boolean;
  }) =>
    request<{ data: HrWorkflow }>("/api/hr/workflows/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateWorkflow: (
    id: number,
    payload: Partial<{
      department: number | null;
      require_team_leader_first: boolean;
      steps: HrWorkflowStep[];
      active: boolean;
    }>,
  ) =>
    request<{ data: HrWorkflow }>(`/api/hr/workflows/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteWorkflow: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/workflows/${id}/`, { method: "DELETE" }),

  // --------------------------------------------------------- people events
  peopleEvents: (filters: { kind?: string; status?: string; employee?: number } = {}) => {
    const params = new URLSearchParams();
    if (filters.kind) params.set("kind", filters.kind);
    if (filters.status) params.set("status", filters.status);
    if (filters.employee) params.set("employee", String(filters.employee));
    const query = params.toString();
    return request<{ data: HrPeopleEvent[] }>(`/api/hr/people-events/${query ? `?${query}` : ""}`);
  },
  createPeopleEvent: (payload: {
    employee: number;
    kind: string;
    detail?: string;
    to_department?: number | null;
    to_title?: string;
    effective_ymd?: string;
  }) =>
    request<{ data: HrPeopleEvent }>("/api/hr/people-events/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decidePeopleEvent: (id: number, decision: string, note = "") =>
    request<{ data: HrPeopleEvent }>(`/api/hr/people-events/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  // ---------------------------------------------------------- compensation
  compensation: () => request<{ data: HrCompensation[] }>("/api/hr/compensation/"),
  decideCompensation: (id: number, decision: string, note = "") =>
    request<{ data: HrCompensation }>(`/api/hr/compensation/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  // ------------------------------------------------------- payroll config
  wageTypes: () => request<{ data: HrWageType[] }>("/api/hr/wage-types/"),
  bulkWageTypes: (
    wage_types: {
      name: string;
      code?: string;
      frequency?: string;
      min_day?: number;
      to_day?: number;
      active?: boolean;
    }[],
  ) =>
    request<{ data: HrBulkResult<HrWageType> }>("/api/hr/wage-types/bulk/", {
      method: "POST",
      body: JSON.stringify({ wage_types }),
    }),
  updateWageType: (
    id: number,
    payload: Partial<{
      name: string;
      frequency: string;
      min_day: number;
      to_day: number;
      active: boolean;
    }>,
  ) =>
    request<{ data: HrWageType }>(`/api/hr/wage-types/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteWageType: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/wage-types/${id}/`, {
      method: "DELETE",
    }),

  payrollAdjustments: () =>
    request<{ data: HrPayrollAdjustment[] }>("/api/hr/payroll-adjustments/"),
  bulkPayrollAdjustments: (
    adjustments: {
      kind?: string;
      label: string;
      percent_of_salary?: string | number;
      when_mode?: string;
      salary_from?: string | number;
      salary_to?: string | number | null;
      start_ymd?: string;
      end_ymd?: string;
      active?: boolean;
    }[],
  ) =>
    request<{ data: HrBulkResult<HrPayrollAdjustment> }>(
      "/api/hr/payroll-adjustments/bulk/",
      {
        method: "POST",
        body: JSON.stringify({ adjustments }),
      },
    ),
  updatePayrollAdjustment: (
    id: number,
    payload: Partial<{
      kind: string;
      label: string;
      percent_of_salary: string | number;
      when_mode: string;
      salary_from: string | number;
      salary_to: string | number | null;
      start_ymd: string;
      end_ymd: string;
      active: boolean;
    }>,
  ) =>
    request<{ data: HrPayrollAdjustment }>(`/api/hr/payroll-adjustments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePayrollAdjustment: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/payroll-adjustments/${id}/`, {
      method: "DELETE",
    }),
  payrollHistory: (filters: {
    from?: string;
    to?: string;
    employee?: number;
    amount_from?: string;
    amount_to?: string;
    wage_type?: number;
    status?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.employee) params.set("employee", String(filters.employee));
    if (filters.amount_from) params.set("amount_from", filters.amount_from);
    if (filters.amount_to) params.set("amount_to", filters.amount_to);
    if (filters.wage_type) params.set("wage_type", String(filters.wage_type));
    if (filters.status) params.set("status", filters.status);
    const query = params.toString();
    return request<{ data: HrPayroll[] }>(
      `/api/hr/payroll/history/${query ? `?${query}` : ""}`,
    );
  },

  // ------------------------------------------------------------ checklists
  checklistTemplates: (kind = "") => {
    const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
    return request<{ data: HrChecklistTemplate[] }>(`/api/hr/checklists/${query}`);
  },
  createChecklistTemplate: (payload: {
    kind: string;
    name: string;
    department?: number | null;
    team?: number | null;
    job_title?: string;
    active?: boolean;
    items: { label: string; required: boolean; owner_role?: string; sort_order: number }[];
  }) =>
    request<{ data: HrChecklistTemplate }>("/api/hr/checklists/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateChecklistTemplate: (
    id: number,
    payload: Partial<{
      kind: string;
      name: string;
      department: number | null;
      team: number | null;
      job_title: string;
      active: boolean;
      items: { label: string; required: boolean; owner_role?: string; sort_order: number }[];
    }>,
  ) =>
    request<{ data: HrChecklistTemplate }>(`/api/hr/checklists/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteChecklistTemplate: (id: number) =>
    request<{ data: { deleted: boolean } }>(`/api/hr/checklists/${id}/`, { method: "DELETE" }),
  checklistRuns: (filters: { employee?: number; kind?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.employee) params.set("employee", String(filters.employee));
    if (filters.kind) params.set("kind", filters.kind);
    if (filters.status) params.set("status", filters.status);
    const query = params.toString();
    return request<{ data: HrChecklistRun[] }>(`/api/hr/checklist-runs/${query ? `?${query}` : ""}`);
  },
  createChecklistRun: (payload: { employee: number; template: number }) =>
    request<{ data: HrChecklistRun }>("/api/hr/checklist-runs/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checklistRun: (id: number) => request<{ data: HrChecklistRun }>(`/api/hr/checklist-runs/${id}/`),
  toggleRunItem: (runId: number, itemId: number, payload: { done: boolean; note?: string }) =>
    request<{ data: { id: number; done: boolean; completed_by: string; completed_at: string | null; note: string } }>(
      `/api/hr/checklist-runs/${runId}/items/${itemId}/toggle/`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  completeRun: (id: number) =>
    request<{ data: HrChecklistRun }>(`/api/hr/checklist-runs/${id}/complete/`, { method: "POST" }),
  decideRun: (id: number, decision: string) =>
    request<{ data: HrChecklistRun }>(`/api/hr/checklist-runs/${id}/decision/`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
};
