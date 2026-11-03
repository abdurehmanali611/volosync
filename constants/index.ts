/** Ethiopian TIN length (federal taxpayer identifier). */
export const ETHIOPIAN_TIN_LENGTH = 10;

/** When no TIN is supplied, the server assigns a random numeric tenant id in this range (digits). */
export const AUTO_TENANT_KEY_LENGTH_MIN = 11;
export const AUTO_TENANT_KEY_LENGTH_MAX = 12;

export const BUSINESS_TYPES = [
  "Cafe and Restaurant",
  "Hotel",
  "Resort",
  "Pension",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Shown on signup but not selectable until product is ready. */
export const SIGNUP_COMING_SOON_BUSINESS_TYPES = [
  "Resort",
  "Pension",
] as const satisfies readonly BusinessType[];

export const LODGING_BUSINESS_TYPES = ["Hotel", "Resort", "Pension"] as const;

export type LodgingBusinessType = (typeof LODGING_BUSINESS_TYPES)[number];

export function isLodgingBusinessType(
  type: BusinessType,
): type is LodgingBusinessType {
  return (LODGING_BUSINESS_TYPES as readonly string[]).includes(type);
}

/** Module keys selectable at signup (aligned with backend / validations). */
export const MODULE_OPTIONS = [
  "Cafe and Restaurant",
  "Credentials(Common)",
  "Inventory",
  "Credit Management",
  "Financial Management",
  "HR Module",
  "Room Management",
  "Cleaning and Maintenance",
] as const;

export type ModuleOption = (typeof MODULE_OPTIONS)[number];

/** Every registration must enable shared credential management. */
export const SIGNUP_REQUIRED_MODULE_COMMON = "Credentials(Common)" as const;

/** Cafe-type businesses must enable the cafe/restaurant module. */
export const SIGNUP_REQUIRED_MODULES_CAFE = [
  SIGNUP_REQUIRED_MODULE_COMMON,
  "Cafe and Restaurant",
] as const satisfies readonly ModuleOption[];

/** Hotel, resort, and pension — credentials always; room modules optional. */
export const SIGNUP_REQUIRED_MODULES_LODGING = [
  SIGNUP_REQUIRED_MODULE_COMMON,
] as const satisfies readonly ModuleOption[];

/** Admin dashboard sidebar: `icon` is keyed in the Admin page for Lucide icons. */
export const ADMIN_SIDEBAR_ITEMS = [
  { id: "reports", label: "Reports", icon: "FileText" },
  { id: "create-item", label: "Add Item", icon: "PlusCircle" },
  { id: "update-item", label: "Update/Delete Item", icon: "Edit" },
  { id: "station-prep-qty", label: "Prep totals", icon: "ClipboardList" },
  { id: "waiter-table", label: "Waiters & Tables", icon: "Users" },
  { id: "cancel-orders", label: "Cancel orders", icon: "Ban" },
  { id: "grant-credential", label: "Grant Credential", icon: "Key" },
  { id: "delete-credential", label: "Delete credential", icon: "UserMinus" },
  { id: "inventory", label: "Inventory", icon: "Store" },
  { id: "recipe-usage", label: "Usage status", icon: "UtensilsCrossed" },
  { id: "item-receipts", label: "Item receipts", icon: "Receipt" },
  { id: "credit-registrations", label: "Corporate credit", icon: "Building2" },
  { id: "hr-overview", label: "Overview", icon: "LayoutDashboard" },
  { id: "hr-employees", label: "Employees", icon: "Users" },
  { id: "hr-otp-reset", label: "OTP resets", icon: "KeyRound" },
  { id: "hr-chat-control", label: "Chat control", icon: "ShieldOff" },
  { id: "hr-workflows", label: "Workflows", icon: "GitBranch" },
  { id: "hr-leave", label: "Leave", icon: "CalendarDays" },
  { id: "hr-attendance", label: "Attendance", icon: "ClipboardList" },
  { id: "hr-incidents", label: "Incidents", icon: "AlertTriangle" },
  { id: "hr-departments", label: "Departments", icon: "Building2" },
  { id: "hr-library", label: "Documents", icon: "FileText" },
  { id: "hr-shift-templates", label: "Shift templates", icon: "CalendarRange" },
  { id: "hr-checklists", label: "Checklists", icon: "CheckSquare" },
  { id: "hr-compensation", label: "Compensation", icon: "Banknote" },
  { id: "hr-people-ops", label: "People ops", icon: "Briefcase" },
] as const;

/** Café cashier terminal — sidebar section keys. */
export const CAFE_CASHIER_NAV_ITEMS = [
  {
    id: "order",
    label: "Orders",
    icon: "ShoppingCart",
    description: "Take orders and manage tables.",
  },
  {
    id: "payment",
    label: "Payment",
    icon: "Wallet",
    description:
      "Approve cash, bank, or credit payments for open orders, including analog thermal tickets.",
  },
  {
    id: "payment-type",
    label: "Payment type",
    icon: "ArrowLeftRight",
    description:
      "Correct the recorded payment channel on orders already paid today. Select lines and apply cash, bank, or the proper related payment details.",
  },
  {
    id: "order-update",
    label: "Order update",
    icon: "ClipboardEdit",
    description:
      "Analog only: add items to a printed table ticket. The reprint is marked as an update, while payment approval still happens later in Payment.",
  },
  {
    id: "pos-printer",
    label: "Printer setup",
    icon: "Printer",
    description:
      "Analog only: install the POS agent on this cashier PC and choose the USB thermal printer used for tickets.",
  },
  {
    id: "cashout",
    label: "Cashout",
    icon: "Receipt",
    description:
      "Record petty-cash purchases from the till and review today's entries.",
  },
  {
    id: "credit",
    label: "Corporate credit",
    icon: "Building2",
    description:
      "Register company deals and view usage reports. Staff are recorded at payment. Agreements are printed in Admin → Corporate credit.",
  },
] as const;

export type CafeCashierNavId = (typeof CAFE_CASHIER_NAV_ITEMS)[number]["id"];

export type AdminSidebarItemId = (typeof ADMIN_SIDEBAR_ITEMS)[number]["id"];

/**
 * Manager café / restaurant + credit sidebar — cafe Admin service tools only.
 * Inventory / item receipts stay under the lodging Inventory group (hotel flow differs from café).
 */
export const MANAGER_SERVICE_SIDEBAR_ITEMS = [
  { id: "reports", label: "Reports", icon: "FileText" },
  { id: "create-item", label: "Add Item", icon: "PlusCircle" },
  { id: "update-item", label: "Update/Delete Item", icon: "Edit" },
  { id: "station-prep-qty", label: "Prep totals", icon: "ClipboardList" },
  { id: "waiter-table", label: "Waiters & Tables", icon: "Users" },
  { id: "cancel-orders", label: "Cancel orders", icon: "Ban" },
  { id: "credit-registrations", label: "Corporate credit", icon: "Building2" },
] as const;

/** @deprecated Legacy service tab ids — still accepted when restoring saved tabs. */
export const MANAGER_SERVICE_LEGACY_TAB_IDS = [
  "cafe-reports",
  "menu-create-item",
  "menu-update-item",
  "cafe-item-receipts",
] as const;

export type ManagerServiceSidebarItemId =
  (typeof MANAGER_SERVICE_SIDEBAR_ITEMS)[number]["id"];

/** Manager (hotel) dashboard — lodging inventory & credential operations. */
export const MANAGER_SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { id: "cc-profiles", label: "Cost control IDs", icon: "UserCheck" },
  { id: "department-leaders", label: "Department leaders", icon: "Users" },
  { id: "reports-inventory", label: "Inventory items (list)", icon: "Package" },
  { id: "reports-movements", label: "Stock movements", icon: "ArrowRightLeft" },
  { id: "recipe-usage", label: "Usage status", icon: "UtensilsCrossed" },
  { id: "reports-purchases", label: "Purchase pipeline", icon: "ShoppingCart" },
  { id: "authorize-item-registrations", label: "Authorize registrations", icon: "Package" },
  { id: "authorize-purchases", label: "Authorize purchases", icon: "ShoppingCart" },
  { id: "authorize-stock", label: "Authorize stock", icon: "ArrowRightLeft" },
  { id: "item-receipts", label: "Item receipts", icon: "Receipt" },
  { id: "reports-beginnings", label: "Station daily counts", icon: "ClipboardList" },
  { id: "hr-overview", label: "Overview", icon: "LayoutDashboard" },
  { id: "hr-otp-reset", label: "OTP resets", icon: "KeyRound" },
  { id: "hr-ats-otp", label: "ATS OTP", icon: "Briefcase" },
  { id: "hr-chat-control", label: "Chat control", icon: "ShieldOff" },
  { id: "hr-workflows", label: "Workflows", icon: "GitBranch" },
  { id: "hr-leave", label: "Leave types", icon: "CalendarDays" },
  { id: "hr-attendance", label: "Attendance", icon: "ClipboardList" },
  { id: "hr-incidents", label: "Incident types", icon: "AlertTriangle" },
  { id: "hr-departments", label: "Departments", icon: "Building2" },
  { id: "hr-library", label: "Documents", icon: "FileText" },
  { id: "hr-shift-templates", label: "Shift templates", icon: "CalendarRange" },
  { id: "hr-checklists", label: "Checklists", icon: "CheckSquare" },
  { id: "hr-compensation", label: "Compensation", icon: "Banknote" },
  { id: "hr-people-ops", label: "People ops", icon: "Briefcase" },
  {
    id: "inventory-payment-vat",
    label: "Inventory payment & tax",
    icon: "Receipt",
  },
  { id: "lodging-reports", label: "Reports", icon: "FileText" },
  { id: "lodging-police-report", label: "Police report", icon: "Shield" },
  { id: "lodging-compliment", label: "Complimentary", icon: "Gift" },
  { id: "lodging-rooms", label: "Rooms", icon: "Building2" },
  { id: "lodging-tax", label: "Lodging tax", icon: "Percent" },
  { id: "lodging-rate-plans", label: "Rate plans", icon: "Tags" },
  { id: "lodging-discounts", label: "Discount approvals", icon: "BadgePercent" },
  { id: "lodging-voids", label: "Folio voids", icon: "Ban" },
  { id: "lodging-night-audit", label: "Night audit", icon: "CalendarCheck" },
  { id: "lodging-guest-call", label: "Guest call", icon: "Phone" },
  { id: "grant-credential", label: "Grant credential", icon: "Key" },
  { id: "delete-credential", label: "Delete credential", icon: "UserMinus" },
] as const;

