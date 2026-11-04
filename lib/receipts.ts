"use client";

/**
 * Receipt builders shared by the store, finance and manager portals, so every
 * role prints the same letterhead, financial detail and approval trail.
 */

import {
  money,
  qty,
  type Promotion,
  type Registration,
  type StockOut,
  type TenantInfo,
} from "@/lib/api";
import type { SettlementRow } from "@/lib/api/finance";
import { vatWithin } from "@/lib/reports";
import type {
  ReceiptBusiness,
  ReceiptDoc,
  ReceiptStampDecision,
  SettlementReceiptDoc,
} from "@/lib/print";

const today = () => new Date().toISOString().slice(0, 10);
const fmtDateTime = (iso?: string | null) =>
  iso ? iso.replace("T", " ").slice(0, 16) : "—";

const PAYMENT_LABELS: Record<string, string> = {
  TELEBIRR: "Telebirr",
  BANK: "Bank",
  RECEIPT: "Receipt (cash)",
};

const modeLabel = (mode: string) =>
  mode === "BATCH" ? "Batch" : mode === "SINGLE" ? "Single" : mode;

/** Tenant identity for the letterhead, with the dashboard as the fallback. */
export function tenantBusiness(
  tenant: TenantInfo | null | undefined,
  fallback: { name?: string | null; tin?: string | null } = {},
): ReceiptBusiness {
  return {
    name: tenant?.name || fallback.name || "Wholesale business",
    tin: tenant?.tin || fallback.tin || null,
    phone: tenant?.phone || null,
    address: tenant?.address || null,
    logoUrl: tenant?.logo_url || null,
  };
}

