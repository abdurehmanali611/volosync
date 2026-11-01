/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import { hrApi, money, api, type HrDepartment } from "@/lib/api";
import {
  hrExt,
  type HrDashboardFull,
  type HrEmployeeFull,
  type HrShiftTemplate,
  type HrTeam,
} from "@/lib/api/hr";
import { useView } from "@/lib/use-view";
import { exportExcel, exportPdf } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Clock,
  Copy,
  FileDown,
  FileText,
  Pencil,
  ShieldAlert,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { EmptyRow, PageHeader, Panel, StatCard, Td, Th } from "@/components/volo/kit";
import { PhoneField } from "@/components/volo/phone-field";
import { Field, IconButton, Select, useRunner } from "./ui";
import ShiftsSection from "./shifts";
import ChecklistsSection from "./checklists";
import PeopleSection from "./people";
import LeaveSection from "./leave";
import AttendanceSection from "./attendance";
import PayrollSection from "./payroll";
import IncidentsSection from "./incidents";
import DocumentsSection from "./documents";
import NotificationsSection from "./notifications";
import { EmployeePortalSection } from "./portals";

const today = () => new Date().toISOString().slice(0, 10);

export default function HrPage() {
  const [view] = useView("employees");
  const [dashboard, setDashboard] = useState<HrDashboardFull | null>(null);
  const [employees, setEmployees] = useState<HrEmployeeFull[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [shifts, setShifts] = useState<HrShiftTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [otp, setOtp] = useState<{ name: string; code: string } | null>(null);

  const [person, setPerson] = useState({
    first_name: "",
    last_name: "",
    sex: "M",
    phone: "",
    email: "",
    department: "",
    team: "",
    org_position: "",
    shift: "",
    job_title: "",
    hired_on: today(),
    salary: "0",
    portal_otp: "",
  });
  const [editing, setEditing] = useState<HrEmployeeFull | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    department: "",
    team: "",
    org_position: "",
    job_title: "",
    salary: "",
    status: "ACTIVE",
  });

  const load = useCallback(async () => {
    const [dash, people, departmentRows, teamRows, shiftRows] = await Promise.all([
      hrExt.dashboard(),
      hrExt.employees(search),
      hrApi.departments(),
      hrExt.teams(),
      hrExt.shiftTemplates(),
    ]);
    setDashboard(dash.data);
    setEmployees(people.data);
    setDepartments(departmentRows.data);
    setTeams(teamRows.data);
    setShifts(shiftRows.data);
  }, [search]);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(load);

  function openEdit(row: HrEmployeeFull) {
    setEditing(row);
    setEditForm({
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      email: row.email,
      department: row.department ? String(row.department) : "",
      team: row.team ? String(row.team) : "",
      org_position: row.org_position || "",
      job_title: row.job_title,
      salary: row.salary,
      status: row.status,
    });
  }

  function saveEdit() {
    if (!editing) return;
    return run(async () => {
      if (!editForm.first_name.trim()) throw new Error("First name is required");
      await hrApi.updateEmployee(editing.id, {
        ...editForm,
        department: editForm.department ? Number(editForm.department) : null,
        team: editForm.team ? Number(editForm.team) : null,
      });
      setEditing(null);
    }, "Employee updated.");
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

  const employeeMatrix = employees.map((row) => [
    row.employee_no,
    row.full_name,
    row.department_label,
    row.job_title,
    row.phone,
    row.hired_on ?? "",
    Number(row.salary),
    row.status,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="HR module"
        title="People, hours and pay"
        description="Roster, shifts, leave, attendance, payroll, incidents and documents — the operational HR module, live."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent"
              onClick={() =>
                exportPdf({
                  title: "Employee roster",
                  headers: ["No.", "Name", "Department", "Title", "Phone", "Hired", "Salary", "Status"],
                  rows: employeeMatrix,
                  file: "volosync-hr-roster",
                })
              }
            >
              <FileDown className="size-3.5" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent"
              onClick={() =>
                exportExcel({
                  title: "Employee roster",
                  headers: ["No.", "Name", "Department", "Title", "Phone", "Hired", "Salary", "Status"],
                  rows: employeeMatrix,
                  file: "volosync-hr-roster",
                })
              }
            >
              <FileDown className="size-3.5" /> Excel
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Headcount"
          value={String(dashboard?.headcount ?? employees.length)}
          hint={`${dashboard?.departments ?? departments.length} departments`}
          tone="amber"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Present today"
          value={`${dashboard?.present_today ?? 0}/${dashboard?.attendance_today ?? 0}`}
          hint="Attendance marked"
          tone="emerald"
          icon={<BadgeCheck className="size-4" />}
        />
        <StatCard
          label="Pending leave"
          value={String(dashboard?.pending_leaves ?? 0)}
          hint={`${dashboard?.on_leave ?? 0} currently on leave`}
          tone="sky"
          icon={<CalendarDays className="size-4" />}
        />
        <StatCard
          label="Salary mass"
          value={money(dashboard?.salary_mass ?? 0)}
          hint={`${dashboard?.pending_payroll ?? 0} run(s) awaiting the Manager`}
          tone="violet"
          icon={<Wallet className="size-4" />}
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending documents"
          value={String(dashboard?.pending_documents ?? 0)}
          hint="Uploaded, awaiting the manager"
          tone="sky"
          icon={<FileText className="size-4" />}
        />
        <StatCard
          label="Attendance corrections"
          value={String(dashboard?.pending_corrections ?? 0)}
          hint="Fix requests awaiting approval"
          tone="violet"
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Open incidents"
          value={String(dashboard?.open_incidents ?? 0)}
          hint="Logged but unresolved"
          tone="rose"
          icon={<ShieldAlert className="size-4" />}
        />
        <StatCard
          label="Pending payroll"
          value={String(dashboard?.pending_payroll ?? 0)}
          hint="Runs awaiting the manager"
          tone="amber"
          icon={<Banknote className="size-4" />}
        />
      </div>

      {view === "employees" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Add employee" description="Creates the roster entry and its portal code.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
              </Field>
              <Field label="Last name">
                <Input value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
              </Field>
              <Field label="Sex">
                <Select
                  value={person.sex}
                  onChange={(sex) => setPerson({ ...person, sex })}
                  options={[
                    { value: "M", label: "Male" },
                    { value: "F", label: "Female" },
                  ]}
                />
              </Field>
              <Field label="Phone">
                <PhoneField
                  value={person.phone}
                  onChange={(phone) => setPerson((current) => ({ ...current, phone }))}
                />
              </Field>
              <Field label="Email">
                <Input value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
              </Field>
              <Field label="Department">
                <Select
                  value={person.department}
                  onChange={(department) => setPerson({ ...person, department, team: "" })}
                  placeholder="Unassigned"
                  allowEmpty
                  options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
                />
              </Field>
              <Field label="Team / branch">
                <Select
                  value={person.team}
                  onChange={(teamId) => setPerson({ ...person, team: teamId })}
                  placeholder="No team"
                  allowEmpty
                  options={teams
                    .filter(
                      (row) =>
                        row.active &&
                        (!person.department || String(row.department) === person.department),
                    )
                    .map((row) => ({ value: String(row.id), label: row.label }))}
                />
              </Field>
              <Field label="Org position">
                <Select
                  value={person.org_position}
                  onChange={(org_position) => setPerson({ ...person, org_position })}
                  placeholder="Staff"
                  allowEmpty
                  options={[
                    { value: "leader", label: "Team leader" },
                    { value: "supervisor", label: "Supervisor" },
                  ]}
                />
              </Field>
              <Field label="Shift">
                <Select
                  value={person.shift}
                  onChange={(shift) => setPerson({ ...person, shift })}
                  placeholder="No shift"
                  allowEmpty
                  options={shifts
                    .filter((row) => row.active)
                    .map((row) => ({
                      value: String(row.id),
                      label: `${row.name} ${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`,
                    }))}
                />
              </Field>
              <Field label="Job title">
                <Input value={person.job_title} onChange={(e) => setPerson({ ...person, job_title: e.target.value })} />
              </Field>
              <Field label="Hired on">
                <Input type="date" value={person.hired_on} onChange={(e) => setPerson({ ...person, hired_on: e.target.value })} />
              </Field>
              <Field label="Salary">
                <Input
                  type="number"
                  step="0.01"
                  value={person.salary}
                  onChange={(e) => setPerson({ ...person, salary: e.target.value })}
                />
              </Field>
              <Field label="Portal OTP">
                <Input value={person.portal_otp} onChange={(e) => setPerson({ ...person, portal_otp: e.target.value })} />
              </Field>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (!person.first_name.trim()) throw new Error("First name is required");
                  const created = await hrApi.createEmployee({
                    ...person,
                    department: person.department ? Number(person.department) : null,
                    team: person.team ? Number(person.team) : null,
                    shift: person.shift ? Number(person.shift) : null,
                  });
                  setOtp({ name: created.data.full_name, code: created.data.portal_otp });
                  setPerson({ ...person, first_name: "", last_name: "", phone: "", email: "", shift: "", team: "" });
                }, "Employee added to the roster.")
              }
            >
              <UserPlus className="size-3.5" /> Add employee
            </Button>
          </Panel>

          <Panel
            title="Roster"
            description="Every employee in this tenant, with their portal code."
            actions={
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or number"
                className="h-8 w-44"
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px]">
                <thead>
                  <tr>
                    <Th>No.</Th>
                    <Th>Name</Th>
                    <Th>Department</Th>
                    <Th>Team</Th>
                    <Th>Title</Th>
                    <Th>Shift</Th>
                    <Th right>Salary</Th>
                    <Th right>OTP</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((row) => (
                    <tr key={row.id} className="group hover:bg-white/[0.02]">
                      <Td className="font-mono text-xs text-amber-300">{row.employee_no}</Td>
                      <Td>
                        {row.full_name}
                        <span className="ml-2 text-[11px] text-zinc-500">{row.phone}</span>
                      </Td>
                      <Td className="text-zinc-400">{row.department_label || "—"}</Td>
                      <Td className="text-zinc-400">{row.team_label || "—"}</Td>
                      <Td className="text-zinc-400">
                        {row.job_title || "—"}
                        {row.org_position ? (
                          <span className="ml-2 rounded-md border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                            {row.org_position === "leader" ? "Leader" : row.org_position}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-zinc-400">{row.shift_label || "—"}</Td>
                      <Td right>{money(row.salary)}</Td>
                      <Td right className="font-mono text-[11px] text-sky-300">
                        {row.portal_otp || "—"}
                        {row.must_change_otp ? (
                          <span className="ml-1 text-[10px] text-amber-400" title="Portal OTP not changed yet">
                            new
                          </span>
                        ) : null}
                      </Td>
                      <Td right>
                        <span className="inline-flex gap-1.5">
                          <IconButton title="Edit employee" tone="sky" onClick={() => openEdit(row)}>
                            <Pencil className="size-3.5" />
                          </IconButton>
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!employees.length && <EmptyRow>No employees yet.</EmptyRow>}
          </Panel>
        </div>
      )}

      {view === "shifts" && (
        <ShiftsSection people={employees} departments={departments} shifts={shifts} reload={load} canManage={false} />
      )}
      {view === "checklists" && (
        <ChecklistsSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "people" && (
        <PeopleSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "leave" && (
        <LeaveSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "attendance" && (
        <AttendanceSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "payroll" && (
        <PayrollSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "incidents" && (
        <IncidentsSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "documents" && (
        <DocumentsSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}

      {view === "notifications" && (
        <NotificationsSection people={employees} departments={departments} shifts={shifts} reload={load} />
      )}
      {view === "emp" && <EmployeePortalSection people={employees} reload={load} />}

      {view === "password" && <HrChangePasswordPanel />}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editing?.employee_no} · changes apply to the roster, portal and hiring records immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </Field>
            <Field label="Last name">
              <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <PhoneField
                value={editForm.phone}
                onChange={(phone) => setEditForm((current) => ({ ...current, phone }))}
              />
            </Field>
            <Field label="Email">
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Field>
            <Field label="Department">
              <Select
                value={editForm.department}
                onChange={(department) => setEditForm({ ...editForm, department, team: "" })}
                placeholder="Unassigned"
                allowEmpty
                options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
              />
            </Field>
            <Field label="Team / branch">
              <Select
                value={editForm.team}
                onChange={(teamId) => setEditForm({ ...editForm, team: teamId })}
                placeholder="No team"
                allowEmpty
                options={teams
                  .filter(
                    (row) =>
                      row.active &&
                      (!editForm.department || String(row.department) === editForm.department),
                  )
                  .map((row) => ({ value: String(row.id), label: row.label }))}
              />
            </Field>
            <Field label="Org position">
              <Select
                value={editForm.org_position}
                onChange={(org_position) => setEditForm({ ...editForm, org_position })}
                placeholder="Staff"
                allowEmpty
                options={[
                  { value: "leader", label: "Team leader" },
                  { value: "supervisor", label: "Supervisor" },
                ]}
              />
            </Field>
            <Field label="Job title">
              <Input value={editForm.job_title} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} />
            </Field>
            <Field label="Salary">
              <Input
                type="number"
                step="0.01"
                value={editForm.salary}
                onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={editForm.status}
                onChange={(status) => setEditForm({ ...editForm, status })}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "ON_LEAVE", label: "On leave" },
                  { value: "TERMINATED", label: "Terminated" },
                ]}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15 bg-transparent" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={saveEdit}>
              Save employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {otp && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setOtp(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-400 uppercase">
              New portal OTP
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">{otp.name}</h3>
            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
              Shown once — copy it now. After closing this dialog the code is
              only visible again through another reset.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className="flex-1 text-center font-mono text-3xl tracking-[0.3em] text-amber-300">
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
      )}
    </>
  );
}

function HrChangePasswordPanel() {
  const [form, setForm] = useState({ old: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.next !== form.confirm) { toast.error("Passwords do not match."); return; }
    setBusy(true);
    try {
      await api.changePassword({ old_password: form.old, new_password: form.next });
      toast.success("Password updated.");
      setForm({ old: "", next: "", confirm: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Change password" description="Update your login credentials whenever you like.">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[11px] tracking-wide text-zinc-400 uppercase">Current password</label>
          <Input type="password" value={form.old} onChange={(e) => setForm({ ...form, old: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] tracking-wide text-zinc-400 uppercase">New password</label>
          <Input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} minLength={6} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] tracking-wide text-zinc-400 uppercase">Confirm</label>
          <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} minLength={6} required />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy} className="bg-amber-600 text-white hover:bg-amber-500">
            {busy ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
