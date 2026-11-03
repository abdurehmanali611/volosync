"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Check,
  ClipboardList,
  Clock3,
  FileDown,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Pencil,
  Search,
  Trash2,
  CalendarClock,
} from "lucide-react";
import { DataTable } from "@/app/StoreItems/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import {
  HrDialogHeader,
  HrEmptyState,
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  HrStatusBadge,
  HrTableFrame,
  hrFieldClass,
  hrPrimaryBtnClass,
  hrStatusFilterLabelClass,
  hrStatusFilterTriggerClass,
} from "@/components/hr/hrChrome";
import { HrConfirmAction } from "@/components/hr/HrConfirmAction";
import { parseYmdToDate, toYmdLocal } from "@/lib/hotelDateYmd";
import { notifyApiFailure } from "@/lib/actions";
import {
  clockHrAttendanceApi,
  deleteHrShiftApi,
  upsertHrAttendanceApi,
  type HrAttendance,
  type HrEmployee,
  type HrShift,
} from "@/lib/api/hrSource";
import {
  applyHrShiftTemplateApi,
  fetchHrShiftTemplates,
  type HrShiftTemplate,
} from "@/lib/api/hrPhaseB";
import {
  isPendingManagerApprovalError,
  pendingManagerApprovalMessage,
} from "@/lib/hrPendingApproval";
import {
  downloadHrTablePdf,
  type HrPdfColumn,
} from "@/lib/hrTableExportPdf";
import { cn } from "@/lib/utils";

const ATTENDANCE_STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half day" },
  { value: "on_leave", label: "On leave" },
] as const;

const fieldClass = "min-w-0";
const triggerClass = cn(hrFieldClass, "justify-between");
const inputClass = hrFieldClass;

type ExportKey =
  | "attendance-pdf"
  | "attendance-xlsx"
  | "shifts-pdf"
  | "shifts-xlsx";

function attendanceStatusLabel(status: string) {
  return (
    ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === status)?.label ||
    status ||
    "—"
  );
}

const ATTENDANCE_PDF_COLUMNS: HrPdfColumn[] = [
  { header: "Employee", weight: 3 },
  { header: "Date", weight: 2 },
  { header: "Clock in", weight: 1.6 },
  { header: "Clock out", weight: 1.6 },
  { header: "Status", weight: 1.8 },
  { header: "Department", weight: 2.4 },
];

const SHIFT_PDF_COLUMNS: HrPdfColumn[] = [
  { header: "Employee", weight: 3 },
  { header: "Date", weight: 2 },
  { header: "Shift", weight: 2.4 },
  { header: "Overnight", weight: 1.4 },
  { header: "Department", weight: 2.6 },
];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysYmd(ymd: string, days: number) {
  const d = parseYmdToDate(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + days);
  return toYmdLocal(d);
}

