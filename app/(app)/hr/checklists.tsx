/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Checklists: per-employee runs of the Manager-owned checklist templates. HR
// ticks items and completes the run; the Manager queue holds the final
// approval decision.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HrDepartment } from "@/lib/api";
import { hrExt, type HrChecklistRun, type HrChecklistTemplate } from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill } from "@/components/volo/kit";
import {
  Field,
  IconButton,
  PersonPicker,
  RowCard,
  Select,
  SubTabs,
  Switch,
  toneForStatus,
  useRunner,
  type SectionProps,
} from "./ui";

const KIND_LABELS: Record<string, string> = { onboarding: "Onboarding", exit: "Exit", custom: "Custom" };

const EMPTY_TEMPLATE = {
  name: "",
  kind: "onboarding",
  department: "",
  job_title: "",
  active: true,
  items: [{ label: "", required: true, owner_role: "" }],
};

const EMPTY_RUN = { employee: "", template: "" };

export default function ChecklistsSection({ people, reload }: SectionProps) {
  const [tab, setTab] = useState("runs");

  // ---- templates (the catalogue is managed by the Manager; HR reads it to start runs)
  const [templates, setTemplates] = useState<HrChecklistTemplate[]>([]);

  // ---- runs
  const [runs, setRuns] = useState<HrChecklistRun[]>([]);
  const [runForm, setRunForm] = useState(EMPTY_RUN);
  const [openRun, setOpenRun] = useState<HrChecklistRun | null>(null);

  const load = useCallback(async () => {
    const [templateRows, runRows] = await Promise.all([
      hrExt.checklistTemplates(),
      hrExt.checklistRuns(),
    ]);
    setTemplates(templateRows.data);
    setRuns(runRows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  async function loadRun(id: number) {
    const detail = await hrExt.checklistRun(id);
    setOpenRun(detail.data);
    return detail.data;
  }

  function startRun() {
    return run(async () => {
      if (!runForm.employee) throw new Error("Pick an employee");
      if (!runForm.template) throw new Error("Pick a checklist template");
      const created = await hrExt.createChecklistRun({
        employee: Number(runForm.employee),
        template: Number(runForm.template),
      });
      setRunForm(EMPTY_RUN);
      await loadRun(created.data.id);
      setTab("runs");
    }, "Checklist run started.");
  }

  function toggleItem(item: { id: number; done: boolean; note: string }) {
    if (!openRun) return;
    const runId = openRun.id;
    run(async () => {
      await hrExt.toggleRunItem(runId, item.id, { done: !item.done });
      await loadRun(runId);
    }, item.done ? "Item reopened." : "Item ticked off.");
  }

  function saveNote(itemId: number, note: string) {
    if (!openRun) return;
    const runId = openRun.id;
    const current = openRun.items.find((item) => item.id === itemId);
    run(async () => {
      await hrExt.toggleRunItem(runId, itemId, { done: current?.done ?? false, note });
      await loadRun(runId);
    }, "Note saved.");
  }

  const activeTemplates = templates.filter((row) => row.active);
  const requiredOpen = openRun?.items.filter((item) => item.required && !item.done).length ?? 0;

  return (
    <>
      <SubTabs
        value={tab}
        onChange={setTab}
        items={[
          ["runs", "Runs"],
        ]}
      />

      {tab === "runs" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <Panel title="Start a run" description="Items are copied from the template at start time.">
              <div className="space-y-3">
                <Field label="Employee">
                  <PersonPicker
                    value={runForm.employee}
                    onChange={(employee) => setRunForm({ ...runForm, employee })}
                    rows={people}
                  />
                </Field>
                <Field label="Template">
                  <Select
                    value={runForm.template}
                    onChange={(templateId) => setRunForm({ ...runForm, template: templateId })}
                    placeholder="Select template"
                    options={activeTemplates.map((row) => ({
                      value: String(row.id),
                      label: `${row.name} (${KIND_LABELS[row.kind] ?? row.kind})`,
                    }))}
                  />
                </Field>
                <Button className="w-full" disabled={busy} onClick={startRun}>
                  <Plus className="size-3.5" /> Start checklist run
                </Button>
              </div>
            </Panel>

            {openRun && (
              <Panel
                title={`Run · ${openRun.employee_name}`}
                description={`${KIND_LABELS[openRun.kind] ?? openRun.kind} checklist started by ${openRun.created_by || "HR"}.`}
                actions={<StatusPill status={openRun.status} tone={toneForStatus(openRun.status)} />}
              >
                <div className="space-y-2">
                  {openRun.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 transition hover:border-white/20"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          disabled={openRun.status !== "OPEN" || busy}
                          onClick={() => toggleItem(item)}
                          className={`flex min-w-0 items-center gap-2 text-left text-sm transition disabled:opacity-60 ${
                            item.done ? "text-emerald-300" : "text-zinc-200 hover:text-white"
                          }`}
                        >
                          <span
                            className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                              item.done
                                ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300"
                                : "border-white/20 text-transparent hover:border-white/40"
                            }`}
                          >
                            <Check className="size-3" />
                          </span>
                          <span className={item.done ? "line-through decoration-emerald-400/40" : ""}>{item.label}</span>
                        </button>
                        <span className="flex items-center gap-2">
                          {item.required && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                              required
                            </span>
                          )}
                          {item.owner_role && (
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">
                              {item.owner_role}
                            </span>
                          )}
                        </span>
                      </div>
                      {item.done && (
                        <p className="mt-1 pl-7 text-[11px] text-zinc-500">
                          done by {item.completed_by || "—"}
                          {item.completed_at ? ` · ${String(item.completed_at).slice(0, 16).replace("T", " ")}` : ""}
                        </p>
                      )}
                      <Input
                        key={`note-${item.id}`}
                        defaultValue={item.note}
                        placeholder="Note (optional)"
                        disabled={openRun.status !== "OPEN"}
                        className="mt-2 h-8 text-xs"
                        onBlur={(e) => {
                          if (e.target.value !== item.note) saveNote(item.id, e.target.value);
                        }}
                      />
                    </div>
                  ))}
                  {!openRun.items.length && <EmptyRow>This template had no items.</EmptyRow>}
                  {openRun.status === "OPEN" ? (
                    <>
                      <Button
                        className="mt-2 w-full"
                        disabled={busy || requiredOpen > 0}
                        onClick={() =>
                          run(async () => {
                            const updated = await hrExt.completeRun(openRun.id);
                            setOpenRun(updated.data);
                          }, "Checklist completed — waiting on the manager.")
                        }
                      >
                        <Check className="size-3.5" /> Complete run
                      </Button>
                      {requiredOpen > 0 && (
                        <p className="text-center text-xs text-amber-300/80">
                          {requiredOpen} required item(s) still open.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="pt-1 text-center text-xs text-zinc-500">
                      {openRun.status === "COMPLETED"
                        ? "Completed — awaiting the manager's decision in the approval queue."
                        : `Decided by ${openRun.decided_by || "manager"}.`}
                    </p>
                  )}
                </div>
              </Panel>
            )}
          </div>

          <Panel title="Checklist runs" description="Open a run to tick items and add notes.">
            <div className="space-y-2">
              {runs.map((row) => {
                const done = row.items.filter((item) => item.done).length;
                return (
                  <RowCard key={row.id}>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-100">
                        {row.employee_name}
                        <span className="ml-2 text-[11px] text-zinc-500">
                          {KIND_LABELS[row.kind] ?? row.kind} · started {String(row.created_at).slice(0, 10)}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {done}/{row.items.length} items done
                        {row.decided_by ? ` · decided by ${row.decided_by}` : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <StatusPill status={row.status} tone={toneForStatus(row.status)} />
                      <IconButton
                        title="Open run"
                        tone="sky"
                        onClick={() => {
                          loadRun(row.id).catch((error) => toast.error(error.message));
                        }}
                      >
                        <Eye className="size-3.5" />
                      </IconButton>
                    </span>
                  </RowCard>
                );
              })}
              {!runs.length && <EmptyRow>No checklist runs yet.</EmptyRow>}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

// Manager-owned: the checklist-template catalogue copied into every new run.
export function ChecklistTemplatesSection({
  departments,
  reload,
}: {
  departments: HrDepartment[];
  reload?: () => Promise<unknown>;
}) {
  const [templates, setTemplates] = useState<HrChecklistTemplate[]>([]);
  const [template, setTemplate] = useState(EMPTY_TEMPLATE);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.checklistTemplates();
    setTemplates(rows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await load();
    if (reload) await reload();
  });

  function resetTemplate() {
    setTemplate(EMPTY_TEMPLATE);
    setEditing(null);
  }

  function startEditTemplate(row: HrChecklistTemplate) {
    setEditing(row.id);
    setTemplate({
      name: row.name,
      kind: row.kind,
      department: row.department ? String(row.department) : "",
      job_title: row.job_title ?? "",
      active: row.active,
      items: row.items.length
        ? row.items.map((item) => ({ label: item.label, required: item.required, owner_role: item.owner_role }))
        : [{ label: "", required: true, owner_role: "" }],
    });
  }

  function saveTemplate() {
    return run(async () => {
      if (!template.name.trim()) throw new Error("Template name is required");
      const items = template.items
        .filter((item) => item.label.trim())
        .map((item, index) => ({ ...item, sort_order: index }));
      if (!items.length) throw new Error("Add at least one item");
      const payload = {
        kind: template.kind,
        name: template.name.trim(),
        department: template.department ? Number(template.department) : null,
        job_title: template.job_title,
        active: template.active,
        items,
      };
      if (editing) await hrExt.updateChecklistTemplate(editing, payload);
      else await hrExt.createChecklistTemplate(payload);
      resetTemplate();
    }, editing ? "Checklist template updated." : "Checklist template created.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel
        title={editing ? "Edit template" : "New template"}
        description="Ordered items, each with an optional owner role."
        actions={
          editing ? (
            <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={resetTemplate}>
              Cancel
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={template.name} onChange={(e) => setTemplate({ ...template, name: e.target.value })} />
            </Field>
            <Field label="Kind">
              <Select
                value={template.kind}
                onChange={(kind) => setTemplate({ ...template, kind })}
                options={[
                  { value: "onboarding", label: "Onboarding" },
                  { value: "exit", label: "Exit" },
                ]}
              />
            </Field>
            <Field label="Department (optional)">
              <Select
                value={template.department}
                onChange={(department) => setTemplate({ ...template, department })}
                placeholder="All departments"
                allowEmpty
                options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
              />
            </Field>
            <Field label="Job title (optional)">
              <Input value={template.job_title} onChange={(e) => setTemplate({ ...template, job_title: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Items</p>
            {template.items.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-[1fr_140px_auto]"
              >
                <Input
                  value={item.label}
                  placeholder={`Step ${index + 1}`}
                  onChange={(e) => {
                    const items = [...template.items];
                    items[index] = { ...item, label: e.target.value };
                    setTemplate({ ...template, items });
                  }}
                />
                <Input
                  value={item.owner_role}
                  placeholder="owner role"
                  onChange={(e) => {
                    const items = [...template.items];
                    items[index] = { ...item, owner_role: e.target.value };
                    setTemplate({ ...template, items });
                  }}
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.required}
                    onChange={(required) => {
                      const items = [...template.items];
                      items[index] = { ...item, required };
                      setTemplate({ ...template, items });
                    }}
                    label="Req."
                  />
                  <IconButton
                    title="Remove item"
                    tone="rose"
                    onClick={() =>
                      setTemplate({ ...template, items: template.items.filter((_, i) => i !== index) })
                    }
                  >
                    <X className="size-3.5" />
                  </IconButton>
                </div>
              </div>
            ))}
            {!template.items.length && <EmptyRow>No items yet.</EmptyRow>}
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent"
              onClick={() =>
                setTemplate({
                  ...template,
                  items: [...template.items, { label: "", required: true, owner_role: "" }],
                })
              }
            >
              <Plus className="size-3.5" /> Add item
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Active">
              <Switch
                checked={template.active}
                onChange={(active) => setTemplate({ ...template, active })}
                label="Template is active"
              />
            </Field>
          </div>

          <Button className="w-full" disabled={busy} onClick={saveTemplate}>
            {editing ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            {editing ? "Save template" : "Create template"}
          </Button>
        </div>
      </Panel>

      <Panel title="Checklist templates" description="Copied item-by-item into each new run.">
        <div className="space-y-2">
          {templates.map((row) => (
            <RowCard key={row.id}>
              <div className="min-w-0">
                <p className="text-sm text-zinc-100">
                  {row.name}
                  <span className="ml-2 text-[11px] text-zinc-500">
                    {KIND_LABELS[row.kind] ?? row.kind}
                    {row.department_label ? ` · ${row.department_label}` : ""}
                    {row.job_title ? ` · ${row.job_title}` : ""}
                  </span>
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {row.items.length} item(s): {row.items.map((item) => item.label).join(" · ") || "—"}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill status={row.active ? "ACTIVE" : "INACTIVE"} tone={row.active ? "emerald" : "slate"} />
                <IconButton title="Edit" tone="amber" onClick={() => startEditTemplate(row)}>
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  title="Delete"
                  tone="rose"
                  onClick={() => {
                    if (!window.confirm(`Delete template "${row.name}"?`)) return;
                    run(() => hrExt.deleteChecklistTemplate(row.id), "Template deleted.");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </span>
            </RowCard>
          ))}
          {!templates.length && <EmptyRow>No checklist templates yet.</EmptyRow>}
        </div>
      </Panel>
    </div>
  );
}
