/**
 * Minimal Excel export helpers for volosync.
 * Used by HrAttendancePanel for attendance/shift CSV downloads.
 */
import { toast } from "sonner";

/**
 * Export an array of row-objects to an Excel file.
 * @param fileName  File name without extension
 * @param sheetName Sheet tab label
 * @param rows      Array of plain objects (keys become column headers)
 */
export async function exportRowsExcel(
  fileName: string,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<boolean> {
  if (!rows.length) {
    toast.message("No rows to export.");
    return false;
  }
  try {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    return true;
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : "Excel export failed.",
    );
    return false;
  }
}
