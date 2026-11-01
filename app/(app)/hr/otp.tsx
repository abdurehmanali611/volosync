/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Manager-owned portal OTP resets: issue a fresh one-time portal code for any
// employee and show it once — HR never resets a code directly.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Copy, KeyRound, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hrExt, type HrEmployeeFull } from "@/lib/api/hr";
import { Panel, StatCard, Td, Th } from "@/components/volo/kit";
import { CodeChip, EmptyState, IconButton, Initials, StatStrip, useRunner } from "./ui";

export default function OtpResetSection({ reload }: { reload?: () => Promise<unknown> }) {
  const [employees, setEmployees] = useState<HrEmployeeFull[]>([]);
  const [otp, setOtp] = useState<{ name: string; code: string } | null>(null);

  const load = useCallback(async () => {
    const rows = await hrExt.employees("");
    setEmployees(rows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { run } = useRunner(async () => {
    await load();
    if (reload) await reload();
  });

  function resetOtp(row: HrEmployeeFull) {
    return run(async () => {
      const result = await hrExt.otpReset(row.id);
      setOtp({ name: result.data.full_name, code: result.data.portal_otp });
    }, "Portal OTP reset.");
  }

  async function copyOtp() {
    if (!otp) return;
    try {
      await navigator.clipboard.writeText(otp.code);
      toast.success("OTP copied to clipboard.");
    } catch {
      toast.error("Could not copy — select the code manually.");
    }
  }

  return (
    <>
      <StatStrip>
        <StatCard
          label="Roster"
          value={String(employees.length)}
          hint="Employees with portal access"
          tone="amber"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Codes issued"
          value={String(employees.filter((row) => Boolean(row.portal_otp)).length)}
          hint="Portal OTPs on file"
          tone="sky"
          icon={<KeyRound className="size-4" />}
        />
        <StatCard
          label="First-login pending"
          value={String(employees.filter((row) => row.must_change_otp).length)}
          hint="Must set a new code at sign-in"
          tone="rose"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Departments"
          value={String(
            new Set(employees.map((row) => row.department_label).filter(Boolean)).size,
          )}
          hint="Covered by this roster"
          tone="violet"
          icon={<Building2 className="size-4" />}
        />
      </StatStrip>

      <Panel
        title="Portal OTP resets"
        description="Reset a portal OTP for any employee — shown once, copy it immediately."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <Th>No.</Th>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th right>Current OTP</Th>
                <Th right>Reset</Th>
              </tr>
            </thead>
            <tbody>
              {employees.map((row) => (
                <tr key={row.id} className="group transition hover:bg-white/[0.025]">
                  <Td>
                    <CodeChip tone="amber">{row.employee_no}</CodeChip>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Initials name={row.full_name} tone="amber" />
                      <span className="min-w-0">
                        <span className="block truncate text-zinc-100">{row.full_name}</span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {row.team_label || row.job_title || "—"}
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td className="text-zinc-400">{row.department_label || "—"}</Td>
                  <Td right>
                    {row.portal_otp ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] tracking-[0.18em] text-sky-200">
                        {row.portal_otp}
                        {row.must_change_otp && (
                          <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_currentColor]" />
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </Td>
                  <Td right>
                    <IconButton title="Reset OTP (shown once)" tone="amber" onClick={() => resetOtp(row)}>
                      <KeyRound className="size-3.5" />
                    </IconButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!employees.length && (
          <EmptyState
            icon={<KeyRound className="size-4" />}
            title="No employees yet"
            hint="Add people to the roster first — their portal OTPs appear here."
          />
        )}
      </Panel>

      {otp && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOtp(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-400 via-orange-300 to-rose-300" />
            <div className="pointer-events-none absolute -top-20 -right-14 size-48 rounded-full bg-gradient-to-br from-amber-400/25 to-transparent blur-3xl" />
            <div className="relative">
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-amber-300 uppercase">
                <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                New portal OTP
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <Initials name={otp.name} tone="amber" />
                <h3 className="text-lg font-semibold text-white">{otp.name}</h3>
              </div>
              <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                Shown once — copy it now. After closing this dialog the code is only visible again
                through another reset.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-transparent p-3">
                <span className="flex-1 text-center font-mono text-3xl tracking-[0.3em] text-amber-200">
                  {otp.code}
                </span>
                <IconButton title="Copy code" tone="sky" onClick={copyOtp}>
                  <Copy className="size-3.5" />
                </IconButton>
              </div>
              <Button className="mt-4 w-full" onClick={() => setOtp(null)}>
                I saved it — close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
