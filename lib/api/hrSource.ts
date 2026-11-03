import { gql } from "@/lib/api/hrDjango";

export type HrEmployee = {
  id: number;
  HotelName: string;
  fullName: string;
  phone: string;
  email: string;
  department: string;
  jobTitle: string;
  orgPosition: string;
  teamId: number | null;
  status: string;
  hireDate: string;
  endDate: string;
  wageType: string;
  baseSalaryETB: number;
  bankName: string;
  accountNumber: string;
  credentialUserId: number | null;
  credentialUserName: string;
  notes: string;
  portalOtpPreview: string;
  portalOtpViewer: string;
  mustChangeOtp: boolean;
  portalOtpIssuedAt: string | null;
  portalFirstLoginAt: string | null;
  profileImageUrl: string;
  gender?: string;
  education?: string;
  personalTin?: string;
  yearsExperience?: number;
  medicalNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type HrTeam = {
  id: number;
  HotelName: string;
  departmentId: number;
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export type HrApprovalFlow = {
  id: number;
  HotelName: string;
  requestType: string;
  departmentId: number | null;
  requireTeamLeaderFirst: boolean;
  stepsJson: unknown;
  active: boolean;
};

export type HrNotification = {
  id: number;
  HotelName: string;
  recipientRole: string;
  employeeId: number | null;
  kind: string;
  title: string;
  body: string;
  href: string;
  actionStatus: string;
  createdBy: string;
  readAt: string | null;
  createdAt: string;
};

export type HrOtpResetRequest = {
  id: number;
  HotelName: string;
  employeeId: number;
  requestedBy: string;
  status: string;
  decidedBy: string;
  decidedAt: string | null;
  createdAt: string;
  portalOtpPreview: string;
  employee?: HrEmployee | null;
};

export type HrManagerPendingAction = {
  id: number;
  HotelName: string;
  kind: string;
  employeeId: number | null;
  payloadJson: unknown;
  requestedBy: string;
  status: string;
  decidedBy: string;
  decidedAt: string | null;
  createdAt: string;
  employee?: HrEmployee | null;
};

export type HrLeaveType = {
  id: number;
  HotelName: string;
  code: string;
  label: string;
  paid: boolean;
  defaultDays: number;
  active: boolean;
  sortOrder: number;
};

export type HrDepartment = {
  id: number;
  HotelName: string;
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export type HrIncidentType = {
  id: number;
  HotelName: string;
  code: string;
  label: string;
  deduct: boolean;
  percentOfSalary: number;
  amountETB: number;
  /** "" | absent | late | half_day — payroll multiplies percent by matching attendance days */
  attendanceLink: string;
  active: boolean;
  sortOrder: number;
};

export type HrLeaveRequest = {
  id: number;
  HotelName: string;
  employeeId: number;
  leaveType: string;
  fromYmd: string;
  toYmd: string;
  days: number;
  reason: string;
  status: string;
  flowId?: number | null;
  currentStepIndex?: number;
  /** Waiting step kind when pending: hr | manager | department_leader | … */
  currentStepKind?: string;
  decidedBy: string;
  decidedAt: string | null;
  createdAt: string;
  employee?: HrEmployee | null;
};

export type HrLeaveBalance = {
  id: number;
  HotelName: string;
  employeeId: number;
  leaveType: string;
  balanceDays: number;
  updatedAt: string;
  employee?: HrEmployee | null;
};

export type HrAttendance = {
  id: number;
  HotelName: string;
  employeeId: number;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: string;
  notes: string;
  createdAt: string;
  employee?: HrEmployee | null;
};

export type HrShift = {
  id: number;
  HotelName: string;
  employeeId: number;
  workDate: string;
  department: string;
  startTime: string;
  endTime: string;
  notes: string;
  createdAt: string;
  employee?: HrEmployee | null;
};

export type HrDocument = {
  id: number;
  HotelName: string;
  employeeId: number;
  title: string;
  docType: string;
  fileUrl: string;
  notes: string;
  createdAt: string;
  employee?: HrEmployee | null;
};

export type HrPayrollPeriod = {
  id: number;
  HotelName: string;
  periodKey: string;
  monthName: string;
  fromYmd: string;
  toYmd: string;
  status: string;
  notes: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string;
  createdAt: string;
};

export type HrPayslipLine = {
  label: string;
  amountETB: number;
};

export type HrPayslip = {
  id: number;
  HotelName: string;
  periodId: number;
  employeeId: number;
  payslipNumber: string;
  employeeName: string;
  jobTitle: string;
  taxPeriod: string;
  organizationLocation: string;
  payDate: string;
  hireDate: string;
  wageType: string;
  bankName: string;
  accountNumber: string;
  basePayETB: number;
  overtimeETB: number;
  tipsETB: number;
  deductionsETB: number;
  netPayETB: number;
  grossSalaryETB: number;
  totalEarningsETB: number;
  totalDeductionsETB: number;
  earnings: HrPayslipLine[];
  deductions: HrPayslipLine[];
  paymentStatus: string;
  hrMarkedPaidAt: string | null;
  hrMarkedPaidBy: string;
  managerApprovedAt: string | null;
  managerApprovedBy: string;
  notes: string;
  createdAt: string;
  employee?: HrEmployee | null;
  period?: HrPayrollPeriod | null;
};

export type HrPayrollLineRule = {
  id: number;
  HotelName: string;
  kind: string;
  label: string;
  percentOfSalary: number;
  amountETB: number;
  whenMode: string;
  fromDay: number | null;
  toDay: number | null;
  fromYmd: string;
  toYmd: string;
  customized: boolean;
  fromAmountETB: number;
  toAmountETB: number | null;
  active: boolean;
  sortOrder: number;
};

export type HrWagePayWindow = {
  id: number;
  HotelName: string;
  wageType: string;
  fromDay: number;
  toDay: number;
  active: boolean;
};

export type HrIncident = {
  id: number;
  HotelName: string;
  employeeId: number;
  kind: string;
  title: string;
  detail: string;
  occurredYmd: string;
  recordedBy: string;
  salaryDeduct?: boolean;
  percentOfSalary?: number;
  amountETB?: number;
  createdAt: string;
  employee?: HrEmployee | null;
};

export type HrDashboardStats = {
  headcount: number;
  onLeaveToday: number;
  pendingLeave: number;
  openShiftsToday: number;
  openPayrollPeriods: number;
};

const EMP_FIELDS = `
  id HotelName fullName phone email department jobTitle orgPosition teamId status
  hireDate endDate wageType baseSalaryETB bankName accountNumber
  credentialUserId credentialUserName notes
  portalOtpPreview portalOtpViewer mustChangeOtp portalOtpIssuedAt portalFirstLoginAt
  profileImageUrl gender education personalTin yearsExperience medicalNote createdAt updatedAt
`;

const PAYSLIP_FIELDS = `
  id HotelName periodId employeeId payslipNumber employeeName jobTitle
  taxPeriod organizationLocation payDate hireDate wageType bankName accountNumber
  basePayETB overtimeETB tipsETB deductionsETB netPayETB
  grossSalaryETB totalEarningsETB totalDeductionsETB
  earnings { label amountETB } deductions { label amountETB }
  paymentStatus hrMarkedPaidAt hrMarkedPaidBy managerApprovedAt managerApprovedBy
  notes createdAt
  employee { id fullName }
  period { id periodKey monthName fromYmd toYmd status }
`;


export async function fetchHrDashboardStats(): Promise<HrDashboardStats> {
  const data = await gql<{ hrDashboardStats: HrDashboardStats }>(`
    query { hrDashboardStats { headcount onLeaveToday pendingLeave openShiftsToday openPayrollPeriods } }
  `);
  return data.hrDashboardStats;
}

export async function fetchHrEmployees(): Promise<HrEmployee[]> {
  const data = await gql<{ hrEmployees: HrEmployee[] }>(`
    query { hrEmployees { ${EMP_FIELDS} } }
  `);
  return data.hrEmployees || [];
}

export async function createHrEmployeeApi(input: {
  fullName: string;
  phone?: string;
  email?: string;
  department?: string;
  jobTitle?: string;
  orgPosition?: string;
  teamId?: number | null;
  hireDate?: string;
  wageType?: string;
  baseSalaryETB?: number;
  bankName?: string;
  accountNumber?: string;
  notes?: string;
  gender?: string;
  education?: string;
  personalTin?: string;
  yearsExperience?: number;
  medicalNote?: string;
}): Promise<HrEmployee> {
  const data = await gql<{ createHrEmployee: HrEmployee }>(
    `mutation (
      $fullName: String!
      $phone: String
      $email: String
      $department: String
      $jobTitle: String
      $orgPosition: String
      $teamId: Int
      $hireDate: String
      $wageType: String
      $baseSalaryETB: Float
      $bankName: String
      $accountNumber: String
      $notes: String
      $gender: String
      $education: String
      $personalTin: String
      $yearsExperience: Int
      $medicalNote: String
    ) {
      createHrEmployee(
        fullName: $fullName
        phone: $phone
        email: $email
        department: $department
        jobTitle: $jobTitle
        orgPosition: $orgPosition
        teamId: $teamId
        hireDate: $hireDate
        wageType: $wageType
        baseSalaryETB: $baseSalaryETB
        bankName: $bankName
        accountNumber: $accountNumber
        notes: $notes
        gender: $gender
        education: $education
        personalTin: $personalTin
        yearsExperience: $yearsExperience
        medicalNote: $medicalNote
      ) { ${EMP_FIELDS} }
    }`,
    { ...input, teamId: input.teamId ?? null },
  );
  return data.createHrEmployee;
}

export async function fetchHrLeaveTypes(): Promise<HrLeaveType[]> {
  const data = await gql<{ hrLeaveTypes: HrLeaveType[] }>(`
    query {
      hrLeaveTypes {
        id HotelName code label paid defaultDays active sortOrder
      }
    }
  `);
  return data.hrLeaveTypes || [];
}

export async function replaceHrLeaveTypesApi(
  types: Array<{
    code?: string;
    label: string;
    paid?: boolean;
    defaultDays?: number;
    active?: boolean;
  }>,
): Promise<HrLeaveType[]> {
  const data = await gql<{ replaceHrLeaveTypes: HrLeaveType[] }>(
    `mutation ($types: [HrLeaveTypeInput!]!) {
      replaceHrLeaveTypes(types: $types) {
        id HotelName code label paid defaultDays active sortOrder
      }
    }`,
    { types },
  );
  return data.replaceHrLeaveTypes || [];
}

export async function fetchHrDepartments(): Promise<HrDepartment[]> {
  const data = await gql<{ hrDepartments: HrDepartment[] }>(`
    query {
      hrDepartments {
        id HotelName code label active sortOrder
      }
    }
  `);
  return data.hrDepartments || [];
}

export async function fetchHrTeamsApi(departmentId?: number) {
  const data = await gql<{ hrTeams: HrTeam[] }>(
    `query ($departmentId: Int) {
      hrTeams(departmentId: $departmentId) {
        id HotelName departmentId code label active sortOrder
      }
    }`,
    { departmentId: departmentId ?? null },
  );
  return data.hrTeams || [];
}

export async function upsertHrTeamApi(input: {
  id?: number;
  departmentId: number;
  code: string;
  label: string;
  active?: boolean;
  sortOrder?: number;
}) {
  const data = await gql<{ upsertHrTeam: HrTeam }>(
    `mutation (
      $id: Int
      $departmentId: Int!
      $code: String!
      $label: String!
      $active: Boolean
      $sortOrder: Int
    ) {
      upsertHrTeam(
        id: $id
        departmentId: $departmentId
        code: $code
        label: $label
        active: $active
        sortOrder: $sortOrder
      ) {
        id HotelName departmentId code label active sortOrder
      }
    }`,
    input,
  );
  return data.upsertHrTeam;
}

export async function deleteHrTeamApi(id: number) {
  const data = await gql<{ deleteHrTeam: boolean }>(
    `mutation ($id: Int!) { deleteHrTeam(id: $id) }`,
    { id },
  );
  return data.deleteHrTeam;
}

export async function fetchHrApprovalFlowsApi(requestType?: string) {
  const data = await gql<{ hrApprovalFlows: HrApprovalFlow[] }>(
    `query ($requestType: String) {
      hrApprovalFlows(requestType: $requestType) {
        id HotelName requestType departmentId requireTeamLeaderFirst stepsJson active
      }
    }`,
    { requestType: requestType || null },
  );
  return data.hrApprovalFlows || [];
}

export async function upsertHrApprovalFlowApi(input: {
  id?: number;
  requestType: string;
  departmentId?: number | null;
  requireTeamLeaderFirst?: boolean;
  stepsJson: unknown;
  active?: boolean;
}) {
  const data = await gql<{ upsertHrApprovalFlow: HrApprovalFlow }>(
    `mutation (
      $id: Int
      $requestType: String!
      $departmentId: Int
      $requireTeamLeaderFirst: Boolean
      $stepsJson: JSON!
      $active: Boolean
    ) {
      upsertHrApprovalFlow(
        id: $id
        requestType: $requestType
        departmentId: $departmentId
        requireTeamLeaderFirst: $requireTeamLeaderFirst
        stepsJson: $stepsJson
        active: $active
      ) {
        id HotelName requestType departmentId requireTeamLeaderFirst stepsJson active
      }
    }`,
    {
      ...input,
      departmentId: input.departmentId ?? null,
    },
  );
  return data.upsertHrApprovalFlow;
}

export async function deleteHrApprovalFlowApi(id: number) {
  const data = await gql<{ deleteHrApprovalFlow: boolean }>(
    `mutation ($id: Int!) { deleteHrApprovalFlow(id: $id) }`,
    { id },
  );
  return data.deleteHrApprovalFlow;
}

export async function replaceHrDepartmentsApi(
  departments: Array<{
    code?: string;
    label: string;
    active?: boolean;
  }>,
): Promise<HrDepartment[]> {
  const data = await gql<{ replaceHrDepartments: HrDepartment[] }>(
    `mutation ($departments: [HrDepartmentInput!]!) {
      replaceHrDepartments(departments: $departments) {
        id HotelName code label active sortOrder
      }
    }`,
    { departments },
  );
  return data.replaceHrDepartments || [];
}

export async function fetchHrIncidentTypes(): Promise<HrIncidentType[]> {
  const data = await gql<{ hrIncidentTypes: HrIncidentType[] }>(`
    query {
      hrIncidentTypes {
        id HotelName code label deduct percentOfSalary amountETB attendanceLink active sortOrder
      }
    }
  `);
  return data.hrIncidentTypes || [];
}

export async function replaceHrIncidentTypesApi(
  types: Array<{
    code?: string;
    label: string;
    deduct?: boolean;
    percentOfSalary?: number;
    attendanceLink?: string;
    active?: boolean;
  }>,
): Promise<HrIncidentType[]> {
  const data = await gql<{ replaceHrIncidentTypes: HrIncidentType[] }>(
    `mutation ($types: [HrIncidentTypeInput!]!) {
      replaceHrIncidentTypes(types: $types) {
        id HotelName code label deduct percentOfSalary amountETB attendanceLink active sortOrder
      }
    }`,
    { types },
  );
  return data.replaceHrIncidentTypes || [];
}

export async function updateHrEmployeeApi(
  id: number,
  input: Record<string, unknown>,
): Promise<HrEmployee> {
  const data = await gql<{ updateHrEmployee: HrEmployee }>(
    `mutation (
      $id: Int!
      $fullName: String
      $phone: String
      $email: String
      $department: String
      $jobTitle: String
      $orgPosition: String
      $teamId: Int
      $status: String
      $hireDate: String
      $wageType: String
      $baseSalaryETB: Float
      $bankName: String
      $accountNumber: String
      $credentialUserId: Int
      $credentialUserName: String
      $notes: String
      $gender: String
      $education: String
      $personalTin: String
      $yearsExperience: Int
      $medicalNote: String
    ) {
      updateHrEmployee(
        id: $id
        fullName: $fullName
        phone: $phone
        email: $email
        department: $department
        jobTitle: $jobTitle
        orgPosition: $orgPosition
        teamId: $teamId
        status: $status
        hireDate: $hireDate
        wageType: $wageType
        baseSalaryETB: $baseSalaryETB
        bankName: $bankName
        accountNumber: $accountNumber
        credentialUserId: $credentialUserId
        credentialUserName: $credentialUserName
        notes: $notes
        gender: $gender
        education: $education
        personalTin: $personalTin
        yearsExperience: $yearsExperience
        medicalNote: $medicalNote
      ) { ${EMP_FIELDS} }
    }`,
    { id, ...input },
  );
  return data.updateHrEmployee;
}

export async function terminateHrEmployeeApi(id: number, endDate?: string) {
  const data = await gql<{ terminateHrEmployee: HrEmployee }>(
    `mutation ($id: Int!, $endDate: String) {
      terminateHrEmployee(id: $id, endDate: $endDate) { ${EMP_FIELDS} }
    }`,
    { id, endDate },
  );
  return data.terminateHrEmployee;
}

export async function deleteHrEmployeeApi(id: number) {
  const data = await gql<{ deleteHrEmployee: boolean }>(
    `mutation ($id: Int!) { deleteHrEmployee(id: $id) }`,
    { id },
  );
  return data.deleteHrEmployee;
}

export async function enableHrEmployeePortalApi(id: number) {
  const data = await gql<{ enableHrEmployeePortal: HrEmployee }>(
    `mutation ($id: Int!) {
      enableHrEmployeePortal(id: $id) { ${EMP_FIELDS} }
    }`,
    { id },
  );
  return data.enableHrEmployeePortal;
}

export async function requestHrOtpResetApi(employeeId: number) {
  const data = await gql<{ requestHrOtpReset: HrOtpResetRequest }>(
    `mutation ($employeeId: Int!) {
      requestHrOtpReset(employeeId: $employeeId) {
        id HotelName employeeId requestedBy status decidedBy decidedAt createdAt portalOtpPreview
        employee { id fullName }
      }
    }`,
    { employeeId },
  );
  return data.requestHrOtpReset;
}

export async function decideHrOtpResetApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrOtpReset: HrOtpResetRequest }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrOtpReset(id: $id, approve: $approve) {
        id HotelName employeeId requestedBy status decidedBy decidedAt createdAt portalOtpPreview
        employee { id fullName portalOtpPreview portalOtpViewer mustChangeOtp }
      }
    }`,
    { id, approve },
  );
  return data.decideHrOtpReset;
}

export async function fetchHrManagerPendingActionsApi(status?: string) {
  const data = await gql<{ hrManagerPendingActions: HrManagerPendingAction[] }>(
    `query ($status: String) {
      hrManagerPendingActions(status: $status) {
        id HotelName kind employeeId payloadJson requestedBy status decidedBy decidedAt createdAt
        employee { id fullName }
      }
    }`,
    { status: status ?? null },
  );
  return data.hrManagerPendingActions || [];
}

export async function decideHrManagerPendingActionApi(
  id: number,
  approve: boolean,
) {
  const data = await gql<{
    decideHrManagerPendingAction: HrManagerPendingAction;
  }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrManagerPendingAction(id: $id, approve: $approve) {
        id HotelName kind employeeId payloadJson requestedBy status decidedBy decidedAt createdAt
        employee { id fullName }
      }
    }`,
    { id, approve },
  );
  return data.decideHrManagerPendingAction;
}

