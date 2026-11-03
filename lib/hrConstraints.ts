import { z } from "zod";
import {
  HOTEL_DEPARTMENT_CODES,
  type HotelDepartmentCode,
} from "@/lib/departments";
import { isLodgingBusinessType, type BusinessType } from "@/constants";

export const HR_WAGE_TYPES = ["monthly", "weekly"] as const;
export const HR_LEAVE_TYPES = ["annual", "sick", "unpaid"] as const;
export const HR_DOC_TYPES = ["contract", "id", "certificate", "other"] as const;
export const HR_INCIDENT_KINDS = [
  "warning",
  "complaint",
  "commendation",
  "other",
] as const;
export const HR_EMPLOYEE_STATUSES = ["active", "on_leave", "terminated"] as const;

export const CAFE_HR_DEPARTMENT_CODES = [
  "KITCHEN",
  "BAR",
  "FB_SERVICE",
  "STORE",
  "PURCHASER",
  "FINANCE",
  "HR",
  "GM",
  "SECURITY",
  "MAINTENANCE",
] as const satisfies readonly HotelDepartmentCode[];

const ymdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

const hhmmSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time (HH:MM)");

const optionalPhone = z
  .string()
  .trim()
  .refine((s) => !s || s.replace(/\D/g, "").length >= 8, {
    message: "Phone must be at least 8 digits when provided",
  });

const optionalEmail = z.union([
  z.literal(""),
  z.string().trim().email("Enter a valid email"),
]);

const hrEmployeeBaseFields = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Name is too long"),
  phone: optionalPhone,
  email: optionalEmail.optional(),
  department: z.string().min(1, "Select a department"),
  jobTitle: z
    .string()
    .trim()
    .max(80, "Job title is too long")
    .optional()
    .or(z.literal("")),
  orgPosition: z.enum(["leader", "employee"]).default("employee"),
  teamId: z.coerce.number().optional().nullable(),
  wageType: z.enum(HR_WAGE_TYPES, { message: "Select a wage type" }),
  baseSalaryETB: z.coerce
    .number({ message: "Enter a valid salary" })
    .min(0, "Salary cannot be negative")
    .max(10_000_000, "Salary is too high"),
  bankName: z
    .string()
    .trim()
    .max(80, "Bank name is too long")
    .optional()
    .or(z.literal("")),
  accountNumber: z
    .string()
    .trim()
    .max(40, "Account number is too long")
    .optional()
    .or(z.literal("")),
  hireDate: ymdSchema,
  notes: z.string().max(500, "Notes are too long").optional().or(z.literal("")),
  gender: z.enum(["male", "female"]).optional().or(z.literal("")),
  education: z.string().trim().max(80).optional().or(z.literal("")),
  personalTin: z.string().trim().max(40).optional().or(z.literal("")),
  yearsExperience: z.coerce
    .number({ message: "Enter years of experience" })
    .int("Use a whole number")
    .min(0, "Cannot be negative")
    .max(80, "Too high")
    .default(0),
  medicalNote: z.string().max(4000).optional().or(z.literal("")),
});

