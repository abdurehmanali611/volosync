"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarRange, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import { HrTimeField } from "@/components/hr/HrTimeField";
import { HrConfirmAction } from "@/components/hr/HrConfirmAction";
import {
  HrEmptyState,
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { hrDepartmentLabel } from "@/lib/hrDepartments";
import { notifyApiFailure } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  fetchHrDepartments,
  type HrDepartment,
} from "@/lib/api/hrSource";
import {
  deleteHrShiftTemplateApi,
  fetchHrShiftTemplates,
  upsertHrShiftTemplateApi,
  type HrShiftTemplate,
} from "@/lib/api/hrPhaseB";

const WEEKDAYS = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
] as const;

type TemplateDraft = {
  code: string;
  name: string;
  department: string;
  startTime: string;
  endTime: string;
  weekdays: number[];
};

const emptyDraft = (): TemplateDraft => ({
  code: "",
  name: "",
  department: "",
  startTime: "09:00",
  endTime: "17:00",
  weekdays: [1, 2, 3, 4, 5],
});

function parseWeekdays(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
  } catch {
    return [];
  }
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function sortWeekdays(ids: number[]) {
  return [...ids].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );
}

function isBlankDraft(d: TemplateDraft) {
  return (
    !d.code.trim() &&
    !d.name.trim() &&
    !d.department.trim() &&
    d.startTime === "09:00" &&
    d.endTime === "17:00" &&
    d.weekdays.length === 5 &&
    [1, 2, 3, 4, 5].every((x) => d.weekdays.includes(x))
  );
}

function validateDraft(d: TemplateDraft, label: string): string | null {
  if (!d.code.trim() || !d.name.trim()) {
    return `${label}: code and name are required`;
  }
  if (!d.weekdays.length) {
    return `${label}: select at least one weekday`;
  }
  if (!d.startTime || !d.endTime) {
    return `${label}: start and end time are required`;
  }
  return null;
}

