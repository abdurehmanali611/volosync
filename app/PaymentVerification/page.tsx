"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  clearSession,
  getUser,
  roleHome,
  type SessionUser,
  type TenantBillingSnapshot,
} from "@/lib/api";
import { persistTenantSubscription } from "@/lib/tenantModules";
import { isAdminOrManagerRole } from "@/lib/tenantAccess";
import {
  clearTenantAccessModeStorage,
  isPaymentPortalMode,
  persistTenantAccessMode,
} from "@/lib/tenantAccessMode";
import {
  formatSubscriptionDateKey,
  pluralDays,
  SUBSCRIPTION_YEAR_DAYS,
} from "@/lib/subscriptionQuarter";
import { cn } from "@/lib/utils";

function money(amount: number): string {
  return `${amount.toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}

function addYears(raw: string | null, years: number): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  d.setDate(d.getDate() + SUBSCRIPTION_YEAR_DAYS * years);
  return formatSubscriptionDateKey(d.toISOString());
}

const CHANNELS = [
  { value: "TELEBIRR", label: "Telebirr", icon: Smartphone },
  { value: "BANK", label: "Bank transfer", icon: Landmark },
] as const;

/**
 * Where a manager lands when the free trial or the paid year has ended. Every
 * other role is denied at login instead of being sent here.
 */
export default function PaymentVerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [snapshot, setSnapshot] = useState<TenantBillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string>("TELEBIRR");
  const [reference, setReference] = useState("");
  const [years, setYears] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    setUser(session);

    // Reaching this page with the forced-portal flag means access was blocked
    // at login or by the route guard. Apex may have approved the payment while
    // the manager was away, so re-check the live snapshot and release the flag
    // instead of stranding them here until they sign out.
    const forcedPortal = isPaymentPortalMode();

    let cancelled = false;
    void (async () => {
      try {
        const sub = await load();
        if (!cancelled && forcedPortal && sub.accessMode === "full") {
          clearTenantAccessModeStorage();
          toast.success("Payment approved — your workspace is unlocked.");
          router.replace(roleHome(session.role));
          return;
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load your billing details. Refresh to retry.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  async function reload() {
    const wasPending = snapshot?.pendingPayment != null;
    setRefreshing(true);
    try {
      const sub = await load();
      if (wasPending && sub.accessMode === "full" && !sub.pendingPayment) {
        clearTenantAccessModeStorage();
        toast.success("Payment approved — your workspace is unlocked.");
        router.replace(roleHome(user?.role ?? "MANAGER"));
        return;
      }
      toast.success("Billing details refreshed.");
    } catch {
      toast.error("Could not refresh. Try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (reference.trim().length < 4) {
      toast.error("Enter the transaction reference from your receipt.");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitSubscriptionPayment({
        channel,
        transaction_ref: reference.trim(),
        years,
        note: note.trim(),
      });
      toast.success(
        "Payment reference submitted. Apex will verify and activate your access.",
      );
      setReference("");
      setNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  function signOut() {
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
  const annualFee = snapshot?.annualFeeETB ?? 0;
  const amountDue = annualFee * years;
  const periodEnd =
    snapshot?.subscriptionPaidUntil ?? snapshot?.freeTrialEndsAt ?? null;
  const daysLeft =
    snapshot?.subscriptionDaysLeft ?? snapshot?.trialDaysLeft ?? null;

  const headline = pending
    ? "Payment awaiting Apex verification"
    : status === "restricted"
      ? "This wholesaler account is restricted"
      : ended
        ? "Your subscription is ended"
        : status === "warning" || status === "trial_ending"
          ? "Renew before your access is blocked"
          : "Yearly subscription payment";

  return (
    <div className="app-shell-bg min-h-svh text-zinc-100">
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex items-center gap-3">
          <span className="role-gradient-bg grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-[0_18px_40px_-16px_var(--role-1)] ring-1 ring-white/20">
            <Wallet className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.28em] text-zinc-500 uppercase">
              Apex payment portal
            </p>
            <h1 className="truncate font-heading text-lg font-semibold tracking-tight text-white">
              {user.tenant}
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="ml-auto size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        <div
          role="alert"
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4",
            ended || status === "restricted"
              ? "border-rose-500/40 bg-rose-500/10"
              : "border-amber-500/40 bg-amber-500/10",
          )}
        >
          {pending ? (
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-400" />
          ) : ended || status === "restricted" ? (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-400" />
          ) : (
            <CreditCard className="mt-0.5 size-5 shrink-0 text-amber-400" />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "font-heading text-sm font-semibold",
                ended || status === "restricted"
                  ? "text-rose-200"
                  : "text-amber-200",
              )}
            >
              {headline}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
              {pending
                ? "Apex is checking your transaction reference. Every role stays blocked until the payment is approved — refresh to check again."
                : status === "restricted"
                  ? "Apex has restricted this account. Contact Apex to restore access; a payment will not lift the restriction."
                  : ended
                    ? "Staff logins are blocked until Apex approves your yearly payment. Submit the details below to unlock the workspace."
                    : daysLeft !== null && daysLeft >= 0
                      ? `${pluralDays(daysLeft)} left on your current period. Pay now so access never lapses.`
                      : "Pay your yearly fee and Apex will verify the transaction before it is applied."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile
            icon={Wallet}
            label="Yearly fee"
            value={annualFee > 0 ? money(annualFee) : "Not set"}
          />
          <SummaryTile
            icon={CalendarClock}
            label={snapshot?.subscriptionPaidUntil ? "Paid until" : "Trial ends"}
            value={formatSubscriptionDateKey(periodEnd)}
          />
          <SummaryTile
            icon={Building2}
            label="Amount due"
            value={amountDue > 0 ? money(amountDue) : "Contact Apex"}
            accent
          />
        </div>

        {pending ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <h2 className="font-heading text-sm font-semibold text-white">
                Submitted for verification
              </h2>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Transaction reference" value={pending.transactionRef} />
              <Detail label="Channel" value={pending.channel} />
              <Detail label="Amount" value={money(pending.amount)} />
              <Detail
                label="Covers until"
                value={formatSubscriptionDateKey(pending.coversUntil)}
              />
            </dl>
            <Button
              type="button"
              onClick={reload}
              disabled={refreshing}
              className="role-gradient-bg mt-5 w-full gap-2 text-white sm:w-auto"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Check verification status
            </Button>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
                Payment channel
              </Label>
              <RadioGroup
                value={channel}
                onValueChange={setChannel}
                className="grid gap-2.5 sm:grid-cols-2"
              >
                {CHANNELS.map(({ value, label, icon: Icon }) => (
                  <Label
                    key={value}
                    htmlFor={`channel-${value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition",
                      channel === value
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
                        channel === value ? "text-cyan-300" : "text-zinc-400",
                      )}
                    />
                    <span className="text-sm font-medium text-zinc-100">
                      {label}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2.5">
              <Label className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
                Years to cover
              </Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setYears(value)}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                      years === value
                        ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20",
                    )}
                  >
                    {value} year{value === 1 ? "" : "s"}
                    <span className="ml-2 text-[11px] text-zinc-400 tabular-nums">
                      {money(annualFee * value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="transaction-ref"
                className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase"
              >
                Transaction reference
              </Label>
              <Input
                id="transaction-ref"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="e.g. 8G42K19QZT"
                autoComplete="off"
                maxLength={60}
                className="h-11 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm tracking-wide text-white placeholder:text-zinc-600"
              />
              <p className="text-[12px] text-zinc-500">
                Copy the reference exactly as it appears on your Telebirr or bank
                receipt. Apex matches it against the transfer before approving.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="payment-note"
                className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase"
              >
                Note for Apex <span className="text-zinc-600">(optional)</span>
              </Label>
              <Textarea
                id="payment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={255}
                placeholder="Payer name, branch, or anything Apex should know."
                className="rounded-xl border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-zinc-600"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-[13px] text-zinc-300">
              <span className="text-zinc-500">If approved, this covers until </span>
              <span className="font-semibold text-white">
                {addYears(snapshot?.subscriptionPaidUntil ?? null, years)}
              </span>
            </div>

            <Button
              type="submit"
              disabled={submitting || annualFee <= 0}
              className="role-gradient-bg h-11 w-full gap-2 text-[15px] font-semibold text-white"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Submit for Apex verification
            </Button>
            {annualFee <= 0 && (
              <p className="text-center text-[12px] text-amber-300/90">
                Apex has not set a yearly fee for this wholesaler yet. Contact
                Apex to have it applied before paying.
              </p>
            )}
          </form>
        )}

        <div className="flex items-center justify-between gap-3 pb-4">
          <Button
            type="button"
            variant="ghost"
            onClick={reload}
            disabled={refreshing}
            className="gap-2 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
          {!ended && status !== "restricted" && !pending && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                persistTenantAccessMode("full");
                router.replace(roleHome(user.role));
              }}
              className="gap-2 text-zinc-400 hover:text-white"
            >
              Back to workspace
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent
          ? "border-cyan-400/30 bg-cyan-400/[0.07]"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 font-heading text-[17px] font-semibold tracking-tight tabular-nums",
          accent ? "text-cyan-200" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
      <dt className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-[13px] text-zinc-100">
        {value}
      </dd>
    </div>
  );
}