export async function upsertHrAttendanceApi(input: {
  employeeId: number;
  workDate: string;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  status?: string;
  notes?: string;
}) {
  const data = await gql<{ upsertHrAttendance: HrAttendance }>(
    `mutation (
      $employeeId: Int!
      $workDate: String!
      $clockInAt: DateTime
      $clockOutAt: DateTime
      $status: String
      $notes: String
    ) {
      upsertHrAttendance(
        employeeId: $employeeId
        workDate: $workDate
        clockInAt: $clockInAt
        clockOutAt: $clockOutAt
        status: $status
        notes: $notes
      ) {
        id employeeId workDate clockInAt clockOutAt status notes
      }
    }`,
    input,
  );
  return data.upsertHrAttendance;
}

export async function fetchHrOtpResetRequestsApi(status?: string) {
  const data = await gql<{ hrOtpResetRequests: HrOtpResetRequest[] }>(
    `query ($status: String) {
      hrOtpResetRequests(status: $status) {
        id HotelName employeeId requestedBy status decidedBy decidedAt createdAt portalOtpPreview
        employee { id fullName portalOtpPreview portalOtpViewer }
      }
    }`,
    { status: status || null },
  );
  return data.hrOtpResetRequests || [];
}

export async function fetchHrNotificationsApi(unreadOnly?: boolean) {
  const data = await gql<{ hrNotifications: HrNotification[] }>(
    `query ($unreadOnly: Boolean) {
      hrNotifications(unreadOnly: $unreadOnly) {
        id HotelName recipientRole employeeId kind title body href actionStatus
        createdBy readAt createdAt
      }
    }`,
    { unreadOnly: unreadOnly ?? null },
  );
  return data.hrNotifications || [];
}

