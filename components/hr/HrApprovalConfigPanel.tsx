"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Clock,
  FileText,
  GitBranch,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  HrPanelShell,
  HrSectionCard,
  HrEmptyState,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { notifyApiFailure } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  deleteHrApprovalFlowApi,
  deleteHrTeamApi,
  fetchHrApprovalFlowsApi,
  fetchHrDepartments,
  fetchHrTeamsApi,
  upsertHrApprovalFlowApi,
  upsertHrTeamApi,
  type HrApprovalFlow,
  type HrDepartment,
  type HrTeam,
} from "@/lib/api/hrSource";

const STEP_OPTIONS = [
  {
    kind: "team_leader",
    label: "Team leader",
    hint: "Leader on the requester’s team",
    icon: Users,
  },
  {
    kind: "department_leader",
    label: "Department leader",
    hint: "Leader in the same department",
    icon: Building2,
  },
  {
    kind: "hr",
    label: "HR Manager",
    hint: "Desk role HR",
    icon: UserRound,
  },
  {
    kind: "manager",
    label: "Manager",
    hint: "Desk role Manager",
    icon: Shield,
  },
  {
    kind: "admin",
    label: "Admin",
    hint: "Desk role Admin",
    icon: Shield,
  },
] as const;

/** Stored on `hr_approval_flow.requestType`. Leave is runtime-backed; others are config-ready. */
export const HR_APPROVAL_REQUEST_TYPES = [
  {
    value: "leave",
    label: "Leave",
    hint: "Time-off requests",
    icon: CalendarDays,
  },
  {
    value: "overtime",
    label: "Overtime",
    hint: "Extra hours",
    icon: Clock,
  },
  {
    value: "document",
    label: "Documents",
    hint: "File uploads",
    icon: FileText,
  },
  {
    value: "incident",
    label: "Incidents",
    hint: "Incident reports",
    icon: AlertTriangle,
  },
  {
    value: "schedule_change",
    label: "Schedule / shift",
    hint: "Shift changes",
    icon: CalendarClock,
  },
  {
    value: "timesheet",
    label: "Timesheet",
    hint: "Attendance corrections",
    icon: ClipboardList,
  },
] as const;

function stepLabel(kind: string): string {
  return STEP_OPTIONS.find((o) => o.kind === kind)?.label || kind;
}

function defaultStepsForType(): { kind: string }[] {
  return [{ kind: "department_leader" }, { kind: "manager" }];
}

function resetEditorState() {
  return {
    editingFlowId: null as number | null,
    flowDeptId: "default",
    requireTeam: true,
    steps: defaultStepsForType(),
  };
}

