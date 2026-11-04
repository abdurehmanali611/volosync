"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  Boxes,
  FileDown,
  Layers3,
  Percent,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Users,
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
import { EmptyRow, Field, Panel, Td, Th } from "@/components/volo/kit";
import { amount, money, qty } from "@/lib/api";
import { exportExcel, exportPdf } from "@/lib/export";
import type { ReceiptBusiness } from "@/lib/print";
import {
  REPORT_PERIODS,
  periodLabel,
  totalise,
  type AgentGroup,
  type DateRange,
  type ReportPeriod,
  type SaleGroup,
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
  revenue: { label: "Sales", color: MONEY_TONE.revenue },
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
      <span className={cn("shrink-0 font-semibold tabular-nums", toneClass)}>{value}</span>
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

  const sameDay = range.from === range.to;
  return (
    <Panel
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search item, voucher or supplier"
          className="w-full sm:w-64"
        />
        <span className="text-xs text-zinc-500">
          {scoped.length} voucher lot{scoped.length === 1 ? "" : "s"} in this window
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
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
      tone="sky"
      title="Sales & agents"
      description={`Approved settlements from ${range.from === range.to ? range.from : `${range.from} → ${range.to}`}.`}
      actions={
        <ReportExportButtons
          title="Sales & agents summary"
          subtitle={`${tenantName ?? "Wholesale business"} · ${range.from} → ${range.to}`}
          headers={["Metric", "Value"]}
          rows={[
            ["Approved sales", totals.revenue],
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
      <div className="grid gap-1.5 sm:grid-cols-2">
        <SummaryRow label="Approved sales" value={money(totals.revenue)} tone="emerald" />
        <SummaryRow label="Units sold" value={qty(totals.units)} />
        <SummaryRow label="Settled lines" value={String(totals.lines)} />
        <SummaryRow label="Gross profit" value={money(totals.profit)} tone="sky" />
        <SummaryRow label="Margin" value={`${margin.toFixed(1)} %`} />
        <SummaryRow label="VAT inside sales" value={money(totals.vat)} tone="amber" />
        <SummaryRow
          label="Penalties"
          value={penaltyAmount ? `${money(penaltyAmount)} · ${penaltyCount}` : "None"}
          tone={penaltyAmount ? "rose" : "zinc"}
          strong
        />
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
          Leading agents
        </p>
        {top.length ? (
          top.map((agent) => (
            <div
              key={agent.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5"
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
                <span className="text-sm font-semibold tabular-nums text-emerald-300">
                  {money(agent.revenue)}
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
  "Sales",
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
      tone="violet"
      title={mode === "category" ? "Category performance" : "Item performance"}
      description="What each category and item sold, the profit it generated and the VAT inside that revenue."
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
              "",
              Number(totals.revenue.toFixed(2)),
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

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center gap-2">
                <Boxes className="size-3.5 text-amber-300" />
                <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                  Units sold
                </p>
              </div>
              <div className="space-y-2">
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

          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <MiniStat
              icon={<Receipt className="size-3.5" />}
              label="Sales"
              value={money(totals.revenue)}
              tone="emerald"
            />
            <MiniStat
              icon={<TrendingUp className="size-3.5" />}
              label="Profit"
              value={money(totals.profit)}
              tone="sky"
            />
            <MiniStat
              icon={<Percent className="size-3.5" />}
              label="Margin"
              value={`${(totals.revenue ? (totals.profit / totals.revenue) * 100 : 0).toFixed(1)} %`}
              tone="violet"
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

          <div className="mt-4 max-h-[22rem] overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <Th>{mode === "category" ? "Category" : "Item"}</Th>
                  <Th>{mode === "category" ? "Items" : "Category"}</Th>
                  <Th right>Lines</Th>
                  <Th right>Units sold</Th>
                  <Th right>Sales</Th>
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
                    <Td right className="text-sky-300">
                      {money(group.profit)}
                    </Td>
                    <Td right className="text-violet-300">
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
                    {money(totals.profit)}
                  </Td>
                  <Td right className="font-semibold text-violet-300">
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
  tone: "emerald" | "sky" | "violet" | "amber" | "zinc";
}) {
  const toneClass = {
    emerald: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200",
    sky: "border-sky-400/25 bg-sky-400/[0.07] text-sky-200",
    violet: "border-violet-400/25 bg-violet-400/[0.07] text-violet-200",
    amber: "border-amber-400/25 bg-amber-400/[0.07] text-amber-200",
    zinc: "border-white/10 bg-white/[0.03] text-zinc-200",
  }[tone];
  return (
    <div className={cn("rounded-xl border px-3 py-2", toneClass)}>
      <p className="flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.16em] uppercase opacity-75">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</p>
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
    "Sales",
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
    Number(totals.profit.toFixed(2)),
    Number(totals.vat.toFixed(2)),
    Number(totals.penaltyAmount.toFixed(2)),
    "",
  ];

  return (
    <Panel
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search agent or penalty reason"
          className="w-full sm:w-64"
        />
        <div className="w-full sm:w-52">
          <ComboSelect
            value={agentId}
            onChange={setAgentId}
            options={[{ value: "all", label: "All sales agents" }, ...agentOptions]}
            placeholder="All sales agents"
          />
        </div>
        <span className="ml-auto text-xs text-zinc-500">
          {visible.length} of {agents.length} agent{agents.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="max-h-[26rem] overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[940px]">
          <thead>
            <tr>
              <Th>Rank</Th>
              <Th>Agent</Th>
              <Th right>Sales</Th>
              <Th right>Units sold</Th>
              <Th right>Revenue</Th>
              <Th right>Profit</Th>
              <Th right>VAT</Th>
              <Th right>Penalty</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((agent) => (
              <tr key={agent.key} className="transition hover:bg-white/[0.03]">
                <Td>
                  <RankBadge rank={Number(agent.sublabel) || 0} />
                </Td>
                <Td className="text-zinc-100">
                  <span className="flex items-center gap-2">
                    <Users className="size-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{agent.label}</span>
                  </span>
                </Td>
                <Td right>{agent.lines}</Td>
                <Td right className="text-amber-200">
                  {qty(agent.units)}
                </Td>
                <Td right className="text-emerald-300">
                  {money(agent.revenue)}
                </Td>
                <Td right className="text-sky-300">
                  {money(agent.profit)}
                </Td>
                <Td right className="text-violet-300">
                  {money(agent.vat)}
                </Td>
                <Td right>
                  <PenaltyMark amountValue={agent.penaltyAmount} penalties={agent.penalties} />
                </Td>
              </tr>
            ))}
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
                {money(totals.profit)}
              </Td>
              <Td right className="font-semibold text-violet-300">
                {money(totals.vat)}
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search agent, item, voucher or reason"
          className="w-full sm:w-72"
        />
        <span className="text-xs text-zinc-500">
          {visible.length} of {marks.length} penalty record{marks.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length ? (
        <div className="max-h-[22rem] overflow-auto rounded-xl border border-white/10">
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
                      {amount(mark.amount)} ETB
                    </Badge>
                  </Td>
                  <Td className="max-w-[26rem] text-[12px] leading-snug text-zinc-300">
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
