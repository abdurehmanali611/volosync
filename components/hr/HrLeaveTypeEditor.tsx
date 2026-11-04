"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { PendingButton } from "@/components/ui/pending-button";
import { cn } from "@/lib/utils";
import { notifyApiFailure } from "@/lib/actions";
import { fetchHrLeaveTypes, replaceHrLeaveTypesApi } from "@/lib/api/hrSource";
import { slugLeaveTypeCode, type HrLeaveTypeSetting } from "@/lib/hrLeaveTypes";
import { hrFieldClass, hrPrimaryBtnClass } from "@/components/hr/hrChrome";

const LINE_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_110px_120px_40px] lg:items-end lg:gap-x-2.5";

type LeaveTypeLine = {
  key: string;
  code: string;
  label: string;
  defaultDays: number;
  paid: boolean;
};

function emptyLine(key: string): LeaveTypeLine {
  return { key, code: "", label: "", defaultDays: 0, paid: true };
}

function linesFromSettings(types: HrLeaveTypeSetting[]): LeaveTypeLine[] {
  return types.map((type, index) => ({
    key: `saved-${type.code}-${index}`,
    code: type.code,
    label: type.label,
    defaultDays: type.defaultDays,
    paid: type.paid,
  }));
}

function settingsFromLines(lines: LeaveTypeLine[]): HrLeaveTypeSetting[] {
  const seen = new Set<string>();
  const next: HrLeaveTypeSetting[] = [];
  for (const line of lines) {
    const label = line.label.trim();
    if (!label) continue;
    const code = line.code || slugLeaveTypeCode(label);
    if (!code) continue;
    let unique = code;
    let n = 2;
    while (seen.has(unique)) unique = `${code}_${n++}`;
    seen.add(unique);
    next.push({
      code: unique,
      label,
      paid: line.paid,
      defaultDays: Math.max(0, Math.min(366, Number(line.defaultDays) || 0)),
      active: true,
    });
  }
  return next;
}

function signature(lines: LeaveTypeLine[]): string {
  return JSON.stringify(settingsFromLines(lines));
}

export function HrLeaveTypeEditor() {
  const rowIdRef = useRef(0);
  const [lines, setLines] = useState<LeaveTypeLine[]>([]);
  const [saved, setSaved] = useState("[]");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const types = await fetchHrLeaveTypes();
        if (cancelled) return;
        const next = linesFromSettings(types);
        rowIdRef.current = next.length;
        setLines(next);
        setSaved(signature(next));
      } catch (e) {
        notifyApiFailure(e, "Could not load leave types");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = useMemo(() => settingsFromLines(lines), [lines]);
  const dirty = signature(lines) !== saved;
  const hasBlankLine = lines.some((line) => !line.label.trim());

  const addLine = () => {
    rowIdRef.current += 1;
    setLines((current) => [...current, emptyLine(`line-${rowIdRef.current}`)]);
  };

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, patch: Partial<LeaveTypeLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const save = async () => {
    setPending(true);
    try {
      const types = await replaceHrLeaveTypesApi(draft);
      const next = linesFromSettings(types);
      rowIdRef.current = next.length;
      setLines(next);
      setSaved(signature(next));
      toast.success("Leave types saved");
    } catch (e) {
      notifyApiFailure(e, "Could not save leave types");
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/15 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading leave types…
      </div>
    );
  }

  const hasLines = lines.length > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/15 p-4 sm:p-5">
      {!hasLines ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-muted/15 px-6 py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarDays className="h-7 w-7 text-primary/80 dark:text-primary" />
          </div>
          <p className="text-lg font-semibold">No leave types yet</p>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Add the leave types HR will use when filing leave for employees.
            Default days become the starting balance for new staff.
          </p>
          <Button
            type="button"
            size="lg"
            className={cn("mt-4 gap-2 shadow-sm", hrPrimaryBtnClass)}
            onClick={addLine}
          >
            <Plus className="h-4 w-4" />
            Add first leave type
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-linear-to-r from-primary/10 via-fuchsia-400/5 to-primary/5 px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary dark:text-primary" />
              <p className="text-sm font-semibold">Leave types</p>
              <Badge
                variant="secondary"
                className="h-5 border-primary/20 bg-primary/10 px-1.5 text-[10px] text-primary dark:text-primary"
              >
                {lines.length}
              </Badge>
              {dirty ? (
                <Badge className="h-5 border-amber-500/30 bg-amber-500/15 px-1.5 text-[10px] text-amber-900 dark:text-amber-200">
                  Unsaved
                </Badge>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              LINE_GRID,
              "mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid",
            )}
          >
            <span>Type name</span>
            <span className="text-center">Days</span>
            <span className="text-center">Paid</span>
            <span className="sr-only">Remove</span>
          </div>

          <ScrollArea className="h-[min(42vh,420px)]">
            <div className="space-y-3 pr-3 sm:pr-4">
              {lines.map((line, index) => (
                <article
                  key={line.key}
                  className="overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-br from-card via-card to-primary/5 shadow-sm ring-1 ring-primary/10"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-primary/15 bg-primary/5 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary dark:text-primary">
                        {index + 1}
                      </span>
                      {line.label.trim() ? (
                        <span className="truncate text-sm font-medium text-foreground">
                          {line.label.trim()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          New leave type
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 border-primary/20 bg-primary/5 text-[11px] font-semibold text-primary dark:text-primary"
                    >
                      {line.paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>

                  <div className={cn(LINE_GRID, "p-4 pt-3")}>
                    <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                      <Label className="text-xs font-medium text-muted-foreground sm:sr-only">
                        Type name
                      </Label>
                      <Input
                        value={line.label}
                        onChange={(e) =>
                          updateLine(index, { label: e.target.value })
                        }
                        placeholder="Annual, sick, maternity…"
                        className={cn(hrFieldClass, "text-sm")}
                      />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground sm:sr-only">
                        Days
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={line.defaultDays || ""}
                        placeholder="0"
                        className={cn(
                          hrFieldClass,
                          "text-center text-sm tabular-nums",
                        )}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                          updateLine(index, {
                            defaultDays:
                              raw === "" || raw === "." ? 0 : Number(raw) || 0,
                          });
                        }}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col items-center justify-end space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground lg:sr-only">
                        Paid
                      </Label>
                      <div className="flex h-9 w-full items-center justify-center sm:h-10">
                        <Switch
                          checked={line.paid}
                          onCheckedChange={(paid) =>
                            updateLine(index, { paid })
                          }
                          aria-label={line.paid ? "Paid leave" : "Unpaid leave"}
                        />
                      </div>
                    </div>

                    <div className="flex items-end sm:col-span-2 lg:col-span-1 lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLine(index)}
                        className="h-10 w-full shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto lg:h-9 lg:w-9 lg:px-0"
                        aria-label={`Remove leave type ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span className="lg:sr-only">Remove line</span>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addLine}
              className="border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add leave type
            </Button>
            <PendingButton
              type="button"
              pending={pending}
              disabled={!dirty || hasBlankLine}
              className={hrPrimaryBtnClass}
              onClick={save}
            >
              <Save className="h-4 w-4" />
              Save leave types
            </PendingButton>
            {dirty ? (
              <p className="text-xs text-muted-foreground">
                {hasBlankLine
                  ? "Fill in every leave type name before saving"
                  : "Changes stay local until you save"}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
