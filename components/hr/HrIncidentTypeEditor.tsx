"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { notifyApiFailure } from "@/lib/actions";
import {
  fetchHrIncidentTypes,
  replaceHrIncidentTypesApi,
} from "@/lib/api/hrSource";
import {
  HR_ATTENDANCE_LINK_OPTIONS,
  incidentTypeSettingFromApi,
  slugIncidentTypeCode,
  type HrIncidentTypeSetting,
} from "@/lib/hrIncidentTypes";
import { hrFieldClass, hrPrimaryBtnClass } from "@/components/hr/hrChrome";

const LINE_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_88px_minmax(0,0.7fr)_minmax(0,1.2fr)_40px] lg:items-end lg:gap-x-2.5";

type IncidentTypeLine = {
  key: string;
  code: string;
  label: string;
  deduct: boolean;
  percentOfSalary: number;
  /** Raw input text so decimals like `2.` / `0.5` type correctly */
  percentText: string;
  attendanceLink: "" | "absent" | "late" | "half_day";
};

function emptyLine(key: string): IncidentTypeLine {
  return {
    key,
    code: "",
    label: "",
    deduct: false,
    percentOfSalary: 0,
    percentText: "",
    attendanceLink: "",
  };
}

function formatPercentText(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n);
}

function parsePercentInput(raw: string): { text: string; value: number } {
  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) {
    return { text: raw, value: NaN };
  }
  if (raw === "" || raw === ".") {
    return { text: raw, value: 0 };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return { text: raw, value: 0 };
  if (n > 100) return { text: "100", value: 100 };
  if (n < 0) return { text: "0", value: 0 };
  return { text: raw, value: n };
}

function linesFromSettings(types: HrIncidentTypeSetting[]): IncidentTypeLine[] {
  return types.map((type, index) => {
    const percentOfSalary = type.percentOfSalary || 0;
    return {
      key: `saved-${type.code}-${index}`,
      code: type.code,
      label: type.label,
      deduct: type.deduct,
      percentOfSalary,
      percentText: formatPercentText(percentOfSalary),
      attendanceLink: (type.attendanceLink ||
        "") as IncidentTypeLine["attendanceLink"],
    };
  });
}

function settingsFromLines(lines: IncidentTypeLine[]): HrIncidentTypeSetting[] {
  const seen = new Set<string>();
  const next: HrIncidentTypeSetting[] = [];
  for (const line of lines) {
    const label = line.label.trim();
    if (!label) continue;
    const code = line.code || slugIncidentTypeCode(label);
    if (!code) continue;
    let unique = code;
    let n = 2;
    while (seen.has(unique)) unique = `${code}_${n++}`;
    seen.add(unique);
    next.push({
      code: unique,
      label,
      deduct: Boolean(line.deduct),
      percentOfSalary: Math.max(
        0,
        Math.min(100, Number(line.percentOfSalary) || 0),
      ),
      attendanceLink: line.attendanceLink || "",
      active: true,
    });
  }
  return next;
}

