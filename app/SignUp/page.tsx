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
  ChevronsUpDown,
  CreditCard,
  ImageIcon,
  Layers,
  Loader2,
  Lock,
  Search,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  { label: "Business", title: "Tell us about your business" },
  { label: "Modules", title: "Choose your modules" },
  { label: "Payment", title: "Setup payment" },
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
      <div aria-hidden className="login-grid pointer-events-none absolute inset-0" />
      <div className="relative z-10 flex min-h-svh items-center justify-center px-4 py-8 sm:px-8">
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

/** Colorful section header — a gradient icon tile + title + hint. */
function Section({
  icon: Icon,
  tone,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "cyan" | "violet" | "emerald" | "amber";
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const tones = {
    cyan: "from-cyan-400/25 to-cyan-400/5 text-cyan-300 ring-cyan-300/30",
    violet: "from-violet-400/25 to-violet-400/5 text-violet-300 ring-violet-300/30",
    emerald: "from-emerald-400/25 to-emerald-400/5 text-emerald-300 ring-emerald-300/30",
    amber: "from-amber-400/25 to-amber-400/5 text-amber-300 ring-amber-300/30",
  }[tone];
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1",
            tones,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-zinc-100">{title}</p>
          {hint ? (
            <p className="text-[11px] leading-tight text-zinc-500">{hint}</p>
          ) : null}
        </div>
      </div>
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
    description: "Store terminal, stock lists, suppliers, receipts",
    tone: "cyan" as const,
  },
  {
    key: "module_hr" as const,
    label: "HR Module",
    description: "Employees, leave, payroll, incidents",
    tone: "violet" as const,
  },
  {
    key: "sales_role_enabled" as const,
    label: "Sales Role",
    description: "Field sales team, agents and settlements — requires Inventory",
    tone: "emerald" as const,
  },
];