export async function markHrNotificationReadApi(id: number) {
  const data = await gql<{ markHrNotificationRead: HrNotification }>(
    `mutation ($id: Int!) {
      markHrNotificationRead(id: $id) {
        id readAt kind title href actionStatus
      }
    }`,
    { id },
  );
  return data.markHrNotificationRead;
}

export async function createHrEmployeeNotificationApi(input: {
  employeeIds: number[];
  title: string;
  body: string;
  href?: string;
}) {
  const data = await gql<{ createHrEmployeeNotification: HrNotification[] }>(
    `mutation ($employeeIds: [Int!]!, $title: String!, $body: String!, $href: String) {
      createHrEmployeeNotification(
        employeeIds: $employeeIds
        title: $title
        body: $body
        href: $href
      ) {
        id employeeId title kind createdAt
      }
    }`,
    input,
  );
  return data.createHrEmployeeNotification;
}

export async function fetchHrLeaveRequests(status?: string): Promise<HrLeaveRequest[]> {
  const data = await gql<{ hrLeaveRequests: HrLeaveRequest[] }>(
    `query ($status: String) {
      hrLeaveRequests(status: $status) {
        id HotelName employeeId leaveType fromYmd toYmd days reason status
        flowId currentStepIndex currentStepKind decidedBy decidedAt createdAt
        employee { id fullName department }
      }
    }`,
    { status: status || null },
  );
  return data.hrLeaveRequests || [];
}

