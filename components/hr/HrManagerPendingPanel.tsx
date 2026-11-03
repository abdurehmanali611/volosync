"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarRange,
  Check,
  ClipboardCheck,
  Clock3,
  Loader2,
  UserMinus,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HrPanelShell,
  HrSectionCard,
  HrEmptyState,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { notifyApiFailure } from "@/lib/actions";
import {
  decideHrManagerPendingActionApi,
  fetchHrManagerPendingActionsApi,
  type HrManagerPendingAction,
} from "@/lib/api/hrSource";
import type { HrApprovalsKind } from "@/constants";
import { cn } from "@/lib/utils";

type KindMeta = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  accent: string;
  icon: ReactNode;
  approveLabel: string;
  rejectLabel: string;
  approveToast: string;
  rejectToast: string;
};

const KIND_META: Record<HrApprovalsKind, KindMeta> = {
  terminate: {
    title: "Termination approvals",
    description:
      "HR asked to end employment. Approve to finalize the offboard, or reject to keep the employee active.",
    emptyTitle: "No termination requests",
    emptyDescription:
      "When HR submits a terminate request, it appears here for your decision.",
    accent: "bg-linear-to-r from-rose-600 to-orange-500",
    icon: <UserMinus className="h-5 w-5" />,
    approveLabel: "Approve terminate",
    rejectLabel: "Reject",
    approveToast: "Termination approved",
    rejectToast: "Termination rejected",
  },
  attendance_correction: {
    title: "Attendance corrections",
    description:
      "Review HR corrections to clock times or attendance status, then approve or reject each change.",
    emptyTitle: "No attendance corrections",
    emptyDescription:
      "Attendance correction requests from HR show up here until you decide.",
    accent: "bg-linear-to-r from-amber-500 to-orange-400",
    icon: <Clock3 className="h-5 w-5" />,
    approveLabel: "Approve correction",
    rejectLabel: "Reject",
    approveToast: "Attendance correction approved",
    rejectToast: "Attendance correction rejected",
  },
  payroll_generate: {
    title: "Payroll generate approvals",
    description:
      "HR queued a payroll run for a date range. Approve to let generation proceed, or cancel to remove the pending run.",
    emptyTitle: "No payroll generate requests",
    emptyDescription:
      "When HR requests payroll generation, the period waits here for Manager approval.",
    accent: "bg-linear-to-r from-primary to-violet-400",
    icon: <Wallet className="h-5 w-5" />,
    approveLabel: "Approve generate",
    rejectLabel: "Cancel request",
    approveToast: "Payroll generate approved",
    rejectToast: "Payroll generate cancelled — pending run removed",
  },
};

const ALL_META: KindMeta = {
  title: "Manager HR approvals",
  description:
    "Terminate, attendance corrections, and payroll generate requests from HR appear here until you approve or reject.",
  emptyTitle: "No pending HR actions",
  emptyDescription:
    "Terminate, attendance corrections, and payroll generate requests from HR show up here.",
  accent: "bg-linear-to-r from-violet-600 to-violet-400",
  icon: <ClipboardCheck className="h-5 w-5" />,
  approveLabel: "Approve",
  rejectLabel: "Reject",
  approveToast: "Request approved",
  rejectToast: "Request rejected",
};

function kindLabel(kind: string) {
  switch (kind) {
    case "terminate":
      return "Terminate employee";
    case "attendance_correction":
      return "Attendance correction";
    case "payroll_generate":
      return "Generate payroll";
    default:
      return kind.replaceAll("_", " ");
  }
}

function payrollPayload(row: HrManagerPendingAction) {
  const p =
    row.payloadJson && typeof row.payloadJson === "object"
      ? (row.payloadJson as {
          fromYmd?: string;
          toYmd?: string;
          monthName?: string;
          wageScope?: string;
        })
      : {};
  return {
    from: String(p.fromYmd || "").trim(),
    to: String(p.toYmd || "").trim(),
    monthName: String(p.monthName || "").trim(),
    wageScope: String(p.wageScope || "").trim(),
  };
}

