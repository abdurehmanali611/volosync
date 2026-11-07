"use client";

import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTenantSubscriptionState } from "@/hooks/useTenantSubscription";
import { persistTenantAccessMode } from "@/lib/tenantAccessMode";
import { cn } from "@/lib/utils";

/**
 * Amber top-bar reminder used only while a free trial is running out — same
 * shape and behaviour as the hotcol `TrialBillingButton`: an amber pulsing
 * credit card with a days-left badge that opens the payment portal in portal
 * mode. The red shield (`SubscriptionNotificationCenter`) covers the rest.
 */
export function TrialBillingButton({ className }: { className?: string }) {
  const router = useRouter();
  const { status, daysLeft } = useTenantSubscriptionState();

  if (status !== "trial_ending") return null;

  const left = daysLeft ?? 0;

  function openPortal() {
    // Same redirection as hotcol: the trial reminder opens the payment portal
    // in portal mode. Early renewal is voluntary — the status still allows
    // full access, so the portal page shows its "Back to workspace" exit
    // instead of waiting on an approval.
    persistTenantAccessMode("payment_portal", "yearly");
    router.push("/PaymentVerification");
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "relative size-9 shrink-0 animate-pulse border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-300",
              className,
            )}
            aria-label={`Trial ends in ${left} days — submit yearly payment`}
            onClick={openPortal}
          >
            <CreditCard className="size-4 text-amber-500" />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-md">
              {left}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[16rem] text-center">
          <p className="font-semibold">
            Trial ends in {left} day{left === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap to submit the yearly payment before the trial expires
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}