/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Incidents: log against the managed incident-type catalogue (which supplies
// the default salary-deduct flag) and resolve in the Manager queue. The
// catalogue itself is Manager-owned; HR only reads it.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, CircleDollarSign, Layers, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrApi, money, type HrIncident } from "@/lib/api";
import { hrExt, type HrIncidentType } from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill } from "@/components/volo/kit";
import {
  Field,
  IconButton,
  PersonPicker,
  RowCard,
  Select,
  SubTabs,
  Switch,
  useRunner,
  Verdict,
  type SectionProps,
} from "./ui";

const today = () => new Date().toISOString().slice(0, 10);

const FALLBACK_KINDS = ["Conduct", "Absence", "Damage", "Safety", "Other"];

const EMPTY_TYPE = { code: "", label: "", deduct: false, active: true };

export default function IncidentsSection({ people, reload }: SectionProps) {
  const [tab, setTab] = useState("register");

  // ---- register
  const [incidents, setIncidents] = useState<HrIncident[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<HrIncidentType[]>([]);
  const [incident, setIncident] = useState({
    employee: "",
    kind: "Conduct",
    title: "",
    detail: "",
    occurred_ymd: today(),
    salary_deduct: false,
    amount_etb: "0",
  });

  // ---- types (the catalogue is managed by the Manager; HR reads it for the form)

  const load = useCallback(async () => {
    const [incidentRows, typeRows] = await Promise.all([hrApi.incidents(), hrExt.incidentTypes()]);
    setIncidents(incidentRows.data);
    setIncidentTypes(typeRows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  const activeTypes = incidentTypes.filter((row) => row.active);
  const kindOptions = (activeTypes.length ? activeTypes.map((row) => row.code) : FALLBACK_KINDS).map((code) => ({
    value: code,
    label: activeTypes.find((row) => row.code === code)?.label ?? code,
  }));

  function onKindChange(kind: string) {
    // Managed types carry the default deduct flag; mirror it in the form.
    const match = activeTypes.find((row) => row.code === kind);
    setIncident({ ...incident, kind, salary_deduct: match ? match.deduct : incident.salary_deduct });
  }

  return (
    <>
      <SubTabs
        value={tab}
        onChange={setTab}
        items={[
          ["register", "Register"],
        ]}
      />

      {tab === "register" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Log an incident" description="Deductions are optional and resolved by the manager.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee">
                <PersonPicker
                  value={incident.employee}
                  onChange={(employee) => setIncident({ ...incident, employee })}
                  rows={people}
                  allowEmpty
                />
              </Field>
              <Field label="Kind">
                <Select value={incident.kind} onChange={onKindChange} options={kindOptions} />
              </Field>
              <Field label="Title">
                <Input value={incident.title} onChange={(e) => setIncident({ ...incident, title: e.target.value })} />
              </Field>
              <Field label="Occurred on">
                <Input
                  type="date"
                  value={incident.occurred_ymd}
                  onChange={(e) => setIncident({ ...incident, occurred_ymd: e.target.value })}
                />
              </Field>
              <Field label="Amount (ETB)">
                <Input
                  type="number"
                  step="0.01"
                  value={incident.amount_etb}
                  onChange={(e) => setIncident({ ...incident, amount_etb: e.target.value })}
                />
              </Field>
              <Field label="Salary deduction">
                <Switch
                  checked={incident.salary_deduct}
                  onChange={(salary_deduct) => setIncident({ ...incident, salary_deduct })}
                  label="Deduct from pay"
                />
              </Field>
              <Field label="Detail" className="sm:col-span-2">
                <Input value={incident.detail} onChange={(e) => setIncident({ ...incident, detail: e.target.value })} />
              </Field>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!incident.title.trim()) throw new Error("Title is required");
                  await hrApi.createIncident({
                    ...incident,
                    employee: incident.employee ? Number(incident.employee) : null,
                  });
                }, "Incident logged.")
              }
            >
              <Plus className="size-3.5" /> Log incident
            </Button>
          </Panel>

          <Panel title="Incident register" description="Open incidents wait on the manager.">
            <div className="space-y-2">
              {incidents.map((row) => (
                <RowCard key={row.id}>
                  <div>
                    <p className="text-sm text-zinc-100">
                      {row.title}
                      <span className="ml-2 text-[11px] text-zinc-500">{row.kind}</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.occurred_ymd} · {row.employee_name || "unassigned"}
                      {row.salary_deduct ? ` · deduct ${money(row.amount_etb)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={row.status} tone={row.status === "RESOLVED" ? "emerald" : "amber"} />
                    {row.status === "OPEN" && (
                      <Verdict
                        tone="emerald"
                        title="Resolve"
                        onClick={() => run(() => hrApi.decideIncident(row.id, "APPROVED"), "Incident resolved.")}
                      />
                    )}
                  </div>
                </RowCard>
              ))}
              {!incidents.length && <EmptyRow>No incidents logged.</EmptyRow>}
            </div>
          </Panel>
        </div>
      )}

    </>
  );
}

// Manager-owned: the incident-type catalogue behind the HR register form.
export function IncidentTypesSection({ reload }: { reload?: () => Promise<unknown> }) {
  const [types, setTypes] = useState<HrIncidentType[]>([]);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.incidentTypes();
    setTypes(rows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await load();
    if (reload) await reload();
  });

  function resetType() {
    setTypeForm(EMPTY_TYPE);
    setEditing(null);
  }

  function startEditType(row: HrIncidentType) {
    setEditing(row.id);
    setTypeForm({ code: row.code, label: row.label, deduct: row.deduct, active: row.active });
  }

  function saveType() {
    return run(async () => {
      if (!typeForm.label.trim() && !typeForm.code.trim()) throw new Error("Code or label is required");
      if (editing) {
        await hrExt.updateIncidentType(editing, {
          label: typeForm.label.trim(),
          deduct: typeForm.deduct,
          active: typeForm.active,
        });
      } else {
        await hrExt.createIncidentType({
          code: typeForm.code.trim() || typeForm.label.trim(),
          label: typeForm.label.trim() || typeForm.code.trim(),
          deduct: typeForm.deduct,
          active: typeForm.active,
        });
      }
      resetType();
    }, editing ? "Incident type updated." : "Incident type created.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel
        title={editing ? "Edit incident type" : "New incident type"}
        description="Codes feed the incident form; deduct sets its default."
        actions={
          editing ? (
            <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={resetType}>
              Cancel
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code">
            <Input
              value={typeForm.code}
              placeholder="e.g. SAFETY"
              disabled={Boolean(editing)}
              onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
            />
          </Field>
          <Field label="Label">
            <Input value={typeForm.label} onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })} />
          </Field>
          <Field label="Deduct">
            <Switch
              checked={typeForm.deduct}
              onChange={(deduct) => setTypeForm({ ...typeForm, deduct })}
              label="Deduct from pay"
            />
          </Field>
          <Field label="Active">
            <Switch
              checked={typeForm.active}
              onChange={(active) => setTypeForm({ ...typeForm, active })}
              label="Type is active"
            />
          </Field>
        </div>
        <Button className="mt-3 w-full" disabled={busy} onClick={saveType}>
          {editing ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
          {editing ? "Save type" : "Create type"}
        </Button>
      </Panel>

      <Panel title="Incident types" description="The catalogue behind the incident form.">
        <div className="space-y-2">
          {types.map((row) => (
            <RowCard key={row.id}>
              <div>
                <p className="text-sm text-zinc-100">
                  {row.label}
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">{row.code}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {row.deduct ? "deducts from pay by default" : "no salary deduction"}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill status={row.active ? "ACTIVE" : "ARCHIVED"} tone={row.active ? "emerald" : "slate"} />
                <IconButton title="Edit" tone="amber" onClick={() => startEditType(row)}>
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  title={row.active ? "Archive" : "Restore"}
                  tone="sky"
                  onClick={() =>
                    run(
                      () => hrExt.updateIncidentType(row.id, { active: !row.active }),
                      row.active ? "Incident type archived." : "Incident type restored.",
                    )
                  }
                >
                  <Archive className="size-3.5" />
                </IconButton>
                <IconButton
                  title="Delete"
                  tone="rose"
                  onClick={() => {
                    if (!window.confirm(`Delete incident type "${row.label}"?`)) return;
                    run(() => hrExt.deleteIncidentType(row.id), "Incident type deleted.");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </span>
            </RowCard>
          ))}
          {!types.length && <EmptyRow>No managed incident types yet.</EmptyRow>}
        </div>
      </Panel>
    </div>
  );
}
