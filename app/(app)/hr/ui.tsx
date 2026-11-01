"use client";

// Small shared building blocks for the HR screens. They follow the module's
// visual language: zinc-950 cards, emerald/amber accents, uppercase micro
// labels and the kit.tsx Panel/StatusPill vocabulary.

import { useCallback, useState } from "react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HrDepartment, HrEmployee } from "@/lib/api";
import type { HrEmployeeFull, HrShiftTemplate } from "@/lib/api/hr";

export type SectionProps = {
  people: HrEmployeeFull[];
  departments: HrDepartment[];
  shifts: HrShiftTemplate[];
  reload: () => Promise<unknown>;
};

// Shared tone vocabulary for the Manager HR control screens. Each section gets
// its own accent so the control surface reads as a set of distinct tools
// instead of nine identical grey tables.
export type HrTone = "emerald" | "amber" | "violet" | "rose" | "sky" | "slate";

export const CHIP_TONES: Record<HrTone, string> = {
  emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  slate: "border-white/15 bg-white/5 text-zinc-300",
};

const AVATAR_TONES: Record<HrTone, string> = {
  emerald:
    "border-emerald-400/30 bg-gradient-to-br from-emerald-400/25 to-teal-400/5 text-emerald-200",
  amber:
    "border-amber-400/30 bg-gradient-to-br from-amber-400/25 to-orange-400/5 text-amber-200",
  violet:
    "border-violet-400/30 bg-gradient-to-br from-violet-400/25 to-fuchsia-400/5 text-violet-200",
  rose: "border-rose-400/30 bg-gradient-to-br from-rose-400/25 to-pink-400/5 text-rose-200",
  sky: "border-sky-400/30 bg-gradient-to-br from-sky-400/25 to-cyan-400/5 text-sky-200",
  slate: "border-white/10 bg-white/5 text-zinc-300",
};

const HERO_TONES: Record<
  HrTone,
  { wash: string; bar: string; icon: string; eyebrow: string; dot: string }
> = {
  emerald: {
    wash: "from-emerald-400/25",
    bar: "from-emerald-400 via-teal-300 to-cyan-300",
    icon: "border-emerald-400/30 bg-gradient-to-br from-emerald-400/25 to-teal-400/5 text-emerald-200",
    eyebrow: "text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]",
  },
  amber: {
    wash: "from-amber-400/25",
    bar: "from-amber-400 via-orange-300 to-rose-300",
    icon: "border-amber-400/30 bg-gradient-to-br from-amber-400/25 to-orange-400/5 text-amber-200",
    eyebrow: "text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
  },
  violet: {
    wash: "from-violet-400/25",
    bar: "from-violet-400 via-fuchsia-300 to-pink-300",
    icon: "border-violet-400/30 bg-gradient-to-br from-violet-400/25 to-fuchsia-400/5 text-violet-200",
    eyebrow: "text-violet-300",
    dot: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]",
  },
  rose: {
    wash: "from-rose-400/25",
    bar: "from-rose-400 via-pink-300 to-fuchsia-300",
    icon: "border-rose-400/30 bg-gradient-to-br from-rose-400/25 to-pink-400/5 text-rose-200",
    eyebrow: "text-rose-300",
    dot: "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)]",
  },
  sky: {
    wash: "from-sky-400/25",
    bar: "from-sky-400 via-cyan-300 to-emerald-300",
    icon: "border-sky-400/30 bg-gradient-to-br from-sky-400/25 to-cyan-400/5 text-sky-200",
    eyebrow: "text-sky-300",
    dot: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]",
  },
  slate: {
    wash: "from-zinc-400/20",
    bar: "from-zinc-400 to-zinc-300",
    icon: "border-white/10 bg-white/5 text-zinc-300",
    eyebrow: "text-zinc-400",
    dot: "bg-zinc-400",
  },
};

