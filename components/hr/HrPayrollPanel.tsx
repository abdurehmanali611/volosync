"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  History,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { DataTable } from "@/app/StoreItems/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PendingButton } from "@/components/ui/pending-button";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import {
  HrEmptyState,
  HrFilterBar,
  HrMetricCard,
  HrPanelShell,
  HrSectionCard,
  HrStatusBadge,
  HrTableFrame,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { HR_WAGE_LABELS, HR_WAGE_TYPES, hrStatusLabel } from "@/lib/hrConstraints";
import { isHrEmployeePayrollReady } from "@/lib/hrPayrollReady";
import {
  formatPayrollWeeksLabel,
  inclusiveDayCount,
  namedMonthFromPayRange,
  payrollWeeksInRange,
} from "@/lib/hrPayrollMonth";
import { downloadPayslipPdf, downloadPayslipPdfs } from "@/lib/hrPayslipPdf";
import { formatETB } from "@/lib/subscriptionModules";
import { notifyApiFailure } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  isPendingManagerApprovalError,
  pendingManagerApprovalMessage,
} from "@/lib/hrPendingApproval";
import {
  approveHrPayslipsPaymentApi,
  closeHrPayrollPeriodApi,
  createHrPayrollPeriodApi,
  fetchHrPayrollLineRules,
  fetchHrPayslips,
  fetchHrPayrollBankExportApi,
  fetchHrWagePayWindows,
  markHrPayslipsPaidApi,
  replaceHrPayrollLineRulesApi,
  replaceHrWagePayWindowsApi,
  type HrEmployee,
  type HrPayrollPeriod,
  type HrPayslip,
  type HrWagePayWindow,
} from "@/lib/api/hrSource";

const fieldClass = "min-w-0";
const triggerClass = cn(hrFieldClass, "justify-between");
const inputClass = hrFieldClass;

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function payslipInDateRange(slip: HrPayslip, from: string, to: string) {
  if (!from && !to) return true;
  const pFrom = slip.period?.fromYmd || slip.payDate || "";
  const pTo = slip.period?.toYmd || slip.payDate || pFrom;
  if (!pFrom && !pTo) return true;
  if (from && pTo && pTo < from) return false;
  if (to && pFrom && pFrom > to) return false;
  return true;
}

type LineDraft = {
  key: string;
  kind: "deduction" | "increase";
  label: string;
  percentOfSalary: number;
  percentText: string;
  whenMode: "always" | "day_range";
  fromYmd: string;
  toYmd: string;
  customized: boolean;
  fromAmountETB: string;
  toAmountETB: string;
};

function formatPercentText(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n);
}

function parsePercentInput(raw: string): { text: string; value: number } | null {
  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return null;
  if (raw === "" || raw === ".") return { text: raw, value: 0 };
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > 100) return { text: "100", value: 100 };
  if (n < 0) return { text: "0", value: 0 };
  return { text: raw, value: n };
}

type WindowDraft = {
  key: string;
  wageType: string;
  fromDay: number;
  toDay: number;
};

