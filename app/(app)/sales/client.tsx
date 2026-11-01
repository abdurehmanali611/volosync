"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  money,
  qty,
  salesApi,
  statusTone,
} from "@/lib/api";
import { useView } from "@/lib/use-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/components/change-password";
import { toast } from "sonner";
import { HandCoins, Loader2, PackageCheck } from "lucide-react";
import {
  EmptyRow,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  Td,
} from "@/components/volo/kit";

const SALES_DISABLED = "Sales role is disabled for this tenant.";

/** StockAssignmentSerializer also emits the SalesAgent id (`sales_agent`);
 * lib/api.ts's StockOut type predates it, so retype just this payload. */
type StockOutAssignment = {
  id: number;
  voucher_number: string;
  item_name: string;
  agent_name: string;
  sales_agent: number | null;
  quantity: string;
  changing_amount: string;
  change_reason: string;
};

type AssignmentRow = {
  id: number;
  voucher_number: string;
  item_name: string;
  agent_name: string;
  sales_agent: number | null;
  quantity: string;
  changing_amount: string;
};

type Settlement = {
  id: number;
  agent_name: string;
  item_name: string;
  voucher_number: string;
  sold_quantity: string;
  returned_quantity: string;
  payment_method: string;
  sales_amount: string;
  expected_amount: string;
  penalty: boolean;
  status: string;
  created_at: string;
  assignment: number;
};

