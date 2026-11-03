"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hrStatusLabel } from "@/lib/hrConstraints";

/** Shared HR accent rails — brand teal / sky (aligned with volosync chrome). */
export const HR_ACCENTS = {
  teal: "bg-linear-to-r from-primary/45 via-violet-400/35 to-transparent",
  emerald: "bg-linear-to-r from-primary/40 via-violet-400/30 to-transparent",
  cyan: "bg-linear-to-r from-violet-400/40 via-primary/30 to-transparent",
  sky: "bg-linear-to-r from-violet-500/40 via-primary/25 to-transparent",
  amber: "bg-linear-to-r from-amber-500/45 via-orange-400/30 to-transparent",
  rose: "bg-linear-to-r from-rose-500/45 via-orange-400/30 to-transparent",
} as const;

export const HR_METRIC_ACCENTS = {
  teal: "from-primary/8 border-primary/15",
  emerald: "from-violet-400/8 border-violet-400/15",
  cyan: "from-primary/8 border-primary/15",
  sky: "from-violet-500/8 border-violet-500/15",
  amber: "from-amber-500/10 border-amber-500/20",
  rose: "from-rose-500/10 border-rose-500/20",
} as const;

export function HrPanelShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative space-y-6",
        "before:pointer-events-none before:absolute before:-inset-x-2 before:-top-2 before:h-32 before:rounded-3xl before:bg-linear-to-b before:from-primary/4 before:via-transparent before:to-transparent before:opacity-70",
        className,
      )}
    >
      <div className="relative space-y-6">{children}</div>
    </div>
  );
}

export function HrPageHero({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/12 bg-linear-to-br from-primary/4 via-card to-violet-400/3 p-5 shadow-sm md:p-6">
      <div className="relative space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60 dark:text-primary/70">
              HR workspace
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {title}
            </h2>
            {description ? (
              <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function HrSectionCard({
  title,
  description,
  icon,
  accent = HR_ACCENTS.teal,
  actions,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  accent?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm ring-1 ring-black/3 dark:ring-white/5">
      <div className={cn("h-1", accent)} />
      <CardHeader className="flex flex-col gap-3 space-y-0 bg-muted/15 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2.5 text-lg tracking-tight md:text-xl">
            {icon ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/6 text-primary/90 dark:text-primary">
                {icon}
              </span>
            ) : null}
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="max-w-3xl text-pretty leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function HrMetricCard({
  label,
  value,
  hint,
  accent = HR_METRIC_ACCENTS.teal,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-sm bg-linear-to-br to-card transition-shadow hover:shadow-md",
        accent,
      )}
    >
      <CardHeader className="space-y-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">
              {value}
            </p>
          </div>
          {icon ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/90 text-primary/80 dark:text-primary">
              {icon}
            </span>
          ) : null}
        </div>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export function HrStatusBadge({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const className =
    s === "terminated" || s === "rejected" || s === "absent" || s === "unpaid"
      ? "border-rose-500/30 bg-rose-500/15 text-rose-800 dark:text-rose-300"
      : s === "pending" ||
          s === "on_leave" ||
          s === "open" ||
          s === "half_day" ||
          s === "late" ||
          s === "awaiting_finance" ||
          s === "awaiting_manager" ||
          s === "pending_generate"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-300"
        : s === "closed" ||
            s === "approved" ||
            s === "marked_paid" ||
            s === "present" ||
            s === "active"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : "border-primary/20 bg-primary/8 text-primary dark:text-primary";

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", className)}>
      {hrStatusLabel(status)}
    </Badge>
  );
}

/** Soft accent colors for status filter comboboxes (matches badge semantics). */
export function hrStatusFilterTriggerClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "terminated" || s === "rejected" || s === "absent") {
    return "border-rose-500/30 bg-rose-500/10 font-medium text-rose-800 hover:bg-rose-500/15 dark:text-rose-300";
  }
  if (s === "pending" || s === "on_leave" || s === "late" || s === "half_day") {
    return "border-amber-500/30 bg-amber-500/10 font-medium text-amber-900 hover:bg-amber-500/15 dark:text-amber-300";
  }
  if (s === "approved" || s === "active" || s === "present") {
    return "border-emerald-500/25 bg-emerald-500/10 font-medium text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300";
  }
  // "all" and other defaults
  return "border-primary/30 bg-primary/10 font-medium text-primary hover:bg-primary/15 dark:text-primary";
}

