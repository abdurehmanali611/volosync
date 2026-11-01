/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Launch pads for the two companion portals: the employee self-service app
// (volosync-emp) and the hiring desk (volosync-ats), plus the codes each one
// signs in with.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ClipboardCheck,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { money, statusTone } from "@/lib/api";
import { hrExt, type HrAtsCredential, type HrEmployeeFull } from "@/lib/api/hr";
import { EmptyRow, Panel, StatusPill } from "@/components/volo/kit";
import { Field, PersonPicker, Select, useRunner } from "./ui";

const EMP_URL = process.env.NEXT_PUBLIC_EMP_URL ?? "http://localhost:3001";
const ATS_URL = process.env.NEXT_PUBLIC_ATS_URL ?? "http://localhost:3002";

function when(value: string | null) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmployeePortalSection({
  people,
  reload,
  onResetOtp,
}: {
  people: HrEmployeeFull[];
  reload: () => Promise<unknown>;
  onResetOtp?: (row: HrEmployeeFull) => unknown;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = people.find((row) => String(row.id) === employeeId) ?? null;

  const reset = async (row: HrEmployeeFull) => {
    if (!onResetOtp) return;
    setBusy(true);
    try {
      await onResetOtp(row);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel title="Employee portal" description="volosync-emp signs in with the employee's portal OTP.">
        <div className="space-y-3">
          <Field label="Employee">
            <PersonPicker value={employeeId} onChange={setEmployeeId} rows={people} />
          </Field>

          {selected ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-100">{selected.full_name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {selected.employee_no} · {selected.department_label || "no department"}
                      {selected.team_label ? ` · ${selected.team_label}` : ""}
                    </p>
                  </div>
                  <StatusPill status={selected.status} tone={statusTone(selected.status)} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-zinc-500 uppercase">Job title</dt>
                    <dd className="text-zinc-200">{selected.job_title || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 uppercase">Salary</dt>
                    <dd className="text-zinc-200">{money(selected.salary)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 uppercase">Portal OTP</dt>
                    <dd className="font-mono tracking-widest text-sky-300">
                      {selected.portal_otp || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 uppercase">First login</dt>
                    <dd className="text-zinc-200">{when(selected.portal_first_login_at)}</dd>
                  </div>
                </dl>
                {selected.must_change_otp && (
                  <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-300">
                    This OTP has not been changed yet — the employee is asked to set a new one at first sign-in.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {onResetOtp && (
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" disabled={busy} onClick={() => void reset(selected)}>
                    <RefreshCw className="size-3.5" /> Reset portal OTP
                  </Button>
                )}
                <Button size="sm" asChild>
                  <a href={EMP_URL} target="_blank" rel="noreferrer">
                    <ArrowUpRight className="size-3.5" /> Open portal
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <EmptyRow>Pick an employee to see their portal access.</EmptyRow>
          )}
        </div>
      </Panel>

      <Panel title="What the employee can do" description="Everything below reads and writes the same HR records you see here.">
        <ul className="space-y-3 text-sm text-zinc-300">
          {[
            ["Sign in with the portal OTP", "No email or password — the code is the identity, and a reset invalidates the old one."],
            ["View payslips", "Finance-confirmed payslips from the payroll runs HR generates."],
            ["Request leave", "Walks the same workflow steps; their leader approves first when the flow asks for it."],
            ["Check attendance and shifts", "Their own attendance days and the weekday pattern of their shift."],
            ["Chat and notifications", "Messages HR sends land in the portal chat and inbox."],
            ["Update their profile", "Phone, email and profile photo — HR sees the change immediately."],
          ].map(([title, hint]) => (
            <li key={title} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="flex items-center gap-2 font-medium text-zinc-100">
                <UserRound className="size-3.5 text-emerald-300" />
                {title}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{hint}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

const ROLES = [
  { value: "HR", label: "HR desk" },
  { value: "MANAGER", label: "Manager desk (offer stages)" },
  { value: "ADMIN", label: "Admin desk" },
];

export function HiringSection({
  people,
  reload,
}: {
  people: HrEmployeeFull[];
  reload: () => Promise<unknown>;
}) {
  const [credential, setCredential] = useState<HrAtsCredential | null>(null);
  const [role, setRole] = useState("HR");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await hrExt.atsCredential();
      setCredential(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the hiring desk code.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Panel
        title="Hiring desk code"
        description="volosync-ats unlocks with one code per tenant. Offer stages need the Manager code."
        actions={
          <Button size="sm" variant="outline" className="border-white/15 bg-transparent" disabled={loading} onClick={() => void load()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      >
        {loading ? (
          <EmptyRow>Loading the hiring desk code…</EmptyRow>
        ) : !credential?.provisioned ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-400">
              {credential?.message || "No hiring desk code has been issued yet."}
            </div>
            <Field label="Desk role">
              <Select value={role} onChange={setRole} options={ROLES} placeholder="HR desk" />
            </Field>
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => run(async () => {
                const result = await hrExt.issueAtsCredential(role);
                setCredential(result.data);
              }, "Hiring desk unlocked.")}
            >
              <KeyRound className="size-3.5" /> Issue hiring desk code
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[11px] tracking-wide text-zinc-500 uppercase">Unlock code</p>
              <p className="mt-1 font-mono text-2xl tracking-[0.3em] text-amber-300">{credential.otp}</p>
              <p className="mt-2 text-[11px] text-zinc-500">
                Desk role: <span className="text-zinc-200">{credential.role}</span>
                {credential.must_change_otp ? " · not changed since issue" : " · changed by the desk"}
              </p>
            </div>
            <Field label="Rotate to role">
              <Select value={role} onChange={setRole} options={ROLES} placeholder="HR desk" />
            </Field>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20" disabled={busy}>
                  <RefreshCw className="size-3.5" /> Rotate unlock code
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate the hiring desk code?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current code stops working immediately. Any signed-in ATS desk keeps its
                    session until the token expires, but new unlocks need the new code.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 text-white hover:bg-rose-500"
                    onClick={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        const result = await hrExt.issueAtsCredential(role);
                        setCredential(result.data);
                      }, "Hiring desk code rotated.");
                    }}
                  >
                    Rotate code
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </Panel>

      <Panel title="Hiring pipeline" description="Hires land on this roster automatically.">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
              <ClipboardCheck className="size-3.5 text-sky-300" /> Applied → Screening → Interview → Offer → Offer accepted
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Offer and offer-accepted moves are gated to the Manager desk code. Rejected and
              withdrawn close a candidate.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
              <ShieldCheck className="size-3.5" /> Hire creates an HR employee
            </p>
            <p className="mt-1 text-xs text-emerald-100/80">
              The candidate is split into first/last name, mapped to the vacancy&apos;s department and
              team, given an <span className="font-mono">EMP-0000</span> number, the vacancy salary and
              a 6-digit portal OTP — then appears in People and can sign in to volosync-emp.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[11px] tracking-wide text-zinc-500 uppercase">Roster size</p>
            <p className="mt-1 text-sm text-zinc-200">{people.length} employee(s) on this tenant</p>
          </div>
          <Button size="sm" asChild>
            <a href={ATS_URL} target="_blank" rel="noreferrer">
              <ArrowUpRight className="size-3.5" /> Open hiring desk
            </a>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
