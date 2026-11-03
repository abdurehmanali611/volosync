"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { UserPlus, Users, Trash2, Pencil, Building2, Wallet, Check, ChevronsUpDown, Plus } from "lucide-react";
import { DataTable } from "@/app/StoreItems/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { HrConfirmAction } from "@/components/hr/HrConfirmAction";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import {
  HrDialogHeader,
  HrEmptyState,
  HrFilterBar,
  HrFormSection,
  HrPanelShell,
  HrStatusBadge,
  HrSurfaceHero,
  HrTableFrame,
  hrFieldClass,
  hrPrimaryBtnClass,
  hrStatusFilterLabelClass,
  hrStatusFilterTriggerClass,
} from "@/components/hr/hrChrome";
import {
  HR_EDUCATION_LEVELS,
  HR_GENDER_OPTIONS,
  HR_WAGE_LABELS,
  HR_WAGE_TYPES,
  hrEmployeeFormSchema,
  type HrEmployeeFormValues,
} from "@/lib/hrConstraints";
import {
  hrDepartmentLabel,
} from "@/lib/hrDepartments";
import { ETHIOPIAN_BANKS } from "@/lib/hrEthiopianBanks";
import { isHrEmployeePayrollReady } from "@/lib/hrPayrollReady";
import { formatETB } from "@/lib/subscriptionModules";
import { hrEmployeeFormDialogClassName } from "@/lib/responsiveDialog";
import { notifyApiFailure } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  createHrEmployeeApi,
  createHrEmployeesBatchApi,
  fetchHrDepartments,
  fetchHrTeamsApi,
  terminateHrEmployeeApi,
  deleteHrEmployeeApi,
  updateHrEmployeeApi,
  enableHrEmployeePortalApi,
  requestHrOtpResetApi,
  type HrDepartment,
  type HrEmployee,
  type HrTeam,
} from "@/lib/api/hrSource";
import {
  isPendingManagerApprovalError,
  pendingManagerApprovalMessage,
} from "@/lib/hrPendingApproval";
import { PendingButton } from "@/components/ui/pending-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound } from "lucide-react";
const PhoneInput = dynamic(
  () => import("@/components/phone-input").then((m) => m.PhoneInput),
  { ssr: false },
);

type StatusFilter = "all" | "active" | "on_leave" | "terminated";

type ComboboxOption = { value: string; label: string; hint?: string };