const MODULE_TONES = {
  cyan: "border-cyan-400/40 bg-cyan-400/[0.07]",
  violet: "border-violet-400/40 bg-violet-400/[0.07]",
  emerald: "border-emerald-400/40 bg-emerald-400/[0.07]",
} as const;

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
  const [salesAgentId, setSalesAgentId] = useState<number | null>(null);
  const [salesAgents, setSalesAgents] = useState<
    { id: number; name: string; phone: string; city: string }[]
  >([]);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [moduleInventory, setModuleInventory] = useState(true);
  const [moduleHr, setModuleHr] = useState(true);
  const [salesRole, setSalesRole] = useState(false);
  const [pricing, setPricing] = useState<{
    setupFeeETB: number;
    yearlyFeeETB: number;
  } | null>(null);
  const [pricingLoaded, setPricingLoaded] = useState(false);
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
    setPricingLoaded(false);
    api
      .signupPricing(moduleInventory, moduleHr, salesRole)
      .then((r) => {
        if (alive) {
          setPricing(r.data);
          setPricingLoaded(true);
        }
      })
      .catch(() => {
        if (alive) {
          setPricing(null);
          setPricingLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [moduleInventory, moduleHr, salesRole, receipt]);

  const channelMeta = APEX_PAYMENT_CHANNEL_META[channel];
  const lastStep = STEPS.length - 1;

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return salesAgents;
    return salesAgents.filter((a) =>
      `${a.name} ${a.city || ""} ${a.phone || ""}`.toLowerCase().includes(q),
    );
  }, [salesAgents, agentSearch]);
  const selectedAgent = salesAgents.find((a) => a.id === salesAgentId) || null;

  const stepValid = useMemo(() => {
    if (step === 0)
      return (
        name.trim().length >= 2 &&
        tin.trim().length > 0 &&
        username.trim().length > 0 &&
        password.length >= 6
      );
    if (step === 1) {
      // Only block when the catalog explicitly prices a zero/negative setup
      // fee; a failed pricing fetch never traps the user here.
      if (pricingLoaded && pricing && pricing.setupFeeETB <= 0) return false;
      return true;
    }
    return reference.trim().length >= 4;
  }, [step, name, tin, username, password, pricing, pricingLoaded, reference]);

  async function pickLogo(file: File) {
    if (!isCloudinaryImageConfigured()) {
      toast.error("Image upload is not configured yet. Contact Apex support.");
      return;
    }
    setLogoUploading(true);
    try {
      const url = await uploadImageToCloudinary(file, { folder: "volosync/signups" });
      setLogoUrl(url);
      toast.success("Logo uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  function toggleModule(key: "module_inventory" | "module_hr" | "sales_role_enabled") {
    if (key === "sales_role_enabled") {
      // Sales is an add-on to Inventory: switching it on pulls Inventory in.
      if (!salesRole) {
        setSalesRole(true);
        setModuleInventory(true);
      } else {
        setSalesRole(false);
      }
      return;
    }
    if (key === "module_inventory") {
      // Inventory cannot leave while the Sales Role depends on it.
      if (moduleInventory && salesRole) {
        toast.error("The Sales Role requires Inventory — switch Sales Role off first.");
        return;
      }
      setModuleInventory((v) => !v);
      return;
    }
    setModuleHr((v) => !v);
  }

  function goNext() {
    if (step === 0 && !stepValid) {
      toast.error(
        "Fill the business name, TIN, username and a 6+ character password.",
      );
      return;
    }
    if (step === 1 && pricingLoaded && pricing && pricing.setupFeeETB <= 0) {
      toast.error("Apex has not set a setup fee yet. Contact Apex support.");
      return;
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
        sales_agent_id: salesAgentId,
        module_inventory: moduleInventory,
        module_hr: moduleHr,
        sales_role_enabled: salesRole,
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
      <div className="border-b border-white/5 bg-gradient-to-r from-cyan-400/[0.10] via-transparent to-violet-400/[0.08] px-7 pb-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <SignupBrand />
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 transition hover:text-cyan-200"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>
        </div>
        <div className="mt-5">
          <Stepper current={step} />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text font-heading text-2xl font-semibold tracking-tight text-transparent">
          {copy.title}
        </h1>
      </div>

      <div className="max-h-[calc(100svh-16rem)] space-y-6 overflow-y-auto px-7 py-6">
        {step === 0 ? (
          <>
            <Section
              icon={Building2}
              tone="cyan"
              title="Business details"
              hint="Your registered business identity"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-name"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80"
                  >
                    Business name
                  </Label>
                  <div className="relative">
                    <Input
                      id="su-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your registered business name"
                      className={cn(inputClass, "pl-10")}
                      autoComplete="organization"
                    />
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-300/60" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-tin"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80"
                  >
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

            <Section
              icon={ImageIcon}
              tone="amber"
              title="Logo"
              hint="Optional — shown across VoloSync"
            >
              <div className="flex items-center gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-3.5">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
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
                  <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 text-sm text-amber-200 transition hover:bg-amber-400/20">
                    {logoUploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {logoUrl ? "Replace logo" : "Upload logo"}
                  </span>
                </label>
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-zinc-500">
                  Square PNG or JPEG. Apex can also set it for you later.
                </p>
              </div>
            </Section>

            <Section
              icon={Users}
              tone="emerald"
              title="Sales agent"
              hint="Optional — the Apex seller assisting you"
            >
              <Popover open={agentOpen} onOpenChange={setAgentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={agentOpen}
                    className={cn(
                      "h-11 w-full justify-between border-white/10 bg-[#07070d]/80 px-3 font-normal text-white hover:bg-[#07070d] hover:text-white",
                      !selectedAgent && "text-zinc-500",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Users className="size-4 shrink-0 text-emerald-300/70" />
                      <span className="truncate">
                        {selectedAgent
                          ? selectedAgent.name
                          : "Search and choose your sales agent"}
                      </span>
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-(--radix-popover-trigger-width) border-white/10 bg-[#0a0a13] p-0"
                >
                  <div className="border-b border-white/5 p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
                      <Input
                        value={agentSearch}
                        onChange={(e) => setAgentSearch(e.target.value)}
                        placeholder="Search agents…"
                        className="h-9 border-white/10 bg-white/[0.04] pl-8 text-sm text-white placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSalesAgentId(null);
                        setAgentOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/[0.06]",
                        salesAgentId === null ? "text-cyan-200" : "text-zinc-300",
                      )}
                    >
                      {salesAgentId === null ? (
                        <Check className="size-3.5 text-cyan-300" />
                      ) : (
                        <span className="size-3.5" />
                      )}
                      No sales agent
                    </button>
                    {filteredAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          setSalesAgentId(agent.id);
                          setAgentOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/[0.06]",
                          salesAgentId === agent.id
                            ? "text-cyan-200"
                            : "text-zinc-300",
                        )}
                      >
                        {salesAgentId === agent.id ? (
                          <Check className="size-3.5 shrink-0 text-cyan-300" />
                        ) : (
                          <span className="size-3.5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {agent.name}
                          {agent.city ? (
                            <span className="text-zinc-500"> · {agent.city}</span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                    {filteredAgents.length === 0 ? (
                      <p className="px-2.5 py-3 text-center text-xs text-zinc-500">
                        No sales agents match your search.
                      </p>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
            </Section>

            <Section
              icon={UserRound}
              tone="violet"
              title="Manager login"
              hint="You will sign in with this"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-username"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80"
                  >
                    Manager username
                  </Label>
                  <div className="relative">
                    <Input
                      id="su-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      className={cn(inputClass, "pl-10")}
                      autoComplete="username"
                    />
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-violet-300/60" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-password"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80"
                  >
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
            <Section
              icon={Layers}
              tone="cyan"
              title="Modules"
              hint="Pick what your business needs"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
                      <Lock className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">
                        Credentials(Common)
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Always included — logins and access control
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    Included
                  </span>
                </div>

                {MODULE_SWITCHES.map(({ key, label, description, tone }) => {
                  const checked =
                    key === "module_inventory"
                      ? moduleInventory
                      : key === "module_hr"
                        ? moduleHr
                        : salesRole;
                  const salesLocked =
                    key === "module_inventory" && salesRole;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleModule(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleModule(key);
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition",
                        checked
                          ? MODULE_TONES[tone]
                          : "border-white/10 bg-white/[0.02] hover:border-white/20",
                        salesLocked && "cursor-not-allowed opacity-90",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">{label}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {description}
                        </p>
                        {salesLocked ? (
                          <p className="mt-1 text-[11px] text-amber-300/90">
                            Required by the Sales Role — switch Sales Role off
                            first to remove it.
                          </p>
                        ) : null}
                      </div>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleModule(key)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section
              icon={CreditCard}
              tone="violet"
              title="Your fees"
              hint="Set by Apex — verified server-side"
            >
              <div className="rounded-2xl border border-violet-400/25 bg-violet-400/[0.06] p-4">
                {!pricingLoaded ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="size-4 animate-spin" /> Fetching catalog
                    pricing…
                  </div>
                ) : pricing ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Setup fee
                        </p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-white">
                          {pricing.setupFeeETB.toLocaleString()} ETB
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          one-time · paid now
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                          Yearly fee
                        </p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums text-white">
                          {pricing.yearlyFeeETB.toLocaleString()} ETB
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          renews every 12 months
                        </p>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-500">
                      After Apex approves your setup payment, your subscription
                      runs for 12 months.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-pretty text-zinc-400">
                    Catalog pricing is unavailable right now. You can continue —
                    Apex will price your registration during approval.
                  </p>
                )}
              </div>
            </Section>
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

            <Section
              icon={CreditCard}
              tone="cyan"
              title="Payment channel"
              hint="How you paid the setup fee"
            >
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

            <Section
              icon={CreditCard}
              tone="violet"
              title={channelMeta.transactionFieldLabel}
            >
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