export async function createHrLeaveRequestApi(input: {
  employeeId: number;
  leaveType: string;
  fromYmd: string;
  toYmd: string;
  days: number;
  reason?: string;
}) {
  const data = await gql<{ createHrLeaveRequest: HrLeaveRequest }>(
    `mutation (
      $employeeId: Int!
      $leaveType: String!
      $fromYmd: String!
      $toYmd: String!
      $days: Float
      $reason: String
    ) {
      createHrLeaveRequest(
        employeeId: $employeeId
        leaveType: $leaveType
        fromYmd: $fromYmd
        toYmd: $toYmd
        days: $days
        reason: $reason
      ) { id status days leaveType fromYmd toYmd }
    }`,
    { ...input },
  );
  return data.createHrLeaveRequest;
}

export async function decideHrLeaveRequestApi(id: number, approve: boolean) {
  const data = await gql<{ decideHrLeaveRequest: HrLeaveRequest }>(
    `mutation ($id: Int!, $approve: Boolean!) {
      decideHrLeaveRequest(id: $id, approve: $approve) {
        id status currentStepIndex currentStepKind flowId
      }
    }`,
    { id, approve },
  );
  return data.decideHrLeaveRequest;
}

export async function upsertHrLeaveBalanceApi(input: {
  employeeId: number;
  leaveType: string;
  balanceDays: number;
}) {
  const data = await gql<{ upsertHrLeaveBalance: HrLeaveBalance }>(
    `mutation ($employeeId: Int!, $leaveType: String!, $balanceDays: Float!) {
      upsertHrLeaveBalance(
        employeeId: $employeeId
        leaveType: $leaveType
        balanceDays: $balanceDays
      ) { id leaveType balanceDays }
    }`,
    { ...input },
  );
  return data.upsertHrLeaveBalance;
}

