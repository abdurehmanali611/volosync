/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Shift templates: reusable weekday shift patterns assigned to employees and
// stamped onto attendance rows. Weekday ints follow the JS convention 0=Sun..6=Sat.
// The Manager owns the templates; HR only views them on the roster.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrExt, type HrShiftTemplate } from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill, Td, Th } from "@/components/volo/kit";
import { Field, IconButton, Select, Switch, useRunner, type SectionProps } from "./ui";

// Mon-first display order; stored values keep the 0=Sun..6=Sat convention.
const WEEKDAYS: [string, number][] = [
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
  ["Sun", 0],
];

const EMPTY = {
  code: "",
  name: "",
  start_time: "09:00",
  end_time: "17:00",
  weekdays: [1, 2, 3, 4, 5] as number[],
  department: "",
  note: "",
  active: true,
};

const dayLabel = (weekdays: number[]) =>
  weekdays.length ? WEEKDAYS.filter(([, value]) => weekdays.includes(value)).map(([label]) => label).join(", ") : "—";

export default function ShiftsSection({
  departments,
  reload,
  canManage = true,
}: SectionProps & { canManage?: boolean }) {
  const [shifts, setShifts] = useState<HrShiftTemplate[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.shiftTemplates();
    setShifts(rows.data);
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

  function startEdit(row: HrShiftTemplate) {
    setEditing(row.id);
    setForm({
      code: row.code,
      name: row.name,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
      weekdays: row.weekdays ?? [],
      department: row.department ? String(row.department) : "",
      note: row.note ?? "",
      active: row.active,
    });
  }

  function toggleDay(value: number) {
    setForm({
      ...form,
      weekdays: form.weekdays.includes(value)
        ? form.weekdays.filter((day) => day !== value)
        : [...form.weekdays, value].sort((a, b) => ((a || 7) - (b || 7))),
    });
  }

  function save() {
    return run(async () => {
      if (!form.name.trim()) throw new Error("Shift name is required");
      if (!form.weekdays.length) throw new Error("Pick at least one weekday");
      const payload = {
        code: form.code.trim() || form.name.trim(),
        name: form.name.trim(),
        start_time: form.start_time,
        end_time: form.end_time,
        weekdays: form.weekdays,
        department: form.department ? Number(form.department) : null,
        note: form.note,
        active: form.active,
      };
      if (editing) await hrExt.updateShiftTemplate(editing, payload);
      else await hrExt.createShiftTemplate(payload);
      reset();
    }, editing ? "Shift template updated." : "Shift template created.");
  }

  return (
    <div className={canManage ? "grid gap-4 xl:grid-cols-[1fr_1.4fr]" : ""}>
      {canManage && (
      <Panel
        title={editing ? "Edit shift template" : "New shift template"}
        description="Reusable weekday pattern; assign it on the employee form."
        actions={
          editing ? (
            <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={reset}>
              Cancel
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code">
            <Input
              value={form.code}
              placeholder="e.g. EARLY"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Start time">
            <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </Field>
          <Field label="End time">
            <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </Field>
          <Field label="Department (optional)">
            <Select
              value={form.department}
              onChange={(value) => setForm({ ...form, department: value })}
              placeholder="All departments"
              allowEmpty
              options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
            />
          </Field>
          <Field label="Note">
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <Field label="Weekdays" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(([label, value]) => (
                <button
                  key={value}
                  onClick={() => toggleDay(value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    form.weekdays.includes(value)
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Active">
            <Switch checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Shift is active" />
          </Field>
        </div>
        <Button className="mt-3 w-full" disabled={busy} onClick={save}>
          {editing ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
          {editing ? "Save shift" : "Create shift"}
        </Button>
      </Panel>
      )}

      <Panel title="Shift templates" description="Employees inherit these hours on their profile and attendance.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Hours</Th>
                <Th>Days</Th>
                <Th>Department</Th>
                <Th right>Status</Th>
                {canManage && <Th right>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {shifts.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02]">
                  <Td className="font-mono text-xs text-amber-300">{row.code}</Td>
                  <Td className="text-zinc-100">{row.name}</Td>
                  <Td className="text-zinc-400">
                    {row.start_time.slice(0, 5)} → {row.end_time.slice(0, 5)}
                  </Td>
                  <Td className="text-zinc-400">{dayLabel(row.weekdays ?? [])}</Td>
                  <Td className="text-zinc-400">{row.department_label || "—"}</Td>
                  <Td right>
                    <StatusPill status={row.active ? "ACTIVE" : "INACTIVE"} tone={row.active ? "emerald" : "slate"} />
                  </Td>
                  {canManage && (
                  <Td right>
                    <span className="inline-flex gap-1.5">
                      <IconButton title="Edit" tone="amber" onClick={() => startEdit(row)}>
                        <Pencil className="size-3.5" />
                      </IconButton>
                      <IconButton
                        title="Delete"
                        tone="rose"
                        onClick={() => {
                          if (!window.confirm(`Delete shift "${row.name}"?`)) return;
                          run(() => hrExt.deleteShiftTemplate(row.id), "Shift template deleted.");
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </span>
                  </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shifts.length && (
          <EmptyRow>
            {canManage ? "No shift templates yet." : "No shift templates yet — the Manager sets them up."}
          </EmptyRow>
        )}
      </Panel>
    </div>
  );
}
