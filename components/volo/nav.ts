import type { Role } from "@/lib/api";
import {
  Banknote,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  Crown,
  FileText,
  HandCoins,
  KeyRound,
  ListChecks,
  MessagesSquare,
  MinusCircle,
  PackageSearch,
  Printer,
  ReceiptText,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  Workflow,
} from "lucide-react";

export type NavChild = {
  label: string;
  href: string;
  view: string;
};

export type NavLeaf = {
  label: string;
  href: string;
  view: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavChild[];
};

export type NavSection = {
  label: string;
  items: NavLeaf[];
};

export const ROLE_META: Record<
  Role,
  { label: string; tagline: string; icon: React.ComponentType<{ className?: string }> }
> = {
  STORE: { label: "Store", tagline: "Intake, stock control & dispatch", icon: Store },
  FINANCE: { label: "Finance", tagline: "Approvals, tax & reconciliation", icon: Wallet },
  MANAGER: { label: "Manager", tagline: "Final approvals & governance", icon: ShieldCheck },
  HR: { label: "HR", tagline: "People, hours & payroll", icon: Users },
  SALES: { label: "Sales agent", tagline: "Your stock & settlements", icon: HandCoins },
  OWNER: { label: "Owner", tagline: "Tenant-wide insight", icon: Crown },
};

/** The view a route falls back to when no `?view=` is present. */
export const DEFAULT_VIEW: Record<string, string> = {
  "/store": "register",
  "/finance": "sales",
  "/manager": "approvals",
  "/hr": "employees",
  "/sales": "stock",
};

/** The portal a route belongs to — independent of who signed in. */
export function portalRole(pathname: string): Role {
  if (pathname.startsWith("/finance")) return "FINANCE";
  if (pathname.startsWith("/manager")) return "MANAGER";
  if (pathname.startsWith("/hr")) return "HR";
  if (pathname.startsWith("/sales")) return "SALES";
  return "STORE";
}

function item(
  label: string,
  base: string,
  view: string,
  icon: NavLeaf["icon"],
  children?: { label: string; view: string }[],
): NavLeaf {
  return {
    label,
    href: `${base}?view=${view}`,
    view,
    icon,
    children: children?.map((child) => ({
      label: child.label,
      view: child.view,
      href: `${base}?view=${child.view}`,
    })),
  };
}

const STORE_ROOT = "/store";
const FINANCE_ROOT = "/finance";
const MANAGER_ROOT = "/manager";
const HR_ROOT = "/hr";
const SALES_ROOT = "/sales";

/**
 * Mirrors the views each portal's original tab strip offered — no more,
 * no less. Sections are only a visual grouping of those same views.
 */