export async function fetchHrLeaveBalances(
  employeeId?: number,
): Promise<HrLeaveBalance[]> {
  const data = await gql<{ hrLeaveBalances: HrLeaveBalance[] }>(
    `query ($employeeId: Int) {
      hrLeaveBalances(employeeId: $employeeId) {
        id employeeId leaveType balanceDays updatedAt
        employee { id fullName }
      }
    }`,
    { employeeId: employeeId ?? null },
  );
  return data.hrLeaveBalances || [];
}

export async function fetchHrAttendance(
  fromYmd?: string,
  toYmd?: string,
  employeeId?: number,
): Promise<HrAttendance[]> {
  const data = await gql<{ hrAttendance: HrAttendance[] }>(
    `query ($fromYmd: String, $toYmd: String, $employeeId: Int) {
      hrAttendance(fromYmd: $fromYmd, toYmd: $toYmd, employeeId: $employeeId) {
        id employeeId workDate clockInAt clockOutAt status notes
        employee { id fullName }
      }
    }`,
    {
      fromYmd: fromYmd ?? null,
      toYmd: toYmd ?? null,
      employeeId: employeeId ?? null,
    },
  );
  return data.hrAttendance || [];
}

export async function clockHrAttendanceApi(input: {
  employeeId: number;
  action: "in" | "out";
}) {
  const data = await gql<{ clockHrAttendance: HrAttendance }>(
    `mutation ($employeeId: Int!, $action: String!) {
      clockHrAttendance(employeeId: $employeeId, action: $action) {
        id workDate clockInAt clockOutAt status
      }
    }`,
    { employeeId: input.employeeId, action: input.action },
  );
  return data.clockHrAttendance;
}

export async function fetchHrShifts(
  fromYmd?: string,
  toYmd?: string,
  employeeId?: number,
): Promise<HrShift[]> {
  const data = await gql<{ hrShifts: HrShift[] }>(
    `query ($fromYmd: String, $toYmd: String, $employeeId: Int) {
      hrShifts(fromYmd: $fromYmd, toYmd: $toYmd, employeeId: $employeeId) {
        id employeeId workDate department startTime endTime notes
        employee { id fullName }
      }
    }`,
    {
      fromYmd: fromYmd ?? null,
      toYmd: toYmd ?? null,
      employeeId: employeeId ?? null,
    },
  );
  return data.hrShifts || [];
}

export async function createHrShiftApi(input: {
  employeeId: number;
  workDate: string;
  department?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}) {
  const data = await gql<{ createHrShift: HrShift }>(
    `mutation (
      $employeeId: Int!
      $workDate: String!
      $department: String
      $startTime: String
      $endTime: String
      $notes: String
    ) {
      createHrShift(
        employeeId: $employeeId
        workDate: $workDate
        department: $department
        startTime: $startTime
        endTime: $endTime
        notes: $notes
      ) { id workDate startTime endTime }
    }`,
    { ...input },
  );
  return data.createHrShift;
}

