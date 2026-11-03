"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Banknote,
  Clock3,
  Gift,
  HandCoins,
  Scale,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PendingButton } from "@/components/ui/pending-button";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import {
  HrRequestDataTable,
  HrStatusPill,
} from "@/components/hr/HrRequestDataTable";
import {
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  hrFieldClass,
  hrPrimaryBtnClass,
} from "@/components/hr/hrChrome";
import { notifyApiFailure } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { HrEmployee } from "@/lib/api/hrSource";
import {
  createHrAdvanceRequestApi,
  createHrBonusApi,
  createHrLoanApi,
  createHrOvertimeRequestApi,
  decideHrAdvanceRequestApi,
  decideHrBonusApi,
  decideHrLoanApi,
  decideHrOvertimeRequestApi,
  decideHrSalaryChangeApi,
  fetchHrAdvanceRequests,
  fetchHrBonuses,
  fetchHrLoans,
  fetchHrOvertimeRequests,
  fetchHrSalaryHistory,
  requestHrSalaryChangeApi,
  type HrAdvanceRequest,
  type HrBonus,
  type HrLoan,
  type HrOvertimeRequest,
  type HrSalaryHistory,
} from "@/lib/api/hrPhaseB";

function DecideButtons({
  show,
  onDecide,
}: {
  show: boolean;
  onDecide: (approve: boolean) => Promise<void>;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => void onDecide(true)}>
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onDecide(false)}
      >
        Reject
      </Button>
    </div>
  );
}

function CompSplit({
  canRequest,
  formTitle,
  formDescription,
  form,
  listTitle,
  listDescription,
  list,
}: {
  canRequest: boolean;
  formTitle: string;
  formDescription: string;
  form: ReactNode;
  listTitle: string;
  listDescription: string;
  list: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-stretch gap-4",
        canRequest ? "lg:grid-cols-2" : "grid-cols-1",
      )}
    >
      {canRequest ? (
        <HrFormSection
          className="h-full"
          title={formTitle}
          description={formDescription}
        >
          {form}
        </HrFormSection>
      ) : null}
      <HrFormSection
        className="h-full"
        title={listTitle}
        description={listDescription}
      >
        {list}
      </HrFormSection>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function formatEtb(n: number) {
  return `${Number(n || 0).toLocaleString()} ETB`;
}

