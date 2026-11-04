/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Sales agent portal. The top menubar offers three flat views — Sales (the
// batch approval request), Active Orders (stock in hand) and History (the
// approvals raised from it). Password changes live in the header top bar, and
// signing out is a menu item, so neither is repeated here.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  money,
  qty,
  salesApi,
  statusTone,
  type OpenAssignment,
  type Settlement,
} from "@/lib/api";
import { useView } from "@/lib/use-view";
import { ROLE_META } from "@/components/volo/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Loader2,
  PackageCheck,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { ComboSelect, PaymentMethodPicker } from "@/components/volo/controls";
import {
  EmptyRow,
  Field,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  Td,
} from "@/components/volo/kit";

const SALES_DISABLED = "Sales role is disabled for this tenant.";

/** Deep links to removed views (stock, password) fall back to Sales. */
const SALES_VIEWS = new Set(ROLE_META.SALES.views ?? []);

type SaleLine = {
  key: number;
  assignment: string;
  sold_quantity: string;
  method: string;
};

function blankSaleLine(key: number): SaleLine {
  return {
    key,
    assignment: "",
    sold_quantity: "",
    method: "TELEBIRR",
  };
}

const LINE_ACCENTS = [
  { bar: "from-emerald-400 to-teal-300", chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  { bar: "from-violet-400 to-fuchsia-300", chip: "border-violet-400/30 bg-violet-400/10 text-violet-200" },
  { bar: "from-sky-400 to-cyan-300", chip: "border-sky-400/30 bg-sky-400/10 text-sky-200" },
];

const HERO = {
  sales: {
    title: "Sales approval request",
    description:
      "Add one line per voucher you sold. The amount is the selling price × sold quantity, and posting sends the whole batch to Finance at once.",
  },
  orders: {
    title: "Active orders",
    description: "Approved stock-outs still in your hands — everything here is open for a sales approval.",
  },
  history: {
    title: "My sales approvals",
    description: "Every sales approval you have raised, with where it stands in the Finance and Manager chain.",
  },
} as const;

export default function SalesPage() {
  const [rawView] = useView("sales");
  const view = SALES_VIEWS.has(rawView) ? rawView : "sales";
  const [mine, setMine] = useState<OpenAssignment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([blankSaleLine(1)]);
  const nextLineKey = useRef(2);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // The API answers as the signed-in agent, so both responses are already
    // limited to that agent's stock and approvals.
    const [openResponse, settlementResponse] = await Promise.all([
      salesApi.openAssignments(),
      salesApi.settlements(),
    ]);
    setMine(openResponse.data.assignments);
    setSettlements(settlementResponse.data);
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

  function patchLine(key: number, patch: Partial<SaleLine>) {
    setSaleLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setSaleLines((current) => [...current, blankSaleLine(nextLineKey.current++)]);
  }

  function removeLine(key: number) {
    setSaleLines((current) =>
      current.length === 1
        ? [blankSaleLine(nextLineKey.current++)]
        : current.filter((line) => line.key !== key),
    );
  }

  // The API already scopes every response to the signed-in agent, so whatever
  // is in hand here is theirs to settle.
  const lineChosen = (line: SaleLine) =>
    mine.find((row) => String(row.assignment) === line.assignment);
  const lineAmount = (line: SaleLine) => {
    const picked = lineChosen(line);
    return picked ? Number(picked.unit_price) * Number(line.sold_quantity || 0) : 0;
  };
  // Zero is a legitimate answer: the agent carried stock and sold none of it.
  const readyLines = saleLines.filter(
    (line) => line.assignment && line.sold_quantity.trim() !== "",
  );
  const stagedTotal = readyLines.reduce((sum, line) => sum + lineAmount(line), 0);

  async function submitBatch() {
    if (!readyLines.length) {
      toast.error("Add at least one sale line first.");
      return;
    }
    const invalid = saleLines.find((line) => {
      if (!line.assignment && !line.sold_quantity.trim()) return false;
      const picked = lineChosen(line);
      const sold = Number(line.sold_quantity);
      return (
        !picked ||
        line.sold_quantity.trim() === "" ||
        !Number.isFinite(sold) ||
        sold < 0 ||
        sold > Number(picked.assigned_quantity)
      );
    });
    if (invalid) {
      toast.error("Each filled line needs an assignment and a sold quantity within it.");
      return;
    }
    const duplicate = readyLines.find(
      (line, index) =>
        readyLines.findIndex((other) => other.assignment === line.assignment) !== index,
    );
    if (duplicate) {
      toast.error("Each assignment can appear only once per batch.");
      return;
    }
    setBusy(true);
    try {
      for (const line of readyLines) {
        await salesApi.createSettlement({
          assignment: Number(line.assignment),
          sold_quantity: line.sold_quantity,
          payment_method: line.method,
          sales_amount: lineAmount(line).toFixed(2),
        });
      }
      toast.success(`${readyLines.length} sale(s) sent to Finance for verification.`);
      setSaleLines([blankSaleLine(nextLineKey.current++)]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit sales");
    } finally {
      setBusy(false);
    }
  }

  const unitsInHand = mine.reduce((sum, row) => sum + Number(row.assigned_quantity), 0);
  const valueInHand = mine.reduce((sum, row) => sum + Number(row.expected_amount), 0);
  const awaitingApproval = settlements.filter(
    (row) => row.status === "PENDING_FINANCE" || row.status === "PENDING_MANAGER",
  ).length;

  const hero = HERO[view as keyof typeof HERO] ?? HERO.sales;

  if (disabled) {
    return (
      <>
        <PageHeader
          eyebrow="Sales workspace"
          title="Sales is switched off"
          description="A manager can turn the Sales role back on from the tenant settings; until then there is nothing to settle."
        />
        <Panel
          title="No sales workspace"
          description="Your stock, entry form and approval history appear here once the Sales role is on."
        >
          <EmptyRow>{SALES_DISABLED}</EmptyRow>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Sales workspace"
        title={hero.title}
        description={hero.description}
        stats={
          <>
            <StatCard
              label="Stock in hand"
              value={qty(unitsInHand)}
              hint={`${money(valueInHand)} at selling price`}
              tone="sky"
              icon={<PackageCheck className="size-4" />}
            />
            <StatCard
              label="Awaiting approval"
              value={String(awaitingApproval)}
              hint="Sales sent to Finance or the Manager"
              tone="amber"
              icon={<Clock className="size-4" />}
            />
          </>
        }
      />

      {view === "sales" && (
        <Panel
          title="Batch sale lines"
          description="Use Add line for more vouchers — posting sends every filled line at once."
          actions={
            <Button
              size="sm"
              onClick={submitBatch}
              disabled={busy || !readyLines.length}
              className="gap-2 bg-emerald-600 text-white shadow-[0_12px_30px_-16px_rgba(16,185,129,0.9)] hover:bg-emerald-500"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Post {readyLines.length || ""} sale{readyLines.length === 1 ? "" : "s"}
            </Button>
          }
        >
          <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/[0.08] via-[#0b0b13] to-violet-500/[0.07] p-4">
            <div className="pointer-events-none absolute -top-20 -right-12 size-48 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-emerald-300 uppercase">
                  <Sparkles className="size-3.5" /> Ready to send
                </p>
                <span className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span>{saleLines.length} line{saleLines.length === 1 ? "" : "s"}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-emerald-200">
                    {money(stagedTotal)}
                  </span>
                </span>
              </div>

              {!mine.length && !loading ? (
                <EmptyRow>
                  Nothing is stocked out to you right now, so there is nothing to settle.
                  Your active orders appear here once the Store approves an assignment.
                </EmptyRow>
              ) : (
                <div className="space-y-3">
                  {saleLines.map((line, index) => {
                    const accent = LINE_ACCENTS[index % LINE_ACCENTS.length];
                    const picked = lineChosen(line);
                    return (
                      <div
                        key={line.key}
                        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3 pl-4 sm:p-4 sm:pl-5"
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-1 bg-linear-to-b ${accent.bar}`}
                        />
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${accent.chip}`}
                          >
                            Line {String(index + 1).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            aria-label={`Remove sale line ${index + 1}`}
                            className="rounded-md p-1 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <X className="size-4" />
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <Field label="Assignment">
                            <ComboSelect
                              value={line.assignment}
                              onChange={(value) => {
                                const chosen = mine.find(
                                  (row) => String(row.assignment) === value,
                                );
                                patchLine(line.key, {
                                  assignment: value,
                                  sold_quantity: chosen?.assigned_quantity ?? "",
                                });
                              }}
                              options={mine.map((row) => ({
                                value: String(row.assignment),
                                label: `${row.agent_name || "Unassigned agent"} · ${row.item_name} · ${row.voucher_number} · ${qty(row.assigned_quantity)} @ ${money(row.unit_price)}`,
                              }))}
                              placeholder="Choose a voucher…"
                              searchPlaceholder="Search item or voucher…"
                              emptyText="No open assignments."
                            />
                          </Field>
                          <Field
                            label={`Sold quantity${picked ? ` (max ${qty(picked.assigned_quantity)})` : ""}`}
                          >
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              max={picked?.assigned_quantity}
                              value={line.sold_quantity}
                              onChange={(event) =>
                                patchLine(line.key, { sold_quantity: event.target.value })
                              }
                              placeholder="0.000"
                              className="border-white/10 bg-white/[0.03]"
                            />
                          </Field>
                          <Field label="Sales amount · system">
                            <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3">
                              <span className="text-sm font-semibold text-emerald-200">
                                {money(lineAmount(line))}
                              </span>
                              <span className="truncate text-[10px] text-emerald-300/70">
                                {picked
                                  ? `${money(picked.unit_price)} × ${qty(line.sold_quantity || 0)}`
                                  : "price × qty"}
                              </span>
                            </div>
                          </Field>
                        </div>

                        <div className="mt-3">
                          <Field label="Payment method">
                            <PaymentMethodPicker
                              name={`sale-method-${line.key}`}
                              value={line.method}
                              onChange={(value) => patchLine(line.key, { method: value })}
                            />
                          </Field>
                          <p className="mt-2 text-[11px] text-zinc-500">
                            Finance decides whether this sale carries a penalty when they approve it.
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addLine}
                    className="w-full gap-2 border-dashed border-white/20 bg-transparent text-zinc-300 hover:border-violet-400/40 hover:bg-violet-400/5 hover:text-violet-200"
                  >
                    <Plus className="size-4" /> Add line
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {view === "orders" && (
        <Panel
          title="Active orders"
          description="Approved stock-outs in hand that have not been settled yet."
        >
          <div className="max-h-[32rem] overflow-auto rounded-md">
            <table className="w-full min-w-175">
              <thead>
                <tr>
                  <StickyTh>Assignment</StickyTh>
                  <StickyTh right>Assigned</StickyTh>
                  <StickyTh right>Unit price</StickyTh>
                  <StickyTh right>Value</StickyTh>
                </tr>
              </thead>
              <tbody>
                {loading && !mine.length ? (
                  <SkeletonRows cols={4} />
                ) : (
                  mine.map((row) => (
                    <tr key={row.assignment} className="transition-colors hover:bg-white/2">
                      <Td>
                        <span className="block text-zinc-200">
                          {row.agent_name || "Unassigned agent"}
                          <span className="text-zinc-500"> · {row.item_name}</span>
                        </span>
                        <span className="block font-mono text-xs text-sky-300">
                          {row.voucher_number}
                        </span>
                      </Td>
                      <Td right>{qty(row.assigned_quantity)}</Td>
                      <Td right>{money(row.unit_price)}</Td>
                      <Td right className="text-emerald-300">{money(row.expected_amount)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && !mine.length && <EmptyRow>No active orders — nothing is stocked out to you.</EmptyRow>}
        </Panel>
      )}

      {view === "history" && (
        <Panel
          title="My sales approvals"
          description="Approvals you raised, newest first. Stock-outs are not listed here."
        >
          <div className="max-h-[32rem] overflow-auto rounded-md">
            <table className="w-full min-w-175">
              <thead>
                <tr>
                  <StickyTh>Sale</StickyTh>
                  <StickyTh right>Sold</StickyTh>
                  <StickyTh right>Returned</StickyTh>
                  <StickyTh>Method</StickyTh>
                  <StickyTh right>Amount</StickyTh>
                  <StickyTh>Status</StickyTh>
                </tr>
              </thead>
              <tbody>
                {loading && !settlements.length ? (
                  <SkeletonRows cols={6} />
                ) : (
                  settlements.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-white/2">
                      <Td>
                        <span className="block text-zinc-200">
                          {row.agent_name || "Unassigned agent"}
                          <span className="text-zinc-500"> · {row.item_name}</span>
                        </span>
                        <span className="block font-mono text-xs text-sky-300">
                          {row.voucher_number}
                        </span>
                      </Td>
                      <Td right>{qty(row.sold_quantity)}</Td>
                      <Td right className="text-rose-300">{qty(row.returned_quantity)}</Td>
                      <Td>{row.payment_method}</Td>
                      <Td right>{money(row.sales_amount)}</Td>
                      <Td>
                        <StatusPill status={row.status} tone={statusTone(row.status)} />
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && !settlements.length && (
            <EmptyRow>No sales approvals yet — post a batch from the Sales menu.</EmptyRow>
          )}
        </Panel>
      )}
    </>
  );
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
