"use client";

// People ops: employee lifecycle events (promotion / transfer / termination /
// disciplinary). HR raises them as PENDING; the Manager queue decides, and an
// approved promotion/transfer/termination is applied to the employee record.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  hrExt,
  PEOPLE_EVENT_KINDS,
  PEOPLE_EVENT_LABELS,
  type HrPeopleEvent,
  type PeopleEventKind,
} from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill } from "@/components/volo/kit";
import { Field, PersonPicker, RowCard, Select, toneForStatus, useRunner, type SectionProps } from "./ui";

const KIND_TONE: Record<string, string> = {
  promotion: "emerald",
  transfer: "sky",
  termination: "rose",
  disciplinary: "amber",
  other: "slate",
};

const EMPTY = {
  employee: "",
  kind: "promotion",
  detail: "",
  to_department: "",
  to_title: "",
  effective_ymd: new Date().toISOString().slice(0, 10),
};

export default function PeopleSection({ people, departments, reload }: SectionProps) {
  const [events, setEvents] = useState<HrPeopleEvent[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    const rows = await hrExt.peopleEvents(filter ? { status: filter } : {});
    setEvents(rows.data);
  }, [filter]);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  const showTargetDepartment = form.kind === "transfer";
  const showTargetTitle = form.kind === "promotion";

  function save() {
    return run(async () => {
      if (!form.employee) throw new Error("Pick an employee");
      await hrExt.createPeopleEvent({
        employee: Number(form.employee),
        kind: form.kind,
        detail: form.detail,
        to_department: showTargetDepartment && form.to_department ? Number(form.to_department) : null,
        to_title: showTargetTitle ? form.to_title : "",
        effective_ymd: form.effective_ymd,
      });
      setForm({ ...form, detail: "", to_title: "" });
    }, "Event raised — it waits for the manager.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel title="Raise a people event" description="Approvals apply the change to the employee record.">
        <div className="space-y-3">
          <Field label="Employee">
            <PersonPicker value={form.employee} onChange={(employee) => setForm({ ...form, employee })} rows={people} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <Select
                value={form.kind}
                onChange={(kind) => setForm({ ...form, kind })}
                options={PEOPLE_EVENT_KINDS.map((kind) => ({ value: kind, label: PEOPLE_EVENT_LABELS[kind] }))}
              />
            </Field>
            <Field label="Effective on">
              <Input
                type="date"
                value={form.effective_ymd}
                onChange={(e) => setForm({ ...form, effective_ymd: e.target.value })}
              />
            </Field>
            {showTargetDepartment && (
              <Field label="To department">
                <Select
                  value={form.to_department}
                  onChange={(to_department) => setForm({ ...form, to_department })}
                  placeholder="Keep current department"
                  allowEmpty
                  options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
                />
              </Field>
            )}
            {showTargetTitle && (
              <Field label="To job title">
                <Input value={form.to_title} onChange={(e) => setForm({ ...form, to_title: e.target.value })} />
              </Field>
            )}
          </div>
          <Field label="Detail">
            <Input
              value={form.detail}
              placeholder="why / conditions / notes"
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
            />
          </Field>
          <Button className="w-full" disabled={busy} onClick={save}>
            <Plus className="size-3.5" /> Raise event
          </Button>
        </div>
      </Panel>

      <Panel
        title="People events"
        description="PENDING events are decided in the Manager approval queue."
        actions={
          <Select
            value={filter}
            onChange={setFilter}
            placeholder="All statuses"
            allowEmpty
            className="h-8 w-40"
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
        }
      >
        <div className="space-y-2">
          {events.map((row) => (
            <RowCard key={row.id}>
              <div className="min-w-0">
                <p className="text-sm text-zinc-100">
                  {row.employee_name}
                  <span
                    className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      KIND_TONE[row.kind] === "emerald"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        : KIND_TONE[row.kind] === "sky"
                          ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
                          : KIND_TONE[row.kind] === "rose"
                            ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
                            : KIND_TONE[row.kind] === "amber"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                              : "border-white/15 bg-white/5 text-zinc-300"
                    }`}
                  >
                    {PEOPLE_EVENT_LABELS[row.kind as PeopleEventKind] ?? row.kind}
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  {row.from_department_label || row.from_title
                    ? `${row.from_title || "—"} · ${row.from_department_label || "no department"}`
                    : "no snapshot"}
                  {" → "}
                  {row.to_title || row.to_department_label
                    ? `${row.to_title || row.from_title || "—"} · ${row.to_department_label || row.from_department_label || "no department"}`
                    : "unchanged"}
                  {row.effective_ymd ? ` · effective ${row.effective_ymd}` : ""}
                </p>
                {row.detail && <p className="mt-0.5 text-xs text-zinc-500">{row.detail}</p>}
                {row.decided_by && (
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    decided by {row.decided_by}
                    {row.decision_note ? ` · ${row.decision_note}` : ""}
                  </p>
                )}
              </div>
              <StatusPill status={row.status} tone={toneForStatus(row.status)} />
            </RowCard>
          ))}
          {!events.length && <EmptyRow>No people events yet.</EmptyRow>}
        </div>
      </Panel>
    </div>
  );
}