export function HrIncidentTypeEditor() {
  const rowIdRef = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistGen = useRef(0);
  const linesRef = useRef<IncidentTypeLine[]>([]);
  const [lines, setLines] = useState<IncidentTypeLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const types = (await fetchHrIncidentTypes()).map(
          incidentTypeSettingFromApi,
        );
        if (cancelled) return;
        const next = linesFromSettings(types);
        rowIdRef.current = next.length;
        linesRef.current = next;
        setLines(next);
      } catch (e) {
        notifyApiFailure(e, "Could not load incident types");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const schedulePersist = (immediate = false) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    const gen = ++persistGen.current;
    const run = async () => {
      const snapshot = linesRef.current;
      try {
        const saved = await replaceHrIncidentTypesApi(
          settingsFromLines(snapshot),
        );
        if (gen !== persistGen.current) return;
        let savedIndex = 0;
        const codeByKey = new Map<string, string>();
        for (const line of snapshot) {
          if (!line.label.trim()) continue;
          const setting = saved[savedIndex++];
          if (setting?.code) codeByKey.set(line.key, setting.code);
        }
        setLines((current) => {
          const next = current.map((line) => {
            const code = codeByKey.get(line.key);
            return code != null && code !== line.code
              ? { ...line, code }
              : line;
          });
          linesRef.current = next;
          return next;
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("hotcol-hr-incident-types"));
        }
      } catch (e) {
        if (gen === persistGen.current) {
          notifyApiFailure(e, "Could not save incident types");
        }
      }
    };
    if (immediate) void run();
    else persistTimer.current = setTimeout(() => void run(), 500);
  };

  const commitLines = (
    updater: (current: IncidentTypeLine[]) => IncidentTypeLine[],
    immediate = false,
  ) => {
    setLines((current) => {
      const next = updater(current);
      linesRef.current = next;
      return next;
    });
    schedulePersist(immediate);
  };

  const addLine = () => {
    rowIdRef.current += 1;
    const key = `line-${rowIdRef.current}`;
    commitLines((current) => [...current, emptyLine(key)], true);
  };

  const updateLine = (index: number, patch: Partial<IncidentTypeLine>) => {
    commitLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (index: number) => {
    commitLines(
      (current) => current.filter((_, i) => i !== index),
      true,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/15 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading incident types…
      </div>
    );
  }

  return (
    <div>
      {!lines.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-600/80 dark:text-amber-400/80" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Start empty and add your own categories. Enter a percent of salary
            (not a fixed ETB amount). Link a type to attendance (e.g. Absent) so
            payroll applies that percent once per matching day. Days on approved
            leave are excluded from absence deductions.
          </p>
          <Button
            type="button"
            className={hrPrimaryBtnClass}
            onClick={addLine}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add first incident type
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-linear-to-r from-amber-500/10 via-orange-500/5 to-primary/5 px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold">Incident types</p>
              <Badge
                variant="secondary"
                className="h-5 border-amber-500/20 bg-amber-500/10 px-1.5 text-[10px] text-amber-900 dark:text-amber-200"
              >
                {lines.length}
              </Badge>
            </div>
          </div>

          <div
            className={cn(
              LINE_GRID,
              "mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid",
            )}
          >
            <span>Type name</span>
            <span className="text-center">Deduct</span>
            <span className="text-center">% of salary</span>
            <span>Attendance link</span>
            <span className="sr-only">Remove</span>
          </div>

          <ScrollArea className="h-[min(42vh,420px)]">
            <div className="space-y-3 pr-3 sm:pr-4">
              {lines.map((line, index) => (
                <article
                  key={line.key}
                  className="overflow-hidden rounded-2xl border border-amber-500/20 bg-card shadow-sm ring-1 ring-amber-500/10"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 bg-amber-500/5 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-800 dark:text-amber-300">
                        {index + 1}
                      </span>
                      {line.label.trim() ? (
                        <span className="truncate text-sm font-medium">
                          {line.label.trim()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          New incident type
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[11px] font-semibold"
                    >
                      {line.attendanceLink
                        ? `${line.percentOfSalary || 0}% × ${line.attendanceLink.replace("_", " ")} days`
                        : line.percentOfSalary > 0
                          ? line.deduct
                            ? `Deduct ${line.percentOfSalary}%`
                            : `Credit ${line.percentOfSalary}%`
                          : "No pay impact"}
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
                        placeholder="Type name (e.g. Absence)"
                        className={cn(hrFieldClass, "text-sm")}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col items-center justify-end space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground lg:sr-only">
                        Deduct
                      </Label>
                      <div className="flex h-9 w-full items-center justify-center sm:h-10">
                        <Switch
                          checked={line.deduct}
                          onCheckedChange={(deduct) =>
                            updateLine(index, { deduct })
                          }
                          aria-label={
                            line.deduct
                              ? "Salary deduction"
                              : "Salary increase"
                          }
                        />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground sm:sr-only">
                        % of salary
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={line.percentText}
                        placeholder="0"
                        className={cn(
                          hrFieldClass,
                          "text-center text-sm tabular-nums",
                        )}
                        onChange={(e) => {
                          const parsed = parsePercentInput(e.target.value);
                          if (Number.isNaN(parsed.value)) return;
                          updateLine(index, {
                            percentText: parsed.text,
                            percentOfSalary: parsed.value,
                          });
                        }}
                      />
                    </div>

                    <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
                      <Label className="text-xs font-medium text-muted-foreground lg:sr-only">
                        Attendance link
                      </Label>
                      <Select
                        value={line.attendanceLink || "none"}
                        onValueChange={(value) =>
                          commitLines((current) =>
                            current.map((line, i) => {
                              if (i !== index) return line;
                              return {
                                ...line,
                                attendanceLink:
                                  value === "none"
                                    ? ""
                                    : (value as IncidentTypeLine["attendanceLink"]),
                                deduct: value !== "none" ? true : line.deduct,
                              };
                            }),
                          )
                        }
                      >
                        <SelectTrigger
                          className={cn(hrFieldClass, "justify-between text-sm")}
                        >
                          <SelectValue placeholder="No attendance link" />
                        </SelectTrigger>
                        <SelectContent>
                          {HR_ATTENDANCE_LINK_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.id || "none"}
                              value={opt.id || "none"}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end sm:col-span-2 lg:col-span-1 lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLine(index)}
                        className="h-10 w-full shrink-0 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto lg:h-9 lg:w-9 lg:px-0"
                        aria-label={`Remove incident type ${index + 1}`}
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

          <Button
            type="button"
            variant="outline"
            onClick={addLine}
            className="mt-3 w-full border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add incident type
          </Button>
        </>
      )}
    </div>
  );
}