/** Nested under Manager Rooms → Laundry / Guest feedback. */
export const MANAGER_LODGING_NESTED_TAB_IDS = [
  "lodging-laundry-add",
  "lodging-laundry-items",
  "lodging-guest-complaints",
  "lodging-guest-ratings",
] as const;

export type ManagerSidebarItemId =
  (typeof MANAGER_SIDEBAR_ITEMS)[number]["id"];

/** Nested under HR → Payroll (Admin / Manager / standalone HR sidebar). */
export const HR_PAYROLL_NAV_ITEMS = [
  { id: "hr-payroll-generate", label: "Generate", view: "generate" },
  { id: "hr-payroll-runs", label: "Runs & pay", view: "runs" },
  { id: "hr-payroll-settings", label: "Settings", view: "settings" },
  { id: "hr-payroll-history", label: "History", view: "history" },
] as const;

export type HrPayrollTabId = (typeof HR_PAYROLL_NAV_ITEMS)[number]["id"];
export type HrPayrollView = (typeof HR_PAYROLL_NAV_ITEMS)[number]["view"];

export function isHrPayrollTab(id: string): id is HrPayrollTabId {
  return HR_PAYROLL_NAV_ITEMS.some((item) => item.id === id);
}

export function hrPayrollViewFromTab(id: string): HrPayrollView | null {
  return HR_PAYROLL_NAV_ITEMS.find((item) => item.id === id)?.view ?? null;
}

