/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Approval-flow configuration per HR request type. POST upserts by
// request_type, so the form's save button is always the same call.
// Manager-owned: HR no longer edits the approval chain.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  GitBranch,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hrExt,
  HR_STEP_KINDS,
  HR_STEP_LABELS,
  type HrStepKind,
  type HrWorkflow,
} from "@/lib/api/hr";
import { Panel, StatCard, StatusPill } from "@/components/volo/kit";
import {
  CHIP_TONES,
  CodeChip,
  EmptyState,
  Field,
  IconButton,
  RowCard,
  Select,
  StatStrip,
  Switch,
  useRunner,
  type HrTone,
  type SectionProps,
} from "./ui";

const REQUEST_TYPES: [string, string][] = [
  ["leave", "Leave request"],
  ["payroll", "Payroll / payslip"],
  ["document", "Document"],
  ["attendance_correction", "Attendance correction"],
  ["people_event", "People event"],
  ["checklist_run", "Checklist run"],
  ["incident", "Incident"],
  ["other", "Other"],
];

const EMPTY = {
  request_type: "leave",
  department: "",
  require_team_leader_first: false,
  steps: ["manager"] as string[],
  active: true,
};

const STEP_TONE: Record<string, HrTone> = {
  team_leader: "sky",
  department_leader: "violet",
  hr: "emerald",
  manager: "amber",
  admin: "rose",
};

export default function WorkflowsSection({ departments, reload }: SectionProps) {
  const [workflows, setWorkflows] = useState<HrWorkflow[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.workflows();
    setWorkflows(rows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  function reset() {
    setForm(EMPTY);
    setEditing(null);
  }

  function startEdit(row: HrWorkflow) {
    setEditing(row.id);
    setForm({
      request_type: row.request_type,
      department: row.department ? String(row.department) : "",
      require_team_leader_first: row.require_team_leader_first,
      steps: row.steps?.length ? row.steps.map((step) => step.kind) : [],
      active: row.active,
    });
  }

  function setStep(index: number, kind: string) {
    const steps = [...form.steps];
    steps[index] = kind;
    setForm({ ...form, steps });
  }

  function moveStep(index: number, delta: number) {
    const steps = [...form.steps];
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    setForm({ ...form, steps });
  }

  function save() {
    return run(async () => {
      const payload = {
        request_type: form.request_type,
        department: form.department ? Number(form.department) : null,
        require_team_leader_first: form.require_team_leader_first,
        steps: form.steps.map((kind) => ({ kind })),
        active: form.active,
      };
      // POST upserts by request_type — always the same call, edit or new.
      await hrExt.saveWorkflow(payload);
      reset();
    }, editing ? "Workflow updated." : "Workflow saved.");
  }

  const labelFor = (type: string) => REQUEST_TYPES.find(([key]) => key === type)?.[1] ?? type;

  const activeFlows = workflows.filter((row) => row.active).length;
  const coveredTypes = new Set(workflows.map((row) => row.request_type)).size;
  const deptFlows = workflows.filter((row) => Boolean(row.department)).length;

  return (
    <div className="space-y-4">
      <StatStrip>
        <StatCard
          label="Approval flows"
          value={String(workflows.length)}
          hint={`${activeFlows} active`}
          tone="sky"
          icon={<Workflow className="size-4" />}
        />
        <StatCard
          label="Request types covered"
          value={`${coveredTypes}/${REQUEST_TYPES.length}`}
          hint="Catalogue mapped to a chain"
          tone="emerald"
          icon={<Layers className="size-4" />}
        />
        <StatCard
          label="Department-specific"
          value={String(deptFlows)}
          hint="Scoped overrides"
          tone="violet"
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Total steps"
          value={String(workflows.reduce((sum, row) => sum + (row.steps?.length ?? 0), 0))}
          hint="Across every active chain"
          tone="amber"
          icon={<GitBranch className="size-4" />}
        />
      </StatStrip>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel
        title={editing ? "Edit workflow" : "New workflow"}
        description="Ordered approval steps; saving upserts by request type."
        actions={
          editing ? (
            <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={reset}>
              Cancel
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Request type">
              <Select
                value={form.request_type}
                onChange={(request_type) => setForm({ ...form, request_type })}
                options={REQUEST_TYPES.map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Department (optional)">
              <Select
                value={form.department}
                onChange={(department) => setForm({ ...form, department })}
                placeholder="All departments"
                allowEmpty
                options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Approval steps</p>
            {form.steps.map((kind, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2"
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold ${
                    CHIP_TONES[STEP_TONE[kind] ?? "slate"]
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-40 flex-1">
                  <Select
                    value={kind}
                    onChange={(next) => setStep(index, next)}
                    options={HR_STEP_KINDS.map((step) => ({ value: step, label: HR_STEP_LABELS[step] }))}
                  />
                </div>
                <IconButton title="Move up" onClick={() => moveStep(index, -1)}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton title="Move down" onClick={() => moveStep(index, 1)}>
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton title="Remove step" tone="rose" onClick={() => setForm({ ...form, steps: form.steps.filter((_, i) => i !== index) })}>
                  <X className="size-3.5" />
                </IconButton>
              </div>
            ))}
            {!form.steps.length && <EmptyRow>No steps — nothing to approve.</EmptyRow>}
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent"
              onClick={() => setForm({ ...form, steps: [...form.steps, "manager"] })}
            >
              <Plus className="size-3.5" /> Add step
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team leader">
              <Switch
                checked={form.require_team_leader_first}
                onChange={(require_team_leader_first) => setForm({ ...form, require_team_leader_first })}
                label="Team leader first"
              />
            </Field>
            <Field label="Active">
              <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Flow is active" />
            </Field>
          </div>

          <Button className="w-full" disabled={busy} onClick={save}>
            {editing ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            {editing ? "Save workflow" : "Create workflow"}
          </Button>
        </div>
      </Panel>

      <Panel title="Approval flows" description="One flow per request type; steps run in order.">
        <div className="space-y-2">
          {workflows.map((row) => (
            <RowCard key={row.id} className="border-sky-400/15 hover:border-sky-400/35">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-sky-400/25 bg-sky-400/10 text-sky-200">
                  <Workflow className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-100">
                    {labelFor(row.request_type)}
                    <CodeChip tone="sky">{row.request_type}</CodeChip>
                    {row.department_label && (
                      <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {row.department_label}
                      </span>
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.steps?.length ? (
                      row.steps.map((step, index) => (
                        <span
                          key={index}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            CHIP_TONES[STEP_TONE[step.kind] ?? "slate"]
                          }`}
                        >
                          {index + 1}. {HR_STEP_LABELS[step.kind as HrStepKind] ?? step.kind}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500">no approval steps</span>
                    )}
                    {row.require_team_leader_first && (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        team leader first
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill status={row.active ? "ACTIVE" : "INACTIVE"} tone={row.active ? "emerald" : "slate"} />
                <IconButton title="Edit" tone="amber" onClick={() => startEdit(row)}>
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  title="Delete"
                  tone="rose"
                  onClick={() => {
                    if (!window.confirm(`Delete the "${row.request_type}" workflow?`)) return;
                    run(() => hrExt.deleteWorkflow(row.id), "Workflow deleted.");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </span>
            </RowCard>
          ))}
          {!workflows.length && (
            <EmptyState
              icon={<Workflow className="size-4" />}
              title="No approval flows configured"
              hint="Create the first flow on the left — each request type gets its own ordered chain."
            />
          )}
        </div>
      </Panel>
      </div>
    </div>
  );
}
