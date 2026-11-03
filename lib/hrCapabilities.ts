/** Role capabilities for the HR workspace (Manager vs HR vs Admin). */

export type HrActorRole = "Manager" | "HR" | "Admin" | "Finance" | string;

/** UI label for credential role `HR` — never invent a fourth desk role string. */
export function hrRoleDisplayLabel(role: HrActorRole): string {
  if (role === "HR") return "HR Manager";
  return String(role || "").trim() || "Staff";
}

export function hrCapabilities(role: HrActorRole) {
  const isManager = role === "Manager";
  const isHr = role === "HR";
  const isAdmin = role === "Admin";
  const isStaffHr = isHr || isAdmin;

  return {
    /** Overview / attendance / leave queue reports */
    canViewReports: isManager || isStaffHr,
    /** Register and maintain employees */
    canManageEmployees: isStaffHr,
    /** Configure leave categories */
    canConfigureLeaveTypes: isManager || isAdmin,
    /** File leave on behalf of employees */
    canFileLeave: isStaffHr,
    /** Approve / reject leave */
    canApproveLeave: isManager || isAdmin || isHr,
    /** Clock in/out and schedule shifts */
    canManageTime: isStaffHr,
    /** Open payroll runs and mark payslips paid (HR/Admin) */
    canRunPayroll: isStaffHr,
    /** Configure wage windows, common deductions/increases; approve paid */
    canConfigurePayroll: isManager || isAdmin,
    /** Approve HR-marked payments */
    canApprovePayrollPayment: isManager || isAdmin,
    /** View payroll periods and payslip totals */
    canViewPayrollReport: isManager || isStaffHr,
    /** Configure incident categories */
    canConfigureIncidentTypes: isManager || isAdmin,
    /** Record incidents against employees */
    canRecordIncidents: isStaffHr,
    /** Register HR departments used on shift schedule */
    canConfigureDepartments: isManager || isAdmin,
  };
}
