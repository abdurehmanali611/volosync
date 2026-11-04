"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ReceiptBusiness } from "@/lib/print";

type Cell = string | number;

const EMERALD: [number, number, number] = [5, 150, 105];
const EMERALD_DARK: [number, number, number] = [4, 120, 87];
const EMERALD_SOFT: [number, number, number] = [236, 253, 245];
const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const LINE: [number, number, number] = [228, 228, 231];
const ZEBRA: [number, number, number] = [250, 250, 251];

const APEX_LOGO = "/assets/apex-logo-dark-bg.png";
/** The Apex mark is 320x80, so width and height stay locked at 4:1. */
const APEX_LOGO_MM: [number, number] = [34, 8.5];

const stamp = () => new Date().toISOString().slice(0, 10);

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const url = /^(https?:|data:|blob:)/i.test(src)
      ? src
      : new URL(src, window.location.origin).href;
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
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

function pageChrome(doc: jsPDF) {
  const width = doc.internal.pageSize.width;
  const height = doc.internal.pageSize.height;

  doc.setFillColor(...EMERALD);
  doc.rect(0, 0, width, 2.5, "F");

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(14, height - 14, width - 14, height - 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Powered by VoloSync · wholesale inventory", 14, height - 9);
  doc.text("Apex Solution · www.apexsolutionhub.com", width - 14, height - 9, {
    align: "right",
  });

  const pages = doc.getNumberOfPages();
  for (let index = 1; index <= pages; index += 1) {
    doc.setPage(index);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${index} of ${pages}`, width / 2, height - 9, {
      align: "center",
    });
  }
}

/** Letterhead: business identity on the left, the Apex mark on the right. */
function letterhead(
  doc: jsPDF,
  input: {
    title: string;
    subtitle?: string;
    business?: ReceiptBusiness;
    apexLogo?: string | null;
    tenantLogo?: string | null;
  },
): number {
  const width = doc.internal.pageSize.width;
  const business = input.business;
  const name = business?.name?.trim() || "";

  let textX = 14;
  if (input.tenantLogo) {
    const props = doc.getImageProperties(input.tenantLogo);
    const logoHeight = 11;
    const logoWidth = Math.min(
      30,
      Math.round((props.width / props.height) * logoHeight * 10) / 10,
    );
    doc.addImage(
      input.tenantLogo,
      props.fileType || "PNG",
      14,
      7,
      logoWidth,
      logoHeight,
    );
    textX = 14 + logoWidth + 5;
  }

  const eyebrowWidth = Math.max(
    40,
    width - 14 - (input.apexLogo ? APEX_LOGO_MM[0] : 0) - 6 - textX,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...EMERALD_DARK);
  doc.text(`VoloSync · ${name || "business report"}`.toUpperCase(), textX, 12, {
    maxWidth: eyebrowWidth,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(input.title, textX, 21, { maxWidth: width - 14 - textX });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(input.subtitle ?? `Generated ${stamp()}`, textX, 27, {
    maxWidth: width - 14 - textX,
  });

  const contact = [
    business?.tin ? `TIN ${business.tin}` : "",
    business?.phone || "",
    business?.address || "",
  ]
    .filter(Boolean)
    .join(" · ");
  let baseline = 27;
  if (contact) {
    doc.setFontSize(7.5);
    doc.text(contact, textX, 32, { maxWidth: width - 14 - textX });
    baseline = 32;
  }

  if (input.apexLogo) {
    doc.addImage(
      input.apexLogo,
      "PNG",
      width - 14 - APEX_LOGO_MM[0],
      9,
      APEX_LOGO_MM[0],
      APEX_LOGO_MM[1],
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Apex Solution", width - 14, 12, { align: "right" });
  }

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.6);
  doc.line(14, baseline + 4, width - 14, baseline + 4);
  return baseline + 8;
}

export async function exportPdf({
  title,
  subtitle,
  headers,
  rows,
  file,
  totals,
  business,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Cell[][];
  file: string;
  totals?: Cell[];
  business?: ReceiptBusiness;
}) {
  const [apexLogo, tenantLogo] = await Promise.all([
    imageToDataUrl(APEX_LOGO),
    business?.logoUrl ? imageToDataUrl(business.logoUrl) : Promise.resolve(null),
  ]);
  const doc = new jsPDF({
    orientation: headers.length > 6 ? "landscape" : "portrait",
  });

  const startY = letterhead(doc, {
    title,
    subtitle,
    business,
    apexLogo,
    tenantLogo,
  });

  autoTable(doc, {
    startY,
    margin: { left: 14, right: 14, bottom: 20 },
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? ""))),
    foot: totals ? [totals.map((cell) => String(cell ?? ""))] : undefined,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: LINE,
      lineWidth: 0.1,
      textColor: [63, 63, 70],
    },
    headStyles: {
      fillColor: EMERALD,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
    },
    footStyles: {
      fillColor: EMERALD_SOFT,
      textColor: EMERALD_DARK,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: ZEBRA },
  });

  pageChrome(doc);
  doc.save(`${file}-${stamp()}.pdf`);
}

export function exportExcel({
  title,
  headers,
  rows,
  file,
  sheet = "Report",
  totals,
  business,
}: {
  title?: string;
  headers: string[];
  rows: Cell[][];
  file: string;
  sheet?: string;
  totals?: Cell[];
  /** Tenant identity, written to the About sheet. */
  business?: ReceiptBusiness;
}) {
  const data: Cell[][] = [];
  if (title) data.push([title]);
  data.push(headers);
  rows.forEach((row) => data.push(row));
  if (totals) data.push(totals);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.max(12, Math.min(34, header.length + 6)),
  }));

  const contact = [business?.phone || "", business?.address || ""]
    .filter(Boolean)
    .join(" · ");
  const about = XLSX.utils.aoa_to_sheet([
    ["Report", title ?? sheet],
    ["Business", business?.name || "Wholesale business"],
    ["TIN", business?.tin || "—"],
    ["Contact", contact || "—"],
    ["Generated", stamp()],
    ["System", "VoloSync · wholesale inventory"],
    ["Powered by", "Apex Solution · www.apexsolutionhub.com"],
  ]);
  about["!cols"] = [{ wch: 14 }, { wch: 52 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, worksheet, sheet.slice(0, 31));
  XLSX.utils.book_append_sheet(book, about, "About");
  XLSX.writeFile(book, `${file}-${stamp()}.xlsx`);
}
