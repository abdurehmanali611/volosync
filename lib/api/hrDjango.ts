/**
 * Bridge between the copied hotcol-user HR API surface (GraphQL) and the
 * Volosync Django REST backend (/api/hr/).
 *
 * The copied panels call `gql(...)` exactly as they did in hotcol-user. This
 * module translates each operation to the Django endpoints and converts the
 * snake_case REST payloads back to the camelCase shapes the panels expect.
 */
import { api, API_URL } from "@/lib/api/client";

const H = `${API_URL}/api/hr`;

function get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
  return api.get(H + path, { params }).then((r) => (r.data?.data ?? r.data) as T);
}
function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  return api.post(H + path, body ?? {}).then((r) => (r.data?.data ?? r.data) as T);
}
function patch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return api.patch(H + path, body ?? {}).then((r) => (r.data?.data ?? r.data) as T);
}
function del<T = unknown>(path: string): Promise<T> {
  return api.delete(H + path).then((r) => (r.data?.data ?? r.data) as T);
}
function s(v: unknown): string {
  return v == null ? "" : String(v);
}
function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function low(v: unknown): string {
  return s(v).toLowerCase();
}
function hm(v: unknown): string {
  const raw = s(v);
  const m = raw.match(/(\d{2}:\d{2})/);
  return m ? m[1] : "";
}
function iso(day: string, time: string): string | null {
  if (!time) return null;
  return day ? `${day}T${time}` : time;
}
function ymd(v: unknown): string {
  return s(v).slice(0, 10);
}
/** The roster column stores M/F; the HR forms speak male/female. */
function genderOf(v: unknown): string {
  const key = s(v).toUpperCase();
  return key === "M" ? "male" : key === "F" ? "female" : "";
}

type Emp = Record<string, unknown> & {
  id: number;
  full_name: string;
  department?: number | null;
  [key: string]: unknown;
};

let deptCache: { id: number; code: string; label: string }[] | null = null;
async function rawDepartments() {
  if (deptCache) return deptCache;
  const rows = await get<Record<string, unknown>[]>("/departments/");
  deptCache = (rows || []).map((r) => ({
    id: num(r.id),
    code: s(r.code),
    label: s(r.label),
  }));
  return deptCache;
}
async function deptCode(id: unknown): Promise<string> {
  if (id == null || id === "") return "";
  const list = await rawDepartments();
  return list.find((d) => d.id === num(id))?.code ?? "";
}
async function deptId(code: unknown): Promise<number | null> {
  const value = s(code).trim();
  if (!value) return null;
  const list = await rawDepartments();
  const upper = value.toUpperCase();
  return (
    list.find((d) => d.code.toUpperCase() === upper)?.id ??
    list.find((d) => d.label.toUpperCase() === upper)?.id ??
    null
  );
}

async function employeeMap() {
  const rows = await get<Emp[]>("/employees/");
  const map = new Map<number, Emp>();
  for (const row of rows || []) map.set(num(row.id), row);
  return map;
}

/**
 * Persist a whole editor list as a patch/create/delete diff instead of
 * deleting every row first. Ids survive, a read in flight never sees an empty
 * table, and employees keep the department they point at.
 */
async function syncByCode(
  base: string,
  wanted: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const existing = (await get<Record<string, unknown>[]>(base)) || [];
  const byCode = new Map<string, Record<string, unknown>>();
  for (const row of existing) {
    const code = s(row.code).toUpperCase();
    if (code && !byCode.has(code)) byCode.set(code, row);
  }
  const kept = new Set<unknown>();
  const saved: Record<string, unknown>[] = [];
  for (const payload of wanted) {
    const hit = byCode.get(s(payload.code).toUpperCase());
    if (hit) {
      kept.add(hit.id);
      saved.push(
        await patch<Record<string, unknown>>(`${base}${num(hit.id)}/`, payload),
      );
    } else {
      saved.push(await post<Record<string, unknown>>(base, payload));
    }
  }
  for (const row of existing) {
    if (!kept.has(row.id)) await del(`${base}${num(row.id)}/`);
  }
  return saved;
}

async function mapEmployee(e: Emp): Promise<Record<string, unknown>> {
  return {
    id: num(e.id),
    HotelName: "",
    fullName: s(e.full_name),
    phone: s(e.phone),
    email: s(e.email),
    department: await deptCode(e.department),
    jobTitle: s(e.job_title),
    orgPosition: s(e.org_position),
    teamId: e.team == null ? null : num(e.team),
    status: low(e.status),
    hireDate: ymd(e.hired_on),
    endDate: "",
    wageType: low(e.wage_type) || "monthly",
    baseSalaryETB: num(e.salary),
    bankName: s(e.bank_name),
    accountNumber: s(e.account_number),
    credentialUserId: null,
    credentialUserName: "",
    notes: s(e.notes),
    portalOtpPreview: s(e.portal_otp),
    portalOtpViewer: s(e.portal_otp),
    mustChangeOtp: Boolean(e.must_change_otp),
    portalOtpIssuedAt: e.otp_reset_at ?? null,
    portalFirstLoginAt: e.portal_first_login_at ?? null,
    profileImageUrl: s(e.profile_image_url),
    gender: genderOf(e.sex),
    education: s(e.education),
    personalTin: s(e.personal_tin),
    yearsExperience: num(e.years_experience),
    medicalNote: s(e.medical_note),
    createdAt: s(e.created_at),
    updatedAt: s(e.created_at),
  };
}

async function mapEmployees(rows: Emp[]) {
  return Promise.all((rows || []).map(mapEmployee));
}

