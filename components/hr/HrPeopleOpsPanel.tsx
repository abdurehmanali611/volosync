"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Award,
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  Package,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PendingButton } from "@/components/ui/pending-button";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import {
  HrRequestDataTable,
  HrStatusPill,
} from "@/components/hr/HrRequestDataTable";
import {
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { notifyApiFailure } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { hrDepartmentLabel } from "@/lib/hrDepartments";
import {
  fetchHrDepartments,
  fetchHrTeamsApi,
  type HrDepartment,
  type HrEmployee,
  type HrTeam,
} from "@/lib/api/hrSource";
import {
  createHrAssetApi,
  createHrBenefitAssignmentApi,
  createHrCareerActionApi,
  createHrDisciplinaryActionApi,
  createHrPerformanceReviewApi,
  createHrTrainingAssignmentApi,
  decideHrBenefitAssignmentApi,
  decideHrCareerActionApi,
  decideHrDisciplinaryActionApi,
  decideHrTrainingAssignmentApi,
  fetchHrAssets,
  fetchHrBenefitAssignments,
  fetchHrCareerActions,
  fetchHrDisciplinaryActions,
  fetchHrPerformanceReviews,
  fetchHrTrainingAssignments,
  finalizeHrPerformanceReviewApi,
  issueHrAssetApi,
  returnHrAssetApi,
  type HrAsset,
  type HrBenefitAssignment,
  type HrCareerAction,
  type HrDisciplinaryAction,
  type HrPerformanceReview,
  type HrTrainingAssignment,
} from "@/lib/api/hrPhaseB";

const CAREER_KIND_OPTIONS = [
  { value: "promotion", label: "Promotion" },
  { value: "transfer", label: "Transfer" },
];

const BENEFIT_KIND_OPTIONS = [
  { value: "meal", label: "Meal" },
  { value: "housing", label: "Housing" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

function Decide({
  show,
  onDecide,
}: {
  show: boolean;
  onDecide: (ok: boolean) => Promise<void>;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => void onDecide(true)}>
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onDecide(false)}
      >
        Reject
      </Button>
    </div>
  );
}

function OpsSplit({
  canRequest,
  formTitle,
  formDescription,
  form,
  listTitle,
  listDescription,
  list,
}: {
  canRequest: boolean;
  formTitle: string;
  formDescription: string;
  form: ReactNode;
  listTitle: string;
  listDescription: string;
  list: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-stretch gap-4",
        canRequest ? "lg:grid-cols-2" : "grid-cols-1",
      )}
    >
      {canRequest ? (
        <HrFormSection
          className="h-full"
          title={formTitle}
          description={formDescription}
        >
          {form}
        </HrFormSection>
      ) : null}
      <HrFormSection
        className="h-full"
        title={listTitle}
        description={listDescription}
      >
        {list}
      </HrFormSection>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function HrPeopleOpsPanel({
  employees,
  canRequest,
  canDecide,
  canManageAssets = false,
}: {
  employees: HrEmployee[];
  canRequest: boolean;
  canDecide: boolean;
  /** Manager/Admin — register new assets (HR issues/returns only). */
  canManageAssets?: boolean;
}) {
  const [career, setCareer] = useState<HrCareerAction[]>([]);
  const [discipline, setDiscipline] = useState<HrDisciplinaryAction[]>([]);
  const [perf, setPerf] = useState<HrPerformanceReview[]>([]);
  const [training, setTraining] = useState<HrTrainingAssignment[]>([]);
  const [benefits, setBenefits] = useState<HrBenefitAssignment[]>([]);
  const [assets, setAssets] = useState<HrAsset[]>([]);
  const [pending, setPending] = useState(false);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [careerForm, setCareerForm] = useState({
    employeeId: "",
    kind: "promotion",
    toDept: "",
    toTeamId: "",
    toTitle: "",
    toOrgPosition: "employee" as "employee" | "leader",
    detail: "",
  });
  const [discForm, setDiscForm] = useState({
    employeeId: "",
    title: "",
    detail: "",
  });
  const [perfForm, setPerfForm] = useState({
    employeeId: "",
    periodLabel: "",
    rating: "",
    summary: "",
  });
  const [trainForm, setTrainForm] = useState({
    employeeIds: [] as number[],
    title: "",
    dueYmd: "",
  });
  const [benForm, setBenForm] = useState({
    employeeId: "",
    kind: "meal",
    label: "",
    amountETB: "",
  });
  const [assetForm, setAssetForm] = useState({ label: "", serialNo: "" });
  const [issueForm, setIssueForm] = useState({
    id: "",
    employeeId: "",
    issuedYmd: "",
  });

  const empName = (id: number | null) =>
    id == null ? "—" : employees.find((e) => e.id === id)?.fullName || `#${id}`;

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((d) => d.active !== false)
        .map((d) => ({
          value: d.code,
          label: d.label || hrDepartmentLabel(d.code, departments),
          hint: d.code,
        })),
    [departments],
  );

  /** Teams for the chosen target department (every active team when none picked). */
  const teamOptions = useMemo(() => {
    const deptCode = String(careerForm.toDept || "").trim();
    const deptId = deptCode
      ? departments.find((d) => d.code === deptCode)?.id ?? null
      : null;
    return [
      { value: "", label: "Keep current team" },
      ...teams
        .filter((t) => t.active !== false)
        .filter((t) => deptId == null || t.departmentId === deptId)
        .map((t) => ({
          value: String(t.id),
          label: t.label,
          hint: t.code || undefined,
        })),
    ];
  }, [teams, departments, careerForm.toDept]);

  const availableAssetOptions = useMemo(
    () =>
      assets
        .filter((a) => a.status === "available")
        .map((a) => ({
          value: String(a.id),
          label: a.label,
          hint: a.serialNo || undefined,
        })),
    [assets],
  );

  const load = useCallback(async () => {
    try {
      const [c, d, p, t, b, a, deps, tms] = await Promise.all([
        fetchHrCareerActions(),
        fetchHrDisciplinaryActions(),
        fetchHrPerformanceReviews(),
        fetchHrTrainingAssignments(),
        fetchHrBenefitAssignments(),
        fetchHrAssets(),
        fetchHrDepartments().catch(() => [] as HrDepartment[]),
        fetchHrTeamsApi().catch(() => [] as HrTeam[]),
      ]);
      setCareer(c);
      setDiscipline(d);
      setPerf(p);
      setTraining(t);
      setBenefits(b);
      setAssets(a);
      setDepartments(deps);
      setTeams(tms.filter((row) => row.active !== false));
    } catch (e) {
      notifyApiFailure(e, "Could not load people ops");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const careerColumns = useMemo<ColumnDef<HrCareerAction>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "kind",
        header: "Kind",
      },
      {
        id: "target",
        header: "Target",
        cell: ({ row }) => {
          const r = row.original;
          const team = r.toTeamId
            ? teams.find((t) => t.id === r.toTeamId)?.label || `#${r.toTeamId}`
            : null;
          const parts = [
            r.toTitle || r.toDept
              ? [r.toTitle, r.toDept].filter(Boolean).join(" · ")
              : null,
            team ? `Team: ${team}` : null,
            r.toOrgPosition ? `Position: ${r.toOrgPosition}` : null,
          ].filter(Boolean);
          return parts.length ? parts.join(" · ") : "—";
        },
      },
      {
        accessorKey: "detail",
        header: "Detail",
        cell: ({ row }) => row.original.detail || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Decide
            show={canDecide && row.original.status === "pending"}
            onDecide={async (ok) => {
              try {
                await decideHrCareerActionApi(row.original.id, ok);
                toast.success(ok ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, employees, teams, load],
  );

  const disciplineColumns = useMemo<ColumnDef<HrDisciplinaryAction>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        accessorKey: "detail",
        header: "Detail",
        cell: ({ row }) => row.original.detail || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Decide
            show={canDecide && row.original.status === "pending"}
            onDecide={async (ok) => {
              try {
                await decideHrDisciplinaryActionApi(row.original.id, ok);
                toast.success(ok ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, employees, load],
  );

  const perfColumns = useMemo<ColumnDef<HrPerformanceReview>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "periodLabel",
        header: "Period",
      },
      {
        accessorKey: "rating",
        header: "Rating",
        cell: ({ row }) => row.original.rating || "—",
      },
      {
        accessorKey: "summary",
        header: "Summary",
        cell: ({ row }) => row.original.summary || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Decide
            show={canDecide && row.original.status === "pending"}
            onDecide={async (ok) => {
              try {
                await finalizeHrPerformanceReviewApi(row.original.id, ok);
                toast.success(ok ? "Finalized" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, employees, load],
  );

  const trainingColumns = useMemo<ColumnDef<HrTrainingAssignment>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        id: "due",
        accessorKey: "dueYmd",
        header: "Due",
        cell: ({ row }) => row.original.dueYmd || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Decide
            show={canDecide && row.original.status === "pending"}
            onDecide={async (ok) => {
              try {
                await decideHrTrainingAssignmentApi(row.original.id, ok);
                toast.success(ok ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, employees, load],
  );

  const benefitsColumns = useMemo<ColumnDef<HrBenefitAssignment>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "kind",
        header: "Kind",
      },
      {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => row.original.label || "—",
      },
      {
        id: "amount",
        accessorKey: "amountETB",
        header: "Amount",
        cell: ({ row }) =>
          row.original.amountETB != null
            ? `${row.original.amountETB} ETB`
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Decide
            show={canDecide && row.original.status === "pending"}
            onDecide={async (ok) => {
              try {
                await decideHrBenefitAssignmentApi(row.original.id, ok);
                toast.success(ok ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, employees, load],
  );

  const inventoryAssets = useMemo(
    () => assets.filter((a) => a.status !== "issued"),
    [assets],
  );
  const issuedAssets = useMemo(
    () => assets.filter((a) => a.status === "issued"),
    [assets],
  );

  const inventoryColumns = useMemo<ColumnDef<HrAsset>[]>(
    () => [
      {
        id: "label",
        accessorKey: "label",
        header: "Label",
      },
      {
        id: "serial",
        accessorKey: "serialNo",
        header: "Serial",
        cell: ({ row }) => row.original.serialNo || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => row.original.notes || "—",
      },
    ],
    [],
  );

  const issuedColumns = useMemo<ColumnDef<HrAsset>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "label",
        header: "Asset",
      },
      {
        id: "serial",
        accessorKey: "serialNo",
        header: "Serial",
        cell: ({ row }) => row.original.serialNo || "—",
      },
      {
        id: "issuedYmd",
        accessorKey: "issuedYmd",
        header: "Issued",
        cell: ({ row }) => row.original.issuedYmd || "—",
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) =>
          canRequest ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const ymd = new Date().toISOString().slice(0, 10);
                  await returnHrAssetApi({
                    id: row.original.id,
                    returnedYmd: ymd,
                  });
                  toast.success("Asset returned");
                  await load();
                } catch (e) {
                  notifyApiFailure(e, "Could not return asset");
                }
              }}
            >
              Return
            </Button>
          ) : null,
      },
    ],
    [canRequest, employees, load],
  );

  return (
    <HrPanelShell>
      <div className="space-y-6">
        <HrSectionCard
          title="Promotion / transfer"
          description={
            canDecide && !canRequest
              ? "Review pending career moves and approve to apply department or title changes."
              : "Submit promotion or transfer requests. Manager approval applies the change."
          }
          icon={<Briefcase className="h-5 w-5" />}
        >
          <OpsSplit
            canRequest={canRequest}
            formTitle="New request"
            formDescription="Choose the employee, move type, target department / team, and role."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      careerForm.employeeId
                        ? [Number(careerForm.employeeId)]
                        : []
                    }
                    onChange={(ids) =>
                      setCareerForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kind">
                    <HrOptionCombobox
                      value={careerForm.kind}
                      onChange={(value) =>
                        setCareerForm((f) => ({ ...f, kind: value }))
                      }
                      options={CAREER_KIND_OPTIONS}
                      placeholder="Select kind"
                      searchPlaceholder="Search kind…"
                    />
                  </Field>
                  <Field label="To department">
                    <HrOptionCombobox
                      value={careerForm.toDept}
                      onChange={(value) =>
                        setCareerForm((f) => ({ ...f, toDept: value }))
                      }
                      options={departmentOptions}
                      placeholder="Select department"
                      searchPlaceholder="Search departments…"
                      emptyText="No departments registered."
                    />
                  </Field>
                  <Field label="To team">
                    <HrOptionCombobox
                      value={careerForm.toTeamId}
                      onChange={(value) =>
                        setCareerForm((f) => ({ ...f, toTeamId: value }))
                      }
                      options={teamOptions}
                      placeholder={
                        careerForm.toDept ? "Select team…" : "Search team…"
                      }
                      searchPlaceholder="Search teams…"
                      emptyText="No teams in this department."
                    />
                  </Field>
                  <Field label="To title" className="sm:col-span-2">
                    <Input
                      className={hrFieldClass}
                      placeholder="e.g. Senior receptionist"
                      value={careerForm.toTitle}
                      onChange={(e) =>
                        setCareerForm((f) => ({
                          ...f,
                          toTitle: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Position" className="sm:col-span-2">
                    <RadioGroup
                      value={careerForm.toOrgPosition}
                      onValueChange={(value) =>
                        setCareerForm((f) => ({
                          ...f,
                          toOrgPosition:
                            value === "leader" ? "leader" : "employee",
                        }))
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
                          htmlFor={`people-ops-pos-${opt.id}`}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-normal transition-colors",
                            careerForm.toOrgPosition === opt.id
                              ? "border-primary/35 bg-primary/[0.07]"
                              : "border-border/70 bg-background hover:bg-muted/40",
                          )}
                        >
                          <RadioGroupItem
                            value={opt.id}
                            id={`people-ops-pos-${opt.id}`}
                          />
                          {opt.label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </Field>
                  <Field label="Notes" className="sm:col-span-2">
                    <Input
                      className={hrFieldClass}
                      placeholder="Optional detail"
                      value={careerForm.detail}
                      onChange={(e) =>
                        setCareerForm((f) => ({
                          ...f,
                          detail: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!careerForm.employeeId) {
                      toast.error("Select an employee");
                      return;
                    }
                    setPending(true);
                    try {
                      const emp = employees.find(
                        (e) => e.id === Number(careerForm.employeeId),
                      );
                      await createHrCareerActionApi({
                        employeeId: Number(careerForm.employeeId),
                        kind: careerForm.kind,
                        fromDept: emp?.department,
                        fromTitle: emp?.jobTitle,
                        toDept: careerForm.toDept,
                        toTitle: careerForm.toTitle,
                        toTeamId: careerForm.toTeamId
                          ? Number(careerForm.toTeamId)
                          : null,
                        toOrgPosition: careerForm.toOrgPosition,
                        detail: careerForm.detail,
                      });
                      toast.success("Career request submitted");
                      setCareerForm({
                        employeeId: "",
                        kind: "promotion",
                        toDept: "",
                        toTeamId: "",
                        toTitle: "",
                        toOrgPosition: "employee",
                        detail: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit career request");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit request
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent requests"}
            listDescription={
              canDecide
                ? "Approve pending moves to apply them to the employee record."
                : "Submitted career moves for this property."
            }
            list={
              <HrRequestDataTable
                data={career}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No career requests"
                emptyDescription={
                  canRequest
                    ? "Submit the first promotion or transfer on the left."
                    : "Nothing waiting for approval yet."
                }
                columns={careerColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Discipline"
          description={
            canDecide && !canRequest
              ? "Approve or reject recorded disciplinary actions."
              : "Record disciplinary cases. They appear after Manager approval."
          }
          icon={<ShieldAlert className="h-5 w-5" />}
        >
          <OpsSplit
            canRequest={canRequest}
            formTitle="New case"
            formDescription="Capture the employee, title, and detail."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      discForm.employeeId ? [Number(discForm.employeeId)] : []
                    }
                    onChange={(ids) =>
                      setDiscForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <Field label="Title">
                  <Input
                    className={hrFieldClass}
                    placeholder="e.g. Verbal warning"
                    value={discForm.title}
                    onChange={(e) =>
                      setDiscForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Detail">
                  <Textarea
                    className={cn(hrFieldClass, "min-h-24")}
                    placeholder="What happened"
                    value={discForm.detail}
                    onChange={(e) =>
                      setDiscForm((f) => ({ ...f, detail: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!discForm.employeeId || !discForm.title.trim()) {
                      toast.error("Employee and title are required");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrDisciplinaryActionApi({
                        employeeId: Number(discForm.employeeId),
                        title: discForm.title,
                        detail: discForm.detail,
                      });
                      toast.success("Disciplinary case submitted");
                      setDiscForm({ employeeId: "", title: "", detail: "" });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit case");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit case
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent cases"}
            listDescription="Pending cases wait for Manager decision."
            list={
              <HrRequestDataTable
                data={discipline}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No discipline records"
                emptyDescription={
                  canRequest
                    ? "Submit a case from the form on the left."
                    : "No cases awaiting review."
                }
                columns={disciplineColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Performance"
          description={
            canDecide && !canRequest
              ? "Finalize pending performance reviews."
              : "Draft reviews for an employee period. Manager finalizes."
          }
          icon={<ClipboardCheck className="h-5 w-5" />}
        >
          <OpsSplit
            canRequest={canRequest}
            formTitle="New review"
            formDescription="Period label, rating, and short summary."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      perfForm.employeeId ? [Number(perfForm.employeeId)] : []
                    }
                    onChange={(ids) =>
                      setPerfForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Period">
                    <Input
                      className={hrFieldClass}
                      placeholder="e.g. Q1 2026"
                      value={perfForm.periodLabel}
                      onChange={(e) =>
                        setPerfForm((f) => ({
                          ...f,
                          periodLabel: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Rating">
                    <Input
                      className={hrFieldClass}
                      placeholder="e.g. Meets expectations"
                      value={perfForm.rating}
                      onChange={(e) =>
                        setPerfForm((f) => ({
                          ...f,
                          rating: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Summary">
                  <Textarea
                    className={cn(hrFieldClass, "min-h-24")}
                    placeholder="Short review notes"
                    value={perfForm.summary}
                    onChange={(e) =>
                      setPerfForm((f) => ({ ...f, summary: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!perfForm.employeeId || !perfForm.periodLabel.trim()) {
                      toast.error("Employee and period are required");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrPerformanceReviewApi({
                        employeeId: Number(perfForm.employeeId),
                        periodLabel: perfForm.periodLabel,
                        rating: perfForm.rating,
                        summary: perfForm.summary,
                      });
                      toast.success("Review submitted");
                      setPerfForm({
                        employeeId: "",
                        periodLabel: "",
                        rating: "",
                        summary: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit review");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit review
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent reviews"}
            listDescription="Pending reviews need Manager finalize."
            list={
              <HrRequestDataTable
                data={perf}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No performance reviews"
                emptyDescription={
                  canRequest
                    ? "Create the first review on the left."
                    : "No reviews waiting to finalize."
                }
                columns={perfColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Training"
          description={
            canDecide && !canRequest
              ? "Approve training assignments for staff."
              : "Assign training with an optional due date. Manager confirms."
          }
          icon={<GraduationCap className="h-5 w-5" />}
        >
          <OpsSplit
            canRequest={canRequest}
            formTitle="New assignment"
            formDescription="Employee, course title, and due date."
            form={
              <div className="space-y-4">
                <Field label="Employees">
                  <HrEmployeeCombobox
                    multiple
                    employees={employees}
                    valueIds={trainForm.employeeIds}
                    onChange={(ids) =>
                      setTrainForm((f) => ({
                        ...f,
                        employeeIds: ids,
                      }))
                    }
                  />
                </Field>
                <Field label="Title">
                  <Input
                    className={hrFieldClass}
                    placeholder="e.g. Fire safety"
                    value={trainForm.title}
                    onChange={(e) =>
                      setTrainForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Due date">
                  <HotelDayPicker
                    value={trainForm.dueYmd}
                    onChange={(v) =>
                      setTrainForm((f) => ({ ...f, dueYmd: v }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (
                      trainForm.employeeIds.length === 0 ||
                      !trainForm.title.trim()
                    ) {
                      toast.error("Select employees and enter a title");
                      return;
                    }
                    setPending(true);
                    try {
                      await Promise.all(
                        trainForm.employeeIds.map((employeeId) =>
                          createHrTrainingAssignmentApi({
                            employeeId,
                            title: trainForm.title,
                            dueYmd: trainForm.dueYmd,
                          }),
                        ),
                      );
                      toast.success(
                        trainForm.employeeIds.length === 1
                          ? "Training assigned"
                          : `Training assigned to ${trainForm.employeeIds.length} employees`,
                      );
                      setTrainForm({
                        employeeIds: [],
                        title: "",
                        dueYmd: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not assign training");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Assign training
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent assignments"}
            listDescription="Pending assignments wait for Manager."
            list={
              <HrRequestDataTable
                data={training}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No training assignments"
                emptyDescription={
                  canRequest
                    ? "Assign the first course on the left."
                    : "No training waiting for approval."
                }
                columns={trainingColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Benefits"
          description={
            canDecide && !canRequest
              ? "Approve meal, housing, transport, or other benefits."
              : "Request meal, housing, transport, or other benefit amounts."
          }
          icon={<Award className="h-5 w-5" />}
        >
          <OpsSplit
            canRequest={canRequest}
            formTitle="New benefit"
            formDescription="Kind, label, and monthly amount in ETB."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      benForm.employeeId ? [Number(benForm.employeeId)] : []
                    }
                    onChange={(ids) =>
                      setBenForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kind">
                    <HrOptionCombobox
                      value={benForm.kind}
                      onChange={(value) =>
                        setBenForm((f) => ({ ...f, kind: value }))
                      }
                      options={BENEFIT_KIND_OPTIONS}
                      placeholder="Select kind"
                      searchPlaceholder="Search kind…"
                    />
                  </Field>
                  <Field label="Amount (ETB)">
                    <Input
                      className={hrFieldClass}
                      type="number"
                      placeholder="0"
                      value={benForm.amountETB}
                      onChange={(e) =>
                        setBenForm((f) => ({
                          ...f,
                          amountETB: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Label">
                  <Input
                    className={hrFieldClass}
                    placeholder="e.g. Staff canteen"
                    value={benForm.label}
                    onChange={(e) =>
                      setBenForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!benForm.employeeId) {
                      toast.error("Select an employee");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrBenefitAssignmentApi({
                        employeeId: Number(benForm.employeeId),
                        kind: benForm.kind,
                        label: benForm.label,
                        amountETB: Number(benForm.amountETB) || 0,
                      });
                      toast.success("Benefit submitted");
                      setBenForm({
                        employeeId: "",
                        kind: "meal",
                        label: "",
                        amountETB: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit benefit");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit benefit
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent benefits"}
            listDescription="Pending benefits wait for Manager approval."
            list={
              <HrRequestDataTable
                data={benefits}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No benefits"
                emptyDescription={
                  canRequest
                    ? "Request the first benefit on the left."
                    : "No benefit requests waiting."
                }
                columns={benefitsColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Assets"
          description={
            canManageAssets
              ? "Register property assets. HR (or you) can issue them to staff and record returns."
              : canRequest
                ? "Issue available assets to staff and record returns. Manager registers new assets."
                : "View issued and available assets for this property."
          }
          icon={<Package className="h-5 w-5" />}
        >
          <OpsSplit
            canRequest={canRequest || canManageAssets}
            formTitle={
              canManageAssets && canRequest
                ? "Register & issue"
                : canManageAssets
                  ? "Register asset"
                  : "Issue & return"
            }
            formDescription={
              canManageAssets && canRequest
                ? "Add a new asset, then issue available ones to employees."
                : canManageAssets
                  ? "Only Manager/Admin can add assets to inventory."
                  : "Issue available assets to employees. Manager adds new inventory."
            }
            form={
              <div className="space-y-5">
                {canManageAssets ? (
                <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/10 p-3 sm:p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Register asset
                  </p>
                  <Field label="Label">
                    <Input
                      className={hrFieldClass}
                      placeholder="e.g. Radio handset"
                      value={assetForm.label}
                      onChange={(e) =>
                        setAssetForm((f) => ({ ...f, label: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Serial">
                    <Input
                      className={hrFieldClass}
                      placeholder="Optional serial number"
                      value={assetForm.serialNo}
                      onChange={(e) =>
                        setAssetForm((f) => ({
                          ...f,
                          serialNo: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <PendingButton
                    pending={pending}
                    className={cn(hrPrimaryBtnClass, "w-full")}
                    onClick={async () => {
                      if (!assetForm.label.trim()) {
                        toast.error("Asset label is required");
                        return;
                      }
                      setPending(true);
                      try {
                        await createHrAssetApi(assetForm);
                        toast.success("Asset created");
                        setAssetForm({ label: "", serialNo: "" });
                        await load();
                      } catch (e) {
                        notifyApiFailure(e, "Could not create asset");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Add asset
                  </PendingButton>
                </div>
                ) : null}

                {canRequest ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Issue to employee
                  </p>
                  <Field label="Available asset">
                    <HrOptionCombobox
                      value={issueForm.id}
                      onChange={(value) =>
                        setIssueForm((f) => ({ ...f, id: value }))
                      }
                      options={availableAssetOptions}
                      placeholder="Select asset"
                      searchPlaceholder="Search assets…"
                      emptyText="No available assets."
                    />
                  </Field>
                  <Field label="Employee">
                    <HrEmployeeCombobox
                      employees={employees}
                      valueIds={
                        issueForm.employeeId
                          ? [Number(issueForm.employeeId)]
                          : []
                      }
                      onChange={(ids) =>
                        setIssueForm((f) => ({
                          ...f,
                          employeeId: ids[0] ? String(ids[0]) : "",
                        }))
                      }
                    />
                  </Field>
                  <Field label="Issue date">
                    <HotelDayPicker
                      value={issueForm.issuedYmd}
                      onChange={(v) =>
                        setIssueForm((f) => ({ ...f, issuedYmd: v }))
                      }
                    />
                  </Field>
                  <PendingButton
                    pending={pending}
                    className={cn(hrPrimaryBtnClass, "w-full")}
                    onClick={async () => {
                      if (!issueForm.id || !issueForm.employeeId) {
                        toast.error("Select an asset and employee");
                        return;
                      }
                      setPending(true);
                      try {
                        await issueHrAssetApi({
                          id: Number(issueForm.id),
                          employeeId: Number(issueForm.employeeId),
                          issuedYmd: issueForm.issuedYmd,
                        });
                        toast.success("Asset issued");
                        setIssueForm({
                          id: "",
                          employeeId: "",
                          issuedYmd: "",
                        });
                        await load();
                      } catch (e) {
                        notifyApiFailure(e, "Could not issue asset");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Issue asset
                  </PendingButton>
                </div>
                ) : null}
              </div>
            }
            listTitle="Asset lists"
            listDescription="Inventory of unissued assets, and assets currently with employees."
            list={
              <div className="space-y-6">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium tracking-tight">
                      Asset inventory
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Available and returned assets (not currently issued).
                    </p>
                  </div>
                  <HrRequestDataTable
                    data={inventoryAssets}
                    employees={employees}
                    enableEmployeeFilter={false}
                    searchColumnId="label"
                    searchPlaceholder="Search assets…"
                    emptyTitle="No assets in inventory"
                    emptyDescription={
                      canRequest
                        ? "Register assets on the left. Issued items appear in the table below."
                        : "No available or returned assets."
                    }
                    columns={inventoryColumns}
                  />
                </div>
                <div className="space-y-2 border-t border-border/60 pt-5">
                  <div>
                    <p className="text-sm font-medium tracking-tight">
                      Issued to employees
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assets currently assigned to staff. Filter by employee above
                      the table.
                    </p>
                  </div>
                  <HrRequestDataTable
                    data={issuedAssets}
                    employees={employees}
                    getEmployeeId={(row) => row.employeeId}
                    enableEmployeeFilter
                    searchColumnId="employee"
                    searchPlaceholder="Search issued assets…"
                    emptyTitle="No issued assets"
                    emptyDescription={
                      canRequest
                        ? "Issue an available asset to an employee from the form."
                        : "Nothing is currently issued."
                    }
                    columns={issuedColumns}
                  />
                </div>
              </div>
            }
          />
        </HrSectionCard>

        {canDecide && !canRequest ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            Manager view — approve or reject pending people-ops requests. HR
            submits new items.
          </p>
        ) : null}
      </div>
    </HrPanelShell>
  );
}
