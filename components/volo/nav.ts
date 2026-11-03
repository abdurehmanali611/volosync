import type { Role } from "@/lib/api";
import {
  Banknote,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Crown,
  HandCoins,
  KeyRound,
  MinusCircle,
  PackageSearch,
  Printer,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

export type NavChild = {
  label: string;
  href: string;
  view: string;
  children?: NavChild[];
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
  {
    label: string;
    tagline: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Portal roots whose menus render outside the shared sidebar. */
    views?: string[];
  }
> = {
  STORE: { label: "Store", tagline: "Intake, stock control & dispatch", icon: Store },
  FINANCE: { label: "Finance", tagline: "Approvals, tax & reconciliation", icon: Wallet },
  MANAGER: { label: "Manager", tagline: "Final approvals & governance", icon: ShieldCheck },
  HR: { label: "HR", tagline: "People, hours & payroll", icon: Users },
  SALES: {
    label: "Sales agent",
    tagline: "Your stock & settlements",
    icon: HandCoins,
    views: ["sales", "orders", "history"],
  },
  OWNER: { label: "Owner", tagline: "Tenant-wide insight", icon: Crown },
};

/** The view a route falls back to when no `?view=` is present. */
export const DEFAULT_VIEW: Record<string, string> = {
  "/store": "register",
  "/finance": "sales",
  "/manager": "approvals",
  "/hr": "employees",
  "/sales": "sales",
};

/** The portal a route belongs to — independent of who signed in. */
export function portalRole(pathname: string): Role {
  if (pathname.startsWith("/finance")) return "FINANCE";
  if (pathname.startsWith("/manager")) return "MANAGER";
  if (pathname.startsWith("/hr")) return "HR";
  if (pathname.startsWith("/sales")) return "SALES";
  return "STORE";
}

type NavChildSpec = {
  label: string;
  view: string;
  children?: NavChildSpec[];
};

function childrenOf(base: string, specs?: NavChildSpec[]): NavChild[] | undefined {
  if (!specs) return undefined;
  return specs.map((spec) => ({
    label: spec.label,
    view: spec.view,
    href: `${base}?view=${spec.view}`,
    children: childrenOf(base, spec.children),
  }));
}

function item(
  label: string,
  base: string,
  view: string,
  icon: NavLeaf["icon"],
  children?: NavChildSpec[],
): NavLeaf {
  return {
    label,
    href: `${base}?view=${view}`,
    view,
    icon,
    children: childrenOf(base, children),
  };
}

const STORE_ROOT = "/store";
const FINANCE_ROOT = "/finance";
const MANAGER_ROOT = "/manager";
const HR_ROOT = "/hr";

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
      label: "Control",
      items: [
        item("Inventory", MANAGER_ROOT, "inventory", Warehouse, [
          { label: "Reports", view: "reports" },
          { label: "Approvals", view: "approvals" },
          { label: "Inventory", view: "inventory" },
          {
            label: "Payment & tax",
            view: "tax",
            children: [
              { label: "All lines", view: "tax" },
              { label: "With VAT", view: "tax-with" },
              { label: "Without VAT", view: "tax-without" },
            ],
          },
          { label: "Agents", view: "agents" },
          { label: "Promotions", view: "promotions" },
          { label: "Assets", view: "assets" },
        ]),
        item("Access", MANAGER_ROOT, "access", KeyRound),
        item("HR", MANAGER_ROOT, "hr", Users, [
          // Round one — the original Manager control surface.
          { label: "Overview", view: "hr" },
          {
            label: "Approvals",
            view: "hr-approvals",
            children: [
              { label: "Terminations", view: "hr-termination" },
              { label: "Attendance", view: "hr-attendance" },
              { label: "Payroll", view: "hr-payroll" },
            ],
          },
          { label: "OTP resets", view: "hr-otp" },
          { label: "ATS OTP", view: "hr-ats-otp" },
          { label: "Chat control", view: "hr-chat" },
          { label: "Workflows", view: "hr-workflows" },
          { label: "Leave types", view: "hr-leave-types" },
          // Round two — attendance reporting through nested payroll control.
          { label: "Attendance", view: "hr-attendance-report" },
          { label: "Incident types", view: "hr-incident-types" },
          { label: "Departments", view: "hr-departments" },
          { label: "Documents", view: "hr-documents" },
          { label: "Shift templates", view: "hr-shifts" },
          { label: "Checklists", view: "hr-checklists" },
          { label: "Compensation", view: "hr-compensation" },
          { label: "People ops", view: "hr-people-ops" },
          {
            label: "Payroll",
            view: "hr-payroll-runs",
            children: [
              { label: "Runs & pay", view: "hr-payroll-runs" },
              { label: "Settings", view: "hr-payroll-settings" },
              { label: "History", view: "hr-payroll-history" },
            ],
          },
        ]),
      ],
    },
  ],
  HR: [
    {
      label: "Account",
      items: [item("Password", HR_ROOT, "password", KeyRound)],
    },
  ],
  // The Sales portal has no sidebar: its flat menus live in the right-aligned
  // menubar under the top bar (components/volo/sales-menubar.tsx), and the
  // password changer already sits in the top bar for every role.
  SALES: [],
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

function matchesView(child: NavChild, view: string): boolean {
  if (child.view === view) return true;
  return Boolean(child.children?.some((entry) => matchesView(entry, view)));
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
  return Boolean(leaf.children?.some((child) => matchesView(child, view)));
}

function childLabel(child: NavChild, view: string): string | null {
  if (child.view === view) return child.label;
  for (const entry of child.children ?? []) {
    const nested = childLabel(entry, view);
    if (nested) return nested;
  }
  return null;
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
        const child =
          leaf.children?.find((entry) => matchesView(entry, view)) ?? null;
        return (child ? childLabel(child, view) : null) ?? leaf.label;
      }
    }
  }
  return ROLE_META[role]?.label ?? "Workspace";
}