/**
 * Nested under HR → Approvals (Manager / Admin).
 * Legacy flat id `hr-manager-pending` still accepted for deep links / notifications.
 */
export const HR_APPROVALS_NAV_ITEMS = [
  {
    id: "hr-approvals-terminate",
    label: "Terminations",
    kind: "terminate",
    section: "approvals-terminate",
  },
  {
    id: "hr-approvals-attendance",
    label: "Attendance",
    kind: "attendance_correction",
    section: "approvals-attendance",
  },
  {
    id: "hr-approvals-payroll",
    label: "Payroll",
    kind: "payroll_generate",
    section: "approvals-payroll",
  },
] as const;

export type HrApprovalsTabId = (typeof HR_APPROVALS_NAV_ITEMS)[number]["id"];
export type HrApprovalsKind = (typeof HR_APPROVALS_NAV_ITEMS)[number]["kind"];
export type HrApprovalsSection =
  (typeof HR_APPROVALS_NAV_ITEMS)[number]["section"];

export function isHrApprovalsTab(id: string): id is HrApprovalsTabId {
  return HR_APPROVALS_NAV_ITEMS.some((item) => item.id === id);
}

export function isHrApprovalsSection(
  id: string,
): id is HrApprovalsSection | "manager-pending" {
  return (
    id === "manager-pending" ||
    HR_APPROVALS_NAV_ITEMS.some((item) => item.section === id)
  );
}

export function hrApprovalsKindFromTab(id: string): HrApprovalsKind | null {
  return HR_APPROVALS_NAV_ITEMS.find((item) => item.id === id)?.kind ?? null;
}

