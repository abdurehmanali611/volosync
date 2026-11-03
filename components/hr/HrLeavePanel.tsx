"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { DataTable } from "@/app/StoreItems/data-table";
import { Button } from "@/components/ui/button";
import { HotelDayPicker } from "@/components/hotel/HotelDayPicker";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { HrConfirmAction } from "@/components/hr/HrConfirmAction";
import { HrEmployeeCombobox } from "@/components/hr/HrEmployeeCombobox";
import { HrLeaveTypeEditor } from "@/components/hr/HrLeaveTypeEditor";
import { HrOptionCombobox } from "@/components/hr/HrOptionCombobox";
import {
  HrDialogHeader,
  HrEmptyState,
  HrFormSection,
  HrPanelShell,
  HrSectionCard,
  HrStatusBadge,
  HrTableFrame,
  hrFieldClass,
  hrPrimaryBtnClass,
  hrStatusFilterLabelClass,
  hrStatusFilterTriggerClass,
} from "@/components/hr/hrChrome";
import { cn } from "@/lib/utils";
import {
  hrLeaveRequestSchema,
  inclusiveLeaveDays,
  type HrLeaveRequestFormValues,
} from "@/lib/hrConstraints";
import { responsiveFormDialogClassName } from "@/lib/responsiveDialog";
import { notifyApiFailure } from "@/lib/actions";
import { PendingButton } from "@/components/ui/pending-button";
import {
  createHrLeaveRequestApi,
  decideHrLeaveRequestApi,
  fetchHrLeaveTypes,
  type HrEmployee,
  type HrLeaveRequest,
  type HrLeaveType,
} from "@/lib/api/hrSource";
import { Label } from "@/components/ui/label";

type LeaveFilter = "all" | "pending" | "approved" | "rejected";

function stepWaitingLabel(kind: string | undefined) {
  switch (String(kind || "").trim()) {
    case "team_leader":
      return "Waiting on team leader";
    case "department_leader":
      return "Waiting on department leader";
    case "hr":
      return "Waiting on HR";
    case "manager":
      return "Waiting on Manager";
    case "admin":
      return "Waiting on Admin";
    default:
      return "Awaiting next approver";
  }
}

