"use client";

import { APEX_SOLUTION, VOLOSYNC_SYSTEM } from "@/constants/branding";

/** Letterhead identity printed on every receipt. */
export type ReceiptBusiness = {
  name?: string | null;
  tin?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
};

/** One decision in an approval trail; `null` means the step has not run. */
export type ReceiptStampDecision = {
  decision: string;
  decidedBy: string;
  decidedAt: string;
  note?: string;
} | null;

/** A penalty raised against a document — Finance gives amount and reason together. */
export type ReceiptPenalty = {
  amount: string;
  reason?: string;
  raisedBy?: string;
};

export type ReceiptLine = {
  item: string;
  voucher?: string;
  quantity: string;
  unitPrice: string;
  total: string;
  note?: string;
};

export type ReceiptDoc = {
  title: string;
  reference: string;
  date: string;
  status?: string;
  parties: { label: string; value: string }[];
  lines: ReceiptLine[];
  totals: { label: string; value: string }[];
  note?: string;
  /** Overrides the last three column headers (Qty, Unit price, Total). */
  columnLabels?: [string, string, string];
  /** Signature captions printed beside the ruled signing lines. */
  signatures?: [string, string];
  business?: ReceiptBusiness;
  /** Caption under the line table explaining how the totals were built. */
  linesCaption?: string;
};

const SYSTEM_NAME = VOLOSYNC_SYSTEM.name;

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(url?: string | null): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

function printedAt(): string {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status?: string): string {
  const value = (status || "").toUpperCase();
  if (value.includes("APPROV") || value.includes("PAID")) return "pill ok";
  if (value.includes("REJECT") || value.includes("CANCEL") || value.includes("VOID"))
    return "pill bad";
  if (value.includes("PEND") || value.includes("DRAFT") || value.includes("PARTIAL"))
    return "pill warn";
  return "pill";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return (letters.join("") || "WS").toUpperCase();
}

function logoMark(business?: ReceiptBusiness): string {
  const logo = absoluteUrl(business?.logoUrl);
  if (logo) {
    return `<img class="logo-img" src="${esc(logo)}" alt="${esc(
      business?.name || "Business logo",
    )}" />`;
  }
  return `<span class="logo-fallback">${esc(initialsOf(business?.name || "Wholesale"))}</span>`;
}

function headHtml(doc: ReceiptDoc, business?: ReceiptBusiness): string {
  const name = (business?.name || "").trim() || "Wholesale business";
  const contact = [business?.tin ? `TIN ${business.tin}` : "", business?.phone || ""]
    .filter(Boolean)
    .map((part) => esc(part))
    .join(" · ");

  return `<header class="head">
    <div class="identity">
      <div class="logo">${logoMark(business)}</div>
      <div class="identity-text">
        <p class="eyebrow">Wholesale distribution</p>
        <p class="business-name">${esc(name)}</p>
        <h1>${esc(doc.title)}</h1>
        ${contact ? `<p class="muted">${contact}</p>` : ""}
        ${business?.address ? `<p class="muted">${esc(business.address)}</p>` : ""}
      </div>
    </div>
    <div class="ref">
      <span class="sys-chip">${SYSTEM_NAME}</span>
      <p class="ref-no">${esc(doc.reference)}</p>
      <p>${esc(doc.date)}</p>
      ${doc.status ? `<span class="${statusClass(doc.status)}">${esc(doc.status.replaceAll("_", " "))}</span>` : ""}
    </div>
  </header>
  <div class="rule"></div>`;
}

function partiesHtml(doc: ReceiptDoc): string {
  const parties = doc.parties
    .filter((party) => String(party.value ?? "").trim())
    .map(
      (party) => `<div class="party">
        <span>${esc(party.label)}</span>
        <strong>${esc(party.value)}</strong>
      </div>`,
    )
    .join("");
  return parties ? `<div class="parties">${parties}</div>` : "";
}