/** Align with hotcol-ats candidate Apply form. */
export const HR_EDUCATION_LEVELS = [
  { value: "high_school", label: "High school" },
  { value: "certificate", label: "Certificate / vocational" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelor", label: "Bachelor’s degree" },
  { value: "master", label: "Master’s or higher" },
  { value: "other", label: "Other" },
] as const;

export const HR_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const hrEmployeeFormSchema = hrEmployeeBaseFields;
export const hrEmployeeCreateFormSchema = hrEmployeeFormSchema;
export const hrEmployeeEditFormSchema = hrEmployeeFormSchema;

export const hrLeaveBalanceSchema = z.object({
  employeeId: z.coerce.number().min(1, "Select an employee"),
  leaveType: z.string().trim().min(1, "Select a leave type"),
  balanceDays: z.coerce
    .number({ message: "Enter leave days" })
    .min(0, "Balance cannot be negative")
    .max(366, "Balance cannot exceed a year"),
});

export const hrLeaveRequestSchema = z
  .object({
    employeeId: z.coerce.number().min(1, "Select an employee"),
    leaveType: z.string().trim().min(1, "Select a leave type"),
    fromYmd: ymdSchema,
    toYmd: ymdSchema,
    days: z.coerce
      .number({ message: "Enter leave days" })
      .min(0.5, "Leave must be at least half a day")
      .max(366, "Leave span is too long"),
    reason: z
      .string()
      .trim()
      .max(500, "Reason is too long")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.toYmd < data.fromYmd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date",
        path: ["toYmd"],
      });
    }
    const span = inclusiveLeaveDays(data.fromYmd, data.toYmd);
    if (span > 0 && data.days > span) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Days cannot exceed the selected range (${span})`,
        path: ["days"],
      });
    }
  });

export const hrClockSchema = z.object({
  employeeId: z.coerce.number().min(1, "Select an employee"),
});

export const hrShiftFormSchema = z
  .object({
    employeeId: z.coerce.number().min(1, "Select an employee"),
    workDate: ymdSchema,
    department: z.string().trim().max(80).optional().or(z.literal("")),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
  })
  .refine((data) => data.startTime !== data.endTime, {
    message: "Start and end time cannot be the same",
    path: ["endTime"],
  });

export const hrDocumentFormSchema = z.object({
  employeeId: z.coerce.number().min(1, "Select an employee"),
  title: z
    .string()
    .trim()
    .min(2, "Document title is required")
    .max(160, "Title is too long"),
  docType: z.enum(HR_DOC_TYPES, { message: "Select a document type" }),
  fileUrl: z
    .string()
    .trim()
    .max(500, "File link is too long")
    .refine((s) => !s || /^https?:\/\//i.test(s) || s.startsWith("/"), {
      message: "Enter a valid file URL, or leave blank",
    }),
});

export const hrIncidentFormSchema = z.object({
  employeeId: z.coerce.number().min(1, "Select an employee"),
  kind: z
    .string()
    .trim()
    .min(1, "Select an incident type")
    .max(40, "Incident type code is too long"),
  title: z
    .string()
    .trim()
    .min(2, "Title is required")
    .max(160, "Title is too long"),
  detail: z.string().trim().max(2000, "Detail is too long").optional().or(z.literal("")),
  occurredYmd: ymdSchema,
  salaryDeduct: z.boolean().optional(),
  percentOfSalary: z.coerce
    .number({ message: "Enter a valid percent" })
    .min(0, "Percent cannot be negative")
    .max(100, "Percent cannot exceed 100")
    .optional(),
});

export const hrPayslipAdjustSchema = z.object({
  tipsETB: z.coerce
    .number({ message: "Enter a valid tip amount" })
    .min(0, "Tips cannot be negative")
    .max(10_000_000, "Tips amount is too high"),
  overtimeETB: z.coerce
    .number({ message: "Enter a valid overtime amount" })
    .min(0, "Overtime cannot be negative")
    .max(10_000_000, "Overtime amount is too high")
    .optional(),
  deductionsETB: z.coerce
    .number({ message: "Enter a valid deduction" })
    .min(0, "Deductions cannot be negative")
    .max(10_000_000, "Deduction is too high")
    .optional(),
});

export const hrPayrollPeriodSchema = z
  .object({
    periodKey: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM"),
    fromYmd: ymdSchema,
    toYmd: ymdSchema,
  })
  .refine((data) => data.toYmd >= data.fromYmd, {
    message: "Period end must be on or after the start",
    path: ["toYmd"],
  });

export type HrEmployeeFormValues = z.infer<typeof hrEmployeeFormSchema>;
export type HrLeaveRequestFormValues = z.infer<typeof hrLeaveRequestSchema>;

export function firstHrConstraintMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "Check the form and try again";
}

export function parseHrConstraint<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; message: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, message: firstHrConstraintMessage(result.error) };
}

export function inclusiveLeaveDays(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T00:00:00`);
  const to = new Date(`${toYmd}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return 0;
  }
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

export function firstYmdOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function lastYmdOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const last = new Date(year, month, 0);
  const mm = String(last.getMonth() + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return `${last.getFullYear()}-${mm}-${dd}`;
}

export function hrDepartmentCodesForBusiness(
  businessType: string | null | undefined,
): readonly HotelDepartmentCode[] {
  if (
    businessType &&
    isLodgingBusinessType(businessType as BusinessType)
  ) {
    return HOTEL_DEPARTMENT_CODES;
  }
  return CAFE_HR_DEPARTMENT_CODES;
}

export const HR_WAGE_LABELS: Record<(typeof HR_WAGE_TYPES)[number], string> = {
  monthly: "Monthly",
  weekly: "Weekly",
};

export const HR_LEAVE_LABELS: Record<(typeof HR_LEAVE_TYPES)[number], string> = {
  annual: "Annual",
  sick: "Sick",
  unpaid: "Unpaid",
};

export const HR_DOC_LABELS: Record<(typeof HR_DOC_TYPES)[number], string> = {
  contract: "Contract",
  id: "ID",
  certificate: "Certificate",
  other: "Other",
};

export const HR_INCIDENT_LABELS: Record<
  (typeof HR_INCIDENT_KINDS)[number],
  string
> = {
  warning: "Warning",
  complaint: "Complaint",
  commendation: "Commendation",
  other: "Other",
};

export const HR_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  open: "Open",
  closed: "Closed",
  pending_generate: "Awaiting manager",
  awaiting_manager: "Awaiting close",
  unpaid: "Unpaid",
  awaiting_finance: "Awaiting Finance",
  marked_paid: "Marked paid",
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
};

export function hrStatusLabel(status: string): string {
  return HR_STATUS_LABELS[status] || status.replaceAll("_", " ");
}