function formatRequestedAt(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function subjectLine(row: HrManagerPendingAction) {
  if (row.employee?.fullName) return row.employee.fullName;
  if (row.kind === "payroll_generate") {
    const { from, to } = payrollPayload(row);
    if (from && to) return `${from} → ${to}`;
    return "Payroll run";
  }
  return row.employeeId != null ? `Employee #${row.employeeId}` : "—";
}

export function HrManagerPendingPanel({
  kindFilter,
}: {
  /** When set, only that approval kind is shown (nested Approvals menu). */
  kindFilter?: HrApprovalsKind | null;
}) {
  const [rows, setRows] = useState<HrManagerPendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const meta = kindFilter ? KIND_META[kindFilter] : ALL_META;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchHrManagerPendingActionsApi("pending");
      setRows(list);
    } catch (e) {
      notifyApiFailure(e, "Could not load pending HR approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("hotcol-hr-refresh", onRefresh);
    return () => window.removeEventListener("hotcol-hr-refresh", onRefresh);
  }, [load]);

  const visible = useMemo(() => {
    if (!kindFilter) return rows;
    return rows.filter((r) => r.kind === kindFilter);
  }, [rows, kindFilter]);

  const decide = async (row: HrManagerPendingAction, approve: boolean) => {
    const rowMeta = KIND_META[row.kind as HrApprovalsKind] ?? ALL_META;
    setBusyId(row.id);
    try {
      await decideHrManagerPendingActionApi(row.id, approve);
      if (approve) toast.success(rowMeta.approveToast);
      else toast.message(rowMeta.rejectToast);
      await load();
    } catch (e) {
      notifyApiFailure(e, approve ? "Approve failed" : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <HrPanelShell>
      <HrSectionCard
        title={meta.title}
        description={meta.description}
        icon={meta.icon}
        accent={meta.accent}
      >
        {!loading && visible.length > 0 ? (
          <p className="mb-4 text-xs text-muted-foreground">
            {visible.length} pending request
            {visible.length === 1 ? "" : "s"}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading approvals…
          </div>
        ) : visible.length === 0 ? (
          <HrEmptyState
            title={meta.emptyTitle}
            description={meta.emptyDescription}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => {
              const isPayroll = r.kind === "payroll_generate";
              const rowMeta = KIND_META[r.kind as HrApprovalsKind] ?? ALL_META;
              const payroll = isPayroll ? payrollPayload(r) : null;
              const requestedAt = formatRequestedAt(r.createdAt);
              const busy = busyId === r.id;

              return (
                <li
                  key={r.id}
                  className={cn(
                    "overflow-hidden rounded-xl border shadow-sm ring-1",
                    isPayroll
                      ? "border-primary/25 bg-linear-to-br from-primary/10 via-card to-violet-400/5 ring-primary/15"
                      : r.kind === "terminate"
                        ? "border-rose-500/20 bg-linear-to-br from-rose-500/8 via-card to-orange-500/5 ring-rose-500/10"
                        : "border-amber-500/20 bg-linear-to-br from-amber-500/8 via-card to-orange-500/5 ring-amber-500/10",
                  )}
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                            isPayroll
                              ? "bg-primary/15 text-primary dark:text-primary"
                              : r.kind === "terminate"
                                ? "bg-rose-500/15 text-rose-900 dark:text-rose-200"
                                : "bg-amber-500/15 text-amber-950 dark:text-amber-100",
                          )}
                        >
                          {isPayroll ? (
                            <Wallet className="h-3 w-3" />
                          ) : r.kind === "terminate" ? (
                            <UserMinus className="h-3 w-3" />
                          ) : (
                            <Clock3 className="h-3 w-3" />
                          )}
                          {kindLabel(r.kind)}
                        </span>
                      </div>

                      {isPayroll && payroll ? (
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-primary" />
                            <div className="min-w-0">
                              <p className="text-base font-semibold tracking-tight text-foreground">
                                {payroll.from && payroll.to
                                  ? `${payroll.from} → ${payroll.to}`
                                  : "Payroll period pending"}
                              </p>
                              {(payroll.monthName || payroll.wageScope) && (
                                <p className="text-sm text-muted-foreground">
                                  {[payroll.monthName, payroll.wageScope]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Approving unlocks payslip generation for this
                            range. Cancelling removes the pending run.
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="font-semibold tracking-tight">
                              {subjectLine(r)}
                            </p>
                            {r.employee?.department || r.employee?.jobTitle ? (
                              <p className="text-sm text-muted-foreground">
                                {[r.employee.jobTitle, r.employee.department]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Requested by{" "}
                          <span className="font-medium text-foreground/80">
                            {r.requestedBy || "HR"}
                          </span>
                        </span>
                        {requestedAt ? <span>{requestedAt}</span> : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "cursor-pointer sm:min-w-38",
                          isPayroll
                            ? "border-rose-500/30 text-rose-800 hover:bg-rose-500/10 dark:text-rose-300"
                            : "border-rose-500/30 text-rose-800 hover:bg-rose-500/10 dark:text-rose-300",
                        )}
                        disabled={busy || busyId != null}
                        onClick={() => void decide(r, false)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        {rowMeta.rejectLabel}
                      </Button>
                      <Button
                        size="sm"
                        className={cn(hrPrimaryBtnClass, "sm:min-w-38")}
                        disabled={busy || busyId != null}
                        onClick={() => void decide(r, true)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {rowMeta.approveLabel}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </HrSectionCard>
    </HrPanelShell>
  );
}
