"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, roleHome, saveSession } from "@/lib/api";
import { refreshTenantSubscription } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight,
  Boxes,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.login(username, password);
      saveSession(response.access, response.user);
      try {
        await refreshTenantSubscription();
      } catch {
        // The route guard retries this; keep the session usable if it fails.
      }
      toast.success(`Welcome back, ${response.user.name.split(" ")[0]}`);
      router.replace(roleHome(response.user.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setLoading(false);
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
      <div
        aria-hidden
        className="animate-aura pointer-events-none absolute -bottom-48 left-1/3 size-[28rem] rounded-full bg-emerald-400/15 blur-[130px]"
        style={{ animationDelay: "-7s" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[18%] bottom-[8%] size-64 rounded-full bg-rose-400/10 blur-[100px]"
      />
      <div aria-hidden className="login-grid pointer-events-none absolute inset-0" />

      <div className="relative z-10 grid min-h-svh lg:grid-cols-[1.06fr_0.94fr]">
        <aside className="relative hidden flex-col overflow-hidden border-r border-white/5 px-10 py-12 lg:flex xl:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute top-[18%] -left-40 size-[26rem] rounded-full bg-cyan-400/10 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-28 bottom-0 size-[24rem] rounded-full bg-violet-500/12 blur-[120px]"
          />
          <div className="auth-rise relative">
            <LoginBrand />
          </div>

          <div className="relative my-auto max-w-xl py-12">
            <span className="auth-rise auth-delay-1 flex w-fit items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-medium tracking-[0.18em] text-cyan-200 uppercase">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-300 opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-cyan-300" />
              </span>
              <Sparkles className="size-3" />
              Wholesale operations OS
            </span>
            <h1 className="auth-rise auth-delay-1 mt-5 font-heading text-[2.55rem] leading-[1.06] font-semibold tracking-tight text-balance text-white xl:text-[2.9rem]">
              Run the whole chain,{" "}
              <span className="block bg-gradient-to-r from-cyan-300 via-emerald-300 to-violet-300 bg-clip-text text-transparent">
                from voucher to shelf.
              </span>
            </h1>
            <p className="auth-rise auth-delay-2 mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
              Voucher-level inventory, a two-step approval chain and VAT-aware
              reporting — one calm, colourful workspace for Ethiopian
              wholesalers.
            </p>

            <div className="auth-rise auth-delay-2 relative mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_30px_70px_-50px_rgba(0,0,0,1)] ring-1 ring-white/[0.03]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent"
              />
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                  Approval chain
                </p>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                <ChainStep icon={Store} label="Store" caption="Registers" tone="sky" />
                <ChainArrow />
                <ChainStep icon={Wallet} label="Finance" caption="Verifies" tone="emerald" />
                <ChainArrow />
                <ChainStep icon={ShieldCheck} label="Manager" caption="Approves" tone="violet" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-3 text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3 text-emerald-400" /> VAT-aware
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3 text-cyan-400" /> Voucher-level
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3 text-violet-400" /> Role-scoped
                </span>
              </div>
            </div>
          </div>

          <div className="auth-rise auth-delay-3 relative flex items-center justify-between border-t border-white/5 pt-5 text-[10px] tracking-[0.18em] text-zinc-600 uppercase">
            <span>Secure staff portal</span>
            <span className="text-zinc-500">Tenant-scoped</span>
          </div>
        </aside>

        <section className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-cyan-400/10 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-0 size-80 rounded-full bg-violet-500/10 blur-[120px]"
          />

          <div className="relative w-full max-w-[27rem]">
            <div className="auth-rise mb-8 flex justify-center lg:hidden">
              <LoginBrand compact />
            </div>

            <div className="auth-card-shimmer auth-rise relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-gradient-to-b from-[#0d0d18]/95 via-[#0a0a13]/95 to-[#0a0a12]/95 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95),0_0_60px_-30px_rgba(34,211,238,0.35)] ring-1 ring-cyan-300/10 backdrop-blur-2xl">
              <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-r from-cyan-400/[0.10] via-transparent to-violet-400/[0.08] px-7 pt-7 pb-6 text-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl"
                />
                <p className="relative text-[10px] font-semibold tracking-[0.24em] text-cyan-300 uppercase">
                  Staff access
                </p>
                <h2 className="relative mt-2 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text font-heading text-[1.85rem] leading-tight font-semibold tracking-tight text-transparent">
                  Welcome back
                </h2>
                <p className="relative mt-2 text-pretty text-sm text-zinc-400">
                  Sign in with your staff credentials to open your
                  workspace.
                </p>
              </div>

              <div className="px-7 py-6">
                <form onSubmit={signIn} className="space-y-4" autoComplete="on">
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_24px_60px_-45px_rgba(0,0,0,1)] ring-1 ring-white/[0.03]">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent"
                    />
                    <Label
                      htmlFor="username"
                      className="text-[10px] font-semibold tracking-[0.18em] text-cyan-200/80 uppercase"
                    >
                      Username
                    </Label>
                    <div className="relative mt-2">
                      <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cyan-300/60" />
                      <Input
                        id="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="auth-field h-11 rounded-xl border-white/10 bg-[#07070d]/80 pl-10 text-white placeholder:text-zinc-600 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20"
                        autoComplete="username"
                        placeholder="e.g. store or sales-apex"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_24px_60px_-45px_rgba(0,0,0,1)] ring-1 ring-white/[0.03]">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent"
                    />
                    <Label
                      htmlFor="password"
                      className="text-[10px] font-semibold tracking-[0.18em] text-violet-200/80 uppercase"
                    >
                      Password
                    </Label>
                    <div className="relative mt-2">
                      <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-violet-300/60" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="auth-field h-11 rounded-xl border-white/10 bg-[#07070d]/80 pr-10 pl-10 text-white placeholder:text-zinc-600 focus-visible:border-violet-300/50 focus-visible:ring-violet-300/20"
                        autoComplete="current-password"
                        placeholder="Your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 transition hover:text-zinc-200"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                      Sales agents sign in with their tenant username and their own
                      password.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !username || !password}
                    className="auth-cta h-11 w-full gap-2 rounded-md border-0 text-sm font-medium tracking-wide"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Signing in…
                      </>
                    ) : (
                      <>
                        Sign in <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4 text-[10px] text-zinc-600">
                  <ShieldCheck className="size-3.5 text-emerald-400/80" />
                  Encrypted session · Tenant-scoped · Lockout protection
                </div>
              </div>

              <div className="relative border-t border-white/5 bg-white/[0.02] px-7 py-3.5 text-center text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-300">VoloSync</span> ·
                wholesale operations, one secure door
              </div>
            </div>

            <p className="auth-rise auth-delay-2 mt-5 text-center text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              Authorised staff only
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`auth-mark-glow grid place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-emerald-400 to-violet-500 text-[#07070d] ring-1 ring-white/30 ${
          compact ? "size-10" : "size-12"
        }`}
      >
        <Boxes className={compact ? "size-5" : "size-6"} />
      </span>
      <span className="leading-tight">
        <span
          className={`auth-brand-shine block font-heading font-bold tracking-tight ${
            compact ? "text-base" : "text-xl"
          }`}
        >
          VoloSync
        </span>
        <span className="block text-[9px] font-semibold tracking-[0.22em] text-cyan-300/80 uppercase">
          Wholesale operations
        </span>
      </span>
    </div>
  );
}

function ChainStep({
  icon: Icon,
  label,
  caption,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  caption: string;
  tone: "sky" | "emerald" | "violet";
}) {
  const styles = {
    sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    violet: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  }[tone];
  return (
    <div className={`rounded-xl border px-2 py-2 text-center ${styles}`}>
      <Icon className="mx-auto size-4" />
      <p className="mt-1 text-[11px] font-semibold text-white">{label}</p>
      <p className="text-[9px] text-zinc-500">{caption}</p>
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex items-center">
      <span className="h-px w-4 bg-gradient-to-r from-white/10 to-white/30" />
      <ArrowRight className="size-3 text-zinc-600" />
    </div>
  );
}