function linesHtml(doc: ReceiptDoc): string {
  const [qtyLabel, unitLabel, totalLabel] = doc.columnLabels ?? [
    "Qty",
    "Unit price",
    "Total",
  ];
  const rows = doc.lines
    .map(
      (line, index) => `<tr>
        <td class="idx">${index + 1}</td>
        <td>
          <strong>${esc(line.item)}</strong>
          ${line.voucher ? `<div class="muted">${esc(line.voucher)}</div>` : ""}
          ${line.note ? `<div class="muted">${esc(line.note)}</div>` : ""}
        </td>
        <td class="right mono">${esc(line.quantity)}</td>
        <td class="right mono">${esc(line.unitPrice)}</td>
        <td class="right mono strong">${esc(line.total) || "—"}</td>
      </tr>`,
    )
    .join("");

  const caption = doc.linesCaption
    ? `<p class="table-caption">${esc(doc.linesCaption)}</p>`
    : "";

  return `<h2 class="section-label">Items${doc.lines.length === 1 ? "" : ` · ${doc.lines.length}`}</h2>
  <table>
    <colgroup>
      <col style="width:5%" /><col style="width:45%" /><col style="width:14%" />
      <col style="width:18%" /><col style="width:18%" />
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th class="right">${esc(qtyLabel)}</th>
        <th class="right">${esc(unitLabel)}</th>
        <th class="right">${esc(totalLabel)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>${caption}`;
}

function totalsHtml(totals: ReceiptDoc["totals"]): string {
  if (!totals.length) return "";
  const rows = totals
    .map((total, index) => {
      const grand = index === totals.length - 1;
      return `<div class="total${grand ? " grand" : ""}">
        <span>${esc(total.label)}</span>
        <strong>${esc(total.value)}</strong>
      </div>`;
    })
    .join("");
  return `<div class="fin">
    <h2 class="section-label">Financial summary</h2>
    <div class="totals-card">${rows}</div>
  </div>`;
}

function signaturesHtml(doc: ReceiptDoc): string {
  const labels = doc.signatures ?? [
    "Manufacturer / authorised signatory",
    "Wholesale representative",
  ];
  const blocks = labels
    .map(
      (label) => `<div class="sign">
        <span class="sign-label">${esc(label)}</span>
        <span class="sign-line"></span>
      </div>`,
    )
    .join("");
  return `<div class="signs">${blocks}</div>`;
}

function stampBlock(label: string, stamp: ReceiptStampDecision | undefined) {
  if (!stamp) {
    return `<div class="stamp"><span>${esc(label)}</span><p class="muted">pending</p></div>`;
  }
  return `<div class="stamp${stamp.decision === "REJECTED" ? " bad" : stamp.decision.startsWith("APPROVED") ? " ok" : ""}">
      <span>${esc(label)}</span>
      <p class="decision">${esc(stamp.decision.replaceAll("_", " "))}</p>
      <p class="muted">${esc(stamp.decidedBy || "—")}</p>
      <p class="muted">${esc(stamp.decidedAt || "")}</p>
      ${stamp.note ? `<p class="muted">note: ${esc(stamp.note)}</p>` : ""}
    </div>`;
}

function stampsHtml(
  stamps: { label: string; stamp: ReceiptStampDecision | undefined }[],
): string {
  return `<h2 class="section-label">Approval trail</h2>
  <div class="stamps">${stamps
    .map((entry) => stampBlock(entry.label, entry.stamp))
    .join("")}</div>`;
}

function penaltyHtml(penalty: ReceiptPenalty | null | undefined): string {
  if (!penalty) return "";
  return `<div class="penalty">
    <div class="penalty-head">
      <span>Penalty raised</span>
      <strong>${esc(penalty.amount)}</strong>
    </div>
    ${penalty.reason ? `<p class="penalty-reason">${esc(penalty.reason)}</p>` : ""}
    ${penalty.raisedBy ? `<p class="penalty-by">Raised by ${esc(penalty.raisedBy)}</p>` : ""}
  </div>`;
}

function footerHtml(): string {
  return `<footer class="foot">
    <div class="foot-brand">
      <img class="system-logo" src="${esc(absoluteUrl(VOLOSYNC_SYSTEM.logoPath))}" alt="${esc(
        VOLOSYNC_SYSTEM.name,
      )}" />
      <div>
        <p class="foot-name">${esc(VOLOSYNC_SYSTEM.name)}</p>
        <p class="foot-tag">Wholesale management ERP</p>
        <p class="foot-link">${esc(APEX_SOLUTION.name)} · ${esc(
          APEX_SOLUTION.website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        )}</p>
      </div>
    </div>
    <div class="foot-meta">
      <p>Powered by <strong>${SYSTEM_NAME}</strong> wholesale inventory &amp; finance</p>
      <p>Printed ${esc(printedAt())}</p>
      <p class="foot-legal">System-generated document · valid with the signatures above</p>
    </div>
  </footer>`;
}