export function hrStatusFilterLabelClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "terminated" || s === "rejected" || s === "absent") {
    return "text-rose-600/90 dark:text-rose-400";
  }
  if (s === "pending" || s === "on_leave" || s === "late" || s === "half_day") {
    return "text-amber-700/90 dark:text-amber-400";
  }
  if (s === "approved" || s === "active" || s === "present") {
    return "text-emerald-700/90 dark:text-emerald-400";
  }
  return "text-primary/90 dark:text-primary";
}

export function HrEmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-4 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
  );
}

/** Shared field chrome for HR inputs / selects. */
export const hrFieldClass =
  "h-10 w-full min-w-0 rounded-xl border-border/70 bg-background shadow-sm focus-visible:border-primary/35 focus-visible:ring-primary/15";

export const hrPrimaryBtnClass =
  "gap-1.5 rounded-xl border-primary/80 bg-primary/85 text-white shadow-sm hover:bg-primary";

export function HrFilterBar({
  title = "Filters",
  children,
  onClear,
  showClear,
  className,
}: {
  title?: string;
  children: ReactNode;
  onClear?: () => void;
  showClear?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3.5 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </span>
        {showClear && onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            onClick={onClear}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function HrFilterChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border/60 bg-background/80 p-1">
        {options.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 rounded-lg px-3.5 text-xs font-medium transition-colors",
              value === opt.id
                ? "bg-primary/80 text-white shadow-sm hover:bg-primary/90 hover:text-white"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Soft frame around DataTable / lists. */
export function HrTableFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm",
        className,
      )}
    >
      <div className="h-1 bg-linear-to-r from-primary/50 via-violet-400/40 to-transparent" />
      <div className="space-y-3 p-3 sm:p-4">{children}</div>
    </div>
  );
}