/** HR only acts on the hr step; Manager/Admin can act on any pending row. */
function actorCanDecideLeaveRow(actorRole: string, row: HrLeaveRequest) {
  if (row.status !== "pending") return false;
  const step = String(row.currentStepKind || "").trim();
  if (actorRole === "HR") return step === "hr";
  if (actorRole === "Manager" || actorRole === "Admin") return true;
  return false;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ComboboxOption = { value: string; label: string; hint?: string };

function OptionCombobox({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyText = "No matches.",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.hint || ""} ${o.value}`.toLowerCase();
      return hay.includes(query);
    });
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            hrFieldClass,
            "justify-between font-normal",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate text-left",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((o) => {
                  const on = o.value === value;
                  return (
                    <CommandItem
                      key={o.value}
                      value={`${o.value}-${o.label}`}
                      onSelect={() => {
                        onChange(o.value);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          on ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {o.label}
                        {o.hint ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {o.hint}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function HrLeavePanel({
  leave,
  employees,
  actorRole,
  onRefresh,
}: {
  leave: HrLeaveRequest[];
  employees: HrEmployee[];
  actorRole: string;
  onRefresh: () => Promise<void>;
}) {
  const canConfigureTypes = actorRole === "Manager" || actorRole === "Admin";
  const canFileLeave = actorRole === "HR" || actorRole === "Admin";
  const canApprove =
    actorRole === "Manager" ||
    actorRole === "Admin" ||
    actorRole === "HR";

  const [filter, setFilter] = useState<LeaveFilter>("all");
  const [leaveTypes, setLeaveTypes] = useState<HrLeaveType[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const typeLabels = useMemo(
    () => Object.fromEntries(leaveTypes.map((t) => [t.code, t.label])),
    [leaveTypes],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "terminated"),
    [employees],
  );

  const form = useForm<HrLeaveRequestFormValues>({
    resolver: zodResolver(hrLeaveRequestSchema) as Resolver<HrLeaveRequestFormValues>,
    defaultValues: {
      employeeId: 0,
      leaveType: "",
      fromYmd: todayYmd(),
      toYmd: todayYmd(),
      days: 1,
      reason: "",
    },
  });

  const loadTypes = async () => {
    try {
      const types = await fetchHrLeaveTypes();
      setLeaveTypes(types.filter((t) => t.active));
    } catch {
      setLeaveTypes([]);
    }
  };

  useEffect(() => {
    void loadTypes();
  }, []);

  const filtered = useMemo(
    () => leave.filter((row) => (filter === "all" ? true : row.status === filter)),
    [leave, filter],
  );

  const openCreate = () => {
    const firstEmp = activeEmployees[0];
    const firstType = leaveTypes[0];
    const today = todayYmd();
    form.reset({
      employeeId: firstEmp?.id ?? 0,
      leaveType: firstType?.code ?? "",
      fromYmd: today,
      toYmd: today,
      days: 1,
      reason: "",
    });
    setOpen(true);
  };

  const onSubmit = async (values: HrLeaveRequestFormValues) => {
    setPending(true);
    try {
      await createHrLeaveRequestApi({
        employeeId: values.employeeId,
        leaveType: values.leaveType,
        fromYmd: values.fromYmd,
        toYmd: values.toYmd,
        days: values.days,
        reason: values.reason || undefined,
      });
      toast.success("Leave request submitted for manager approval");
      setOpen(false);
      await onRefresh();
    } catch (e) {
      notifyApiFailure(e, "Could not submit leave request");
    } finally {
      setPending(false);
    }
  };

  const columns = useMemo<ColumnDef<HrLeaveRequest>[]>(
    () => [
      {
        accessorKey: "employee",
        header: "Employee",
        cell: ({ row }) =>
          row.original.employee?.fullName || `#${row.original.employeeId}`,
      },
      {
        accessorKey: "leaveType",
        header: "Type",
        cell: ({ row }) =>
          typeLabels[row.original.leaveType] || row.original.leaveType,
      },
      {
        id: "range",
        header: "Dates",
        cell: ({ row }) =>
          `${row.original.fromYmd} → ${row.original.toYmd} (${row.original.days}d)`,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => row.original.reason || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-0.5">
            <HrStatusBadge status={row.original.status} />
            {row.original.status === "pending" ? (
              <span className="text-[10px] text-muted-foreground">
                {stepWaitingLabel(row.original.currentStepKind)}
              </span>
            ) : null}
          </div>
        ),
      },
      ...(canApprove
        ? [
            {
              id: "actions",
              header: "Decision",
              cell: ({ row }) =>
                actorCanDecideLeaveRow(actorRole, row.original) ? (
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                    <HrConfirmAction
                      title="Approve this leave?"
                      description={`${row.original.employee?.fullName || "Employee"} · ${row.original.fromYmd} to ${row.original.toYmd}. If more steps remain in the flow, the request stays pending until the final approver. Paid leave balance is reduced only on final approval.`}
                      confirmLabel="Approve"
                      trigger={
                        <Button
                          size="sm"
                          className={cn(
                            "h-8 gap-1.5 rounded-lg px-3 font-medium shadow-sm",
                            "bg-emerald-600 text-white hover:bg-emerald-500",
                            "dark:bg-emerald-600 dark:hover:bg-emerald-500",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      }
                      onConfirm={async () => {
                        try {
                          const updated = await decideHrLeaveRequestApi(
                            row.original.id,
                            true,
                          );
                          toast.success(
                            updated.status === "approved"
                              ? "Leave fully approved"
                              : "Step approved — waiting on the next approver",
                          );
                          await onRefresh();
                        } catch (e) {
                          notifyApiFailure(e, "Approve failed");
                        }
                      }}
                    />
                    <HrConfirmAction
                      destructive
                      title="Reject this leave?"
                      description="The request stays on file as rejected and does not change balances."
                      confirmLabel="Reject"
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-8 gap-1.5 rounded-lg px-3 font-medium shadow-sm",
                            "border-rose-500/35 bg-rose-500/5 text-rose-700",
                            "hover:bg-rose-500/12 hover:text-rose-800",
                            "dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300",
                            "dark:hover:bg-rose-500/20 dark:hover:text-rose-200",
                          )}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      }
                      onConfirm={async () => {
                        try {
                          await decideHrLeaveRequestApi(row.original.id, false);
                          toast.success("Leave rejected");
                          await onRefresh();
                        } catch (e) {
                          notifyApiFailure(e, "Reject failed");
                        }
                      }}
                    />
                  </div>
                ) : row.original.status === "pending" ? (
                  <span className="text-xs text-muted-foreground">
                    {stepWaitingLabel(row.original.currentStepKind)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                ),
            } satisfies ColumnDef<HrLeaveRequest>,
          ]
        : []),
    ],
    [actorRole, canApprove, onRefresh, typeLabels],
  );

  return (
    <HrPanelShell>
      {canConfigureTypes ? (
        <HrSectionCard
          title="Leave types"
          description="Manager-configured categories HR uses when filing leave. Default days become the starting balance for new employees."
          icon={
            <CalendarDays className="h-5 w-5" />
          }
          accent="bg-linear-to-r from-primary via-violet-400 to-violet-400/80"
        >
          <HrLeaveTypeEditor />
        </HrSectionCard>
      ) : null}

      <HrSectionCard
        title="Leave queue"
        description={
          canApprove
            ? "Approve or reject pending leave. Approving paid leave reduces the matching balance."
            : "File leave for employees here. HR, Manager, or Admin reviews each request."
        }
        icon={<CalendarDays className="h-5 w-5" />}
        accent="bg-linear-to-r from-primary via-primary to-violet-400/80"
        actions={
          canFileLeave ? (
            <Button
              onClick={openCreate}
              disabled={!activeEmployees.length}
              className={hrPrimaryBtnClass}
            >
              <Plus className="mr-2 h-4 w-4" />
              File leave
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="w-full max-w-56 space-y-1.5">
              <Label
                className={cn(
                  "text-xs font-medium",
                  hrStatusFilterLabelClass(filter),
                )}
              >
                Status
              </Label>
              <HrOptionCombobox
                value={filter}
                onChange={(v) => setFilter(v as LeaveFilter)}
                options={[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
                placeholder="Filter status…"
                emptyText="No statuses."
                className={hrStatusFilterTriggerClass(filter)}
              />
            </div>
          </div>
          {filtered.length ? (
            <HrTableFrame>
              <DataTable
                embedded columns={columns}
                data={filtered}
                searchPlaceholder="Search leave…"
                emptyMessage="No leave in this filter."
                pageSize={8}
              />
            </HrTableFrame>
          ) : (
            <HrEmptyState
              title="No leave requests yet"
              description={
                canFileLeave
                  ? "Use File leave to submit a request for an employee. It stays pending until the manager decides."
                  : "HR files leave requests for employees. They appear here for approval."
              }
            />
          )}
        </div>
      </HrSectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={responsiveFormDialogClassName}>
          <HrDialogHeader
            title="File leave request"
            description="Submit leave on behalf of an employee. The manager will approve or reject it."
          />
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <HrFormSection title="Request details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <FormControl>
                          <HrEmployeeCombobox
                            employees={activeEmployees}
                            valueIds={field.value ? [field.value] : []}
                            onChange={(ids) =>
                              field.onChange(ids[0] ?? 0)
                            }
                            placeholder="Search employee…"
                            emptyText="No employees found."
                            triggerClassName={hrFieldClass}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leaveType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leave type</FormLabel>
                        <FormControl>
                          <OptionCombobox
                            value={field.value || ""}
                            onChange={field.onChange}
                            options={leaveTypes.map((type) => ({
                              value: type.code,
                              label: type.label,
                              hint: type.code,
                            }))}
                            placeholder="Search leave type…"
                            emptyText="No leave types found."
                            disabled={!leaveTypes.length}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromYmd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From</FormLabel>
                        <FormControl>
                          <HotelDayPicker
                            value={field.value}
                            onChange={(fromYmd) => {
                              const toYmd = form.getValues("toYmd");
                              field.onChange(fromYmd);
                              form.setValue(
                                "days",
                                inclusiveLeaveDays(fromYmd, toYmd) || 1,
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toYmd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To</FormLabel>
                        <FormControl>
                          <HotelDayPicker
                            value={field.value}
                            onChange={(toYmd) => {
                              const fromYmd = form.getValues("fromYmd");
                              field.onChange(toYmd);
                              form.setValue(
                                "days",
                                inclusiveLeaveDays(fromYmd, toYmd) || 1,
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="days"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2 mx-auto w-full max-w-40 text-center">
                        <FormLabel>Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0.5}
                            step={0.5}
                            className={cn(hrFieldClass, "text-center tabular-nums")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-24 border-primary/20 bg-background focus-visible:border-primary/50 focus-visible:ring-primary/25"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </HrFormSection>
              <PendingButton
                type="submit"
                pending={pending}
                className={cn("h-11 w-full", hrPrimaryBtnClass)}
                disabled={!leaveTypes.length}
              >
                Submit for approval
              </PendingButton>
              {!leaveTypes.length ? (
                <p className="text-center text-sm text-muted-foreground">
                  Ask the manager to configure leave types first.
                </p>
              ) : null}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </HrPanelShell>
  );
}
