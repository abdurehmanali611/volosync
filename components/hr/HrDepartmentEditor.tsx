"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PendingButton } from "@/components/ui/pending-button";
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

function signature(lines: Line[]): string {
  return JSON.stringify(settingsFromLines(lines));
}

export function HrDepartmentEditor() {
  const rowIdRef = useRef(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [saved, setSaved] = useState("[]");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchHrDepartments();
        if (cancelled) return;
        const next = linesFromSettings(rows);
        rowIdRef.current = next.length;
        setLines(next);
        setSaved(signature(next));
      } catch (e) {
        notifyApiFailure(e, "Could not load departments");
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

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, i) => i !== index));
  };

  const save = async () => {
    setPending(true);
    try {
      const rows = await replaceHrDepartmentsApi(draft);
      const next = linesFromSettings(rows);
      rowIdRef.current = next.length;
      setLines(next);
      setSaved(signature(next));
      window.dispatchEvent(new Event("hotcol-hr-departments"));
      toast.success("Departments saved");
    } catch (e) {
      notifyApiFailure(e, "Could not save departments");
    } finally {
      setPending(false);
    }
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
            empty — add only what this property needs, then save.
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
              {dirty ? (
                <Badge className="h-5 border-amber-500/30 bg-amber-500/15 px-1.5 text-[10px] text-amber-900 dark:text-amber-200">
                  Unsaved
                </Badge>
              ) : null}
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addLine}
              className="border-dashed border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add department
            </Button>
            <PendingButton
              type="button"
              pending={pending}
              disabled={!dirty || hasBlankLine}
              className={hrPrimaryBtnClass}
              onClick={save}
            >
              <Save className="h-4 w-4" />
              Save departments
            </PendingButton>
            {dirty ? (
              <p className="text-xs text-muted-foreground">
                {hasBlankLine
                  ? "Fill in every department name before saving"
                  : "Changes stay local until you save"}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
