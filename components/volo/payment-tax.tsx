"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  FileDown,
  Filter,
  Layers3,
  Percent,
  Search,
  Truck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { exportExcel, exportPdf } from "@/lib/export";
import type { ReceiptBusiness } from "@/lib/print";
import { amount, money, qty } from "@/lib/api";
import { EmptyRow, Field, Panel, Td } from "@/components/volo/kit";
import { ComboSelect, DateField } from "@/components/volo/controls";
import { cn } from "@/lib/utils";

export type PaymentTaxSlice = "all" | "with_vat" | "without_vat";

/** The VAT picker above the table; narrows whatever slice the server gave us. */
type VatFilter = "all" | "with" | "without";

const VAT_FILTERS: { value: VatFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "with", label: "With VAT" },
  { value: "without", label: "Without VAT" },
];

export const PAYMENT_TAX_SLICES: { value: PaymentTaxSlice; label: string }[] = [
  { value: "all", label: "All lines" },
  { value: "with_vat", label: "With VAT" },
  { value: "without_vat", label: "Without VAT" },
];

/** The row shape shared by Store's `SummaryTabRow` and Finance's `SummaryTaxRow`. */
export type PaymentTaxRow = {
  id: number;
  voucher_number: string;
  item_name: string;
  category: string;
  unit: string;
  registered_qty: string;
  in_store_qty: string;
  stocked_out_qty: string;
  registered_value: string;
  in_store_value: string;
  stocked_out_value: string;
  unit_cost: string;
  paid_amount: string;
  base_value: string;
  vat_amount: string;
  inclusive_amount: string;
  output_vat: string;
  vat_rate?: string;
  price_with_vat?: string;
  supplier_name?: string;
  registration_date?: string;
};

export type PaymentTaxTotals = {
  registered_value: string;
  in_store_value: string;
  stocked_out_value: string;
  base_value: string;
  vat: string;
  inclusive_amount: string;
  output_vat: string;
  total_input_vat: string;
  total_output_vat: string;
  net_vat: string;
};

export function TableSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className ?? "w-full sm:w-64")}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 rounded-lg border-white/10 bg-white/[0.03] pl-8 text-xs placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:ring-emerald-400/20"
      />
    </div>
  );
}

export type TaxItemGroup = {
  key: string;
  itemName: string;
  category: string;
  units: string[];
  rows: PaymentTaxRow[];
  registeredQty: number;
  registeredValue: number;
  inStoreQty: number;
  inStoreValue: number;
  stockedOutQty: number;
  stockedOutValue: number;
  baseValue: number;
  vatAmount: number;
  outputVat: number;
  inclusiveAmount: number;
};

/** Payment & tax collapses voucher lots into one row per item + category. */
export function groupTaxRows(rows: PaymentTaxRow[]): TaxItemGroup[] {
  const groups = new Map<string, TaxItemGroup>();
  for (const row of rows) {
    const itemName = row.item_name.trim();
    const category = row.category?.trim() || "Uncategorised";
    const key = `${itemName.toLowerCase()}::${category.toLowerCase()}`;
    const group =
      groups.get(key) ??
      {
        key,
        itemName,
        category,
        units: [],
        rows: [],
        registeredQty: 0,
        registeredValue: 0,
        inStoreQty: 0,
        inStoreValue: 0,
        stockedOutQty: 0,
        stockedOutValue: 0,
        baseValue: 0,
        vatAmount: 0,
        outputVat: 0,
        inclusiveAmount: 0,
      };
    group.rows.push(row);
    if (row.unit && !group.units.includes(row.unit)) group.units.push(row.unit);
    group.registeredQty += Number(row.registered_qty);
    group.registeredValue += Number(row.registered_value);
    group.inStoreQty += Number(row.in_store_qty);
    group.inStoreValue += Number(row.in_store_value);
    group.stockedOutQty += Number(row.stocked_out_qty);
    group.stockedOutValue += Number(row.stocked_out_value);
    group.baseValue += Number(row.base_value);
    group.vatAmount += Number(row.vat_amount);
    group.outputVat += Number(row.output_vat);
    group.inclusiveAmount += Number(row.inclusive_amount);
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      a.itemName.localeCompare(b.itemName) || a.category.localeCompare(b.category),
  );
}