function FieldLabel({
  children,
  required,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {children}
        {required ? (
          <span className="ml-1 text-primary/80 dark:text-primary/90">
            *
          </span>
        ) : null}
      </Label>
      {hint ? (
        <span className="text-[10px] font-medium text-muted-foreground/80">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const selected = useMemo(() => new Set(value), [value]);
  const count = value.length;
  const preset =
    count === 7
      ? "all"
      : count === 5 && [1, 2, 3, 4, 5].every((d) => selected.has(d))
        ? "weekdays"
        : count === 0
          ? "clear"
          : "custom";

  const toggle = (id: number) => {
    onChange(
      selected.has(id)
        ? value.filter((x) => x !== id)
        : sortWeekdays([...value, id]),
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <FieldLabel required hint={count ? `${count} selected` : "None"}>
            Active days
          </FieldLabel>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Tap days this shift repeats.
          </p>
        </div>
        <div
          role="group"
          aria-label="Day presets"
          className="inline-flex rounded-lg border border-border/70 bg-background p-0.5 shadow-sm"
        >
          {(
            [
              { id: "weekdays", label: "Mon–Fri", days: [1, 2, 3, 4, 5] },
              { id: "all", label: "All", days: [0, 1, 2, 3, 4, 5, 6] },
              { id: "clear", label: "Clear", days: [] as number[] },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange([...p.days])}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors",
                preset === p.id
                  ? "bg-primary/15 text-primary dark:text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => {
          const on = selected.has(d.id);
          const isWeekend = d.id === 0 || d.id === 6;
          return (
            <button
              key={d.id}
              type="button"
              title={d.full}
              aria-pressed={on}
              onClick={() => toggle(d.id)}
              className={cn(
                "relative flex h-11 flex-col items-center justify-center rounded-xl border text-[11px] font-semibold tracking-wide transition-all sm:h-12 sm:text-xs",
                on
                  ? "border-primary/45 bg-primary/[0.14] text-primary shadow-sm ring-1 ring-primary/15 dark:text-primary"
                  : cn(
                      "border-border/60 bg-background/90 text-muted-foreground hover:border-border hover:bg-muted/45 hover:text-foreground",
                      isWeekend && "bg-muted/25",
                    ),
              )}
            >
              {d.label}
              {on ? (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary dark:bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TemplateDraftFields({
  value,
  onChange,
  departmentOptions,
}: {
  value: TemplateDraft;
  onChange: (next: TemplateDraft) => void;
  departmentOptions: Array<{ value: string; label: string }>;
}) {
  const patch = (partial: Partial<TemplateDraft>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <FieldLabel required>Code</FieldLabel>
        <Input
          className={hrFieldClass}
          placeholder="e.g. FRONT_AM"
          value={value.code}
          onChange={(e) => patch({ code: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel required>Name</FieldLabel>
        <Input
          className={hrFieldClass}
          placeholder="e.g. Front desk morning"
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <FieldLabel hint="Optional">Department</FieldLabel>
        <HrOptionCombobox
          value={value.department || ""}
          onChange={(v) => patch({ department: v })}
          options={departmentOptions}
          placeholder="All departments"
          emptyText="No departments."
        />
      </div>
      <div className="space-y-2">
        <FieldLabel required>Start</FieldLabel>
        <HrTimeField
          value={value.startTime}
          onChange={(startTime) => patch({ startTime })}
          minuteStep={1}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel required>End</FieldLabel>
        <HrTimeField
          value={value.endTime}
          onChange={(endTime) => patch({ endTime })}
          minuteStep={1}
        />
      </div>
      <div className="sm:col-span-2">
        <WeekdayPicker
          value={value.weekdays}
          onChange={(weekdays) => patch({ weekdays })}
        />
      </div>
    </div>
  );
}

export function HrShiftTemplatesPanel({
  canManage,
}: {
  canManage: boolean;
}) {
  const [templates, setTemplates] = useState<HrShiftTemplate[]>([]);
  const [hrDepartments, setHrDepartments] = useState<HrDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateDraft>(emptyDraft);
  const [extraLines, setExtraLines] = useState<TemplateDraft[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await fetchHrShiftTemplates());
    } catch (e) {
      notifyApiFailure(e, "Could not load shift templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const loadDepts = async () => {
      try {
        const rows = await fetchHrDepartments();
        if (cancelled) return;
        setHrDepartments(rows.filter((d) => d.active));
      } catch (e) {
        notifyApiFailure(e, "Could not load departments");
      }
    };
    void loadDepts();
    const onChange = () => void loadDepts();
    window.addEventListener("hotcol-hr-departments", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hotcol-hr-departments", onChange);
    };
  }, []);

  const departmentOptions = useMemo(
    () => [
      { value: "", label: "All departments" },
      ...hrDepartments.map((d) => ({ value: d.code, label: d.label })),
    ],
    [hrDepartments],
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyDraft());
    setExtraLines([]);
  };

  const startEdit = (t: HrShiftTemplate) => {
    setEditingId(t.id);
    setExtraLines([]);
    setForm({
      code: t.code || "",
      name: t.name || "",
      department: t.department || "",
      startTime: t.startTime || "09:00",
      endTime: t.endTime || "17:00",
      weekdays: parseWeekdays(t.weekdayJson),
    });
  };

  const save = async () => {
    if (!canManage) return;

    const drafts: Array<{ id?: number; draft: TemplateDraft; label: string }> =
      [{ id: editingId ?? undefined, draft: form, label: editingId ? "Template" : "Template 1" }];

    if (!editingId) {
      for (let i = 0; i < extraLines.length; i++) {
        const d = extraLines[i];
        if (isBlankDraft(d)) continue;
        drafts.push({ draft: d, label: `Template ${i + 2}` });
      }
    }

    for (const row of drafts) {
      const err = validateDraft(row.draft, row.label);
      if (err) {
        toast.error(err);
        return;
      }
    }

    const codes = drafts.map((d) => d.draft.code.trim().toLowerCase());
    if (new Set(codes).size !== codes.length) {
      toast.error("Template codes must be unique in this batch");
      return;
    }

    setPending(true);
    try {
      for (const row of drafts) {
        await upsertHrShiftTemplateApi({
          id: row.id,
          code: row.draft.code.trim(),
          name: row.draft.name.trim(),
          department: row.draft.department.trim(),
          startTime: row.draft.startTime,
          endTime: row.draft.endTime,
          weekdayJson: JSON.stringify(row.draft.weekdays),
          active: true,
        });
      }
      toast.success(
        editingId
          ? "Template updated"
          : drafts.length > 1
            ? `Created ${drafts.length} templates`
            : "Template saved",
      );
      resetForm();
      await load();
    } catch (e) {
      notifyApiFailure(
        e,
        editingId ? "Could not update template" : "Could not save template(s)",
      );
    } finally {
      setPending(false);
    }
  };

  const saveLabel = editingId
    ? "Save changes"
    : extraLines.length
      ? `Save ${1 + extraLines.length} templates`
      : "Save template";

  return (
    <HrPanelShell>
      <HrSectionCard
        title="Shift templates"
        description="Reusable weekday patterns for HR to apply in Attendance. Save templates here, then apply them on the roster."
        icon={<CalendarRange className="h-5 w-5" />}
      >
        <div className="space-y-6">
          <div
            className={cn(
              "grid items-stretch gap-4",
              canManage ? "lg:grid-cols-2" : "grid-cols-1",
            )}
          >
            {canManage ? (
              <HrFormSection
                className="h-full"
                title={editingId ? "Edit template" : "New template"}
                description={
                  editingId
                    ? "Update this pattern, then save changes."
                    : "Add one or more patterns. Use Add line for batch create."
                }
              >
                <div className="space-y-4">
                  {editingId ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/6 px-3 py-2">
                      <p className="text-xs font-medium text-primary dark:text-primary">
                        Editing existing template
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={resetForm}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  ) : null}

                  <TemplateDraftFields
                    value={form}
                    onChange={setForm}
                    departmentOptions={departmentOptions}
                  />

                  {!editingId
                    ? extraLines.map((row, index) => (
                        <div
                          key={index}
                          className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/10 p-3 sm:p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Extra template {index + 1}
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExtraLines((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <TemplateDraftFields
                            value={row}
                            onChange={(next) =>
                              setExtraLines((prev) =>
                                prev.map((r, i) => (i === index ? next : r)),
                              )
                            }
                            departmentOptions={departmentOptions}
                          />
                        </div>
                      ))
                    : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!editingId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 font-medium"
                        onClick={() =>
                          setExtraLines((prev) => [...prev, emptyDraft()])
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Add line
                      </Button>
                    ) : null}
                    <PendingButton
                      pending={pending}
                      className={cn(hrPrimaryBtnClass, "flex-1")}
                      onClick={() => void save()}
                    >
                      {editingId ? null : <Plus className="h-4 w-4" />}
                      {saveLabel}
                    </PendingButton>
                  </div>
                </div>
              </HrFormSection>
            ) : null}

            <HrFormSection
              className="h-full"
              title="Saved templates"
              description="Patterns ready to apply to employee schedules."
            >
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : templates.length === 0 ? (
                <HrEmptyState
                  title="No templates yet"
                  description={
                    canManage
                      ? "Fill the form on the left and save your first pattern."
                      : "Ask a manager to create the first shift template."
                  }
                />
              ) : (
                <div className="max-h-[min(32rem,70vh)] space-y-2 overflow-y-auto pr-1">
                  {templates.map((t) => {
                    const days = parseWeekdays(t.weekdayJson);
                    const isEditing = editingId === t.id;
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-xl border bg-background/80 px-3 py-3 transition-colors",
                          isEditing
                            ? "border-primary/40 ring-1 ring-primary/20"
                            : "border-border/70 hover:border-primary/25 hover:bg-primary/3",
                        )}
                      >
                        <div className="min-w-0 space-y-2">
                          <div>
                            <p className="truncate font-medium tracking-tight">
                              {t.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/70">
                                {t.code}
                              </span>
                              {" · "}
                              {t.startTime}–{t.endTime}
                              {" · "}
                              {t.department
                                ? hrDepartmentLabel(
                                    t.department,
                                    hrDepartments,
                                  )
                                : "All departments"}
                            </p>
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {WEEKDAYS.map((d) => {
                              const on = days.includes(d.id);
                              return (
                                <span
                                  key={d.id}
                                  title={d.full}
                                  className={cn(
                                    "inline-flex h-6 items-center justify-center rounded-md border text-[9px] font-semibold tracking-wide",
                                    on
                                      ? "border-primary/35 bg-primary/12 text-primary dark:text-primary"
                                      : "border-border/40 bg-muted/30 text-muted-foreground/40",
                                  )}
                                >
                                  {d.label.charAt(0)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={isEditing ? "default" : "outline"}
                              className="shrink-0"
                              onClick={() =>
                                isEditing ? resetForm() : startEdit(t)
                              }
                            >
                              {isEditing ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <Pencil className="h-4 w-4" />
                              )}
                            </Button>
                            <HrConfirmAction
                              destructive
                              title="Delete template?"
                              description="Existing shifts already created from this template are kept."
                              confirmLabel="Delete"
                              trigger={
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              }
                              onConfirm={async () => {
                                await deleteHrShiftTemplateApi(t.id);
                                if (editingId === t.id) resetForm();
                                toast.success("Deleted");
                                await load();
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </HrFormSection>
          </div>
        </div>
      </HrSectionCard>
    </HrPanelShell>
  );
}
