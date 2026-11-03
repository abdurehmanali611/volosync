"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HrPanelShell,
  HrSectionCard,
  HrEmptyState,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { notifyApiFailure } from "@/lib/actions";
import {
  decideHrOtpResetApi,
  fetchHrOtpResetRequestsApi,
  type HrOtpResetRequest,
} from "@/lib/api/hrSource";
import { cn } from "@/lib/utils";

function formatRequestedAt(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function HrOtpResetApprovalPanel() {
  const [rows, setRows] = useState<HrOtpResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{ name: string; otp: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchHrOtpResetRequestsApi("pending");
      setRows(list);
    } catch (e) {
      notifyApiFailure(e, "Could not load OTP reset requests");
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

  const decide = async (row: HrOtpResetRequest, approve: boolean) => {
    setBusyId(row.id);
    try {
      if (!approve) {
        await decideHrOtpResetApi(row.id, false);
        toast.message("OTP reset rejected");
        setRevealed(null);
        await load();
        return;
      }
      const decided = await decideHrOtpResetApi(row.id, true);
      const otp =
        String(decided.portalOtpPreview || "").trim() ||
        String(decided.employee?.portalOtpPreview || "").trim();
      if (otp) {
        setRevealed({
          name: decided.employee?.fullName || row.employee?.fullName || "Employee",
          otp,
        });
      } else {
        toast.success("OTP reset approved");
      }
      await load();
    } catch (e) {
      notifyApiFailure(e, approve ? "Approve failed" : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <HrPanelShell>
      <HrSectionCard
        title="OTP reset approvals"
        description="HR Manager requests a reset; you approve to generate a new portal code. The code stays Manager-only until the employee’s first login."
        icon={<KeyRound className="h-5 w-5" />}
        accent="bg-linear-to-r from-amber-500 to-orange-400"
      >
        {!loading && rows.length > 0 ? (
          <p className="mb-4 text-xs text-muted-foreground">
            {rows.length} pending request{rows.length === 1 ? "" : "s"}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading OTP resets…
          </div>
        ) : rows.length === 0 ? (
          <HrEmptyState
            title="No pending OTP resets"
            description="When HR requests a portal OTP reset, it appears here for your approval."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const busy = busyId === r.id;
              const requestedAt = formatRequestedAt(r.createdAt);
              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-xl border border-amber-500/25 bg-linear-to-br from-amber-500/10 via-card to-orange-500/5 shadow-sm ring-1 ring-amber-500/15"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-950 dark:text-amber-100">
                        <KeyRound className="h-3 w-3" />
                        Portal OTP reset
                      </span>
                      <div className="flex items-start gap-2">
                        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-semibold tracking-tight">
                            {r.employee?.fullName || `Employee #${r.employeeId}`}
                          </p>
                          {r.employee?.department || r.employee?.jobTitle ? (
                            <p className="text-sm text-muted-foreground">
                              {[r.employee.jobTitle, r.employee.department]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Requested by{" "}
                          <span className="font-medium text-foreground/80">
                            {r.requestedBy || "HR"}
                          </span>
                        </span>
                        {requestedAt ? <span>{requestedAt}</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer border-rose-500/30 text-rose-800 hover:bg-rose-500/10 sm:min-w-38 dark:text-rose-300"
                        disabled={busy || busyId != null}
                        onClick={() => void decide(r, false)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className={cn(hrPrimaryBtnClass, "sm:min-w-38")}
                        disabled={busy || busyId != null}
                        onClick={() => void decide(r, true)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve reset
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {revealed ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-amber-500/35 bg-linear-to-br from-amber-500/20 via-amber-500/8 to-orange-500/15 p-5 shadow-sm ring-1 ring-amber-500/20">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  New portal OTP for {revealed.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Manager-only until first login
                </p>
              </div>
            </div>
            <p className="rounded-lg border border-amber-500/25 bg-background/70 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] text-amber-950 dark:text-amber-100">
              {revealed.otp}
            </p>
            <Button
              className="mt-3 w-full cursor-pointer border-amber-500/30 hover:bg-amber-500/10 sm:w-auto"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(revealed.otp);
                  toast.success("Copied");
                } catch {
                  /* ignore */
                }
                setRevealed(null);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy and dismiss
            </Button>
          </div>
        ) : null}
      </HrSectionCard>
    </HrPanelShell>
  );
}