export async function updateHrShiftApi(input: {
  id: number;
  employeeId?: number;
  workDate?: string;
  department?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}) {
  const data = await gql<{ updateHrShift: HrShift }>(
    `mutation (
      $id: Int!
      $employeeId: Int
      $workDate: String
      $department: String
      $startTime: String
      $endTime: String
      $notes: String
    ) {
      updateHrShift(
        id: $id
        employeeId: $employeeId
        workDate: $workDate
        department: $department
        startTime: $startTime
        endTime: $endTime
        notes: $notes
      ) {
        id employeeId workDate department startTime endTime notes
        employee { id fullName }
      }
    }`,
    {
      id: input.id,
      employeeId: input.employeeId ?? null,
      workDate: input.workDate ?? null,
      department: input.department ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      notes: input.notes ?? null,
    },
  );
  return data.updateHrShift;
}

export async function deleteHrShiftApi(id: number) {
  await gql(`mutation ($id: Int!) { deleteHrShift(id: $id) }`, { id });
}

export async function fetchHrDocuments(employeeId?: number): Promise<HrDocument[]> {
  const data = await gql<{ hrDocuments: HrDocument[] }>(
    `query ($employeeId: Int) {
      hrDocuments(employeeId: $employeeId) {
        id employeeId title docType fileUrl notes createdAt
        employee { id fullName }
      }
    }`,
    { employeeId: employeeId ?? null },
  );
  return data.hrDocuments || [];
}

export async function createHrDocumentApi(input: {
  employeeId: number;
  title: string;
  docType?: string;
  fileUrl?: string;
  notes?: string;
}) {
  const data = await gql<{ createHrDocument: HrDocument }>(
    `mutation (
      $employeeId: Int!
      $title: String!
      $docType: String
      $fileUrl: String
      $notes: String
    ) {
      createHrDocument(
        employeeId: $employeeId
        title: $title
        docType: $docType
        fileUrl: $fileUrl
        notes: $notes
      ) { id title docType fileUrl }
    }`,
    { ...input },
  );
  return data.createHrDocument;
}

export async function deleteHrDocumentApi(id: number) {
  await gql(`mutation ($id: Int!) { deleteHrDocument(id: $id) }`, { id });
}

export async function fetchHrPayrollPeriods(): Promise<HrPayrollPeriod[]> {
  const data = await gql<{ hrPayrollPeriods: HrPayrollPeriod[] }>(`
    query {
      hrPayrollPeriods {
        id HotelName periodKey monthName fromYmd toYmd status notes
        createdBy closedAt closedBy createdAt
      }
    }
  `);
  return data.hrPayrollPeriods || [];
}

export async function createHrPayrollPeriodApi(input: {
  fromYmd: string;
  toYmd: string;
  notes?: string;
  employeeIds?: number[];
  wageScope?: "batch" | "monthly" | "weekly";
}) {
  const data = await gql<{ createHrPayrollPeriod: HrPayrollPeriod }>(
    `mutation (
      $fromYmd: String!
      $toYmd: String!
      $notes: String
      $employeeIds: [Int!]
      $wageScope: String
    ) {
      createHrPayrollPeriod(
        fromYmd: $fromYmd
        toYmd: $toYmd
        notes: $notes
        employeeIds: $employeeIds
        wageScope: $wageScope
      ) {
        id periodKey monthName fromYmd toYmd status createdBy createdAt
      }
    }`,
    {
      fromYmd: input.fromYmd,
      toYmd: input.toYmd,
      notes: input.notes ?? null,
      employeeIds: input.employeeIds ?? null,
      wageScope: input.wageScope ?? null,
    },
  );
  return data.createHrPayrollPeriod;
}

export async function fetchHrPayslips(
  periodId?: number | null,
  paymentStatus?: string | null,
): Promise<HrPayslip[]> {
  const data = await gql<{ hrPayslips: HrPayslip[] }>(
    `query ($periodId: Int, $paymentStatus: String) {
      hrPayslips(periodId: $periodId, paymentStatus: $paymentStatus) {
        ${PAYSLIP_FIELDS}
      }
    }`,
    {
      periodId: periodId ?? null,
      paymentStatus: paymentStatus ?? null,
    },
  );
  return data.hrPayslips || [];
}

export async function markHrPayslipsPaidApi(payslipIds: number[]) {
  const data = await gql<{ markHrPayslipsPaid: HrPayslip[] }>(
    `mutation ($payslipIds: [Int!]!) {
      markHrPayslipsPaid(payslipIds: $payslipIds) { ${PAYSLIP_FIELDS} }
    }`,
    { payslipIds },
  );
  return data.markHrPayslipsPaid || [];
}

/** Finance (or Admin) approve/reject HR mark-paid requests. */
export async function decideHrPayslipsPaymentApi(
  payslipIds: number[],
  approve: boolean,
) {
  const data = await gql<{ decideHrPayslipsPayment: HrPayslip[] }>(
    `mutation ($payslipIds: [Int!]!, $approve: Boolean!) {
      decideHrPayslipsPayment(payslipIds: $payslipIds, approve: $approve) {
        ${PAYSLIP_FIELDS}
      }
    }`,
    { payslipIds, approve },
  );
  return data.decideHrPayslipsPayment || [];
}