export function buildRegistrationReceipt(
  doc: Registration,
  business: ReceiptBusiness,
): ReceiptDoc {
  const units = doc.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const base = doc.lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0),
    0,
  );
  const inclusive = Number(doc.total_value);
  const vat = Math.max(0, inclusive - base);
  const sellingValue = doc.lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_sales || 0),
    0,
  );

  return {
    title: "Item registration receipt",
    reference: doc.voucher_number,
    date: doc.lines[0]?.registration_date ?? today(),
    status: doc.status,
    business,
    columnLabels: ["Qty", "Unit cost", "Cost total"],
    parties: [
      { label: "Supplier (manufacturer)", value: doc.supplier_name },
      { label: "Supplier TIN", value: doc.supplier_tin },
      { label: "Supplier phone", value: doc.supplier_phone },
      { label: "Supplier address", value: doc.supplier_address },
      { label: "Wholesaler", value: business.name || "" },
      { label: "Wholesaler TIN", value: business.tin || "" },
      { label: "Registered by", value: doc.created_by_name },
    ],
    lines: doc.lines.map((line) => ({
      item: line.item_name,
      voucher: `${line.category || "Uncategorised"} · ${line.unit || "unit"}`,
      quantity: qty(line.quantity),
      unitPrice: money(line.unit_cost),
      total: money(Number(line.quantity) * Number(line.unit_cost)),
      note: [
        line.unit_sales ? `selling price ${money(line.unit_sales)}` : "",
        line.expiry_date ? `expires ${line.expiry_date}` : "",
        line.note || "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    totals:
      vat > 0.005
        ? [
            { label: "Cost subtotal (excl. VAT)", value: money(base) },
            { label: "VAT", value: money(vat) },
            { label: "Total including VAT", value: money(inclusive) },
          ]
        : [{ label: "Total", value: money(inclusive) }],
    linesCaption: `${qty(units)} units registered · value at selling price ${money(
      sellingValue,
    )} · expected gross margin ${money(sellingValue - base)}.`,
    note: doc.note,
    signatures: ["Supplier / manufacturer", "Store keeper"],
  };
}

export function buildStockOutReceipt(
  doc: StockOut,
  business: ReceiptBusiness,
): ReceiptDoc {
  const units = doc.assignments.reduce((sum, row) => sum + Number(row.quantity), 0);
  const listedValue = doc.assignments.reduce(
    (sum, row) =>
      sum + Number(row.quantity) * Number(row.unit_sales_at_assignment || 0),
    0,
  );
  const adjustment = doc.assignments.reduce(
    (sum, row) => sum + Number(row.quantity) * Number(row.changing_amount || 0),
    0,
  );
  const agents = doc.assignments
    .map((row) => row.agent_name || "Unassigned")
    .filter((name, index, list) => list.indexOf(name) === index);

  return {
    title: "Stock out receipt",
    reference: doc.voucher_number,
    date: doc.date,
    status: doc.status,
    business,
    columnLabels: ["Qty", "Unit selling price", "Expected collection"],
    parties: [
      { label: "Wholesaler", value: business.name || "" },
      { label: "Mode", value: modeLabel(doc.mode) },
      { label: "Raised by", value: doc.created_by_name },
      { label: "Agents", value: agents.join(", ") },
    ],
    lines: doc.assignments.map((row) => {
      const unitSales = Number(row.unit_sales_at_assignment || 0);
      const expected = (unitSales + Number(row.changing_amount || 0)) * Number(row.quantity);
      return {
        item: row.item_name,
        voucher: `${row.voucher_number}${row.agent_name ? ` · ${row.agent_name}` : ""}`,
        quantity: qty(row.quantity),
        unitPrice: money(unitSales),
        total: money(expected),
        note: row.change_reason,
      };
    }),
    totals: [
      { label: "Value at listed selling price", value: money(listedValue) },
      { label: "Price change adjustment", value: money(adjustment) },
      { label: "Expected collection", value: money(listedValue + adjustment) },
    ],
    linesCaption: `${qty(units)} units handed to ${agents.length} sales agent${
      agents.length === 1 ? "" : "s"
    }. Expected collection = (unit selling price + change) × quantity.`,
    note: doc.note,
    signatures: ["Store keeper", "Sales agent"],
  };
}

export function buildPromotionReceipt(
  doc: Promotion,
  business: ReceiptBusiness,
): ReceiptDoc {
  const units = doc.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const listedValue = doc.lines.reduce(
    (sum, line) => sum + Number(line.unit_sales || 0) * Number(line.quantity || 0),
    0,
  );
  const grand = Number(doc.total);
  const adjustment = grand - listedValue;

  return {
    title:
      doc.mode === "BATCH" ? "Batch promotion receipt" : "Promotion receipt",
    reference: doc.voucher_number,
    date: doc.date,
    status: doc.status,
    business,
    columnLabels: ["Qty", "Printed price", "Line total"],
    parties: [
      { label: "Manufacturer", value: doc.manufacturers.join(", ") },
      { label: "Wholesaler", value: business.name || "" },
      { label: "Wholesaler TIN", value: business.tin || "" },
      { label: "Mode", value: modeLabel(doc.mode) },
      { label: "Raised by", value: doc.created_by_name },
    ],
    lines: doc.lines.map((line) => ({
      item: line.item_name,
      voucher: `${line.voucher_number}${line.manufacturer ? ` · ${line.manufacturer}` : ""}`,
      quantity: qty(line.quantity),
      unitPrice: money(line.printed_price),
      total: money(line.line_total),
      note: line.change_reason,
    })),
    totals: [
      { label: "Value at listed selling price", value: money(listedValue) },
      { label: "Promotion adjustment", value: money(adjustment) },
      { label: "Grand total (printed price × qty)", value: money(grand) },
    ],
    linesCaption: `${qty(units)} units promoted across ${doc.lines.length} lot${
      doc.lines.length === 1 ? "" : "s"
    }. Printed price = lot selling price + the promotion change.`,
    note: doc.note,
    signatures: ["Manufacturer / authorised signatory", "Wholesale representative"],
  };
}

/** Maps an API approval record onto the print stamp shape. */
export function stampDecision(stamp: {
  decision: string;
  decided_by: string;
  decided_at: string;
  note: string;
} | null): ReceiptStampDecision {
  if (!stamp) return null;
  return {
    decision: stamp.decision,
    decidedBy: stamp.decided_by,
    decidedAt: fmtDateTime(stamp.decided_at),
    note: stamp.note,
  };
}

export function buildSettlementReceipt(
  row: SettlementRow,
  business: ReceiptBusiness,
): SettlementReceiptDoc {
  const sold = Number(row.sold_quantity);
  // expected = (unit sales + changing amount) × sold, so this is the
  // effective unit price the agent actually sold at.
  const effectiveUnitPrice = sold > 0 ? Number(row.expected_amount) / sold : 0;
  const costOfGoods = Number(row.unit_cost || 0) * sold;
  const sales = Number(row.sales_amount);
  const vatRate = Number(row.vat_rate || 0);
  const financeStamp = stampDecision(row.finance_approval);
  // Finance approves and penalises with one verdict, so the trail says both.
  const approvalTrail =
    financeStamp && row.penalty && financeStamp.decision === "APPROVED"
      ? { ...financeStamp, decision: "APPROVED WITH PENALTY" }
      : financeStamp;

  return {
    title: "Sales settlement receipt",
    reference: row.voucher_number,
    date: fmtDateTime(row.entered_at || row.created_at),
    status: row.status,
    tenant: business.name || "",
    business,
    agent: row.agent_name,
    item: row.item_name,
    category: row.category,
    voucher: row.voucher_number,
    paymentMethod: PAYMENT_LABELS[row.payment_method] ?? row.payment_method,
    enteredBy: row.entered_by_name,
    assignedQuantity: qty(row.assigned_quantity),
    soldQuantity: qty(row.sold_quantity),
    returnedQuantity: qty(row.returned_quantity),
    unitPrice: money(effectiveUnitPrice),
    salesAmount: money(row.sales_amount),
    expectedAmount: money(row.expected_amount),
    variance: money(row.variance),
    costOfGoods: money(costOfGoods),
    grossProfit: money(sales - costOfGoods),
    vatAmount: money(vatWithin(sales, vatRate)),
    penalty: row.penalty
      ? {
          amount: money(row.penalty_amount),
          reason: row.penalty_reason,
          raisedBy: row.finance_approval?.decided_by || "",
        }
      : null,
    note: row.note,
    financeApproval: approvalTrail,
    managerApproval: stampDecision(row.manager_approval),
  };
}
