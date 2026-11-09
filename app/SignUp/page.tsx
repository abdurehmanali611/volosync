"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  Check,
  CreditCard,
  ImageIcon,
  Loader2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadImageToCloudinary, isCloudinaryImageConfigured } from "@/lib/cloudinary";
import {
  APEX_PAYMENT_CHANNEL_META,
  APEX_PAYMENT_CHANNELS,
  APEX_SOLUTION_CBE_ACCOUNT,
  type ApexPaymentChannel,
} from "@/lib/apexPayment";
import { SignupPendingApprovalScreen } from "@/components/signup/SignupPendingApprovalScreen";
import { cn } from "@/lib/utils";

const RECEIPT_KEY = "volosync.signup.receipt";

type SignupReceipt = { businessName: string; username: string };

const STEPS = [
  { label: "Business", title: "Your business", fields: ["name", "tin", "username", "password"] },
  { label: "Modules", title: "Modules & pricing", fields: [] },
  { label: "Payment", title: "Setup payment", fields: ["channel", "reference"] },
] as const;

function readReceipt(): SignupReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RECEIPT_KEY);
    return raw ? (JSON.parse(raw) as SignupReceipt) : null;
  } catch {
    return null;
  }
}

const LOGIN_BLOBS = (
  <>
    <div
      aria-hidden
      className="animate-aura pointer-events-none absolute -top-48 -left-32 size-[34rem] rounded-full bg-cyan-400/20 blur-[130px]"
    />
    <div
      aria-hidden
      className="animate-float-slow pointer-events-none absolute top-1/4 -right-40 size-[32rem] rounded-full bg-violet-500/20 blur-[130px]"
    />
    <div
      aria-hidden
      className="animate-aura pointer-events-none absolute -bottom-48 left-1/3 size-[28rem] rounded-full bg-emerald-400/15 blur-[130px]"
      style={{ animationDelay: "-7s" }}
    />
  </>
);

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-scene relative min-h-svh overflow-hidden text-zinc-100">
      {LOGIN_BLOBS}
      <div
        aria-hidden
        className="login-grid pointer-events-none absolute inset-0"
      />
      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-10 sm:px-8">
        <div className="auth-card-shimmer auth-rise relative w-full max-w-2xl overflow-hidden rounded-[1.9rem] border border-white/10 bg-gradient-to-b from-[#0d0d18]/95 via-[#0a0a13]/95 to-[#0a0a12]/95 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95),0_0_60px_-30px_rgba(34,211,238,0.35)] ring-1 ring-cyan-300/10 backdrop-blur-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}

function SignupBrand() {
  return (
    <div className="flex items-center gap-3">
      <span className="auth-mark-glow grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-emerald-400 to-violet-500 text-[#07070d] ring-1 ring-white/30">
        <Boxes className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="auth-brand-shine block font-heading text-base font-bold tracking-tight">
          VoloSync
        </span>
        <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
          Wholesale operations
        </span>
      </span>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-3 gap-3">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.label} className="min-w-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all",
                  done && "bg-cyan-400/90 text-[#07070d]",
                  active &&
                    "scale-110 bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/50",
                  !done && !active && "bg-white/5 text-zinc-500",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  active ? "text-cyan-100" : "text-zinc-500",
                )}
              >
                {step.label}
              </span>
            </div>
            <div
              className={cn(
                "h-0.5 w-full rounded-full",
                done || active ? "bg-cyan-400/50" : "bg-white/10",
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
        {title}
        {hint ? (
          <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
            {hint}
          </span>
        ) : null}
      </p>
      {children}
    </section>
  );
}

const inputClass =
  "auth-field h-11 w-full rounded-xl border-white/10 bg-[#07070d]/80 text-white placeholder:text-zinc-600 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20";

