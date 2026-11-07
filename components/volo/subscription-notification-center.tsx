"use client";

import { AlertTriangle, CreditCard, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTenantSubscriptionState } from "@/hooks/useTenantSubscription";
import { APEX_SOLUTION_CBE_ACCOUNT } from "@/lib/apexPayment";
import { cn } from "@/lib/utils";

/**
 * Manager/owner billing alerts, in the hotcol format: a red shield with a count
 * badge in the top bar. Clicking it opens a popover listing every high-priority
 * subscription notice, with a critical (red) or warning (amber) card each.
 */
export function SubscriptionNotificationCenter({
  className,
}: {
  className?: string;
}) {
  const { notifications, summary, status } = useTenantSubscriptionState();

  if (notifications.length === 0) return null;

  const badgeCount = summary.critical + summary.warning;

  const footerNote =
    status === "trial_ending" || status === "trial_expired"
      ? "Submit the yearly payment to Apex. Once approved, your subscription activates and all staff can log in."
      : status === "pending_approval"
        ? "Apex is verifying your transaction reference. Access unlocks as soon as the payment is approved."
        : status === "warning" || status === "expired"
          ? "After Apex approves your yearly payment, access continues for the next 12 months from your renewal date."
          : status === "restricted"
            ? "Apex has restricted this account. Contact Apex to restore access; a payment will not lift the restriction."
            : status === "on_hold"
              ? "Apex has paused renewals for this account. Access stays open until the hold is released."
              : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "relative size-9 shrink-0 rounded-lg border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10",
            className,
          )}
          aria-label={`Subscription alerts, ${badgeCount} high priority`}
        >
          <ShieldAlert className="size-4 text-rose-400" />
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(26rem,calc(100vw-2rem))] gap-0 border-rose-500/30 p-0"
      >
        <div className="border-b border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            Subscription — high priority
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CBE account:{" "}
            <span className="font-mono font-semibold text-foreground">
              {APEX_SOLUTION_CBE_ACCOUNT}
            </span>
          </p>
        </div>

        <ul className="max-h-80 space-y-2 overflow-y-auto p-3">
          {notifications.map((notice) => (
            <li
              key={notice.id}
              className={cn(
                "space-y-1.5 rounded-lg border px-3 py-2.5",
                notice.severity === "critical"
                  ? "border-rose-500/40 bg-rose-500/5"
                  : "border-amber-500/30 bg-amber-500/10",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {notice.severity === "critical" ? (
                    <AlertTriangle className="size-4 shrink-0 text-rose-500" />
                  ) : (
                    <CreditCard className="size-4 shrink-0 text-amber-600" />
                  )}
                  <span className="text-sm leading-tight font-semibold">
                    {notice.title}
                  </span>
                </div>
                <Badge
                  variant={
                    notice.severity === "critical" ? "destructive" : "secondary"
                  }
                  className="shrink-0 text-[10px] uppercase"
                >
                  {notice.severity}
                </Badge>
              </div>
              <p className="pl-6 text-xs leading-relaxed text-pretty text-muted-foreground">
                {notice.message}
              </p>
            </li>
          ))}
        </ul>

        {footerNote ? (
          <div className="border-t border-rose-500/15 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {footerNote}
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Inline copy of the top notice for the manager dashboard, matching the
 * hotcol banner: red when the subscription has ended, amber while it runs out.
 */
export function SubscriptionAlertBanner() {
  const { notifications } = useTenantSubscriptionState();
  const top = notifications[0];
  if (!top) return null;

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 rounded-xl border px-4 py-3 text-sm shadow-sm",
        top.severity === "critical"
          ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-100",
      )}
    >
      <p className="font-semibold">{top.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-pretty opacity-90">
        {top.message}
      </p>
    </div>
  );
}