function mapDepartment(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    code: s(r.code),
    label: s(r.label),
    active: true,
    sortOrder: 0,
  };
}
function mapTeam(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    departmentId: r.department == null ? 0 : num(r.department),
    code: s(r.code),
    label: s(r.label),
    active: r.active !== false,
    sortOrder: 0,
  };
}
function mapLeaveType(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    code: s(r.code),
    label: s(r.label),
    paid: r.paid !== false,
    defaultDays: num(r.quota_days),
    active: r.active !== false,
    sortOrder: 0,
  };
}
function mapIncidentType(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    code: s(r.code),
    label: s(r.label),
    deduct: Boolean(r.deduct),
    percentOfSalary: num(r.percent_of_salary),
    amountETB: 0,
    attendanceLink:
      s(r.attendance_link).toUpperCase() === "NONE"
        ? ""
        : low(r.attendance_link),
    active: r.active !== false,
    sortOrder: 0,
  };
}
function mapWorkflow(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    requestType: s(r.request_type),
    departmentId: r.department == null ? null : num(r.department),
    requireTeamLeaderFirst: Boolean(r.require_team_leader_first),
    stepsJson: r.steps ?? [],
    active: r.active !== false,
  };
}
function mapNotification(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    recipientRole: "",
    employeeId: r.employee == null ? null : num(r.employee),
    kind: s(r.kind),
    title: s(r.title),
    body: s(r.body),
    href: s(r.href),
    actionStatus: s(r.action_status),
    createdBy: "",
    readAt: r.read_at ?? null,
    createdAt: s(r.created_at),
  };
}
function partialEmployee(id: unknown, name: unknown) {
  return { id: num(id), fullName: s(name), HotelName: "" };
}
function mapOtpReset(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    employeeId: num(r.employee),
    requestedBy: s(r.requested_by),
    status: low(r.status),
    decidedBy: s(r.decided_by),
    decidedAt: r.decided_at ?? null,
    createdAt: s(r.created_at),
    portalOtpPreview: s(r.otp_code) ? "••••••" : "",
    employee: partialEmployee(r.employee, r.employee_name),
  };
}
function mapLeave(r: Record<string, unknown>) {
  const name = s(r.employee_name);
  return {
    id: num(r.id),
    HotelName: "",
    employeeId: num(r.employee_id),
    leaveType: s(r.leave_type),
    fromYmd: ymd(r.from_ymd),
    toYmd: ymd(r.to_ymd),
    days: num(r.days),
    reason: s(r.reason),
    status: low(r.status),
    flowId: null,
    currentStepIndex: num(r.current_step_index),
    currentStepKind: s(r.step_kind),
    decidedBy: s(r.decided_by),
    decidedAt: r.decided_at ?? null,
    createdAt: s(r.created_at),
    employee: partialEmployee(r.employee_id, name),
  };
}
function mapAttendance(r: Record<string, unknown>) {
  const day = ymd(r.day);
  return {
    id: num(r.id),
    HotelName: "",
    employeeId: num(r.employee_id),
    workDate: day,
    clockInAt: iso(day, hm(r.check_in)),
    clockOutAt: iso(day, hm(r.check_out)),
    status: low(r.status),
    notes: s(r.note),
    createdAt: "",
    employee: partialEmployee(r.employee_id, r.employee_name),
  };
}
function mapShift(
  r: Record<string, unknown>,
  templates: Map<number, Record<string, unknown>>,
  deptByEmp: Map<number, string>,
) {
  const day = ymd(r.day);
  const tpl = r.shift == null ? null : templates.get(num(r.shift));
  return {
    id: num(r.id),
    HotelName: "",
    employeeId: num(r.employee_id),
    workDate: day,
    department: deptByEmp.get(num(r.employee_id)) ?? "",
    startTime: tpl ? s(tpl.start_time) : hm(r.check_in),
    endTime: tpl ? s(tpl.end_time) : hm(r.check_out),
    notes: s(r.note),
    createdAt: "",
    employee: partialEmployee(r.employee_id, r.employee_name),
  };
}
function mapDocument(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    employeeId: r.employee == null ? 0 : num(r.employee),
    title: s(r.title),
    docType: s(r.kind),
    fileUrl: s(r.file_url),
    notes: s(r.decision_note),
    createdAt: s(r.uploaded_at),
    employee: partialEmployee(r.employee, r.employee_name),
  };
}
const PERIOD_STATUS: Record<string, string> = {
  OPEN: "open",
  AWAITING_MANAGER: "pending_generate",
  APPROVED: "approved",
  AWAITING_FINANCE: "awaiting_finance",
  CLOSED: "closed",
};
function mapPeriod(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    periodKey: s(r.period_key),
    monthName: s(r.month_name),
    fromYmd: ymd(r.from_ymd),
    toYmd: ymd(r.to_ymd),
    status: PERIOD_STATUS[s(r.status)] ?? low(r.status),
    notes: s(r.decision_note),
    createdBy: s(r.created_by),
    closedAt: r.closed_at ?? null,
    closedBy: s(r.closed_by),
    createdAt: s(r.created_at),
  };
}
const PAY_STATUS: Record<string, string> = {
  UNPAID: "unpaid",
  AWAITING_FINANCE: "awaiting_finance",
  MARKED_PAID: "marked_paid",
};
function mapPayslip(
  r: Record<string, unknown>,
  employees: Map<number, Emp>,
  periods: Map<number, Record<string, unknown>>,
) {
  const emp = employees.get(num(r.employee_id));
  const period = periods.get(num(r.period_id));
  const gross = num(r.gross);
  const deductions = num(r.deductions);
  const net = num(r.net);
  const periodKey = s(r.period_key) || s(period?.period_key);
  return {
    id: num(r.id),
    HotelName: "",
    periodId: num(r.period_id),
    employeeId: num(r.employee_id),
    payslipNumber: `PS-${s(r.period_id).padStart(4, "0")}-${s(r.id).padStart(4, "0")}`,
    employeeName: s(r.employee_name),
    jobTitle: s(r.job_title),
    taxPeriod: periodKey,
    organizationLocation: "",
    payDate: period ? ymd(period.to_ymd) : "",
    hireDate: emp ? ymd(emp.hired_on) : "",
    wageType: period ? low(period.wage_type_label) : "",
    bankName: s(r.bank_name),
    accountNumber: s(r.account_number),
    basePayETB: gross,
    overtimeETB: 0,
    tipsETB: 0,
    deductionsETB: deductions,
    netPayETB: net,
    grossSalaryETB: gross,
    totalEarningsETB: gross,
    totalDeductionsETB: deductions,
    earnings: [{ label: "Gross salary", amountETB: gross }],
    deductions: deductions ? [{ label: "Deductions", amountETB: deductions }] : [],
    paymentStatus: PAY_STATUS[s(r.status)] ?? low(r.status),
    hrMarkedPaidAt: r.hr_marked_paid_at ?? null,
    hrMarkedPaidBy: s(r.hr_marked_paid_by),
    managerApprovedAt: r.manager_approved_at ?? null,
    managerApprovedBy: s(r.manager_approved_by),
    notes: "",
    createdAt: s(r.created_at),
    employee: partialEmployee(r.employee_id, r.employee_name),
    period: period
      ? {
          id: num(period.id),
          periodKey: s(period.period_key),
          monthName: s(period.month_name),
          fromYmd: ymd(period.from_ymd),
          toYmd: ymd(period.to_ymd),
          status: PERIOD_STATUS[s(period.status)] ?? low(period.status),
        }
      : null,
  };
}
function mapRule(r: Record<string, unknown>) {
  const from = r.salary_from == null ? 0 : num(r.salary_from);
  const to = r.salary_to == null ? null : num(r.salary_to);
  return {
    id: num(r.id),
    HotelName: "",
    kind: low(r.kind),
    label: s(r.label),
    percentOfSalary: num(r.percent_of_salary),
    amountETB: 0,
    whenMode: low(r.when_mode),
    fromDay: null,
    toDay: null,
    fromYmd: ymd(r.start_ymd),
    toYmd: ymd(r.end_ymd),
    customized: from > 0 || to != null,
    fromAmountETB: from,
    toAmountETB: to,
    active: r.active !== false,
    sortOrder: 0,
  };
}
function mapWageWindow(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    wageType: low(r.code),
    fromDay: num(r.min_day) || 1,
    toDay: num(r.to_day) || 30,
    active: r.active !== false,
  };
}
function mapIncident(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    employeeId: r.employee == null ? 0 : num(r.employee),
    kind: s(r.kind),
    title: s(r.title),
    detail: s(r.detail),
    occurredYmd: ymd(r.occurred_ymd),
    recordedBy: "",
    salaryDeduct: Boolean(r.salary_deduct),
    percentOfSalary: 0,
    amountETB: num(r.amount_etb),
    createdAt: s(r.created_at),
    employee: partialEmployee(r.employee, r.employee_name),
  };
}
function libMeta(url: string) {
  const clean = url.split("?")[0];
  const name = clean.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return { fileOriginalName: name, fileFormat: dot >= 0 ? name.slice(dot + 1).toLowerCase() : "" };
}
function mapLibrary(r: Record<string, unknown>) {
  const url = s(r.file_url);
  return {
    id: num(r.id),
    HotelName: "",
    title: s(r.title),
    description: s(r.decision_note),
    fileSecureUrl: url,
    filePublicId: "",
    fileBytes: 0,
    ...libMeta(url),
    status: low(r.status),
    createdAt: s(r.uploaded_at),
  };
}

const PEOPLE_META = "\n<<meta>>";
function encodeMeta(detail: string, meta: Record<string, unknown>): string {
  return `${detail || ""}${PEOPLE_META}${JSON.stringify(meta)}`;
}
function decodeMeta(detail: string): { text: string; meta: Record<string, unknown> } {
  const idx = detail.indexOf(PEOPLE_META);
  if (idx < 0) return { text: detail, meta: {} };
  const text = detail.slice(0, idx);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(detail.slice(idx + PEOPLE_META.length)) as Record<string, unknown>;
  } catch {
    meta = {};
  }
  return { text, meta };
}

