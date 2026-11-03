"use client";

// Finance payroll desk: HR hands payslips over, Finance confirms or rejects
// the mark-paid hand-off, then closes the run once every slip is paid.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  Loader2,
  Lock,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboSelect } from "@/components/volo/controls";
import { EmptyRow, Panel, StatCard, StatusPill, Td, Th } from "@/components/volo/kit";
import { hrApi, money, type HrPayrollPeriod } from "@/lib/api";

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

export function FinancePayrollSection() {
  const [periods, setPeriods] = useState<HrPayrollPeriod[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HrPayrollPeriod | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await hrApi.payrollPeriods();
    setPeriods(rows.data);
    setSelectedId((current) => {
      if (current != null && rows.data.some((row) => row.id === current)) {
        return current;
      }
      // Land on the run that needs Finance first.
      const awaiting = rows.data.find((row) => row.status === "AWAITING_FINANCE");
      return awaiting?.id ?? rows.data[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    load()
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
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

  const approve = useCallback(
    async (decision: "APPROVED" | "REJECTED") => {
      if (!detail || detail.id !== selectedId) return;
      setBusy(true);
      try {
        await hrApi.decidePayrollPayment(detail.id, decision, picked);
        toast.success(
          decision === "APPROVED"
            ? "Payment confirmed — marked paid."
            : "Mark-paid rejected — payslips are back with HR.",
        );
        await Promise.all([load(), loadDetail(detail.id)]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [detail, selectedId, picked, load, loadDetail],
  );

  const close = useCallback(async () => {
    if (!detail || detail.id !== selectedId) return;
    setBusy(true);
    try {
      await hrApi.closePayrollPeriod(detail.id);
      toast.success("Payroll run closed.");
      await Promise.all([load(), loadDetail(detail.id)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, [detail, selectedId, load, loadDetail]);

  const slips = useMemo(() => detail?.payslips ?? [], [detail]);
  const awaiting = useMemo(
    () => slips.filter((slip) => slip.status === "AWAITING_FINANCE"),
    [slips],
  );
  const marked = useMemo(
    () => slips.filter((slip) => slip.status === "MARKED_PAID"),
    [slips],
  );
  const unpaid = useMemo(
    () => slips.filter((slip) => slip.status === "UNPAID"),
    [slips],
  );
  const allMarked = slips.length > 0 && marked.length === slips.length;
  const canClose =
    detail != null && detail.status !== "CLOSED" && allMarked && marked.length > 0;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Loading payroll runs…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="HR payroll"
        description="Confirm payslips after HR marks them paid. Only Finance approval finalises Marked paid for employees."
      >
        {!periods.length ? (
          <EmptyRow>
            No payroll runs yet. When HR generates a run it appears here for
            payment confirmation.
          </EmptyRow>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Awaiting Finance"
                value={String(awaiting.length)}
                hint="Need your confirmation"
                tone="amber"
                icon={<Banknote className="size-4" />}
              />
              <StatCard
                label="Marked paid"
                value={String(marked.length)}
                hint="Finalised this run"
                tone="emerald"
                icon={<CheckCircle2 className="size-4" />}
              />
              <StatCard
                label="Still unpaid"
                value={String(unpaid.length)}
                hint="HR has not handed over yet"
                tone="sky"
                icon={<Wallet className="size-4" />}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                Payroll run
              </p>
              <ComboSelect
                value={selectedId ? String(selectedId) : ""}
                onChange={(value) => setSelectedId(Number(value))}
                options={periods.map((row) => ({
                  value: String(row.id),
                  label: `${periodLabel(row)} · ${row.status.replaceAll("_", " ").toLowerCase()}`,
                }))}
                placeholder="Choose a payroll run"
                emptyText="No payroll runs."
              />
              {detail ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <StatusPill
                    status={detail.status.replaceAll("_", " ")}
                    tone={PERIOD_TONE[detail.status] ?? "slate"}
                  />
                  {detail.payslip_count} payslip{detail.payslip_count === 1 ? "" : "s"} ·
                  net {money(detail.totals.net)}
                  {detail.created_by ? ` · raised by ${detail.created_by}` : ""}
                </p>
              ) : null}
            </div>

            {loadingDetail ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" /> Loading payslips…
              </div>
            ) : !detail || !slips.length ? (
              <EmptyRow>This run has no payslips.</EmptyRow>
            ) : (
              <>
                {awaiting.length ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-400/10 via-white/[0.02] to-transparent p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-200">
                        Confirm HR mark-paid
                      </p>
                      <p className="text-xs text-zinc-500">
                        {picked.length
                          ? `${picked.length} selected`
                          : "Select payslips awaiting Finance, then approve or reject."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={busy || !picked.length}
                        onClick={() => void approve("APPROVED")}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Approve mark paid
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy || !picked.length}
                        onClick={() => void approve("REJECTED")}
                      >
                        <XCircle className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-zinc-500">
                    No payslips are awaiting Finance confirmation in this run.
                  </p>
                )}

                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th>Gross</Th>
                        <Th>Deductions</Th>
                        <Th right>Net</Th>
                        <Th>Status</Th>
                        <Th>Hand-off</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {slips.map((slip) => {
                        const selectable = slip.status === "AWAITING_FINANCE";
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
                                ) : (
                                  <span className="inline-block w-4" />
                                )}
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
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">
                    {picked.length} of {awaiting.length} awaiting Finance selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {awaiting.length ? (
                      <button
                        className="text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
                        onClick={() =>
                          setPicked(
                            picked.length === awaiting.length
                              ? []
                              : awaiting.map((slip) => slip.id),
                          )
                        }
                      >
                        {picked.length === awaiting.length
                          ? "Clear selection"
                          : "Select all awaiting"}
                      </button>
                    ) : null}
                    {detail.status === "CLOSED" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200">
                        <Lock className="size-3" /> Closed
                        {detail.closed_by ? ` by ${detail.closed_by}` : ""}
                      </span>
                    ) : canClose ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        disabled={busy}
                        onClick={() => void close()}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        Close payroll run
                      </Button>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        Close unlocks once every payslip is marked paid.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