/** "12 Mar 2026" — the day is what operators scan, not the ISO string. */
function dateLabel(value: string): string {
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** The VAT rates actually charged across this item's vouchers. */
function vatRateLabel(rows: PaymentTaxRow[]): string {
  const rates = Array.from(
    new Set(rows.map((row) => `${Number(row.vat_rate ?? 0)}%`)),
  );
  if (!rates.length) return "No VAT rate";
  return rates.length === 1 ? rates[0] : rates.join(" / ");
}

const TAX_EXPORT_HEADERS = [
  "Voucher",
  "Item",
  "Reg. qty",
  "Reg. value",
  "In store qty",
  "In store value",
  "Stocked out qty",
  "Stocked out value",
  "Unit cost",
  "Paid amount",
  "Base",
  "VAT",
  "Inclusive",
];

export function PaymentTaxPanel({
  tab,
  onTabChange,
  rows,
  totals,
  loading,
  business,
  tenantName,
  emptyMessage,
  description,
}: {
  tab: PaymentTaxSlice;
  onTabChange?: (tab: PaymentTaxSlice) => void;
  rows: PaymentTaxRow[];
  totals?: PaymentTaxTotals | null;
  loading?: boolean;
  business?: ReceiptBusiness;
  tenantName?: string;
  emptyMessage?: string;
  description?: string;
}) {
  const [query, setQuery] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [vatFilter, setVatFilter] = useState<VatFilter>("all");

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) {
      const name = row.supplier_name?.trim();
      if (name) names.add(name);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [rows]);

  const filtersActive =
    Boolean(from || to || query.trim()) || supplier !== "all" || vatFilter !== "all";

  // The search box is a filter like any other, so the summary numbers and both
  // exports always describe exactly what is on screen.
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const day = row.registration_date ?? "";
        if (from && day && day < from) return false;
        if (to && day && day > to) return false;
        if (supplier !== "all" && (row.supplier_name ?? "").trim() !== supplier) {
          return false;
        }
        const inputVat = Number(row.vat_amount || 0);
        if (vatFilter === "with" && inputVat <= 0) return false;
        if (vatFilter === "without" && inputVat > 0) return false;
        const needle = query.trim().toLowerCase();
        if (needle) {
          const haystack = [
            row.voucher_number,
            row.item_name,
            row.category,
            row.supplier_name,
            row.unit,
            day,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      }),
    [rows, from, to, supplier, vatFilter, query],
  );

  const tabLabel =
    PAYMENT_TAX_SLICES.find((slice) => slice.value === tab)?.label ?? "All lines";
  const groups = useMemo(() => groupTaxRows(filteredRows), [filteredRows]);
  const allItemCount = useMemo(() => groupTaxRows(rows).length, [rows]);
  const detail = groups.find((group) => group.key === detailKey) ?? null;

  const qtyTotals = filteredRows.reduce(
    (sum, row) => ({
      registered: sum.registered + Number(row.registered_qty),
      inStore: sum.inStore + Number(row.in_store_qty),
      stockedOut: sum.stockedOut + Number(row.stocked_out_qty),
      paid: sum.paid + Number(row.paid_amount),
    }),
    { registered: 0, inStore: 0, stockedOut: 0, paid: 0 },
  );

  // Filtering makes the server totals wrong for what is on screen, so the
  // numbers below — and every export — are re-added from the visible rows.
  const valueTotals = filteredRows.reduce(
    (sum, row) => ({
      registeredValue: sum.registeredValue + Number(row.registered_value),
      inStoreValue: sum.inStoreValue + Number(row.in_store_value),
      stockedOutValue: sum.stockedOutValue + Number(row.stocked_out_value),
      base: sum.base + Number(row.base_value),
      inputVat: sum.inputVat + Number(row.vat_amount),
      outputVat: sum.outputVat + Number(row.output_vat),
      inclusive: sum.inclusive + Number(row.inclusive_amount),
    }),
    {
      registeredValue: 0,
      inStoreValue: 0,
      stockedOutValue: 0,
      base: 0,
      inputVat: 0,
      outputVat: 0,
      inclusive: 0,
    },
  );

  const displayTotals: PaymentTaxTotals | null = !totals
    ? null
    : filtersActive
      ? {
          registered_value: String(valueTotals.registeredValue),
          in_store_value: String(valueTotals.inStoreValue),
          stocked_out_value: String(valueTotals.stockedOutValue),
          base_value: String(valueTotals.base),
          vat: String(valueTotals.inputVat),
          inclusive_amount: String(valueTotals.inclusive),
          output_vat: String(valueTotals.outputVat),
          total_input_vat: String(valueTotals.inputVat),
          total_output_vat: String(valueTotals.outputVat),
          net_vat: String(valueTotals.outputVat - valueTotals.inputVat),
        }
      : totals;

  const filterNote = filtersActive
    ? [
        query.trim() ? `“${query.trim()}”` : "",
        from || to ? `${from || "…"} → ${to || "…"}` : "",
        supplier !== "all" ? supplier : "",
        vatFilter === "with"
          ? "with VAT"
          : vatFilter === "without"
            ? "without VAT"
            : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const rowCells = (row: PaymentTaxRow): (string | number)[] => [
    row.voucher_number,
    row.item_name,
    Number(row.registered_qty),
    Number(row.registered_value),
    Number(row.in_store_qty),
    Number(row.in_store_value),
    Number(row.stocked_out_qty),
    Number(row.stocked_out_value),
    Number(row.unit_cost),
    Number(row.paid_amount),
    Number(row.base_value),
    Number(row.vat_amount),
    Number(row.inclusive_amount),
  ];
  const exportRows = filteredRows.map(rowCells);
  const exportTotals = [
    "Totals",
    `${filteredRows.length} vouchers`,
    qtyTotals.registered,
    valueTotals.registeredValue,
    qtyTotals.inStore,
    valueTotals.inStoreValue,
    qtyTotals.stockedOut,
    valueTotals.stockedOutValue,
    "",
    qtyTotals.paid,
    valueTotals.base,
    valueTotals.inputVat,
    valueTotals.inclusive,
  ] as (string | number)[];

  // One table row bundles every voucher that registered the same item, so the
  // per-row PDF prints exactly those vouchers and nothing else.
  function exportGroupPdf(group: TaxItemGroup) {
    const count = group.rows.length;
    const paid = group.rows.reduce((sum, row) => sum + Number(row.paid_amount), 0);
    exportPdf({
      title: `Payment & tax · ${group.itemName}`,
      subtitle: [
        `${tenantName ?? ""} · ${tabLabel} · ${group.category}`.replace(
          /^ · /,
          "",
        ),
        `${count} voucher${count === 1 ? "" : "s"}`,
        filterNote,
      ]
        .filter(Boolean)
        .join(" · "),
      headers: TAX_EXPORT_HEADERS,
      rows: group.rows.map(rowCells),
      file: `volosync-tax-${(group.itemName || "item")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`,
      totals: [
        "Totals",
        group.itemName,
        group.registeredQty,
        group.registeredValue,
        group.inStoreQty,
        group.inStoreValue,
        group.stockedOutQty,
        group.stockedOutValue,
        "",
        paid,
        group.baseValue,
        group.vatAmount,
        group.inclusiveAmount,
      ],
      business,
    });
  }

  return (
    <Panel
      title={`Payment & tax · ${tabLabel}`}
      description={
        description ??
        "Grouped per item: hover a name for a quick preview, open Detail for the full voucher breakdown. Registered = in store + stocked out; costs and selling prices are VAT-inclusive, so input VAT is read out of the purchase and output VAT out of the stocked-out portion."
      }
      actions={
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent"
            disabled={loading || !filteredRows.length}
            onClick={() =>
              exportPdf({
                title: "Payment & tax",
                subtitle: [
                  `${tenantName ?? ""} · ${tabLabel} · ${filteredRows.length} vouchers`,
                  filterNote,
                ]
                  .filter(Boolean)
                  .join(" · "),
                headers: TAX_EXPORT_HEADERS,
                rows: exportRows,
                file: "volosync-payment-tax",
                totals: exportTotals,
                business,
              })
            }
          >
            <FileDown className="size-3.5" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent"
            disabled={loading || !filteredRows.length}
            onClick={() =>
              exportExcel({
                title: `Payment & tax · ${tabLabel}${filterNote ? ` · ${filterNote}` : ""}`,
                headers: TAX_EXPORT_HEADERS,
                rows: exportRows,
                totals: exportTotals,
                file: "volosync-payment-tax",
                sheet: "Payment & tax",
                note: tenantName,
              })
            }
          >
            <FileDown className="size-3.5" /> Excel
          </Button>
        </div>
      }
    >
      {onTabChange && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {PAYMENT_TAX_SLICES.map((slice) => (
              <button
                key={slice.value}
                onClick={() => onTabChange(slice.value)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  tab === slice.value
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {slice.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            <span className="font-semibold text-zinc-300">{rows.length}</span> voucher
            {rows.length === 1 ? "" : "s"} in this slice
          </p>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-end justify-end gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
        <Field label="From">
          <DateField
            value={from}
            onChange={setFrom}
            placeholder="Any date"
            clearable
            className="w-36"
          />
        </Field>
        <Field label="To">
          <DateField
            value={to}
            onChange={setTo}
            placeholder="Any date"
            clearable
            className="w-36"
          />
        </Field>
        <Field label="Supplier">
          <ComboSelect
            value={supplier}
            onChange={setSupplier}
            options={[{ value: "all", label: "All suppliers" }, ...supplierOptions]}
            placeholder="All suppliers"
            className="w-44"
          />
        </Field>
        <Field label="VAT">
          <ComboSelect
            value={vatFilter}
            onChange={(value) => setVatFilter(value as VatFilter)}
            options={VAT_FILTERS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            className="w-32"
          />
        </Field>
        <div className="flex items-center gap-2 pb-0.5">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Filter className="size-3.5" />
            <span className="font-semibold text-zinc-300">{filteredRows.length}</span> of{" "}
            {rows.length} voucher{rows.length === 1 ? "" : "s"}
            {filterNote ? <span className="text-zinc-600">· {filterNote}</span> : null}
          </span>
          {filtersActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-white/15 bg-transparent text-[11px] text-zinc-300 hover:bg-white/[0.06]"
              onClick={() => {
                setFrom("");
                setTo("");
                setSupplier("all");
                setVatFilter("all");
                setQuery("");
              }}
            >
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search item, category or voucher"
          className="w-64 sm:w-72"
        />
        <span className="text-xs text-zinc-500">
          {groups.length} of {allItemCount} item
          {allItemCount === 1 ? "" : "s"}
          {filterNote && <span className="text-zinc-600"> · {filterNote}</span>}
        </span>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-md">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <StickyTh>Item</StickyTh>
              <StickyTh right>Registered</StickyTh>
              <StickyTh right>VAT</StickyTh>
              <StickyTh right>Inclusive</StickyTh>
              <StickyTh right>Actions</StickyTh>
            </tr>
          </thead>
          <tbody>
            {loading && !groups.length ? (
              <SkeletonRows cols={5} rows={6} />
            ) : (
              groups.map((group) => (
                <tr key={group.key} className="transition-colors hover:bg-white/[0.03]">
                  <Td>
                    <TaxItemDetailTrigger
                      group={group}
                      onOpenDetail={() => setDetailKey(group.key)}
                    />
                    <p className="mt-0.5 max-w-[18rem] truncate text-[11px] text-violet-300/70">
                      {group.category}
                      {group.units.length > 0 && (
                        <span className="text-zinc-600"> · {group.units.join(" / ")}</span>
                      )}
                    </p>
                  </Td>
                  <Td right>
                    <QtyValueCell
                      tone="registered"
                      quantity={group.registeredQty}
                      value={group.baseValue}
                    />
                  </Td>
                  <Td right className="text-amber-300">
                    {money(group.vatAmount)}
                  </Td>
                  <Td right className="text-emerald-300">
                    {money(group.inclusiveAmount)}
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        title={`Export ${group.itemName} to PDF`}
                        className="size-8 border-white/12 bg-transparent p-0 text-cyan-300 hover:bg-white/[0.06]"
                        onClick={() => exportGroupPdf(group)}
                      >
                        <FileDown className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/12 bg-transparent text-zinc-300 hover:bg-white/[0.06]"
                        onClick={() => setDetailKey(group.key)}
                      >
                        <Layers3 className="size-3.5" /> Detail
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && !groups.length && (
        <EmptyRow>
          {query.trim()
            ? `No items match “${query.trim()}” in this slice.`
            : filtersActive
              ? `No voucher matches these filters${filterNote ? ` (${filterNote})` : ""}.`
              : (emptyMessage ?? "No vouchers in this slice.")}
        </EmptyRow>
      )}

      {displayTotals && (
        <div className="mt-4 flex flex-wrap gap-2">
          <TaxTotalPill label="Base value" value={money(displayTotals.base_value)} tone="base" />
          <TaxTotalPill
            label="In store value"
            value={money(displayTotals.in_store_value)}
            tone="inStore"
          />
          <TaxTotalPill
            label="Stocked out value"
            value={money(displayTotals.stocked_out_value)}
            tone="stockedOut"
          />
          <TaxTotalPill
            label="Input VAT"
            value={money(displayTotals.total_input_vat)}
            tone="input"
          />
          <TaxTotalPill
            label="Output VAT"
            value={money(displayTotals.total_output_vat)}
            tone="output"
          />
          <TaxTotalPill label="Net VAT" value={money(displayTotals.net_vat)} tone="net" />
          <TaxTotalPill
            label="Inclusive amount"
            value={money(displayTotals.inclusive_amount)}
            tone="inclusive"
          />
        </div>
      )}

      <Sheet
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetailKey(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full! gap-0 overflow-y-auto border-white/10 bg-zinc-950 p-0 sm:max-w-3xl!"
        >
          {detail &&
            (() => {
                  const dates = detail.rows
                    .map((row) => row.registration_date ?? "")
                    .filter(Boolean)
                    .sort();
                  const suppliers = Array.from(
                    new Set(
                      detail.rows.map((row) => row.supplier_name?.trim() ?? "").filter(Boolean),
                    ),
                  ).sort((a, b) => a.localeCompare(b));
                  const paid = detail.rows.reduce(
                    (sum, row) => sum + Number(row.paid_amount),
                    0,
                  );
                  const netVat = detail.outputVat - detail.vatAmount;
                  return (
                    <>
                      <SheetHeader className="border-b border-white/10 p-5">
                        <p className="text-[10px] font-semibold tracking-[0.22em] text-violet-300/80 uppercase">
                          {detail.category} · {tabLabel}
                        </p>
                        <SheetTitle className="text-lg text-white">
                          {detail.itemName}
                        </SheetTitle>
                        <SheetDescription>
                          {detail.rows.length} voucher line
                          {detail.rows.length === 1 ? "" : "s"}
                          {detail.units.length
                            ? ` · ${detail.units.join(" · ")}`
                            : ""}
                        </SheetDescription>
                      </SheetHeader>

                      <div className="space-y-4 p-5">
                        <div className="grid gap-2 sm:grid-cols-4">
                          <TaxDetailStat
                            label="Registered"
                            value={money(detail.registeredValue)}
                            hint={`${qty(detail.registeredQty)} units`}
                            tone="base"
                          />
                          <TaxDetailStat
                            label="In store"
                            value={money(detail.inStoreValue)}
                            hint={`${qty(detail.inStoreQty)} units`}
                            tone="inStore"
                          />
                          <TaxDetailStat
                            label="Stocked out"
                            value={money(detail.stockedOutValue)}
                            hint={`${qty(detail.stockedOutQty)} units`}
                            tone="stockedOut"
                          />
                          <TaxDetailStat
                            label="Inclusive"
                            value={money(detail.inclusiveAmount)}
                            hint={`Paid ${money(paid)}`}
                            tone="inclusive"
                          />
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                              Provenance
                            </span>
                            {dates.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[11px] text-sky-200">
                                <CalendarDays className="size-3" />
                                {dates.length === 1
                                  ? dateLabel(dates[0])
                                  : `${dateLabel(dates[0])} → ${dateLabel(dates[dates.length - 1])}`}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[11px] text-amber-200">
                              <Percent className="size-3" />
                              {vatRateLabel(detail.rows)}
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-zinc-500">Supplier</span>
                            {suppliers.length ? (
                              suppliers.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] text-emerald-200"
                                >
                                  <Truck className="size-3" />
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-zinc-600">
                                Not recorded
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="overflow-auto rounded-xl border border-white/10">
                          <table className="w-full min-w-[860px]">
                            <thead>
                              <tr>
                                <StickyTh>Voucher</StickyTh>
                                <StickyTh>Supplier</StickyTh>
                                <StickyTh right>Unit cost</StickyTh>
                                <StickyTh right>Registered</StickyTh>
                                <StickyTh right>VAT in / out</StickyTh>
                                <StickyTh right>Paid</StickyTh>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.rows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="transition-colors hover:bg-white/[0.02]"
                                >
                                  <Td>
                                    <span className="font-mono text-xs text-emerald-300">
                                      {row.voucher_number}
                                    </span>
                                    <p className="mt-0.5 text-[11px] text-zinc-500">
                                      {row.registration_date
                                        ? dateLabel(row.registration_date)
                                        : "No registration date"}
                                    </p>
                                  </Td>
                                  <Td className="max-w-[14rem] truncate text-zinc-300">
                                    {row.supplier_name?.trim() || (
                                      <span className="text-zinc-600">—</span>
                                    )}
                                  </Td>
                                  <Td right className="text-zinc-300">
                                    {money(row.unit_cost)}
                                  </Td>
                                  <Td right>
                                    <QtyValueCell
                                      tone="registered"
                                      quantity={row.registered_qty}
                                      value={row.base_value}
                                    />
                                  </Td>
                                  <Td right>
                                    <span className="block text-[13px] leading-none font-semibold tabular-nums text-amber-300">
                                      {money(row.vat_amount)}
                                    </span>
                                    <span className="mt-1.5 block text-[13px] leading-none font-semibold tabular-nums text-rose-300">
                                      {money(row.output_vat)}
                                    </span>
                                  </Td>
                                  <Td right className="font-semibold text-teal-200">
                                    {money(row.paid_amount)}
                                  </Td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-white/10 bg-white/[0.03]">
                                <Td className="text-[11px] font-semibold text-zinc-400 uppercase">
                                  Item totals
                                </Td>
                                <Td />
                                <Td />
                                <Td right>
                                  <QtyValueCell
                                    tone="registered"
                                    quantity={detail.registeredQty}
                                    value={detail.baseValue}
                                  />
                                </Td>
                                <Td right>
                                  <span className="block text-[13px] leading-none font-semibold tabular-nums text-amber-300">
                                    {money(detail.vatAmount)}
                                  </span>
                                  <span className="mt-1.5 block text-[13px] leading-none font-semibold tabular-nums text-rose-300">
                                    {money(detail.outputVat)}
                                  </span>
                                </Td>
                                <Td right className="font-semibold text-teal-200">
                                  {money(paid)}
                                </Td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <TaxTotalPill
                            label="Input VAT"
                            value={money(detail.vatAmount)}
                            tone="input"
                          />
                          <TaxTotalPill
                            label="Output VAT"
                            value={money(detail.outputVat)}
                            tone="output"
                          />
                          <TaxTotalPill
                            label="Net VAT"
                            value={money(netVat)}
                            tone={netVat >= 0 ? "net" : "stockedOut"}
                          />
                        </div>

                        <p className="text-[11px] text-zinc-500">
                          Registered = in store + stocked out. Costs and selling prices are
                          entered VAT-inclusive, so input VAT is read out of the registered
                          purchase and output VAT out of the stocked-out portion.
                        </p>
                      </div>
                    </>
                  );
                })()}
        </SheetContent>
      </Sheet>
    </Panel>
  );
}

function StickyTh({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-white/10 bg-zinc-900/95 px-3 py-2 text-[11px] font-semibold tracking-wider whitespace-nowrap text-zinc-500 uppercase backdrop-blur",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={`sk-${index}`}>
          {Array.from({ length: cols }).map((__, cell) => (
            <Td key={cell} right={cell > 1}>
              <span className="ml-auto block h-4 w-16 animate-pulse rounded-md bg-white/[0.06]" />
            </Td>
          ))}
        </tr>
      ))}
    </>
  );
}

const taxTone = {
  base: "border-white/10 bg-white/[0.03] text-zinc-100",
  inStore: "border-sky-400/25 bg-sky-500/10 text-sky-200",
  stockedOut: "border-violet-400/25 bg-violet-500/10 text-violet-200",
  input: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  output: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  net: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  inclusive: "border-teal-400/25 bg-teal-500/10 text-teal-200",
} as const;

type TaxTone = keyof typeof taxTone;

const toneColor = {
  registered: "text-emerald-200",
  inStore: "text-sky-200",
  stockedOut: "text-violet-200",
} as const;

const tonePill = {
  registered: "bg-emerald-500/12 text-emerald-200/90",
  inStore: "bg-sky-500/12 text-sky-200/90",
  stockedOut: "bg-violet-500/12 text-violet-200/90",
} as const;

/**
 * One table cell carrying both the quantity and its value: the count leads in the
 * column tone, the money rides beneath it in a pill with ETB trailing the figure.
 */
export function QtyValueCell({
  quantity,
  value,
  tone,
}: {
  quantity: string | number;
  value: string | number;
  tone: keyof typeof tonePill;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={cn("text-[13px] leading-none font-semibold tabular-nums", toneColor[tone])}>
        {qty(quantity)}
      </span>
      <Badge
        variant="secondary"
        className={cn("h-[17px] rounded-full px-1.5 py-0 text-[10px] leading-none", tonePill[tone])}
      >
        {amount(value)}
        <span className="ml-1 text-[9px] font-semibold tracking-wider uppercase opacity-60">ETB</span>
      </Badge>
    </div>
  );
}

function TaxTotalPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: TaxTone;
}) {
  return (
    <div
      className={cn(
        "min-w-[8.5rem] flex-1 rounded-xl border px-3 py-2",
        taxTone[tone],
      )}
    >
      <p className="text-[9.5px] font-semibold tracking-[0.16em] uppercase opacity-70">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function TaxDetailStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: TaxTone;
}) {
  return (
    <div className={cn("rounded-xl border p-3", taxTone[tone])}>
      <p className="text-[9.5px] font-semibold tracking-[0.18em] uppercase opacity-70">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-semibold">{value}</p>
      <p className="text-[10px] opacity-60">{hint}</p>
    </div>
  );
}

/** Item name with a hover preview; "Open full detail" hands off to the Sheet. */
function TaxItemDetailTrigger({
  group,
  onOpenDetail,
}: {
  group: TaxItemGroup;
  onOpenDetail: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function scheduleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) return;
    openTimer.current = setTimeout(() => setOpen(true), 220);
  }

  function scheduleClose() {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }

  function keepOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={scheduleOpen}
          onBlur={scheduleClose}
          className="group/item flex min-w-0 flex-col text-left"
        >
          <span className="flex items-center gap-1.5 text-sm text-zinc-100 underline-offset-4 group-hover/item:text-emerald-200 group-hover/item:underline">
            {group.itemName}
            <Layers3 className="size-3 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-60" />
          </span>
          <span className="text-[10px] text-zinc-500">
            {group.rows.length} voucher line{group.rows.length === 1 ? "" : "s"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
        className="w-72 border-white/10 bg-zinc-950/95 p-3 shadow-xl backdrop-blur"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{group.itemName}</p>
            <p className="truncate text-[11px] text-zinc-500">{group.category}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">
            {group.units.join(" · ") || "unit"}
          </span>
        </div>

        <div className="mt-3 space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">In store</span>
            <span className="font-medium text-sky-300">
              {qty(group.inStoreQty)} · {money(group.inStoreValue)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Stocked out</span>
            <span className="font-medium text-violet-300">
              {qty(group.stockedOutQty)} · {money(group.stockedOutValue)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Inclusive</span>
            <span className="font-medium text-emerald-300">
              {money(group.inclusiveAmount)}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
          <p className="text-[9.5px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Vouchers
          </p>
          {group.rows.slice(0, 3).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 text-[10px]"
            >
              <span className="font-mono text-emerald-300">{row.voucher_number}</span>
              <span className="text-zinc-400">
                {qty(row.stocked_out_qty)} out · {money(row.inclusive_amount)}
              </span>
            </div>
          ))}
          {group.rows.length > 3 && (
            <p className="text-[10px] text-zinc-500">
              +{group.rows.length - 3} more voucher
              {group.rows.length - 3 === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            setOpen(false);
            onOpenDetail();
          }}
        >
          <Layers3 className="size-3.5" /> Open full detail
        </Button>
      </PopoverContent>
    </Popover>
  );
}
