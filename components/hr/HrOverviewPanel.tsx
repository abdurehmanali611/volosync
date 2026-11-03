"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { DEPARTMENT_LABELS } from "@/lib/departments";
import { HR_LEAVE_LABELS, hrStatusLabel } from "@/lib/hrConstraints";
import { HrPanelShell } from "@/components/hr/hrChrome";
import { cn } from "@/lib/utils";
import type { HrDashboardStats, HrEmployee, HrLeaveRequest, HrShift } from "@/lib/api/hrSource";

const PIE_COLORS = [
  "hsl(173 80% 36%)",
  "hsl(187 85% 40%)",
  "hsl(160 70% 38%)",
  "hsl(199 89% 42%)",
  "hsl(38 92% 48%)",
  "hsl(24 90% 50%)",
  "hsl(0 72% 55%)",
  "hsl(221 70% 50%)",
];

function readinessTone(points: number) {
  if (points >= 75) return "text-emerald-700 dark:text-emerald-400";
  if (points >= 45) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

function readinessBarClass(points: number) {
  if (points >= 75) return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
  if (points >= 45) return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  return "[&_[data-slot=progress-indicator]]:bg-rose-500";
}

export function HrOverviewPanel({
  stats,
  employees,
  leave,
  shifts,
}: {
  stats: HrDashboardStats;
  employees: HrEmployee[];
  leave: HrLeaveRequest[];
  shifts: HrShift[];
}) {
  const active = employees.filter((e) => e.status !== "terminated").length;
  const terminated = employees.filter((e) => e.status === "terminated").length;
  const rosterPts = active > 0 ? 50 + Math.min(25, active * 2) : 12;
  const leavePts = -stats.pendingLeave * 8;
  const payrollPts = stats.openPayrollPeriods === 0 ? 12 : 0;
  const shiftPts = stats.openShiftsToday > 0 ? 8 : 0;
  const readiness = Math.max(
    0,
    Math.min(100, Math.round(rosterPts + leavePts + payrollPts + shiftPts)),
  );
  const readinessLabel =
    readiness >= 75 ? "On track" : readiness >= 45 ? "Needs attention" : "At risk";
  const readinessBadgeClass =
    readiness >= 75
      ? "border-primary/20 bg-primary/10 text-emerald-700 dark:text-emerald-400"
      : readiness >= 45
        ? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-400"
        : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400";

  const attention: string[] = [];
  if (active === 0) attention.push("Add employees so headcount and leave can be tracked.");
  if (stats.pendingLeave > 0) {
    attention.push(
      `${stats.pendingLeave} leave request${stats.pendingLeave === 1 ? "" : "s"} waiting for approve or reject.`,
    );
  }
  if (stats.openPayrollPeriods > 0) {
    attention.push(
      `${stats.openPayrollPeriods} open payroll period${stats.openPayrollPeriods === 1 ? "" : "s"} still need closing.`,
    );
  }
  if (stats.onLeaveToday > 0 && active > 0 && stats.onLeaveToday / active >= 0.25) {
    attention.push(
      `${stats.onLeaveToday} of ${active} people are on leave today — coverage may be thin.`,
    );
  }

  const deptData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of employees.filter((row) => row.status !== "terminated")) {
      const key = e.department || "UNASSIGNED";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([department, value]) => ({
      department,
      name:
        DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS] ||
        department,
      value,
    }));
  }, [employees]);

  const leaveData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of leave) {
      counts.set(row.status, (counts.get(row.status) || 0) + 1);
    }
    return ["pending", "approved", "rejected"].map((status) => ({
      status: hrStatusLabel(status),
      count: counts.get(status) || 0,
    }));
  }, [leave]);

  const leaveTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of leave.filter((r) => r.status === "approved" || r.status === "pending")) {
      counts.set(row.leaveType, (counts.get(row.leaveType) || 0) + 1);
    }
    return HR_LEAVE_TYPES_SAFE.map((type) => ({
      name: HR_LEAVE_LABELS[type],
      count: counts.get(type) || 0,
    }));
  }, [leave]);

  const deptConfig = {
    value: { label: "People", color: "hsl(173 80% 36%)" },
  } satisfies ChartConfig;
  const leaveConfig = {
    count: { label: "Requests", color: "hsl(187 85% 40%)" },
  } satisfies ChartConfig;

  const drivers = [
    {
      label: "Roster",
      value: `${Math.max(0, Math.min(75, rosterPts))} pts`,
      detail:
        active === 0
          ? "No active employees yet"
          : `${active} active${terminated ? ` · ${terminated} terminated on file` : ""}`,
    },
    {
      label: "Leave pressure",
      value: leavePts === 0 ? "0 pts" : `${leavePts} pts`,
      detail:
        stats.pendingLeave === 0
          ? "No pending requests"
          : `${stats.pendingLeave} waiting in queue`,
    },
    {
      label: "Payroll",
      value: payrollPts === 0 ? "0 pts" : `+${payrollPts} pts`,
      detail:
        stats.openPayrollPeriods === 0
          ? "No open periods"
          : `${stats.openPayrollPeriods} still open`,
    },
    {
      label: "Today’s shifts",
      value: shiftPts === 0 ? "0 pts" : `+${shiftPts} pts`,
      detail:
        stats.openShiftsToday === 0
          ? "None scheduled today"
          : `${stats.openShiftsToday} on the roster`,
    },
  ];

  const metricTiles: {
    label: string;
    value: number;
    hint: string;
    icon: LucideIcon;
    accent: string;
    valueClass: string;
    iconWrap: string;
  }[] = [
    {
      label: "Headcount",
      value: stats.headcount,
      hint: "Active + on leave",
      icon: Users,
      accent:
        "border-primary/35 bg-linear-to-br from-primary/15 via-card to-card shadow-primary/10",
      valueClass: "text-primary dark:text-primary",
      iconWrap: "bg-primary/15 text-primary dark:text-primary",
    },
    {
      label: "On leave today",
      value: stats.onLeaveToday,
      hint: "Approved leave covering today",
      icon: CalendarDays,
      accent:
        "border-amber-500/35 bg-linear-to-br from-amber-500/15 via-card to-card shadow-amber-500/10",
      valueClass: "text-amber-800 dark:text-amber-400",
      iconWrap: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
    },
    {
      label: "Pending leave",
      value: stats.pendingLeave,
      hint: "Needs an HR decision",
      icon: AlertTriangle,
      accent:
        "border-violet-400/35 bg-linear-to-br from-violet-400/15 via-card to-card shadow-violet-400/10",
      valueClass: "text-violet-400 dark:text-violet-400",
      iconWrap: "bg-violet-400/15 text-violet-400 dark:text-violet-400",
    },
    {
      label: "Shifts today",
      value: stats.openShiftsToday,
      hint: "Scheduled for today",
      icon: ClipboardList,
      accent:
        "border-violet-500/35 bg-linear-to-br from-violet-500/15 via-card to-card shadow-violet-500/10",
      valueClass: "text-violet-700 dark:text-violet-400",
      iconWrap: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    },
    {
      label: "Open payroll",
      value: stats.openPayrollPeriods,
      hint: "Periods not yet closed",
      icon: Wallet,
      accent:
        "border-primary/35 bg-linear-to-br from-primary/15 via-card to-card shadow-primary/10",
      valueClass: "text-primary dark:text-primary",
      iconWrap: "bg-primary/15 text-primary dark:text-primary",
    },
  ];

  return (
    <HrPanelShell>
      <section
        aria-label="Workforce readiness"
        className="overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-b from-primary/8 via-card to-violet-400/5 shadow-md ring-1 ring-primary/10"
      >
        <div className="h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
                <Sparkles className="h-5 w-5 text-primary dark:text-primary" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight sm:text-lg md:text-xl">
                    Workforce readiness
                  </h3>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      readinessBadgeClass,
                    )}
                  >
                    {readinessLabel}
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
                  Live scorecard for this property — roster setup, leave pressure,
                  today’s coverage, and whether payroll is still open.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-2xl border border-border/70 bg-background/80 px-5 py-3 text-center shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Readiness
              </p>
              <p
                className={cn(
                  "text-4xl font-semibold tabular-nums tracking-tight",
                  readinessTone(readiness),
                )}
              >
                {readiness}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Progress
              value={readiness}
              className={cn("h-2.5", readinessBarClass(readiness))}
            />
            <p className="text-xs text-muted-foreground">
              {active} active employee{active === 1 ? "" : "s"}
              {terminated ? ` · ${terminated} terminated on file` : ""} ·{" "}
              {stats.pendingLeave} leave request
              {stats.pendingLeave === 1 ? "" : "s"} waiting · {shifts.length} shift
              {shifts.length === 1 ? "" : "s"} in the current review window
            </p>
          </div>

          <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {drivers.map((driver) => (
              <div
                key={driver.label}
                className="rounded-xl border border-border/60 bg-background/70 px-3 py-2.5"
              >
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {driver.label}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                  {driver.value}
                </dd>
                <p className="mt-0.5 text-xs text-muted-foreground">{driver.detail}</p>
              </div>
            ))}
          </dl>

          {attention.length ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Needs attention
              </p>
              <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                {attention.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              No blocking HR actions right now. Roster, leave queue, and payroll look
              clear.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metricTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 shadow-md",
                tile.accent,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium leading-snug text-muted-foreground">
                  {tile.label}
                </p>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    tile.iconWrap,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p
                className={cn(
                  "mt-3 text-3xl font-semibold tabular-nums tracking-tight",
                  tile.valueClass,
                )}
              >
                {tile.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/80 shadow-md">
          <CardHeader>
            <CardTitle>Headcount by department</CardTitle>
            <CardDescription>
              Active workforce split across operational departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deptData.length ? (
              <ChartContainer config={deptConfig} className="h-64 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={deptData} dataKey="value" nameKey="name" innerRadius={48} paddingAngle={2}>
                    {deptData.map((entry, index) => (
                      <Cell
                        key={entry.department}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Add employees to see department coverage.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-md">
          <CardHeader>
            <CardTitle>Leave pipeline</CardTitle>
            <CardDescription>
              Pending vs decided requests, plus type mix still in play.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <ChartContainer config={leaveConfig} className="h-56 w-full">
              <BarChart data={leaveData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="status" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={6} />
              </BarChart>
            </ChartContainer>
            <ChartContainer config={leaveConfig} className="h-56 w-full">
              <BarChart data={leaveTypeData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(24 90% 50%)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </HrPanelShell>
  );
}

const HR_LEAVE_TYPES_SAFE = ["annual", "sick", "unpaid"] as const;