export async function approveHrPayslipsPaymentApi(payslipIds: number[]) {
  const data = await gql<{ approveHrPayslipsPayment: HrPayslip[] }>(
    `mutation ($payslipIds: [Int!]!) {
      approveHrPayslipsPayment(payslipIds: $payslipIds) { ${PAYSLIP_FIELDS} }
    }`,
    { payslipIds },
  );
  return data.approveHrPayslipsPayment || [];
}

export async function closeHrPayrollPeriodApi(id: number) {
  const data = await gql<{ closeHrPayrollPeriod: HrPayrollPeriod }>(
    `mutation ($id: Int!) {
      closeHrPayrollPeriod(id: $id) {
        id status fromYmd toYmd monthName periodKey closedAt closedBy
      }
    }`,
    { id },
  );
  return data.closeHrPayrollPeriod;
}

export async function fetchHrPayrollLineRules(): Promise<HrPayrollLineRule[]> {
  const data = await gql<{ hrPayrollLineRules: HrPayrollLineRule[] }>(`
    query {
      hrPayrollLineRules {
        id HotelName kind label percentOfSalary amountETB whenMode
        fromDay toDay fromYmd toYmd customized fromAmountETB toAmountETB
        active sortOrder
      }
    }
  `);
  return data.hrPayrollLineRules || [];
}

export async function replaceHrPayrollLineRulesApi(
  rules: Array<{
    kind: string;
    label: string;
    percentOfSalary?: number;
    amountETB?: number;
    whenMode?: string;
    fromDay?: number | null;
    toDay?: number | null;
    fromYmd?: string;
    toYmd?: string;
    customized?: boolean;
    fromAmountETB?: number;
    toAmountETB?: number | null;
    active?: boolean;
  }>,
): Promise<HrPayrollLineRule[]> {
  const data = await gql<{ replaceHrPayrollLineRules: HrPayrollLineRule[] }>(
    `mutation ($rules: [HrPayrollLineRuleInput!]!) {
      replaceHrPayrollLineRules(rules: $rules) {
        id HotelName kind label percentOfSalary amountETB whenMode
        fromDay toDay fromYmd toYmd customized fromAmountETB toAmountETB
        active sortOrder
      }
    }`,
    { rules },
  );
  return data.replaceHrPayrollLineRules || [];
}

export async function fetchHrWagePayWindows(): Promise<HrWagePayWindow[]> {
  const data = await gql<{ hrWagePayWindows: HrWagePayWindow[] }>(`
    query {
      hrWagePayWindows {
        id HotelName wageType fromDay toDay active
      }
    }
  `);
  return data.hrWagePayWindows || [];
}

export async function replaceHrWagePayWindowsApi(
  windows: Array<{
    wageType: string;
    fromDay: number;
    toDay: number;
    active?: boolean;
  }>,
): Promise<HrWagePayWindow[]> {
  const data = await gql<{ replaceHrWagePayWindows: HrWagePayWindow[] }>(
    `mutation ($windows: [HrWagePayWindowInput!]!) {
      replaceHrWagePayWindows(windows: $windows) {
        id HotelName wageType fromDay toDay active
      }
    }`,
    { windows },
  );
  return data.replaceHrWagePayWindows || [];
}

export async function fetchHrIncidents(employeeId?: number): Promise<HrIncident[]> {
  const data = await gql<{ hrIncidents: HrIncident[] }>(
    `query ($employeeId: Int) {
      hrIncidents(employeeId: $employeeId) {
        id employeeId kind title detail occurredYmd recordedBy
        salaryDeduct percentOfSalary amountETB createdAt
        employee { id fullName }
      }
    }`,
    { employeeId: employeeId ?? null },
  );
  return data.hrIncidents || [];
}

export async function createHrIncidentApi(input: {
  employeeId: number;
  kind?: string;
  title: string;
  detail?: string;
  occurredYmd?: string;
  salaryDeduct?: boolean;
  percentOfSalary?: number;
  amountETB?: number;
}) {
  const data = await gql<{ createHrIncident: HrIncident }>(
    `mutation (
      $employeeId: Int!
      $kind: String
      $title: String!
      $detail: String
      $occurredYmd: String
      $salaryDeduct: Boolean
      $percentOfSalary: Float
      $amountETB: Float
    ) {
      createHrIncident(
        employeeId: $employeeId
        kind: $kind
        title: $title
        detail: $detail
        occurredYmd: $occurredYmd
        salaryDeduct: $salaryDeduct
        percentOfSalary: $percentOfSalary
        amountETB: $amountETB
      ) { id kind title salaryDeduct percentOfSalary amountETB }
    }`,
    { ...input },
  );
  return data.createHrIncident;
}

export async function deleteHrIncidentApi(id: number) {
  await gql(`mutation ($id: Int!) { deleteHrIncident(id: $id) }`, { id });
}

export type HrPayrollStatBand = {
  id: number;
  HotelName: string;
  kind: string;
  label: string;
  ratePercent: number;
  fromETB: number;
  toETB: number | null;
  effectiveMode: string;
  fromYmd: string;
  toYmd: string;
  active: boolean;
  sortOrder: number;
};