function docHtml(doc: ReceiptDoc) {
  const note = doc.note
    ? `<div class="note"><strong>Note</strong><p>${esc(doc.note)}</p></div>`
    : "";
  const totals = totalsHtml(doc.totals);

  return `<section class="sheet">
    ${headHtml(doc, doc.business)}
    ${partiesHtml(doc)}
    ${linesHtml(doc)}
    <div class="bottom">${note}${totals}</div>
    ${signaturesHtml(doc)}
    ${footerHtml()}
  </section>`;
}

const receiptCss = `
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif;
    color: #18181b;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { padding: 0 4mm; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .identity { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
  .logo {
    width: 52px; height: 52px; flex: 0 0 auto; overflow: hidden; border-radius: 14px;
    border: 2px solid rgba(5, 150, 105, 0.25); background: #ecfdf5;
    display: flex; align-items: center; justify-content: center;
  }
  .logo-img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .logo-fallback { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; color: #047857; }
  .identity-text { min-width: 0; }
  .eyebrow { margin: 0; font-size: 8.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #047857; }
  .business-name { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: #3f3f46; }
  h1 { margin: 2px 0 0; font-size: 20px; letter-spacing: -0.01em; color: #18181b; }
  .muted { margin: 2px 0 0; font-size: 9.5px; color: #71717a; }
  .ref { flex: 0 0 auto; text-align: right; }
  .sys-chip {
    display: inline-block; padding: 2px 6px; border: 1px solid #e4e4e7; border-radius: 6px;
    background: #fafafa; color: #52525b; font-size: 8px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
  }
  .ref-no { margin: 6px 0 0; font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 10.5px; font-weight: 600; color: #18181b; }
  .ref p { margin: 2px 0; font-size: 9.5px; color: #52525b; }
  .pill {
    display: inline-block; margin-top: 4px; padding: 2px 8px; border: 1px solid #e4e4e7;
    border-radius: 999px; color: #3f3f46; font-size: 8px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .pill.ok { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
  .pill.warn { background: #fffbeb; border-color: #fde68a; color: #b45309; }
  .pill.bad { background: #fff1f2; border-color: #fecdd3; color: #be123c; }
  .rule { height: 3px; margin: 12px 0 14px; border-radius: 999px; background: linear-gradient(90deg, #059669, #34d399, #14b8a6); }
  .parties { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  .party { min-width: 0; padding: 7px 9px; border: 1px solid #e4e4e7; border-radius: 10px; background: #fafafa; }
  .party span { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #a1a1aa; }
  .party strong { display: block; margin-top: 2px; font-size: 10.5px; color: #27272a; overflow-wrap: anywhere; }
  .section-label { margin: 14px 0 6px; font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #71717a; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead th {
    padding: 6px 7px; border-bottom: 1px solid #e4e4e7; background: #f4f4f5;
    color: #52525b; font-size: 8px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; text-align: left;
  }
  tbody td { padding: 7px; border-bottom: 1px solid #f1f1f3; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fcfcfd; }
  .right { text-align: right; }
  .mono { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-variant-numeric: tabular-nums; }
  .strong { color: #18181b; font-weight: 600; }
  .idx { color: #a1a1aa; font-size: 9px; }
  .bottom { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; margin-top: 10px; }
  .note { flex: 1 1 auto; min-width: 160px; padding-left: 8px; border-left: 2px solid #a7f3d0; }
  .note strong { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #a1a1aa; }
  .note p { margin: 2px 0 0; font-size: 9px; color: #52525b; }
  .fin { flex: 0 0 52%; margin-left: auto; }
  .fin .section-label { margin-top: 0; }
  .totals-card { padding: 7px 10px; border: 1px solid #e4e4e7; border-radius: 10px; background: #fff; }
  .total { display: flex; justify-content: space-between; gap: 10px; padding: 3.5px 0; border-bottom: 1px dashed #ececef; font-size: 10px; color: #52525b; }
  .total:last-child { border-bottom: none; }
  .total strong { color: #27272a; font-variant-numeric: tabular-nums; }
  .total.grand { margin-top: 2px; padding-top: 6px; border-top: 1px solid #e4e4e7; border-bottom: none; font-size: 11.5px; font-weight: 700; color: #18181b; }
  .total.grand strong { color: #047857; }
  .table-caption { margin: 5px 0 0; font-size: 8.5px; line-height: 1.5; color: #a1a1aa; }
  .penalty {
    margin-top: 12px; padding: 9px 12px; border: 1px solid #fecdd3; border-left: 3px solid #e11d48;
    border-radius: 10px; background: #fff1f2; break-inside: avoid;
  }
  .penalty-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .penalty-head span { font-size: 7.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #be123c; }
  .penalty-head strong { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 12.5px; color: #9f1239; }
  .penalty-reason { margin: 4px 0 0; font-size: 9.5px; line-height: 1.45; color: #4c0519; }
  .penalty-by { margin: 3px 0 0; font-size: 8px; color: #be123c; }
  .signs {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 22px;
    margin-top: 18px; padding: 12px 14px; border: 1px solid #e4e4e7; border-radius: 10px;
    break-inside: avoid;
  }
  .sign { display: flex; align-items: flex-end; gap: 10px; min-width: 0; }
  .sign-label { flex: 0 0 42%; margin-bottom: 2px; font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em; line-height: 1.35; text-transform: uppercase; color: #71717a; }
  .sign-line { flex: 1 1 auto; height: 16px; border-bottom: 1.5px solid #a1a1aa; }
  .stamps { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px; break-inside: avoid; }
  .stamp { flex: 1 1 200px; padding: 8px 10px; border: 1px solid #e4e4e7; border-radius: 10px; break-inside: avoid; }
  .stamp span { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #a1a1aa; }
  .stamp p { margin: 3px 0 0; font-size: 10px; color: #334155; }
  .stamp .decision { font-weight: 700; color: #18181b; }
  .stamp.ok { border-color: #a7f3d0; background: #ecfdf5; }
  .stamp.ok .decision { color: #065f46; }
  .stamp.ok .decision::before { content: "\\2713  "; color: #059669; }
  .stamp.bad { border-color: #fecdd3; background: #fff1f2; }
  .stamp.bad .decision { color: #9f1239; }
  .stamp.bad .decision::before { content: "\\2715  "; color: #e11d48; }
  .foot {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    margin-top: 18px; padding: 10px 13px; border: 1px solid #0b1220; border-radius: 12px;
    background: linear-gradient(100deg, #0c1524, #101d33 58%, #0e2a26);
    break-inside: avoid;
  }
  .foot-brand { display: flex; align-items: center; gap: 11px; }
  .system-logo { display: block; height: 34px; width: auto; border-radius: 7px; }
  .foot-name { margin: 0; font-size: 11px; font-weight: 700; color: #f8fafc; letter-spacing: 0.02em; }
  .foot-tag { margin: 1px 0 0; font-size: 7px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #f59e0b; }
  .foot-link { margin: 3px 0 0; font-size: 8.5px; color: #94a3b8; }
  .foot-meta { text-align: right; font-size: 8px; line-height: 1.55; color: #cbd5e1; }
  .foot-meta p { margin: 2px 0; }
  .foot-meta strong { font-size: 7.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #34d399; }
  .foot-legal { color: #64748b !important; font-style: italic; }
  @page { size: A4; margin: 10mm; }
`;

