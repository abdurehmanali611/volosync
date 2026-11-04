import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "violet" | "rose" | "sky" | "slate";

const TONES: Record<
  Tone,
  { pill: string; icon: string; wash: string; bar: string }
> = {
  emerald: {
    pill: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    icon: "border-emerald-400/30 bg-gradient-to-br from-emerald-400/25 to-teal-400/5 text-emerald-200",
    wash: "from-emerald-400/20",
    bar: "from-emerald-400 via-teal-300 to-cyan-300",
  },
  amber: {
    pill: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    icon: "border-amber-400/30 bg-gradient-to-br from-amber-400/25 to-orange-400/5 text-amber-200",
    wash: "from-amber-400/20",
    bar: "from-amber-400 via-orange-300 to-rose-300",
  },
  violet: {
    pill: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    icon: "border-violet-400/30 bg-gradient-to-br from-violet-400/25 to-fuchsia-400/5 text-violet-200",
    wash: "from-violet-400/20",
    bar: "from-violet-400 via-fuchsia-300 to-pink-300",
  },
  rose: {
    pill: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    icon: "border-rose-400/30 bg-gradient-to-br from-rose-400/25 to-pink-400/5 text-rose-200",
    wash: "from-rose-400/20",
    bar: "from-rose-400 via-pink-300 to-fuchsia-300",
  },
  sky: {
    pill: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    icon: "border-sky-400/30 bg-gradient-to-br from-sky-400/25 to-cyan-400/5 text-sky-200",
    wash: "from-sky-400/20",
    bar: "from-sky-400 via-cyan-300 to-emerald-300",
  },
  slate: {
    pill: "border-white/15 bg-white/5 text-zinc-300",
    icon: "border-white/10 bg-white/5 text-zinc-300",
    wash: "from-zinc-400/15",
    bar: "from-zinc-400 to-zinc-300",
  },
};

export function StatusPill({
  status,
  tone = "slate",
}: {
  status: string;
  tone?: string;
}) {
  const style = TONES[(tone as Tone) in TONES ? (tone as Tone) : "slate"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        style.pill,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-90 shadow-[0_0_8px_currentColor]" />
      {status.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "emerald",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  const style = TONES[tone] ?? TONES.emerald;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d17]/70 p-3.5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/4 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#10101c]/80">
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-linear-to-br to-transparent opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          style.wash,
        )}
      />
      <div className={cn("absolute inset-x-0 top-0 h-px bg-linear-to-r", style.bar)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
            {label}
          </p>
          <p className="mt-1.5 font-heading text-[1.35rem] leading-none font-semibold tracking-tight text-white">
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-xs text-zinc-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-xl border shadow-inner shadow-black/20",
              style.icon,
            )}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  stats,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  /** Up to two StatCards, rendered as tiles inside the hero band. */
  stats?: React.ReactNode;
}) {
  return (
    <header className="role-hero mb-5 rounded-3xl px-4 py-4 sm:px-5">
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="role-eyebrow flex items-center gap-2 text-[10px] font-semibold uppercase">
            <span className="role-gradient-bg size-1.5 rounded-full shadow-[0_0_12px_var(--role-1)]" />
            {eyebrow}
          </p>
          <h1 className="role-title mt-1.5 font-heading text-[1.45rem] leading-tight font-semibold tracking-tight sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{description}</p>
        </div>
        {stats || actions ? (
          <div className="flex shrink-0 flex-col items-stretch gap-3 lg:items-end">
            {stats ? (
              <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 lg:w-[30rem]">
                {stats}
              </div>
            ) : null}
            {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Per-card accents, so two panels side by side read as different subjects at a
 * glance instead of as one repeated block.
 */
const PANEL_TONES = {
  emerald: {
    dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]",
    rule: "from-emerald-400/85 via-teal-300/35",
    header: "from-emerald-400/9 via-teal-400/2.5 to-transparent",
  },
  sky: {
    dot: "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.75)]",
    rule: "from-sky-400/85 via-cyan-300/35",
    header: "from-sky-400/9 via-cyan-400/2.5 to-transparent",
  },
  violet: {
    dot: "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.75)]",
    rule: "from-violet-400/85 via-fuchsia-300/35",
    header: "from-violet-400/9 via-fuchsia-400/2.5 to-transparent",
  },
  amber: {
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.75)]",
    rule: "from-amber-400/85 via-orange-300/35",
    header: "from-amber-400/9 via-orange-400/2.5 to-transparent",
  },
  rose: {
    dot: "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.75)]",
    rule: "from-rose-400/85 via-pink-300/35",
    header: "from-rose-400/9 via-pink-400/2.5 to-transparent",
  },
  indigo: {
    dot: "bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.75)]",
    rule: "from-indigo-400/85 via-blue-300/35",
    header: "from-indigo-400/9 via-blue-400/2.5 to-transparent",
  },
} as const;

export type PanelTone = keyof typeof PANEL_TONES;

export function Panel({
  title,
  description,
  children,
  actions,
  className,
  tone,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  tone?: PanelTone;
}) {
  const accent = tone ? PANEL_TONES[tone] : null;
  return (
    <section
      className={cn(
        "role-panel-glow relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16]/75 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] ring-1 ring-white/3 backdrop-blur-xl transition-colors hover:border-white/15",
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r to-transparent",
            accent.rule,
          )}
        />
      ) : null}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-linear-to-r px-4 py-3",
          accent ? accent.header : "from-white/4.5 via-white/1.5 to-transparent",
        )}
      >
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-white">
            <span
              className={cn(
                "size-1.5 rounded-full",
                accent ? accent.dot : "bg-role-1 shadow-[0_0_10px_var(--role-1)]",
              )}
            />
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 pl-3.5 text-xs leading-relaxed text-zinc-500">{description}</p>
          )}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/1.5 px-4 py-10 text-center text-sm text-zinc-500">
      <div className="role-hairline pointer-events-none absolute inset-x-6 top-0 opacity-60" />
      {children}
    </div>
  );
}

/** Micro-capped field label used by every form control in the role portals. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">{label}</Label>
      {children}
    </div>
  );
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "border-b border-white/10 px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-white/5 px-3 py-2.5 text-sm text-zinc-300",
        right && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}