function mapShiftTemplate(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    code: s(r.code),
    name: s(r.name),
    department: "",
    startTime: s(r.start_time),
    endTime: s(r.end_time),
    weekdayJson: JSON.stringify(Array.isArray(r.weekdays) ? r.weekdays : []),
    notes: s(r.note),
    active: r.active !== false,
  };
}
async function mapShiftTemplates(rows: Record<string, unknown>[]) {
  return Promise.all(
    (rows || []).map(async (r) => ({
      ...mapShiftTemplate(r),
      department: await deptCode(r.department),
    })),
  );
}
function mapChecklistTemplate(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    kind: s(r.kind),
    name: s(r.name),
    active: r.active !== false,
    required: r.active !== false,
    department: "",
    jobTitle: s(r.job_title),
    teamId: r.team == null ? null : num(r.team),
    items: ((r.items as Record<string, unknown>[]) || []).map((i) => ({
      id: num(i.id),
      label: s(i.label),
      required: Boolean(i.required),
      defaultOwner: s(i.owner_role),
      sortOrder: num(i.sort_order),
    })),
  };
}
function mapChecklistRun(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    templateId: r.template == null ? 0 : num(r.template),
    employeeId: num(r.employee_id),
    kind: s(r.kind),
    status: low(r.status),
    items: ((r.items as Record<string, unknown>[]) || []).map((i) => ({
      id: num(i.id),
      label: s(i.label),
      required: Boolean(i.required),
      ownerRole: s(i.owner_role),
      done: Boolean(i.done),
      completedBy: s(i.completed_by),
      completedAt: i.completed_at ?? null,
      note: s(i.note),
      sortOrder: num(i.sort_order),
    })),
    createdAt: s(r.created_at),
  };
}
function mapComp(r: Record<string, unknown>) {
  const { text, meta } = decodeMeta(s(r.detail));
  return { raw: r, text, meta };
}

function baseComp(row: Record<string, unknown>) {
  const { text, meta } = mapComp(row);
  return {
    id: num(row.id),
    employeeId: num(row.employee_id),
    status: low(row.status),
    createdBy: s(row.created_by),
    createdAt: s(row.created_at),
    text,
    meta,
  };
}

function mapPeopleEvent(r: Record<string, unknown>) {
  const { text, meta } = decodeMeta(s(r.detail));
  return {
    id: num(r.id),
    employeeId: num(r.employee_id),
    kind: s(r.kind),
    text,
    meta,
    fromDept: "",
    toDept: "",
    fromTitle: s(r.from_title),
    toTitle: s(r.to_title),
    status: low(r.status),
    createdBy: s(r.created_by),
    createdAt: s(r.created_at),
  };
}

function mapAsset(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    employeeId: r.issued_to == null ? null : num(r.issued_to),
    label: s(r.label),
    serialNo: s(r.serial_number),
    status: low(r.status),
    issuedYmd: ymd(r.issued_at),
    returnedYmd: ymd(r.returned_at),
    notes: s(r.notes),
    createdBy: s(r.created_by),
    createdAt: s(r.created_at),
  };
}

async function mapChatMessage(r: Record<string, unknown> | null) {
  if (!r) return null;
  return {
    id: num(r.id),
    threadId: num(r.thread),
    senderEmployeeId: r.sender == null ? null : num(r.sender),
    senderIsManager: Boolean(r.sender_is_manager),
    body: s(r.body),
    imageUrl: s(r.image_url),
    createdAt: s(r.created_at),
    senderName: s(r.sender_name),
  };
}
async function mapChatThread(r: Record<string, unknown>) {
  const members = (r.members as Record<string, unknown>[]) || [];
  return {
    id: num(r.id),
    HotelName: s(r.tenant_name),
    kind: low(r.kind),
    title: s(r.title),
    createdByEmployeeId:
      r.created_by_employee == null ? null : num(r.created_by_employee),
    createdByManagerUserId: null,
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
    members: members.map((m) => ({
      id: num(m.id),
      threadId: num(m.thread),
      employeeId: m.employee == null ? null : num(m.employee),
      isManager: Boolean(m.is_manager),
      memberKey: s(m.member_key),
      joinedAt: s(m.joined_at),
      lastReadAt: m.last_read_at ?? null,
      employeeName: s(m.employee_name),
    })),
    lastMessage: await mapChatMessage(r.last_message as Record<string, unknown> | null),
    messageCount: r.message_count == null ? null : num(r.message_count),
  };
}
function mapChatBlock(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    HotelName: "",
    pathType: r.employee_b == null ? "emp_manager" : "emp_emp",
    employeeIdA: num(r.employee_a),
    employeeIdB: r.employee_b == null ? null : num(r.employee_b),
    note: s(r.note),
    createdBy: s(r.created_by),
    createdAt: s(r.created_at),
    employeeAName: s(r.employee_a_name),
    employeeBName: s(r.employee_b_name),
  };
}
function mapAtsOtp(r: Record<string, unknown>) {
  const active = s(r.status).toUpperCase() === "ACTIVE";
  return {
    id: num(r.id),
    tinNumber: "",
    HotelName: "",
    role: s(r.role) === "MANAGER" ? "Manager" : s(r.role),
    hasCode: active,
    awaitingFirstUnlock: active && !r.used_at,
    mustChangeOtp: Boolean(r.must_change_otp),
    updatedBy: s(r.generated_by),
    createdAt: s(r.generated_at),
    updatedAt: s(r.generated_at),
    otpIssuedAt: r.generated_at ?? null,
    firstUnlockAt: r.used_at ?? null,
    otpPreview: s(r.code),
  };
}

async function findPeriodForPayslips(ids: number[]): Promise<number> {
  const rows = await get<Record<string, unknown>[]>("/payroll/");
  const wanted = new Set(ids.map(num));
  const hit = (rows || []).find((r) => wanted.has(num(r.id)));
  return hit ? num(hit.period_id) : 0;
}

async function replaceAdjustments(rules: Record<string, unknown>[]) {
  const existing = await get<Record<string, unknown>[]>("/payroll-adjustments/");
  for (const row of existing || []) await del(`/payroll-adjustments/${num(row.id)}/`);
  for (const rule of rules) {
    await post("/payroll-adjustments/", {
      kind: s(rule.kind).toUpperCase(),
      label: s(rule.label),
      percent_of_salary: num(rule.percentOfSalary),
      when_mode: s(rule.whenMode || "always").toUpperCase(),
      salary_from: num(rule.fromAmountETB),
      salary_to: rule.toAmountETB ?? null,
      start_ymd: s(rule.fromYmd) || null,
      end_ymd: s(rule.toYmd) || null,
      active: rule.active !== false,
    });
  }
  const rows = await get<Record<string, unknown>[]>("/payroll-adjustments/");
  return (rows || []).map(mapRule);
}

function nameParts(full: string): [string, string] {
  const trimmed = full.trim();
  const idx = trimmed.indexOf(" ");
  if (idx < 0) return [trimmed, ""];
  return [trimmed.slice(0, idx), trimmed.slice(idx + 1).trim()];
}

async function employeePayload(v: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  if (v.fullName !== undefined) {
    const [first, last] = nameParts(s(v.fullName));
    payload.first_name = first;
    payload.last_name = last;
  }
  if (v.phone !== undefined) payload.phone = s(v.phone);
  if (v.email !== undefined) payload.email = s(v.email);
  if (v.jobTitle !== undefined) payload.job_title = s(v.jobTitle);
  if (v.orgPosition !== undefined) payload.org_position = s(v.orgPosition);
  if (v.hireDate !== undefined) payload.hired_on = s(v.hireDate) || null;
  if (v.baseSalaryETB !== undefined) payload.salary = num(v.baseSalaryETB);
  if (v.bankName !== undefined) payload.bank_name = s(v.bankName);
  if (v.accountNumber !== undefined) payload.account_number = s(v.accountNumber);
  if (v.gender !== undefined) payload.sex = s(v.gender);
  if (v.wageType !== undefined) payload.wage_type = s(v.wageType).toUpperCase();
  if (v.education !== undefined) payload.education = s(v.education);
  if (v.personalTin !== undefined) payload.personal_tin = s(v.personalTin);
  if (v.yearsExperience !== undefined)
    payload.years_experience = Math.round(num(v.yearsExperience));
  if (v.medicalNote !== undefined) payload.medical_note = s(v.medicalNote);
  if (v.notes !== undefined) payload.notes = s(v.notes);
  if (v.teamId !== undefined) payload.team = v.teamId ?? null;
  if (v.status !== undefined) payload.status = s(v.status).toUpperCase();
  if (v.department !== undefined) payload.department = await deptId(v.department);
  return payload;
}

