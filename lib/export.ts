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

const stamp = () => new Date().toISOString().slice(0, 10);

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

export function exportPdf({
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
  const doc = new jsPDF({
    orientation: headers.length > 6 ? "landscape" : "portrait",
  });
  const width = doc.internal.pageSize.width;

  const eyebrow = business?.name
    ? `VoloSync · ${business.name}`
    : "VoloSync · business report";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...EMERALD_DARK);
  doc.text(eyebrow.toUpperCase(), 14, 12);
  if (business?.tin) {
    doc.setFont("helvetica", "normal");
    doc.text(`TIN ${business.tin}`, width - 14, 12, { align: "right" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(title, 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(subtitle ?? `Generated ${stamp()}`, 14, 27);

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.6);
  doc.line(14, 31, width - 14, 31);

  autoTable(doc, {
    startY: 35,
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
  note,
}: {
  title?: string;
  headers: string[];
  rows: Cell[][];
  file: string;
  sheet?: string;
  totals?: Cell[];
  /** Extra context printed on the About sheet. */
  note?: string;
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

  const about = XLSX.utils.aoa_to_sheet([
    ["Report", title ?? sheet],
    ["Business", note ?? "Wholesale business"],
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

export function exportAttendancePdf({
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
  exportPdf({ title, subtitle, headers, rows, file, totals, business });
}