function FieldShell({
  label,
  icon,
  hint,
  children,
  className,
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </Label>
        {hint ? (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type ComboboxOption = { value: string; label: string; hint?: string };

/** Searchable combobox — same interaction pattern as hotel store item name. */
function OptionCombobox({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyText = "No matches.",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
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
          className={cn(
            "h-10 w-full min-w-0 justify-between font-normal",
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

function flowChainLabel(f: HrApprovalFlow): string {
  const steps = (Array.isArray(f.stepsJson) ? f.stepsJson : [])
    .map((s: { kind?: string } | string) =>
      typeof s === "string" ? s : s?.kind,
    )
    .filter(Boolean)
    .map((k) => stepLabel(String(k)));
  const base = steps.join(" → ") || "No steps";
  return f.requireTeamLeaderFirst
    ? `${base} · team leader first when on a team`
    : base;
}

type TeamDraftLine = {
  key: string;
  departmentId: string;
  code: string;
  label: string;
};

function emptyTeamLine(): TeamDraftLine {
  return {
    key: `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    departmentId: "",
    code: "",
    label: "",
  };
}

export function HrApprovalConfigPanel() {
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [flows, setFlows] = useState<HrApprovalFlow[]>([]);
  const [requestType, setRequestType] = useState<string>("leave");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teamLines, setTeamLines] = useState<TeamDraftLine[]>(() => [
    emptyTeamLine(),
  ]);
  const [savingTeam, setSavingTeam] = useState(false);

  const [flowDeptId, setFlowDeptId] = useState("default");
  const [requireTeam, setRequireTeam] = useState(true);
  const [steps, setSteps] = useState<{ kind: string }[]>(defaultStepsForType);
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
  const [flowPendingDelete, setFlowPendingDelete] =
    useState<HrApprovalFlow | null>(null);
  const [teamPendingDelete, setTeamPendingDelete] = useState<HrTeam | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deps, tms, fl] = await Promise.all([
        fetchHrDepartments(),
        fetchHrTeamsApi(),
        fetchHrApprovalFlowsApi(requestType),
      ]);
      setDepartments(deps);
      setTeams(tms);
      setFlows(fl);
    } catch (e) {
      notifyApiFailure(e, "Could not load workflow config");
    } finally {
      setLoading(false);
    }
  }, [requestType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    window.addEventListener("hotcol-hr-refresh", onRefresh);
    return () => window.removeEventListener("hotcol-hr-refresh", onRefresh);
  }, [load]);

  const clearEditor = () => {
    const reset = resetEditorState();
    setEditingFlowId(reset.editingFlowId);
    setFlowDeptId(reset.flowDeptId);
    setRequireTeam(reset.requireTeam);
    setSteps(reset.steps);
  };

  const selectRequestType = (next: string) => {
    if (next === requestType) return;
    setRequestType(next);
    clearEditor();
  };

  const flowsForType = useMemo(
    () => flows.filter((f) => f.requestType === requestType),
    [flows, requestType],
  );

  const requestTypeMeta =
    HR_APPROVAL_REQUEST_TYPES.find((t) => t.value === requestType) ??
    HR_APPROVAL_REQUEST_TYPES[0]!;

  const overrideCount = flowsForType.filter((f) => f.departmentId != null).length;
  const hasDefault = flowsForType.some((f) => f.departmentId == null);

  const previewChain = useMemo(() => {
    const labels = steps.map((s) => stepLabel(s.kind));
    if (requireTeam && !steps.some((s) => s.kind === "team_leader")) {
      return `Team leader → ${labels.join(" → ") || "…"}`;
    }
    return labels.join(" → ") || "Add at least one step";
  }, [steps, requireTeam]);

  const scopeOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "default", label: "Tenant default", hint: "All departments" },
      ...departments.map((d) => ({
        value: String(d.id),
        label: d.label,
        hint: d.code || undefined,
      })),
    ],
    [departments],
  );

  const departmentOptions = useMemo<ComboboxOption[]>(
    () =>
      departments.map((d) => ({
        value: String(d.id),
        label: d.label,
        hint: d.code || undefined,
      })),
    [departments],
  );

  const validTeamLines = useMemo(
    () =>
      teamLines.filter(
        (l) => l.departmentId && l.code.trim() && l.label.trim(),
      ),
    [teamLines],
  );

  const updateTeamLine = (
    key: string,
    patch: Partial<Omit<TeamDraftLine, "key">>,
  ) => {
    setTeamLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const addTeamLine = () => {
    setTeamLines((prev) => [...prev, emptyTeamLine()]);
  };

  const removeTeamLine = (key: string) => {
    setTeamLines((prev) =>
      prev.length <= 1 ? [emptyTeamLine()] : prev.filter((l) => l.key !== key),
    );
  };

  const addStep = (kind: string) => {
    setSteps((prev) => [...prev, { kind }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx]!;
      next[idx] = next[j]!;
      next[j] = tmp;
      return next;
    });
  };

  const saveFlow = async () => {
    if (steps.length === 0) {
      toast.info("Add at least one approval step");
      return;
    }
    setSaving(true);
    try {
      await upsertHrApprovalFlowApi({
        id: editingFlowId ?? undefined,
        requestType,
        departmentId: flowDeptId === "default" ? null : Number(flowDeptId),
        requireTeamLeaderFirst: requireTeam,
        stepsJson: steps,
        active: true,
      });
      toast.success(editingFlowId ? "Flow updated" : "Flow saved");
      clearEditor();
      await load();
    } catch (e) {
      notifyApiFailure(e, "Could not save flow");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (f: HrApprovalFlow) => {
    setEditingFlowId(f.id);
    setFlowDeptId(f.departmentId != null ? String(f.departmentId) : "default");
    setRequireTeam(Boolean(f.requireTeamLeaderFirst));
    const raw = Array.isArray(f.stepsJson) ? f.stepsJson : [];
    setSteps(
      raw
        .map((s: { kind?: string } | string) =>
          typeof s === "string" ? { kind: s } : { kind: String(s?.kind || "") },
        )
        .filter((s) => s.kind),
    );
  };

  const RequestIcon = requestTypeMeta.icon;

  return (
    <HrPanelShell>
      <HrSectionCard
        title="Approval workflows"
        description="Pick a request type, then set the tenant default chain and optional department overrides. Café defaults apply when nothing is saved here."
        icon={
          <GitBranch className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        }
        accent="bg-linear-to-r from-violet-500 via-violet-400 to-primary/70"
      >
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Saved flows
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {flowsForType.length}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
              Tenant default
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight">
              {hasDefault ? "Yes" : "—"}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-300/80">
              Dept overrides
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {overrideCount}
            </p>
          </div>
        </div>

        <div className="mb-6 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Request type
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {HR_APPROVAL_REQUEST_TYPES.map((t) => {
              const Icon = t.icon;
              const on = requestType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => selectRequestType(t.value)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                    on
                      ? "border-violet-500/30 bg-violet-500/8 ring-1 ring-violet-400/20"
                      : "border-border/50 bg-background/60 hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      on
                        ? "bg-violet-500/12 text-violet-700 dark:text-violet-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold">{t.label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {t.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)]">
          <div className="order-2 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/12 text-violet-700 dark:text-violet-300">
                  <RequestIcon className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold tracking-tight">
                    {requestTypeMeta.label} flows
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Saved chains for this request type
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {flowsForType.length}
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/15 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading flows…
              </div>
            ) : flowsForType.length === 0 ? (
              <HrEmptyState
                title={`No ${requestTypeMeta.label.toLowerCase()} flows yet`}
                description="Save a tenant default or a department override in the editor."
                icon={<GitBranch className="h-7 w-7" />}
              />
            ) : (
              <ScrollArea className="h-[min(42vh,420px)]">
                <ul className="space-y-2.5 pr-3">
                  {flowsForType.map((f) => {
                    const scopeLabel =
                      f.departmentId == null
                        ? "Tenant default"
                        : departments.find((d) => d.id === f.departmentId)
                            ?.label || `Dept #${f.departmentId}`;
                    const editing = editingFlowId === f.id;
                    return (
                      <li
                        key={f.id}
                        className={cn(
                          "overflow-hidden rounded-2xl border bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5",
                          editing
                            ? "border-violet-500/40 ring-violet-400/20"
                            : "border-border/70",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 p-3.5 sm:p-4">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold tracking-tight">
                                {scopeLabel}
                              </p>
                              {f.departmentId == null ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  Default
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Override
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {flowChainLabel(f)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              size="sm"
                              variant={editing ? "default" : "outline"}
                              onClick={() => startEdit(f)}
                            >
                              {editing ? "Editing" : "Edit"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-rose-600"
                              aria-label={`Delete ${scopeLabel} flow`}
                              onClick={() => setFlowPendingDelete(f)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>

          <div className="order-1 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-700 dark:text-violet-300">
                <GitBranch className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight">
                  {editingFlowId
                    ? `Edit ${requestTypeMeta.label} flow`
                    : `New ${requestTypeMeta.label} flow`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Scope, team-leader rule, then ordered steps
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <FieldShell
                label="Scope"
                icon={<Building2 className="size-3" />}
                hint="Who this chain applies to"
              >
                <OptionCombobox
                  value={flowDeptId}
                  onChange={setFlowDeptId}
                  options={scopeOptions}
                  placeholder="Search scope…"
                  emptyText="No scope matches."
                />
              </FieldShell>

              <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Team leader first
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    When the employee is on a team
                  </p>
                </div>
                <Switch
                  checked={requireTeam}
                  onCheckedChange={setRequireTeam}
                />
              </div>

              <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/80 dark:text-violet-300/80">
                  Preview
                </p>
                <p className="mt-1 text-sm font-medium leading-snug tracking-tight">
                  {previewChain}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Approval steps
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {steps.length} step{steps.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {steps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-3 py-6 text-center text-xs text-muted-foreground">
                    Add steps below to build the chain.
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {steps.map((s, i) => {
                      const meta = STEP_OPTIONS.find((o) => o.kind === s.kind);
                      const StepIcon = meta?.icon ?? GitBranch;
                      return (
                        <li
                          key={`${s.kind}-${i}`}
                          className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background px-3 py-2.5 shadow-sm"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-800 dark:text-violet-300">
                            {i + 1}
                          </span>
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <StepIcon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {stepLabel(s.kind)}
                            </p>
                            {meta?.hint ? (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {meta.hint}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={i === 0}
                              aria-label="Move step up"
                              onClick={() => moveStep(i, -1)}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={i === steps.length - 1}
                              aria-label="Move step down"
                              onClick={() => moveStep(i, 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                              aria-label="Remove step"
                              onClick={() => removeStep(i)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Add step
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {STEP_OPTIONS.map((o) => {
                      const Icon = o.icon;
                      return (
                        <Button
                          key={o.kind}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-auto justify-start gap-2 px-2.5 py-2 text-left font-normal"
                          onClick={() => addStep(o.kind)}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-medium">
                              {o.label}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {o.hint}
                            </span>
                          </span>
                          <Plus className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/50 pt-4">
                <Button
                  type="button"
                  className={cn("w-full", hrPrimaryBtnClass)}
                  disabled={saving || steps.length === 0}
                  onClick={() => void saveFlow()}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GitBranch className="mr-2 h-4 w-4" />
                  )}
                  {editingFlowId ? "Update flow" : "Save flow"}
                </Button>
                {editingFlowId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={clearEditor}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </HrSectionCard>

      <HrSectionCard
        title="Teams"
        description="Optional teams under a department. Team leaders approve when a flow includes Team leader, or when “team leader first” is on."
        icon={
          <UsersRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        }
        accent="bg-linear-to-r from-amber-500 via-orange-400 to-amber-300/80"
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Teams
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {teams.length}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-300/80">
              Departments
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {departments.length}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              With teams
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {new Set(teams.map((t) => t.departmentId)).size}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-300">
                <Plus className="size-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">
                  Add teams
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Batch lines — code is unique within each department
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-3">
                {teamLines.map((line, index) => (
                  <div
                    key={line.key}
                    className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Line {index + 1}
                      </p>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-rose-600"
                        disabled={teamLines.length <= 1}
                        aria-label={`Remove team line ${index + 1}`}
                        onClick={() => removeTeamLine(line.key)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <FieldShell
                      label="Department"
                      icon={<Building2 className="size-3" />}
                    >
                      <OptionCombobox
                        value={line.departmentId}
                        onChange={(v) =>
                          updateTeamLine(line.key, { departmentId: v })
                        }
                        options={departmentOptions}
                        placeholder="Search department…"
                        emptyText="No departments found."
                      />
                    </FieldShell>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldShell label="Code" hint="Short key">
                        <Input
                          value={line.code}
                          onChange={(e) =>
                            updateTeamLine(line.key, { code: e.target.value })
                          }
                          placeholder="e.g. AM"
                          className={hrFieldClass}
                        />
                      </FieldShell>
                      <FieldShell label="Label" hint="Display name">
                        <Input
                          value={line.label}
                          onChange={(e) =>
                            updateTeamLine(line.key, { label: e.target.value })
                          }
                          placeholder="e.g. Morning"
                          className={hrFieldClass}
                        />
                      </FieldShell>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 font-medium"
                onClick={addTeamLine}
              >
                <Plus className="h-4 w-4" />
                Add line
              </Button>

              <Button
                type="button"
                className="w-full"
                disabled={savingTeam || validTeamLines.length === 0}
                onClick={async () => {
                  if (validTeamLines.length === 0) {
                    toast.info("Complete at least one team line");
                    return;
                  }
                  setSavingTeam(true);
                  let ok = 0;
                  let failed = 0;
                  try {
                    for (const line of validTeamLines) {
                      try {
                        await upsertHrTeamApi({
                          departmentId: Number(line.departmentId),
                          code: line.code.trim(),
                          label: line.label.trim(),
                        });
                        ok += 1;
                      } catch {
                        failed += 1;
                      }
                    }
                    setTeamLines([emptyTeamLine()]);
                    await load();
                    if (ok > 0 && failed === 0) {
                      toast.success(
                        ok === 1 ? "Team created" : `${ok} teams created`,
                      );
                    } else if (ok > 0) {
                      toast.warning(`${ok} created, ${failed} failed`);
                    } else {
                      toast.error("Could not create teams");
                    }
                  } finally {
                    setSavingTeam(false);
                  }
                }}
              >
                {savingTeam ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {validTeamLines.length > 1
                  ? `Create ${validTeamLines.length} teams`
                  : "Create team"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-tight">
                Registered teams
              </p>
              <Badge variant="secondary" className="text-[10px]">
                {teams.length}
              </Badge>
            </div>

            {teams.length === 0 ? (
              <HrEmptyState
                title="No teams yet"
                description="Add a team under a department if you want team-leader steps in approval chains."
                icon={<UsersRound className="h-7 w-7" />}
              />
            ) : (
              <ScrollArea className="h-[min(36vh,360px)]">
                <ul className="space-y-2 pr-3">
                  {teams.map((t, index) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-900 dark:text-amber-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {t.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {departments.find((d) => d.id === t.departmentId)
                            ?.label || `Dept #${t.departmentId}`}
                          {t.code ? ` · ${t.code}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-rose-600"
                        aria-label={`Delete team ${t.label}`}
                        onClick={() => setTeamPendingDelete(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </HrSectionCard>

      <AlertDialog
        open={flowPendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setFlowPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this approval flow?</AlertDialogTitle>
            <AlertDialogDescription>
              {flowPendingDelete
                ? `Remove the ${
                    flowPendingDelete.departmentId == null
                      ? "tenant default"
                      : "department override"
                  } chain for ${requestTypeMeta.label.toLowerCase()}. Existing in-progress requests keep their attached flow.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-600/90"
              onClick={async () => {
                if (!flowPendingDelete) return;
                try {
                  await deleteHrApprovalFlowApi(flowPendingDelete.id);
                  if (editingFlowId === flowPendingDelete.id) clearEditor();
                  toast.message("Flow deleted");
                  setFlowPendingDelete(null);
                  await load();
                } catch (e) {
                  notifyApiFailure(e, "Delete failed");
                }
              }}
            >
              Delete flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={teamPendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setTeamPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this team?</AlertDialogTitle>
            <AlertDialogDescription>
              {teamPendingDelete
                ? `Remove “${teamPendingDelete.label}”. Employees still assigned to it should be moved first.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-600/90"
              onClick={async () => {
                if (!teamPendingDelete) return;
                try {
                  await deleteHrTeamApi(teamPendingDelete.id);
                  toast.message("Team deleted");
                  setTeamPendingDelete(null);
                  await load();
                } catch (e) {
                  notifyApiFailure(e, "Delete failed");
                }
              }}
            >
              Delete team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HrPanelShell>
  );
}
