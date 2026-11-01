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
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d17]/70 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.04] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#10101c]/80">
      <div
        className={cn(
          "pointer-events-none absolute -top-12 -right-10 size-32 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          style.wash,
        )}
      />
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", style.bar)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
            {label}
          </p>
          <p className="mt-1.5 font-heading text-[1.5rem] leading-none font-semibold tracking-tight text-white">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl border shadow-inner shadow-black/20",
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
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="role-hero mb-6 rounded-3xl px-5 py-5 sm:px-6 sm:py-6">
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="role-eyebrow flex items-center gap-2 text-[10px] font-semibold uppercase">
            <span className="role-gradient-bg size-1.5 rounded-full shadow-[0_0_12px_var(--role-1)]" />
            {eyebrow}
          </p>
          <h1 className="role-title mt-2 font-heading text-[1.7rem] font-semibold tracking-tight sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "role-panel-glow relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16]/75 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.03] backdrop-blur-xl transition-colors hover:border-white/15",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-white/[0.045] via-white/[0.015] to-transparent px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-white">
            <span className="size-1.5 rounded-full bg-role-1 shadow-[0_0_10px_var(--role-1)]" />
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
    <div className="relative overflow-hidden rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-10 text-center text-sm text-zinc-500">
      <div className="role-hairline pointer-events-none absolute inset-x-6 top-0 opacity-60" />
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
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td
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