function writeAndPrint(title: string, body: string) {
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>${receiptCss}</style></head>
<body>${body}
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => frame.remove(), 60000);
}

/** Opens a print-ready window with one page per document. */
export function printReceipts(docs: ReceiptDoc[]) {
  if (!docs.length) return;
  writeAndPrint(docs[0].title, docs.map(docHtml).join(""));
}

// ------------------------------------------------------- settlement receipt

export type SettlementReceiptDoc = {
  title?: string;
  /** Voucher number of the settlement, printed top-right. */
  reference: string;
  /** Settlement date (entered-at). */
  date: string;
  status?: string;
  tenant?: string;
  business?: ReceiptBusiness;
  agent: string;
  item: string;
  category?: string;
  voucher?: string;
  paymentMethod: string;
  enteredBy: string;
  assignedQuantity: string;
  soldQuantity: string;
  returnedQuantity: string;
  /** unit sales + changing amount, already formatted. */
  unitPrice: string;
  expectedAmount: string;
  /** Expected gross less the penalty: the cash the agent actually handed over. */
  collectedAmount: string;
  /** Derived from the lot's unit cost and the VAT rate; printed when known. */
  costOfGoods?: string;
  grossProfit?: string;
  vatAmount?: string;
  /** Finance's verdict — amount and reason are raised together. */
  penalty?: ReceiptPenalty | null;
  note?: string;
  financeApproval?: ReceiptStampDecision;
  managerApproval?: ReceiptStampDecision;
  signatures?: [string, string];
};

