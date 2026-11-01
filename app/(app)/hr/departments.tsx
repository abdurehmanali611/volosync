/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Manager-owned org structure: departments and the teams/branches under them.
// HR reads these lists on the employee form but never edits them.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Network, Plus, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrApi, type HrDepartment } from "@/lib/api";
import { hrExt, type HrTeam } from "@/lib/api/hr";
import { Panel, StatCard, Td, Th } from "@/components/volo/kit";
import {
  CodeChip,
  EmptyState,
  Field,
  IconButton,
  Initials,
  Select,
  StatStrip,
  useRunner,
} from "./ui";

export default function DepartmentsSection({ reload }: { reload?: () => Promise<unknown> }) {
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [teams, setTeams] = useState<HrTeam[]>([]);
  const [department, setDepartment] = useState({ label: "", leader: "" });
  const [team, setTeam] = useState({ label: "", leader: "", department: "" });

  const load = useCallback(async () => {
    const [departmentRows, teamRows] = await Promise.all([hrApi.departments(), hrExt.teams()]);
    setDepartments(departmentRows.data);
    setTeams(teamRows.data);
  }, []);

  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const { busy, run } = useRunner(async () => {
    await load();
    if (reload) await reload();
  });

  const totalStaff = departments.reduce((sum, row) => sum + (row.staff ?? 0), 0);
  const activeTeams = teams.filter((row) => row.active).length;

  return (
    <div className="space-y-4">
      <StatStrip>
        <StatCard
          label="Departments"
          value={String(departments.length)}
          hint="Top-level org units"
          tone="violet"
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label="Teams & branches"
          value={String(teams.length)}
          hint={`${activeTeams} active`}
          tone="sky"
          icon={<Network className="size-4" />}
        />
        <StatCard
          label="Headcount"
          value={String(totalStaff)}
          hint="Rolled up from departments"
          tone="emerald"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Archived teams"
          value={String(teams.length - activeTeams)}
          hint="Hidden from new assignments"
          tone="slate"
          icon={<UserRound className="size-4" />}
        />
      </StatStrip>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Panel title="New department" description="Structure for the org tree.">
            <div className="space-y-3">
              <Field label="Label">
                <Input value={department.label} onChange={(e) => setDepartment({ ...department, label: e.target.value })} />
              </Field>
              <Field label="Leader">
                <Input value={department.leader} onChange={(e) => setDepartment({ ...department, leader: e.target.value })} />
              </Field>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!department.label.trim()) throw new Error("Department label is required");
                    await hrApi.createDepartment({
                      code: department.label,
                      label: department.label,
                      leader: department.leader,
                    });
                    setDepartment({ label: "", leader: "" });
                  }, "Department created.")
                }
              >
                <Plus className="size-3.5" /> Create department
              </Button>
            </div>
          </Panel>

          <Panel title="New team / branch" description="Wholesale outlets, routes and docks under a department.">
            <div className="space-y-3">
              <Field label="Department">
                <Select
                  value={team.department}
                  onChange={(departmentId) => setTeam({ ...team, department: departmentId })}
                  placeholder="Unassigned"
                  allowEmpty
                  options={departments.map((row) => ({ value: String(row.id), label: row.label }))}
                />
              </Field>
              <Field label="Team label">
                <Input
                  value={team.label}
                  onChange={(e) => setTeam({ ...team, label: e.target.value })}
                  placeholder="e.g. Bole branch"
                />
              </Field>
              <Field label="Team leader">
                <Input value={team.leader} onChange={(e) => setTeam({ ...team, leader: e.target.value })} />
              </Field>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!team.label.trim()) throw new Error("Team label is required");
                    await hrExt.createTeam({
                      label: team.label,
                      leader: team.leader,
                      department: team.department ? Number(team.department) : null,
                    });
                    setTeam({ ...team, label: "", leader: "", department: "" });
                  }, "Team created.")
                }
              >
                <Network className="size-3.5" /> Create team
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Departments" description="Headcount rolls up from the roster.">
            <div className="grid gap-2 sm:grid-cols-2">
              {departments.map((row) => (
                <div
                  key={row.id}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-violet-400/30 hover:bg-white/[0.04]"
                >
                  <div className="pointer-events-none absolute -top-8 -right-6 size-24 rounded-full bg-gradient-to-br from-violet-400/20 to-transparent opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-violet-400/25 bg-violet-400/10 text-violet-200">
                        <Building2 className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">{row.label}</p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {row.leader || "No leader assigned"}
                        </p>
                      </div>
                    </div>
                    <CodeChip tone="violet">{row.code}</CodeChip>
                  </div>
                  <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-zinc-400">
                      <Users className="size-3" /> {row.staff ?? 0} staff
                    </span>
                  </div>
                </div>
              ))}
              {!departments.length && (
                <div className="sm:col-span-2">
                  <EmptyState
                    icon={<Building2 className="size-4" />}
                    title="No departments yet"
                    hint="Create the first department on the left to start the org tree."
                  />
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Teams & branches" description="Every operating unit; employees are assigned from the roster form.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Team</Th>
                    <Th>Department</Th>
                    <Th>Leader</Th>
                    <Th right>Staff</Th>
                    <Th right>Status</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.025]">
                      <Td>
                        <CodeChip tone="violet">{row.code}</CodeChip>
                      </Td>
                      <Td className="text-zinc-100">{row.label}</Td>
                      <Td>
                        {row.department_label ? (
                          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-300">
                            {row.department_label}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </Td>
                      <Td>
                        {row.leader ? (
                          <span className="flex items-center gap-2 text-zinc-300">
                            <Initials name={row.leader} tone="sky" className="size-6 text-[10px]" />
                            <span className="truncate">{row.leader}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </Td>
                      <Td right>{row.staff}</Td>
                      <Td right>
                        <button
                          onClick={() =>
                            run(
                              () => hrExt.updateTeam(row.id, { active: !row.active }),
                              row.active ? "Team archived." : "Team restored.",
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                            row.active
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                          {row.active ? "Active" : "Archived"}
                        </button>
                      </Td>
                      <Td right>
                        <IconButton
                          title="Delete team"
                          tone="rose"
                          onClick={() => {
                            if (!window.confirm(`Delete team "${row.label}"?`)) return;
                            run(() => hrExt.deleteTeam(row.id), "Team deleted.");
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!teams.length && (
              <EmptyState
                icon={<Network className="size-4" />}
                title="No teams yet"
                hint="Teams and branches appear here once you create them on the left."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
