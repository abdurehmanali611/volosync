"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  api,
  clearSession,
  getUser,
  roleHome,
  type SessionUser,
  type TenantBillingSnapshot,
} from "@/lib/api";
import { persistTenantSubscription } from "@/lib/tenantModules";
import { formatETB } from "@/lib/subscriptionModules";
import { isAdminOrManagerRole } from "@/lib/tenantAccess";
import {
  clearTenantAccessModeStorage,
  isPaymentPortalMode,
} from "@/lib/tenantAccessMode";
import {
  APEX_PAYMENT_CHANNEL_META,
  APEX_PAYMENT_CHANNELS,
  APEX_SOLUTION_CBE_ACCOUNT,
  type ApexPaymentChannel,
} from "@/lib/apexPayment";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS: Record<ApexPaymentChannel, typeof Smartphone> = {
  TELEBIRR: Smartphone,
  BANK: Building2,
};

/**
 * Where a manager lands when the free trial or the paid year has ended —
 * same blocked-payment layout as the hotcol payment portal: one centered card
 * with the Apex CBE account, the amount due and the transfer reference form.
 * Every other role is denied at login instead of being sent here.
 */
export default function PaymentVerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [snapshot, setSnapshot] = useState<TenantBillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ApexPaymentChannel>("TELEBIRR");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const response = await api.tenantSubscription();
    setSnapshot(response.data);
    persistTenantSubscription(response.data);
    return response.data;
  }, []);

  useEffect(() => {
    const session = getUser();
    if (!session) {
      router.replace("/");
      return;
    }
    if (!isAdminOrManagerRole(session.role)) {
      toast.error("Only the manager can submit a subscription payment.");
      router.replace(roleHome(session.role));
      return;
    }
    // Like hotcol, this page belongs to the payment-portal state only.
    if (!isPaymentPortalMode()) {
      router.replace("/");
      return;
    }
    setUser(session);
    const role = session.role;

    // Reaching this page with the forced-portal flag means access was blocked
    // at login or by the route guard. Apex may approve the payment while the
    // manager waits here, so release the flag as soon as the live snapshot
    // says access is full — on load, on tab focus, and by polling.
    const forcedPortal = isPaymentPortalMode();
    let cancelled = false;
    // Only a forced (blocked) entry waits for an approval. A voluntary early
    // renewal from the trial icon still has full access server-side, so it
    // must not be bounced out by the auto-unlock below.
    let enteredBlocked = false;
    let timer: number | null = null;

    function unlockIfApproved(sub: TenantBillingSnapshot): boolean {
      if (cancelled || !forcedPortal || !enteredBlocked) return false;
      if (sub.accessMode !== "full") return false;
      clearTenantAccessModeStorage();
      toast.success("Payment approved — your workspace is unlocked.");
      router.replace(roleHome(role));
      return true;
    }

    async function poll() {
      try {
        const response = await api.tenantSubscription();
        if (cancelled) return;
        persistTenantSubscription(response.data);
        unlockIfApproved(response.data);
      } catch {
        // Keep waiting; the poll retries on the next focus or interval tick.
      }
    }

    void (async () => {
      try {
        const sub = await load();
        if (cancelled) return;
        enteredBlocked = sub.accessMode !== "full";
        if (unlockIfApproved(sub)) return;
        if (enteredBlocked) {
          // While parked here waiting for Apex, check for approval
          // automatically.
          timer = window.setInterval(poll, 20_000);
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load your billing details. Refresh to retry.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", poll);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) window.clearInterval(timer);
    };
  }, [router, load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reference.trim().length < 4) {
      toast.error(
        `Enter the ${APEX_PAYMENT_CHANNEL_META[channel].transactionFieldLabel.toLowerCase()} from your receipt.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.submitSubscriptionPayment({
        channel,
        transaction_ref: reference.trim(),
      });
      toast.success(
        "Payment reference submitted. Apex will verify and activate your access.",
      );
      setReference("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  function signOut() {
    clearTenantAccessModeStorage();
    clearSession();
    router.replace("/");
  }

  if (loading || !user) {
    return (
      <div className="app-shell-bg flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const pending = snapshot?.pendingPayment ?? null;
  const status = snapshot?.periodStatus ?? "exempt";
  const ended = status === "expired" || status === "trial_expired";
  const restricted = status === "restricted";
  const annualFee = Number(snapshot?.annualFeeETB ?? 0);
  const setupFee = Number(snapshot?.setupFeeETB ?? 0);
  const meta = APEX_PAYMENT_CHANNEL_META[channel];

  // A free-trial payment and a yearly renewal are both the yearly fee today,
  // but the upfront copy must say which one is being paid — like hotcol's
  // setup vs yearly kind titles. Mirrors the backend's fee selection.
  const trialPayment =
    status === "trial" || status === "trial_ending" || status === "trial_expired";
  const title = trialPayment ? "Free trial payment" : "Yearly subscription payment";

  // The amount follows the payment kind: a free-trial payment uses the setup
  // fee when the console has set one; a yearly renewal always uses the yearly
  // fee — the two can never show each other's amount. Volosync's tenants
  // table has no setup fee column yet, so the trial case falls back to the
  // yearly fee it actually activates.
  const amountDue = trialPayment && setupFee > 0 ? setupFee : annualFee;

  const description = restricted
    ? "Apex has restricted this account. Contact Apex to restore access — a payment will not lift the restriction."
    : status === "trial" || status === "trial_ending"
      ? "Your free trial is running. Submit the payment below — Apex verifies it to keep access after the trial ends."
      : status === "trial_expired"
        ? "Your free trial has ended. Submit the payment below to restore access for every role."
        : ended
          ? "Your paid year has ended. Pay the yearly fee and submit your transfer reference."
          : "Pay the yearly fee and submit your transfer reference to keep access running.";

  return (
    <div className="app-shell-bg flex min-h-svh items-center justify-center p-4 text-zinc-100">
      <Card className="w-full max-w-lg border-white/10 bg-[#0a0a13]/95 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95)]">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="font-heading text-xl font-semibold text-white">
            Payment verification
          </CardTitle>
          <CardDescription className="text-pretty text-zinc-400">
            {user.tenant} — complete payment verification to unlock the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
              Apex Solution — CBE account (all transfers)
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-wide text-cyan-300">
              {APEX_SOLUTION_CBE_ACCOUNT}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-pretty text-zinc-500">
              Pay via CBE directly or send from Telebirr to this Commercial Bank
              of Ethiopia account, then enter your transaction reference below.
            </p>
          </div>

          <div className="space-y-1">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-pretty text-zinc-400">
              {description}
            </p>
            <p className="text-sm font-medium text-white">
              Amount due: {amountDue > 0 ? formatETB(amountDue) : "Contact Apex"}
            </p>
          </div>

          {pending ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              role="status"
            >
              Apex is verifying transaction {pending.transactionRef}. Every role
              stays blocked until Apex approves the payment — access unlocks
              automatically once it is approved.
            </div>
          ) : null}

          {amountDue <= 0 ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              role="status"
            >
              Apex has not set the fee for this wholesaler yet. Contact Apex to
              have it applied before paying.
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-5">
            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
                Payment channel
              </Label>
              <RadioGroup
                value={channel}
                onValueChange={(value) => {
                  setChannel(value as ApexPaymentChannel);
                  setReference("");
                }}
                className="grid gap-2.5 sm:grid-cols-2"
              >
                {APEX_PAYMENT_CHANNELS.map((value) => {
                  const channelMeta = APEX_PAYMENT_CHANNEL_META[value];
                  const Icon = CHANNEL_ICONS[value];
                  const selected = channel === value;
                  return (
                    <Label
                      key={value}
                      htmlFor={`channel-${value}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition",
                        selected
                          ? "border-cyan-400/50 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20",
                      )}
                    >
                      <RadioGroupItem
                        value={value}
                        id={`channel-${value}`}
                        className="sr-only"
                      />
                      <Icon
                        className={cn(
                          "size-4",
                          selected ? "text-cyan-300" : "text-zinc-400",
                        )}
                      />
                      <span className="text-sm font-medium text-zinc-100">
                        {channelMeta.label}
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="transaction-ref"
                className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase"
              >
                {meta.transactionFieldLabel}
              </Label>
              <Input
                id="transaction-ref"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={meta.transactionPlaceholder}
                autoComplete="off"
                maxLength={60}
                className="h-11 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm tracking-wide text-white placeholder:text-zinc-600"
              />
              <p className="text-[12px] leading-relaxed text-pretty text-zinc-500">
                {meta.hint}
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting || amountDue <= 0}
              className="role-gradient-bg h-11 w-full gap-2 text-[15px] font-semibold text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit for Apex verification"
              )}
            </Button>
          </form>

          {!ended && !restricted && !pending ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                // Voluntary early renewal: access was never blocked, so
                // leaving simply clears the portal flag.
                clearTenantAccessModeStorage();
                router.replace(roleHome(user.role));
              }}
              className="w-full text-zinc-400 hover:text-white"
            >
              Back to workspace
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={signOut}
            className="w-full border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}