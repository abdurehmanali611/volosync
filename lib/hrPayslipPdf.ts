import { jsPDF } from "jspdf";
import type { HrPayslip } from "@/lib/api/hrSource";
import { APEX_SOLUTION, VOLOSYNC_SYSTEM } from "@/constants/branding";
import {
  formatPayrollWeeksLabel,
  payrollWeeksInRange,
} from "@/lib/hrPayrollMonth";
import { formatETB } from "@/lib/subscriptionModules";
import { readTenantBrand } from "@/lib/tenantBrand";

export type PayslipOrgBrand = {
  companyName: string;
  tinNumber?: string;
  logoUrl?: string | null;
};

function money(n: number) {
  return formatETB(Number(n) || 0);
}

function wageLabel(slip: HrPayslip): string {
  const wt = String(slip.wageType || "").trim();
  if (wt === "weekly") {
    const from = slip.period?.fromYmd || "";
    const to = slip.period?.toYmd || "";
    const noteMatch = String(slip.notes || "").match(/payrollWeeks=([\d.]+)/);
    const weeks = noteMatch
      ? Number(noteMatch[1]) || 0
      : from && to
        ? payrollWeeksInRange(from, to)
        : 0;
    return weeks > 0
      ? `Weekly · ${formatPayrollWeeksLabel(weeks)}`
      : "Weekly";
  }
  if (wt === "monthly") return "Monthly";
  return wt || "—";
}

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const url =
      src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")
        ? src
        : typeof window !== "undefined"
          ? new URL(src, window.location.origin).href
          : src;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "") || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  headers: string[],
  rows: string[][],
  colWeights: number[],
  opts?: { headerRgb?: [number, number, number] },
) {
  const rowH = 7.2;
  const totalW = colWeights.reduce((a, b) => a + b, 0);
  const colWs = colWeights.map((w) => (w / totalW) * width);
  let cursorY = y;
  const [hr, hg, hb] = opts?.headerRgb ?? [236, 253, 245];

  doc.setFillColor(hr, hg, hb);
  doc.rect(x, cursorY, width, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  let cx = x + 1.5;
  headers.forEach((h, i) => {
    doc.text(h, cx, cursorY + 4.9);
    cx += colWs[i];
  });
  cursorY += rowH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  rows.forEach((row, rowIndex) => {
    if (rowIndex % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(x, cursorY, width, rowH, "F");
    }
    cx = x + 1.5;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ""), cx, cursorY + 4.9, {
        maxWidth: colWs[i] - 2,
      });
      cx += colWs[i];
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(x, cursorY + rowH, x + width, cursorY + rowH);
    cursorY += rowH;
  });
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, cursorY - y);
  doc.setTextColor(0, 0, 0);
  return cursorY;
}

function readClientOrgBrand(): PayslipOrgBrand {
  if (typeof window === "undefined") {
    return { companyName: "Organization" };
  }
  const brand = readTenantBrand();
  return {
    companyName: brand.companyName,
    tinNumber: brand.tinNumber,
    logoUrl: brand.logoUrl,
  };
}

