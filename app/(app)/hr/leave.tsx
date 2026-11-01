/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Leave: request records, the managed leave-type table (code, label, paid flag,
// quota) and the per-employee balance book (entitlement vs used/pending).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, CalendarDays, CircleDollarSign, Layers, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hrApi, qty, statusTone, type HrLeave } from "@/lib/api";
import {
  HR_STEP_LABELS,
  hrExt,
  type HrEmployeeBalance,
  type HrLeaveBalanceRow,
  type HrLeaveType,
  type HrStepKind,
} from "@/lib/api/hr";
import { EmptyRow, Panel, StatCard, StatusPill, Td, Th } from "@/components/volo/kit";
import {
  CodeChip,
  EmptyState,
  Field,
  IconButton,
  PersonPicker,
  RowCard,
  Select,
  StatStrip,
  SubTabs,
  Switch,
  useRunner,
  Verdict,
  type SectionProps,
} from "./ui";

const today = () => new Date().toISOString().slice(0, 10);
const thisYear = () => String(new Date().getFullYear());

const EMPTY_TYPE = { code: "", label: "", paid: true, quota_days: "15", active: true };

const HR_DECIDABLE = new Set(["team_leader", "department_leader", "hr"]);

export default function LeaveSection({ people, reload }: SectionProps) {
  const [tab, setTab] = useState("requests");

  // ---- requests
  const [leaves, setLeaves] = useState<HrLeave[]>([]);
  const [leave, setLeave] = useState({
    employee: "",
    leave_type: "ANNUAL",
    from_ymd: today(),
    to_ymd: today(),
    days: "1",
    reason: "",
  });

  // ---- types (the catalogue is managed by the Manager; HR reads it for the form)
  const [types, setTypes] = useState<HrLeaveType[]>([]);

  // ---- balances
  const [balanceEmployee, setBalanceEmployee] = useState("");
  const [year, setYear] = useState(thisYear());
  const [book, setBook] = useState<HrEmployeeBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [editRow, setEditRow] = useState<HrLeaveBalanceRow | null>(null);
  const [balanceForm, setBalanceForm] = useState({
    entitled_days: "",
    adjustment_days: "",
    note: "",
  });

  const load = useCallback(async () => {
    const [leaveRows, typeRows] = await Promise.all([hrApi.leaves(), hrExt.leaveTypes()]);
    setLeaves(leaveRows.data);
    setTypes(typeRows.data);
  }, []);

  const loadBalances = useCallback(async () => {
    if (!balanceEmployee) {
      setBook(null);
      return;
    }
    setBalanceLoading(true);
    try {
      const result = await hrExt.leaveBalances(Number(balanceEmployee), Number(year));
      setBook(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load balances.");
    } finally {
      setBalanceLoading(false);
    }
  }, [balanceEmployee, year]);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), loadBalances(), reload()]);
  });

  function openBalance(row: HrLeaveBalanceRow) {
    setEditRow(row);
    setBalanceForm({
      entitled_days: row.entitled_days,
      adjustment_days: row.adjustment_days,
      note: row.note,
    });
  }

  function saveBalance() {
    if (!editRow || !balanceEmployee) return;
    return run(async () => {
      await hrExt.saveLeaveBalance({
        employee: Number(balanceEmployee),
        leave_type: editRow.leave_type,
        year: Number(year),
        entitled_days: balanceForm.entitled_days || "0",
        adjustment_days: balanceForm.adjustment_days || "0",
        note: balanceForm.note,
      });
      setEditRow(null);
    }, "Leave balance updated.");
  }

  const activeTypes = types.filter((row) => row.active);

  return (
    <>
      <SubTabs
        value={tab}
        onChange={setTab}
        items={[
          ["requests", "Requests"],
          ["balances", "Balances"],
        ]}
      />

      {tab === "requests" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Record leave" description="Quotas come from the leave-type table.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee">
                <PersonPicker
                  value={leave.employee}
                  onChange={(employee) => setLeave({ ...leave, employee })}
                  rows={people}
                />
              </Field>
              <Field label="Leave type">
                <Select
                  value={leave.leave_type}
                  onChange={(leave_type) => setLeave({ ...leave, leave_type })}
                  options={(activeTypes.length ? activeTypes : types).map((row) => ({
                    value: row.code,
                    label: `${row.label} (${row.quota_days}d)`,
                  }))}
                />
              </Field>
              <Field label="From">
                <Input type="date" value={leave.from_ymd} onChange={(e) => setLeave({ ...leave, from_ymd: e.target.value })} />
              </Field>
              <Field label="To">
                <Input type="date" value={leave.to_ymd} onChange={(e) => setLeave({ ...leave, to_ymd: e.target.value })} />
              </Field>
              <Field label="Days">
                <Input
                  type="number"
                  step="0.5"
                  value={leave.days}
                  onChange={(e) => setLeave({ ...leave, days: e.target.value })}
                />
              </Field>
              <Field label="Reason">
                <Input value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} />
              </Field>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!leave.employee) throw new Error("Pick an employee");
                  await hrApi.createLeave({ ...leave, employee: Number(leave.employee) });
                }, "Leave recorded.")
              }
            >
              <Plus className="size-3.5" /> Record leave
            </Button>
          </Panel>

          <Panel
            title="Leave requests"
            description="Each request walks its workflow; HR decides HR steps, the Manager the rest."
          >
            <div className="space-y-2">
              {leaves.map((row) => {
                const step = (row.step_kind || "manager") as HrStepKind;
                const canDecide = row.status === "PENDING" && HR_DECIDABLE.has(step);
                return (
                  <RowCard key={row.id}>
                    <div>
                      <p className="text-sm text-zinc-100">
                        {row.employee_name}
                        <span className="ml-2 text-[11px] text-zinc-500">{row.leave_type}</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {row.from_ymd} → {row.to_ymd} · {qty(row.days)} day(s)
                        {row.reason ? ` · ${row.reason}` : ""}
                      </p>
                      {row.status === "PENDING" && (
                        <p className="mt-1 text-[11px] text-amber-300/90">
                          Step {row.current_step_index + 1} · {HR_STEP_LABELS[step] ?? step}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={row.status} tone={statusTone(row.status)} />
                      {canDecide && (
                        <>
                          <Verdict
                            tone="emerald"
                            title="Approve"
                            onClick={() => run(() => hrApi.decideLeave(row.id, "APPROVED"), "Leave approved.")}
                          />
                          <Verdict
                            tone="rose"
                            title="Reject"
                            onClick={() => run(() => hrApi.decideLeave(row.id, "REJECTED"), "Leave rejected.")}
                          />
                        </>
                      )}
                      {row.status === "PENDING" && !canDecide && (
                        <span className="text-[11px] text-zinc-500">Awaiting Manager</span>
                      )}
                    </div>
                  </RowCard>
                );
              })}
              {!leaves.length && <EmptyRow>No leave requests.</EmptyRow>}
            </div>
          </Panel>
        </div>
      )}

      {tab === "balances" && (
        <Panel
          title="Leave balances"
          description="Entitlement, approved and pending days per type — override the entitlement when a contract differs."
          actions={
            <div className="flex items-center gap-2">
              <Select
                value={year}
                onChange={setYear}
                options={[0, 1, 2].map((offset) => {
                  const value = String(new Date().getFullYear() - offset);
                  return { value, label: value };
                })}
                placeholder={year}
                className="h-8 w-24"
              />
            </div>
          }
        >
          <div className="mb-4 max-w-xs">
            <Field label="Employee">
              <PersonPicker
                value={balanceEmployee}
                onChange={setBalanceEmployee}
                rows={people}
              />
            </Field>
          </div>

          {!balanceEmployee ? (
            <EmptyRow>Pick an employee to see their balance book.</EmptyRow>
          ) : balanceLoading ? (
            <EmptyRow>Loading balances…</EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th right>Entitled</Th>
                    <Th right>Adjustment</Th>
                    <Th right>Approved</Th>
                    <Th right>Pending</Th>
                    <Th right>Available</Th>
                    <Th right>Edit</Th>
                  </tr>
                </thead>
                <tbody>
                  {(book?.balances ?? []).map((row) => (
                    <tr key={row.leave_type} className="hover:bg-white/[0.02]">
                      <Td className="text-zinc-100">
                        {row.label}
                        <span className="ml-2 text-[11px] text-zinc-500">{row.leave_type}</span>
                      </Td>
                      <Td right>{qty(row.entitled_days)} d</Td>
                      <Td right className={Number(row.adjustment_days) ? "text-amber-300" : ""}>
                        {qty(row.adjustment_days)} d
                      </Td>
                      <Td right>{qty(row.used_days)} d</Td>
                      <Td right className="text-sky-300">{qty(row.pending_days)} d</Td>
                      <Td right>
                        <span
                          className={
                            Number(row.available_days) < 0 ? "font-semibold text-rose-300" : "font-semibold text-emerald-300"
                          }
                        >
                          {qty(row.available_days)} d
                        </span>
                      </Td>
                      <Td right>
                        <IconButton title="Adjust entitlement" tone="amber" onClick={() => openBalance(row)}>
                          <Pencil className="size-3.5" />
                        </IconButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(book?.balances ?? []).length && (
                <EmptyRow>No active leave types yet — the Manager sets them up under Leave types.</EmptyRow>
              )}
            </div>
          )}
        </Panel>
      )}

      <Dialog open={editRow !== null} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="size-4 text-amber-300" />
              {editRow?.label ?? "Leave balance"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {book?.employee_name} · {year}. Approved and pending days are counted from requests.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Entitled days">
              <Input
                type="number"
                step="0.5"
                value={balanceForm.entitled_days}
                onChange={(e) => setBalanceForm({ ...balanceForm, entitled_days: e.target.value })}
              />
            </Field>
            <Field label="Adjustment">
              <Input
                type="number"
                step="0.5"
                value={balanceForm.adjustment_days}
                onChange={(e) => setBalanceForm({ ...balanceForm, adjustment_days: e.target.value })}
              />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Input
                value={balanceForm.note}
                placeholder="Why the entitlement changed"
                onChange={(e) => setBalanceForm({ ...balanceForm, note: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15 bg-transparent" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={saveBalance}>
              Save balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Manager-owned: the leave-type catalogue behind the HR request form.
export function LeaveTypesSection({ reload }: { reload?: () => Promise<unknown> }) {
  const [types, setTypes] = useState<HrLeaveType[]>([]);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.leaveTypes();
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

  function startEditType(row: HrLeaveType) {
    setEditing(row.id);
    setTypeForm({
      code: row.code,
      label: row.label,
      paid: row.paid,
      quota_days: row.quota_days,
      active: row.active,
    });
  }

  function saveType() {
    return run(async () => {
      if (!typeForm.label.trim()) throw new Error("Label is required");
      const payload = {
        code: typeForm.code.trim() || typeForm.label.trim(),
        label: typeForm.label.trim(),
        paid: typeForm.paid,
        quota_days: typeForm.quota_days,
        active: typeForm.active,
      };
      if (editing) await hrExt.updateLeaveType(editing, payload);
      else await hrExt.createLeaveType(payload);
      resetType();
    }, editing ? "Leave type updated." : "Leave type created.");
  }

  const activeTypes = types.filter((row) => row.active).length;
  const paidTypes = types.filter((row) => row.paid).length;
  const totalQuota = types.reduce((sum, row) => sum + Number(row.quota_days || 0), 0);

  return (
    <div className="space-y-4">
      <StatStrip>
        <StatCard
          label="Leave types"
          value={String(types.length)}
          hint={`${activeTypes} active`}
          tone="emerald"
          icon={<CalendarDays className="size-4" />}
        />
        <StatCard
          label="Paid types"
          value={String(paidTypes)}
          hint="Draw down a yearly quota"
          tone="sky"
          icon={<CircleDollarSign className="size-4" />}
        />
        <StatCard
          label="Annual quota"
          value={`${qty(totalQuota)} d`}
          hint="Sum across the catalogue"
          tone="amber"
          icon={<Layers className="size-4" />}
        />
        <StatCard
          label="Archived"
          value={String(types.length - activeTypes)}
          hint="Hidden from the request form"
          tone="slate"
          icon={<Archive className="size-4" />}
        />
      </StatStrip>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel
          title={editing ? "Edit leave type" : "New leave type"}
          description="Paid types draw down the quota; archived types stop appearing."
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
                placeholder="e.g. SICK"
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
              />
            </Field>
            <Field label="Label">
              <Input value={typeForm.label} onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })} />
            </Field>
            <Field label="Quota (days)">
              <Input
                type="number"
                step="0.5"
                value={typeForm.quota_days}
                onChange={(e) => setTypeForm({ ...typeForm, quota_days: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paid">
                <Switch
                  checked={typeForm.paid}
                  onChange={(paid) => setTypeForm({ ...typeForm, paid })}
                  label="Paid"
                />
              </Field>
              <Field label="Active">
                <Switch
                  checked={typeForm.active}
                  onChange={(active) => setTypeForm({ ...typeForm, active })}
                  label="Active"
                />
              </Field>
            </div>
          </div>
          <Button className="mt-3 w-full" disabled={busy} onClick={saveType}>
            {editing ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            {editing ? "Save leave type" : "Create leave type"}
          </Button>
        </Panel>

        <Panel title="Leave types" description="The catalogue behind the leave request form.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Label</Th>
                  <Th right>Quota</Th>
                  <Th>Paid</Th>
                  <Th right>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {types.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/[0.025]">
                    <Td>
                      <CodeChip tone="emerald">{row.code}</CodeChip>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
                          <CalendarDays className="size-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-zinc-100">{row.label}</span>
                          <span className="block text-[11px] text-zinc-500">
                            {row.paid ? "Paid leave" : "Unpaid leave"}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td right>
                      <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-300">
                        {qty(row.quota_days)} d
                      </span>
                    </Td>
                    <Td>
                      <StatusPill status={row.paid ? "PAID" : "UNPAID"} tone={row.paid ? "emerald" : "slate"} />
                    </Td>
                    <Td right>
                      <StatusPill status={row.active ? "ACTIVE" : "ARCHIVED"} tone={row.active ? "emerald" : "slate"} />
                    </Td>
                    <Td right>
                      <span className="inline-flex gap-1.5">
                        <IconButton title="Edit" tone="amber" onClick={() => startEditType(row)}>
                          <Pencil className="size-3.5" />
                        </IconButton>
                        <IconButton
                          title={row.active ? "Archive" : "Restore"}
                          tone="sky"
                          onClick={() =>
                            run(
                              () => hrExt.updateLeaveType(row.id, { active: !row.active }),
                              row.active ? "Leave type archived." : "Leave type restored.",
                            )
                          }
                        >
                          <Archive className="size-3.5" />
                        </IconButton>
                        <IconButton
                          title="Delete"
                          tone="rose"
                          onClick={() => {
                            if (!window.confirm(`Delete leave type "${row.label}"?`)) return;
                            run(() => hrExt.deleteLeaveType(row.id), "Leave type deleted.");
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!types.length && (
            <EmptyState
              icon={<CalendarDays className="size-4" />}
              title="No leave types yet"
              hint="Add the first type on the left — it appears immediately on the HR request form."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