export function HrCompensationPanel({
  employees,
  canRequest,
  canDecide,
}: {
  employees: HrEmployee[];
  canRequest: boolean;
  canDecide: boolean;
}) {
  const [salary, setSalary] = useState<HrSalaryHistory[]>([]);
  const [advances, setAdvances] = useState<HrAdvanceRequest[]>([]);
  const [loans, setLoans] = useState<HrLoan[]>([]);
  const [bonuses, setBonuses] = useState<HrBonus[]>([]);
  const [ot, setOt] = useState<HrOvertimeRequest[]>([]);
  const [pending, setPending] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    employeeId: "",
    newETB: "",
    reason: "",
  });
  const [advForm, setAdvForm] = useState({
    employeeId: "",
    amountETB: "",
    reason: "",
  });
  const [loanForm, setLoanForm] = useState({
    employeeId: "",
    principalETB: "",
    installmentETB: "",
    reason: "",
  });
  const [bonusForm, setBonusForm] = useState({
    employeeId: "",
    label: "",
    amountETB: "",
  });
  const [otForm, setOtForm] = useState({
    employeeId: "",
    workYmd: "",
    hours: "",
    amountETB: "",
    reason: "",
  });

  const empName = useCallback(
    (id: number) => employees.find((e) => e.id === id)?.fullName || `#${id}`,
    [employees],
  );

  const load = useCallback(async () => {
    try {
      const [s, a, l, b, o] = await Promise.all([
        fetchHrSalaryHistory(),
        fetchHrAdvanceRequests(),
        fetchHrLoans(),
        fetchHrBonuses(),
        fetchHrOvertimeRequests(),
      ]);
      setSalary(s);
      setAdvances(a);
      setLoans(l);
      setBonuses(b);
      setOt(o);
    } catch (e) {
      notifyApiFailure(e, "Could not load compensation data");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const salaryColumns = useMemo<ColumnDef<HrSalaryHistory, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        id: "change",
        header: "Change",
        cell: ({ row }) =>
          `${formatEtb(row.original.previousETB)} → ${formatEtb(row.original.newETB)}`,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => row.original.reason || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DecideButtons
            show={canDecide && row.original.status === "pending"}
            onDecide={async (approve) => {
              try {
                await decideHrSalaryChangeApi(row.original.id, approve);
                toast.success(approve ? "Salary applied" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, empName, load],
  );

  const advanceColumns = useMemo<ColumnDef<HrAdvanceRequest, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "amountETB",
        header: "Amount",
        cell: ({ row }) => formatEtb(row.original.amountETB),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => row.original.reason || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DecideButtons
            show={canDecide && row.original.status === "pending"}
            onDecide={async (approve) => {
              try {
                await decideHrAdvanceRequestApi(row.original.id, approve);
                toast.success(approve ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, empName, load],
  );

  const loanColumns = useMemo<ColumnDef<HrLoan, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "principalETB",
        header: "Principal",
        cell: ({ row }) => formatEtb(row.original.principalETB),
      },
      {
        accessorKey: "remainingETB",
        header: "Remaining",
        cell: ({ row }) => formatEtb(row.original.remainingETB),
      },
      {
        accessorKey: "installmentETB",
        header: "Installment",
        cell: ({ row }) => formatEtb(row.original.installmentETB),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => row.original.reason || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DecideButtons
            show={canDecide && row.original.status === "pending"}
            onDecide={async (approve) => {
              try {
                await decideHrLoanApi(row.original.id, approve);
                toast.success(approve ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, empName, load],
  );

  const bonusColumns = useMemo<ColumnDef<HrBonus, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "label",
        header: "Label",
      },
      {
        accessorKey: "amountETB",
        header: "Amount",
        cell: ({ row }) => formatEtb(row.original.amountETB),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DecideButtons
            show={canDecide && row.original.status === "pending"}
            onDecide={async (approve) => {
              try {
                await decideHrBonusApi(row.original.id, approve);
                toast.success(approve ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, empName, load],
  );

  const otColumns = useMemo<ColumnDef<HrOvertimeRequest, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => empName(row.employeeId),
        header: "Employee",
      },
      {
        accessorKey: "workYmd",
        header: "Work date",
      },
      {
        accessorKey: "hours",
        header: "Hours",
      },
      {
        accessorKey: "amountETB",
        header: "Amount",
        cell: ({ row }) => formatEtb(row.original.amountETB),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => row.original.reason || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <HrStatusPill status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DecideButtons
            show={canDecide && row.original.status === "pending"}
            onDecide={async (approve) => {
              try {
                await decideHrOvertimeRequestApi(row.original.id, approve);
                toast.success(approve ? "Approved" : "Rejected");
                await load();
              } catch (e) {
                notifyApiFailure(e, "Decision failed");
              }
            }}
          />
        ),
      },
    ],
    [canDecide, empName, load],
  );

  return (
    <HrPanelShell>
      <div className="space-y-6">
        <HrSectionCard
          title="Salary changes"
          description={
            canDecide && !canRequest
              ? "Approve pending base-salary changes to apply them to the employee."
              : "Request a new base salary. Manager approval applies the change."
          }
          icon={<Banknote className="h-5 w-5" />}
        >
          <CompSplit
            canRequest={canRequest}
            formTitle="New request"
            formDescription="Employee, new amount, and a short reason."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      salaryForm.employeeId
                        ? [Number(salaryForm.employeeId)]
                        : []
                    }
                    onChange={(ids) =>
                      setSalaryForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <Field label="New salary (ETB)">
                  <Input
                    className={hrFieldClass}
                    type="number"
                    placeholder="0"
                    value={salaryForm.newETB}
                    onChange={(e) =>
                      setSalaryForm((f) => ({ ...f, newETB: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Reason">
                  <Textarea
                    className={cn(hrFieldClass, "min-h-20")}
                    placeholder="Why is this change needed?"
                    value={salaryForm.reason}
                    onChange={(e) =>
                      setSalaryForm((f) => ({ ...f, reason: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!salaryForm.employeeId) {
                      toast.error("Select an employee");
                      return;
                    }
                    setPending(true);
                    try {
                      await requestHrSalaryChangeApi({
                        employeeId: Number(salaryForm.employeeId),
                        newETB: Number(salaryForm.newETB) || 0,
                        reason: salaryForm.reason,
                      });
                      toast.success("Salary change submitted");
                      setSalaryForm({
                        employeeId: "",
                        newETB: "",
                        reason: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Request failed");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit request
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent requests"}
            listDescription={
              canDecide
                ? "Approve to update the employee base salary."
                : "Submitted salary change requests."
            }
            list={
              <HrRequestDataTable
                data={salary}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No salary changes"
                emptyDescription={
                  canRequest
                    ? "Submit the first salary change on the left."
                    : "Nothing waiting for approval yet."
                }
                columns={salaryColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Advances"
          description={
            canDecide && !canRequest
              ? "Approve or reject salary advances. Approved advances add to the next payroll earnings, then mark as paid."
              : "Request a salary advance. After Manager approval it increases earnings on the next payroll generate."
          }
          icon={<HandCoins className="h-5 w-5" />}
        >
          <CompSplit
            canRequest={canRequest}
            formTitle="New advance"
            formDescription="Employee, amount, and reason."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      advForm.employeeId ? [Number(advForm.employeeId)] : []
                    }
                    onChange={(ids) =>
                      setAdvForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <Field label="Amount (ETB)">
                  <Input
                    className={hrFieldClass}
                    type="number"
                    placeholder="0"
                    value={advForm.amountETB}
                    onChange={(e) =>
                      setAdvForm((f) => ({ ...f, amountETB: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Reason">
                  <Textarea
                    className={cn(hrFieldClass, "min-h-20")}
                    placeholder="Why is this advance needed?"
                    value={advForm.reason}
                    onChange={(e) =>
                      setAdvForm((f) => ({ ...f, reason: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!advForm.employeeId) {
                      toast.error("Select an employee");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrAdvanceRequestApi({
                        employeeId: Number(advForm.employeeId),
                        amountETB: Number(advForm.amountETB) || 0,
                        reason: advForm.reason,
                      });
                      toast.success("Advance submitted");
                      setAdvForm({
                        employeeId: "",
                        amountETB: "",
                        reason: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit advance");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit advance
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent advances"}
            listDescription="Pending advances wait for Manager."
            list={
              <HrRequestDataTable
                data={advances}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No advances"
                emptyDescription={
                  canRequest
                    ? "Submit the first advance on the left."
                    : "No advances awaiting review."
                }
                columns={advanceColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Loans"
          description={
            canDecide && !canRequest
              ? "Approve or reject staff loans. Active loans deduct the installment each payroll until principal is cleared."
              : "Request a loan with principal and installment. After approval, each payroll deducts the installment until remaining hits zero."
          }
          icon={<Wallet className="h-5 w-5" />}
        >
          <CompSplit
            canRequest={canRequest}
            formTitle="New loan"
            formDescription="Principal, installment, and reason."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      loanForm.employeeId ? [Number(loanForm.employeeId)] : []
                    }
                    onChange={(ids) =>
                      setLoanForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Principal (ETB)">
                    <Input
                      className={hrFieldClass}
                      type="number"
                      placeholder="0"
                      value={loanForm.principalETB}
                      onChange={(e) =>
                        setLoanForm((f) => ({
                          ...f,
                          principalETB: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Installment (ETB)">
                    <Input
                      className={hrFieldClass}
                      type="number"
                      placeholder="0"
                      value={loanForm.installmentETB}
                      onChange={(e) =>
                        setLoanForm((f) => ({
                          ...f,
                          installmentETB: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Reason">
                  <Textarea
                    className={cn(hrFieldClass, "min-h-20")}
                    placeholder="Optional notes"
                    value={loanForm.reason}
                    onChange={(e) =>
                      setLoanForm((f) => ({ ...f, reason: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!loanForm.employeeId) {
                      toast.error("Select an employee");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrLoanApi({
                        employeeId: Number(loanForm.employeeId),
                        principalETB: Number(loanForm.principalETB) || 0,
                        installmentETB: Number(loanForm.installmentETB) || 0,
                        reason: loanForm.reason,
                      });
                      toast.success("Loan submitted");
                      setLoanForm({
                        employeeId: "",
                        principalETB: "",
                        installmentETB: "",
                        reason: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit loan");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit loan
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent loans"}
            listDescription="Pending loans wait for Manager."
            list={
              <HrRequestDataTable
                data={loans}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No loans"
                emptyDescription={
                  canRequest
                    ? "Submit the first loan on the left."
                    : "No loans awaiting review."
                }
                columns={loanColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Bonuses"
          description={
            canDecide && !canRequest
              ? "Approve or reject one-off bonus requests. Approved bonuses add to the next payroll earnings, then mark as paid."
              : "Request a one-off bonus. After Manager approval it increases earnings on the next payroll generate."
          }
          icon={<Gift className="h-5 w-5" />}
        >
          <CompSplit
            canRequest={canRequest}
            formTitle="New bonus"
            formDescription="Label and amount for the bonus."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      bonusForm.employeeId
                        ? [Number(bonusForm.employeeId)]
                        : []
                    }
                    onChange={(ids) =>
                      setBonusForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <Field label="Label">
                  <Input
                    className={hrFieldClass}
                    placeholder="e.g. Ramadan bonus"
                    value={bonusForm.label}
                    onChange={(e) =>
                      setBonusForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Amount (ETB)">
                  <Input
                    className={hrFieldClass}
                    type="number"
                    placeholder="0"
                    value={bonusForm.amountETB}
                    onChange={(e) =>
                      setBonusForm((f) => ({
                        ...f,
                        amountETB: e.target.value,
                      }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!bonusForm.employeeId || !bonusForm.label.trim()) {
                      toast.error("Employee and label are required");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrBonusApi({
                        employeeId: Number(bonusForm.employeeId),
                        label: bonusForm.label.trim(),
                        amountETB: Number(bonusForm.amountETB) || 0,
                      });
                      toast.success("Bonus submitted");
                      setBonusForm({
                        employeeId: "",
                        label: "",
                        amountETB: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit bonus");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit bonus
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent bonuses"}
            listDescription="Pending bonuses wait for Manager."
            list={
              <HrRequestDataTable
                data={bonuses}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No bonuses"
                emptyDescription={
                  canRequest
                    ? "Submit the first bonus on the left."
                    : "No bonuses awaiting review."
                }
                columns={bonusColumns}
              />
            }
          />
        </HrSectionCard>

        <HrSectionCard
          title="Overtime"
          description={
            canDecide && !canRequest
              ? "Approve overtime. Approved rows in the pay range add to earnings on generate, then mark as paid."
              : "Log overtime for a work date. After Manager approval it increases earnings when that date falls in the payroll From–To."
          }
          icon={<Clock3 className="h-5 w-5" />}
        >
          <CompSplit
            canRequest={canRequest}
            formTitle="New overtime"
            formDescription="Work date, hours, amount, and optional reason."
            form={
              <div className="space-y-4">
                <Field label="Employee">
                  <HrEmployeeCombobox
                    employees={employees}
                    valueIds={
                      otForm.employeeId ? [Number(otForm.employeeId)] : []
                    }
                    onChange={(ids) =>
                      setOtForm((f) => ({
                        ...f,
                        employeeId: ids[0] ? String(ids[0]) : "",
                      }))
                    }
                  />
                </Field>
                <Field label="Work date">
                  <HotelDayPicker
                    value={otForm.workYmd}
                    onChange={(v) => setOtForm((f) => ({ ...f, workYmd: v }))}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Hours">
                    <Input
                      className={hrFieldClass}
                      type="number"
                      placeholder="0"
                      value={otForm.hours}
                      onChange={(e) =>
                        setOtForm((f) => ({ ...f, hours: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Amount (ETB)">
                    <Input
                      className={hrFieldClass}
                      type="number"
                      placeholder="0"
                      value={otForm.amountETB}
                      onChange={(e) =>
                        setOtForm((f) => ({
                          ...f,
                          amountETB: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Reason">
                  <Textarea
                    className={cn(hrFieldClass, "min-h-20")}
                    placeholder="Optional notes"
                    value={otForm.reason}
                    onChange={(e) =>
                      setOtForm((f) => ({ ...f, reason: e.target.value }))
                    }
                  />
                </Field>
                <PendingButton
                  pending={pending}
                  className={cn(hrPrimaryBtnClass, "w-full")}
                  onClick={async () => {
                    if (!otForm.employeeId || !otForm.workYmd) {
                      toast.error("Employee and work date are required");
                      return;
                    }
                    setPending(true);
                    try {
                      await createHrOvertimeRequestApi({
                        employeeId: Number(otForm.employeeId),
                        workYmd: otForm.workYmd,
                        hours: Number(otForm.hours) || 0,
                        amountETB: Number(otForm.amountETB) || 0,
                        reason: otForm.reason,
                      });
                      toast.success("Overtime submitted");
                      setOtForm({
                        employeeId: "",
                        workYmd: "",
                        hours: "",
                        amountETB: "",
                        reason: "",
                      });
                      await load();
                    } catch (e) {
                      notifyApiFailure(e, "Could not submit overtime");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Submit overtime
                </PendingButton>
              </div>
            }
            listTitle={canDecide ? "Queue & history" : "Recent overtime"}
            listDescription="Pending overtime waits for Manager."
            list={
              <HrRequestDataTable
                data={ot}
                employees={employees}
                getEmployeeId={(row) => row.employeeId}
                enableEmployeeFilter
                searchColumnId="employee"
                searchPlaceholder="Search…"
                emptyTitle="No overtime"
                emptyDescription={
                  canRequest
                    ? "Submit the first overtime entry on the left."
                    : "No overtime awaiting review."
                }
                columns={otColumns}
              />
            }
          />
        </HrSectionCard>

        {canDecide && !canRequest ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="h-3.5 w-3.5" />
            Manager view — approve or reject pending compensation requests. HR
            submits new items.
          </p>
        ) : null}
      </div>
    </HrPanelShell>
  );
}