export function HrPayrollPanel({
  view,
  periods,
  payslips,
  selectedPeriodId,
  onSelectedPeriodChange,
  onPayslipsChange,
  onRefresh,
  employees = [],
  canRunPayroll = true,
  canConfigurePayroll = false,
  canApprovePayrollPayment = false,
}: {
  view: "generate" | "runs" | "settings" | "history";
  periods: HrPayrollPeriod[];
  payslips: HrPayslip[];
  selectedPeriodId: number | null;
  onSelectedPeriodChange: (id: number | null) => void;
  onPayslipsChange: (rows: HrPayslip[]) => void;
  onRefresh: () => Promise<void>;
  employees?: HrEmployee[];
  canRunPayroll?: boolean;
  canConfigurePayroll?: boolean;
  canApprovePayrollPayment?: boolean;
}) {
  const [fromYmd, setFromYmd] = useState(todayYmd());
  const [toYmd, setToYmd] = useState(todayYmd());
  const [generateScope, setGenerateScope] = useState("batch");
  const [payWindows, setPayWindows] = useState<HrWagePayWindow[]>([]);
  const [pending, setPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyRows, setHistoryRows] = useState<HrPayslip[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histFromYmd, setHistFromYmd] = useState("");
  const [histToYmd, setHistToYmd] = useState("");
  const [histEmployeeId, setHistEmployeeId] = useState("all");
  const [histAmountFrom, setHistAmountFrom] = useState("");
  const [histAmountTo, setHistAmountTo] = useState("");
  const [histWageType, setHistWageType] = useState("all");
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([]);
  const [windowDrafts, setWindowDrafts] = useState<WindowDraft[]>([]);
  const [configLoading, setConfigLoading] = useState(false);

  const selected = periods.find((p) => p.id === selectedPeriodId) ?? null;
  const namedPreview = useMemo(() => {
    try {
      if (toYmd < fromYmd) return null;
      return namedMonthFromPayRange(fromYmd, toYmd);
    } catch {
      return null;
    }
  }, [fromYmd, toYmd]);

  const rangeDays = useMemo(
    () => inclusiveDayCount(fromYmd, toYmd),
    [fromYmd, toYmd],
  );

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (e) => e.status === "active" || e.status === "on_leave",
      ),
    [employees],
  );

  const requiredMinDays = useMemo(() => {
    if (/^\d+$/.test(generateScope)) {
      const emp = activeEmployees.find((e) => String(e.id) === generateScope);
      const wt = emp?.wageType || "";
      const w = payWindows.find((row) => row.wageType === wt);
      return Number(w?.fromDay) || 0;
    }
    if (generateScope === "monthly" || generateScope === "weekly") {
      const w = payWindows.find((row) => row.wageType === generateScope);
      return Number(w?.fromDay) || 0;
    }
    return payWindows.reduce(
      (max, w) => Math.max(max, Number(w.fromDay) || 0),
      0,
    );
  }, [activeEmployees, generateScope, payWindows]);

  const unpaidIds = useMemo(
    () => payslips.filter((p) => p.paymentStatus === "unpaid").map((p) => p.id),
    [payslips],
  );
  /** Slips waiting on Manager/Finance confirm (not final marked paid yet). */
  const markedIds = useMemo(
    () =>
      payslips
        .filter((p) => {
          const st = p.paymentStatus;
          if (st === "awaiting_finance") return true;
          if (st === "marked_paid" && !p.managerApprovedAt) return true;
          return false;
        })
        .map((p) => p.id),
    [payslips],
  );
  /** Final mark-paid only (Finance/Manager confirmed, or legacy approved). */
  const isMarkedPaidSlip = (p: HrPayslip) => {
    const st = String(p.paymentStatus || "");
    if (st === "approved") return true;
    if (st === "marked_paid" && p.managerApprovedAt) return true;
    return false;
  };
  const markedPaidCount = useMemo(
    () => payslips.filter(isMarkedPaidSlip).length,
    [payslips],
  );
  const allSlipsMarkedPaid =
    payslips.length > 0 && payslips.every(isMarkedPaidSlip);
  const unpaidOrAwaitingCount = payslips.length - markedPaidCount;
  /** Close control for Manager/Admin while run is open; enabled only when every slip is final marked paid. */
  const showClosePayroll =
    canApprovePayrollPayment &&
    !!selected &&
    selected.status !== "closed" &&
    selected.status !== "pending_generate" &&
    payslips.length > 0;
  const periodNeedsClose = showClosePayroll && allSlipsMarkedPaid;
  const canSelectRows =
    !historyMode &&
    (canRunPayroll || canApprovePayrollPayment) &&
    !!selected &&
    selected.status !== "closed" &&
    selected.status !== "pending_generate";
  const totalNet = useMemo(
    () => payslips.reduce((sum, p) => sum + (p.netPayETB || 0), 0),
    [payslips],
  );

  useEffect(() => {
    if (view !== "generate" && view !== "settings") return;
    let cancelled = false;
    void (async () => {
      try {
        const windows = await fetchHrWagePayWindows();
        if (cancelled) return;
        setPayWindows(windows.filter((w) => w.active !== false));
      } catch {
        /* settings load also surfaces errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (!canConfigurePayroll || view !== "settings") return;
    let cancelled = false;
    void (async () => {
      setConfigLoading(true);
      try {
        const [rules, windows] = await Promise.all([
          fetchHrPayrollLineRules(),
          fetchHrWagePayWindows(),
        ]);
        if (cancelled) return;
        setLineDrafts(
          rules.map((r, i) => {
            const pct = Number(r.percentOfSalary) || 0;
            return {
              key: `rule-${r.id}-${i}`,
              kind: r.kind === "increase" ? "increase" : "deduction",
              label: r.label,
              percentOfSalary: pct,
              percentText: formatPercentText(pct),
              whenMode: r.whenMode === "day_range" ? "day_range" : "always",
              fromYmd: r.fromYmd || "",
              toYmd: r.toYmd || "",
              customized: Boolean(r.customized),
              fromAmountETB:
                r.fromAmountETB != null && Number(r.fromAmountETB) > 0
                  ? String(r.fromAmountETB)
                  : "",
              toAmountETB:
                r.toAmountETB == null ? "" : String(r.toAmountETB),
            };
          }),
        );
        setWindowDrafts(
          windows.map((w, i) => ({
            key: `win-${w.id}-${i}`,
            wageType: (HR_WAGE_TYPES as readonly string[]).includes(w.wageType)
              ? w.wageType
              : "monthly",
            fromDay: w.fromDay,
            toDay: w.toDay,
          })),
        );
      } catch (e) {
        notifyApiFailure(e, "Could not load payroll settings");
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canConfigurePayroll, view]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedPeriodId, payslips]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await fetchHrPayslips();
      setHistoryRows(rows);
      setHistoryMode(true);
    } catch (e) {
      notifyApiFailure(e, "Could not load payslip history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== "history") return;
    void loadHistory();
  }, [view, loadHistory]);

  useEffect(() => {
    if (view !== "history") return;
    const onRefresh = () => void loadHistory();
    window.addEventListener("hotcol-hr-refresh", onRefresh);
    return () => window.removeEventListener("hotcol-hr-refresh", onRefresh);
  }, [view, loadHistory]);

  const toggleId = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  };

  const columns = useMemo<ColumnDef<HrPayslip>[]>(
    () => [
      {
        id: "select",
        enableHiding: false,
        size: 40,
        header: () => {
          if (!canSelectRows) return null;
          const selectableIds = canRunPayroll
            ? unpaidIds.length
              ? unpaidIds
              : canApprovePayrollPayment
                ? payslips.map((p) => p.id)
                : []
            : payslips.map((p) => p.id);
          if (!selectableIds.length) return null;
          const allOn =
            selectableIds.length > 0 &&
            selectableIds.every((id) => selectedIds.includes(id));
          return (
            <Checkbox
              checked={allOn}
              onCheckedChange={(v) => {
                if (v) setSelectedIds(selectableIds);
                else setSelectedIds([]);
              }}
              aria-label="Select all payslips"
            />
          );
        },
        cell: ({ row }) => {
          if (!canSelectRows) return null;
          const st = row.original.paymentStatus;
          // HR: check unpaid to mark paid
          if (canRunPayroll && !canApprovePayrollPayment) {
            if (st !== "unpaid") return <span className="inline-block w-4" />;
          }
          // Manager/Admin: check any slip on an open run
          return (
            <Checkbox
              checked={selectedIds.includes(row.original.id)}
              onCheckedChange={(v) => toggleId(row.original.id, Boolean(v))}
              aria-label={`Select ${row.original.employeeName}`}
            />
          );
        },
      },
      {
        accessorKey: "payslipNumber",
        header: "Payslip #",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {row.original.payslipNumber || "—"}
          </span>
        ),
      },
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.employeeName ||
                row.original.employee?.fullName ||
                `#${row.original.employeeId}`}
            </p>
            {row.original.jobTitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.jobTitle}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "taxPeriod",
        header: "Month",
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className="border-primary/20 bg-primary/10 font-normal text-primary dark:text-primary"
          >
            {row.original.taxPeriod || "—"}
          </Badge>
        ),
      },
      {
        id: "wage",
        header: "Wage",
        cell: ({ row }) => {
          const slip = row.original;
          const wt = String(slip.wageType || "").trim();
          const label =
            HR_WAGE_LABELS[wt as keyof typeof HR_WAGE_LABELS] || wt || "—";
          if (wt !== "weekly") {
            return <span className="text-sm">{label}</span>;
          }
          const from = slip.period?.fromYmd || selected?.fromYmd || "";
          const to = slip.period?.toYmd || selected?.toYmd || "";
          let weeks = 0;
          const noteMatch = String(slip.notes || "").match(
            /payrollWeeks=([\d.]+)/,
          );
          if (noteMatch) weeks = Number(noteMatch[1]) || 0;
          else if (from && to) weeks = payrollWeeksInRange(from, to);
          return (
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                {weeks > 0
                  ? formatPayrollWeeksLabel(weeks)
                  : "Payroll / week"}
              </p>
            </div>
          );
        },
      },
      {
        id: "net",
        header: () => <span className="block w-full text-right">Net pay</span>,
        cell: ({ row }) => (
          <span className="block text-right font-semibold tabular-nums">
            {formatETB(row.original.netPayETB)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Payment",
        cell: ({ row }) => (
          <HrStatusBadge status={row.original.paymentStatus} />
        ),
      },
      {
        id: "pdf",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/25 bg-primary/5 hover:bg-primary/10"
            onClick={async () => {
              try {
                await downloadPayslipPdf(row.original);
              } catch (e) {
                notifyApiFailure(e, "Could not generate PDF");
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
        ),
      },
    ],
    [
      canApprovePayrollPayment,
      canRunPayroll,
      canSelectRows,
      payslips,
      selected,
      selectedIds,
      unpaidIds,
    ],
  );

  const historyColumns = useMemo<ColumnDef<HrPayslip>[]>(
    () =>
      columns.map((col) =>
        col.id === "select"
          ? { ...col, cell: () => null, header: () => null }
          : col,
      ) as ColumnDef<HrPayslip>[],
    [columns],
  );

  const historyEmployeeOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const e of employees) {
      byId.set(e.id, e.fullName);
    }
    for (const row of historyRows) {
      if (byId.has(row.employeeId)) continue;
      byId.set(
        row.employeeId,
        row.employeeName ||
          row.employee?.fullName ||
          `#${row.employeeId}`,
      );
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ value: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [employees, historyRows]);

  const historyFiltersActive =
    Boolean(histFromYmd) ||
    Boolean(histToYmd) ||
    histEmployeeId !== "all" ||
    histAmountFrom !== "" ||
    histAmountTo !== "" ||
    histWageType !== "all";

  const filteredHistoryRows = useMemo(() => {
    const amountFrom =
      histAmountFrom.trim() === "" ? null : Number(histAmountFrom);
    const amountTo =
      histAmountTo.trim() === "" ? null : Number(histAmountTo);
    const empId =
      histEmployeeId !== "all" ? Number(histEmployeeId) : null;

    return historyRows.filter((row) => {
      if (!payslipInDateRange(row, histFromYmd, histToYmd)) return false;
      if (empId != null && row.employeeId !== empId) return false;
      if (
        histWageType !== "all" &&
        String(row.wageType || "") !== histWageType
      ) {
        return false;
      }
      const wage = Number(row.netPayETB) || 0;
      if (amountFrom != null && Number.isFinite(amountFrom) && wage < amountFrom) {
        return false;
      }
      if (amountTo != null && Number.isFinite(amountTo) && wage > amountTo) {
        return false;
      }
      return true;
    });
  }, [
    historyRows,
    histFromYmd,
    histToYmd,
    histEmployeeId,
    histAmountFrom,
    histAmountTo,
    histWageType,
  ]);

  const clearHistoryFilters = () => {
    setHistFromYmd("");
    setHistToYmd("");
    setHistEmployeeId("all");
    setHistAmountFrom("");
    setHistAmountTo("");
    setHistWageType("all");
  };

  const saveConfig = async () => {
    setPending(true);
    try {
      await Promise.all([
        replaceHrPayrollLineRulesApi(
          lineDrafts
            .filter((r) => r.label.trim())
            .map((r) => ({
              kind: r.kind,
              label: r.label.trim(),
              percentOfSalary: r.percentOfSalary,
              amountETB: 0,
              whenMode: r.whenMode,
              fromYmd: r.whenMode === "day_range" ? r.fromYmd : "",
              toYmd: r.whenMode === "day_range" ? r.toYmd : "",
              customized: r.customized,
              fromAmountETB: r.customized
                ? Number(r.fromAmountETB) || 0
                : 0,
              toAmountETB:
                r.customized && r.toAmountETB.trim() !== ""
                  ? Number(r.toAmountETB)
                  : null,
              active: true,
            })),
        ),
        replaceHrWagePayWindowsApi(
          windowDrafts
            .filter((w) => w.wageType)
            .map((w) => ({
              wageType: w.wageType,
              fromDay: w.fromDay,
              toDay: w.toDay,
              active: true,
            })),
        ),
      ]);
      toast.success("Payroll settings saved");
    } catch (e) {
      notifyApiFailure(e, "Could not save payroll settings");
    } finally {
      setPending(false);
    }
  };

  return (
    <HrPanelShell>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HrMetricCard
          label="Payroll runs"
          value={periods.length}
          hint="Generated pay periods"
          accent="from-primary/15 border-primary/25"
          icon={<Wallet className="h-4 w-4 text-primary dark:text-primary" />}
        />
        <HrMetricCard
          label="Payslips in run"
          value={payslips.length}
          hint={selected ? `${selected.fromYmd} → ${selected.toYmd}` : "Select a run"}
          accent="from-primary/15 border-primary/25"
          icon={<FileText className="h-4 w-4 text-primary dark:text-primary" />}
        />
        <HrMetricCard
          label="Net in run"
          value={formatETB(totalNet)}
          hint={`${markedPaidCount} marked paid`}
          accent="from-violet-400/15 border-violet-400/25"
          icon={<Banknote className="h-4 w-4 text-violet-400 dark:text-violet-400" />}
        />
        <HrMetricCard
          label="Named month"
          value={selected?.monthName || namedPreview?.monthName || "—"}
          hint="Most days in From–To"
          accent="from-primary/10 border-primary/20"
          icon={<Sparkles className="h-4 w-4 text-primary" />}
        />
      </div>

      <div className="space-y-4">
        {view === "generate" && canRunPayroll ? (
          <div className="space-y-4">
            <HrSectionCard
              title="Generate payslips"
              description="Payslips include gross pay, common rules, incident pay impact, unpaid leave (daily rate), and attendance-linked deductions for the From–To range. The incident occurred date must fall inside From–To. Re-generating the same open From–To replaces the run so new incidents are included."
              icon={
                <CalendarRange className="h-5 w-5 text-primary dark:text-primary" />
              }
              accent="bg-linear-to-r from-primary via-primary to-primary/70"
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-4 rounded-xl border border-primary/20 bg-linear-to-br from-primary/8 via-muted/15 to-violet-400/8 p-4 shadow-sm sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={fieldClass}>
                      <HotelDayPicker
                        label="From"
                        value={fromYmd}
                        onChange={setFromYmd}
                        compact
                        buttonClassName={cn(
                          inputClass,
                          "justify-start font-normal",
                        )}
                      />
                    </div>
                    <div className={fieldClass}>
                      <HotelDayPicker
                        label="To"
                        value={toYmd}
                        onChange={setToYmd}
                        compact
                        buttonClassName={cn(
                          inputClass,
                          "justify-start font-normal",
                        )}
                      />
                    </div>
                  </div>

                  <div className={cn(fieldClass, "space-y-1.5")}>
                    <Label className="text-xs font-medium text-primary/60 dark:text-primary/70">
                      Scope
                    </Label>
                    <HrOptionCombobox
                      value={generateScope}
                      onChange={setGenerateScope}
                      options={[
                        {
                          value: "batch",
                          label: "Batch — monthly + weekly",
                        },
                        {
                          value: "monthly",
                          label: "Monthly wage type",
                        },
                        {
                          value: "weekly",
                          label: "Weekly wage type",
                        },
                        ...activeEmployees.map((e) => ({
                          value: String(e.id),
                          label: e.fullName,
                          hint: [
                            HR_WAGE_LABELS[
                              e.wageType as keyof typeof HR_WAGE_LABELS
                            ] || e.wageType,
                            !isHrEmployeePayrollReady(e)
                              ? "needs pay details"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        })),
                      ]}
                      placeholder="Select scope"
                      emptyText="No scopes found."
                      className={triggerClass}
                    />
                    <p className="text-xs text-muted-foreground">
                      Batch pays both wage types. Monthly / Weekly pays only
                      that type. From–To must span at least the wage window
                      “from day” (
                      {requiredMinDays > 0
                        ? `${requiredMinDays} day${requiredMinDays === 1 ? "" : "s"} min`
                        : "configure windows in Settings"}
                      ; current range {rangeDays || 0} day
                      {rangeDays === 1 ? "" : "s"}
                      ).
                    </p>
                  </div>

                  <PendingButton
                    pending={pending}
                    className={cn("w-full gap-2 sm:w-auto", hrPrimaryBtnClass)}
                    onClick={async () => {
                      if (toYmd < fromYmd) {
                        toast.error("To date must not be before From date");
                        return;
                      }
                      if (requiredMinDays > 0 && rangeDays < requiredMinDays) {
                        toast.error(
                          `From–To must cover at least ${requiredMinDays} days for this scope`,
                        );
                        return;
                      }
                      setPending(true);
                      try {
                        const isEmployee = /^\d+$/.test(generateScope);
                        const period = await createHrPayrollPeriodApi({
                          fromYmd,
                          toYmd,
                          employeeIds: isEmployee
                            ? [Number(generateScope)]
                            : undefined,
                          wageScope: isEmployee
                            ? undefined
                            : (generateScope as
                                | "batch"
                                | "monthly"
                                | "weekly"),
                        });
                        toast.success(
                          `Generated payslips for ${period.fromYmd} → ${period.toYmd} (${period.monthName})`,
                        );
                        if (/Skipped \d+ employee/i.test(period.notes || "")) {
                          toast.warning(period.notes);
                        }
                        await onRefresh();
                        onSelectedPeriodChange(period.id);
                        const rows = await fetchHrPayslips(period.id);
                        onPayslipsChange(rows);
                      } catch (e) {
                        if (isPendingManagerApprovalError(e)) {
                          toast.success(pendingManagerApprovalMessage(e));
                          return;
                        }
                        notifyApiFailure(e, "Could not generate payroll");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    {/^\d+$/.test(generateScope)
                      ? "Generate single payslip"
                      : generateScope === "monthly"
                        ? "Generate monthly payslips"
                        : generateScope === "weekly"
                          ? "Generate weekly payslips"
                          : "Generate batch payslips"}
                  </PendingButton>
                </div>

                <div className="flex flex-col justify-between gap-4 rounded-xl border border-primary/20 bg-linear-to-br from-primary/10 via-card to-violet-400/5 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80 dark:text-primary">
                      Payslip month preview
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">
                      {namedPreview?.monthName || "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {namedPreview
                        ? `Payslip title month · ${namedPreview.periodKey} (${namedPreview.dayCount}d in that month). Pay range stays ${fromYmd} → ${toYmd}.`
                        : "Choose a valid From–To range"}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2">
                      <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
                      <span className="tabular-nums">
                        {fromYmd} → {toYmd}
                        {rangeDays > 0 ? ` · ${rangeDays}d` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span>
                        {/^\d+$/.test(generateScope)
                          ? "One employee PDF"
                          : generateScope === "weekly"
                            ? "Weekly employees (weeks on payslip)"
                            : generateScope === "monthly"
                              ? "Monthly employees"
                              : "Monthly + weekly employees"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </HrSectionCard>
          </div>
        ) : null}

        {view === "runs" ? (
          <div className="space-y-4">
          <HrSectionCard
            title="Runs & payment"
            description="Select a run, download PDFs, mark paid (HR), Finance/Manager confirm, then Close when every slip is marked paid."
            icon={
              <ClipboardList className="h-5 w-5 text-primary dark:text-primary" />
            }
            accent="bg-linear-to-r from-primary via-violet-400 to-violet-400/80"
          >
            <div className="mb-4 rounded-xl border border-primary/20 bg-linear-to-br from-primary/8 via-muted/15 to-violet-400/5 p-4 shadow-sm">
              <Label className="text-xs font-medium text-primary/60 dark:text-primary/70">
                Payroll run
              </Label>
              <HrOptionCombobox
                value={selectedPeriodId ? String(selectedPeriodId) : ""}
                onChange={(v) => {
                  setHistoryMode(false);
                  onSelectedPeriodChange(Number(v));
                }}
                options={periods.map((p) => ({
                  value: String(p.id),
                  label: `${p.fromYmd} → ${p.toYmd}`,
                  hint: `${p.monthName || p.periodKey} · ${hrStatusLabel(p.status)}`,
                }))}
                placeholder="Choose a payroll run"
                emptyText="No payroll runs yet."
                className={cn(triggerClass, "mt-1.5")}
              />
            </div>

            {!selected ? (
              <HrEmptyState
                title="No run selected"
                description="Generate a payroll run first, or pick one above."
                icon={<Wallet className="h-7 w-7" />}
              />
            ) : selected.status === "pending_generate" ? (
              <HrEmptyState
                title="Awaiting Manager approval"
                description={`This run (${selected.fromYmd} → ${selected.toYmd}) was submitted by HR and has no payslips yet. Manager must approve generate under HR approvals.`}
                icon={<Wallet className="h-7 w-7" />}
              />
            ) : payslips.length ? (
              <>
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-linear-to-r from-primary/8 via-muted/20 to-violet-400/5 px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="border-primary/20 bg-primary/10 font-normal text-primary dark:text-primary"
                    >
                      {payslips.length} payslip
                      {payslips.length === 1 ? "" : "s"}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!selected) return;
                        try {
                          const rows = await fetchHrPayrollBankExportApi(selected.id);
                          if (!rows.length) {
                            toast.error(
                              "No bank-ready payslips (need bank name and account)",
                            );
                            return;
                          }
                          const skipped =
                            payslips.length - rows.length;
                          const { exportRowsExcel } = await import(
                            "@/lib/hotelInventoryExcelExport"
                          );
                          await exportRowsExcel(
                            `payroll-bank-${selected.fromYmd}_${selected.toYmd}`,
                            "Bank",
                            rows.map((r) => ({
                              Employee: r.employeeName,
                              Bank: r.bankName,
                              Account: r.accountNumber,
                              NetPayETB: r.netPayETB,
                              Payslip: r.payslipNumber,
                            })),
                          );
                          if (skipped > 0) {
                            toast.success(
                              `Bank export downloaded (${skipped} skipped — missing bank details)`,
                            );
                          } else {
                            toast.success("Bank export downloaded");
                          }
                        } catch (e) {
                          notifyApiFailure(e, "Bank export failed");
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Bank export
                    </Button>
                    {selectedIds.length ? (
                      <Badge className="border-emerald-500/30 bg-primary/10 font-normal text-emerald-800 dark:text-emerald-300">
                        {selectedIds.length} selected
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canRunPayroll && unpaidIds.length ? (
                      <PendingButton
                        pending={pending}
                        size="sm"
                        className={cn("gap-1.5", hrPrimaryBtnClass)}
                        onClick={async () => {
                          const ids = selectedIds.some((id) =>
                            unpaidIds.includes(id),
                          )
                            ? selectedIds.filter((id) =>
                                unpaidIds.includes(id),
                              )
                            : unpaidIds;
                          setPending(true);
                          try {
                            await markHrPayslipsPaidApi(ids);
                            toast.success(
                              "Sent to Finance for mark-paid confirmation",
                            );
                            setSelectedIds([]);
                            const rows = await fetchHrPayslips(selected.id);
                            onPayslipsChange(rows);
                            await onRefresh();
                          } catch (e) {
                            notifyApiFailure(e, "Could not mark paid");
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark paid (HR) ({unpaidIds.length})
                      </PendingButton>
                    ) : null}
                    {canApprovePayrollPayment && markedIds.length ? (
                      <PendingButton
                        pending={pending}
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 border-emerald-500/30 bg-primary/10 text-emerald-900 hover:bg-primary/15 dark:text-emerald-200"
                        onClick={async () => {
                          const ids = selectedIds.some((id) =>
                            markedIds.includes(id),
                          )
                            ? selectedIds.filter((id) =>
                                markedIds.includes(id),
                              )
                            : markedIds;
                          setPending(true);
                          try {
                            await approveHrPayslipsPaymentApi(ids);
                            toast.success(
                              "Payment confirmed — use Close payroll when every slip is marked paid",
                            );
                            setSelectedIds([]);
                            const rows = await fetchHrPayslips(selected.id);
                            onPayslipsChange(rows);
                            await onRefresh();
                          } catch (e) {
                            notifyApiFailure(e, "Could not approve payment");
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm paid (Manager) ({markedIds.length})
                      </PendingButton>
                    ) : null}
                    {showClosePayroll ? (
                      <PendingButton
                        pending={pending}
                        size="sm"
                        className={cn("gap-1.5", hrPrimaryBtnClass)}
                        disabled={!periodNeedsClose}
                        title={
                          periodNeedsClose
                            ? "Close this payroll run"
                            : `Close when every payslip is marked paid (${unpaidOrAwaitingCount} still unpaid or awaiting confirm)`
                        }
                        onClick={async () => {
                          if (!periodNeedsClose) {
                            toast.error(
                              `Close payroll when every slip is marked paid — ${unpaidOrAwaitingCount} still unpaid or awaiting Finance/Manager confirm`,
                            );
                            return;
                          }
                          setPending(true);
                          try {
                            await closeHrPayrollPeriodApi(selected.id);
                            toast.success("Payroll run closed");
                            await onRefresh();
                          } catch (e) {
                            notifyApiFailure(e, "Could not close payroll");
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Close payroll
                        {!periodNeedsClose
                          ? ` (${unpaidOrAwaitingCount} left)`
                          : ""}
                      </PendingButton>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-emerald-500/30 bg-primary/5 hover:bg-primary/10"
                      onClick={async () => {
                        try {
                          const targets = selectedIds.length
                            ? payslips.filter((p) =>
                                selectedIds.includes(p.id),
                              )
                            : payslips;
                          await downloadPayslipPdfs(targets);
                          toast.success(
                            `Downloaded ${targets.length} PDF${targets.length === 1 ? "" : "s"}`,
                          );
                        } catch (e) {
                          notifyApiFailure(e, "Could not download PDFs");
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                      {selectedIds.length ? ` (${selectedIds.length})` : "s"}
                    </Button>
                  </div>
                </div>
                <HrTableFrame>
                  <DataTable
                    embedded columns={columns}
                    data={payslips}
                    searchColumnId="employeeName"
                    searchPlaceholder="Search payslips…"
                    pageSize={10}
                  />
                </HrTableFrame>
              </>
            ) : (
              <HrEmptyState
                title="No payslips in this run"
                description="Generate payroll for this range to create employee PDFs."
                icon={<FileText className="h-7 w-7" />}
              />
            )}
          </HrSectionCard>
        </div>
        ) : null}

        {view === "settings" && canConfigurePayroll ? (
          <div className="space-y-4">
            <HrSectionCard
              title="Wage-type pay windows"
              description="From day = minimum From–To calendar length (days) for that wage type. Batch generate uses the largest from-day across windows. To day is kept for reference."
              icon={
                <Settings2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              }
              accent="bg-linear-to-r from-violet-500 via-violet-400 to-primary/80"
              actions={
                <PendingButton
                  pending={pending}
                  size="sm"
                  className={hrPrimaryBtnClass}
                  onClick={saveConfig}
                >
                  Save all settings
                </PendingButton>
              }
            >
              {configLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
                </div>
              ) : !windowDrafts.length ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-violet-500/25 bg-muted/20 px-4 py-10 text-center">
                  <CalendarRange className="h-8 w-8 text-violet-600/80" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    No wage windows yet. Add the minimum From–To length (days)
                    required before that wage type can be paid.
                  </p>
                  <Button
                    type="button"
                    onClick={() =>
                      setWindowDrafts([
                        {
                          key: `win-new-${Date.now()}`,
                          wageType: "weekly",
                          fromDay: 5,
                          toDay: 8,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add first window
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-1 hidden px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_100px_100px_40px] lg:gap-2">
                    <span>Wage type</span>
                    <span className="text-center">Min days</span>
                    <span className="text-center">To day</span>
                    <span className="sr-only">Remove</span>
                  </div>
                  <ScrollArea className="h-[min(36vh,360px)]">
                    <div className="space-y-3 pr-3">
                      {windowDrafts.map((row, index) => (
                        <article
                          key={row.key}
                          className="overflow-hidden rounded-2xl border border-violet-500/20 bg-card shadow-sm ring-1 ring-violet-500/10"
                        >
                          <div className="flex items-center gap-2 border-b border-border/50 bg-violet-500/5 px-4 py-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-800 dark:text-violet-300">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium">
                              {HR_WAGE_LABELS[
                                row.wageType as keyof typeof HR_WAGE_LABELS
                              ] || row.wageType}
                            </span>
                            <Badge variant="secondary" className="ml-auto font-normal tabular-nums">
                              Day {row.fromDay} → {row.toDay}
                            </Badge>
                          </div>
                          <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_100px_100px_40px] sm:items-end">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground sm:sr-only">
                                Wage type
                              </Label>
                              <Select
                                value={row.wageType}
                                onValueChange={(wageType) =>
                                  setWindowDrafts((prev) =>
                                    prev.map((r, i) =>
                                      i === index ? { ...r, wageType } : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className={triggerClass}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {HR_WAGE_TYPES.map((w) => (
                                    <SelectItem key={w} value={w}>
                                      {HR_WAGE_LABELS[w]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground sm:sr-only">
                                Min days (from)
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={31}
                                className={cn(inputClass, "text-center")}
                                value={row.fromDay}
                                onChange={(e) =>
                                  setWindowDrafts((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            fromDay: Math.min(
                                              31,
                                              Math.max(
                                                1,
                                                Number(e.target.value) || 1,
                                              ),
                                            ),
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground sm:sr-only">
                                To day
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={31}
                                className={cn(inputClass, "text-center")}
                                value={row.toDay}
                                onChange={(e) =>
                                  setWindowDrafts((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            toDay: Math.min(
                                              31,
                                              Math.max(
                                                1,
                                                Number(e.target.value) || 1,
                                              ),
                                            ),
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() =>
                                setWindowDrafts((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                              aria-label={`Remove window ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 sm:w-auto"
                    onClick={() =>
                      setWindowDrafts((prev) => [
                        ...prev,
                        {
                          key: `win-new-${Date.now()}`,
                          wageType: "weekly",
                          fromDay: 5,
                          toDay: 8,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add wage window
                  </Button>
                </div>
              )}
            </HrSectionCard>

            <HrSectionCard
              title="Common deductions & increases"
              description="Percent of base salary. Day range uses calendar dates. Customized salary band (initial → optional final) limits which employees the % applies to."
              icon={
                <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              }
              accent="bg-linear-to-r from-amber-500 via-orange-400 to-rose-400/70"
            >
              {!lineDrafts.length ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-amber-500/25 bg-muted/20 px-4 py-10 text-center">
                  <Banknote className="h-8 w-8 text-amber-600/80" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Start empty. Add pension, tax, transport, or bonuses as a % of
                    salary — with optional date window and salary band.
                  </p>
                  <Button
                    type="button"
                    onClick={() =>
                      setLineDrafts([
                        {
                          key: `line-new-${Date.now()}`,
                          kind: "deduction",
                          label: "",
                          percentOfSalary: 0,
                          percentText: "",
                          whenMode: "always",
                          fromYmd: "",
                          toYmd: "",
                          customized: false,
                          fromAmountETB: "",
                          toAmountETB: "",
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add first line
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <ScrollArea className="h-[min(56vh,560px)]">
                    <div className="space-y-3 pr-3">
                      {lineDrafts.map((row, index) => (
                        <article
                          key={row.key}
                          className="overflow-hidden rounded-2xl border border-amber-500/20 bg-card shadow-sm ring-1 ring-amber-500/10"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 bg-amber-500/5 px-4 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                  row.kind === "increase"
                                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                    : "bg-rose-500/15 text-rose-800 dark:text-rose-300",
                                )}
                              >
                                {index + 1}
                              </span>
                              {row.kind === "increase" ? (
                                <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <ArrowDownLeft className="h-4 w-4 shrink-0 text-rose-600" />
                              )}
                              <span className="truncate text-sm font-medium">
                                {row.label.trim() ||
                                  (row.kind === "increase"
                                    ? "New increase"
                                    : "New deduction")}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="font-semibold tabular-nums"
                              >
                                {row.percentOfSalary || 0}% of salary
                              </Badge>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  setLineDrafts((prev) =>
                                    prev.filter((_, i) => i !== index),
                                  )
                                }
                                aria-label={`Remove line ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3 p-4">
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(7.5rem,0.9fr)_minmax(0,1.6fr)_minmax(5.5rem,0.7fr)_minmax(7.5rem,0.9fr)] lg:items-end">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Type
                                </Label>
                                <Select
                                  value={row.kind}
                                  onValueChange={(
                                    kind: "deduction" | "increase",
                                  ) =>
                                    setLineDrafts((prev) =>
                                      prev.map((r, i) =>
                                        i === index ? { ...r, kind } : r,
                                      ),
                                    )
                                  }
                                >
                                  <SelectTrigger className={triggerClass}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="deduction">
                                      Deduction
                                    </SelectItem>
                                    <SelectItem value="increase">
                                      Increase
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  Label
                                </Label>
                                <Input
                                  className={inputClass}
                                  value={row.label}
                                  placeholder="e.g. Income tax, Pension, Transport"
                                  onChange={(e) =>
                                    setLineDrafts((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? { ...r, label: e.target.value }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  % of salary
                                </Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  className={cn(
                                    inputClass,
                                    "tabular-nums",
                                  )}
                                  value={row.percentText}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const parsed = parsePercentInput(
                                      e.target.value,
                                    );
                                    if (!parsed) return;
                                    setLineDrafts((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? {
                                              ...r,
                                              percentText: parsed.text,
                                              percentOfSalary: parsed.value,
                                            }
                                          : r,
                                      ),
                                    );
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  When
                                </Label>
                                <Select
                                  value={row.whenMode}
                                  onValueChange={(
                                    whenMode: "always" | "day_range",
                                  ) =>
                                    setLineDrafts((prev) =>
                                      prev.map((r, i) =>
                                        i === index ? { ...r, whenMode } : r,
                                      ),
                                    )
                                  }
                                >
                                  <SelectTrigger className={triggerClass}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="always">
                                      Always
                                    </SelectItem>
                                    <SelectItem value="day_range">
                                      Day range
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {row.whenMode === "day_range" ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Initial date
                                    </Label>
                                    <HotelDayPicker
                                      value={row.fromYmd}
                                      onChange={(v) =>
                                        setLineDrafts((prev) =>
                                          prev.map((r, i) =>
                                            i === index
                                              ? { ...r, fromYmd: v }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Final date
                                    </Label>
                                    <HotelDayPicker
                                      value={row.toYmd}
                                      onChange={(v) =>
                                        setLineDrafts((prev) =>
                                          prev.map((r, i) =>
                                            i === index
                                              ? { ...r, toYmd: v }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                              </div>
                            ) : null}

                            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={row.customized}
                                  onCheckedChange={(checked) =>
                                    setLineDrafts((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? {
                                              ...r,
                                              customized: Boolean(checked),
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                                Customized {row.kind} (salary band)
                              </label>
                              {row.customized ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Initial amount (ETB)
                                    </Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      className={inputClass}
                                      value={row.fromAmountETB}
                                      placeholder="From salary"
                                      onChange={(e) =>
                                        setLineDrafts((prev) =>
                                          prev.map((r, i) =>
                                            i === index
                                              ? {
                                                  ...r,
                                                  fromAmountETB: e.target.value,
                                                }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Final amount (ETB, optional)
                                    </Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      className={inputClass}
                                      value={row.toAmountETB}
                                      placeholder="No upper bound"
                                      onChange={(e) =>
                                        setLineDrafts((prev) =>
                                          prev.map((r, i) =>
                                            i === index
                                              ? {
                                                  ...r,
                                                  toAmountETB: e.target.value,
                                                }
                                              : r,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                      onClick={() =>
                        setLineDrafts((prev) => [
                          ...prev,
                          {
                            key: `line-new-${Date.now()}`,
                            kind: "deduction",
                            label: "",
                            percentOfSalary: 0,
                            percentText: "",
                            whenMode: "always",
                            fromYmd: "",
                            toYmd: "",
                            customized: false,
                            fromAmountETB: "",
                            toAmountETB: "",
                          },
                        ])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add line
                    </Button>
                    <PendingButton
                      pending={pending}
                      className={hrPrimaryBtnClass}
                      onClick={saveConfig}
                    >
                      Save settings
                    </PendingButton>
                  </div>
                </div>
              )}
            </HrSectionCard>
          </div>
        ) : null}

        {view === "history" ? (
          <div className="space-y-4">
          <HrSectionCard
            title="Payslip history"
            description="Read-only archive. Payment status cannot be changed here."
            icon={
              <History className="h-5 w-5 text-primary dark:text-primary" />
            }
              accent="bg-linear-to-r from-primary via-violet-400 to-violet-400/80"
          >
            <HrFilterBar
              title="Filters"
              showClear={historyFiltersActive}
              onClear={clearHistoryFilters}
              className="mb-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className={cn(fieldClass, "space-y-1.5")}>
                  <HotelDayPicker
                    label="From date"
                    value={histFromYmd}
                    onChange={setHistFromYmd}
                    compact
                    placeholder="Any start"
                    buttonClassName={cn(
                      inputClass,
                      "justify-start font-normal",
                    )}
                  />
                </div>
                <div className={cn(fieldClass, "space-y-1.5")}>
                  <HotelDayPicker
                    label="To date"
                    value={histToYmd}
                    onChange={setHistToYmd}
                    compact
                    placeholder="Any end"
                    buttonClassName={cn(
                      inputClass,
                      "justify-start font-normal",
                    )}
                  />
                </div>
                <div className={cn(fieldClass, "space-y-1.5")}>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Employee
                  </Label>
                  <HrOptionCombobox
                    value={histEmployeeId}
                    onChange={setHistEmployeeId}
                    options={[
                      { value: "all", label: "All employees" },
                      ...historyEmployeeOptions,
                    ]}
                    placeholder="All employees"
                    emptyText="No employees found."
                    className={triggerClass}
                  />
                </div>
                <div className={cn(fieldClass, "space-y-1.5")}>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Amount from (ETB)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    className={inputClass}
                    placeholder="Min net pay"
                    value={histAmountFrom}
                    onChange={(e) => setHistAmountFrom(e.target.value)}
                  />
                </div>
                <div className={cn(fieldClass, "space-y-1.5")}>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Amount to (ETB)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    className={inputClass}
                    placeholder="Max net pay"
                    value={histAmountTo}
                    onChange={(e) => setHistAmountTo(e.target.value)}
                  />
                </div>
                <div className={cn(fieldClass, "space-y-1.5")}>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Wage type
                  </Label>
                  <HrOptionCombobox
                    value={histWageType}
                    onChange={setHistWageType}
                    options={[
                      { value: "all", label: "All wage types" },
                      ...HR_WAGE_TYPES.map((w) => ({
                        value: w,
                        label: HR_WAGE_LABELS[w],
                      })),
                    ]}
                    placeholder="All wage types"
                    emptyText="No wage types."
                    className={triggerClass}
                  />
                </div>
              </div>
            </HrFilterBar>

            {historyLoading && !historyRows.length ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
              </div>
            ) : filteredHistoryRows.length ? (
              <HrTableFrame>
                <DataTable
                  embedded
                  columns={historyColumns}
                  data={filteredHistoryRows}
                  searchColumnId="employeeName"
                  searchPlaceholder="Search history…"
                  pageSize={10}
                />
              </HrTableFrame>
            ) : historyRows.length ? (
              <HrEmptyState
                title="No matching payslips"
                description="Try adjusting or clearing the filters above."
                icon={<History className="h-7 w-7" />}
              />
            ) : (
              <HrEmptyState
                title="No payslip history"
                description="Approved payslips across payroll runs will appear here."
                icon={<History className="h-7 w-7" />}
              />
            )}
          </HrSectionCard>
        </div>
        ) : null}
      </div>
    </HrPanelShell>
  );
}
