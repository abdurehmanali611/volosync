"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantSubscriptionState } from "@/hooks/useTenantSubscription";
import { isAdminOrManagerRole } from "@/lib/tenantAccess";
import { cn } from "@/lib/utils";

/**
 * Manager-only billing warning in the top bar, in the hotcol format: an amber
 * pulsing card while a trial or a paid year is still running out, a red shield
 * once it has ended. Clicking it opens the payment portal.
 */
export function SubscriptionAlertButton({ role }: { role: string }) {
  const router = useRouter();
  const { status, notifications, daysLeft } = useTenantSubscriptionState();

  if (!isAdminOrManagerRole(role)) return null;

  const notice = notifications[0];
  if (!notice) return null;

  const critical = notice.severity === "critical";
  const Icon = critical
    ? ShieldAlert
    : status === "trial_ending"
      ? CreditCard
      : AlertTriangle;
  const badge =
    typeof daysLeft === "number" && daysLeft >= 0
      ? daysLeft > 99
        ? "99+"
        : String(daysLeft)
      : "!";

  function openPortal() {
    // Early renewal is optional while access is still full, so this does NOT
    // set the payment-portal access mode. That flag is reserved for the forced
    // portal state, which the portal clears once Apex approves a payment.
    router.push("/PaymentVerification");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={openPortal}
      title={`${notice.title} — tap to submit your payment`}
      aria-label={`${notice.title}. Open the payment portal.`}
      className={cn(
        "relative size-9 shrink-0 rounded-lg border",
        critical
          ? "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
          : "animate-pulse border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300",
      )}
    >
      <Icon className="size-4" />
      <span
        className={cn(
          "absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full px-1 text-[9px] leading-4 font-bold text-white shadow-md tabular-nums",
          critical ? "bg-rose-500" : "bg-amber-500",
        )}
      >
        {badge}
      </span>
    </Button>
  );
}