async function op(name: string, v: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // ── dashboard / employees ──────────────────────────────────────────────
    case "hrDashboardStats": {
      const d = await get<Record<string, unknown>>("/dashboard/");
      return {
        headcount: num(d.headcount),
        onLeaveToday: num(d.on_leave),
        pendingLeave: num(d.pending_leaves),
        openShiftsToday: num(d.attendance_today),
        openPayrollPeriods: num(d.pending_payroll),
      };
    }
    case "hrEmployees":
      return mapEmployees(await get<Emp[]>("/employees/"));
    case "createHrEmployee": {
      const row = await post<Emp>("/employees/", await employeePayload(v));
      return mapEmployee(row);
    }
    case "updateHrEmployee":
    case "terminateHrEmployee": {
      const payload = await employeePayload(v);
      if (name === "terminateHrEmployee") payload.status = "TERMINATED";
      const row = await patch<Emp>(`/employees/${num(v.id)}/`, payload);
      return mapEmployee(row);
    }
    case "deleteHrEmployee": {
      await del(`/employees/${num(v.id)}/`);
      return true;
    }
    case "enableHrEmployeePortal": {
      const r = await post<Record<string, unknown>>(`/employees/${num(v.id)}/otp-reset/`);
      void r;
      const row = await get<Emp>(`/employees/${num(v.id)}/`);
      return mapEmployee(row);
    }
    case "createHrEmployeesBatch": {
      const rows = (v.employees as Record<string, unknown>[]) || [];
      const out = [];
      for (const item of rows) out.push(await mapEmployee(await post<Emp>("/employees/", await employeePayload(item))));
      return out;
    }

    // ── departments / teams / workflows ────────────────────────────────────
    case "hrDepartments": {
      const rows = await get<Record<string, unknown>[]>("/departments/");
      return (rows || []).map(mapDepartment);
    }
    case "replaceHrDepartments": {
      const items = (v.departments as Record<string, unknown>[]) || [];
      const saved = await syncByCode(
        "/departments/",
        items.map((item) => ({
          code: s(item.code),
          label: s(item.label),
          leader: s(item.leader),
        })),
      );
      deptCache = null;
      return saved.map(mapDepartment);
    }
    case "hrTeams": {
      const rows = await get<Record<string, unknown>[]>("/teams/", {
        department: v.departmentId ?? undefined,
      });
      return (rows || []).map(mapTeam);
    }
    case "upsertHrTeam": {
      const payload = {
        code: s(v.code),
        label: s(v.label),
        department: v.departmentId,
        active: v.active !== false,
      };
      const row = v.id
        ? await patch<Record<string, unknown>>(`/teams/${num(v.id)}/`, payload)
        : await post<Record<string, unknown>>("/teams/", payload);
      return mapTeam(row);
    }
    case "deleteHrTeam":
      await del(`/teams/${num(v.id)}/`);
      return true;
    case "hrApprovalFlows": {
      const rows = await get<Record<string, unknown>[]>("/workflows/", {
        request_type: v.requestType || undefined,
      });
      return (rows || []).map(mapWorkflow);
    }
    case "upsertHrApprovalFlow": {
      const payload = {
        request_type: s(v.requestType),
        department: v.departmentId ?? null,
        require_team_leader_first: Boolean(v.requireTeamLeaderFirst),
        steps: v.stepsJson ?? [],
        active: v.active !== false,
      };
      const row = v.id
        ? await patch<Record<string, unknown>>(`/workflows/${num(v.id)}/`, payload)
        : await post<Record<string, unknown>>("/workflows/", payload);
      return mapWorkflow(row);
    }
    case "deleteHrApprovalFlow":
      await del(`/workflows/${num(v.id)}/`);
      return true;

    // ── leave types / incident types ───────────────────────────────────────
    case "hrLeaveTypes": {
      const rows = await get<Record<string, unknown>[]>("/leave-types/");
      return (rows || []).map(mapLeaveType);
    }
    case "replaceHrLeaveTypes": {
      const items = (v.types as Record<string, unknown>[]) || [];
      const saved = await syncByCode(
        "/leave-types/",
        items.map((item) => ({
          code: s(item.code),
          label: s(item.label),
          paid: item.paid !== false,
          quota_days: num(item.defaultDays) || 15,
          active: item.active !== false,
        })),
      );
      return saved.map(mapLeaveType);
    }
    case "hrIncidentTypes": {
      const rows = await get<Record<string, unknown>[]>("/incident-types/");
      return (rows || []).map(mapIncidentType);
    }
    case "replaceHrIncidentTypes": {
      const items = (v.types as Record<string, unknown>[]) || [];
      const saved = await syncByCode(
        "/incident-types/",
        items.map((item) => ({
          code: s(item.code),
          label: s(item.label),
          deduct: Boolean(item.deduct),
          percent_of_salary: num(item.percentOfSalary),
          attendance_link: s(item.attendanceLink || "NONE").toUpperCase(),
          active: item.active !== false,
        })),
      );
      return saved.map(mapIncidentType);
    }

    // ── otp / notifications ────────────────────────────────────────────────
    case "requestHrOtpReset": {
      const row = await post<Record<string, unknown>>("/otp-resets/", {
        employee: v.employeeId,
      });
      return mapOtpReset(row);
    }
    case "decideHrOtpReset": {
      const row = await post<Record<string, unknown>>(
        `/otp-resets/${num(v.id)}/decision/`,
        { decision: v.approve ? "APPROVED" : "REJECTED" },
      );
      return mapOtpReset(row);
    }
    case "hrOtpResetRequests": {
      const rows = await get<Record<string, unknown>[]>("/otp-resets/", {
        status: v.status || undefined,
      });
      return (rows || []).map(mapOtpReset);
    }
    case "hrNotifications": {
      const rows = await get<Record<string, unknown>[]>("/notifications/", {
        unread: v.unreadOnly ? "1" : undefined,
      });
      return (rows || []).map(mapNotification);
    }
    case "markHrNotificationRead": {
      const row = await post<Record<string, unknown>>(`/notifications/${num(v.id)}/read/`);
      return mapNotification(row);
    }
    case "createHrEmployeeNotification": {
      const ids = (v.employeeIds as unknown[]) || [];
      const out = [];
      for (const employeeId of ids) {
        const row = await post<Record<string, unknown>>("/notifications/", {
          employee: employeeId,
          title: v.title,
          body: v.body,
          href: v.href,
        });
        out.push(mapNotification(row));
      }
      return out;
    }
    case "hrManagerPendingActions": {
      const payload = await get<Record<string, unknown>>("/approvals/queue/");
      const items = (payload.items as Record<string, unknown>[]) || [];
      return items.map((item) => ({
        id: num(item.id),
        HotelName: "",
        kind: s(item.type),
        employeeId: item.employee_id == null ? null : num(item.employee_id),
        payloadJson: item.payload ?? {},
        requestedBy: "",
        status: low(item.status),
        decidedBy: "",
        decidedAt: null,
        createdAt: s(item.created_at),
        employee: partialEmployee(item.employee_id, item.employee_name),
      }));
    }
    case "decideHrManagerPendingAction": {
      const payload = await get<Record<string, unknown>>("/approvals/queue/");
      const items = (payload.items as Record<string, unknown>[]) || [];
      const item = items.find((row) => num(row.id) === num(v.id));
      const kind = s(item?.type);
      const decision = v.approve ? "APPROVED" : "REJECTED";
      const paths: Record<string, string> = {
        leave: `/leaves/${num(v.id)}/decision/`,
        payroll_period: `/payroll-periods/${num(v.id)}/decision/`,
        incident: `/incidents/${num(v.id)}/decision/`,
        document: `/documents/${num(v.id)}/decision/`,
        attendance_correction: `/attendance/corrections/${num(v.id)}/decision/`,
        people_event: `/people-events/${num(v.id)}/decision/`,
        otp_reset: `/otp-resets/${num(v.id)}/decision/`,
        checklist_run: `/checklist-runs/${num(v.id)}/decision/`,
      };
      if (!paths[kind]) throw new Error("This approval type is not supported.");
      await post(paths[kind], { decision });
      return { id: num(v.id), status: low(decision) };
    }

    // ── leave ──────────────────────────────────────────────────────────────
    case "hrLeaveRequests": {
      const rows = await get<Record<string, unknown>[]>("/leaves/", {
        status: v.status || undefined,
      });
      return (rows || []).map(mapLeave);
    }
    case "createHrLeaveRequest": {
      const row = await post<Record<string, unknown>>("/leaves/", {
        employee: v.employeeId,
        leave_type: v.leaveType,
        from_ymd: v.fromYmd,
        to_ymd: v.toYmd,
        days: v.days ?? null,
        reason: v.reason ?? "",
      });
      return mapLeave(row);
    }
    case "decideHrLeaveRequest": {
      const row = await post<Record<string, unknown>>(`/leaves/${num(v.id)}/decision/`, {
        decision: v.approve ? "APPROVED" : "REJECTED",
      });
      return mapLeave(row);
    }
    case "hrLeaveBalances": {
      const rows = await get<Record<string, unknown>[]>("/leave-balances/", {
        employee: v.employeeId ?? undefined,
      });
      const out: Record<string, unknown>[] = [];
      for (const group of rows || []) {
        for (const b of (group.balances as Record<string, unknown>[]) || []) {
          out.push({
            id: b.id == null ? num(group.employee_id) * 1000 + out.length : num(b.id),
            HotelName: "",
            employeeId: num(group.employee_id),
            leaveType: s(b.leave_type),
            balanceDays: num(b.available_days),
            updatedAt: "",
            employee: partialEmployee(group.employee_id, group.employee_name),
          });
        }
      }
      return out;
    }
    case "upsertHrLeaveBalance": {
      const group = await post<Record<string, unknown>>("/leave-balances/", {
        employee: v.employeeId,
        leave_type: v.leaveType,
        entitled_days: v.balanceDays,
      });
      const b = ((group.balances as Record<string, unknown>[]) || []).find(
        (row) => low(row.leave_type) === low(v.leaveType),
      );
      return {
        id: b?.id == null ? 0 : num(b.id),
        leaveType: s(v.leaveType),
        balanceDays: b ? num(b.available_days) : num(v.balanceDays),
      };
    }

    // ── attendance & shifts ────────────────────────────────────────────────
    case "hrAttendance": {
      const rows = await get<Record<string, unknown>[]>("/attendance/", {
        from: v.fromYmd || undefined,
        to: v.toYmd || undefined,
        employee: v.employeeId ?? undefined,
      });
      return (rows || []).map(mapAttendance);
    }
    case "upsertHrAttendance": {
      const row = await post<Record<string, unknown>>("/attendance/", {
        employee: v.employeeId,
        day: v.workDate,
        check_in: hm(v.clockInAt) || null,
        check_out: hm(v.clockOutAt) || null,
        status: s(v.status || "PRESENT").toUpperCase(),
        note: v.notes ?? "",
      });
      return mapAttendance(row);
    }
    case "clockHrAttendance": {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toTimeString().slice(0, 8);
      const body: Record<string, unknown> = { employee: v.employeeId, day: today };
      if (v.action === "in") {
        body.check_in = now;
        body.status = "PRESENT";
      } else {
        body.check_out = now;
      }
      const row = await post<Record<string, unknown>>("/attendance/", body);
      return mapAttendance(row);
    }
    case "hrShifts": {
      const [rows, templates, employees] = await Promise.all([
        get<Record<string, unknown>[]>("/attendance/", {
          from: v.fromYmd || undefined,
          to: v.toYmd || undefined,
          employee: v.employeeId ?? undefined,
        }),
        get<Record<string, unknown>[]>("/shift-templates/"),
        get<Emp[]>("/employees/"),
      ]);
      const tplMap = new Map<number, Record<string, unknown>>();
      for (const t of templates || []) tplMap.set(num(t.id), t);
      const deptByEmp = new Map<number, string>();
      for (const e of employees || []) deptByEmp.set(num(e.id), await deptCode(e.department));
      return (rows || [])
        .filter((r) => low(r.status) !== "absent")
        .map((r) => mapShift(r, tplMap, deptByEmp));
    }
    case "createHrShift": {
      const row = await post<Record<string, unknown>>("/attendance/", {
        employee: v.employeeId,
        day: v.workDate,
        check_in: v.startTime || null,
        check_out: v.endTime || null,
        status: "PRESENT",
        note: v.notes ?? "",
      });
      return mapShift(row, new Map(), new Map());
    }
    case "updateHrShift": {
      const rows = await get<Record<string, unknown>[]>("/attendance/");
      const found = (rows || []).find((r) => num(r.id) === num(v.id));
      if (!found) throw new Error("Shift not found.");
      const row = await post<Record<string, unknown>>("/attendance/", {
        employee: v.employeeId ?? found.employee_id,
        day: v.workDate ?? ymd(found.day),
        check_in: v.startTime || null,
        check_out: v.endTime || null,
        note: v.notes ?? s(found.note),
      });
      return mapShift(row, new Map(), new Map());
    }
    case "deleteHrShift": {
      const rows = await get<Record<string, unknown>[]>("/attendance/");
      const found = (rows || []).find((r) => num(r.id) === num(v.id));
      if (!found) return true;
      await post("/attendance/", {
        employee: found.employee_id,
        day: ymd(found.day),
        status: "ABSENT",
        check_in: null,
        check_out: null,
        note: "",
      });
      return true;
    }

    // ── documents ──────────────────────────────────────────────────────────
    case "hrDocuments": {
      const rows = await get<Record<string, unknown>[]>("/documents/", {
        employee: v.employeeId ?? undefined,
      });
      return (rows || []).map(mapDocument);
    }
    case "createHrDocument": {
      const row = await post<Record<string, unknown>>("/documents/", {
        employee: v.employeeId,
        title: v.title,
        kind: v.docType || "Contract",
        file_url: v.fileUrl || "",
        decision_note: v.notes || "",
      });
      return mapDocument(row);
    }
    case "deleteHrDocument":
      await del(`/documents/${num(v.id)}/`);
      return true;
    case "hrLibraryDocuments": {
      const rows = await get<Record<string, unknown>[]>("/documents/");
      return (rows || []).map(mapLibrary);
    }
    case "createHrLibraryDocument":
    case "updateHrLibraryDocument": {
      if (name === "updateHrLibraryDocument") await del(`/documents/${num(v.id)}/`);
      const row = await post<Record<string, unknown>>("/documents/", {
        title: v.title,
        kind: "Library",
        file_url: v.fileSecureUrl || "",
        decision_note: v.description || "",
      });
      return mapLibrary(row);
    }
    case "deleteHrLibraryDocument":
      await del(`/documents/${num(v.id)}/`);
      return true;

    // ── payroll ────────────────────────────────────────────────────────────
    case "hrPayrollPeriods": {
      const rows = await get<Record<string, unknown>[]>("/payroll-periods/");
      return (rows || []).map(mapPeriod);
    }
    case "createHrPayrollPeriod": {
      const scope = s(v.wageScope);
      let wageId: number | null = null;
      if (scope === "monthly" || scope === "weekly") {
        const wages = await get<Record<string, unknown>[]>("/wage-types/");
        wageId = num((wages || []).find((w) => low(w.code) === scope)?.id) || null;
      }
      const row = await post<Record<string, unknown>>("/payroll-periods/", {
        period_key:
          scope === "monthly" || scope === "weekly"
            ? `${ymd(v.fromYmd).slice(0, 7)}-${scope === "monthly" ? "M" : "W"}`
            : ymd(v.fromYmd).slice(0, 7),
        from_ymd: v.fromYmd,
        to_ymd: v.toYmd,
        wage_type: wageId,
        month_name: "",
      });
      return mapPeriod(row);
    }
    case "hrPayslips": {
      const [rows, employees, periods] = await Promise.all([
        get<Record<string, unknown>[]>("/payroll/", {
          period: v.periodId ?? undefined,
          status: v.paymentStatus ? s(v.paymentStatus).toUpperCase() : undefined,
        }),
        employeeMap(),
        get<Record<string, unknown>[]>("/payroll-periods/"),
      ]);
      const pMap = new Map<number, Record<string, unknown>>();
      for (const p of periods || []) pMap.set(num(p.id), p);
      return (rows || []).map((r) => mapPayslip(r, employees, pMap));
    }
    case "markHrPayslipsPaid":
    case "decideHrPayslipsPayment":
    case "approveHrPayslipsPayment": {
      const ids = (v.payslipIds as unknown[]) || [];
      const periodId = await findPeriodForPayslips(ids.map(num));
      if (!periodId) throw new Error("Could not locate the payroll run.");
      const path =
        name === "markHrPayslipsPaid"
          ? `/payroll-periods/${periodId}/mark-paid/`
          : `/payroll-periods/${periodId}/payment-decision/`;
      await post(path, {
        payslip_ids: ids,
        ...(name === "markHrPayslipsPaid"
          ? {}
          : { decision: name === "approveHrPayslipsPayment" ? "APPROVED" : v.approve ? "APPROVED" : "REJECTED" }),
      });
      const [rows, employees, periods] = await Promise.all([
        get<Record<string, unknown>[]>("/payroll/", { period: periodId }),
        employeeMap(),
        get<Record<string, unknown>[]>("/payroll-periods/"),
      ]);
      const pMap = new Map<number, Record<string, unknown>>();
      for (const p of periods || []) pMap.set(num(p.id), p);
      return (rows || []).map((r) => mapPayslip(r, employees, pMap));
    }
    case "closeHrPayrollPeriod": {
      await post(`/payroll-periods/${num(v.id)}/close/`);
      const row = await get<Record<string, unknown>>(`/payroll-periods/${num(v.id)}/`);
      return mapPeriod(row);
    }
    case "hrPayrollLineRules": {
      const rows = await get<Record<string, unknown>[]>("/payroll-adjustments/");
      return (rows || []).map(mapRule);
    }
    case "replaceHrPayrollLineRules":
      return replaceAdjustments((v.rules as Record<string, unknown>[]) || []);
    case "hrWagePayWindows": {
      const rows = await get<Record<string, unknown>[]>("/wage-types/");
      return (rows || []).map(mapWageWindow);
    }
    case "replaceHrWagePayWindows": {
      const windows = (v.windows as Record<string, unknown>[]) || [];
      const existing = await get<Record<string, unknown>[]>("/wage-types/");
      for (const w of windows) {
        const code = s(w.wageType).toUpperCase();
        const found = (existing || []).find((row) => s(row.code).toUpperCase() === code);
        const payload = {
          code,
          name: s(w.wageType),
          frequency: code === "WEEKLY" ? "WEEKLY" : "MONTHLY",
          min_day: num(w.fromDay) || 1,
          to_day: num(w.toDay) || 30,
          active: w.active !== false,
        };
        if (found) await patch(`/wage-types/${num(found.id)}/`, payload);
        else await post("/wage-types/", payload);
      }
      const rows = await get<Record<string, unknown>[]>("/wage-types/");
      return (rows || []).map(mapWageWindow);
    }
    case "hrPayrollStatBands":
      // Backend has no statutory-band model yet.
      return [];
    case "replaceHrPayrollStatBands":
      return [];

    // ── incidents ──────────────────────────────────────────────────────────
    case "hrIncidents": {
      const rows = await get<Record<string, unknown>[]>("/incidents/", {
        employee: v.employeeId ?? undefined,
      });
      return (rows || []).map(mapIncident);
    }
    case "createHrIncident": {
      const row = await post<Record<string, unknown>>("/incidents/", {
        employee: v.employeeId,
        kind: v.kind || "Conduct",
        title: v.title,
        detail: v.detail || "",
        occurred_ymd: v.occurredYmd || new Date().toISOString().slice(0, 10),
        salary_deduct: Boolean(v.salaryDeduct),
        amount_etb: num(v.amountETB),
      });
      return mapIncident(row);
    }
    case "deleteHrIncident":
      // No delete route exists; resolve it via the manager decision instead.
      throw new Error("Incident deletion is not supported by the backend.");

    case "hrPayrollBankExport": {
      const rows = await get<Record<string, unknown>[]>("/payroll/", {
        period: v.periodId,
      });
      return (rows || []).map((r) => ({
        payslipId: num(r.id),
        employeeId: num(r.employee_id),
        employeeName: s(r.employee_name),
        bankName: s(r.bank_name),
        accountNumber: s(r.account_number),
        netPayETB: num(r.net),
        payslipNumber: `PS-${s(r.period_id).padStart(4, "0")}-${s(r.id).padStart(4, "0")}`,
      }));
    }

    // ── phase B: shift templates ───────────────────────────────────────────
    case "hrShiftTemplates":
      return mapShiftTemplates(await get<Record<string, unknown>[]>("/shift-templates/"));
    case "upsertHrShiftTemplate": {
      const input = (v.input as Record<string, unknown>) || {};
      let weekdays: unknown = input.weekdayJson;
      try {
        weekdays = JSON.parse(s(input.weekdayJson) || "[]");
      } catch {
        weekdays = [1, 2, 3, 4, 5];
      }
      const payload = {
        code: s(input.code),
        name: s(input.name),
        department: await deptId(input.department),
        start_time: s(input.startTime) || "09:00",
        end_time: s(input.endTime) || "17:00",
        weekdays,
        note: s(input.notes),
        active: input.active !== false,
      };
      const row = input.id
        ? await patch<Record<string, unknown>>(`/shift-templates/${num(input.id)}/`, payload)
        : await post<Record<string, unknown>>("/shift-templates/", payload);
      return { ...mapShiftTemplate(row), department: await deptCode(row.department) };
    }
    case "deleteHrShiftTemplate":
      await del(`/shift-templates/${num(v.id)}/`);
      return true;
    case "applyHrShiftTemplate": {
      const tpl = await get<Record<string, unknown>>(`/shift-templates/${num(v.templateId)}/`);
      const weekdays = ((tpl.weekdays as number[]) || []).map(num);
      const from = new Date(`${v.fromYmd}T00:00:00`);
      const to = new Date(`${v.toYmd}T00:00:00`);
      let count = 0;
      for (const employeeId of (v.employeeIds as unknown[]) || []) {
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          const jsDay = d.getDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;
          if (weekdays.length && !weekdays.includes(isoDay)) continue;
          const day = d.toISOString().slice(0, 10);
          await post("/attendance/", {
            employee: employeeId,
            day,
            shift: num(v.templateId),
            status: "PRESENT",
          });
          count += 1;
        }
      }
      return count;
    }

    // ── phase B: checklists ────────────────────────────────────────────────
    case "hrChecklistTemplates": {
      const rows = await get<Record<string, unknown>[]>("/checklists/", {
        kind: v.kind || undefined,
      });
      const mapped = (rows || []).map(mapChecklistTemplate);
      return Promise.all(
        mapped.map(async (row) => ({
          ...row,
          department: await deptCode((rows || []).find((r) => num(r.id) === row.id)?.department),
        })),
      );
    }
    case "saveHrChecklistTemplate": {
      const payload = {
        kind: s(v.kind),
        name: s(v.name),
        active: v.active !== false,
        department: await deptId(v.department),
        job_title: s(v.jobTitle),
        team: v.teamId ?? null,
        items: ((v.items as Record<string, unknown>[]) || []).map((i, index) => ({
          label: s(i.label),
          required: Boolean(i.required),
          owner_role: s(i.defaultOwner),
          sort_order: num(i.sortOrder) || index,
        })),
      };
      const row = v.id
        ? await patch<Record<string, unknown>>(`/checklists/${num(v.id)}/`, payload)
        : await post<Record<string, unknown>>("/checklists/", payload);
      return mapChecklistTemplate(row);
    }
    case "deleteHrChecklistTemplate":
      await del(`/checklists/${num(v.id)}/`);
      return true;
    case "hrChecklistRuns": {
      const rows = await get<Record<string, unknown>[]>("/checklist-runs/", {
        employee: v.employeeId ?? undefined,
        kind: v.kind || undefined,
      });
      return (rows || []).map(mapChecklistRun);
    }
    case "startHrChecklistRun": {
      const templates = await get<Record<string, unknown>[]>("/checklists/", { kind: v.kind });
      const template = (templates || [])[0];
      if (!template) throw new Error("No checklist template found for this kind.");
      const row = await post<Record<string, unknown>>("/checklist-runs/", {
        employee: v.employeeId,
        template: num(template.id),
      });
      return mapChecklistRun(row);
    }
    case "toggleHrChecklistRunItem": {
      const runs = await get<Record<string, unknown>[]>("/checklist-runs/");
      const run = (runs || []).find((row) =>
        ((row.items as Record<string, unknown>[]) || []).some((i) => num(i.id) === num(v.id)),
      );
      if (!run) throw new Error("Checklist item not found.");
      const row = await post<Record<string, unknown>>(
        `/checklist-runs/${num(run.id)}/items/${num(v.id)}/toggle/`,
        { done: Boolean(v.done), note: v.note ?? "" },
      );
      return {
        id: num(row.id),
        done: Boolean(row.done),
        completedBy: s(row.completed_by),
        completedAt: row.completed_at ?? null,
        note: s(row.note),
      };
    }
    case "completeHrChecklistRun": {
      const row = await post<Record<string, unknown>>(`/checklist-runs/${num(v.id)}/complete/`);
      return { id: num(row.id), status: low(row.status) };
    }
    case "approveHrChecklistRun": {
      const row = await post<Record<string, unknown>>(`/checklist-runs/${num(v.id)}/decision/`, {
        decision: v.approve ? "APPROVED" : "REJECTED",
      });
      return { id: num(row.id), status: low(row.status) };
    }

    // ── phase B: compensation ──────────────────────────────────────────────
    case "hrSalaryHistory":
    case "hrAdvanceRequests":
    case "hrLoans":
    case "hrBonuses":
    case "hrOvertimeRequests": {
      const kindMap: Record<string, string> = {
        hrSalaryHistory: "salary_change",
        hrAdvanceRequests: "advance",
        hrLoans: "loan",
        hrBonuses: "bonus",
        hrOvertimeRequests: "overtime",
      };
      const rows = await get<Record<string, unknown>[]>("/compensation/", {
        kind: kindMap[name],
        status: v.status || undefined,
        employee: v.employeeId ?? undefined,
      });
      return (rows || []).map((r) => {
        const b = baseComp(r);
        if (name === "hrSalaryHistory")
          return {
            id: b.id,
            employeeId: b.employeeId,
            previousETB: num(b.meta.previousETB),
            newETB: num(r.amount),
            reason: b.text,
            status: b.status,
            changedBy: b.createdBy,
            decidedBy: s(r.decided_by),
            createdAt: b.createdAt,
          };
        if (name === "hrAdvanceRequests")
          return {
            id: b.id,
            employeeId: b.employeeId,
            amountETB: num(r.amount),
            reason: b.text,
            status: b.status,
            requestedBy: b.createdBy,
            createdAt: b.createdAt,
          };
        if (name === "hrLoans")
          return {
            id: b.id,
            employeeId: b.employeeId,
            principalETB: num(r.amount),
            remainingETB: num(b.meta.remainingETB ?? r.amount),
            installmentETB: num(b.meta.installmentETB),
            reason: b.text,
            status: b.status,
            createdBy: b.createdBy,
            createdAt: b.createdAt,
          };
        if (name === "hrBonuses")
          return {
            id: b.id,
            employeeId: b.employeeId,
            label: s(b.meta.label) || "Bonus",
            amountETB: num(r.amount),
            status: b.status,
            createdBy: b.createdBy,
            createdAt: b.createdAt,
          };
        return {
          id: b.id,
          employeeId: b.employeeId,
          workYmd: ymd(b.meta.workYmd),
          hours: num(b.meta.hours),
          amountETB: num(r.amount),
          reason: b.text,
          status: b.status,
          requestedBy: b.createdBy,
          createdAt: b.createdAt,
        };
      });
    }
    case "requestHrSalaryChange": {
      const emp = await get<Emp>(`/employees/${num(v.employeeId)}/`);
      const row = await post<Record<string, unknown>>("/compensation/", {
        employee: v.employeeId,
        kind: "salary_change",
        amount: v.newETB,
        detail: encodeMeta(s(v.reason), { previousETB: num(emp.salary) }),
      });
      const b = baseComp(row);
      return {
        id: b.id,
        status: b.status,
        previousETB: num(emp.salary),
        newETB: num(row.amount),
      };
    }
    case "createHrAdvanceRequest":
    case "createHrLoan":
    case "createHrBonus":
    case "createHrOvertimeRequest": {
      const kindMap: Record<string, string> = {
        createHrAdvanceRequest: "advance",
        createHrLoan: "loan",
        createHrBonus: "bonus",
        createHrOvertimeRequest: "overtime",
      };
      const meta: Record<string, unknown> = {};
      if (name === "createHrLoan") {
        meta.installmentETB = num(v.installmentETB);
        meta.remainingETB = num(v.principalETB);
      }
      if (name === "createHrBonus") meta.label = s(v.label);
      if (name === "createHrOvertimeRequest") {
        meta.workYmd = s(v.workYmd);
        meta.hours = num(v.hours);
      }
      const detail =
        name === "createHrBonus"
          ? encodeMeta("", meta)
          : encodeMeta(s(v.reason), meta);
      const amount =
        name === "createHrLoan"
          ? v.principalETB
          : name === "createHrBonus"
            ? v.amountETB
            : v.amountETB;
      const row = await post<Record<string, unknown>>("/compensation/", {
        employee: v.employeeId,
        kind: kindMap[name],
        amount,
        effective_ymd: name === "createHrOvertimeRequest" ? v.workYmd : null,
        detail,
      });
      return { id: num(row.id), status: low(row.status) };
    }
    case "decideHrSalaryChange":
    case "decideHrAdvanceRequest":
    case "decideHrLoan":
    case "decideHrBonus":
    case "decideHrOvertimeRequest": {
      const row = await post<Record<string, unknown>>(`/compensation/${num(v.id)}/decision/`, {
        decision: v.approve ? "APPROVED" : "REJECTED",
      });
      return { id: num(row.id), status: low(row.status) };
    }

    // ── phase B: people events ─────────────────────────────────────────────
    case "hrCareerActions":
    case "hrDisciplinaryActions":
    case "hrPerformanceReviews":
    case "hrTrainingAssignments":
    case "hrBenefitAssignments": {
      const kindMap: Record<string, string> = {
        hrCareerActions: "career",
        hrDisciplinaryActions: "disciplinary",
        hrPerformanceReviews: "performance",
        hrTrainingAssignments: "training",
        hrBenefitAssignments: "benefits",
      };
      const rows = await get<Record<string, unknown>[]>("/people-events/", {
        status: v.status || undefined,
        employee: v.employeeId ?? undefined,
      });
      return (rows || [])
        .filter((r) => {
          const kind = s(r.kind);
          if (kindMap[name] === "career") return ["promotion", "transfer", "other", "termination"].includes(kind);
          return kind === kindMap[name];
        })
        .map((r) => {
          const p = mapPeopleEvent(r);
          if (name === "hrCareerActions")
            return {
              id: p.id,
              employeeId: p.employeeId,
              kind: s(p.meta.actionKind) || p.kind,
              detail: p.text,
              fromDept: s(p.meta.fromDept),
              toDept: s(p.meta.toDept),
              fromTitle: p.fromTitle,
              toTitle: p.toTitle,
              toTeamId: p.meta.toTeamId == null ? null : num(p.meta.toTeamId),
              toOrgPosition: s(p.meta.toOrgPosition),
              status: p.status,
              createdBy: p.createdBy,
              createdAt: p.createdAt,
            };
          if (name === "hrDisciplinaryActions")
            return {
              id: p.id,
              employeeId: p.employeeId,
              title: s(p.meta.title),
              detail: p.text,
              status: p.status,
              createdBy: p.createdBy,
              createdAt: p.createdAt,
            };
          if (name === "hrPerformanceReviews")
            return {
              id: p.id,
              employeeId: p.employeeId,
              periodLabel: s(p.meta.periodLabel),
              rating: s(p.meta.rating),
              summary: p.text,
              status: p.status,
              createdBy: p.createdBy,
              createdAt: p.createdAt,
            };
          if (name === "hrTrainingAssignments")
            return {
              id: p.id,
              employeeId: p.employeeId,
              title: s(p.meta.title),
              detail: p.text,
              dueYmd: s(p.meta.dueYmd),
              status: p.status,
              createdBy: p.createdBy,
              createdAt: p.createdAt,
            };
          return {
            id: p.id,
            employeeId: p.employeeId,
            kind: s(p.meta.benefitKind),
            label: s(p.meta.label),
            amountETB: num(p.meta.amountETB),
            status: p.status,
            createdBy: p.createdBy,
            createdAt: p.createdAt,
          };
        });
    }
    case "createHrCareerAction": {
      const deptFrom = await deptId(v.fromDept);
      const deptTo = await deptId(v.toDept);
      const row = await post<Record<string, unknown>>("/people-events/", {
        employee: v.employeeId,
        kind: s(v.kind) === "transfer" ? "transfer" : s(v.kind) === "promotion" ? "promotion" : "other",
        detail: encodeMeta(s(v.detail), {
          actionKind: s(v.kind),
          fromDept: s(v.fromDept),
          toDept: s(v.toDept),
          toTeamId: v.toTeamId ?? null,
          toOrgPosition: s(v.toOrgPosition),
        }),
        from_department: deptFrom,
        to_department: deptTo,
        from_title: s(v.fromTitle),
        to_title: s(v.toTitle),
      });
      return { id: num(row.id), status: low(row.status) };
    }
    case "createHrDisciplinaryAction": {
      const row = await post<Record<string, unknown>>("/people-events/", {
        employee: v.employeeId,
        kind: "disciplinary",
        detail: encodeMeta(s(v.detail), { title: s(v.title) }),
      });
      return { id: num(row.id), status: low(row.status) };
    }
    case "createHrPerformanceReview": {
      const row = await post<Record<string, unknown>>("/people-events/", {
        employee: v.employeeId,
        kind: "performance",
        detail: encodeMeta(s(v.summary), {
          periodLabel: s(v.periodLabel),
          rating: s(v.rating),
        }),
      });
      return { id: num(row.id), status: low(row.status) };
    }
    case "createHrTrainingAssignment": {
      const row = await post<Record<string, unknown>>("/people-events/", {
        employee: v.employeeId,
        kind: "training",
        detail: encodeMeta(s(v.detail), { title: s(v.title), dueYmd: s(v.dueYmd) }),
        effective_ymd: s(v.dueYmd) || null,
      });
      return { id: num(row.id), status: low(row.status) };
    }
    case "createHrBenefitAssignment": {
      const row = await post<Record<string, unknown>>("/people-events/", {
        employee: v.employeeId,
        kind: "benefits",
        detail: encodeMeta("", {
          benefitKind: s(v.kind),
          label: s(v.label),
          amountETB: num(v.amountETB),
        }),
      });
      return { id: num(row.id), status: low(row.status) };
    }
    case "decideHrCareerAction":
    case "decideHrDisciplinaryAction":
    case "finalizeHrPerformanceReview":
    case "decideHrTrainingAssignment":
    case "decideHrBenefitAssignment": {
      const row = await post<Record<string, unknown>>(`/people-events/${num(v.id)}/decision/`, {
        decision: v.approve ? "APPROVED" : "REJECTED",
      });
      return { id: num(row.id), status: low(row.status) };
    }

    // ── phase B: assets ────────────────────────────────────────────────────
    // HR's own register (/api/hr/assets/). The inventory asset table stays
    // with Manager/Finance so the two never share a row.
    case "hrAssets": {
      const rows = await get<Record<string, unknown>[]>("/assets/", {
        status: v.status || undefined,
      });
      return (rows || []).map(mapAsset);
    }
    case "createHrAsset": {
      const row = await post<Record<string, unknown>>("/assets/", {
        label: v.label,
        serial_number: v.serialNo || "",
        notes: v.notes || "",
      });
      return mapAsset(row);
    }
    case "issueHrAsset": {
      const row = await post<Record<string, unknown>>(
        `/assets/${num(v.id)}/issue/`,
        { employee: num(v.employeeId), issued_at: v.issuedYmd || undefined },
      );
      return mapAsset(row);
    }
    case "returnHrAsset": {
      const row = await post<Record<string, unknown>>(
        `/assets/${num(v.id)}/return/`,
        { returned_at: v.returnedYmd || undefined },
      );
      return mapAsset(row);
    }

    // ── chat ───────────────────────────────────────────────────────────────
    case "hrChatThreads": {
      const rows = await get<Record<string, unknown>[]>("/chat/threads/");
      return Promise.all((rows || []).map(mapChatThread));
    }
    case "hrChatMessages": {
      const rows = await get<Record<string, unknown>[]>(
        `/chat/threads/${num(v.threadId)}/messages/`,
        { limit: v.limit ?? undefined },
      );
      return Promise.all((rows || []).map(mapChatMessage));
    }
    case "hrChatBlocks": {
      const rows = await get<Record<string, unknown>[]>("/chat/blocks/");
      return (rows || []).map(mapChatBlock);
    }
    case "hrChatHistory": {
      const rows = await get<Record<string, unknown>[]>("/chat/threads/");
      const mapped = await Promise.all((rows || []).map(mapChatThread));
      if (!v.employeeId) return mapped;
      return mapped.filter((t) =>
        t.members.some((m) => m.employeeId === num(v.employeeId)),
      );
    }
    case "hrChatUnreadCount":
      return 0;
    case "createHrChatDirect":
    case "createHrChatGroup": {
      const employees = name === "createHrChatDirect" ? [v.employeeId] : v.employeeIds || [];
      const row = await post<Record<string, unknown>>("/chat/threads/", {
        employee_ids: employees,
        group: name === "createHrChatGroup",
        title: name === "createHrChatGroup" ? v.title : "",
      });
      return mapChatThread(row);
    }
    case "sendHrChatMessage": {
      const row = await post<Record<string, unknown>>(
        `/chat/threads/${num(v.threadId)}/messages/`,
        { body: v.body ?? "", image_url: v.imageUrl ?? "" },
      );
      return mapChatMessage(row);
    }
    case "markHrChatThreadRead": {
      const row = await post<Record<string, unknown>>(`/chat/threads/${num(v.threadId)}/read/`);
      return mapChatThread(row);
    }
    case "createHrChatBlock": {
      const row = await post<Record<string, unknown>>("/chat/blocks/", {
        employee_a: v.employeeIdA,
        employee_b: v.pathType === "emp_manager" ? null : v.employeeIdB,
        note: v.note ?? "",
      });
      return mapChatBlock(row);
    }
    case "deleteHrChatBlock":
      await del(`/chat/blocks/${num(v.id)}/`);
      return true;

    // ── ATS access codes ───────────────────────────────────────────────────
    case "atsAccessOtps": {
      const rows = await get<Record<string, unknown>[]>("/ats-otps/");
      return (rows || []).map(mapAtsOtp);
    }
    case "upsertAtsAccessOtp": {
      const role = s(v.role).toUpperCase();
      const row = await post<Record<string, unknown>>("/ats-otps/", { role });
      return mapAtsOtp(row);
    }
    case "deleteAtsAccessOtp": {
      const rows = await get<Record<string, unknown>[]>("/ats-otps/");
      const role = s(v.role).toUpperCase();
      const hit = (rows || []).find(
        (r) => s(r.role).toUpperCase() === role || s(r.role).toUpperCase() === (role === "MANAGER" ? "MANAGER" : "HR"),
      );
      if (hit) await del(`/ats-otps/${num(hit.id)}/`);
      return true;
    }

    default:
      throw new Error(`Unsupported HR operation: ${name}`);
  }
}

/** Drop-in replacement for the hotcol GraphQL helper. */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const match = query.match(/(?:query|mutation)[\s\S]*?\{\s*(\w+)/);
  const name = match?.[1];
  if (!name) throw new Error("Malformed HR request.");
  const value = await op(name, variables ?? {});
  return { [name]: value } as T;
}