/** Soft hero band with optional metric tiles. */
export function HrSurfaceHero({
  eyebrow,
  title,
  description,
  icon,
  actions,
  stats,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  stats?: { label: string; value: string | number; tone?: string }[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-primary/4 via-card to-muted/20 shadow-sm",
        className,
      )}
    >
      <div className="relative space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/6 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary/70 dark:text-primary/80">
                {eyebrow}
              </div>
            ) : null}
            <div className="space-y-2">
              <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {icon ? (
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/8 text-primary/90 ring-1 ring-primary/15 dark:text-primary">
                    {icon}
                  </span>
                ) : null}
                {title}
              </h2>
              {description ? (
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
        {stats?.length ? (
          <div
            className={cn(
              "grid gap-3",
              stats.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-2xl border border-border/60 bg-linear-to-br p-4 shadow-sm",
                  stat.tone ?? "from-primary/6 to-transparent",
                )}
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HrFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-4 rounded-xl border border-border/70 bg-card/50 p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="space-y-1 border-b border-border/50 pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
        {description ? (
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function HrDialogHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="-mx-6 -mt-6 mb-2 overflow-hidden rounded-t-lg border-b border-border/60 bg-muted/20 px-6 pb-4 pt-6">
      <div className="mb-3 h-0.5 w-12 rounded-full bg-primary/50" />
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export const HR_SECTION_COPY: Record<
  string,
  { title: string; description: string }
> = {
  dashboard: {
    title: "HR · Overview",
    description:
      "Workforce snapshot for this property — headcount, leave pressure, scheduled shifts, and open payroll. Status, pay, leave, attendance, and incidents feed each other when you generate payslips.",
  },
  employees: {
    title: "HR · Employees",
    description:
      "Maintain the employee master — role, pay, bank, and hire details. Salary feeds payslips; approved leave overrides Active to On leave.",
  },
  "otp-reset": {
    title: "HR · OTP resets",
    description:
      "Approve or reject portal OTP reset requests from HR Manager. Approved codes are visible only to Manager until the employee’s first login.",
  },
  "manager-pending": {
    title: "HR · Approvals",
    description:
      "Approve or reject HR requests to terminate employees, correct attendance, or generate payroll.",
  },
  "approvals-terminate": {
    title: "HR · Approvals · Terminations",
    description:
      "Approve or reject HR requests to end employment for a staff member.",
  },
  "approvals-attendance": {
    title: "HR · Approvals · Attendance",
    description:
      "Approve or reject HR corrections to clock times and attendance status.",
  },
  "approvals-payroll": {
    title: "HR · Approvals · Payroll",
    description:
      "Approve or cancel HR requests to generate a payroll run for a date range.",
  },
  workflows: {
    title: "HR · Approval workflows",
    description:
      "Configure per-request-type approval chains (leave, overtime, documents, incidents, schedule change, timesheet) — tenant default or per department. Teams and Leader/Employee positions drive who can approve each step.",
  },
  leave: {
    title: "HR · Leave",
    description:
      "Configure leave types and approve requests (Manager/Admin). HR files leave for employees. Unpaid leave days deduct from payslips; approved leave marks attendance as On leave.",
  },
  attendance: {
    title: "HR · Attendance",
    description:
      "HR records clock in/out and applies manager shift templates to employee schedules. Employees on approved leave show as On leave (not absent) and cannot clock. Absence days can drive payroll when an incident type is linked to attendance.",
  },
  documents: {
    title: "HR · Documents",
    description:
      "Tenant documentation library — title, description, and Cloudinary file. HR uploads; HR and Manager can open and delete.",
  },
  "shift-templates": {
    title: "HR · Shift templates",
    description:
      "Reusable weekday patterns. Manager saves templates; HR applies them to schedules from Attendance.",
  },
  checklists: {
    title: "HR · Checklists",
    description:
      "Onboarding and exit checklist templates and runs. Exit completion requires Manager approval.",
  },
  compensation: {
    title: "HR · Compensation",
    description:
      "Salary changes, advances, loans, bonuses, and overtime. Approved advances, bonuses, and overtime increase payroll; active loans deduct installments until principal is cleared. Benefits stay outside payroll.",
  },
  "people-ops": {
    title: "HR · People ops",
    description:
      "Promotion/transfer, discipline, performance, training, benefits, and asset issue/return. Benefits are recorded only — they do not change payroll.",
  },
  payroll: {
    title: "HR · Payroll",
    description:
      "HR generates payslips for a From–To range (month named by most days). Managers configure wage windows and common pay lines, then approve payments. History is read-only.",
  },
  "payroll-generate": {
    title: "HR · Payroll · Generate",
    description:
      "Create payslips for a From–To range. Lines include gross, common rules, recorded incidents, unpaid leave (daily rate), and attendance-linked deductions (e.g. absence).",
  },
  "payroll-runs": {
    title: "HR · Payroll · Runs & pay",
    description:
      "Open a payroll run, download employee PDFs, mark payslips paid, and approve payments.",
  },
  "payroll-settings": {
    title: "HR · Payroll · Settings",
    description:
      "Wage windows and common deductions/increases (% of salary). Day range uses calendars; customized lines apply only inside an optional salary band.",
  },
  "payroll-history": {
    title: "HR · Payroll · History",
    description:
      "Read-only archive of approved payslips across payroll runs.",
  },
  incidents: {
    title: "HR · Incidents",
    description:
      "Configure incident types (Manager/Admin), optionally linked to attendance absences/lates. Recorded pay impact and linked attendance days appear on generated payslips.",
  },
  departments: {
    title: "HR · Departments",
    description:
      "Manager/Admin registers departments. HR selects them for employees and shifts.",
  },
};
