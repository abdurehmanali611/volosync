"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HrConfirmAction } from "@/components/hr/HrConfirmAction";
import {
  HrPanelShell,
  HrSectionCard,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { notifyApiFailure } from "@/lib/actions";
import {
  deleteAtsAccessOtpApi,
  fetchAtsAccessOtpsApi,
  upsertAtsAccessOtpApi,
  type AtsAccessOtp,
} from "@/lib/api/ats";
import { cn } from "@/lib/utils";

type AtsRole = "HR" | "Manager";

const ROLE_META: Record<
  AtsRole,
  {
    label: string;
    hint: string;
    Icon: typeof UserRound;
  }
> = {
  HR: {
    label: "HR",
    hint: "Screening, vacancies, and pipeline moves (not offer / hire).",
    Icon: UserRound,
  },
  Manager: {
    label: "Manager",
    hint: "Full Admin access including offer stage and hire → HR OTP (F40).",
    Icon: Shield,
  },
};

function formatUpdatedAt(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function HrAtsOtpPanel() {
  const [rows, setRows] = useState<AtsAccessOtp[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AtsRole>("HR");
  const [busy, setBusy] = useState(false);
  const [flashPreview, setFlashPreview] = useState<{
    role: AtsRole;
    otp: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAtsAccessOtpsApi());
    } catch (e) {
      notifyApiFailure(e, "Could not load ATS access codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("hotcol-hr-refresh", onRefresh);
    return () => window.removeEventListener("hotcol-hr-refresh", onRefresh);
  }, [load]);

  const byRole = useMemo(() => {
    const map: Partial<Record<AtsRole, AtsAccessOtp>> = {};
    for (const row of rows) {
      if (row.role === "HR" || row.role === "Manager") {
        map[row.role] = row;
      }
    }
    return map;
  }, [rows]);

  const selected = byRole[role];
  const configuredCount = (["HR", "Manager"] as const).filter(
    (r) => byRole[r]?.hasCode,
  ).length;

  /** Live Manager-visible code until first ATS Admin unlock (emp-style). */
  const livePreview =
    flashPreview?.role === role
      ? flashPreview.otp
      : selected?.awaitingFirstUnlock
        ? String(selected.otpPreview || "").trim()
        : "";

  const issue = async () => {
    setBusy(true);
    try {
      const row = await upsertAtsAccessOtpApi(role);
      const otp = String(row.otpPreview || "").trim();
      if (!otp) {
        toast.error("Code was saved but preview was empty — try again");
      } else {
        setFlashPreview({ role, otp });
        toast.success(
          selected?.hasCode
            ? `${role} ATS code reset — visible until first Admin unlock`
            : `${role} ATS code created — visible until first Admin unlock`,
        );
      }
      await load();
    } catch (e) {
      notifyApiFailure(e, "Could not save ATS access code");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAtsAccessOtpApi(role);
      if (flashPreview?.role === role) setFlashPreview(null);
      toast.success(`${role} ATS code deleted`);
      await load();
    } catch (e) {
      notifyApiFailure(e, "Could not delete ATS access code");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (otp: string) => {
    try {
      await navigator.clipboard.writeText(otp);
      toast.success("ATS code copied");
    } catch {
      toast.message(otp);
    }
  };

  return (
    <HrPanelShell>
      <HrSectionCard
        title="ATS access codes"
        description="Issue, reset, or delete VoloSync ATS Admin unlock codes. You can see the plaintext until that role unlocks ATS Admin once — then the preview clears (same as employee portal OTP). Staff must change the code on first unlock when required."
        icon={<Briefcase className="h-5 w-5" />}
        accent="bg-linear-to-r from-violet-500 via-violet-400 to-primary/80"
        actions={
          !loading ? (
            <Badge
              variant="outline"
              className={cn(
                "font-medium",
                configuredCount === 2
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : configuredCount === 1
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300"
                    : "border-border/70 bg-muted/30 text-muted-foreground",
              )}
            >
              {configuredCount}/2 roles configured
            </Badge>
          ) : null
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading ATS codes…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-2 rounded-2xl border border-violet-500/15 bg-violet-500/5 px-3 py-2.5 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Issue or reset",
                  body: "Manager creates a code; preview stays until first unlock.",
                },
                {
                  step: "2",
                  title: "Admin unlocks",
                  body: "First unlock clears your preview; they may need to change OTP.",
                },
                {
                  step: "3",
                  title: "Delete anytime",
                  body: "Remove a role code to revoke ATS Admin access for that role.",
                },
              ].map((s) => (
                <div key={s.step} className="flex gap-2.5 px-1 py-1.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-800 dark:text-violet-300">
                    {s.step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-tight">
                      {s.title}
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["HR", "Manager"] as const).map((r) => {
                const meta = ROLE_META[r];
                const row = byRole[r];
                const active = role === r;
                const ready = Boolean(row?.hasCode);
                const awaiting = Boolean(row?.awaitingFirstUnlock);
                const preview = awaiting
                  ? String(row?.otpPreview || "").trim()
                  : "";
                const updated = formatUpdatedAt(row?.updatedAt);
                const Icon = meta.Icon;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    onClick={() => setRole(r)}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all",
                      "ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40",
                      active
                        ? "border-violet-500/40 bg-linear-to-br from-violet-500/15 via-card to-violet-400/8 ring-violet-500/25"
                        : "border-border/70 bg-card/80 ring-black/3 hover:border-violet-500/25 hover:bg-violet-500/5 dark:ring-white/5",
                      busy && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                            active
                              ? "border-violet-500/30 bg-violet-500/15 text-violet-800 dark:text-violet-200"
                              : "border-border/70 bg-muted/40 text-muted-foreground",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold tracking-tight">
                              {meta.label}
                            </p>
                            {ready ? (
                              awaiting ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100">
                                  <KeyRound className="h-3 w-3" />
                                  Awaiting unlock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </span>
                              )
                            ) : (
                              <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Not set
                              </span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {meta.hint}
                          </p>
                          {preview ? (
                            <button
                              type="button"
                              title="Copy ATS code"
                              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-xs tracking-wider text-amber-950 hover:bg-amber-500/15 dark:text-amber-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyCode(preview);
                              }}
                            >
                              <KeyRound className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{preview}</span>
                              <Copy className="h-3 w-3 shrink-0 opacity-70" />
                            </button>
                          ) : ready ? (
                            <p className="text-[11px] text-muted-foreground">
                              Preview hidden after first Admin unlock
                              {updated ? ` · updated ${updated}` : ""}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              No unlock code issued yet for this role.
                            </p>
                          )}
                          {ready && row?.updatedBy ? (
                            <p className="text-[11px] text-muted-foreground/90">
                              By {row.updatedBy}
                              {updated ? ` · ${updated}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                          active
                            ? "border-violet-500 bg-violet-500 shadow-[0_0_0_3px] shadow-violet-500/25"
                            : "border-muted-foreground/35",
                        )}
                        aria-hidden
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-linear-to-br from-violet-500/10 via-card to-violet-400/8 p-4 shadow-sm ring-1 ring-violet-500/15 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-800/80 dark:text-violet-300/90">
                    Selected role
                  </p>
                  <p className="text-lg font-semibold tracking-tight">
                    {ROLE_META[role].label}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {selected?.hasCode
                        ? "· reset or delete"
                        : "· create first code"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reset issues a new code and makes it visible again until the
                    next Admin unlock. Delete removes the role code entirely.
                  </p>
                </div>
                <div
                  className={cn(
                    "grid w-full gap-2 sm:w-max sm:min-w-72",
                    selected?.hasCode ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
                  <Button
                    type="button"
                    size="lg"
                    className={cn(
                      hrPrimaryBtnClass,
                      "h-11 w-full cursor-pointer whitespace-nowrap px-4",
                    )}
                    disabled={busy}
                    onClick={() => void issue()}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : selected?.hasCode ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {selected?.hasCode ? "Reset OTP" : "Get OTP and Save"}
                  </Button>
                  {selected?.hasCode ? (
                    <HrConfirmAction
                      destructive
                      title={`Delete ${role} ATS code?`}
                      description="That role can no longer unlock VoloSync ATS Admin until you issue a new code."
                      confirmLabel="Delete code"
                      trigger={
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          className="h-11 w-full cursor-pointer whitespace-nowrap border-rose-500/35 px-4 text-rose-800 hover:bg-rose-500/10 dark:text-rose-300"
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      }
                      onConfirm={() => void remove()}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {livePreview ? (
              <div className="overflow-hidden rounded-xl border border-amber-500/35 bg-linear-to-br from-amber-500/20 via-amber-500/8 to-orange-500/15 p-5 shadow-sm ring-1 ring-amber-500/20">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {role} ATS unlock code
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Visible until first Admin unlock — then hidden (like
                      employee portal OTP).
                    </p>
                  </div>
                </div>
                <p className="rounded-lg border border-amber-500/25 bg-background/70 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-amber-950 dark:text-amber-100">
                  {livePreview}
                </p>
                <Button
                  className="mt-3 w-full cursor-pointer border-amber-500/30 hover:bg-amber-500/10 sm:w-auto"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyCode(livePreview)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy code
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </HrSectionCard>
    </HrPanelShell>
  );
}