export const ROLE_NAV: Record<Role, NavSection[]> = {
  STORE: [
    {
      label: "Operations",
      items: [
        item("Register", STORE_ROOT, "register", Store),
        item("Inventory", STORE_ROOT, "inventory", Warehouse),
        item("Inactive", STORE_ROOT, "inactive", MinusCircle),
        item("Suppliers", STORE_ROOT, "suppliers", Truck),
        item("Review", STORE_ROOT, "review", ClipboardCheck, [
          { label: "Item registration", view: "review-registration" },
          { label: "Stock movement", view: "review-stock" },
        ]),
        item("Item receipts", STORE_ROOT, "receipts", Printer),
        item("Requests", STORE_ROOT, "requests", ClipboardList, [
          { label: "Item registrations", view: "requests" },
          { label: "Stock movements", view: "movements" },
        ]),
        item("Payment & tax", STORE_ROOT, "tax", ReceiptText, [
          { label: "All lines", view: "tax" },
          { label: "With VAT", view: "tax-with" },
          { label: "Without VAT", view: "tax-without" },
        ]),
      ],
    },
  ],
  FINANCE: [
    {
      label: "Insight",
      items: [item("Reports", FINANCE_ROOT, "reports", ChartColumn)],
    },
    {
      label: "Operations",
      items: [
        item("Inventory", FINANCE_ROOT, "inventory-reports", Warehouse),
        item("Queue", FINANCE_ROOT, "requests", ScrollText),
        item("Sales approval", FINANCE_ROOT, "sales", ClipboardList),
        item("Promotion", FINANCE_ROOT, "promotion", Sparkles),
        item("Receipts", FINANCE_ROOT, "promotion-receipts", Printer, [
          { label: "Promotions", view: "promotion-receipts" },
          { label: "Item registrations", view: "registration-receipts" },
          { label: "Stock movements", view: "stockout-receipts" },
        ]),
        item("Assets", FINANCE_ROOT, "assets", Wallet),
        item("HR payroll", FINANCE_ROOT, "payroll", Banknote),
      ],
    },
    {
      label: "Ledger",
      items: [
        item("Payment & tax", FINANCE_ROOT, "tax", ReceiptText, [
          { label: "All lines", view: "tax" },
          { label: "With VAT", view: "tax-with" },
          { label: "Without VAT", view: "tax-without" },
        ]),
      ],
    },
  ],
  MANAGER: [
    {
      label: "Insight",
      items: [item("Reports", MANAGER_ROOT, "reports", ChartColumn)],
    },
    {
      label: "Control",
      items: [
        item("Approvals", MANAGER_ROOT, "approvals", ShieldCheck),
        item("Inventory", MANAGER_ROOT, "inventory", Warehouse),
        item("Payment & tax", MANAGER_ROOT, "tax", ReceiptText, [
          { label: "All lines", view: "tax" },
          { label: "With VAT", view: "tax-with" },
          { label: "Without VAT", view: "tax-without" },
        ]),
        item("Agents", MANAGER_ROOT, "agents", Users),
        item("Access", MANAGER_ROOT, "access", KeyRound),
        item("Promotions", MANAGER_ROOT, "promotions", Sparkles),
        item("Assets", MANAGER_ROOT, "assets", Wallet),
      ],
    },
    {
      label: "People & HR",
      items: [
        item("OTP Resets", MANAGER_ROOT, "hr-otp", KeyRound),
        item("Departments", MANAGER_ROOT, "hr-departments", Briefcase),
        item("Workflows", MANAGER_ROOT, "hr-workflows", Workflow),
        item("Leave types", MANAGER_ROOT, "hr-leave-types", CalendarDays),
        item("Incident types", MANAGER_ROOT, "hr-incident-types", ShieldAlert),
        item("Shift templates", MANAGER_ROOT, "hr-shifts", Clock),
        item("Checklist templates", MANAGER_ROOT, "hr-checklists", ListChecks),
        item("Hiring desk", MANAGER_ROOT, "hr-ats", ClipboardCheck),
        item("Chat control", MANAGER_ROOT, "hr-chat", MessagesSquare),
      ],
    },
  ],
  HR: [
    {
      label: "People",
      items: [
        item("People", HR_ROOT, "employees", Users),
      ],
    },
    {
      label: "Operations",
      items: [
        item("Shifts", HR_ROOT, "shifts", Clock),
        item("Checklists", HR_ROOT, "checklists", ListChecks),
        item("People Ops", HR_ROOT, "people", UserCog),
        item("Leave", HR_ROOT, "leave", CalendarDays),
        item("Attendance", HR_ROOT, "attendance", CalendarCheck),
      ],
    },
    {
      label: "Records",
      items: [
        item("Payroll", HR_ROOT, "payroll", Coins),
        item("Incidents", HR_ROOT, "incidents", ShieldAlert),
        item("Documents", HR_ROOT, "documents", FileText),
      ],
    },
    {
      label: "Communication",
      items: [
        item("Notifications", HR_ROOT, "notifications", Bell),
      ],
    },
    {
      label: "Portals",
      items: [
        item("Employee Portal", HR_ROOT, "emp", UserRound),
      ],
    },
    {
      label: "Account",
      items: [item("Password", HR_ROOT, "password", KeyRound)],
    },
  ],
  SALES: [
    {
      label: "My work",
      items: [
        item("My stock", SALES_ROOT, "stock", PackageSearch),
        item("My history", SALES_ROOT, "history", ClipboardList),
      ],
    },
    {
      label: "Account",
      items: [item("Password", SALES_ROOT, "password", KeyRound)],
    },
  ],
  OWNER: [
    {
      label: "Control",
      items: [
        item("Approvals", MANAGER_ROOT, "approvals", ShieldCheck),
        item("Reports", MANAGER_ROOT, "reports", ChartColumn),
      ],
    },
  ],
};

export function navFor(role: Role): NavSection[] {
  return ROLE_NAV[role] ?? ROLE_NAV.STORE;
}

export function defaultViewFor(pathname: string): string {
  return DEFAULT_VIEW[pathname] ?? "";
}

export function isNavActive(
  leaf: NavLeaf,
  pathname: string,
  currentView: string | null,
): boolean {
  const base = leaf.href.split("?")[0];
  if (pathname !== base) return false;
  const view = currentView ?? defaultViewFor(base);
  // Store's Payment & tax tab also covers its with/without VAT sub-views.
  if (base === STORE_ROOT && leaf.view === "tax") return view.startsWith("tax");
  if (leaf.view === view) return true;
  return Boolean(leaf.children?.some((child) => child.view === view));
}

export function activeLabel(
  role: Role,
  pathname: string,
  currentView: string | null,
): string {
  const view = currentView ?? defaultViewFor(pathname);
  for (const section of navFor(role)) {
    for (const leaf of section.items) {
      if (isNavActive(leaf, pathname, currentView)) {
        const child = leaf.children?.find((entry) => entry.view === view);
        return child?.label ?? leaf.label;
      }
    }
  }
  return ROLE_META[role]?.label ?? "Workspace";
}
