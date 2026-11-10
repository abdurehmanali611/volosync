import { jsPDF } from "jspdf";
import { APEX_SOLUTION, VOLOSYNC_SYSTEM } from "@/constants/branding";
import { readTenantBrand } from "@/lib/tenantBrand";

export type HrExportOrgBrand = {
  companyName: string;
  tinNumber?: string;
  logoUrl?: string | null;
};

/** Relative column widths (weights); they are normalized to the content width. */
export type HrPdfColumn = { header: string; weight: number };

const FOOTER_H = 12;
const TOP_BAR_H = 3;
const ROW_H = 6.4;
const HEADER_H = 8;

function shortDateTime(value: Date = new Date()) {
  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Helvetica-safe: strip characters jsPDF often garbles. */
function pdfSafe(text: string) {
  return String(text || "")
    .replace(/·/g, " | ")
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  if (
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  ) {
    return "JPEG";
  }
  return "PNG";
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

function readClientOrgBrand(): HrExportOrgBrand {
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

function tryAddImage(
  doc: jsPDF,
  dataUrl: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, imageFormat(dataUrl), x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

function clipCell(doc: jsPDF, text: string, maxW: number) {
  let out = pdfSafe(text);
  while (doc.getTextWidth(out) > maxW && out.length > 3) {
    out = `${out.slice(0, -2)}...`;
  }
  return out;
}

/** Slate bar + HR violet hairline, footer rule with system branding. */
function drawPageChrome(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  companyName: string,
  pageLabel: string,
  logos?: { system: string | null; apex: string | null },
) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, TOP_BAR_H, "F");
  doc.setFillColor(139, 92, 246);
  doc.rect(0, TOP_BAR_H, pageW, 0.8, "F");

  const footerTop = pageH - FOOTER_H;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerTop, pageW - margin, footerTop);

  const baseline = pageH - 4.0;
  const systemH = 5.2;
  const systemW = 9.5;
  const apexH = 5.2;
  const apexW = 20.8;
  const gap = 2.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(companyName, margin, baseline);

  const brandText = `${VOLOSYNC_SYSTEM.name}  |  Powered by ${APEX_SOLUTION.name}`;
  const brandW = doc.getTextWidth(brandText);
  const clusterW = systemW + gap + brandW + gap + apexW;
  const clusterX = (pageW - clusterW) / 2;
  const logoY = baseline - 3.9;

  tryAddImage(doc, logos?.system ?? null, clusterX, logoY, systemW, systemH);
  doc.setTextColor(100, 116, 139);
  doc.text(brandText, clusterX + systemW + gap, baseline);

  const apexX = clusterX + systemW + gap + brandW + gap;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(apexX - 1.2, logoY - 1.0, apexW + 2.4, apexH + 2.0, 0.8, 0.8, "F");
  tryAddImage(doc, logos?.apex ?? null, apexX, logoY, apexW, apexH);

  doc.setTextColor(100, 116, 139);
  doc.text(pageLabel, pageW - margin, baseline, { align: "right" });
}

function contentBottom(pageH: number, margin: number) {
  return pageH - margin - FOOTER_H;
}

/**
 * Generic HR table export: brand header card + paginated striped table.
 * Used for Attendance / Shifts downloads (Excel twin: exportRowsExcel).
 */
export async function downloadHrTablePdf(input: {
  title: string;
  /** Filter summary shown under the title (date range, status, employee…). */
  subtitle?: string;
  /** File name without the `.pdf` extension. */
  fileName: string;
  columns: HrPdfColumn[];
  rows: string[][];
  brand?: HrExportOrgBrand;
  emptyText?: string;
}): Promise<void> {
  const brand = input.brand ?? readClientOrgBrand();
  const [system, apex, hotelLogo] = await Promise.all([
    imageToDataUrl(VOLOSYNC_SYSTEM.logoPath),
    imageToDataUrl(APEX_SOLUTION.logoPath),
    brand.logoUrl ? imageToDataUrl(brand.logoUrl) : Promise.resolve(null),
  ]);
  const logos = { system, apex };

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let page = 1;

  const paintChrome = () =>
    drawPageChrome(doc, pageW, pageH, margin, brand.companyName, `Page ${page}`, logos);

  const newPage = () => {
    doc.addPage();
    page += 1;
    paintChrome();
  };

  paintChrome();

  let y = margin + TOP_BAR_H + 4;

  // —— Header card ——
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 24, 2.5, 2.5, "F");
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, 24, 2.5, 2.5, "S");

  if (hotelLogo) {
    tryAddImage(doc, hotelLogo, margin + 3, y + 3, 16, 16);
  } else {
    doc.setFillColor(139, 92, 246);
    doc.roundedRect(margin + 3, y + 3, 16, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(brand.companyName.slice(0, 2).toUpperCase(), margin + 11, y + 13, {
      align: "center",
    });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(pdfSafe(input.title), margin + 24, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (input.subtitle) {
    doc.text(clipCell(doc, input.subtitle, contentW * 0.72), margin + 24, y + 15);
  }
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfSafe(
      `${brand.companyName}${brand.tinNumber ? `  |  TIN ${brand.tinNumber}` : ""}`,
    ),
    margin + 24,
    y + 20,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${input.rows.length} row${input.rows.length === 1 ? "" : "s"}`,
    pageW - margin - 3,
    y + 12,
    { align: "right" },
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${shortDateTime()}`, pageW - margin - 3, y + 17.5, {
    align: "right",
  });

  y += 30;

  if (input.rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafe(input.emptyText || "Nothing to export."), margin, y + 8);
    doc.save(`${input.fileName}.pdf`);
    return;
  }

  const totalWeight = input.columns.reduce((sum, c) => sum + c.weight, 0) || 1;
  const colW = input.columns.map((c) => (c.weight / totalWeight) * contentW);

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, contentW, HEADER_H, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(248, 250, 252);
    let x = margin + 1.5;
    input.columns.forEach((c, i) => {
      doc.text(pdfSafe(c.header), x, y + 5.4);
      x += colW[i]!;
    });
    y += HEADER_H + 0.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
  };

  drawHeader();

  input.rows.forEach((row, idx) => {
    if (y + ROW_H > contentBottom(pageH, margin)) {
      newPage();
      y = margin + TOP_BAR_H + 4;
      drawHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, ROW_H, "F");
    }

    doc.setTextColor(30, 41, 59);
    let x = margin + 1.5;
    input.columns.forEach((_, i) => {
      doc.text(clipCell(doc, String(row[i] ?? ""), colW[i]! - 2), x, y + 4.4);
      x += colW[i]!;
    });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.12);
    doc.line(margin, y + ROW_H, pageW - margin, y + ROW_H);
    y += ROW_H;
  });

  doc.save(`${input.fileName}.pdf`);
}
