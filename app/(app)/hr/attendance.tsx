"use client";

// Attendance: stamp days, export the register (Excel + PDF) and raise
// corrections. Corrections go PENDING and are applied by the Manager queue.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, FileDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrApi } from "@/lib/api";
import { hrExt, type HrAttendanceCorrection, type HrAttendanceFull } from "@/lib/api/hr";
import { exportAttendancePdf, exportExcel } from "@/lib/export";
import { EmptyRow, Panel, StatusPill, Td, Th } from "@/components/volo/kit";
import { Field, PersonPicker, RowCard, Select, SubTabs, toneForStatus, useRunner, type SectionProps } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);

const STATUSES = ["PRESENT", "LATE", "ABSENT", "LEAVE", "HALF_DAY"];

const statusToneLocal = (status: string) =>
  status === "PRESENT" ? "emerald" : status === "ABSENT" ? "rose" : "amber";

export default function AttendanceSection({ people, shifts, reload }: SectionProps) {
  const [tab, setTab] = useState("register");

  // ---- register
  const [attendance, setAttendance] = useState<HrAttendanceFull[]>([]);
  const [stamp, setStamp] = useState({ employee: "", day: today(), status: "PRESENT", shift: "" });

  // ---- corrections
  const [corrections, setCorrections] = useState<HrAttendanceCorrection[]>([]);
  const [correction, setCorrection] = useState({
    employee: "",
    day: today(),
    new_status: "PRESENT",
    new_check_in: "",
    new_check_out: "",
    reason: "",
  });

  const load = useCallback(async () => {
    const [attendanceRows, correctionRows] = await Promise.all([
      hrExt.attendance(),
      hrExt.corrections(),
    ]);
    setAttendance(attendanceRows.data);
    setCorrections(correctionRows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await Promise.all([load(), reload()]);
  });

  function exportPdfRegister() {
    exportAttendancePdf({
      title: "Attendance register",
      subtitle: `${attendance.length} row(s) · generated from VoloSync`,
      headers: ["Employee", "Day", "Status", "In", "Out", "Shift", "Note"],
      rows: attendance.map((row) => [
        row.employee_name,
        row.day,
        row.status,
        row.check_in ?? "",
        row.check_out ?? "",
        row.shift_label ?? "",
        row.note,
      ]),
      file: "volosync-attendance",
    });
    toast.success("Attendance PDF downloaded.");
  }

  return (
    <>
      <SubTabs
        value={tab}
        onChange={setTab}
        items={[
          ["register", "Register"],
          ["corrections", "Corrections"],
        ]}
      />

      {tab === "register" && (
        <Panel
          title="Attendance"
          description="Stamp a day, then export the register."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-transparent"
                onClick={exportPdfRegister}
              >
                <FileDown className="size-3.5" /> PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-transparent"
                onClick={() =>
                  exportExcel({
                    title: "Attendance register",
                    headers: ["Employee", "Day", "Status", "In", "Out", "Shift", "Note"],
                    rows: attendance.map((row) => [
                      row.employee_name,
                      row.day,
                      row.status,
                      row.check_in ?? "",
                      row.check_out ?? "",
                      row.shift_label ?? "",
                      row.note,
                    ]),
                    file: "volosync-attendance",
                  })
                }
              >
                <FileDown className="size-3.5" /> Excel
              </Button>
            </div>
          }
        >
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Employee">
              <PersonPicker
                value={stamp.employee}
                onChange={(employee) => setStamp({ ...stamp, employee })}
                rows={people}
              />
            </Field>
            <Field label="Day">
              <Input type="date" value={stamp.day} onChange={(e) => setStamp({ ...stamp, day: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select
                value={stamp.status}
                onChange={(status) => setStamp({ ...stamp, status })}
                options={STATUSES.map((option) => ({
                  value: option,
                  label: option.replace("_", " ").toLowerCase(),
                }))}
              />
            </Field>
            <Field label="Shift">
              <Select
                value={stamp.shift}
                onChange={(shift) => setStamp({ ...stamp, shift })}
                placeholder="No shift"
                allowEmpty
                options={shifts
                  .filter((row) => row.active)
                  .map((row) => ({ value: String(row.id), label: `${row.name} ${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}` }))}
              />
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!stamp.employee) throw new Error("Pick an employee");
                    await hrApi.markAttendance({
                      ...stamp,
                      employee: Number(stamp.employee),
                      shift: stamp.shift ? Number(stamp.shift) : undefined,
                    });
                  }, "Attendance stamped.")
                }
              >
                <Check className="size-3.5" /> Stamp
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Day</Th>
                  <Th>Status</Th>
                  <Th>In</Th>
                  <Th>Out</Th>
                  <Th>Shift</Th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 40).map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <Td>{row.employee_name}</Td>
                    <Td className="text-zinc-400">{row.day}</Td>
                    <Td>
                      <StatusPill status={row.status} tone={statusToneLocal(row.status)} />
                    </Td>
                    <Td className="text-zinc-400">{row.check_in ?? "—"}</Td>
                    <Td className="text-zinc-400">{row.check_out ?? "—"}</Td>
                    <Td className="text-zinc-400">{row.shift_label || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!attendance.length && <EmptyRow>No attendance stamped yet.</EmptyRow>}
        </Panel>
      )}

      {tab === "corrections" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Request a correction" description="Fixes a stamped day once the manager approves.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee">
                <PersonPicker
                  value={correction.employee}
                  onChange={(employee) => setCorrection({ ...correction, employee })}
                  rows={people}
                />
              </Field>
              <Field label="Day">
                <Input type="date" value={correction.day} onChange={(e) => setCorrection({ ...correction, day: e.target.value })} />
              </Field>
              <Field label="New status">
                <Select
                  value={correction.new_status}
                  onChange={(new_status) => setCorrection({ ...correction, new_status })}
                  options={STATUSES.map((option) => ({
                    value: option,
                    label: option.replace("_", " ").toLowerCase(),
                  }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check in">
                  <Input
                    type="time"
                    value={correction.new_check_in}
                    onChange={(e) => setCorrection({ ...correction, new_check_in: e.target.value })}
                  />
                </Field>
                <Field label="Check out">
                  <Input
                    type="time"
                    value={correction.new_check_out}
                    onChange={(e) => setCorrection({ ...correction, new_check_out: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Reason" className="sm:col-span-2">
                <Input
                  value={correction.reason}
                  placeholder="why the day needs fixing"
                  onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
                />
              </Field>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!correction.employee) throw new Error("Pick an employee");
                  await hrExt.createCorrection({
                    employee: Number(correction.employee),
                    day: correction.day,
                    new_status: correction.new_status,
                    new_check_in: correction.new_check_in || undefined,
                    new_check_out: correction.new_check_out || undefined,
                    reason: correction.reason,
                  });
                }, "Correction requested — waiting on the manager.")
              }
            >
              <Plus className="size-3.5" /> Request correction
            </Button>
          </Panel>

          <Panel title="Corrections" description="The manager applies approved corrections to the register.">
            <div className="space-y-2">
              {corrections.map((row) => (
                <RowCard key={row.id}>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100">
                      {row.employee_name}
                      <span className="ml-2 text-[11px] text-zinc-500">
                        {row.day} → {row.new_status.replace("_", " ").toLowerCase()}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.new_check_in ? `in ${row.new_check_in.slice(0, 5)}` : "in —"}
                      {row.new_check_out ? ` · out ${row.new_check_out.slice(0, 5)}` : " · out —"}
                      {row.reason ? ` · ${row.reason}` : ""}
                    </p>
                    {row.decided_by && (
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        decided by {row.decided_by}
                        {row.decision_note ? ` · ${row.decision_note}` : ""}
                      </p>
                    )}
                  </div>
                  <StatusPill status={row.status} tone={toneForStatus(row.status)} />
                </RowCard>
              ))}
              {!corrections.length && <EmptyRow>No attendance corrections.</EmptyRow>}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