function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function normalizeHm(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** True when local HH:mm falls in the shift window (supports overnight). */
function shiftCoversMoment(
  shift: Pick<HrShift, "workDate" | "startTime" | "endTime">,
  workDate: string,
  hm: string,
  yesterdayYmd: string,
): boolean {
  const start = normalizeHm(shift.startTime);
  const end = normalizeHm(shift.endTime);
  if (!start || !end || !hm) return false;
  const overnight = end < start;

  if (shift.workDate === workDate) {
    if (overnight) return hm >= start;
    return hm >= start && hm <= end;
  }
  if (overnight && shift.workDate === yesterdayYmd) {
    return hm <= end;
  }
  return false;
}

function formatClockTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HrAttendancePanel({
  employees,
  attendance,
  shifts,
  onRefresh,
  canManageTime = true,
}: {
  employees: HrEmployee[];
  attendance: HrAttendance[];
  shifts: HrShift[];
  onRefresh: () => Promise<void>;
  /** HR/Admin clock and schedule; Manager sees reports only. */
  canManageTime?: boolean;
}) {
  const today = todayYmd();
  const yesterday = addDaysYmd(today, -1);
  const currentHm = nowHm();

  const openClockInIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of attendance) {
      if (row.workDate === today && row.clockInAt && !row.clockOutAt) {
        ids.add(row.employeeId);
      }
    }
    return ids;
  }, [attendance, today]);

  /** Employees who have a shift scheduled for today (or overnight from yesterday). */
  const employeesScheduledToday = useMemo(() => {
    const ids = new Set<number>();
    for (const s of shifts) {
      if (s.workDate === today) {
        ids.add(s.employeeId);
        continue;
      }
      // Overnight shift that started yesterday may still be active today.
      const start = normalizeHm(s.startTime);
      const end = normalizeHm(s.endTime);
      if (s.workDate === yesterday && start && end && end < start) {
        ids.add(s.employeeId);
      }
    }
    return ids;
  }, [shifts, today, yesterday]);

  const onShiftNowIds = useMemo(() => {
    const ids = new Set<number>();
    for (const s of shifts) {
      if (shiftCoversMoment(s, today, currentHm, yesterday)) {
        ids.add(s.employeeId);
      }
    }
    return ids;
  }, [shifts, today, yesterday, currentHm]);

  /**
   * No shift today → always list for clock.
   * Has a shift today → only list while that shift covers now (or open punch to clock out).
   */
  const clockEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (e.status !== "active") return false;
        if (!employeesScheduledToday.has(e.id)) return true;
        return onShiftNowIds.has(e.id) || openClockInIds.has(e.id);
      }),
    [employees, employeesScheduledToday, onShiftNowIds, openClockInIds],
  );
  const rosterEmployees = employees.filter(
    (e) => e.status === "active" || e.status === "on_leave",
  );
  const [pending, setPending] = useState(false);
  const [clocking, setClocking] = useState<"in" | "out" | null>(null);
  const [clockEmployeeIds, setClockEmployeeIds] = useState<number[]>([]);
  const [clockSearch, setClockSearch] = useState("");
  const [editingShift, setEditingShift] = useState<HrShift | null>(null);
  const [editForm, setEditForm] = useState({
    employeeId: "",
    templateId: "",
    fromYmd: todayYmd(),
    toYmd: todayYmd(),
  });
  const [correctForm, setCorrectForm] = useState({
    employeeId: "",
    workDate: todayYmd(),
    status: "present",
    notes: "",
  });
  const [applyForm, setApplyForm] = useState({
    templateId: "",
    employeeIds: [] as number[],
    fromYmd: todayYmd(),
    toYmd: addDaysYmd(todayYmd(), 13),
  });
  const [shiftTemplates, setShiftTemplates] = useState<HrShiftTemplate[]>([]);
  const [filterFrom, setFilterFrom] = useState(() =>
    addDaysYmd(todayYmd(), -13),
  );
  const [filterTo, setFilterTo] = useState(() => todayYmd());
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<ExportKey | null>(null);

  useEffect(() => {
    if (!canManageTime) return;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchHrShiftTemplates();
        if (cancelled) return;
        setShiftTemplates(rows.filter((t) => t.active !== false));
      } catch (e) {
        notifyApiFailure(e, "Could not load shift templates");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [canManageTime]);

  useEffect(() => {
    const allowed = new Set(clockEmployees.map((e) => e.id));
    setClockEmployeeIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [clockEmployees]);

  const filteredClockEmployees = useMemo(() => {
    const q = clockSearch.trim().toLowerCase();
    if (!q) return clockEmployees;
    return clockEmployees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q),
    );
  }, [clockEmployees, clockSearch]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((row) => {
      if (filterFrom && row.workDate < filterFrom) return false;
      if (filterTo && row.workDate > filterTo) return false;
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (filterEmployeeId != null && row.employeeId !== filterEmployeeId) {
        return false;
      }
      return true;
    });
  }, [attendance, filterFrom, filterTo, filterStatus, filterEmployeeId]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((row) => {
      if (filterFrom && row.workDate < filterFrom) return false;
      if (filterTo && row.workDate > filterTo) return false;
      if (filterEmployeeId != null && row.employeeId !== filterEmployeeId) {
        return false;
      }
      return true;
    });
  }, [shifts, filterFrom, filterTo, filterEmployeeId]);

  const allFilteredSelected =
    filteredClockEmployees.length > 0 &&
    filteredClockEmployees.every((e) => clockEmployeeIds.includes(e.id));
  const someFilteredSelected =
    !allFilteredSelected &&
    filteredClockEmployees.some((e) => clockEmployeeIds.includes(e.id));

  const selectedClockEmployees = useMemo(
    () => clockEmployees.filter((e) => clockEmployeeIds.includes(e.id)),
    [clockEmployees, clockEmployeeIds],
  );

  const toggleClockEmployee = (id: number, checked: boolean) => {
    setClockEmployeeIds((prev) =>
      checked
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((x) => x !== id),
    );
  };

  const toggleAllFiltered = (checked: boolean) => {
    const ids = filteredClockEmployees.map((e) => e.id);
    setClockEmployeeIds((prev) => {
      if (checked) {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return [...next];
      }
      const drop = new Set(ids);
      return prev.filter((id) => !drop.has(id));
    });
  };

  const openEditShift = (shift: HrShift) => {
    const note = String(shift.notes || "");
    const codeMatch = note.match(/template:([^\s]+)/i);
    const code = codeMatch?.[1]?.trim() || "";
    const matchedTpl =
      (code
        ? shiftTemplates.find(
            (t) => t.code.toLowerCase() === code.toLowerCase(),
          )
        : null) ||
      shiftTemplates.find(
        (t) =>
          t.startTime === shift.startTime &&
          t.endTime === shift.endTime &&
          (t.department || "") === (shift.department || ""),
      ) ||
      null;

    setEditingShift(shift);
    setEditForm({
      employeeId: String(shift.employeeId),
      templateId: matchedTpl ? String(matchedTpl.id) : "",
      fromYmd: shift.workDate || todayYmd(),
      toYmd: shift.workDate || todayYmd(),
    });
  };

  const saveEditShift = async () => {
    if (!editingShift) return;
    if (!editForm.employeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!editForm.templateId) {
      toast.error("Select a shift template");
      return;
    }
    if (!editForm.fromYmd || !editForm.toYmd) {
      toast.error("Select from and to dates");
      return;
    }
    if (editForm.toYmd < editForm.fromYmd) {
      toast.error("To date must be on or after From");
      return;
    }
    const employeeId = Number(editForm.employeeId);
    setPending(true);
    try {
      const toReplace = shifts.filter(
        (s) =>
          s.employeeId === employeeId &&
          s.workDate >= editForm.fromYmd &&
          s.workDate <= editForm.toYmd,
      );
      for (const s of toReplace) {
        await deleteHrShiftApi(s.id);
      }
      const count = await applyHrShiftTemplateApi({
        templateId: Number(editForm.templateId),
        employeeIds: [employeeId],
        fromYmd: editForm.fromYmd,
        toYmd: editForm.toYmd,
      });
      toast.success(
        count
          ? `Updated schedule · ${count} shift${count === 1 ? "" : "s"}`
          : "No shifts matched the template weekdays in that range",
      );
      setEditingShift(null);
      await onRefresh();
    } catch (e) {
      notifyApiFailure(e, "Could not update shift");
    } finally {
      setPending(false);
    }
  };

  const attendanceColumns = useMemo<ColumnDef<HrAttendance>[]>(
    () => [
      {
        accessorKey: "employee",
        header: "Employee",
        cell: ({ row }) =>
          row.original.employee?.fullName || `#${row.original.employeeId}`,
      },
      { accessorKey: "workDate", header: "Date" },
      {
        id: "clock",
        header: "Clock",
        cell: ({ row }) =>
          `${formatClockTime(row.original.clockInAt)} → ${formatClockTime(row.original.clockOutAt)}`,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  const shiftColumns = useMemo<ColumnDef<HrShift>[]>(
    () => [
      {
        accessorKey: "employee",
        header: "Employee",
        cell: ({ row }) =>
          row.original.employee?.fullName || `#${row.original.employeeId}`,
      },
      { accessorKey: "workDate", header: "Date" },
      {
        id: "window",
        header: "Shift",
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-medium tabular-nums">
              {row.original.startTime}–{row.original.endTime}
            </span>
            {row.original.endTime < row.original.startTime ? (
              <Badge variant="secondary" className="font-normal">
                Overnight
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => row.original.department || "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          canManageTime ? (
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => openEditShift(row.original)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <HrConfirmAction
                destructive
                title="Delete this shift?"
                description="Only the scheduled shift is removed. Clock records stay."
                confirmLabel="Delete"
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                }
                onConfirm={async () => {
                  try {
                    await deleteHrShiftApi(row.original.id);
                    toast.success("Shift deleted");
                    await onRefresh();
                  } catch (e) {
                    notifyApiFailure(e, "Delete failed");
                  }
                }}
              />
            </div>
          ) : null,
      },
    ],
    [canManageTime, onRefresh],
  );

  async function handleClock(action: "in" | "out") {
    if (!clockEmployeeIds.length) {
      toast.error("Select at least one employee to clock");
      return;
    }
    setClocking(action);
    let ok = 0;
    let failed = 0;
    try {
      for (const employeeId of clockEmployeeIds) {
        try {
          await clockHrAttendanceApi({ employeeId, action });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      if (ok && !failed) {
        toast.success(
          action === "in"
            ? `Clocked in ${ok} employee${ok === 1 ? "" : "s"}`
            : `Clocked out ${ok} employee${ok === 1 ? "" : "s"}`,
        );
      } else if (ok && failed) {
        toast.warning(
          `${ok} succeeded, ${failed} failed. Check who still needs a punch.`,
        );
      } else {
        toast.error(action === "in" ? "Clock in failed" : "Clock out failed");
      }
      await onRefresh();
    } finally {
      setClocking(null);
    }
  }

  const activeEmployeeName =
    filterEmployeeId != null
      ? employees.find((e) => e.id === filterEmployeeId)?.fullName ||
        `#${filterEmployeeId}`
      : "";

  const dateRangeLabel =
    filterFrom || filterTo ? `${filterFrom || "…"} → ${filterTo || "…"}` : "";

  const attendanceFilterSummary = [
    dateRangeLabel,
    filterStatus !== "all" ? `Type: ${attendanceStatusLabel(filterStatus)}` : "",
    activeEmployeeName ? `Employee: ${activeEmployeeName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const shiftsFilterSummary = [dateRangeLabel, activeEmployeeName ? `Employee: ${activeEmployeeName}` : ""]
    .filter(Boolean)
    .join(" · ");

  const attendanceExportRows = filteredAttendance.map((row) => ({
    Employee: row.employee?.fullName || `#${row.employeeId}`,
    Date: row.workDate,
    "Clock in": formatClockTime(row.clockInAt),
    "Clock out": formatClockTime(row.clockOutAt),
    Status: attendanceStatusLabel(row.status),
    Department: row.employee?.department || "",
  }));

  const shiftExportRows = filteredShifts.map((row) => ({
    Employee: row.employee?.fullName || `#${row.employeeId}`,
    Date: row.workDate,
    Start: row.startTime,
    End: row.endTime,
    Overnight: row.endTime < row.startTime ? "Yes" : "No",
    Department: row.department || "",
  }));

  const exportFileName = (kind: "attendance" | "shifts") =>
    `hr-${kind}-${filterFrom || "start"}_${filterTo || "today"}`;

  /** Exports exactly the rows the current date / status / employee filters show. */
  const exportTable = async (
    kind: "attendance" | "shifts",
    format: "pdf" | "xlsx",
  ) => {
    const isAttendance = kind === "attendance";
    const rows = isAttendance ? filteredAttendance : filteredShifts;
    if (!rows.length) {
      toast.error(
        `No ${isAttendance ? "attendance" : "shifts"} rows to export`,
      );
      return;
    }
    setExporting(`${kind}-${format}` as ExportKey);
    try {
      if (format === "pdf") {
        await downloadHrTablePdf({
          title: isAttendance ? "Attendance" : "Shifts",
          subtitle: isAttendance
            ? attendanceFilterSummary
            : shiftsFilterSummary,
          fileName: exportFileName(kind),
          columns: isAttendance ? ATTENDANCE_PDF_COLUMNS : SHIFT_PDF_COLUMNS,
          rows: isAttendance
            ? filteredAttendance.map((row) => [
                row.employee?.fullName || `#${row.employeeId}`,
                row.workDate,
                formatClockTime(row.clockInAt),
                formatClockTime(row.clockOutAt),
                attendanceStatusLabel(row.status),
                row.employee?.department || "—",
              ])
            : filteredShifts.map((row) => [
                row.employee?.fullName || `#${row.employeeId}`,
                row.workDate,
                `${row.startTime}–${row.endTime}`,
                row.endTime < row.startTime ? "Yes" : "No",
                row.department || "—",
              ]),
          emptyText: "Nothing matches the current filters.",
        });
        toast.success("PDF downloaded");
      } else {
        const { exportRowsExcel } = await import(
          "@/lib/hotelInventoryExcelExport"
        );
        const ok = await exportRowsExcel(
          exportFileName(kind),
          isAttendance ? "Attendance" : "Shifts",
          isAttendance ? attendanceExportRows : shiftExportRows,
        );
        if (ok) toast.success("Excel downloaded");
      }
    } catch (e) {
      console.error(e);
      toast.error(
        format === "pdf" ? "Could not export PDF" : "Could not export Excel",
      );
    } finally {
      setExporting(null);
    }
  };

  const exportActions = (kind: "attendance" | "shifts") => {
    const empty =
      (kind === "attendance" ? filteredAttendance : filteredShifts).length ===
      0;
    return (
      <div className="flex flex-wrap gap-2">
        <PendingButton
          type="button"
          variant="outline"
          className="h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 dark:text-primary"
          disabled={empty}
          pending={exporting === `${kind}-pdf`}
          onClick={() => void exportTable(kind, "pdf")}
        >
          <FileDown className="h-4 w-4" />
          Export PDF
        </PendingButton>
        <PendingButton
          type="button"
          variant="outline"
          className="h-9 gap-1.5 border-violet-500/25 text-violet-800 hover:bg-violet-500/10 dark:text-violet-300"
          disabled={empty}
          pending={exporting === `${kind}-xlsx`}
          onClick={() => void exportTable(kind, "xlsx")}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </PendingButton>
      </div>
    );
  };

  return (
    <HrPanelShell>
      {canManageTime ? (
        <>
        <HrSectionCard
          title="Clock and schedule"
          description="HR marks arrival and departure for today until attendance devices (e.g. ZKTeco) are connected. Apply manager shift templates to build the roster for a date range."
          icon={
            <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          }
          accent="bg-linear-to-r from-violet-500 via-violet-400 to-primary/80"
        >
          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            <HrFormSection
              className="flex h-full flex-col"
              title="Record clock"
              description="Employees with no shift today always appear. If they have a shift today, they only appear while that shift covers the current time (or they still need to clock out)."
            >
              <div className={cn("flex flex-1 flex-col gap-3", fieldClass)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Employees</Label>
                  <Badge
                    variant="secondary"
                    className="border-primary/20 bg-primary/10 font-normal tabular-nums text-primary dark:text-primary"
                  >
                    {clockEmployeeIds.length} selected
                  </Badge>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-primary/70" />
                  <Input
                    value={clockSearch}
                    onChange={(e) => setClockSearch(e.target.value)}
                    placeholder="Search by name or department…"
                    className={cn(hrFieldClass, "pl-9")}
                    disabled={clocking !== null}
                  />
                </div>

                <div className="overflow-hidden rounded-xl border border-primary/20 bg-background shadow-sm ring-1 ring-primary/10">
                  <div className="h-[min(280px,45vh)] overflow-y-auto overscroll-contain">
                    <ul className="divide-y divide-primary/10 p-1">
                      {filteredClockEmployees.length ? (
                        <>
                          <li className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                            <label
                              htmlFor="hr-clock-emp-all"
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                                allFilteredSelected
                                  ? "bg-primary/10"
                                  : "hover:bg-primary/5",
                                clocking !== null &&
                                  "pointer-events-none opacity-60",
                              )}
                            >
                              <Checkbox
                                id="hr-clock-emp-all"
                                checked={
                                  allFilteredSelected
                                    ? true
                                    : someFilteredSelected
                                      ? "indeterminate"
                                      : false
                                }
                                disabled={
                                  clocking !== null ||
                                  !filteredClockEmployees.length
                                }
                                onCheckedChange={(v) =>
                                  toggleAllFiltered(v === true)
                                }
                              />
                              <span className="min-w-0 flex-1 text-sm font-medium">
                                Select all
                                {clockSearch.trim()
                                  ? " matching"
                                  : ""}
                              </span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {filteredClockEmployees.length}
                              </span>
                            </label>
                          </li>
                          {filteredClockEmployees.map((e) => {
                            const checked = clockEmployeeIds.includes(e.id);
                            const rowId = `hr-clock-emp-${e.id}`;
                            return (
                              <li key={e.id}>
                                <label
                                  htmlFor={rowId}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                                    checked
                                      ? "bg-primary/10"
                                      : "hover:bg-primary/5",
                                    clocking !== null &&
                                      "pointer-events-none opacity-60",
                                  )}
                                >
                                  <Checkbox
                                    id={rowId}
                                    checked={checked}
                                    disabled={clocking !== null}
                                    onCheckedChange={(v) =>
                                      toggleClockEmployee(e.id, v === true)
                                    }
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {e.fullName}
                                    </span>
                                    {e.department ? (
                                      <span className="block truncate text-xs text-muted-foreground">
                                        {e.department}
                                      </span>
                                    ) : null}
                                  </span>
                                  {checked ? (
                                    <Check className="h-4 w-4 shrink-0 text-primary dark:text-primary" />
                                  ) : null}
                                </label>
                              </li>
                            );
                          })}
                        </>
                      ) : (
                        <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                          {clockEmployees.length
                            ? "No employees match this search."
                            : "No active employees to clock right now."}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {selectedClockEmployees.length ? (
                  <p className="text-sm text-muted-foreground">
                    Batch for{" "}
                    <span className="font-medium text-foreground">
                      {selectedClockEmployees.length === 1
                        ? selectedClockEmployees[0].fullName
                        : `${selectedClockEmployees.length} employees`}
                    </span>
                    {" · "}
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select employees above, then clock in or out.
                  </p>
                )}
              </div>

              <div className="mt-auto grid gap-3 pt-1 sm:grid-cols-2">
                <PendingButton
                  pending={clocking === "in"}
                  disabled={clocking === "out" || !clockEmployeeIds.length}
                  className={cn("h-11 gap-2", hrPrimaryBtnClass)}
                  onClick={() => void handleClock("in")}
                >
                  <LogIn className="h-4 w-4" />
                  Clock in
                  {clockEmployeeIds.length > 1
                    ? ` (${clockEmployeeIds.length})`
                    : ""}
                </PendingButton>
                <PendingButton
                  pending={clocking === "out"}
                  disabled={clocking === "in" || !clockEmployeeIds.length}
                  variant="outline"
                  className="h-11 gap-2 border-primary/30 hover:bg-primary/10"
                  onClick={() => void handleClock("out")}
                >
                  <LogOut className="h-4 w-4" />
                  Clock out
                  {clockEmployeeIds.length > 1
                    ? ` (${clockEmployeeIds.length})`
                    : ""}
                </PendingButton>
              </div>
            </HrFormSection>

            <HrFormSection
              className="flex h-full flex-col"
              title="Apply shift template"
              description="Pick a manager template, one or more employees, and a date range. Matching weekdays become scheduled shifts."
            >
              <div className="flex flex-1 flex-col gap-4">
                <div className={cn("space-y-1.5", fieldClass)}>
                  <Label>Template</Label>
                  <HrOptionCombobox
                    value={applyForm.templateId}
                    onChange={(v) =>
                      setApplyForm((f) => ({ ...f, templateId: v }))
                    }
                    options={shiftTemplates.map((t) => ({
                      value: String(t.id),
                      label: t.name,
                      hint: `${t.code} · ${t.startTime}–${t.endTime}`,
                    }))}
                    placeholder={
                      shiftTemplates.length
                        ? "Select template"
                        : "No templates yet — ask Manager"
                    }
                    emptyText="No templates found."
                    disabled={!shiftTemplates.length}
                    className={triggerClass}
                  />
                </div>

                <div className={cn("space-y-1.5", fieldClass)}>
                  <div className="flex items-center justify-between gap-2">
                    <Label>Employees</Label>
                    <Badge
                      variant="secondary"
                      className="border-primary/20 bg-primary/10 font-normal tabular-nums text-primary dark:text-primary"
                    >
                      {applyForm.employeeIds.length} selected
                    </Badge>
                  </div>
                  <HrEmployeeCombobox
                    multiple
                    employees={rosterEmployees}
                    valueIds={applyForm.employeeIds}
                    onChange={(ids) =>
                      setApplyForm((f) => ({ ...f, employeeIds: ids }))
                    }
                    placeholder="Select employees…"
                    emptyText="No employees found."
                    triggerClassName={triggerClass}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={cn("space-y-1.5", fieldClass)}>
                    <Label>From</Label>
                    <HotelDayPicker
                      value={applyForm.fromYmd}
                      onChange={(fromYmd) =>
                        setApplyForm((f) => ({
                          ...f,
                          fromYmd: fromYmd || f.fromYmd,
                        }))
                      }
                      buttonClassName={cn(
                        inputClass,
                        "justify-start font-normal",
                      )}
                    />
                  </div>
                  <div className={cn("space-y-1.5", fieldClass)}>
                    <Label>To</Label>
                    <HotelDayPicker
                      value={applyForm.toYmd}
                      onChange={(toYmd) =>
                        setApplyForm((f) => ({
                          ...f,
                          toYmd: toYmd || f.toYmd,
                        }))
                      }
                      disabledDays={(date) => {
                        const from = parseYmdToDate(applyForm.fromYmd);
                        return from ? date < from : false;
                      }}
                      buttonClassName={cn(
                        inputClass,
                        "justify-start font-normal",
                      )}
                    />
                  </div>
                </div>

                {applyForm.templateId ? (
                  <p className="text-xs text-muted-foreground">
                    Template weekdays and hours are applied for each selected
                    employee across the date range.
                  </p>
                ) : null}
              </div>

              <div className="mt-auto border-t border-primary/15 pt-4">
                <PendingButton
                  pending={pending}
                  className={cn("w-full", hrPrimaryBtnClass)}
                  disabled={!shiftTemplates.length}
                  onClick={async () => {
                    if (!applyForm.templateId) {
                      toast.error("Select a shift template");
                      return;
                    }
                    if (!applyForm.employeeIds.length) {
                      toast.error("Select at least one employee");
                      return;
                    }
                    if (!applyForm.fromYmd || !applyForm.toYmd) {
                      toast.error("Select a from and to date");
                      return;
                    }
                    if (applyForm.toYmd < applyForm.fromYmd) {
                      toast.error("To date must be on or after From");
                      return;
                    }
                    setPending(true);
                    try {
                      const count = await applyHrShiftTemplateApi({
                        templateId: Number(applyForm.templateId),
                        employeeIds: applyForm.employeeIds,
                        fromYmd: applyForm.fromYmd,
                        toYmd: applyForm.toYmd,
                      });
                      toast.success(
                        `Created ${count} shift${count === 1 ? "" : "s"}`,
                      );
                      await onRefresh();
                    } catch (e) {
                      notifyApiFailure(e, "Could not apply template");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Apply to schedule
                  {applyForm.employeeIds.length > 1
                    ? ` (${applyForm.employeeIds.length})`
                    : ""}
                </PendingButton>
              </div>
            </HrFormSection>
          </div>
        </HrSectionCard>

        <HrSectionCard
          title="Correct attendance"
          description="Adjust status or notes for a work day. Changes go to Manager for approval before they apply."
          icon={<ClipboardList className="h-5 w-5" />}
          accent="bg-linear-to-r from-amber-500 to-orange-400"
        >
          <div className="grid gap-4 rounded-xl border border-amber-500/20 bg-linear-to-br from-amber-500/8 via-muted/10 to-primary/5 p-4 sm:grid-cols-2">
            <div className={cn("space-y-1.5", fieldClass)}>
              <Label>Employee</Label>
              <HrEmployeeCombobox
                employees={rosterEmployees}
                valueIds={
                  correctForm.employeeId
                    ? [Number(correctForm.employeeId)]
                    : []
                }
                onChange={(ids) =>
                  setCorrectForm((f) => ({
                    ...f,
                    employeeId: ids[0] != null ? String(ids[0]) : "",
                  }))
                }
                placeholder="Search employee…"
                emptyText="No employees found."
                triggerClassName={triggerClass}
              />
            </div>
            <div className={cn("space-y-1.5", fieldClass)}>
              <Label>Work date</Label>
              <HotelDayPicker
                value={correctForm.workDate}
                onChange={(v) =>
                  setCorrectForm((f) => ({ ...f, workDate: v || todayYmd() }))
                }
                buttonClassName={cn(inputClass, "justify-start font-normal")}
              />
            </div>
            <div className={cn("space-y-1.5", fieldClass)}>
              <Label>Status</Label>
              <HrOptionCombobox
                value={correctForm.status}
                onChange={(v) =>
                  setCorrectForm((f) => ({ ...f, status: v }))
                }
                options={[...ATTENDANCE_STATUS_OPTIONS]}
                placeholder="Select status"
                emptyText="No statuses."
                className={triggerClass}
              />
            </div>
            <div className={cn("space-y-1.5", fieldClass)}>
              <Label>Notes</Label>
              <Input
                className={inputClass}
                value={correctForm.notes}
                onChange={(e) =>
                  setCorrectForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Reason for correction"
              />
            </div>
            <PendingButton
              className={cn("sm:col-span-2", hrPrimaryBtnClass)}
              pending={pending}
              onClick={async () => {
                const employeeId = Number(correctForm.employeeId);
                if (!employeeId) {
                  toast.error("Select an employee");
                  return;
                }
                setPending(true);
                try {
                  await upsertHrAttendanceApi({
                    employeeId,
                    workDate: correctForm.workDate,
                    status: correctForm.status,
                    notes: correctForm.notes,
                  });
                  toast.success("Attendance updated");
                  await onRefresh();
                } catch (e) {
                  if (isPendingManagerApprovalError(e)) {
                    toast.success(pendingManagerApprovalMessage(e));
                    return;
                  }
                  notifyApiFailure(e, "Correction failed");
                } finally {
                  setPending(false);
                }
              }}
            >
              Submit correction
            </PendingButton>
          </div>
        </HrSectionCard>
        </>
      ) : (
        <HrSectionCard
          title="Attendance reports"
          description="Manager view of clock records and scheduled shifts. HR records punches and builds the roster."
          icon={
            <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          }
          accent="bg-linear-to-r from-violet-500 via-violet-400 to-primary/80"
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            Review all clock records and scheduled shifts below. Clock in/out and
            scheduling stay on the HR workspace until devices such as ZKTeco are
            connected.
          </p>
        </HrSectionCard>
      )}

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-linear-to-br from-violet-500/8 via-card to-primary/5 p-4 shadow-sm ring-1 ring-violet-500/10 sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Filter records
              </p>
              <p className="text-xs text-muted-foreground">
                Narrow attendance and shifts by date, type, and employee.
              </p>
            </div>
            {(filterStatus !== "all" ||
              filterEmployeeId != null ||
              filterFrom !== addDaysYmd(todayYmd(), -13) ||
              filterTo !== todayYmd()) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 cursor-pointer text-xs text-primary hover:bg-primary/10 dark:text-primary"
                onClick={() => {
                  setFilterFrom(addDaysYmd(todayYmd(), -13));
                  setFilterTo(todayYmd());
                  setFilterStatus("all");
                  setFilterEmployeeId(null);
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-violet-800/80 dark:text-violet-300/90">
                From
              </Label>
              <HotelDayPicker
                value={filterFrom}
                onChange={(v) => {
                  const next = v || filterFrom;
                  setFilterFrom(next);
                  if (filterTo && next > filterTo) setFilterTo(next);
                }}
                buttonClassName={cn(
                  hrFieldClass,
                  "justify-start border-violet-500/25 bg-violet-500/5 font-normal hover:bg-violet-500/10",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-violet-800/80 dark:text-violet-300/90">
                To
              </Label>
              <HotelDayPicker
                value={filterTo}
                onChange={(v) => {
                  const next = v || filterTo;
                  setFilterTo(next);
                  if (filterFrom && next < filterFrom) setFilterFrom(next);
                }}
                buttonClassName={cn(
                  hrFieldClass,
                  "justify-start border-violet-500/25 bg-violet-500/5 font-normal hover:bg-violet-500/10",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className={cn(
                  "text-xs font-medium",
                  hrStatusFilterLabelClass(filterStatus),
                )}
              >
                Type
              </Label>
              <HrOptionCombobox
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: "all", label: "All types" },
                  ...ATTENDANCE_STATUS_OPTIONS,
                ]}
                placeholder="Filter type…"
                emptyText="No types."
                className={hrStatusFilterTriggerClass(filterStatus)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-primary/90 dark:text-primary">
                Employee
              </Label>
              <HrEmployeeCombobox
                employees={employees}
                valueIds={filterEmployeeId != null ? [filterEmployeeId] : []}
                onChange={(ids) => setFilterEmployeeId(ids[0] ?? null)}
                placeholder="All employees"
                emptyText="No employees found."
                triggerClassName={cn(
                  hrFieldClass,
                  "justify-between border-primary/30 bg-primary/10 font-medium text-primary hover:bg-primary/15 dark:text-primary",
                )}
              />
            </div>
          </div>
        </div>

        <HrSectionCard
          title="Attendance"
          description="Clock records HR entered (or devices will record later)."
          icon={<Clock3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          accent="bg-linear-to-r from-violet-500 via-fuchsia-400 to-violet-400/80"
          actions={exportActions("attendance")}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="secondary"
              className="border-violet-500/20 bg-violet-500/10 font-normal tabular-nums text-violet-900 dark:text-violet-200"
            >
              {filteredAttendance.length} record
              {filteredAttendance.length === 1 ? "" : "s"}
            </Badge>
            {filterStatus !== "all" ? (
              <span>
                Type ·{" "}
                {ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === filterStatus)
                  ?.label ?? filterStatus}
              </span>
            ) : null}
          </div>
          {filteredAttendance.length ? (
            <HrTableFrame>
              <DataTable
                embedded
                columns={attendanceColumns}
                data={filteredAttendance}
                searchPlaceholder="Search attendance…"
                pageSize={10}
              />
            </HrTableFrame>
          ) : (
            <HrEmptyState
              title={
                attendance.length
                  ? "No attendance in this filter"
                  : "No attendance yet"
              }
              description={
                attendance.length
                  ? "Widen the date range or clear type / employee filters."
                  : "Record a clock in for someone to see it here."
              }
            />
          )}
        </HrSectionCard>

        <HrSectionCard
          title="Shifts"
          description="Scheduled coverage for the selected dates, including overnight rows."
          icon={
            <CalendarClock className="h-5 w-5 text-primary dark:text-primary" />
          }
          accent="bg-linear-to-r from-primary via-violet-400 to-violet-400/80"
          actions={exportActions("shifts")}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge
              variant="secondary"
              className="border-primary/20 bg-primary/10 font-normal tabular-nums text-primary dark:text-primary"
            >
              {filteredShifts.length} shift
              {filteredShifts.length === 1 ? "" : "s"}
            </Badge>
            <span>Uses the same date and employee filters above.</span>
          </div>
          {filteredShifts.length ? (
            <HrTableFrame>
              <DataTable
                embedded
                columns={shiftColumns}
                data={filteredShifts}
                searchPlaceholder="Search shifts…"
                pageSize={10}
              />
            </HrTableFrame>
          ) : (
            <HrEmptyState
              title={
                shifts.length ? "No shifts in this filter" : "No shifts yet"
              }
              description={
                shifts.length
                  ? "Widen the date range or clear the employee filter."
                  : "Add a shift schedule to build the roster."
              }
            />
          )}
        </HrSectionCard>
      </div>

      <Dialog
        open={Boolean(editingShift)}
        onOpenChange={(open) => {
          if (!open) setEditingShift(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <HrDialogHeader
            title="Edit shift schedule"
            description="Replace this employee’s shifts in the date range with a selected template."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Employee</Label>
              <HrEmployeeCombobox
                employees={rosterEmployees}
                valueIds={
                  editForm.employeeId ? [Number(editForm.employeeId)] : []
                }
                onChange={(ids) =>
                  setEditForm((f) => ({
                    ...f,
                    employeeId: ids[0] != null ? String(ids[0]) : "",
                  }))
                }
                placeholder="Select employee…"
                emptyText="No employees found."
                triggerClassName={triggerClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <HotelDayPicker
                value={editForm.fromYmd}
                onChange={(fromYmd) =>
                  setEditForm((f) => ({
                    ...f,
                    fromYmd: fromYmd || f.fromYmd,
                  }))
                }
                buttonClassName={cn(inputClass, "justify-start font-normal")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <HotelDayPicker
                value={editForm.toYmd}
                onChange={(toYmd) =>
                  setEditForm((f) => ({
                    ...f,
                    toYmd: toYmd || f.toYmd,
                  }))
                }
                disabledDays={(date) => {
                  const from = parseYmdToDate(editForm.fromYmd);
                  return from ? date < from : false;
                }}
                buttonClassName={cn(inputClass, "justify-start font-normal")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Template</Label>
              <HrOptionCombobox
                value={editForm.templateId}
                onChange={(v) =>
                  setEditForm((f) => ({ ...f, templateId: v }))
                }
                options={shiftTemplates.map((t) => ({
                  value: String(t.id),
                  label: t.name,
                  hint: `${t.code} · ${t.startTime}–${t.endTime}`,
                }))}
                placeholder={
                  shiftTemplates.length
                    ? "Select template"
                    : "No templates yet — ask Manager"
                }
                emptyText="No templates found."
                disabled={!shiftTemplates.length}
                className={triggerClass}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Existing shifts for this employee between From and To are replaced
            by the template’s weekday pattern.
          </p>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingShift(null)}
            >
              Cancel
            </Button>
            <PendingButton
              pending={pending}
              className={hrPrimaryBtnClass}
              disabled={!shiftTemplates.length}
              onClick={() => void saveEditShift()}
            >
              Save changes
            </PendingButton>
          </div>
        </DialogContent>
      </Dialog>
    </HrPanelShell>
  );
}