/** One A4 sheet for a single settlement — same layout conventions as docHtml. */
export function buildSettlementReceiptSheet(doc: SettlementReceiptDoc) {
  const business: ReceiptBusiness = {
    name: doc.business?.name || doc.tenant || "Wholesale business",
    tin: doc.business?.tin ?? null,
    address: doc.business?.address ?? null,
    phone: doc.business?.phone ?? null,
    logoUrl: doc.business?.logoUrl ?? null,
  };

  const headerDoc: ReceiptDoc = {
    title: doc.title ?? "Sales settlement receipt",
    reference: doc.reference,
    date: doc.date,
    status: doc.status,
    business,
    parties: [
      { label: "Wholesaler", value: doc.tenant || business.name || "—" },
      { label: "Wholesaler TIN", value: business.tin || "" },
      { label: "Sales agent", value: doc.agent || "—" },
      { label: "Item", value: doc.item },
      { label: "Category", value: doc.category || "" },
      { label: "Voucher", value: doc.voucher || doc.reference },
      { label: "Payment method", value: doc.paymentMethod },
      { label: "Entered by", value: doc.enteredBy || "—" },
    ],
    lines: [],
    totals: [],
  };

  const totals = [{ label: "Expected gross", value: doc.expectedAmount }];
  if (doc.penalty)
    totals.push({ label: "Penalty · not brought in", value: doc.penalty.amount });
  if (doc.costOfGoods) totals.push({ label: "Cost of goods sold", value: doc.costOfGoods });
  if (doc.grossProfit) totals.push({ label: "Gross profit", value: doc.grossProfit });
  if (doc.vatAmount) totals.push({ label: "VAT within sales", value: doc.vatAmount });

  const financials = [
    ...totals.map(
      (total) =>
        `<div class="total"><span>${esc(total.label)}</span><strong>${esc(total.value)}</strong></div>`,
    ),
    `<div class="total grand"><span>Collected gross</span><strong>${esc(doc.collectedAmount)}</strong></div>`,
  ].join("");

  return `<section class="sheet">
    ${headHtml(headerDoc, business)}
    ${partiesHtml(headerDoc)}
    <h2 class="section-label">Stock reconciliation</h2>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="right">Assigned</th>
          <th class="right">Sold</th>
          <th class="right">Returned</th>
          <th class="right">Effective unit price</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${esc(doc.item)}</strong><div class="muted">${esc(doc.voucher || doc.reference)}</div></td>
          <td class="right mono">${esc(doc.assignedQuantity)}</td>
          <td class="right mono">${esc(doc.soldQuantity)}</td>
          <td class="right mono">${esc(doc.returnedQuantity)}</td>
          <td class="right mono">${esc(doc.unitPrice)}</td>
        </tr>
      </tbody>
    </table>
    <p class="table-caption">Unsold stock returns to the voucher on approval. Collected gross = expected gross − penalty.</p>
    <div class="bottom">
      ${doc.note ? `<div class="note"><strong>Note</strong><p>${esc(doc.note)}</p></div>` : ""}
      <div class="fin">
        <h2 class="section-label">Financial summary</h2>
        <div class="totals-card">${financials}</div>
      </div>
    </div>
    ${penaltyHtml(doc.penalty)}
    ${stampsHtml([
      { label: "Finance approval", stamp: doc.financeApproval },
      { label: "Manager approval", stamp: doc.managerApproval },
    ])}
    ${signaturesHtml({ ...headerDoc, signatures: doc.signatures })}
    ${footerHtml()}
  </section>`;
}

/** Opens a print-ready window with one A4 sheet per settlement. */
export function printSettlementReceipts(docs: SettlementReceiptDoc[]) {
  if (!docs.length) return;
  writeAndPrint(
    docs[0].title ?? "Sales settlement receipt",
    docs.map(buildSettlementReceiptSheet).join(""),
  );
}