export function ControlHero({
  tone = "emerald",
  icon,
  eyebrow = "Manager · HR control",
  title,
  description,
  meta,
}: {
  tone?: HrTone;
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  meta?: React.ReactNode;
}) {
  const style = HERO_TONES[tone];
  return (
    <header className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16]/80 px-4 py-4 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.03] backdrop-blur-xl sm:px-5">
      <div
        className={cn(
          "pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-3xl",
          style.wash,
        )}
      />
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", style.bar)} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-xl border shadow-inner shadow-black/20",
              style.icon,
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] uppercase",
                style.eyebrow,
              )}
            >
              <span className={cn("size-1.5 rounded-full", style.dot)} />
              {eyebrow}
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">{description}</p>
          </div>
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </header>
  );
}

export function StatStrip({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function CodeChip({
  children,
  tone = "amber",
  className,
}: {
  children: React.ReactNode;
  tone?: HrTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Initials({
  name,
  tone = "emerald",
  className,
}: {
  name: string;
  tone?: HrTone;
  className?: string;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() ||
    "?";
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold",
        AVATAR_TONES[tone],
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center">
      <div className="role-hairline pointer-events-none absolute inset-x-8 top-0 opacity-60" />
      {icon ? (
        <span className="mx-auto grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500">
          {icon}
        </span>
      ) : null}
      <p className="mt-2 text-sm font-medium text-zinc-300">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3 py-2 text-xs leading-relaxed text-sky-100/90">
      <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
      <span>{children}</span>
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">{label}</Label>
      {children}
    </div>
  );
}

const CONTROL =
  "role-control h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 text-sm text-zinc-100 outline-none transition";

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Kept for call-site symmetry; an empty option is always rendered. */
  allowEmpty?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CONTROL, className)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex h-9 items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--role-1)]"
      />
      {label}
    </label>
  );
}

export function PersonPicker({
  value,
  onChange,
  rows,
  allowEmpty,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: HrEmployee[];
  allowEmpty?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={CONTROL}>
      <option value="">{allowEmpty ? "Nobody" : "Select employee"}</option>
      {rows.map((row) => (
        <option key={row.id} value={row.id}>
          {row.full_name} · {row.employee_no}
        </option>
      ))}
    </select>
  );
}

export function Verdict({
  tone,
  onClick,
  title,
}: {
  tone: "emerald" | "rose";
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg border p-1.5 transition ${
        tone === "emerald"
          ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10"
          : "border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
      }`}
    >
      {tone === "emerald" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
    </button>
  );
}

export function SubTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: [string, string][];
}) {
  return (
    <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === key
              ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : "border border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RowCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-white/20 hover:bg-white/[0.04]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IconButton({
  onClick,
  title,
  tone = "slate",
  children,
}: {
  onClick: () => void;
  title: string;
  tone?: "slate" | "sky" | "rose" | "emerald" | "amber";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "border-white/15 text-zinc-400 hover:bg-white/10 hover:text-white",
    sky: "border-sky-400/30 text-sky-300 hover:bg-sky-400/10",
    rose: "border-rose-400/30 text-rose-300 hover:bg-rose-400/10",
    emerald: "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10",
    amber: "border-amber-400/30 text-amber-300 hover:bg-amber-400/10",
  };
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn("rounded-lg border p-1.5 transition", tones[tone])}
    >
      {children}
    </button>
  );
}

// Shared busy/runner helper: mirrors the HR client's original run() pattern.
export function useRunner(reload: () => unknown) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (action: () => Promise<unknown>, message: string) => {
      setBusy(true);
      try {
        await action();
        toast.success(message);
        await reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  return { busy, run };
}

export const toneForStatus = (status: string) =>
  status === "PENDING" || status === "OPEN"
    ? "amber"
    : status === "APPROVED" || status === "RESOLVED" || status === "PAID" || status === "COMPLETED"
      ? "emerald"
      : status === "REJECTED" || status === "TERMINATED"
        ? "rose"
        : "slate";