/** One PDF per payslip. Batch = call this multiple times. */
export async function downloadPayslipPdf(
  slip: HrPayslip,
  brand?: PayslipOrgBrand,
) {
  const org = brand ?? readClientOrgBrand();
  const companyName = (org.companyName || "Organization").trim() || "Organization";
  const tin =
    (org.tinNumber || "").trim() ||
    (String(slip.HotelName || "").trim() !== companyName
      ? String(slip.HotelName || "").trim()
      : "");
  const month = slip.taxPeriod || slip.period?.monthName || "—";

  const [companyLogoData, systemLogoData] = await Promise.all([
    org.logoUrl ? imageToDataUrl(org.logoUrl) : Promise.resolve(null),
    imageToDataUrl(VOLOSYNC_SYSTEM.logoPath),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 10;

  // Top accent
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageW, 3.5, "F");

  // —— Header: company (left) + payslip meta (right) ——
  const headerTop = y;
  const logoSize = 18;

  if (companyLogoData) {
    try {
      doc.addImage(
        companyLogoData,
        "PNG",
        margin,
        headerTop,
        logoSize,
        logoSize,
        undefined,
        "FAST",
      );
    } catch {
      // fall through to monogram
    }
  }
  if (!companyLogoData) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, headerTop, logoSize, logoSize, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    doc.text(companyName.slice(0, 2).toUpperCase(), margin + logoSize / 2, headerTop + 11, {
      align: "center",
    });
  }

  const textLeft = margin + logoSize + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text("EMPLOYER", textLeft, headerTop + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const nameLines = doc.splitTextToSize(companyName, contentW * 0.48);
  doc.text(nameLines, textLeft, headerTop + 10);

  let leftMetaY = headerTop + 10 + nameLines.length * 5.5;
  if (tin) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`TIN ${tin}`, textLeft, leftMetaY);
    leftMetaY += 5;
  }

  // Right column
  const rightX = margin + contentW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text("PAYSLIP", rightX, headerTop + 4, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`Month of ${month}`, rightX, headerTop + 11, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `No. ${slip.payslipNumber || slip.id}`,
    rightX,
    headerTop + 17,
    { align: "right" },
  );
  if (slip.payDate) {
    doc.text(`Pay date ${slip.payDate}`, rightX, headerTop + 22, {
      align: "right",
    });
  }

  // VoloSync chip (top-right under meta)
  if (systemLogoData) {
    try {
      doc.addImage(
        systemLogoData,
        "PNG",
        rightX - 10,
        headerTop + 24,
        10,
        5.5,
        undefined,
        "FAST",
      );
    } catch {
      /* ignore */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(VOLOSYNC_SYSTEM.name, rightX, headerTop + 32, { align: "right" });

  y = Math.max(leftMetaY, headerTop + 35) + 3;

  // Emerald gradient-ish rule
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1.1);
  doc.line(margin, y, margin + contentW * 0.55, y);
  doc.setDrawColor(45, 212, 191);
  doc.setLineWidth(0.6);
  doc.line(margin + contentW * 0.55, y, margin + contentW, y);
  y += 7;

  // Employee block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Employee", margin, y);
  y += 2;
  y = drawTable(
    doc,
    margin,
    y,
    contentW,
    [
      "Name",
      "Job title",
      "Tax period",
      "Wage",
      "Pay date",
      "Payslip #",
      "Date hired",
    ],
    [
      [
        slip.employeeName || slip.employee?.fullName || "—",
        slip.jobTitle || "—",
        slip.taxPeriod || "—",
        wageLabel(slip),
        slip.payDate || "—",
        slip.payslipNumber || "—",
        slip.hireDate || "—",
      ],
    ],
    [2.0, 1.4, 1.2, 1.8, 1.2, 1.4, 1.2],
  );
  y += 8;

  const halfGap = 4;
  const halfW = (contentW - halfGap) / 2;
  const leftX = margin;
  const rightCol = margin + halfW + halfGap;

  const deductionRows = (slip.deductions || []).map((r) => [
    r.label,
    money(r.amountETB),
  ]);
  if (!deductionRows.length) deductionRows.push(["—", money(0)]);
  const earningRows = (slip.earnings || []).map((r) => [
    r.label,
    money(r.amountETB),
  ]);
  if (!earningRows.length) {
    earningRows.push(["Gross salary", money(slip.grossSalaryETB)]);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Deductions", leftX, y);
  doc.text("Earnings", rightCol, y);
  y += 2;

  const dedBottom = drawTable(
    doc,
    leftX,
    y,
    halfW,
    ["Description", "Amount"],
    deductionRows,
    [2.2, 1],
    { headerRgb: [255, 241, 242] },
  );
  const earnBottom = drawTable(
    doc,
    rightCol,
    y,
    halfW,
    ["Description", "Amount"],
    earningRows,
    [2.2, 1],
    { headerRgb: [236, 253, 245] },
  );
  y = Math.max(dedBottom, earnBottom) + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(190, 18, 60);
  doc.text(
    `Total Deduction: ${money(slip.totalDeductionsETB)}`,
    leftX + halfW,
    y,
    { align: "right" },
  );
  doc.setTextColor(5, 150, 105);
  doc.text(
    `Total Earnings: ${money(slip.totalEarningsETB)}`,
    rightCol + halfW,
    y,
    { align: "right" },
  );
  y += 10;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y - 2, contentW, 28, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Payment method: ${slip.bankName || "—"}`, margin + 4, y + 6);
  doc.text(`Account number: ${slip.accountNumber || "—"}`, margin + 4, y + 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`Net pay: ${money(slip.netPayETB)}`, margin + 4, y + 22);
  y += 32;

  // —— VoloSync / Apex footer (store-receipt style) ——
  const footerH = 28;
  const footerY = Math.max(y + 4, pageH - margin - footerH);

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, footerY, contentW, footerH, 2.5, 2.5, "FD");

  const footerPad = footerY + 5;
  if (systemLogoData) {
    try {
      doc.addImage(
        systemLogoData,
        "PNG",
        margin + 4,
        footerPad - 1,
        26,
        14.2,
        undefined,
        "FAST",
      );
    } catch {
      /* ignore */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(6, 78, 59);
  doc.text(VOLOSYNC_SYSTEM.name, margin + 34, footerPad + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text(
    `${APEX_SOLUTION.name} · ${APEX_SOLUTION.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}`,
    margin + 34,
    footerPad + 10,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const powered = `Powered by ${VOLOSYNC_SYSTEM.name} · HR payroll`;
  doc.text(powered, margin + contentW - 4, footerPad + 5, { align: "right" });
  doc.text(new Date().toLocaleString(), margin + contentW - 4, footerPad + 10, {
    align: "right",
  });

  const safeName = (slip.employeeName || "employee")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
  doc.save(
    `Payslip_${slip.payslipNumber || slip.id}_${safeName || "employee"}.pdf`,
  );
}

export async function downloadPayslipPdfs(
  slips: HrPayslip[],
  brand?: PayslipOrgBrand,
) {
  const resolved = brand ?? readClientOrgBrand();
  for (const slip of slips) {
    await downloadPayslipPdf(slip, resolved);
  }
}
