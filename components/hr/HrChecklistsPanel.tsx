"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Check, CheckSquare, ListChecks, Pencil, Plus, Scale, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PendingButton } from "@/components/ui/pending-button";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import {
  HrEmptyState,
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import {
  HrRequestDataTable,
  HrStatusPill,
} from "@/components/hr/HrRequestDataTable";
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
  approveHrChecklistRunApi,
  completeHrChecklistRunApi,
  deleteHrChecklistTemplateApi,
  fetchHrChecklistRuns,
  fetchHrChecklistTemplates,
  saveHrChecklistTemplateApi,
  startHrChecklistRunApi,
  toggleHrChecklistRunItemApi,
  type HrChecklistRun,
  type HrChecklistTemplate,
} from "@/lib/api/hrPhaseB";

const KIND_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "exit", label: "Exit" },
];

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

export function HrChecklistsPanel({
  employees,
  canManageTemplates,
  canApproveExit,
  canRunChecklists,
}: {
  employees: HrEmployee[];
  canManageTemplates: boolean;
  canApproveExit: boolean;
  canRunChecklists: boolean;
}) {
  const [templates, setTemplates] = useState<HrChecklistTemplate[]>([]);
  const [runs, setRuns] = useState<HrChecklistRun[]>([]);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [tplForm, setTplForm] = useState({
    kind: "onboarding",
    name: "",
    required: true,
    department: "",
    jobTitle: "",
    teamId: "" as string,
    itemLabel: "",
    itemRequired: true,
    items: [] as Array<{ label: string; required: boolean; defaultOwner: string }>,
  });
  const [startForm, setStartForm] = useState({
    employeeIds: [] as number[],
    kind: "onboarding",
  });

  const load = useCallback(async () => {
    try {
      const [t, r, deps, teamRows] = await Promise.all([
        fetchHrChecklistTemplates(),
        fetchHrChecklistRuns(),
        fetchHrDepartments().catch(() => [] as HrDepartment[]),
        fetchHrTeamsApi().catch(() => [] as HrTeam[]),
      ]);
      setTemplates(t);
      setRuns(r);
      setDepartments(deps);
      setTeams(teamRows);
    } catch (e) {
      notifyApiFailure(e, "Could not load checklists");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empName = useCallback(
    (id: number) => employees.find((e) => e.id === id)?.fullName || `#${id}`,
    [employees],
  );

  const departmentOptions = useMemo(
    () => [
      { value: "", label: "All departments" },
      ...departments
        .filter((d) => d.active !== false)
        .map((d) => ({
          value: d.code,
          label: d.label || hrDepartmentLabel(d.code, departments),
          hint: d.code,
        })),
    ],
    [departments],
  );

  const selectedDeptId = useMemo(() => {
    const code = String(tplForm.department || "").trim();
    if (!code) return null;
    return departments.find((d) => d.code === code)?.id ?? null;
  }, [tplForm.department, departments]);

  const teamOptions = useMemo(() => {
    const scoped = teams.filter((t) =>
      selectedDeptId == null ? true : t.departmentId === selectedDeptId,
    );
    return [
      { value: "", label: "Any team (optional)" },
      ...scoped
        .filter((t) => t.active !== false)
        .map((t) => ({
          value: String(t.id),
          label: t.label || t.code,
          hint: t.code,
        })),
    ];
  }, [teams, selectedDeptId]);

  const jobTitleOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const e of employees) {
      const t = String(e.jobTitle || "").trim();
      if (t) titles.add(t);
    }
    return [
      { value: "", label: "All positions" },
      ...[...titles].sort().map((t) => ({ value: t, label: t })),
    ];
  }, [employees]);

  const resetTplForm = () => {
    setEditingId(null);
    setTplForm({
      kind: "onboarding",
      name: "",
      required: true,
      department: "",
      jobTitle: "",
      teamId: "",
      itemLabel: "",
      itemRequired: true,
      items: [],
    });
  };

  const beginEdit = (t: HrChecklistTemplate) => {
    setEditingId(t.id);
    setTplForm({
      kind: t.kind,
      name: t.name,
      required: t.required !== false,
      department: t.department || "",
      jobTitle: t.jobTitle || "",
      teamId: t.teamId != null && t.teamId > 0 ? String(t.teamId) : "",
      itemLabel: "",
      itemRequired: true,
      items: t.items.map((it) => ({
        label: it.label,
        required: it.required !== false,
        defaultOwner: it.defaultOwner || "HR",
      })),
    });
  };

  const addItem = () => {
    const label = tplForm.itemLabel.trim();
    if (!label) return;
    setTplForm((f) => ({
      ...f,
      itemLabel: "",
      items: [
        ...f.items,
        {
          label,
          required: f.itemRequired,
          defaultOwner: "HR",
        },
      ],
    }));
  };

  const scopeLabel = (t: HrChecklistTemplate) => {
    const parts: string[] = [];
    if (t.department) {
      parts.push(
        hrDepartmentLabel(t.department, departments) || t.department,
      );
    } else {
      parts.push("All depts");
    }
    parts.push(t.jobTitle || "All positions");
    if (t.teamId != null && t.teamId > 0) {
      const team = teams.find((x) => x.id === t.teamId);
      parts.push(team?.label || team?.code || `Team #${t.teamId}`);
    }
    return parts.join(" · ");
  };

  const managerRunColumns = useMemo<ColumnDef<HrChecklistRun, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "kind",
        header: "Kind",
        cell: ({ row }) => (
          <span className="capitalize">{row.original.kind}</span>
        ),
      },
      {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const done = row.original.items.filter((i) => i.done).length;
          return `${done}/${row.original.items.length}`;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      ...(canApproveExit
        ? [
            {
              id: "actions",
              header: "Decision",
              cell: ({ row }: { row: { original: HrChecklistRun } }) => {
                if (row.original.status !== "awaiting_manager") {
                  return (
                    <span className="text-xs text-muted-foreground">—</span>
                  );
                }
                return (
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <Button
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 rounded-lg px-3 font-medium shadow-sm",
                        "bg-emerald-600 text-white hover:bg-emerald-500",
                      )}
                      onClick={async () => {
                        try {
                          await approveHrChecklistRunApi(row.original.id, true);
                          toast.success("Exit approved");
                          await load();
                        } catch (e) {
                          notifyApiFailure(e, "Approve failed");
                        }
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "h-8 gap-1.5 rounded-lg px-3 font-medium shadow-sm",
                        "border-rose-500/35 bg-rose-500/5 text-rose-700",
                        "hover:bg-rose-500/12",
                      )}
                      onClick={async () => {
                        try {
                          await approveHrChecklistRunApi(
                            row.original.id,
                            false,
                          );
                          toast.message("Returned to open");
                          await load();
                        } catch (e) {
                          notifyApiFailure(e, "Reject failed");
                        }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                );
              },
            } satisfies ColumnDef<HrChecklistRun, unknown>,
          ]
        : []),
    ],
    [canApproveExit, empName, load],
  );

  return (
    <HrPanelShell>
      <div className="space-y-6">
        <HrSectionCard
          title="Checklist templates"
          description={
            canManageTemplates
              ? "Create templates scoped by department, position, and optional team. Required flag marks mandatory checklists. Exit completion needs Manager approval."
              : "Templates configured by Manager. Starting a run matches the employee’s department, position, and team."
          }
          icon={<ListChecks className="h-5 w-5" />}
        >
          <div
            className={cn(
              "grid items-stretch gap-4",
              canManageTemplates ? "lg:grid-cols-2" : "grid-cols-1",
            )}
          >
            {canManageTemplates ? (
              <HrFormSection
                className="h-full"
                title={editingId ? "Edit template" : "New template"}
                description={
                  editingId
                    ? "Update scope, required flag, or items, then save."
                    : "Scope by department, position, and optional team. HR matches these when starting a run."
                }
              >
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Kind">
                      <HrOptionCombobox
                        value={tplForm.kind}
                        onChange={(value) =>
                          setTplForm((f) => ({ ...f, kind: value }))
                        }
                        options={KIND_OPTIONS}
                        placeholder="Select kind"
                        searchPlaceholder="Search kind…"
                      />
                    </Field>
                    <Field label="Template name">
                      <Input
                        className={hrFieldClass}
                        value={tplForm.name}
                        onChange={(e) =>
                          setTplForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="e.g. Front desk onboarding"
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Required checklist</p>
                      <p className="text-xs text-muted-foreground">
                        Mark when matching employees must complete this template.
                      </p>
                    </div>
                    <Switch
                      checked={tplForm.required}
                      onCheckedChange={(checked) =>
                        setTplForm((f) => ({ ...f, required: Boolean(checked) }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Department">
                      <HrOptionCombobox
                        value={tplForm.department}
                        onChange={(value) =>
                          setTplForm((f) => ({
                            ...f,
                            department: value,
                            teamId: "",
                          }))
                        }
                        options={departmentOptions}
                        placeholder="All departments"
                        searchPlaceholder="Search department…"
                      />
                    </Field>
                    <Field label="Position">
                      <HrOptionCombobox
                        value={tplForm.jobTitle}
                        onChange={(value) =>
                          setTplForm((f) => ({ ...f, jobTitle: value }))
                        }
                        options={jobTitleOptions}
                        placeholder="All positions"
                        searchPlaceholder="Search position…"
                        emptyText="No job titles yet — type via employee records."
                      />
                    </Field>
                    <Field label="Team (optional)" className="sm:col-span-2">
                      <HrOptionCombobox
                        value={tplForm.teamId}
                        onChange={(value) =>
                          setTplForm((f) => ({ ...f, teamId: value }))
                        }
                        options={teamOptions}
                        placeholder="Any team"
                        searchPlaceholder="Search team…"
                        emptyText={
                          tplForm.department
                            ? "No teams in this department."
                            : "Pick a department to narrow teams, or leave any."
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Checklist items">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        className={hrFieldClass}
                        placeholder="Item label"
                        value={tplForm.itemLabel}
                        onChange={(e) =>
                          setTplForm((f) => ({
                            ...f,
                            itemLabel: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          addItem();
                        }}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2">
                          <Switch
                            checked={tplForm.itemRequired}
                            onCheckedChange={(checked) =>
                              setTplForm((f) => ({
                                ...f,
                                itemRequired: Boolean(checked),
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Item required
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          onClick={addItem}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {tplForm.items.length > 0 ? (
                      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/10 p-2.5">
                        {tplForm.items.map((it, i) => (
                          <li
                            key={`${it.label}-${i}`}
                            className="flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              {it.label}
                              {it.required ? (
                                <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                                  required
                                </span>
                              ) : null}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
                              onClick={() =>
                                setTplForm((f) => ({
                                  ...f,
                                  items: f.items.filter((_, idx) => idx !== i),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No items yet — add at least one before saving.
                      </p>
                    )}
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <PendingButton
                      pending={pending}
                      className={cn(hrPrimaryBtnClass, "flex-1")}
                      onClick={async () => {
                        if (!tplForm.items.length) {
                          toast.error("Add at least one item");
                          return;
                        }
                        setPending(true);
                        try {
                          await saveHrChecklistTemplateApi({
                            id: editingId ?? undefined,
                            kind: tplForm.kind,
                            name: tplForm.name.trim() || tplForm.kind,
                            required: tplForm.required,
                            department: tplForm.department,
                            jobTitle: tplForm.jobTitle,
                            teamId: tplForm.teamId
                              ? Number(tplForm.teamId)
                              : null,
                            items: tplForm.items.map((it, i) => ({
                              ...it,
                              sortOrder: i,
                            })),
                          });
                          toast.success(
                            editingId ? "Template updated" : "Template saved",
                          );
                          resetTplForm();
                          await load();
                        } catch (e) {
                          notifyApiFailure(e, "Could not save template");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {editingId ? "Update template" : "Save template"}
                    </PendingButton>
                    {editingId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetTplForm}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </HrFormSection>
            ) : null}

            <HrFormSection
              className="h-full"
              title="Saved templates"
              description={
                canManageTemplates
                  ? "Edit or delete reusable onboarding and exit checklists."
                  : "Available template kinds for starting runs."
              }
            >
              {templates.length === 0 ? (
                <HrEmptyState
                  title="No templates yet"
                  description="Manager can create onboarding and exit templates here."
                />
              ) : (
                <div className="max-h-[min(32rem,70vh)] space-y-2 overflow-y-auto pr-1">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-border/70 bg-background/80 px-3 py-3 transition-colors hover:border-primary/25"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium tracking-tight">
                            {t.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t.items.length} item
                            {t.items.length === 1 ? "" : "s"}
                            {" · "}
                            {scopeLabel(t)}
                            {t.required === false ? " · optional" : " · required"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <HrStatusPill status={t.kind} />
                          {canManageTemplates ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => beginEdit(t)}
                                aria-label="Edit template"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                                onClick={async () => {
                                  try {
                                    await deleteHrChecklistTemplateApi(t.id);
                                    toast.success("Template deleted");
                                    if (editingId === t.id) resetTplForm();
                                    await load();
                                  } catch (e) {
                                    notifyApiFailure(e, "Delete failed");
                                  }
                                }}
                                aria-label="Delete template"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {t.items.length > 0 ? (
                        <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
                          {t.items.slice(0, 4).map((it, i) => (
                            <li
                              key={`${t.id}-${i}`}
                              className="truncate text-xs text-muted-foreground"
                            >
                              • {it.label}
                              {it.required ? " (required)" : ""}
                            </li>
                          ))}
                          {t.items.length > 4 ? (
                            <li className="text-xs text-muted-foreground">
                              +{t.items.length - 4} more
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </HrFormSection>
          </div>
        </HrSectionCard>

        <HrSectionCard
          title="Checklist runs"
          description={
            canRunChecklists
              ? "Start runs, tick items, and complete. Exit runs then wait for Manager approval."
              : canApproveExit
                ? "View runs and approve or reject exit checklists awaiting Manager."
                : "Checklist runs for this property."
          }
          icon={<CheckSquare className="h-5 w-5" />}
        >
          {canApproveExit && !canRunChecklists ? (
            <HrRequestDataTable
              data={runs}
              employees={employees}
              getEmployeeId={(row) => row.employeeId}
              enableEmployeeFilter
              searchColumnId="employee"
              searchPlaceholder="Search checklist runs…"
              emptyTitle="No checklist runs"
              emptyDescription="When HR starts and completes runs, they appear here for approval."
              columns={managerRunColumns}
            />
          ) : (
            <div
              className={cn(
                "grid items-stretch gap-4",
                canRunChecklists ? "lg:grid-cols-2" : "grid-cols-1",
              )}
            >
              {canRunChecklists ? (
                <HrFormSection
                  className="h-full"
                  title="Start run"
                  description="Pick employees and kind. The matching template for each employee’s department, position, and team is used automatically."
                >
                  <div className="space-y-4">
                    <Field label="Employees">
                      <HrEmployeeCombobox
                        multiple
                        employees={employees}
                        valueIds={startForm.employeeIds}
                        onChange={(ids) =>
                          setStartForm((f) => ({ ...f, employeeIds: ids }))
                        }
                      />
                    </Field>
                    <Field label="Kind">
                      <HrOptionCombobox
                        value={startForm.kind}
                        onChange={(value) =>
                          setStartForm((f) => ({ ...f, kind: value }))
                        }
                        options={KIND_OPTIONS}
                        placeholder="Select kind"
                        searchPlaceholder="Search kind…"
                      />
                    </Field>
                    <PendingButton
                      pending={pending}
                      className={cn(hrPrimaryBtnClass, "w-full")}
                      onClick={async () => {
                        if (startForm.employeeIds.length === 0) {
                          toast.error("Select at least one employee");
                          return;
                        }
                        setPending(true);
                        try {
                          await Promise.all(
                            startForm.employeeIds.map((employeeId) =>
                              startHrChecklistRunApi(
                                employeeId,
                                startForm.kind,
                              ),
                            ),
                          );
                          toast.success(
                            startForm.employeeIds.length === 1
                              ? "Checklist started"
                              : `Started ${startForm.employeeIds.length} checklist runs`,
                          );
                          setStartForm({
                            employeeIds: [],
                            kind: "onboarding",
                          });
                          await load();
                        } catch (e) {
                          notifyApiFailure(e, "Could not start checklist");
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Start run
                      {startForm.employeeIds.length > 1
                        ? ` (${startForm.employeeIds.length})`
                        : ""}
                    </PendingButton>
                  </div>
                </HrFormSection>
              ) : null}

              <HrFormSection
                className="h-full"
                title="Active & recent runs"
                description={
                  canRunChecklists
                    ? "Tick items and complete the run."
                    : "Recent checklist runs."
                }
              >
                {runs.length === 0 ? (
                  <HrEmptyState
                    title="No checklist runs"
                    description={
                      canRunChecklists
                        ? "Start an onboarding or exit run from the form on the left."
                        : "No runs yet."
                    }
                  />
                ) : (
                  <div className="max-h-[min(36rem,75vh)] space-y-3 overflow-y-auto pr-1">
                    {runs.map((run) => {
                      const doneCount = run.items.filter((i) => i.done).length;
                      return (
                        <div
                          key={run.id}
                          className="rounded-xl border border-border/70 bg-background/80 p-3"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium tracking-tight">
                                  {empName(run.employeeId)}
                                </p>
                                <HrStatusPill status={run.status} />
                              </div>
                              <p className="text-xs capitalize text-muted-foreground">
                                {run.kind} · {doneCount}/{run.items.length}{" "}
                                items
                              </p>
                            </div>
                            {canRunChecklists && run.status === "open" ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await completeHrChecklistRunApi(run.id);
                                    toast.success("Run completed");
                                    await load();
                                  } catch (e) {
                                    notifyApiFailure(e, "Complete failed");
                                  }
                                }}
                              >
                                Complete
                              </Button>
                            ) : null}
                            {canApproveExit &&
                            canRunChecklists &&
                            run.status === "awaiting_manager" ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await approveHrChecklistRunApi(
                                        run.id,
                                        true,
                                      );
                                      toast.success("Exit approved");
                                      await load();
                                    } catch (e) {
                                      notifyApiFailure(e, "Approve failed");
                                    }
                                  }}
                                >
                                  Approve exit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await approveHrChecklistRunApi(
                                        run.id,
                                        false,
                                      );
                                      toast.message("Returned to open");
                                      await load();
                                    } catch (e) {
                                      notifyApiFailure(e, "Reject failed");
                                    }
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          <div className="space-y-2 border-t border-border/50 pt-2">
                            {run.items.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={item.done}
                                  disabled={
                                    !canRunChecklists || run.status !== "open"
                                  }
                                  onCheckedChange={async (checked) => {
                                    try {
                                      await toggleHrChecklistRunItemApi({
                                        id: item.id,
                                        done: Boolean(checked),
                                      });
                                      await load();
                                    } catch (e) {
                                      notifyApiFailure(
                                        e,
                                        "Could not update item",
                                      );
                                    }
                                  }}
                                />
                                <span className="min-w-0 flex-1">
                                  {item.label}
                                </span>
                                {item.required ? (
                                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                                    required
                                  </span>
                                ) : null}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </HrFormSection>
            </div>
          )}
        </HrSectionCard>

        {canApproveExit ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            Manager approves or rejects exit runs after HR completes required
            items. Managers cannot start or complete runs.
          </p>
        ) : null}
      </div>
    </HrPanelShell>
  );
}
