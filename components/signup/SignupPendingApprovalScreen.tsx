"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  APEX_PAYMENT_CHANNEL_META,
  APEX_PAYMENT_CHANNELS,
  APEX_SOLUTION_CBE_ACCOUNT,
  type ApexPaymentChannel,
} from "@/lib/apexPayment";
import { cn } from "@/lib/utils";

const APEX_WHATSAPP = ["+251935000642", "+251930272975"];
const inputClass =
  "auth-field h-11 w-full rounded-xl border-white/10 bg-[#07070d]/80 text-white placeholder:text-zinc-600 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20";

type Status = "pending" | "approved" | "rejected";

/**
 * Shown right after a self-signup submits: polls the public registration
 * status, shows the CBE account + WhatsApp escalation, and lets a rejected
 * signup re-submit a new payment reference.
 */
export function SignupPendingApprovalScreen({
  receipt,
  onApproved,
  onForgot,
}: {
  receipt: { businessName: string; username: string };
  onApproved: () => void;
  onForgot: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ApexPaymentChannel>("TELEBIRR");
  const [reference, setReference] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await api.signupStatus(receipt.username);
      setStatus(response.data.status as Status);
      setNote(response.data.note || "");
      if (response.data.status === "approved") onApproved();
    } catch {
      // Keep polling — the screen is informative on its own.
    } finally {
      setLoading(false);
    }
  }, [receipt.username, onApproved]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function resubmit() {
    if (reference.trim().length < 4) {
      toast.error("Enter the transaction reference from your receipt.");
      return;
    }
    setResubmitting(true);
    try {
      await api.signupResubmit({
        username: receipt.username,
        channel,
        transaction_ref: reference.trim(),
      });
      toast.success("New payment reference submitted for verification.");
      setReference("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit.");
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <div className="login-scene relative min-h-svh overflow-hidden text-zinc-100">
      <div
        aria-hidden
        className="animate-aura pointer-events-none absolute -top-48 -left-32 size-[34rem] rounded-full bg-cyan-400/20 blur-[130px]"
      />
      <div
        aria-hidden
        className="animate-float-slow pointer-events-none absolute top-1/4 -right-40 size-[32rem] rounded-full bg-violet-500/20 blur-[130px]"
      />
      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-10 sm:px-8">
        <div className="auth-card-shimmer auth-rise relative w-full max-w-xl overflow-hidden rounded-[1.9rem] border border-white/10 bg-gradient-to-b from-[#0d0d18]/95 via-[#0a0a13]/95 to-[#0a0a12]/95 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95)] ring-1 ring-cyan-300/10 backdrop-blur-2xl">
          <div className="border-b border-white/5 bg-gradient-to-r from-cyan-400/[0.10] via-transparent to-violet-400/[0.08] px-7 pb-6 pt-7 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Registration
            </p>
            <h1 className="mt-2 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text font-heading text-2xl font-semibold tracking-tight text-transparent">
              {status === "rejected"
                ? "Payment needs a new reference"
                : status === "approved"
                  ? "Registration approved"
                  : "Waiting for Apex approval"}
            </h1>
            <p className="mt-2 text-sm text-pretty text-zinc-400">
              {receipt.businessName} · manager{" "}
              <span className="font-mono text-zinc-300">{receipt.username}</span>
            </p>
          </div>

          <div className="space-y-4 px-7 py-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-zinc-400">
                <Loader2 className="size-4 animate-spin" /> Checking registration
                status…
              </div>
            ) : status === "approved" ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                <p className="text-sm leading-relaxed text-pretty text-emerald-100">
                  Apex approved your registration — your account is active for
                  the next 12 months. Sign in with your manager credentials.
                </p>
              </div>
            ) : status === "rejected" ? (
              <div className="flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4">
                <XCircle className="mt-0.5 size-5 shrink-0 text-rose-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-rose-100">
                    Apex could not verify your payment
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-pretty text-rose-200/90">
                    {note ||
                      "The payment reference did not check out. Submit a new reference below."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                <Clock className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <p className="text-sm leading-relaxed text-pretty text-amber-100">
                  Apex is verifying your setup payment — usually within about 30
                  minutes. Every login stays blocked until the approval, and
                  this page updates by itself.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Apex Solution — CBE account (all transfers)
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-wide text-cyan-300">
                {APEX_SOLUTION_CBE_ACCOUNT}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-pretty text-zinc-500">
                Pay via CBE directly or send from Telebirr to this Commercial
                Bank of Ethiopia account.
              </p>
            </div>

            {status === "rejected" ? (
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-cyan-300" />
                  <p className="text-sm font-medium text-zinc-100">
                    Submit a new payment reference
                  </p>
                </div>
                <RadioGroup
                  value={channel}
                  onValueChange={(value) => {
                    setChannel(value as ApexPaymentChannel);
                    setReference("");
                  }}
                  className="grid gap-2.5 sm:grid-cols-3"
                >
                  {APEX_PAYMENT_CHANNELS.map((value) => {
                    const meta = APEX_PAYMENT_CHANNEL_META[value];
                    const selected = channel === value;
                    return (
                      <Label
                        key={value}
                        htmlFor={`re-channel-${value}`}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition",
                          selected
                            ? "border-cyan-400/50 bg-cyan-400/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20",
                        )}
                      >
                        <RadioGroupItem
                          value={value}
                          id={`re-channel-${value}`}
                          className="sr-only"
                        />
                        <span className="text-sm text-zinc-100">{meta.label}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="re-reference"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400"
                  >
                    {APEX_PAYMENT_CHANNEL_META[channel].transactionFieldLabel}
                  </Label>
                  <Input
                    id="re-reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={
                      APEX_PAYMENT_CHANNEL_META[channel].transactionPlaceholder
                    }
                    autoComplete="off"
                    maxLength={60}
                    className={cn(inputClass, "font-mono")}
                  />
                  <p className="text-[12px] leading-relaxed text-pretty text-zinc-500">
                    {APEX_PAYMENT_CHANNEL_META[channel].hint}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void resubmit()}
                  disabled={resubmitting}
                  className="role-gradient-bg h-10 w-full gap-2 rounded-xl text-sm font-semibold text-white"
                >
                  {resubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    "Submit for verification"
                  )}
                </Button>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm font-medium text-zinc-100">
                Need help or faster approval?
              </p>
              <p className="mt-1 text-[13px] text-pretty text-zinc-500">
                Message Apex support on WhatsApp with your business name and
                payment reference.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {APEX_WHATSAPP.map((number) => (
                  <a
                    key={number}
                    href={`https://wa.me/${number.replace("+", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:text-cyan-200"
                  >
                    <MessageCircle className="size-4" /> {number}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-7 py-3.5 text-[11px] text-zinc-500">
            <button
              type="button"
              onClick={onForgot}
              className="transition hover:text-zinc-300"
            >
              Register a different business
            </button>
            <Link href="/" className="font-medium text-cyan-300 hover:text-cyan-200">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}