export function hrApprovalsKindFromSection(
  id: string,
): HrApprovalsKind | null {
  return HR_APPROVALS_NAV_ITEMS.find((item) => item.section === id)?.kind ?? null;
}

/** Manager HR: reports, leave/incident types, departments, attendance + payroll. */
export const MANAGER_HR_TAB_IDS = [
  "hr-overview",
  ...HR_APPROVALS_NAV_ITEMS.map((item) => item.id),
  "hr-manager-pending",
  "hr-otp-reset",
  "hr-ats-otp",
  "hr-chat-control",
  "hr-workflows",
  "hr-leave",
  "hr-attendance",
  ...HR_PAYROLL_NAV_ITEMS.map((item) => item.id),
  "hr-incidents",
  "hr-departments",
  "hr-library",
  "hr-shift-templates",
  "hr-checklists",
  "hr-compensation",
  "hr-people-ops",
] as const;

/** Full HR workspace (standalone HR terminal + Admin oversight). */
export const HR_WORKSPACE_TAB_IDS = [
  "hr-overview",
  "hr-employees",
  ...HR_APPROVALS_NAV_ITEMS.map((item) => item.id),
  "hr-manager-pending",
  "hr-otp-reset",
  "hr-ats-otp",
  "hr-chat-control",
  "hr-workflows",
  "hr-leave",
  "hr-attendance",
  ...HR_PAYROLL_NAV_ITEMS.map((item) => item.id),
  "hr-incidents",
  "hr-departments",
  "hr-library",
  "hr-shift-templates",
  "hr-checklists",
  "hr-compensation",
  "hr-people-ops",
] as const;

export type ManagerHrTabId = (typeof MANAGER_HR_TAB_IDS)[number];
export type HrWorkspaceTabId = (typeof HR_WORKSPACE_TAB_IDS)[number];

/** Hotel cashier terminal — sidebar keys match Lucide icon names used in the page. */
export const HOTEL_CASHIER_NAV_ITEMS = [
  {
    id: "companies",
    label: "Company deals",
    icon: "Building2",
    description:
      "Corporate accounts, credit tiers, allowed dishes and drinks, and the deal sheet.",
  },
  {
    id: "usage",
    label: "Record usage",
    icon: "Receipt",
    description:
      "Bill meals to a company guest: lines, quantities, and date/time.",
  },
  {
    id: "report",
    label: "Usage report",
    icon: "Table2",
    description: "Summarize posted corporate consumption over a date range.",
  },
] as const;

export type HotelCashierNavId =
  (typeof HOTEL_CASHIER_NAV_ITEMS)[number]["id"];

/** Reception terminal — room check-in, stays, services, CM portal. */
export const RECEPTION_NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    description: "Room occupancy snapshot and recent activity.",
  },
  {
    id: "check-in",
    label: "Check-in",
    icon: "UserPlus",
    description: "Register guests and assign vacant clean rooms.",
  },
  {
    id: "reservations",
    label: "Reservations",
    icon: "CalendarRange",
    description: "Hold rooms ahead of arrival and convert to check-in.",
  },
  {
    id: "active-stays",
    label: "Active stays",
    icon: "BedDouble",
    description: "View bills, add charges, split/transfer, and checkout.",
  },
  {
    id: "cm-portal",
    label: "CM portal",
    icon: "Sparkles",
    description: "Dirty and maintenance queue — assign and mark clean.",
  },
  {
    id: "reports",
    label: "Reports",
    icon: "FileText",
    description: "Daily and monthly stay summaries for print.",
  },
  {
    id: "history",
    label: "History",
    icon: "History",
    description: "Lodging action audit trail.",
  },
] as const;

export type ReceptionNavId = (typeof RECEPTION_NAV_ITEMS)[number]["id"];

/** CM Leader terminal — cleaning & maintenance queue. */
export const CM_LEADER_NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    description: "Room status and open assignment counts.",
  },
  {
    id: "queue",
    label: "Dirty & maintenance",
    icon: "Sparkles",
    description: "Act on vacant dirty and on-maintenance rooms.",
  },
  {
    id: "assignments",
    label: "Assignments",
    icon: "ClipboardList",
    description: "Open and completed CM assignments.",
  },
  {
    id: "history",
    label: "History",
    icon: "History",
    description: "CM action audit trail.",
  },
] as const;

export type CmLeaderNavId = (typeof CM_LEADER_NAV_ITEMS)[number]["id"];

/** Legacy name — prefer `BUSINESS_TYPES`. */
export const businessTypes = [...BUSINESS_TYPES] as BusinessType[];

/** Legacy name — prefer `MODULE_OPTIONS`. */
export const modules = [...MODULE_OPTIONS] as ModuleOption[];
