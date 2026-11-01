"use client";

// Payroll runs: HR generates the run, the Manager approves it, HR hands it to
// Finance by marking payslips paid, and Finance confirms. HR never finalises.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileDown, Loader2, Lock, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ComboSelect, DateField } from "@/components/volo/controls";
import { EmptyRow, Panel, StatusPill, Td, Th } from "@/components/volo/kit";
import { getUser, hrApi, money, type HrPayrollPeriod } from "@/lib/api";
import { exportExcel } from "@/lib/export";
import { Field, RowCard, useRunner, type SectionProps } from "./ui";

const monthKey = () => new Date().toISOString().slice(0, 7);

function monthBounds(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return { from: "", to: "" };
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

const PERIOD_TONE: Record<string, string> = {
  OPEN: "rose",
  AWAITING_MANAGER: "violet",
  APPROVED: "sky",
  AWAITING_FINANCE: "amber",
  CLOSED: "emerald",
};

const SLIP_TONE: Record<string, string> = {
  UNPAID: "slate",
  AWAITING_FINANCE: "amber",
  MARKED_PAID: "emerald",
};

const periodLabel = (row: HrPayrollPeriod) =>
  `${row.month_name || row.period_key} · ${row.from_ymd} → ${row.to_ymd}`;

export default function PayrollSection({ people, reload }: SectionProps) {
  const role = getUser()?.role;
  const isHr = role === "HR";

  const [periods, setPeriods] = useState<HrPayrollPeriod[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HrPayrollPeriod | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [month, setMonth] = useState(monthKey);
  const [span, setSpan] = useState(() => {
    const bounds = monthBounds(monthKey());
    return { from: bounds.from, to: bounds.to };
  });

  const load = useCallback(async () => {
    const rows = await hrApi.payrollPeriods();
    setPeriods(rows.data);
    setSelectedId((current) => {
      if (current != null && rows.data.some((row) => row.id === current)) {
        return current;
      }
      return rows.data[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      const row = await hrApi.payrollPeriod(id);
      setDetail(row.data);
      setPicked([]);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    loadDetail(selectedId).catch((error) => toast.error(error.message));
  }, [selectedId, loadDetail]);

  const { busy, run } = useRunner(async () => {
    if (selectedId != null) await loadDetail(selectedId);
    await load();
    await reload();
  });

  const changeMonth = (value: string) => {
    setMonth(value);
    const bounds = monthBounds(value);
    if (bounds.from) setSpan(bounds);
  };

  const slips = useMemo(() => detail?.payslips ?? [], [detail]);
  const unpaid = useMemo(
    () => slips.filter((slip) => slip.status === "UNPAID"),
    [slips],
  );
  const awaiting = useMemo(
    () => slips.filter((slip) => slip.status === "AWAITING_FINANCE"),
    [slips],
  );
  const marked = useMemo(
    () => slips.filter((slip) => slip.status === "MARKED_PAID"),
    [slips],
  );

  const current = detail && detail.id === selectedId ? detail : null;
  const canMarkPaid =
    isHr && current != null && ["APPROVED", "AWAITING_FINANCE"].includes(current.status);
  const canDiscard = isHr && current?.status === "OPEN";
  const activePeople = people.filter((row) => row.status !== "TERMINATED").length;

  const generate = () =>
    run(async () => {
      const created = await hrApi.createPayrollPeriod({
        period_key: month,
        from_ymd: span.from,
        to_ymd: span.to,
      });
      setSelectedId(created.data.id);
    }, "Payroll run generated — sent to the Manager.");

  const markPaid = () =>
    run(async () => {
      if (!detail || detail.id !== selectedId) {
        throw new Error("Pick a payroll run first");
      }
      const ids = picked.length ? picked : unpaid.map((slip) => slip.id);
      if (!ids.length) throw new Error("There are no unpaid payslips left");
      await hrApi.markPayrollPaid(detail.id, ids);
    }, "Sent to Finance for mark-paid confirmation.");

  const discard = () =>
    run(async () => {
      if (!detail || detail.id !== selectedId) return;
      await hrApi.deletePayrollPeriod(detail.id);
      setSelectedId(null);
    }, "Run discarded.");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel
          title="Generate payroll run"
          description="One payslip per active employee: gross is the salary, deductions are the salary-deduct incidents inside the window."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Period key">
              <ComboSelect
                value={month}
                onChange={changeMonth}
                options={recentMonths()}
                placeholder="YYYY-MM"
              />
            </Field>
            <Field label="Employees">
              <div className="flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-300">
                {activePeople} active
              </div>
            </Field>
            <Field label="From">
              <DateField
                value={span.from}
                onChange={(from) => setSpan((row) => ({ ...row, from }))}
              />
            </Field>
            <Field label="To">
              <DateField
                value={span.to}
                onChange={(to) => setSpan((row) => ({ ...row, to }))}
              />
            </Field>
          </div>
          {isHr ? (
            <Button
              className="mt-3 w-full"
              disabled={busy || !span.from || !span.to}
              onClick={() => void generate()}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Generate run
            </Button>
          ) : (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">
              Runs are generated by HR. Manager approval happens in the Manager
              queue.
            </p>
          )}
        </Panel>

        <Panel
          title="Payroll runs"
          description="Every run, its approval state and how much is still waiting on Finance."
          actions={
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent"
              disabled={!slips.length}
              onClick={() =>
                exportExcel({
                  title: `Payroll ${detail?.period_key ?? ""}`.trim(),
                  headers: [
                    "Employee",
                    "Gross",
                    "Deductions",
                    "Net",
                    "Status",
                    "Marked by HR",
                    "Confirmed by Finance",
                  ],
                  rows: slips.map((slip) => [
                    slip.employee_name,
                    Number(slip.gross),
                    Number(slip.deductions),
                    Number(slip.net),
                    slip.status.replaceAll("_", " "),
                    slip.hr_marked_paid_by,
                    slip.manager_approved_by,
                  ]),
                  file: `volosync-payroll-${detail?.period_key ?? "run"}`,
                })
              }
            >
              <FileDown className="size-3.5" /> Excel
            </Button>
          }
        >
          <div className="space-y-2">
            {periods.map((row) => {
              const active = row.id === selectedId;
              return (
                <RowCard key={row.id}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-100">
                      {periodLabel(row)}
                      <StatusPill
                        status={row.status.replaceAll("_", " ")}
                        tone={PERIOD_TONE[row.status] ?? "slate"}
                      />
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {row.payslip_count} payslip{row.payslip_count === 1 ? "" : "s"} ·
                      net {money(row.totals.net)} · {row.counts.awaiting_finance}{" "}
                      awaiting Finance · {row.counts.marked_paid} marked paid
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={
                      active
                        ? "border-white/30 bg-white/[0.08] text-white"
                        : "border-white/15 bg-transparent"
                    }
                    onClick={() => setSelectedId(row.id)}
                  >
                    {active ? "Selected" : "Open"}
                  </Button>
                </RowCard>
              );
            })}
            {!periods.length && <EmptyRow>No payroll runs yet.</EmptyRow>}
          </div>
        </Panel>
      </div>

      <Panel
        title={detail ? `Run ${detail.period_key}` : "Payslips"}
        description="Select a run to review payslips and hand them over."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {detail && (
              <StatusPill
                status={detail.status.replaceAll("_", " ")}
                tone={PERIOD_TONE[detail.status] ?? "slate"}
              />
            )}
            {canDiscard && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={busy}>
                    <Trash2 className="size-3.5" /> Discard
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard this payroll run?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Every payslip generated in {detail?.period_key} is removed.
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        void discard();
                      }}
                      className="bg-rose-600 text-white hover:bg-rose-500"
                    >
                      Discard run
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canMarkPaid && unpaid.length > 0 && (
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={busy}
                onClick={() => void markPaid()}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Mark paid (HR){picked.length ? ` · ${picked.length}` : ""}
              </Button>
            )}
          </div>
        }
      >
        {!detail ? (
          <EmptyRow>Pick a payroll run to see its payslips.</EmptyRow>
        ) : loadingDetail ? (
          <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Loading payslips…
          </div>
        ) : (
          <>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <Metric label="Unpaid" value={unpaid.length} hint="HR has not handed over yet" />
              <Metric
                label="Awaiting Finance"
                value={awaiting.length}
                hint="Waiting for the cash-side confirm"
              />
              <Metric label="Marked paid" value={marked.length} hint="Finalised by Finance" />
            </div>

            {detail.status === "AWAITING_MANAGER" && (
              <p className="mb-3 rounded-lg border border-violet-400/25 bg-violet-400/8 px-3 py-2 text-xs text-violet-200">
                Generated {detail.created_by ? `by ${detail.created_by}` : ""} — waiting
                on the Manager to approve the run.
              </p>
            )}
            {detail.status === "OPEN" && (
              <p className="mb-3 rounded-lg border border-rose-400/25 bg-rose-400/8 px-3 py-2 text-xs text-rose-200">
                The Manager sent this run back
                {detail.decision_note ? `: ${detail.decision_note}` : ""}. Discard it
                before generating a replacement for {detail.period_key}.
              </p>
            )}
            {detail.status === "AWAITING_FINANCE" && (
              <p className="mb-3 rounded-lg border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-xs text-amber-200">
                Handed to Finance — {awaiting.length} payslip
                {awaiting.length === 1 ? "" : "s"} waiting for confirmation.
              </p>
            )}
            {detail.status === "CLOSED" && (
              <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/8 px-3 py-2 text-xs text-emerald-200">
                <Lock className="size-3.5" /> Closed
                {detail.closed_by ? ` by ${detail.closed_by}` : ""}. This run is read-only.
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>{canMarkPaid ? "Select" : "Employee"}</Th>
                    <Th>Gross</Th>
                    <Th>Deductions</Th>
                    <Th right>Net</Th>
                    <Th>Status</Th>
                    <Th>Trail</Th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map((slip) => {
                    const selectable = canMarkPaid && slip.status === "UNPAID";
                    const checked = picked.includes(slip.id);
                    return (
                      <tr key={slip.id} className="transition hover:bg-white/[0.03]">
                        <Td>
                          <div className="flex items-center gap-2">
                            {selectable ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setPicked((current) =>
                                    event.target.checked
                                      ? [...current, slip.id]
                                      : current.filter((id) => id !== slip.id),
                                  )
                                }
                                className="size-4 accent-[var(--role-1)]"
                                aria-label={`Select ${slip.employee_name}`}
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="truncate text-sm text-zinc-100">
                                {slip.employee_name}
                              </p>
                              {slip.job_title ? (
                                <p className="truncate text-[11px] text-zinc-500">
                                  {slip.job_title}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </Td>
                        <Td>{money(slip.gross)}</Td>
                        <Td>{money(slip.deductions)}</Td>
                        <Td right className="text-emerald-300">
                          {money(slip.net)}
                        </Td>
                        <Td>
                          <StatusPill
                            status={slip.status.replaceAll("_", " ")}
                            tone={SLIP_TONE[slip.status] ?? "slate"}
                          />
                        </Td>
                        <Td>
                          <p className="text-[11px] text-zinc-500">
                            {slip.hr_marked_paid_by
                              ? `HR ${slip.hr_marked_paid_by}`
                              : "Not handed over"}
                            {slip.manager_approved_by
                              ? ` · Finance ${slip.manager_approved_by}`
                              : ""}
                          </p>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!slips.length && (
                <div className="p-4">
                  <EmptyRow>This run has no payslips.</EmptyRow>
                </div>
              )}
            </div>

            {canMarkPaid && unpaid.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-200">
                <span className="flex items-center gap-2">
                  <Check className="size-3.5" />
                  {picked.length
                    ? `${picked.length} selected for hand-over`
                    : "Select payslips, or mark every unpaid one at once."}
                </span>
                <button
                  className="text-emerald-300 underline-offset-2 hover:underline"
                  onClick={() =>
                    setPicked(
                      picked.length === unpaid.length
                        ? []
                        : unpaid.map((slip) => slip.id),
                    )
                  }
                >
                  {picked.length === unpaid.length ? "Clear selection" : "Select all unpaid"}
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      <p className="text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

function recentMonths() {
  const rows: { value: string; label: string }[] = [];
  const now = new Date();
  for (let offset = 0; offset < 12; offset += 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = day.toISOString().slice(0, 7);
    rows.push({ value: key, label: key });
  }
  return rows;
}