const MODULE_SWITCHES = [
  {
    key: "module_inventory" as const,
    label: "Inventory",
    description: "Store terminal, stock, suppliers, receipts",
  },
  {
    key: "module_hr" as const,
    label: "HR Module",
    description: "Employees, leave, payroll, incidents",
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [receipt, setReceipt] = useState<SignupReceipt | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [tin, setTin] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [salesAgentId, setSalesAgentId] = useState<string>("");
  const [salesAgents, setSalesAgents] = useState<
    { id: number; name: string; phone: string; city: string }[]
  >([]);
  const [moduleInventory, setModuleInventory] = useState(true);
  const [moduleHr, setModuleHr] = useState(true);
  const [pricing, setPricing] = useState<{
    setupFeeETB: number;
    yearlyFeeETB: number;
  } | null>(null);
  const [channel, setChannel] = useState<ApexPaymentChannel>("TELEBIRR");
  const [reference, setReference] = useState("");

  useEffect(() => {
    const stored = readReceipt();
    if (stored) setReceipt(stored);
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .signupAgents()
      .then((r) => {
        if (alive) setSalesAgents(r.data);
      })
      .catch(() => {
        if (alive) setSalesAgents([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (receipt) return;
    let alive = true;
    api
      .signupPricing(moduleInventory, moduleHr)
      .then((r) => {
        if (alive) setPricing(r.data);
      })
      .catch(() => {
        if (alive) setPricing(null);
      });
    return () => {
      alive = false;
    };
  }, [moduleInventory, moduleHr, receipt]);

  const channelMeta = APEX_PAYMENT_CHANNEL_META[channel];
  const lastStep = STEPS.length - 1;

  const stepValid = useMemo(() => {
    if (step === 0)
      return (
        name.trim().length >= 2 &&
        tin.trim().length > 0 &&
        username.trim().length > 0 &&
        password.length >= 6
      );
    if (step === 1) return pricing != null && pricing.setupFeeETB > 0;
    return reference.trim().length >= 4;
  }, [step, name, tin, username, password, pricing, reference]);

  async function pickLogo(file: File) {
    if (!isCloudinaryImageConfigured()) {
      toast.error("Image upload is not configured yet. Contact Apex support.");
      return;
    }
    setLogoUploading(true);
    try {
      const url = await uploadImageToCloudinary(file, { folder: "volosync/signups" });
      setLogoUrl(url);
      toast.success("Logo uploaded — remember to save at the last step.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Logo upload failed.",
      );
    } finally {
      setLogoUploading(false);
    }
  }

  function goNext() {
    if (step === 0) {
      if (!stepValid) {
        toast.error("Fill the business name, TIN, username and a 6+ character password.");
        return;
      }
    }
    if (step === 1) {
      if (!pricing || pricing.setupFeeETB <= 0) {
        toast.error("Apex has not set a setup fee yet. Contact Apex support.");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, lastStep));
  }

  async function submit() {
    if (reference.trim().length < 4) {
      toast.error(channelMeta.hint);
      return;
    }
    setSubmitting(true);
    try {
      await api.signupSubmit({
        name: name.trim(),
        tin: tin.trim(),
        logo_url: logoUrl || undefined,
        username: username.trim(),
        password,
        sales_agent_id: salesAgentId ? Number(salesAgentId) : null,
        module_inventory: moduleInventory,
        module_hr: moduleHr,
        channel,
        transaction_ref: reference.trim(),
      });
      const stored = { businessName: name.trim(), username: username.trim() };
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(stored));
      setReceipt(stored);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!bootstrapped) {
    return (
      <div className="login-scene flex min-h-svh items-center justify-center text-zinc-100">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (receipt) {
    return (
      <SignupPendingApprovalScreen
        receipt={receipt}
        onApproved={() => {
          localStorage.removeItem(RECEIPT_KEY);
          router.replace("/");
        }}
        onForgot={() => {
          localStorage.removeItem(RECEIPT_KEY);
          setReceipt(null);
        }}
      />
    );
  }

  const copy = STEPS[step];

  return (
    <AuthCard>
      <div className="border-b border-white/5 bg-gradient-to-r from-cyan-400/[0.10] via-transparent to-violet-400/[0.08] px-7 pb-6 pt-7">
        <div className="flex items-center justify-between gap-3">
          <SignupBrand />
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </div>
        <div className="mt-6">
          <Stepper current={step} />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text font-heading text-2xl font-semibold tracking-tight text-transparent">
          {copy.title}
        </h1>
      </div>

      <div className="space-y-6 px-7 py-6">
        {step === 0 ? (
          <>
            <Section title="Business details">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    Business name
                  </Label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-300/60" />
                    <Input
                      id="su-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your registered business name"
                      className={cn(inputClass, "pl-10")}
                      autoComplete="organization"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-tin" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                    TIN number
                  </Label>
                  <Input
                    id="su-tin"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="Your business TIN"
                    className={cn(inputClass, "font-mono")}
                    autoComplete="off"
                  />
                </div>
              </div>
            </Section>

            <Section title="Logo" hint="optional — shown across VoloSync">
              <div className="flex items-center gap-4">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-6 text-zinc-500" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void pickLogo(file);
                    }}
                  />
                  <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:text-cyan-200">
                    {logoUploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {logoUrl ? "Replace logo" : "Upload logo"}
                  </span>
                </label>
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-zinc-500">
                  Square PNG or JPEG. You can also add the logo later — Apex can
                  set it for you.
                </p>
              </div>
            </Section>

            <Section title="Sales agent" hint="optional — the Apex seller assisting you">
              <Select value={salesAgentId} onValueChange={setSalesAgentId}>
                <SelectTrigger className={cn(inputClass, "w-full")}>
                  <SelectValue placeholder="Choose your sales agent (optional)" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0a0a13] text-zinc-100">
                  <SelectItem value="none">No sales agent</SelectItem>
                  {salesAgents.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name}
                      {agent.city ? ` · ${agent.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

            <Section title="Manager login" hint="you will sign in with this">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="su-username" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    Manager username
                  </Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-300/60" />
                    <Input
                      id="su-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      className={cn(inputClass, "pl-10")}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                    Manager password
                  </Label>
                  <Input
                    id="su-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6+ characters"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </Section>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Section title="Modules" hint="Credentials(Common) is always included">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {MODULE_SWITCHES.map(({ key, label, description }) => {
                  const checked = key === "module_inventory" ? moduleInventory : moduleHr;
                  const toggle = () =>
                    key === "module_inventory"
                      ? setModuleInventory((v) => !v)
                      : setModuleHr((v) => !v);
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={toggle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle();
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition",
                        checked
                          ? "border-cyan-400/40 bg-cyan-400/[0.07]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">{label}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p>
                      </div>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={toggle}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </Section>

            <div className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.06] p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
                  <CreditCard className="size-4" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  Your fees
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Setup fee
                  </p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-white">
                    {pricing ? `${pricing.setupFeeETB.toLocaleString()} ETB` : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-500">one-time · paid now</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Yearly fee
                  </p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-white">
                    {pricing ? `${pricing.yearlyFeeETB.toLocaleString()} ETB` : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-500">renews every 12 months</p>
                </div>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-500">
                Fees are set by Apex and verified on this page before you pay.
                After Apex approves your setup payment, your subscription runs
                for 12 months.
              </p>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Apex Solution — CBE account (all transfers)
              </p>
              <p className="mt-1 font-mono text-xl font-bold tracking-wide text-cyan-300">
                {APEX_SOLUTION_CBE_ACCOUNT}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-pretty text-zinc-500">
                Pay via CBE directly or send from Telebirr to this Commercial
                Bank of Ethiopia account, then enter your transaction reference
                below.
              </p>
            </div>

            <Section title="Payment channel">
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
                      htmlFor={`su-channel-${value}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition",
                        selected
                          ? "border-cyan-400/50 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20",
                      )}
                    >
                      <RadioGroupItem
                        value={value}
                        id={`su-channel-${value}`}
                        className="sr-only"
                      />
                      <CreditCard
                        className={cn(
                          "size-4",
                          selected ? "text-cyan-300" : "text-zinc-400",
                        )}
                      />
                      <span className="text-sm font-medium text-zinc-100">
                        {meta.label}
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </Section>

            <Section title={channelMeta.transactionFieldLabel}>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={channelMeta.transactionPlaceholder}
                autoComplete="off"
                maxLength={60}
                className={cn(inputClass, "font-mono tracking-wide")}
              />
              <p className="text-[12px] leading-relaxed text-pretty text-zinc-500">
                {channelMeta.hint}
              </p>
            </Section>

            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-[13px] leading-relaxed text-pretty text-zinc-300">
              Submitting does not activate the account — Apex verifies your
              payment first, usually within about 30 minutes. You will watch the
              status on the next screen.
            </p>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/5 bg-black/20 px-7 py-4">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            className="gap-2 rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < lastStep ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={!stepValid}
            className="role-gradient-bg h-10 gap-2 rounded-xl px-5 text-sm font-semibold text-white"
          >
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !stepValid}
            className="role-gradient-bg h-10 gap-2 rounded-xl px-5 text-sm font-semibold text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : (
              "Submit registration"
            )}
          </Button>
        )}
      </div>

      <div className="border-t border-white/5 bg-white/[0.02] px-7 py-3.5 text-center text-[11px] text-zinc-500">
        Already registered?{" "}
        <Link href="/" className="font-medium text-cyan-300 hover:text-cyan-200">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}