export default function SalesPage() {
  const [view] = useView("stock");
  const [open, setOpen] = useState<AssignmentRow[]>([]);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [form, setForm] = useState({
    assignment: "",
    sold_quantity: "",
    payment_method: "TELEBIRR",
    sales_amount: "",
    penalty: false,
  });
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [stocks, settlements, meResult] = await Promise.all([
      api.stockouts(),
      fetchJson<{ data: Settlement[] }>("/api/sales/settlements/"),
      salesApi.agentMe().catch(() => null),
    ]);

    // Use the /me endpoint to get this agent's exact id — no name-matching fragility.
    const myAgentId = meResult?.data?.id ?? null;

    const rows: AssignmentRow[] = [];
    for (const doc of stocks.data) {
      if (doc.status !== "APPROVED") continue;
      for (const row of doc.assignments as StockOutAssignment[]) {
        if (row.sales_agent == null) continue;
        if (myAgentId !== null && row.sales_agent !== myAgentId) continue;
        rows.push(row);
      }
    }
    setOpen(rows);
    setHistory(settlements.data);
    setDisabled(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Request failed";
        if (message === SALES_DISABLED) {
          setDisabled(true);
          toast.error(message, { id: "sales-disabled" });
        } else {
          toast.error(message);
        }
      })
      .finally(() => setLoading(false));
  }, [load]);

  async function settle(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetchJson("/api/sales/settlements/", {
        method: "POST",
        body: JSON.stringify({
          assignment: Number(form.assignment),
          sold_quantity: form.sold_quantity,
          payment_method: form.payment_method,
          sales_amount: form.sales_amount,
          penalty: form.penalty,
        }),
      });
      toast.success("Submitted to Finance for verification.");
      setForm({
        assignment: "",
        sold_quantity: "",
        payment_method: "TELEBIRR",
        sales_amount: "",
        penalty: false,
      });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit";
      if (message === SALES_DISABLED) {
        setDisabled(true);
        toast.error(message, { id: "sales-disabled" });
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const assigned = open.reduce((sum, row) => sum + Number(row.quantity), 0);
  const sold = history
    .filter((row) => row.status === "APPROVED")
    .reduce((sum, row) => sum + Number(row.sold_quantity), 0);

  if (disabled) {
    return (
      <>
        <PageHeader
          eyebrow="Sales workspace"
          title="Your assigned stock"
          description="Sales is switched off for this tenant — there is nothing to settle until it is enabled again."
        />
        <Panel
          title="Sales is switched off"
          description="A manager can turn the Sales role back on from the tenant settings."
        >
          <EmptyRow>
            {SALES_DISABLED} Your stock, entry form and history will appear here once the
            Sales role is on again.
          </EmptyRow>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Sales workspace"
        title="Assigned stock"
        description="Approved assignments and their settlements. Finance verifies, the Manager approves."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Assigned stock"
          value={qty(assigned)}
          hint="Units with agents"
          tone="sky"
          icon={<PackageCheck className="size-4" />}
        />
        <StatCard
          label="Units sold"
          value={qty(sold)}
          hint="Across approved settlements"
          tone="emerald"
        />
        <StatCard
          label="Enter sales"
          value={`${open.length} open`}
          hint="Assignments not yet settled"
          tone="amber"
          icon={<HandCoins className="size-4" />}
        />
      </div>

      {view === "stock" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="Assigned stock" description="Only assignments approved by both steps.">
            <div className="max-h-[24rem] overflow-auto rounded-md">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr>
                    <StickyTh>Voucher</StickyTh>
                    <StickyTh>Item</StickyTh>
                    <StickyTh right>Qty</StickyTh>
                    <StickyTh right>Δ price</StickyTh>
                  </tr>
                </thead>
                <tbody>
                  {loading && !open.length ? (
                    <SkeletonRows cols={4} rows={5} />
                  ) : (
                    open.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-white/[0.02]">
                        <Td className="font-mono text-xs text-sky-300">{row.voucher_number}</Td>
                        <Td>{row.item_name}</Td>
                        <Td right>{qty(row.quantity)}</Td>
                        <Td right className={Number(row.changing_amount) < 0 ? "text-rose-300" : "text-emerald-300"}>
                          {Number(row.changing_amount) === 0
                            ? "—"
                            : `${Number(row.changing_amount) > 0 ? "+" : ""}${row.changing_amount}`}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && !open.length && <EmptyRow>No open assignments.</EmptyRow>}
          </Panel>

          <Panel title="Enter sales" description="Sold cannot exceed assigned — returns go back automatically.">
            <form onSubmit={settle} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
                  Assignment
                </Label>
                <select
                  value={form.assignment}
                  onChange={(event) => setForm({ ...form, assignment: event.target.value })}
                  className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-100"
                  required
                >
                  <option value="">Select an assignment…</option>
                  {open.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.item_name} · {row.voucher_number} · {qty(row.quantity)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
                  Sold quantity
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.sold_quantity}
                  onChange={(event) => setForm({ ...form, sold_quantity: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
                  Payment method
                </Label>
                <select
                  value={form.payment_method}
                  onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
                  className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-100"
                >
                  <option value="TELEBIRR">Telebirr</option>
                  <option value="BANK">Bank</option>
                  <option value="RECEIPT">Receipt (cash slip)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
                  Sales amount
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.sales_amount}
                  onChange={(event) => setForm({ ...form, sales_amount: event.target.value })}
                  required
                />
              </div>
              <label className="flex items-center gap-2 self-end text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.penalty}
                  onChange={(event) => setForm({ ...form, penalty: event.target.checked })}
                  className="size-4 accent-rose-500"
                />
                Penalty (hurts ranking)
              </label>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? "Submitting…" : "Submit to Finance"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      {view === "history" && (
        <Panel title="My history" description="Everything you have settled, with its status.">
          <div className="max-h-[32rem] overflow-auto rounded-md">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <StickyTh>Item</StickyTh>
                  <StickyTh>Voucher</StickyTh>
                  <StickyTh right>Sold</StickyTh>
                  <StickyTh right>Returned</StickyTh>
                  <StickyTh>Method</StickyTh>
                  <StickyTh right>Amount</StickyTh>
                  <StickyTh right>Expected</StickyTh>
                  <StickyTh>Status</StickyTh>
                </tr>
              </thead>
              <tbody>
                {loading && !history.length ? (
                  <SkeletonRows cols={8} rows={5} />
                ) : (
                  history.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-white/[0.02]">
                      <Td>{row.item_name}</Td>
                      <Td className="font-mono text-xs text-sky-300">{row.voucher_number}</Td>
                      <Td right>{qty(row.sold_quantity)}</Td>
                      <Td right className="text-rose-300">{qty(row.returned_quantity)}</Td>
                      <Td>{row.payment_method}</Td>
                      <Td right>{money(row.sales_amount)}</Td>
                      <Td right className="text-zinc-400">{money(row.expected_amount)}</Td>
                      <Td>
                        <StatusPill status={row.status} tone={statusTone(row.status)} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && !history.length && <EmptyRow>No settlements yet.</EmptyRow>}
        </Panel>
      )}

      {view === "password" && <SalesChangePasswordPanel />}
    </>
  );
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "https://volosync-backend.vercel.app"}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("volosync.token")}`,
        ...init.headers,
      },
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body?.errors?.message ?? "Request failed");
  return body as T;
}

/** Table header that stays pinned while the table body scrolls under it. */
function StickyTh({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`sticky top-0 z-10 border-b border-white/10 bg-zinc-900 px-3 py-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function SkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-3 py-2.5">
              <Skeleton className="h-4 w-full bg-white/5" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SalesChangePasswordPanel() {
  return (
    <div className="mx-auto max-w-lg py-4">
      <Panel title="Change password" description="Update the password on your Sales login.">
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}
