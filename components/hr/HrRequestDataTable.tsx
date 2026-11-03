"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/app/StoreItems/data-table";
import {
  HrEmployeeCombobox,
  type HrComboboxPerson,
} from "@/components/hr/HrEmployeeCombobox";
import { HrEmptyState, HrTableFrame } from "@/components/hr/hrChrome";
import { cn } from "@/lib/utils";

export function hrStatusTone(status: string) {
  const s = status.toLowerCase();
  if (
    s === "pending" ||
    s === "awaiting_manager" ||
    s === "open" ||
    s === "draft"
  ) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  if (
    s === "approved" ||
    s === "applied" ||
    s === "finalized" ||
    s === "available" ||
    s === "completed" ||
    s === "done" ||
    s === "paid" ||
    s === "active" ||
    s === "issued"
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
  }
  if (s === "rejected" || s === "returned" || s === "closed") {
    return "border-border/70 bg-muted/40 text-muted-foreground";
  }
  return "border-border/70 bg-muted/30 text-muted-foreground";
}

export function HrStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        hrStatusTone(status),
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

/**
 * Shared People Ops / Compensation / Checklist queue table:
 * optional employee combobox above DataTable search + column visibility.
 */
export function HrRequestDataTable<T extends { id: number }>({
  data,
  columns,
  employees = [],
  getEmployeeId,
  enableEmployeeFilter = true,
  searchPlaceholder = "Search…",
  searchColumnId,
  emptyTitle,
  emptyDescription,
  pageSize = 8,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  employees?: HrComboboxPerson[];
  getEmployeeId?: (row: T) => number | null | undefined;
  enableEmployeeFilter?: boolean;
  searchPlaceholder?: string;
  searchColumnId?: string;
  emptyTitle: string;
  emptyDescription: string;
  pageSize?: number;
}) {
  const [filterEmpId, setFilterEmpId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!enableEmployeeFilter || filterEmpId == null || !getEmployeeId) {
      return data;
    }
    return data.filter((row) => Number(getEmployeeId(row)) === filterEmpId);
  }, [data, enableEmployeeFilter, filterEmpId, getEmployeeId]);

  if (!data.length) {
    return <HrEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      {enableEmployeeFilter && getEmployeeId ? (
        <div className="flex justify-end">
          <div className="w-full max-w-[16rem] space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Employee
            </Label>
            <HrEmployeeCombobox
              employees={employees}
              valueIds={filterEmpId ? [filterEmpId] : []}
              onChange={(ids) => setFilterEmpId(ids[0] ?? null)}
              placeholder="All employees…"
            />
          </div>
        </div>
      ) : null}
      <HrTableFrame>
        <DataTable
          embedded
          columns={columns}
          data={filtered}
          searchPlaceholder={searchPlaceholder}
          searchColumnId={searchColumnId}
          emptyMessage="No rows match this filter."
          pageSize={pageSize}
        />
      </HrTableFrame>
    </div>
  );
}
