"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Bell,
  ClipboardCheck,
  ClipboardList,
  HandCoins,
  Loader2,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  api,
  hrApi,
  noticeApi,
  promoApi,
  salesApi,
  type HrPayrollPeriod,
  type NoticeAckRow,
  type Promotion,
  type Registration,
  type SessionUser,
  type Settlement,
  type StockOut,
} from "@/lib/api";
import { hrExt } from "@/lib/api/hr";
import { managerApi } from "@/lib/api/manager";
import { cn } from "@/lib/utils";

type Tone = "amber" | "rose" | "sky" | "emerald" | "violet" | "slate";

type Notice = {
  id: string;
  title: string;
  detail?: string;
  href: string;
  count?: number;
  unread?: boolean;
  /** Items the caller has not seen yet — drives the badge and the dot. */
  unreadCount?: number;
  tone: Tone;
  icon: LucideIcon;
  /** Persisted receipts (HR) only — everything else uses the read watermark. */
  markRead?: () => Promise<unknown>;
};

type Feed = { notices: Notice[] };

const TONES: Record<Tone, string> = {
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  violet: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  slate: "border-white/10 bg-white/[0.04] text-zinc-400",
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Queue notices are recomputed on every poll, so their read state is a per-user
 * watermark: unread while the queue has grown past what the caller acknowledged.
 * Approving documents can never un-read anything, and new items re-flag the notice.
 */
function withAcks(notices: Notice[], acks: Record<string, number>): Notice[] {
  return notices.map((notice) => {
    if (notice.markRead) {
      return { ...notice, unreadCount: notice.unread ? 1 : 0 };
    }
    const unreadCount = Math.max(0, (notice.count ?? 0) - (acks[notice.id] ?? 0));
    return { ...notice, unread: unreadCount > 0, unreadCount };
  });
}

const unreadTotal = (notices: Notice[]) =>
  notices.reduce((total, notice) => total + (notice.unreadCount ?? 0), 0);

async function loadFeed(user: SessionUser): Promise<Feed> {
  if (user.role === "HR") {
    const rows = await hrExt.notifications();
    const notices: Notice[] = rows.data.map((row) => ({
      id: `hr-notification-${row.id}`,
      title: row.title,
      detail: [row.employee_name, row.kind].filter(Boolean).join(" · "),
      href: "/hr?view=notifications",
      unread: !row.read_at,
      tone: row.read_at ? "slate" : "amber",
      icon: Bell,
      markRead: () => hrExt.markNotificationRead(row.id),
    }));
    return { notices };
  }

  if (user.role === "MANAGER") {
    const [registrations, stockouts, settlements, promotions, hr] =
      await Promise.all([
        api.registrations(true).catch(() => ({ data: [] as Registration[] })),
        api.stockouts(true).catch(() => ({ data: [] as StockOut[] })),
        salesApi.settlements(true).catch(() => ({ data: [] as Settlement[] })),
        promoApi.list({ queue: true }).catch(() => ({ data: [] as Promotion[] })),
        managerApi.hrQueue().catch(() => ({ data: { count: 0 } })),
      ]);
    const notices: Notice[] = [];
    if (registrations.data.length) {
      notices.push({
        id: "manager-registrations",
        title: `${plural(registrations.data.length, "registration")} awaiting approval`,
        detail: "Item registrations submitted for your decision.",
        href: "/manager?view=approvals",
        count: registrations.data.length,
        tone: "amber",
        icon: ClipboardCheck,
      });
    }
    if (stockouts.data.length) {
      notices.push({
        id: "manager-stockouts",
        title: `${plural(stockouts.data.length, "stock movement")} awaiting approval`,
        detail: "Stock leaving the store needs your sign-off.",
        href: "/manager?view=approvals",
        count: stockouts.data.length,
        tone: "sky",
        icon: PackageSearch,
      });
    }
    if (settlements.data.length) {
      notices.push({
        id: "manager-settlements",
        title: `${plural(settlements.data.length, "settlement")} awaiting approval`,
        detail: "Sales settlements handed over for review.",
        href: "/manager?view=approvals",
        count: settlements.data.length,
        tone: "rose",
        icon: HandCoins,
      });
    }
    if (promotions.data.length) {
      notices.push({
        id: "manager-promotions",
        title: `${plural(promotions.data.length, "promotion")} awaiting approval`,
        detail: "Price changes queued for your decision.",
        href: "/manager?view=promotions",
        count: promotions.data.length,
        tone: "emerald",
        icon: Sparkles,
      });
    }
    if (hr.data.count) {
      notices.push({
        id: "manager-hr",
        title: `${plural(hr.data.count, "HR item")} awaiting your decision`,
        detail: "Terminations, attendance, payroll and OTP resets.",
        href: "/manager?view=hr-approvals",
        count: hr.data.count,
        tone: "violet",
        icon: ShieldCheck,
      });
    }
    return { notices };
  }

  if (user.role === "FINANCE") {
    const [registrations, stockouts, settlements, payrollPeriods] =
      await Promise.all([
        api.registrations().catch(() => ({ data: [] as Registration[] })),
        api.stockouts().catch(() => ({ data: [] as StockOut[] })),
        salesApi.settlements().catch(() => ({ data: [] as Settlement[] })),
        hrApi.payrollPeriods().catch(() => ({ data: [] as HrPayrollPeriod[] })),
      ]);
    const pendingRegistrations = registrations.data.filter(
      (row) => row.status === "PENDING_FINANCE",
    ).length;
    const pendingStockouts = stockouts.data.filter(
      (row) => row.status === "PENDING_FINANCE",
    ).length;
    const pendingSettlements = settlements.data.filter(
      (row) => row.status === "PENDING_FINANCE",
    ).length;
    const pendingPayslips = payrollPeriods.data.reduce(
      (total, period) => total + (period.counts?.awaiting_finance ?? 0),
      0,
    );
    const notices: Notice[] = [];
    if (pendingRegistrations) {
      notices.push({
        id: "finance-registrations",
        title: `${plural(pendingRegistrations, "registration")} awaiting finance`,
        detail: "Supplier stock waiting to be checked and approved.",
        href: "/finance?view=requests",
        count: pendingRegistrations,
        tone: "amber",
        icon: ClipboardCheck,
      });
    }
    if (pendingStockouts) {
      notices.push({
        id: "finance-stockouts",
        title: `${plural(pendingStockouts, "stock movement")} awaiting finance`,
        detail: "Stock-out requests queued for review.",
        href: "/finance?view=requests",
        count: pendingStockouts,
        tone: "sky",
        icon: ClipboardList,
      });
    }
    if (pendingSettlements) {
      notices.push({
        id: "finance-settlements",
        title: `${plural(pendingSettlements, "settlement")} awaiting finance`,
        detail: "Agent settlements ready for approval.",
        href: "/finance?view=sales",
        count: pendingSettlements,
        tone: "rose",
        icon: HandCoins,
      });
    }
    if (pendingPayslips) {
      notices.push({
        id: "finance-payroll",
        title: `${plural(pendingPayslips, "payslip")} awaiting finance`,
        detail: "Payroll runs that need a payment decision.",
        href: "/finance?view=payroll",
        count: pendingPayslips,
        tone: "emerald",
        icon: Banknote,
      });
    }
    return { notices };
  }

  if (user.role === "STORE") {
    const [registrations, stockouts] = await Promise.all([
      api.registrations().catch(() => ({ data: [] as Registration[] })),
      api.stockouts().catch(() => ({ data: [] as StockOut[] })),
    ]);
    const awaitable = (status: string) =>
      status === "PENDING_FINANCE" || status === "PENDING_MANAGER";
    const pendingRegistrations = registrations.data.filter((row) =>
      awaitable(row.status),
    ).length;
    const pendingStockouts = stockouts.data.filter((row) =>
      awaitable(row.status),
    ).length;
    const notices: Notice[] = [];
    if (pendingRegistrations) {
      notices.push({
        id: "store-registrations",
        title: `${plural(pendingRegistrations, "registration")} awaiting approval`,
        detail: "Submitted intake still moving through finance or manager.",
        href: "/store?view=requests",
        count: pendingRegistrations,
        tone: "amber",
        icon: ClipboardCheck,
      });
    }
    if (pendingStockouts) {
      notices.push({
        id: "store-stockouts",
        title: `${plural(pendingStockouts, "stock movement")} awaiting approval`,
        detail: "Submitted movements still moving through finance or manager.",
        href: "/store?view=movements",
        count: pendingStockouts,
        tone: "sky",
        icon: PackageSearch,
      });
    }
    return { notices };
  }

  if (user.role === "SALES") {
    const [settlements, open] = await Promise.all([
      salesApi.settlements().catch(() => ({ data: [] as Settlement[] })),
      salesApi
        .openAssignments()
        .catch(() => ({ data: { items: [], assignments: [] } })),
    ]);
    const pendingSettlements = settlements.data.filter(
      (row) => row.status === "PENDING_FINANCE" || row.status === "PENDING_MANAGER",
    ).length;
    const openAssignments = open.data.assignments.length;
    const notices: Notice[] = [];
    if (pendingSettlements) {
      notices.push({
        id: "sales-settlements",
        title: `${plural(pendingSettlements, "settlement")} awaiting approval`,
        detail: "Your handovers are still being reviewed.",
        href: "/sales?view=history",
        count: pendingSettlements,
        tone: "amber",
        icon: HandCoins,
      });
    }
    if (openAssignments) {
      notices.push({
        id: "sales-open-assignments",
        title: `${plural(openAssignments, "assignment")} still open`,
        detail: "Stock in your hands that has not been settled yet.",
        href: "/sales?view=orders",
        count: openAssignments,
        tone: "sky",
        icon: PackageSearch,
      });
    }
    return { notices };
  }

  return { notices: [] };
}

export function NotificationsButton({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acking, setAcking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, ackResponse] = await Promise.all([
        loadFeed(user),
        user.role === "HR"
          ? Promise.resolve({ data: [] as NoticeAckRow[] })
          : noticeApi.acks().catch(() => ({ data: [] as NoticeAckRow[] })),
      ]);
      setNotices(withAcks(feed.notices, Object.fromEntries(
        ackResponse.data.map((row) => [row.key, row.count]),
      )));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  /**
   * One notice → read. HR notices carry a persisted receipt per row; the queue
   * notices only move this user's watermark, so the notice re-appears when the
   * queue grows again.
   */
  async function acknowledge(notice: Notice) {
    if (notice.markRead) {
      await notice.markRead();
      return;
    }
    await noticeApi.markRead([{ key: notice.id, count: notice.count ?? 0 }]);
  }

  async function openNotice(notice: Notice) {
    setOpen(false);
    try {
      await acknowledge(notice);
    } catch {
      // Navigation is still useful even if the read receipt fails.
    }
    router.push(notice.href);
    void load();
  }

  async function markOneRead(notice: Notice) {
    setAcking(true);
    try {
      await acknowledge(notice);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not mark this read.");
    } finally {
      setAcking(false);
    }
  }

  async function markAllRead() {
    const pending = notices.filter((notice) => notice.unread);
    if (!pending.length) return;
    setAcking(true);
    try {
      const receipts = pending.filter((notice) => notice.markRead);
      const watermarks = pending.filter((notice) => !notice.markRead);
      await Promise.all(
        receipts.map((notice) => notice.markRead!().catch(() => undefined)),
      );
      if (watermarks.length) {
        await noticeApi
          .markRead(
            watermarks.map((notice) => ({ key: notice.id, count: notice.count ?? 0 })),
          )
          .catch(() => undefined);
      }
      await load();
    } finally {
      setAcking(false);
    }
  }

  const hasUnread = notices.some((notice) => notice.unread);
  const badge = unreadTotal(notices);

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Notifications"
          aria-label="Notifications"
          className="relative size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
        >
          <Bell className="size-4" />
          {badge > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] leading-4 font-semibold text-white ring-2 ring-[#0b0b13]">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0b0b13] p-0 text-zinc-200 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Notifications
          </p>
          {hasUnread && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={acking}
              className="text-[11px] font-medium text-role-1 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0 bg-white/10" />
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {error ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs font-medium text-zinc-300">Could not load notifications</p>
              <p className="mt-1 text-[11px] text-zinc-500">{error}</p>
            </div>
          ) : loading && !notices.length ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-xs text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading notifications…
            </div>
          ) : notices.length ? (
            notices.map((notice) => {

              const Icon = notice.icon;
              return (
                <DropdownMenuItem
                  key={notice.id}
                  onSelect={() => void openNotice(notice)}
                  className="items-start gap-2.5 rounded-lg px-2 py-2.5 focus:bg-white/[0.06] focus:text-white"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border",
                      TONES[notice.tone],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-zinc-100">
                      {notice.title}
                    </span>
                    {notice.detail && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-zinc-500">
                        {notice.detail}
                      </span>
                    )}
                  </span>
                  {notice.unread && (
                    <button
                      type="button"
                      title="Mark this notification read"
                      onClick={(event) => {
                        event.stopPropagation();
                        void markOneRead(notice);
                      }}
                      onPointerUp={(event) => event.stopPropagation()}
                      disabled={acking}
                      className="mt-0.5 shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark read
                    </button>
                  )}

                </DropdownMenuItem>
              );
            })
          ) : (
            <div className="grid place-items-center px-4 py-10 text-center">
              <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-500">
                <Bell className="size-4" />
              </span>
              <p className="mt-3 text-xs font-medium text-zinc-300">You&apos;re all caught up</p>
              <p className="mt-1 text-[11px] text-zinc-500">New updates will appear here.</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
