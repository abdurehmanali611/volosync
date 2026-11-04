"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  FileDown,
  Layers3,
  Megaphone,
  Percent,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ComboSelect, DateField } from "@/components/volo/controls";
import { TableSearch } from "@/components/volo/payment-tax";
import { EmptyRow, Field, Panel, StatCard, Td, Th } from "@/components/volo/kit";
import { amount, money, qty } from "@/lib/api";
import { exportExcel, exportPdf } from "@/lib/export";
import type { ReceiptBusiness } from "@/lib/print";
import {
  REPORT_PERIODS,
  approvedInRange,
  collectedOf,
  expectedOf,
  periodLabel,
  shortfallOf,
  summariseInventoryInRange,
  summarisePromotions,
  totalise,
  type AgentGroup,
  type DateRange,
  type InventoryLikeRow,
  type PromotionLikeRow,
  type ReportPeriod,
  type SaleGroup,
  type SaleLikeRow,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ palette

const MONEY_TONE = {
  revenue: "hsl(160 70% 42%)",
  profit: "hsl(187 85% 45%)",
  units: "hsl(38 92% 52%)",
  category: "hsl(265 75% 62%)",
  penalty: "hsl(347 78% 58%)",
} as const;

const moneyConfig = {
  revenue: { label: "Expected gross", color: MONEY_TONE.revenue },
  profit: { label: "Profit", color: MONEY_TONE.profit },
} satisfies ChartConfig;

// ------------------------------------------------------------- range control

/**
 * The period strip that sits under the hero: one shadcn calendar as the anchor
 * day plus the preset it expands into, always pushed to the right.
 */
export function ReportingRangeBar({
  period,
  anchor,
  range,
  onPeriod,
  onAnchor,
  description = "Filters every card, chart and export below.",
}: {
  period: ReportPeriod;
  anchor: string;
  range: DateRange;
  onPeriod: (period: ReportPeriod) => void;
  onAnchor: (anchor: string) => void;
  description?: string;
}) {
  const sameDay = range.from === range.to;
  return (
    <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0d16]/70 px-3.5 py-2.5 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl">
      <div className="mr-auto flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-linear-to-br from-emerald-400/20 to-teal-400/5 text-emerald-200">
          <TrendingUp className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            {periodLabel(period)} report
          </p>
          <p className="truncate text-xs text-zinc-400">
            {sameDay ? range.from : `${range.from} → ${range.to}`}
            <span className="ml-2 hidden text-[11px] text-zinc-600 sm:inline">
              {description}
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-end gap-2">
        <Field label="Period">
          <ComboSelect
            value={period}
            onChange={(value) => onPeriod(value as ReportPeriod)}
            options={REPORT_PERIODS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            className="w-36"
          />
        </Field>
        <Field label="Anchor day">
          <DateField
            value={anchor}
            onChange={onAnchor}
            placeholder="Today"
            className="w-40"
          />
        </Field>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ KPI strip

type KpiTone = "emerald" | "amber" | "violet" | "rose" | "sky" | "slate";

const rangeCaption = (range: DateRange) =>
  range.from === range.to ? range.from : `${range.from} → ${range.to}`;

/**
 * The headline numbers for the current window, in one snapping rail. Exactly
 * three tiles are framed at a time, so the strip reads as a carousel rather
 * than a grid that has run out of room.
 */
export function ReportKpiStrip({
  groups,
  agents,
  inventory,
  promotions,
  range,
}: {
  groups: SaleGroup[];
  agents: AgentGroup[];
  inventory: InventoryLikeRow[];
  promotions: PromotionLikeRow[];
  range: DateRange;
}) {
  const totals = useMemo(() => totalise(groups), [groups]);
  const stock = useMemo(() => summariseInventoryInRange(inventory, range), [inventory, range]);
  const promo = useMemo(() => summarisePromotions(promotions, range), [promotions, range]);
  const collectedShare = totals.revenue > 0 ? (totals.collected / totals.revenue) * 100 : 0;
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const leader = agents.find((agent) => agent.revenue > 0 || agent.units > 0);

  const tiles: {
    label: string;
    value: string;
    hint: string;
    tone: KpiTone;
    icon: React.ReactNode;
  }[] = [
    {
      label: "Sold units",
      value: qty(totals.units),
      hint: `${totals.lines} settled line${totals.lines === 1 ? "" : "s"}`,
      tone: "amber",
      icon: <Boxes className="size-4" />,
    },
    {
      label: "Expected gross",
      value: money(totals.revenue),
      hint: "Selling price × sold units",
      tone: "emerald",
      icon: <TrendingUp className="size-4" />,
    },
    {
      label: "Collected gross",
      value: money(totals.collected),
      hint: `${collectedShare.toFixed(1)}% of expected`,
      tone: "sky",
      icon: <Wallet className="size-4" />,
    },
    {
      label: "Profit",
      value: money(totals.profit),
      hint: `${margin.toFixed(1)}% margin on sales`,
      tone: "violet",
      icon: <ArrowUpRight className="size-4" />,
    },
    {
      label: "VAT in revenue",
      value: money(totals.vat),
      hint: "Already inside the selling price",
      tone: "sky",
      icon: <Percent className="size-4" />,
    },
    {
      label: "In-store value",
      value: money(stock.inStoreValue),
      hint: `${stock.lots} lot${stock.lots === 1 ? "" : "s"} still on the shelf`,
      tone: "emerald",
      icon: <Layers3 className="size-4" />,
    },
    {
      label: "Returned units",
      value: qty(totals.returned),
      hint: "Brought back, not sold",
      tone: "rose",
      icon: <ArrowDownRight className="size-4" />,
    },
    {
      label: "Promotions",
      value: qty(promo.units),
      hint: `${promo.docs} doc${promo.docs === 1 ? "" : "s"} · ${money(promo.amount)}`,
      tone: "amber",
      icon: <Megaphone className="size-4" />,
    },
    {
      label: "Penalties",
      value: money(totals.penaltyAmount),
      hint: totals.penalties
        ? `${totals.penalties} raised · ${money(totals.penaltyAmount)} short`
        : "Every agent brought the full amount",
      tone: "rose",
      icon: <ShieldAlert className="size-4" />,
    },
    {
      label: "Best sales agent",
      value: leader ? leader.agentName || leader.label : "—",
      hint: leader
        ? `${money(leader.collected)} collected · ${qty(leader.units)} units`
        : "No settled sales in this window",
      tone: "violet",
      icon: <Trophy className="size-4" />,
    },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0d16]/70 p-3 backdrop-blur-xl">
      <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
          At a glance
        </p>
        <p className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="hidden tabular-nums sm:inline">{rangeCaption(range)}</span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <ArrowRight className="size-3" />
            scroll
          </span>
        </p>
      </div>
      <div className="scroll-fade-x scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="w-[calc((100%-1.5rem)/3)] min-w-[12.5rem] shrink-0 snap-start"
          >
            <StatCard
              label={tile.label}
              value={tile.value}
              hint={tile.hint}
              tone={tile.tone}
              icon={tile.icon}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------- export strip

export function ReportExportButtons({
  title,
  subtitle,
  headers,
  rows,
  totals,
  file,
  business,
  sheet,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
  file: string;
  business?: ReceiptBusiness;
  sheet?: string;
}) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-white/15 bg-transparent"
        disabled={!rows.length}
        onClick={() =>
          exportPdf({ title, subtitle, headers, rows, totals, file, business })
        }
      >
        <FileDown className="size-3.5" /> PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-white/15 bg-transparent"
        disabled={!rows.length}
        onClick={() =>
          exportExcel({ title, headers, rows, totals, file, sheet, business })
        }
      >
        <FileDown className="size-3.5" /> Excel
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- penalty UI

/**
 * Penalty verdict as one compact mark: the amount leads and the reasons Finance
 * wrote open in a popover.
 */
export function PenaltyMark({
  amountValue,
  penalties,
  compact = false,
}: {
  amountValue: number;
  penalties: { reason: string; item: string; voucher: string; day: string; amount: number }[];
  compact?: boolean;
}) {
  if (!amountValue && !penalties.length) {
    return <span className="text-xs text-zinc-600">—</span>;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/pen inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200 transition hover:border-rose-400/55 hover:bg-rose-500/20"
        >
          <ShieldAlert className="size-3 shrink-0" />
          {amount(amountValue)}
          <span className="text-[9px] font-semibold tracking-wider uppercase opacity-70">
            ETB
          </span>
          {!compact && penalties.length > 1 ? (
            <span className="text-[10px] opacity-70">·{penalties.length}</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-white/10 bg-zinc-950/95 p-0 shadow-xl backdrop-blur"
      >
        <div className="border-b border-white/10 px-3 py-2">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Penalties
          </p>
          <p className="mt-0.5 text-sm font-semibold text-rose-200">
            {money(amountValue)}
            <span className="ml-2 text-[11px] font-normal text-zinc-500">
              {penalties.length} record{penalties.length === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto p-3">
          {penalties.map((entry) => (
            <div
              key={`${entry.voucher}-${entry.day}`}
              className="rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] leading-snug font-medium text-rose-100">
                  {entry.reason}
                </p>
                <Badge
                  variant="secondary"
                  className="shrink-0 border border-rose-400/25 bg-rose-500/15 text-[10px] text-rose-200"
                >
                  {amount(entry.amount)} ETB
                </Badge>
              </div>
              <p className="mt-1 text-[10.5px] text-zinc-400">
                {entry.item} · <span className="font-mono">{entry.voucher}</span> · {entry.day}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------- reporting cards

function SummaryRow({
  label,
  value,
  tone = "zinc",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "zinc" | "emerald" | "amber" | "violet" | "rose" | "sky";
  strong?: boolean;
}) {
  const toneClass = {
    zinc: "text-zinc-200",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
    rose: "text-rose-300",
    sky: "text-sky-300",
  }[tone];
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-white/5 py-1.5 text-sm last:border-b-0",
        strong && "rounded-lg bg-white/[0.03] px-2",
      )}
    >
      <span className="min-w-0 truncate text-zinc-400">{label}</span>
      <span
        className={cn("shrink-0 font-semibold tabular-nums whitespace-nowrap", toneClass)}
      >
        {value}
      </span>
    </div>
  );
}

/** Registered stock, what is still in store and what left — inside the window. */
export function InventoryReportingCard({
  rows,
  range,
  business,
  tenantName,
}: {
  rows: {
    item_name: string;
    category: string;
    voucher_number: string;
    registered_qty: string;
    in_store_qty: string;
    stocked_out_qty: string;
    registered_value: string;
    in_store_value: string;
    stocked_out_value: string;
    base_value: string;
    vat_amount: string;
    inclusive_amount: string;
    output_vat: string;
    supplier_name?: string;
    registration_date?: string;
  }[];
  range: DateRange;
  business?: ReceiptBusiness;
  tenantName?: string;
}) {
  const [query, setQuery] = useState("");

  const scoped = useMemo(
    () =>
      rows.filter((row) => {
        const day = row.registration_date ?? "";
        const inWindow = !day || (day >= range.from && day <= range.to);
        const needle = query.trim().toLowerCase();
        const matches =
          !needle ||
          [row.item_name, row.category, row.voucher_number, row.supplier_name ?? ""].some(
            (value) => value.toLowerCase().includes(needle),
          );
        return inWindow && matches;
      }),
    [rows, range, query],
  );

  const totals = scoped.reduce(
    (sum, row) => ({
      registeredValue: sum.registeredValue + Number(row.registered_value),
      inStoreValue: sum.inStoreValue + Number(row.in_store_value),
      stockedOutValue: sum.stockedOutValue + Number(row.stocked_out_value),
      base: sum.base + Number(row.base_value),
      inputVat: sum.inputVat + Number(row.vat_amount),
      outputVat: sum.outputVat + Number(row.output_vat),
      inclusive: sum.inclusive + Number(row.inclusive_amount),
      registeredQty: sum.registeredQty + Number(row.registered_qty),
      stockedOutQty: sum.stockedOutQty + Number(row.stocked_out_qty),
      items: sum.items + 1,
    }),
    {
      registeredValue: 0,
      inStoreValue: 0,
      stockedOutValue: 0,
      base: 0,
      inputVat: 0,
      outputVat: 0,
      inclusive: 0,
      registeredQty: 0,
      stockedOutQty: 0,
      items: 0,
    },
  );

  const headers = [
    "Voucher",
    "Item",
    "Category",
    "Supplier",
    "Registered",
    "In store",
    "Stocked out",
    "In store value",
    "Stocked out value",
    "Input VAT",
    "Output VAT",
  ];
  const exportRows = scoped.map((row) => [
    row.voucher_number,
    row.item_name,
    row.category,
    row.supplier_name ?? "",
    Number(row.registered_qty),
    Number(row.in_store_qty),
    Number(row.stocked_out_qty),
    Number(row.in_store_value),
    Number(row.stocked_out_value),
    Number(row.vat_amount),
    Number(row.output_vat),
  ]);
  const exportTotals = [
    "Totals",
    `${scoped.length} lots`,
    "",
    "",
    totals.registeredQty,
    scoped.reduce((sum, row) => sum + Number(row.in_store_qty), 0),
    totals.stockedOutQty,
    totals.inStoreValue,
    totals.stockedOutValue,
    totals.inputVat,
    totals.outputVat,
  ];

  // A search box should change something the eye can see, not only the totals.
  const biggest = useMemo(
    () =>
      [...scoped]
        .sort((a, b) => Number(b.in_store_value) - Number(a.in_store_value))
        .slice(0, 5),
    [scoped],
  );

  const sameDay = range.from === range.to;
  return (
    <Panel
      fill
      tone="emerald"
      title="Inventory reporting"
      description={
        sameDay
          ? `Vouchers registered on ${range.from}.`
          : `Vouchers registered between ${range.from} and ${range.to}.`
      }
      actions={
        <ReportExportButtons
          title="Inventory reporting"
          subtitle={`${tenantName ?? "Wholesale business"} · ${range.from} → ${range.to}`}
          headers={headers}
          rows={exportRows}
          totals={exportTotals}
          file="volosync-inventory-reporting"
          business={business}
          sheet="Inventory"
        />
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search item, voucher or supplier"
          className="w-56 sm:w-64"
        />
        <span className="text-xs text-zinc-500">
          {scoped.length} voucher lot{scoped.length === 1 ? "" : "s"} in this window
        </span>
      </div>
      <div className="grid shrink-0 gap-1.5 sm:grid-cols-2">
        <SummaryRow label="Registered value" value={money(totals.registeredValue)} />
        <SummaryRow label="In store value" value={money(totals.inStoreValue)} tone="sky" />
        <SummaryRow
          label="Stocked out value"
          value={money(totals.stockedOutValue)}
          tone="violet"
        />
        <SummaryRow label="Base value (ex VAT)" value={money(totals.base)} />
        <SummaryRow label="Input VAT" value={money(totals.inputVat)} tone="amber" />
        <SummaryRow label="Output VAT" value={money(totals.outputVat)} tone="rose" />
        <SummaryRow
          label="Net VAT (output − input)"
          value={money(totals.outputVat - totals.inputVat)}
          tone="emerald"
        />
        <SummaryRow
          label="Paid to suppliers"
          value={money(totals.inclusive)}
          strong
        />
      </div>

      <div className="mt-4 flex-1 space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
          Largest in-store holdings
        </p>
        {biggest.length ? (
          biggest.map((row, index) => (
            <div
              key={`${row.voucher_number}-${row.item_name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-sm transition hover:border-white/15 hover:bg-white/[0.04]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] text-[10px] font-semibold text-emerald-200">
                  {qty(row.in_store_qty)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-zinc-200">{row.item_name}</span>
                  <span className="block truncate font-mono text-[10px] text-cyan-300/70">
                    {row.voucher_number}
                    {row.supplier_name ? ` · ${row.supplier_name}` : ""}
                  </span>
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-zinc-100">
                {money(row.in_store_value)}
              </span>
            </div>
          ))
        ) : (
          <EmptyRow>No voucher lots registered in this window.</EmptyRow>
        )}
      </div>
    </Panel>
  );
}

/** Sales, profit, VAT and penalty standing for the same reporting window. */
export function SalesAgentsCard({
  items,
  agents,
  range,
  business,
  tenantName,
}: {
  items: SaleGroup[];
  agents: AgentGroup[];
  range: DateRange;
  business?: ReceiptBusiness;
  tenantName?: string;
}) {
  const totals = totalise(items);
  const penaltyAmount = agents.reduce((sum, agent) => sum + agent.penaltyAmount, 0);
  const penaltyCount = agents.reduce((sum, agent) => sum + agent.penalties.length, 0);
  const margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;
  const top = [...agents]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <Panel
      fill
      tone="sky"
      title="Sales & agents"
      description={`Approved settlements from ${range.from === range.to ? range.from : `${range.from} → ${range.to}`}.`}
      actions={
        <ReportExportButtons
          title="Sales & agents summary"
          subtitle={`${tenantName ?? "Wholesale business"} · ${range.from} → ${range.to}`}
          headers={["Metric", "Value"]}
          rows={[
            ["Expected gross", totals.revenue],
            ["Collected gross", Number(totals.collected.toFixed(2))],
            ["Units sold", totals.units],
            ["Settled lines", totals.lines],
            ["Gross profit", totals.profit],
            ["Margin %", Number(margin.toFixed(2))],
            ["VAT inside sales", totals.vat],
            ["Penalty amount", penaltyAmount],
            ["Penalty records", penaltyCount],
          ]}
          file="volosync-sales-agents-summary"
          business={business}
          sheet="Sales summary"
        />
      }
    >
      <div className="grid shrink-0 gap-1.5 sm:grid-cols-2">
        <SummaryRow label="Expected gross" value={money(totals.revenue)} tone="emerald" />
        <SummaryRow label="Collected gross" value={money(totals.collected)} tone="sky" />
        <SummaryRow label="Units sold" value={qty(totals.units)} />
        <SummaryRow label="Settled lines" value={String(totals.lines)} />
        <SummaryRow label="Gross profit" value={money(totals.profit)} tone="violet" />
        <SummaryRow label="Margin" value={`${margin.toFixed(1)} %`} />
        <SummaryRow label="VAT inside sales" value={money(totals.vat)} tone="amber" />
        <SummaryRow
          label="Penalties"
          value={penaltyAmount ? `${money(penaltyAmount)} · ${penaltyCount}` : "None"}
          tone={penaltyAmount ? "rose" : "zinc"}
          strong
        />
      </div>
      <div className="mt-4 flex-1 space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
          Leading agents
        </p>
        {top.length ? (
          top.map((agent) => (
            <div
              key={agent.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 transition hover:border-white/15 hover:bg-white/[0.04]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[10px] font-semibold text-zinc-300">
                  {agent.sublabel || "–"}
                </span>
                <span className="truncate text-sm text-zinc-200">{agent.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {agent.penaltyAmount ? (
                  <PenaltyMark amountValue={agent.penaltyAmount} penalties={agent.penalties} compact />
                ) : null}
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-emerald-300">
                    {money(agent.revenue)}
                  </span>
                  <span
                    className={cn(
                      "block text-[10px] tabular-nums",
                      agent.revenue - agent.collected > 0.005 ? "text-rose-300" : "text-zinc-500",
                    )}
                  >
                    {money(agent.collected)} in
                  </span>
                </span>
              </span>
            </div>
          ))
        ) : (
          <EmptyRow>No approved settlements in this window.</EmptyRow>
        )}
      </div>
    </Panel>
  );
}

// --------------------------------------------------- category & item charts

const GROUP_HEADERS = [
  "Name",
  "Group",
  "Lines",
  "Units sold",
  "Returned",
  "Expected gross",
  "Collected gross",
  "Penalty",
  "Cost",
  "Profit",
  "VAT in sales",
  "Margin %",
];

function groupMatrix(groups: SaleGroup[]) {
  return groups.map((group) => [
    group.label,
    group.sublabel,
    group.lines,
    Number(group.units.toFixed(3)),
    Number(group.returned.toFixed(3)),
    Number(group.revenue.toFixed(2)),
    Number(group.collected.toFixed(2)),
    Number(group.penaltyAmount.toFixed(2)),
    Number(group.cost.toFixed(2)),
    Number(group.profit.toFixed(2)),
    Number(group.vat.toFixed(2)),
    Number((group.revenue ? (group.profit / group.revenue) * 100 : 0).toFixed(1)),
  ]);
}

/** Which slice of the sale matrix the performance panels are reading. */
export type ReportLens = "category" | "item";

const REPORT_LENSES: Record<ReportLens, { label: string; icon: typeof Boxes }> = {
  category: { label: "By category", icon: Layers3 },
  item: { label: "By item", icon: Boxes },
};

/**
 * Full-width lens switch that sits above the performance row, so the choice
 * governs both the chart card and the table card instead of living inside one.
 */
export function ReportLensBar({
  mode,
  onMode,
  categories,
  items,
  range,
}: {
  mode: ReportLens;
  onMode: (mode: ReportLens) => void;
  categories: number;
  items: number;
  range: DateRange;
}) {
  const sameDay = range.from === range.to;
  const LensIcon = REPORT_LENSES[mode].icon;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16]/70 p-3 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] ring-1 ring-white/3 backdrop-blur-xl">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-violet-400/85 via-fuchsia-300/35 to-transparent"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-400/25 to-fuchsia-400/10 text-violet-200 ring-1 ring-violet-400/30 shadow-[0_0_18px_-6px_rgba(167,139,250,0.8)]">
          <LensIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-heading text-sm font-semibold text-white">
            Performance lens
            <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-violet-200 uppercase">
              {REPORT_LENSES[mode].label}
            </span>
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {categories} {categories === 1 ? "category" : "categories"} and {items}{" "}
            {items === 1 ? "item" : "items"} sold{" "}
            {sameDay ? `on ${range.from}` : `between ${range.from} and ${range.to}`} —
            ranked for sales, profit, units and the VAT inside.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Performance grouping"
          className="flex rounded-xl border border-white/10 bg-black/25 p-1"
        >
          {(Object.keys(REPORT_LENSES) as ReportLens[]).map((option) => {
            const lens = REPORT_LENSES[option];
            const Icon = lens.icon;
            const active = mode === option;
            return (
              <button
                key={option}
                role="tab"
                aria-selected={active}
                onClick={() => onMode(option)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                  active
                    ? "bg-linear-to-r from-violet-400/25 to-fuchsia-400/15 text-violet-100 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35),0_10px_24px_-16px_rgba(167,139,250,0.9)]"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                <Icon className="size-3.5" />
                {lens.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Category- and item-level performance, graphical, with the table beneath. */
export function CategoryItemReport({
  mode,
  categories,
  items,
  range,
  business,
  tenantName,
  limit = 8,
}: {
  mode: ReportLens;
  categories: SaleGroup[];
  items: SaleGroup[];
  range: DateRange;
  business?: ReceiptBusiness;
  tenantName?: string;
  limit?: number;
}) {
  const source = mode === "category" ? categories : items;
  const leading = source.slice(0, limit);
  const totals = totalise(source);
  const chartData = leading.map((group) => ({
    name:
      group.label.length > 14 ? `${group.label.slice(0, 13)}…` : group.label,
    revenue: Number(group.revenue.toFixed(2)),
    profit: Number(group.profit.toFixed(2)),
    units: Number(group.units.toFixed(3)),
  }));
  const maxUnits = Math.max(1, ...leading.map((group) => group.units));
  const empty = !source.length;

  return (
    <Panel
      fill
      tone="violet"
      title={mode === "category" ? "Category performance" : "Item performance"}
      description="What each category and item sold, what was collected against it, the profit and the VAT inside that revenue."
      actions={
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ReportExportButtons
            title={mode === "category" ? "Category performance" : "Item performance"}
            subtitle={`${tenantName ?? "Wholesale business"} · ${range.from} → ${range.to}`}
            headers={GROUP_HEADERS}
            rows={groupMatrix(source)}
            totals={[
              "Totals",
              `${source.length} ${mode === "category" ? "categories" : "items"}`,
              totals.lines,
              Number(totals.units.toFixed(3)),
              Number(totals.returned.toFixed(3)),
              Number(totals.revenue.toFixed(2)),
              Number(totals.collected.toFixed(2)),
              Number(totals.penaltyAmount.toFixed(2)),
              Number(totals.cost.toFixed(2)),
              Number(totals.profit.toFixed(2)),
              Number(totals.vat.toFixed(2)),
              Number((totals.revenue ? (totals.profit / totals.revenue) * 100 : 0).toFixed(1)),
            ]}
            file={
              mode === "category"
                ? "volosync-category-performance"
                : "volosync-item-performance"
            }
            business={business}
            sheet={mode === "category" ? "Categories" : "Items"}
          />
        </div>
      }
    >
      {empty ? (
        <EmptyRow>
          Nothing was sold in this window — approved settlements appear here as they clear.
        </EmptyRow>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-2">
                <Layers3 className="size-3.5 text-emerald-300" />
                <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                  Sales vs profit
                </p>
              </div>
              <ChartContainer config={moneyConfig} className="h-56 w-full">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={54}
                    style={{ fontSize: 10, fill: "rgb(161 161 170)" }}
                  />
                  <YAxis
                    width={54}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => amount(value).replace(/\.00$/, "")}
                    style={{ fontSize: 10, fill: "rgb(161 161 170)" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill={MONEY_TONE.revenue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill={MONEY_TONE.profit} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="mb-2 flex shrink-0 items-center gap-2">
                <Boxes className="size-3.5 text-amber-300" />
                <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                  Units sold
                </p>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-2.5">
                {leading.map((group, index) => (
                  <div key={group.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-zinc-300">{group.label}</span>
                      <span className="shrink-0 tabular-nums text-amber-200">
                        {qty(group.units)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-amber-400 via-orange-300 to-rose-300 transition-[width] duration-500"
                        style={{
                          width: `${Math.max(4, (group.units / maxUnits) * 100)}%`,
                          opacity: 1 - index * 0.06,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <MiniStat
              icon={<Receipt className="size-3.5" />}
              label="Expected gross"
              value={money(totals.revenue)}
              tone="emerald"
            />
            <MiniStat
              icon={<Wallet className="size-3.5" />}
              label="Collected gross"
              value={money(totals.collected)}
              tone="sky"
            />
            <MiniStat
              icon={<TrendingUp className="size-3.5" />}
              label="Profit"
              value={money(totals.profit)}
              tone="violet"
            />
            <MiniStat
              icon={<ShieldAlert className="size-3.5" />}
              label="Penalty"
              value={money(totals.penaltyAmount)}
              tone="rose"
            />
            <MiniStat
              icon={<ArrowDownRight className="size-3.5" />}
              label="VAT in sales"
              value={money(totals.vat)}
              tone="amber"
            />
            <MiniStat
              icon={<Layers3 className="size-3.5" />}
              label={mode === "category" ? "Categories" : "Items"}
              value={String(source.length)}
              tone="zinc"
            />
          </div>

          <div className="mt-4 max-h-[26rem] min-h-[12rem] flex-1 overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr>
                  <Th>{mode === "category" ? "Category" : "Item"}</Th>
                  <Th>{mode === "category" ? "Items" : "Category"}</Th>
                  <Th right>Lines</Th>
                  <Th right>Units sold</Th>
                  <Th right>Expected</Th>
                  <Th right>Collected</Th>
                  <Th right>Profit</Th>
                  <Th right>VAT</Th>
                  <Th right>Margin</Th>
                </tr>
              </thead>
              <tbody>
                {source.map((group) => (
                  <tr key={group.key} className="transition hover:bg-white/[0.03]">
                    <Td className="text-zinc-100">{group.label}</Td>
                    <Td className="text-zinc-400">{group.sublabel}</Td>
                    <Td right>{group.lines}</Td>
                    <Td right className="text-amber-200">
                      {qty(group.units)}
                    </Td>
                    <Td right className="text-emerald-300">
                      {money(group.revenue)}
                    </Td>
                    <Td
                      right
                      className={
                        group.revenue - group.collected > 0.005
                          ? "text-rose-300"
                          : "text-sky-300"
                      }
                    >
                      {money(group.collected)}
                    </Td>
                    <Td right className="text-violet-300">
                      {money(group.profit)}
                    </Td>
                    <Td right className="text-amber-300">
                      {money(group.vat)}
                    </Td>
                    <Td right className="text-zinc-300">
                      {group.revenue ? `${((group.profit / group.revenue) * 100).toFixed(1)} %` : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.03]">
                  <Td className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Totals
                  </Td>
                  <Td className="text-zinc-600">—</Td>
                  <Td right className="font-semibold text-white">
                    {totals.lines}
                  </Td>
                  <Td right className="font-semibold text-white">
                    {qty(totals.units)}
                  </Td>
                  <Td right className="font-semibold text-emerald-300">
                    {money(totals.revenue)}
                  </Td>
                  <Td right className="font-semibold text-sky-300">
                    {money(totals.collected)}
                  </Td>
                  <Td right className="font-semibold text-violet-300">
                    {money(totals.profit)}
                  </Td>
                  <Td right className="font-semibold text-amber-300">
                    {money(totals.vat)}
                  </Td>
                  <Td right className="font-semibold text-white">
                    {totals.revenue
                      ? `${((totals.profit / totals.revenue) * 100).toFixed(1)} %`
                      : "—"}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "emerald" | "sky" | "violet" | "amber" | "rose" | "zinc";
}) {
  const toneClass = {
    emerald: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200",
    sky: "border-sky-400/25 bg-sky-400/[0.07] text-sky-200",
    violet: "border-violet-400/25 bg-violet-400/[0.07] text-violet-200",
    amber: "border-amber-400/25 bg-amber-400/[0.07] text-amber-200",
    rose: "border-rose-400/25 bg-rose-400/[0.07] text-rose-200",
    zinc: "border-white/10 bg-white/[0.03] text-zinc-200",
  }[tone];
  // Labels stay on one line and long figures shrink instead of wrapping, so
  // every tile in the strip keeps the same height.
  const valueClass =
    value.length > 16 ? "text-[13px]" : value.length > 12 ? "text-[14px]" : "text-[15px]";
  return (
    <div
      className={cn(
        "flex flex-col gap-2 overflow-hidden rounded-xl border px-2.5 py-2.5 transition duration-200 hover:brightness-125",
        toneClass,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/[0.07]">
          {icon}
        </span>
        <p className="text-[8.5px] leading-none font-semibold tracking-[0.08em] whitespace-nowrap uppercase opacity-75">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "leading-none font-semibold tabular-nums whitespace-nowrap",
          valueClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ------------------------------------------------------------ agent table

/**
 * Agent-level reporting as a data table: sales, units, profit, the VAT inside
 * each agent's revenue and the penalties raised against them — searchable and
 * filterable by agent.
 */
export function AgentPerformanceReport({
  agents,
  agentOptions,
  range,
  business,
  tenantName,
}: {
  agents: AgentGroup[];
  agentOptions: { value: string; label: string }[];
  range: DateRange;
  business?: ReceiptBusiness;
  tenantName?: string;
}) {
  const [query, setQuery] = useState("");
  const [agentId, setAgentId] = useState("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const byAgent = agentId === "all" || agent.key === `agent-${agentId}`;
      const byQuery =
        !needle ||
        [agent.label, agent.sublabel, agent.penalties.map((entry) => entry.reason).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return byAgent && byQuery;
    });
  }, [agents, agentId, query]);

  const totals = totalise(visible);
  const headers = [
    "Rank",
    "Agent",
    "Settled lines",
    "Units sold",
    "Expected gross",
    "Collected gross",
    "Profit",
    "VAT in sales",
    "Penalty amount",
    "Penalty reasons",
  ];
  const rows = visible.map((agent) => [
    Number(agent.sublabel || 0),
    agent.label,
    agent.lines,
    Number(agent.units.toFixed(3)),
    Number(agent.revenue.toFixed(2)),
    Number(agent.collected.toFixed(2)),
    Number(agent.profit.toFixed(2)),
    Number(agent.vat.toFixed(2)),
    Number(agent.penaltyAmount.toFixed(2)),
    agent.penalties.map((entry) => `${entry.reason} (${amount(entry.amount)})`).join(" · "),
  ]);
  const exportTotals = [
    "",
    "Totals",
    totals.lines,
    Number(totals.units.toFixed(3)),
    Number(totals.revenue.toFixed(2)),
    Number(totals.collected.toFixed(2)),
    Number(totals.profit.toFixed(2)),
    Number(totals.vat.toFixed(2)),
    Number(totals.penaltyAmount.toFixed(2)),
    "",
  ];

  return (
    <Panel
      fill
      tone="amber"
      title="Agent performance"
      description="Ranking follows the penalty amount first, then revenue — the reasons sit behind each mark."
      actions={
        <ReportExportButtons
          title="Agent performance"
          subtitle={`${tenantName ?? "Wholesale business"} · ${range.from} → ${range.to}`}
          headers={headers}
          rows={rows}
          totals={exportTotals}
          file="volosync-agent-performance"
          business={business}
          sheet="Agents"
        />
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search agent or penalty reason"
          className="w-56 sm:w-64"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-zinc-500">
            {visible.length} of {agents.length} agent{agents.length === 1 ? "" : "s"}
          </span>
          <div className="w-52">
            <ComboSelect
              value={agentId}
              onChange={setAgentId}
              options={[{ value: "all", label: "All sales agents" }, ...agentOptions]}
              placeholder="All sales agents"
            />
          </div>
        </div>
      </div>

      <div className="max-h-[26rem] min-h-[12rem] flex-1 overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <Th>Rank</Th>
              <Th>Agent</Th>
              <Th right>Lines</Th>
              <Th right>Units</Th>
              <Th right>Expected</Th>
              <Th right>Collected</Th>
              <Th right>Penalty</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((agent) => {
              const short = agent.revenue - agent.collected > 0.005;
              return (
                <tr key={agent.key} className="transition hover:bg-white/[0.03]">
                  <Td>
                    <RankBadge rank={Number(agent.sublabel) || 0} />
                  </Td>
                  <Td className="text-zinc-100">
                    <span className="flex items-center gap-2">
                      <Users className="size-3.5 shrink-0 text-zinc-500" />
                      <span className="min-w-0">
                        <span className="block truncate">{agent.label}</span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {money(agent.profit)} profit · {money(agent.vat)} VAT
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td right className="text-zinc-400">
                    {agent.lines}
                  </Td>
                  <Td right className="text-amber-200">
                    {qty(agent.units)}
                  </Td>
                  <Td right className="text-emerald-300">
                    {money(agent.revenue)}
                  </Td>
                  <Td
                    right
                    className={short ? "text-rose-300" : "text-sky-300"}
                  >
                    {money(agent.collected)}
                  </Td>
                  <Td right>
                    <PenaltyMark amountValue={agent.penaltyAmount} penalties={agent.penalties} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 bg-white/[0.03]">
              <Td className="text-[11px] font-semibold text-zinc-400 uppercase">—</Td>
              <Td className="text-[11px] font-semibold text-zinc-400 uppercase">Totals</Td>
              <Td right className="font-semibold text-white">
                {totals.lines}
              </Td>
              <Td right className="font-semibold text-white">
                {qty(totals.units)}
              </Td>
              <Td right className="font-semibold text-emerald-300">
                {money(totals.revenue)}
              </Td>
              <Td right className="font-semibold text-sky-300">
                {money(totals.collected)}
              </Td>
              <Td right className="font-semibold text-rose-300">
                {money(totals.penaltyAmount)}
              </Td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!visible.length && (
        <EmptyRow>
          {query.trim() || agentId !== "all"
            ? "No agent matches these filters."
            : "No approved settlements in this window."}
        </EmptyRow>
      )}
    </Panel>
  );
}

/** Every penalty Finance raised in the window, with the reason beside it. */
export function PenaltyReport({
  groups,
  range,
  business,
  tenantName,
}: {
  groups: SaleGroup[];
  range: DateRange;
  business?: ReceiptBusiness;
  tenantName?: string;
}) {
  const [query, setQuery] = useState("");

  const marks = useMemo(
    () =>
      groups
        .flatMap((group) =>
          group.penalties.map((entry) => ({ ...entry, agent: group.label })),
        )
        .sort((a, b) => b.day.localeCompare(a.day)),
    [groups],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return marks;
    return marks.filter((mark) =>
      [mark.agent, mark.item, mark.voucher, mark.reason, mark.day]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [marks, query]);

  const total = visible.reduce((sum, mark) => sum + mark.amount, 0);
  const headers = ["Day", "Agent", "Item", "Voucher", "Amount", "Reason"];
  const rows = visible.map((mark) => [
    mark.day,
    mark.agent,
    mark.item,
    mark.voucher,
    Number(mark.amount.toFixed(2)),
    mark.reason,
  ]);

  return (
    <Panel
      fill
      tone="rose"
      title="Penalty register"
      description="Each verdict Finance raised, its amount and the reason behind it."
      actions={
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-200">
            {marks.length} raised · {money(marks.reduce((sum, mark) => sum + mark.amount, 0))}
          </span>
          <ReportExportButtons
            title="Penalty register"
            subtitle={`${tenantName ?? "Wholesale business"} · ${range.from} → ${range.to}`}
            headers={headers}
            rows={rows}
            totals={["Totals", `${visible.length} penalties`, "", "", Number(total.toFixed(2)), ""]}
            file="volosync-penalty-register"
            business={business}
            sheet="Penalties"
          />
        </div>
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search agent, item, voucher or reason"
            className="w-60 sm:w-72"
          />
          <span className="text-xs text-zinc-500">
            {visible.length} of {marks.length} penalty record{marks.length === 1 ? "" : "s"}
          </span>
        </div>

        {visible.length ? (
          <div className="max-h-[28rem] min-h-[10rem] flex-1 overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr>
                  <Th>Day</Th>
                  <Th>Agent</Th>
                  <Th>Item</Th>
                  <Th>Voucher</Th>
                  <Th right>Amount</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((mark) => (
                  <tr
                    key={`${mark.id}-${mark.voucher}`}
                    className="transition hover:bg-rose-500/[0.05]"
                  >
                    <Td className="text-zinc-400">{mark.day}</Td>
                    <Td className="text-zinc-100">{mark.agent}</Td>
                    <Td>{mark.item}</Td>
                    <Td className="font-mono text-xs text-cyan-300">{mark.voucher}</Td>
                    <Td right>
                      <Badge
                        variant="secondary"
                        className="border border-rose-400/30 bg-rose-500/15 text-[11px] text-rose-200"
                      >
                        {money(mark.amount)}
                      </Badge>
                    </Td>
                    <Td className="max-w-[26rem] text-[12px] leading-snug whitespace-normal text-zinc-300">
                      {mark.reason}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.03]">
                  <Td className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Totals
                  </Td>
                  <Td className="text-zinc-600">—</Td>
                  <Td className="text-zinc-600">—</Td>
                  <Td className="text-zinc-600">—</Td>
                  <Td right className="font-semibold text-rose-300">
                    {money(total)}
                  </Td>
                  <Td className="text-zinc-500">{visible.length} penalties</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EmptyRow>
            {query.trim()
              ? `No penalties match “${query.trim()}”.`
              : "No penalties raised in this window."}
          </EmptyRow>
        )}
      </div>
    </Panel>
  );
}

const RANK_TONE = [
  "border-amber-400/40 bg-amber-400/15 text-amber-200",
  "border-zinc-300/30 bg-zinc-300/10 text-zinc-200",
  "border-orange-400/40 bg-orange-400/15 text-orange-200",
];

function RankBadge({ rank }: { rank: number }) {
  if (!rank) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <span
      className={cn(
        "inline-grid size-7 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
        RANK_TONE[rank - 1] ?? "border-white/10 bg-white/[0.04] text-zinc-400",
      )}
    >
      {rank}
    </span>
  );
}

// ------------------------------------------------------ collection & stock
//
// These three panels render identically in Finance and Manager: the same
// props in, the same picture out, so neither workspace can drift ahead.

const METHOD_ICON: Record<string, React.ReactNode> = {
  TELEBIRR: <Receipt className="size-3.5" />,
  BANK: <Wallet className="size-3.5" />,
  RECEIPT: <Layers3 className="size-3.5" />,
};

/**
 * Payment channels, the money the agents actually handed over and the stock
 * given away on promotion — all measured on the reporting window.
 */
export function CollectionMethodsReport({
  rows,
  range,
  methods,
  vat,
  promotions,
}: {
  rows: SaleLikeRow[];
  range: DateRange;
  methods: { value: string; label: string }[];
  vat: { input: number; output: number; net: number };
  promotions: PromotionLikeRow[];
}) {
  const approved = useMemo(() => approvedInRange(rows, range), [rows, range]);
  const promo = useMemo(() => summarisePromotions(promotions, range), [promotions, range]);

  const { expected, penalty, collected } = approved.reduce(
    (sum, row) => ({
      expected: sum.expected + expectedOf(row),
      penalty: sum.penalty + shortfallOf(row),
      collected: sum.collected + collectedOf(row),
    }),
    { expected: 0, penalty: 0, collected: 0 },
  );
  const returned = approved.reduce((sum, row) => sum + Number(row.returned_quantity || 0), 0);
  const penaltyCount = approved.filter((row) => row.penalty).length;
  const share = expected > 0 ? (collected / expected) * 100 : 0;

  const channels = methods.map((method) => {
    const held = approved.filter((row) => row.payment_method === method.value);
    const gross = held.reduce((sum, row) => sum + expectedOf(row), 0);
    const grossCollected = held.reduce((sum, row) => sum + collectedOf(row), 0);
    return {
      code: method.value,
      label: method.label,
      value: gross,
      collected: grossCollected,
      penalty: gross - grossCollected,
      pct: expected > 0 ? (gross / expected) * 100 : 0,
    };
  });

  return (
    <Panel
      fill
      tone="indigo"
      title="Collection methods"
      description="Approved settlement value per payment channel in this window."
      actions={
        <Badge
          variant="outline"
          className="border-indigo-400/30 bg-indigo-400/10 text-indigo-200"
        >
          {share.toFixed(1)}% collected
        </Badge>
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-3">
        <MiniStat
          icon={<TrendingUp className="size-3" />}
          label="Expected gross"
          value={money(expected)}
          tone="emerald"
        />
        <MiniStat
          icon={<Wallet className="size-3" />}
          label="Collected gross"
          value={money(collected)}
          tone="sky"
        />
        <MiniStat
          icon={<ShieldAlert className="size-3" />}
          label="Penalty shortfall"
          value={money(penalty)}
          tone="amber"
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {channels.map((channel) => (
          <div key={channel.code} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-indigo-200">
                  {METHOD_ICON[channel.code] ?? <Receipt className="size-3.5" />}
                </span>
                <span className="truncate">{channel.label}</span>
                {channel.penalty > 0 && (
                  <span className="shrink-0 rounded-full border border-rose-400/25 bg-rose-400/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                    −{money(channel.penalty)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums text-emerald-200">
                  {money(channel.value)}
                </span>
                <span className="block text-[10px] tabular-nums text-zinc-500">
                  {money(channel.collected)} in
                </span>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-400 via-sky-300 to-emerald-300 transition-all duration-500"
                style={{ width: `${Math.max(channel.pct, channel.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2 pt-4 text-sm">
        <SummaryRow
          label="Promotion units given away"
          value={qty(promo.units)}
          tone="amber"
        />
        <SummaryRow
          label="Promotion value printed"
          value={money(promo.amount)}
          tone="amber"
        />
        <SummaryRow label="Returned units" value={qty(returned)} tone="rose" />
        <SummaryRow
          label={`Penalties · ${penaltyCount} raised`}
          value={money(penalty)}
          tone="rose"
        />
        <SummaryRow label="Lines settled" value={String(approved.length)} />
        <SummaryRow label="Input VAT on stock" value={money(vat.input)} tone="sky" />
        <SummaryRow label="Output VAT on sold stock" value={money(vat.output)} tone="sky" />
        <SummaryRow label="Net VAT" value={money(vat.net)} tone="violet" strong />
      </div>
    </Panel>
  );
}

/** Stock given away on the manufacturer's order, inside the same window. */
export function PromotionReport({
  promotions,
  range,
}: {
  promotions: PromotionLikeRow[];
  range: DateRange;
}) {
  const stats = useMemo(() => summarisePromotions(promotions, range), [promotions, range]);
  const heaviest = stats.top.slice(0, 5);
  return (
    <Panel
      fill
      tone="amber"
      title="Promotions"
      description="Stock given away on the manufacturer's order."
      actions={
        <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-200">
          {stats.docs} in window
        </Badge>
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <MiniStat
            icon={<Megaphone className="size-3" />}
            label="Promotion units"
            value={qty(stats.units)}
            tone="amber"
          />
          <MiniStat
            icon={<Receipt className="size-3" />}
            label="Value printed"
            value={money(stats.amount)}
            tone="violet"
          />
          <MiniStat
            icon={<Layers3 className="size-3" />}
            label="Documents"
            value={`${stats.approved} of ${stats.docs}`}
            tone="sky"
          />
          <MiniStat
            icon={<Boxes className="size-3" />}
            label="Items touched"
            value={String(stats.items)}
            tone="emerald"
          />
        </div>

        <div className="mt-4 flex-1 space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Heaviest giveaways
          </p>
          {heaviest.length ? (
            heaviest.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/[0.08] text-[10px] font-semibold text-amber-200">
                      {qty(item.units)}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-zinc-100">
                    {money(item.amount)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-amber-400 via-orange-300 to-rose-300 transition-all duration-500"
                    style={{ width: `${Math.max(item.pct, item.units > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyRow>Nothing given away in this window.</EmptyRow>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Every voucher lot, independent of the window, with the all-time leaders. */
export function StockPositionReport({
  totals,
  agents,
}: {
  totals: {
    registered_value: number;
    in_store_value: number;
    stocked_out_value: number;
    base_value: number;
    vat: number;
    inclusive_amount: number;
    output_vat: number;
    net_vat: number;
  };
  agents: AgentGroup[];
}) {
  const leaders = useMemo(
    () => [...agents].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    [agents],
  );
  return (
    <Panel
      fill
      tone="indigo"
      title="All-time stock & VAT position"
      description="Every voucher lot, independent of the reporting window."
    >
      <div className="flex flex-1 flex-col">
        <div className="space-y-2 text-sm">
          <SummaryRow label="Registered value" value={money(totals.registered_value)} />
          <SummaryRow label="In store" value={money(totals.in_store_value)} tone="emerald" />
          <SummaryRow
            label="Stocked out"
            value={money(totals.stocked_out_value)}
            tone="amber"
          />
          <SummaryRow label="Base value (ex VAT)" value={money(totals.base_value)} />
          <SummaryRow label="Input VAT" value={money(totals.vat)} tone="sky" />
          <SummaryRow label="Inclusive amount" value={money(totals.inclusive_amount)} />
          <SummaryRow label="Output VAT" value={money(totals.output_vat)} tone="sky" />
          <SummaryRow
            label="Net VAT (output − input)"
            value={money(totals.net_vat)}
            tone="violet"
            strong
          />
        </div>

        <div className="mt-4 flex-1 space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            All-time leaders
          </p>
          {leaders.map((agent, index) => (
            <div
              key={agent.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-sm transition hover:border-white/15 hover:bg-white/[0.04]"
            >
              <span className="flex min-w-0 items-center gap-2 text-zinc-300">
                <Trophy className="size-3.5 shrink-0 text-amber-300" />
                <RankBadge rank={index + 1} />
                <span className="truncate">{agent.agentName || agent.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <PenaltyMark
                  amountValue={agent.penaltyAmount}
                  penalties={agent.penalties}
                  compact
                />
                <span className="text-right">
                  <span className="block tabular-nums text-zinc-200">
                    {money(agent.revenue)}
                  </span>
                  <span
                    className={cn(
                      "block text-[10px] tabular-nums",
                      agent.revenue - agent.collected > 0.005
                        ? "text-rose-300"
                        : "text-zinc-500",
                    )}
                  >
                    {money(agent.collected)} in
                  </span>
                </span>
              </span>
            </div>
          ))}
          {!leaders.length && <EmptyRow>No approved settlements yet.</EmptyRow>}
        </div>
      </div>
    </Panel>
  );
}
