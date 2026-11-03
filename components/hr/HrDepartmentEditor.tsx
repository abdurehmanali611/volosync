"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notifyApiFailure } from "@/lib/actions";
import {
  fetchHrDepartments,
  replaceHrDepartmentsApi,
} from "@/lib/api/hrSource";
import {
  slugHrDepartmentCode,
  type HrDepartmentSetting,
} from "@/lib/hrDepartments";
import { hrFieldClass, hrPrimaryBtnClass } from "@/components/hr/hrChrome";

type Line = {
  key: string;
  code: string;
  label: string;
};

function emptyLine(key: string): Line {
  return { key, code: "", label: "" };
}

function linesFromSettings(rows: HrDepartmentSetting[]): Line[] {
  return rows.map((row, index) => ({
    key: `saved-${row.code}-${index}`,
    code: row.code,
    label: row.label,
  }));
}

function settingsFromLines(lines: Line[]): HrDepartmentSetting[] {
  const seen = new Set<string>();
  const next: HrDepartmentSetting[] = [];
  for (const line of lines) {
    const label = line.label.trim();
    if (!label) continue;
    const code = line.code || slugHrDepartmentCode(label);
    if (!code) continue;
    let unique = code;
    let n = 2;
    while (seen.has(unique)) unique = `${code}_${n++}`;
    seen.add(unique);
    next.push({ code: unique, label, active: true });
  }
  return next;
}

export function HrDepartmentEditor() {
  const rowIdRef = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistGen = useRef(0);
  const linesRef = useRef<Line[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchHrDepartments();
        if (cancelled) return;
        const next = linesFromSettings(rows);
        rowIdRef.current = next.length;
        linesRef.current = next;
        setLines(next);
      } catch (e) {
        notifyApiFailure(e, "Could not load departments");
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
        const saved = await replaceHrDepartmentsApi(
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
          window.dispatchEvent(new Event("hotcol-hr-departments"));
        }
      } catch (e) {
        if (gen === persistGen.current) {
          notifyApiFailure(e, "Could not save departments");
        }
      }
    };
    if (immediate) void run();
    else persistTimer.current = setTimeout(() => void run(), 500);
  };

  const commitLines = (
    updater: (current: Line[]) => Line[],
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
    commitLines(
      (current) => [...current, emptyLine(`line-${rowIdRef.current}`)],
      true,
    );
  };

  const updateLine = (index: number, patch: Partial<Line>) => {
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading departments…
      </div>
    );
  }

  return (
    <div>
      {!lines.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <Building2 className="h-8 w-8 text-violet-600/80 dark:text-violet-400/80" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Register departments used when scheduling shifts. The list starts
            empty — add only what this property needs.
          </p>
          <Button type="button" className={hrPrimaryBtnClass} onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            Add first department
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-linear-to-r from-violet-500/10 via-violet-400/5 to-primary/5 px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <p className="text-sm font-semibold">Departments</p>
              <Badge
                variant="secondary"
                className="h-5 border-violet-500/20 bg-violet-500/10 px-1.5 text-[10px] text-violet-900 dark:text-violet-200"
              >
                {lines.length}
              </Badge>
            </div>
          </div>

          <ScrollArea className="h-[min(36vh,360px)]">
            <div className="space-y-3 pr-3 sm:pr-4">
              {lines.map((line, index) => (
                <article
                  key={line.key}
                  className="overflow-hidden rounded-2xl border border-violet-500/20 bg-card shadow-sm ring-1 ring-violet-500/10"
                >
                  <div className="flex items-center gap-3 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-800 dark:text-violet-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Department name
                      </Label>
                      <Input
                        value={line.label}
                        onChange={(e) =>
                          updateLine(index, { label: e.target.value })
                        }
                        placeholder="Kitchen, Front desk…"
                        className={hrFieldClass}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLine(index)}
                      className="mt-5 h-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove department ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>

          <Button
            type="button"
            variant="outline"
            onClick={addLine}
            className="mt-3 w-full border-dashed border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add department
          </Button>
        </>
      )}
    </div>
  );
}