export type HrLibraryDocument = {
  id: number;
  HotelName: string;
  title: string;
  description: string;
  fileSecureUrl: string;
  filePublicId: string;
  fileBytes: number;
  fileFormat: string;
  fileOriginalName: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type HrBankExportRow = {
  payslipId: number;
  employeeId: number;
  employeeName: string;
  bankName: string;
  accountNumber: string;
  netPayETB: number;
  payslipNumber: string;
};

const STAT_BAND_FIELDS = `
  id HotelName kind label ratePercent fromETB toETB effectiveMode fromYmd toYmd active sortOrder
`;

const LIBRARY_DOC_FIELDS = `
  id HotelName title description fileSecureUrl filePublicId fileBytes fileFormat fileOriginalName uploadedBy createdAt updatedAt
`;

export async function fetchHrPayrollStatBands(): Promise<HrPayrollStatBand[]> {
  const data = await gql<{ hrPayrollStatBands: HrPayrollStatBand[] }>(
    `query { hrPayrollStatBands { ${STAT_BAND_FIELDS} } }`,
  );
  return data.hrPayrollStatBands ?? [];
}

export async function replaceHrPayrollStatBandsApi(
  bands: Array<{
    kind: string;
    label?: string;
    ratePercent: number;
    fromETB: number;
    toETB?: number | null;
    effectiveMode?: string;
    fromYmd?: string;
    toYmd?: string;
    active?: boolean;
    sortOrder?: number;
  }>,
): Promise<HrPayrollStatBand[]> {
  const data = await gql<{ replaceHrPayrollStatBands: HrPayrollStatBand[] }>(
    `mutation ($bands: [HrPayrollStatBandInput!]!) {
      replaceHrPayrollStatBands(bands: $bands) { ${STAT_BAND_FIELDS} }
    }`,
    { bands },
  );
  return data.replaceHrPayrollStatBands ?? [];
}

export async function fetchHrLibraryDocuments(): Promise<HrLibraryDocument[]> {
  const data = await gql<{ hrLibraryDocuments: HrLibraryDocument[] }>(
    `query { hrLibraryDocuments { ${LIBRARY_DOC_FIELDS} } }`,
  );
  return data.hrLibraryDocuments ?? [];
}

export async function createHrLibraryDocumentApi(input: {
  title: string;
  description?: string;
  fileSecureUrl: string;
  filePublicId?: string;
  fileBytes?: number;
  fileFormat?: string;
  fileOriginalName?: string;
}): Promise<HrLibraryDocument> {
  const data = await gql<{ createHrLibraryDocument: HrLibraryDocument }>(
    `mutation (
      $title: String!
      $description: String
      $fileSecureUrl: String!
      $filePublicId: String
      $fileBytes: Int
      $fileFormat: String
      $fileOriginalName: String
    ) {
      createHrLibraryDocument(
        title: $title
        description: $description
        fileSecureUrl: $fileSecureUrl
        filePublicId: $filePublicId
        fileBytes: $fileBytes
        fileFormat: $fileFormat
        fileOriginalName: $fileOriginalName
      ) { ${LIBRARY_DOC_FIELDS} }
    }`,
    input,
  );
  return data.createHrLibraryDocument;
}

export async function updateHrLibraryDocumentApi(input: {
  id: number;
  title: string;
  description?: string;
  fileSecureUrl?: string;
  filePublicId?: string;
  fileBytes?: number;
  fileFormat?: string;
  fileOriginalName?: string;
}): Promise<HrLibraryDocument> {
  const data = await gql<{ updateHrLibraryDocument: HrLibraryDocument }>(
    `mutation (
      $id: Int!
      $title: String!
      $description: String
      $fileSecureUrl: String
      $filePublicId: String
      $fileBytes: Int
      $fileFormat: String
      $fileOriginalName: String
    ) {
      updateHrLibraryDocument(
        id: $id
        title: $title
        description: $description
        fileSecureUrl: $fileSecureUrl
        filePublicId: $filePublicId
        fileBytes: $fileBytes
        fileFormat: $fileFormat
        fileOriginalName: $fileOriginalName
      ) { ${LIBRARY_DOC_FIELDS} }
    }`,
    input,
  );
  return data.updateHrLibraryDocument;
}

export async function deleteHrLibraryDocumentApi(id: number): Promise<boolean> {
  const data = await gql<{ deleteHrLibraryDocument: boolean }>(
    `mutation ($id: Int!) { deleteHrLibraryDocument(id: $id) }`,
    { id },
  );
  return Boolean(data.deleteHrLibraryDocument);
}

export async function createHrEmployeesBatchApi(
  employees: Array<{
    fullName: string;
    phone?: string;
    email?: string;
    department?: string;
    jobTitle?: string;
    orgPosition?: string;
    teamId?: number | null;
    wageType?: string;
    baseSalaryETB?: number;
    hireDate?: string;
    gender?: string;
    education?: string;
    personalTin?: string;
    yearsExperience?: number;
    bankName?: string;
    accountNumber?: string;
    notes?: string;
    medicalNote?: string;
  }>,
): Promise<HrEmployee[]> {
  const data = await gql<{ createHrEmployeesBatch: HrEmployee[] }>(
    `mutation ($employees: [HrEmployeeBatchInput!]!) {
      createHrEmployeesBatch(employees: $employees) {
        id fullName department jobTitle wageType baseSalaryETB status
      }
    }`,
    { employees },
  );
  return data.createHrEmployeesBatch ?? [];
}

export async function fetchHrPayrollBankExportApi(
  periodId: number,
): Promise<HrBankExportRow[]> {
  const data = await gql<{ hrPayrollBankExport: HrBankExportRow[] }>(
    `query ($periodId: Int!) {
      hrPayrollBankExport(periodId: $periodId) {
        payslipId employeeId employeeName bankName accountNumber netPayETB payslipNumber
      }
    }`,
    { periodId },
  );
  return data.hrPayrollBankExport ?? [];
}