/** Searchable combobox — same interaction pattern as hotel store / HR approval config. */
function OptionCombobox({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyText = "No matches.",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.hint || ""} ${o.value}`.toLowerCase();
      return hay.includes(query);
    });
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            hrFieldClass,
            "justify-between font-normal",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate text-left",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((o) => {
                  const on = o.value === value;
                  return (
                    <CommandItem
                      key={o.value}
                      value={`${o.value}-${o.label}`}
                      onSelect={() => {
                        onChange(o.value);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          on ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {o.label}
                        {o.hint ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {o.hint}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const roleFieldClass = "min-w-0";
const roleInputClass = hrFieldClass;

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HrEmployeesPanel({
  employees,
  onRefresh,
}: {
  employees: HrEmployee[];
  onRefresh: () => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  /** Department code ("" = all) and team id ("" = all, "none" = unassigned). */
  const [deptFilter, setDeptFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HrEmployee | null>(null);
  const emptyBatchRow = () => ({
    fullName: "",
    department: "",
    jobTitle: "",
    orgPosition: "employee" as "employee" | "leader",
    teamId: null as number | null,
    wageType: "monthly" as "monthly" | "weekly",
    baseSalaryETB: "",
    hireDate: todayYmd(),
    gender: "",
    education: "",
    yearsExperience: "",
    personalTin: "",
    bankName: "",
    accountNumber: "",
    medicalNote: "",
    phone: "",
    email: "",
  });

  const [extraLines, setExtraLines] = useState<
    ReturnType<typeof emptyBatchRow>[]
  >([]);
  const [pending, setPending] = useState(false);
  const [issuedOtp, setIssuedOtp] = useState<{ name: string; otp: string } | null>(
    null,
  );
  const [hrDepartments, setHrDepartments] = useState<HrDepartment[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [allTeams, setAllTeams] = useState<HrTeam[]>([]);
  const [teamsByDeptId, setTeamsByDeptId] = useState<Record<number, HrTeam[]>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchHrDepartments();
        if (cancelled) return;
        setHrDepartments(rows.filter((d) => d.active));
      } catch (e) {
        notifyApiFailure(e, "Could not load departments");
      }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("hotcol-hr-departments", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hotcol-hr-departments", onChange);
    };
  }, []);

  const defaultDepartment = hrDepartments[0]?.code ?? "";

  /** Every active team — powers the directory team filter (form teams stay per-department). */
  useEffect(() => {
    let cancelled = false;
    const loadTeams = async () => {
      try {
        const rows = await fetchHrTeamsApi();
        if (cancelled) return;
        setAllTeams(rows.filter((t) => t.active !== false));
      } catch (e) {
        notifyApiFailure(e, "Could not load teams");
      }
    };
    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<HrEmployeeFormValues>({
    resolver: zodResolver(hrEmployeeFormSchema) as Resolver<HrEmployeeFormValues>,
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      department: "",
      jobTitle: "",
      orgPosition: "employee",
      teamId: null,
      wageType: "monthly",
      baseSalaryETB: 0,
      bankName: "",
      accountNumber: "",
      hireDate: todayYmd(),
      notes: "",
      gender: "",
      education: "",
      personalTin: "",
      yearsExperience: 0,
      medicalNote: "",
    },
  });

  const departmentCode = form.watch("department");
  const selectedDeptId = useMemo(() => {
    const code = String(departmentCode || "").trim();
    return hrDepartments.find((d) => d.code === code)?.id ?? null;
  }, [departmentCode, hrDepartments]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (selectedDeptId == null) {
        setTeams([]);
        return;
      }
      try {
        const rows = await fetchHrTeamsApi(selectedDeptId);
        if (cancelled) return;
        const active = rows.filter((t) => t.active);
        setTeams(active);
        setTeamsByDeptId((prev) => ({ ...prev, [selectedDeptId]: active }));
      } catch (e) {
        notifyApiFailure(e, "Could not load teams");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedDeptId]);

  const extraDeptIdsKey = useMemo(() => {
    const ids = new Set<number>();
    for (const row of extraLines) {
      const id = hrDepartments.find((d) => d.code === row.department)?.id;
      if (id != null) ids.add(id);
    }
    return [...ids].sort((a, b) => a - b).join(",");
  }, [extraLines, hrDepartments]);

  useEffect(() => {
    if (!extraDeptIdsKey) return;
    let cancelled = false;
    const ids = extraDeptIdsKey.split(",").map(Number);
    const load = async () => {
      await Promise.all(
        ids.map(async (deptId) => {
          if (teamsByDeptId[deptId]) return;
          try {
            const rows = await fetchHrTeamsApi(deptId);
            if (cancelled) return;
            setTeamsByDeptId((prev) => ({
              ...prev,
              [deptId]: rows.filter((t) => t.active),
            }));
          } catch (e) {
            notifyApiFailure(e, "Could not load teams");
          }
        }),
      );
    };
    void load();
    return () => {
      cancelled = true;
    };
    // teamsByDeptId intentionally omitted — only fetch missing dept ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraDeptIdsKey]);

  const departmentFilterOptions = useMemo(() => {
    const known = new Set(hrDepartments.map((d) => d.code));
    const extras: { value: string; label: string }[] = [];
    for (const e of employees) {
      const code = String(e.department || "").trim();
      if (!code || known.has(code)) continue;
      if (extras.some((x) => x.value === code)) continue;
      extras.push({ value: code, label: hrDepartmentLabel(code, hrDepartments) });
    }
    return [
      { value: "", label: "All departments" },
      ...hrDepartments.map((d) => ({
        value: d.code,
        label: d.label || hrDepartmentLabel(d.code, hrDepartments),
        hint: d.code,
      })),
      ...extras.sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [hrDepartments, employees]);

  const teamFilterOptions = useMemo(() => {
    const deptId = deptFilter
      ? hrDepartments.find((d) => d.code === deptFilter)?.id ?? null
      : null;
    return [
      { value: "", label: "All teams" },
      { value: "none", label: "No team" },
      ...allTeams
        .filter((t) => deptId == null || t.departmentId === deptId)
        .map((t) => ({
          value: String(t.id),
          label: t.label,
          hint: t.code || undefined,
        })),
    ];
  }, [allTeams, deptFilter, hrDepartments]);

  /** Changing department hides teams that belong elsewhere — drop a stale team pick. */
  const onDeptFilterChange = (code: string) => {
    setDeptFilter(code);
    if (!teamFilter || teamFilter === "none") return;
    const deptId = code
      ? hrDepartments.find((d) => d.code === code)?.id ?? null
      : null;
    const stillVisible = allTeams.some(
      (t) => String(t.id) === teamFilter && (deptId == null || t.departmentId === deptId),
    );
    if (!stillVisible) setTeamFilter("");
  };

  const filtered = useMemo(() => {
    const dept = deptFilter
      ? hrDepartments.find((d) => d.code === deptFilter) ?? null
      : null;
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (deptFilter) {
        const code = String(e.department || "").trim();
        if (code !== deptFilter && (!dept || code !== dept.label)) return false;
      }
      if (teamFilter === "none" && e.teamId != null) return false;
      if (teamFilter && teamFilter !== "none" && String(e.teamId ?? "") !== teamFilter) {
        return false;
      }
      return true;
    });
  }, [employees, statusFilter, deptFilter, teamFilter, hrDepartments]);

  const filtersActive =
    statusFilter !== "all" || Boolean(deptFilter) || Boolean(teamFilter);

  const directoryStats = useMemo(() => {
    const active = employees.filter((e) => e.status === "active").length;
    const onLeave = employees.filter((e) => e.status === "on_leave").length;
    const terminated = employees.filter((e) => e.status === "terminated").length;
    return [
      {
        label: "Active",
        value: active,
        tone: "from-emerald-500/[0.07] to-transparent",
      },
      {
        label: "On leave",
        value: onLeave,
        tone: "from-amber-500/[0.07] to-transparent",
      },
      {
        label: "Terminated",
        value: terminated,
        tone: "from-rose-500/[0.07] to-transparent",
      },
    ];
  }, [employees]);

  const openCreate = () => {
    if (!hrDepartments.length) {
      toast.error("Register departments in HR → Departments first");
      return;
    }
    setEditing(null);
    form.reset({
      fullName: "",
      phone: "",
      email: "",
      department: defaultDepartment,
      jobTitle: "",
      orgPosition: "employee",
      teamId: null,
      wageType: "monthly",
      baseSalaryETB: 0,
      bankName: "",
      accountNumber: "",
      hireDate: todayYmd(),
      notes: "",
      gender: "",
      education: "",
      personalTin: "",
      yearsExperience: 0,
      medicalNote: "",
    });
    setExtraLines([]);
    setOpen(true);
  };

  const openEdit = useCallback(
    (row: HrEmployee) => {
      setEditing(row);
      const dept =
        row.department &&
        (hrDepartments.some((d) => d.code === row.department) ||
          Boolean(row.department))
          ? row.department
          : defaultDepartment;
      form.reset({
        fullName: row.fullName,
        phone: row.phone || "",
        email: row.email || "",
        department: dept || defaultDepartment,
        jobTitle: row.jobTitle || "",
        orgPosition:
          row.orgPosition === "leader" ? "leader" : "employee",
        teamId: row.teamId ?? null,
        wageType: (HR_WAGE_TYPES as readonly string[]).includes(row.wageType)
          ? (row.wageType as HrEmployeeFormValues["wageType"])
          : "monthly",
        baseSalaryETB: row.baseSalaryETB || 0,
        bankName: row.bankName || "",
        accountNumber: row.accountNumber || "",
        hireDate: row.hireDate || todayYmd(),
        notes: row.notes || "",
        gender:
          row.gender === "male" || row.gender === "female" ? row.gender : "",
        education: row.education || "",
        personalTin: row.personalTin || "",
        yearsExperience: Number(row.yearsExperience) || 0,
        medicalNote: row.medicalNote || "",
      });
      setOpen(true);
    },
    [defaultDepartment, form, hrDepartments],
  );

  const onSubmit = async (values: HrEmployeeFormValues) => {
    setPending(true);
    try {
      const payload = {
        fullName: values.fullName,
        phone: values.phone,
        email: values.email || undefined,
        department: values.department,
        jobTitle: values.jobTitle,
        orgPosition: values.orgPosition,
        teamId: values.teamId || null,
        wageType: values.wageType,
        baseSalaryETB: values.baseSalaryETB,
        bankName: values.bankName || "",
        accountNumber: values.accountNumber || "",
        hireDate: values.hireDate,
        notes: values.notes,
        gender: values.gender || "",
        education: values.education || "",
        personalTin: values.personalTin || "",
        yearsExperience: Number(values.yearsExperience) || 0,
        medicalNote: values.medicalNote || "",
      };

      if (editing) {
        await updateHrEmployeeApi(editing.id, payload);
        toast.success("Employee updated");
      } else {
        const parsedExtras: HrEmployeeFormValues[] = [];
        for (let i = 0; i < extraLines.length; i++) {
          const r = extraLines[i];
          const blank =
            !r.fullName.trim() &&
            !r.department.trim() &&
            !r.jobTitle.trim() &&
            !r.phone.trim() &&
            !r.email.trim() &&
            !String(r.baseSalaryETB).trim() &&
            !r.bankName.trim() &&
            !r.accountNumber.trim() &&
            !r.personalTin.trim() &&
            !r.medicalNote.trim() &&
            !r.education.trim() &&
            !r.gender.trim() &&
            !String(r.yearsExperience).trim();
          if (blank) continue;

          const candidate = {
            fullName: r.fullName,
            phone: r.phone || "",
            email: r.email || "",
            department: r.department,
            jobTitle: r.jobTitle || "",
            orgPosition: r.orgPosition === "leader" ? "leader" : "employee",
            teamId: r.teamId,
            wageType: r.wageType,
            baseSalaryETB:
              r.baseSalaryETB === "" ? Number.NaN : Number(r.baseSalaryETB),
            bankName: r.bankName || "",
            accountNumber: r.accountNumber || "",
            hireDate: r.hireDate || "",
            notes: "",
            gender:
              r.gender === "male" || r.gender === "female" ? r.gender : "",
            education: r.education || "",
            personalTin: r.personalTin || "",
            yearsExperience:
              r.yearsExperience === "" ? 0 : Number(r.yearsExperience),
            medicalNote: r.medicalNote || "",
          };
          const result = hrEmployeeFormSchema.safeParse(candidate);
          if (!result.success) {
            const msg =
              result.error.issues[0]?.message || "Invalid employee details";
            toast.error(`Extra employee ${i + 1}: ${msg}`);
            setPending(false);
            return;
          }
          parsedExtras.push(result.data);
        }

        const extrasPayload = parsedExtras.map((v) => ({
          fullName: v.fullName,
          phone: v.phone || undefined,
          email: v.email || undefined,
          department: v.department,
          jobTitle: v.jobTitle || "",
          orgPosition: v.orgPosition,
          teamId: v.teamId || null,
          wageType: v.wageType,
          baseSalaryETB: v.baseSalaryETB,
          hireDate: v.hireDate,
          gender: v.gender || "",
          education: v.education || "",
          yearsExperience: Number(v.yearsExperience) || 0,
          personalTin: v.personalTin || "",
          bankName: v.bankName || "",
          accountNumber: v.accountNumber || "",
          medicalNote: v.medicalNote || "",
        }));

        if (extrasPayload.length) {
          await createHrEmployeesBatchApi([payload, ...extrasPayload]);
          toast.success(`Created ${1 + extrasPayload.length} employee(s)`);
      } else {
        await createHrEmployeeApi(payload);
        toast.success("Employee added");
        }
        setExtraLines([]);
      }
      setOpen(false);
      await onRefresh();
    } catch (e) {
      notifyApiFailure(e, editing ? "Could not update employee" : "Could not add employee");
    } finally {
      setPending(false);
    }
  };

  const columns = useMemo<ColumnDef<HrEmployee>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Employee",
        cell: ({ row }) => {
          const emp = row.original;
          const initials = emp.fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("");
          return (
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-xs font-semibold tracking-wide text-foreground/80 ring-1 ring-border/60">
                {initials || "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold tracking-tight">
                  {emp.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {emp.jobTitle || "No title"}
                  {emp.wageType
                    ? ` · ${HR_WAGE_LABELS[emp.wageType as keyof typeof HR_WAGE_LABELS] || emp.wageType}`
                    : ""}
                </p>
                {!isHrEmployeePayrollReady(emp) &&
                emp.status !== "terminated" ? (
                  <Badge
                    variant="outline"
                    className="mt-1 border-amber-500/40 bg-amber-500/10 font-normal text-amber-900 dark:text-amber-200"
                  >
                    Needs pay details
                  </Badge>
                ) : null}
          </div>
            </div>
          );
        },
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="gap-1.5 border-border/70 bg-muted/40 font-normal text-foreground/80"
          >
            <Building2 className="h-3 w-3 opacity-70" />
            {hrDepartmentLabel(row.original.department || "", hrDepartments) ||
              "—"}
          </Badge>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.phone || "—"}
          </span>
        ),
      },
      {
        accessorKey: "baseSalaryETB",
        header: "Salary",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            {formatETB(row.original.baseSalaryETB || 0)}
          </span>
        ),
      },
      {
        accessorKey: "bankName",
        header: "Bank",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.bankName || "—"}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.original.accountNumber || "No account"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "hireDate",
        header: "Hired",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.hireDate || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const emp = row.original;
          const preview = String(emp.portalOtpPreview || "").trim();
          const portalIssued = Boolean(emp.portalOtpIssuedAt);
          const awaitingFirstLogin = portalIssued && !emp.portalFirstLoginAt;
          return (
          <div className="inline-flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-lg"
              onClick={() => openEdit(emp)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            {emp.status !== "terminated" ? (
              <>
                {!portalIssued ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-lg"
                    onClick={async () => {
                      try {
                        const updated = await enableHrEmployeePortalApi(emp.id);
                        const otp = String(updated.portalOtpPreview || "").trim();
                        if (otp) {
                          setIssuedOtp({ name: updated.fullName, otp });
                        } else {
                          toast.message(
                            "Portal OTP issued. Preview is only visible to HR Manager until first login.",
                          );
                        }
                        await onRefresh();
                      } catch (e) {
                        notifyApiFailure(e, "Could not enable portal");
                      }
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Portal OTP
                  </Button>
                ) : null}
                {awaitingFirstLogin && preview ? (
                  <button
                    type="button"
                    title="Copy portal OTP (visible until first login)"
                    className="inline-flex h-8 max-w-44 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 font-mono text-xs tracking-wider text-amber-950 hover:bg-amber-500/15 dark:text-amber-100"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(preview);
                        toast.success("Portal OTP copied");
                      } catch {
                        toast.message(preview);
                      }
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{preview}</span>
                  </button>
                ) : null}
                {awaitingFirstLogin && !preview ? (
                  <span className="text-xs text-muted-foreground">
                    Awaiting first login
                  </span>
                ) : null}
                {portalIssued ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await requestHrOtpResetApi(emp.id);
                        toast.success("OTP reset sent to Manager for approval");
                        await onRefresh();
                      } catch (e) {
                        notifyApiFailure(e, "OTP reset request failed");
                      }
                    }}
                  >
                    Request reset
                  </Button>
                ) : null}
              <HrConfirmAction
                destructive
                  title={`Terminate ${emp.fullName}?`}
                description="Marks this employee terminated from today. History stays on file."
                confirmLabel="Terminate"
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Terminate
                  </Button>
                }
                onConfirm={async () => {
                  try {
                      await terminateHrEmployeeApi(emp.id, todayYmd());
                    toast.success("Employee terminated");
                    await onRefresh();
                  } catch (e) {
                      if (isPendingManagerApprovalError(e)) {
                        toast.success(pendingManagerApprovalMessage(e));
                        await onRefresh();
                        return;
                      }
                    notifyApiFailure(e, "Terminate failed");
                    }
                  }}
                />
              </>
            ) : null}
            {emp.status === "terminated" ? (
              <HrConfirmAction
                destructive
                title={`Delete ${emp.fullName}?`}
                description="Permanently removes this terminated employee and related HR records (leave, attendance, documents, payslips). This cannot be undone."
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
                    await deleteHrEmployeeApi(emp.id);
                    toast.success("Employee deleted");
                    await onRefresh();
                  } catch (e) {
                    notifyApiFailure(e, "Delete failed");
                  }
                }}
              />
            ) : null}
          </div>
          );
        },
      },
    ],
    [hrDepartments, onRefresh, openEdit],
  );

  return (
    <HrPanelShell>
      <HrSurfaceHero
        eyebrow="HR directory"
        title="Employees"
        description="Search, filter, and maintain employment records. Salary and hire details feed system payroll when a period is closed."
        icon={<Users className="size-5" />}
        actions={
          <Button
            onClick={openCreate}
            className={cn("h-11 rounded-xl", hrPrimaryBtnClass)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add employee
          </Button>
        }
        stats={directoryStats}
      />

        <div className="space-y-4">
        <HrFilterBar
          title="Directory filters"
          showClear={filtersActive}
          onClear={() => {
            setStatusFilter("all");
            setDeptFilter("");
            setTeamFilter("");
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                className={cn(
                  "text-xs font-medium",
                  hrStatusFilterLabelClass(statusFilter),
                )}
              >
                Status
              </Label>
              <HrOptionCombobox
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "on_leave", label: "On leave" },
                  { value: "terminated", label: "Terminated" },
                ]}
                placeholder="Filter status…"
                emptyText="No statuses."
                className={hrStatusFilterTriggerClass(statusFilter)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Department</Label>
              <HrOptionCombobox
                value={deptFilter}
                onChange={onDeptFilterChange}
                options={departmentFilterOptions}
                placeholder="All departments"
                searchPlaceholder="Search departments…"
                emptyText="No departments registered."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Team</Label>
              <HrOptionCombobox
                value={teamFilter}
                onChange={setTeamFilter}
                options={teamFilterOptions}
                placeholder="All teams"
                searchPlaceholder="Search teams…"
                emptyText="No teams in this department."
              />
            </div>
          </div>
        </HrFilterBar>
          {filtered.length ? (
          <HrTableFrame>
            <DataTable
              embedded
              columns={columns}
              data={filtered}
              searchColumnId="fullName"
              searchPlaceholder="Search employees…"
              emptyMessage="No employees match these filters."
              pageSize={8}
            />
          </HrTableFrame>
          ) : (
            <HrEmptyState
              title="No employees in this view"
              description="Add the first employee or clear filters to see the full directory."
            icon={<Users className="h-6 w-6" />}
            />
          )}
        </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={hrEmployeeFormDialogClassName}>
          <HrDialogHeader
            title={editing ? "Edit employee" : "Add employee"}
            description={
              editing
                ? "Update employment master data for this property."
                : "Fill the cards below. Use Add line to register more employees in the same save."
            }
          />
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid items-stretch gap-4 lg:grid-cols-2">
              <HrFormSection
                className="h-full"
                title="Identity"
                description="Name, contact, and gender."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input className={hrFieldClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <PhoneInput
                            defaultCountry="ET"
                            countryCallingCodeEditable
                            international
                            value={field.value || undefined}
                            onChange={(value) => field.onChange(value || "")}
                            className="w-full min-w-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input className={hrFieldClass} type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Gender</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            className="grid grid-cols-2 gap-2"
                          >
                            {HR_GENDER_OPTIONS.map((opt) => (
                              <Label
                                key={opt.value}
                                htmlFor={`emp-gender-${opt.value}`}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-normal transition-colors",
                                  field.value === opt.value
                                    ? "border-primary/35 bg-primary/[0.07]"
                                    : "border-border/70 bg-background hover:bg-muted/40",
                                )}
                              >
                                <RadioGroupItem
                                  value={opt.value}
                                  id={`emp-gender-${opt.value}`}
                                />
                                {opt.label}
                              </Label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </HrFormSection>
              <HrFormSection
                className="h-full"
                title="Role"
                description="Department, title, and position."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => {
                      const orphan =
                        field.value &&
                        !hrDepartments.some((d) => d.code === field.value)
                          ? field.value
                          : "";
                      const options: ComboboxOption[] = [
                        ...hrDepartments.map((d) => ({
                          value: d.code,
                          label: d.label,
                        })),
                        ...(orphan
                          ? [
                              {
                                value: orphan,
                                label: `${hrDepartmentLabel(orphan, hrDepartments)} (not in current list)`,
                              },
                            ]
                          : []),
                      ];
                      return (
                      <FormItem className={roleFieldClass}>
                        <FormLabel>Department</FormLabel>
                          <FormControl>
                          <OptionCombobox
                            value={field.value || ""}
                            onChange={(v) => {
                              field.onChange(v);
                              form.setValue("teamId", null);
                            }}
                            options={options}
                            disabled={!hrDepartments.length && !orphan}
                                placeholder={
                                  hrDepartments.length
                                ? "Search department…"
                                    : "Register departments first"
                                }
                            emptyText="No departments found."
                              />
                          </FormControl>
                        {!hrDepartments.length ? (
                          <p className="text-[11px] text-muted-foreground">
                            Add departments under HR → Departments, then pick
                            one here.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem className={roleFieldClass}>
                        <FormLabel>Specific role</FormLabel>
                        <FormControl>
                          <Input
                            className={roleInputClass}
                            placeholder="Skill / professional name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="orgPosition"
                    render={({ field }) => (
                      <FormItem className={cn(roleFieldClass, "sm:col-span-2")}>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="grid grid-cols-2 gap-2"
                          >
                            {(
                              [
                                { id: "employee", label: "Employee" },
                                { id: "leader", label: "Leader" },
                              ] as const
                            ).map((opt) => (
                              <Label
                                key={opt.id}
                                htmlFor={`hr-org-pos-${opt.id}`}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-normal transition-colors",
                                  field.value === opt.id
                                    ? "border-primary/35 bg-primary/[0.07]"
                                    : "border-border/70 bg-background hover:bg-muted/40",
                                )}
                              >
                                <RadioGroupItem
                                  value={opt.id}
                                  id={`hr-org-pos-${opt.id}`}
                                />
                                {opt.label}
                              </Label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teamId"
                    render={({ field }) => {
                      const options: ComboboxOption[] = [
                        { value: "none", label: "No team" },
                        ...teams.map((t) => ({
                          value: String(t.id),
                          label: t.label,
                          hint: t.code,
                        })),
                      ];
                      const current =
                        field.value != null && field.value > 0
                          ? String(field.value)
                          : "none";
                      return (
                        <div className="sm:col-span-2 flex justify-center">
                          <FormItem className={cn(roleFieldClass, "w-full sm:w-[calc(50%-0.5rem)]")}>
                            <FormLabel>Team (optional)</FormLabel>
                            <FormControl>
                              <OptionCombobox
                                value={current}
                                onChange={(v) =>
                                  field.onChange(
                                    v === "none" ? null : Number(v),
                                  )
                                }
                                options={options}
                                disabled={!selectedDeptId}
                                placeholder={
                                  selectedDeptId
                                    ? teams.length
                                      ? "Search team…"
                                      : "No teams in department"
                                    : "Pick department first"
                                }
                                emptyText="No teams found."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        </div>
                      );
                    }}
                  />
                </div>
              </HrFormSection>
              <HrFormSection
                className="h-full"
                title="Pay"
                description="Wage type, salary, and hire date."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="wageType"
                    render={({ field }) => (
                      <FormItem className={roleFieldClass}>
                        <FormLabel>Wage type</FormLabel>
                          <FormControl>
                          <OptionCombobox
                            value={field.value}
                            onChange={field.onChange}
                            options={HR_WAGE_TYPES.map((w) => ({
                              value: w,
                              label: HR_WAGE_LABELS[w],
                            }))}
                            placeholder="Search wage type…"
                            emptyText="No wage types."
                          />
                          </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baseSalaryETB"
                    render={({ field }) => (
                      <FormItem className={roleFieldClass}>
                        <FormLabel>Gross Salary</FormLabel>
                        <FormControl>
                          <Input
                            className={roleInputClass}
                            type="number"
                            min={0}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem className={cn(roleFieldClass, "sm:col-span-2")}>
                        <FormLabel>Hire date</FormLabel>
                        <FormControl>
                          <HotelDayPicker
                            value={field.value}
                            onChange={field.onChange}
                            buttonClassName={cn(
                              roleInputClass,
                              "justify-start font-normal",
                            )}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </HrFormSection>
              <HrFormSection
                className="h-full"
                title="Banking"
                description="Payroll bank details."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => {
                      const options: ComboboxOption[] = [
                        ...ETHIOPIAN_BANKS.map((name) => ({
                          value: name,
                          label: name,
                        })),
                      ];
                      // Keep orphan / custom saved bank selectable when editing
                      if (
                        field.value &&
                        !ETHIOPIAN_BANKS.includes(
                          field.value as (typeof ETHIOPIAN_BANKS)[number],
                        )
                      ) {
                        options.unshift({
                          value: field.value,
                          label: field.value,
                          hint: "saved",
                        });
                      }
                      return (
                      <FormItem className={cn(roleFieldClass, "sm:col-span-2")}>
                        <FormLabel>Bank name</FormLabel>
                        <FormControl>
                          <OptionCombobox
                            value={field.value || ""}
                            onChange={field.onChange}
                            options={options}
                            placeholder="Search Ethiopian bank…"
                            emptyText="No banks found."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem className={cn(roleFieldClass, "sm:col-span-2")}>
                        <FormLabel>Account number</FormLabel>
                        <FormControl>
                          <Input
                            className={roleInputClass}
                            placeholder="Employee account number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </HrFormSection>
              <HrFormSection
                className="h-full"
                title="Background"
                description="Education, experience, and TIN."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="education"
                    render={({ field }) => {
                      const options: ComboboxOption[] = [
                        ...HR_EDUCATION_LEVELS.map((o) => ({
                          value: o.value,
                          label: o.label,
                        })),
                      ];
                      if (
                        field.value &&
                        !HR_EDUCATION_LEVELS.some((o) => o.value === field.value)
                      ) {
                        options.unshift({
                          value: field.value,
                          label: field.value,
                        });
                      }
                      return (
                        <FormItem className={roleFieldClass}>
                          <FormLabel>Education</FormLabel>
                          <FormControl>
                            <HrOptionCombobox
                              value={field.value || ""}
                              onChange={field.onChange}
                              options={options}
                              placeholder="Select education"
                              emptyText="No education level found."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="yearsExperience"
                    render={({ field }) => (
                      <FormItem className={roleFieldClass}>
                        <FormLabel>Years of experience</FormLabel>
                        <FormControl>
                          <Input
                            className={roleInputClass}
                            type="number"
                            min={0}
                            max={80}
                            step={1}
                            value={field.value ?? 0}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? 0
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="personalTin"
                    render={({ field }) => (
                      <FormItem className={cn(roleFieldClass, "sm:col-span-2")}>
                        <FormLabel>Personal TIN</FormLabel>
                        <FormControl>
                          <Input className={roleInputClass} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </HrFormSection>
              <HrFormSection
                className="h-full"
                title="Medical"
                description="Optional medical notes."
              >
                <FormField
                  control={form.control}
                  name="medicalNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical note</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-28 rounded-xl border-border/80 bg-background/80"
                          placeholder="Allergies, restrictions, or other medical notes"
                          {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </HrFormSection>
                </div>

              {!editing ? (
                <div className="space-y-3">
                  {extraLines.map((row, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/10 p-3 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Extra employee {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExtraLines((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <HrFormSection className="h-full" title="Identity">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-sm">Full name *</Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Full name"
                                value={row.fullName}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, fullName: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                              <Label className="text-sm">Phone</Label>
                              <PhoneInput
                                defaultCountry="ET"
                                countryCallingCodeEditable
                                international
                                value={row.phone || undefined}
                                onChange={(value) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, phone: value || "" }
                                        : r,
                                    ),
                                  )
                                }
                                className="w-full min-w-0"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm">Email</Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Email"
                                type="email"
                                value={row.email}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, email: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-sm">Gender</Label>
                              <RadioGroup
                                value={row.gender}
                                onValueChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index ? { ...r, gender: v } : r,
                                    ),
                                  )
                                }
                                className="grid grid-cols-2 gap-2"
                              >
                                {HR_GENDER_OPTIONS.map((opt) => (
                                  <Label
                                    key={opt.value}
                                    htmlFor={`extra-gender-${index}-${opt.value}`}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-normal transition-colors",
                                      row.gender === opt.value
                                        ? "border-primary/35 bg-primary/[0.07]"
                                        : "border-border/70 bg-background hover:bg-muted/40",
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={opt.value}
                                      id={`extra-gender-${index}-${opt.value}`}
                                    />
                                    {opt.label}
                                  </Label>
                                ))}
                              </RadioGroup>
                            </div>
                          </div>
                        </HrFormSection>
                        <HrFormSection className="h-full" title="Role">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-sm">Department *</Label>
                              <HrOptionCombobox
                                value={row.department}
                                onChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, department: v, teamId: null }
                                        : r,
                                    ),
                                  )
                                }
                                options={hrDepartments.map((d) => ({
                                  value: d.code,
                                  label: d.label,
                                }))}
                                placeholder="Department"
                                emptyText="No departments."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm">Specific role</Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Skill / professional name"
                                value={row.jobTitle}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? { ...r, jobTitle: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-sm">Position</Label>
                              <RadioGroup
                                value={row.orgPosition}
                                onValueChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            orgPosition:
                                              v === "leader"
                                                ? "leader"
                                                : "employee",
                                          }
                                        : r,
                                    ),
                                  )
                                }
                                className="grid grid-cols-2 gap-2"
                              >
                                {(
                                  [
                                    { id: "employee", label: "Employee" },
                                    { id: "leader", label: "Leader" },
                                  ] as const
                                ).map((opt) => (
                                  <Label
                                    key={opt.id}
                                    htmlFor={`extra-pos-${index}-${opt.id}`}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-normal transition-colors",
                                      row.orgPosition === opt.id
                                        ? "border-primary/35 bg-primary/[0.07]"
                                        : "border-border/70 bg-background hover:bg-muted/40",
                                    )}
                                  >
                                    <RadioGroupItem
                                      value={opt.id}
                                      id={`extra-pos-${index}-${opt.id}`}
                                    />
                                    {opt.label}
                                  </Label>
                                ))}
                              </RadioGroup>
                            </div>
                            <div className="sm:col-span-2 flex justify-center">
                              <div className="w-full space-y-1.5 sm:w-[calc(50%-0.5rem)]">
                                <Label className="text-sm">Team (optional)</Label>
                                {(() => {
                                  const deptId =
                                    hrDepartments.find(
                                      (d) => d.code === row.department,
                                    )?.id ?? null;
                                  const deptTeams =
                                    deptId != null
                                      ? teamsByDeptId[deptId] || []
                                      : [];
                                  return (
                                    <HrOptionCombobox
                                      value={
                                        row.teamId != null && row.teamId > 0
                                          ? String(row.teamId)
                                          : "none"
                                      }
                                      onChange={(v) =>
                                        setExtraLines((prev) =>
                                          prev.map((r, i) =>
                                            i === index
                                              ? {
                                                  ...r,
                                                  teamId:
                                                    v === "none"
                                                      ? null
                                                      : Number(v),
                                                }
                                              : r,
                                          ),
                                        )
                                      }
                                      options={[
                                        { value: "none", label: "No team" },
                                        ...deptTeams.map((t) => ({
                                          value: String(t.id),
                                          label: t.label,
                                          hint: t.code,
                                        })),
                                      ]}
                                      disabled={deptId == null}
                                      placeholder={
                                        deptId == null
                                          ? "Pick department first"
                                          : deptTeams.length
                                            ? "Search team…"
                                            : "No teams in department"
                                      }
                                      emptyText="No teams found."
                                    />
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </HrFormSection>
                        <HrFormSection className="h-full" title="Pay">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-sm">Wage type *</Label>
                              <HrOptionCombobox
                                value={row.wageType}
                                onChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            wageType:
                                              v === "weekly"
                                                ? "weekly"
                                                : "monthly",
                                          }
                                        : r,
                                    ),
                                  )
                                }
                                options={HR_WAGE_TYPES.map((w) => ({
                                  value: w,
                                  label: HR_WAGE_LABELS[w],
                                }))}
                                placeholder="Wage type"
                                emptyText="No wage types."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm">Gross salary *</Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Salary ETB"
                                type="number"
                                min={0}
                                value={row.baseSalaryETB}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            baseSalaryETB: e.target.value,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-sm">Hire date *</Label>
                              <HotelDayPicker
                                value={row.hireDate}
                                onChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index ? { ...r, hireDate: v } : r,
                                    ),
                                  )
                                }
                                buttonClassName={cn(
                                  hrFieldClass,
                                  "justify-start font-normal",
                                )}
                              />
                            </div>
                          </div>
                        </HrFormSection>
                        <HrFormSection className="h-full" title="Banking">
                          <div className="grid gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-sm">Bank name</Label>
                              <HrOptionCombobox
                                value={row.bankName}
                                onChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index ? { ...r, bankName: v } : r,
                                    ),
                                  )
                                }
                                options={ETHIOPIAN_BANKS.map((name) => ({
                                  value: name,
                                  label: name,
                                }))}
                                placeholder="Bank name"
                                emptyText="No banks found."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm">Account number</Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Account number"
                                value={row.accountNumber}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            accountNumber: e.target.value,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </HrFormSection>
                        <HrFormSection className="h-full" title="Background">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-sm">Education</Label>
                              <HrOptionCombobox
                                value={row.education}
                                onChange={(v) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index ? { ...r, education: v } : r,
                                    ),
                                  )
                                }
                                options={HR_EDUCATION_LEVELS.map((o) => ({
                                  value: o.value,
                                  label: o.label,
                                }))}
                                placeholder="Education"
                                emptyText="No education level found."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-sm">
                                Years of experience
                              </Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Years"
                                type="number"
                                min={0}
                                max={80}
                                value={row.yearsExperience}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            yearsExperience: e.target.value,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-sm">Personal TIN</Label>
                              <Input
                                className={hrFieldClass}
                                placeholder="Personal TIN"
                                value={row.personalTin}
                                onChange={(e) =>
                                  setExtraLines((prev) =>
                                    prev.map((r, i) =>
                                      i === index
                                        ? {
                                            ...r,
                                            personalTin: e.target.value,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </HrFormSection>
                        <HrFormSection className="h-full" title="Medical">
                          <div className="space-y-1.5">
                            <Label className="text-sm">Medical note</Label>
                            <Textarea
                              className="min-h-28 rounded-xl border-border/80 bg-background/80"
                              placeholder="Allergies, restrictions, or other medical notes"
                              value={row.medicalNote}
                              onChange={(e) =>
                                setExtraLines((prev) =>
                                  prev.map((r, i) =>
                                    i === index
                                      ? { ...r, medicalNote: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </div>
                        </HrFormSection>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 font-medium"
                    onClick={() =>
                      setExtraLines((prev) => [
                        ...prev,
                        {
                          ...emptyBatchRow(),
                          department: defaultDepartment,
                          hireDate: todayYmd(),
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add line
                  </Button>
                </div>
              ) : null}

              <PendingButton
                type="submit"
                pending={pending}
                className={cn("h-11 w-full", hrPrimaryBtnClass)}
              >
                {editing
                  ? "Save changes"
                  : extraLines.length
                    ? `Save ${1 + extraLines.length} employees`
                    : "Save employee"}
              </PendingButton>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(issuedOtp)}
        onOpenChange={(next) => {
          if (!next) setIssuedOtp(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Portal OTP for {issuedOtp?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Share this code with the employee for VoloSync employee login. It stays visible
              to HR Manager only until their first login, then they must change it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="rounded-lg border bg-muted/40 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em]">
            {issuedOtp?.otp}
          </p>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issuedOtp?.otp || "");
                  toast.success("OTP copied");
                } catch {
                  /* ignore */
                }
                setIssuedOtp(null);
              }}
            >
              Copy and close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HrPanelShell>
  );
}
