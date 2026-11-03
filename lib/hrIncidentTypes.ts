export type HrIncidentTypeSetting = {
  code: string;
  label: string;
  /** When true, percent of salary is deducted; when false, credited. */
  deduct: boolean;
  /** 0–100 percent of employee base salary applied on payroll. */
  percentOfSalary: number;
  /**
   * When set, payroll applies percent × matching attendance days in the
   * pay period (days on approved leave are excluded).
   */
  attendanceLink?: "" | "absent" | "late" | "half_day";
  active: boolean;
};

export const HR_ATTENDANCE_LINK_OPTIONS = [
  { id: "" as const, label: "None (manual incidents only)" },
  { id: "absent" as const, label: "Attendance · Absent days" },
  { id: "late" as const, label: "Attendance · Late days" },
  { id: "half_day" as const, label: "Attendance · Half days" },
];

/** Synthetic HR option when Manager has not defined a type named "other". */
export const HR_INCIDENT_ADHOC_OTHER_CODE = "other";

export function slugIncidentTypeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function activeHrIncidentTypes(types: HrIncidentTypeSetting[] = []) {
  return types.filter((t) => t.active);
}

/** True when Manager already configured a type with code `other`. */
export function managerDefinesOtherType(
  types: HrIncidentTypeSetting[] = [],
) {
  return types.some(
    (t) => t.active !== false && t.code === HR_INCIDENT_ADHOC_OTHER_CODE,
  );
}

/**
 * Types HR can pick: manager list, plus synthetic Other unless Manager already
 * named a type "other".
 */
export function hrIncidentTypeChoices(
  types: HrIncidentTypeSetting[] = [],
): HrIncidentTypeSetting[] {
  const active = activeHrIncidentTypes(types);
  if (managerDefinesOtherType(active)) return active;
  return [
    ...active,
    {
      code: HR_INCIDENT_ADHOC_OTHER_CODE,
      label: "Other",
      deduct: false,
      percentOfSalary: 0,
      attendanceLink: "",
      active: true,
    },
  ];
}

export function isAdHocOtherSelection(
  kind: string,
  types: HrIncidentTypeSetting[] = [],
) {
  return (
    kind === HR_INCIDENT_ADHOC_OTHER_CODE &&
    !managerDefinesOtherType(activeHrIncidentTypes(types))
  );
}

export function incidentTypeLabel(
  code: string,
  types: HrIncidentTypeSetting[] = [],
) {
  if (
    code === HR_INCIDENT_ADHOC_OTHER_CODE &&
    !managerDefinesOtherType(types)
  ) {
    return "Other";
  }
  return types.find((t) => t.code === code)?.label || code.replaceAll("_", " ");
}

export function findIncidentType(
  code: string,
  types: HrIncidentTypeSetting[] = [],
) {
  return types.find((t) => t.code === code) || null;
}

export function formatIncidentPayImpact(
  deduct: boolean,
  percentOfSalary: number,
) {
  const pct = Number(percentOfSalary) || 0;
  if (pct <= 0) return "No pay impact";
  const formatted = pct.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  return deduct
    ? `Deduct ${formatted}% of salary`
    : `Credit ${formatted}% of salary`;
}

/** Map API incident type rows onto editor settings (percent preferred). */
export function incidentTypeSettingFromApi(row: {
  code: string;
  label: string;
  deduct: boolean;
  percentOfSalary?: number;
  amountETB?: number;
  attendanceLink?: string;
  active: boolean;
}): HrIncidentTypeSetting {
  return {
    code: row.code,
    label: row.label,
    deduct: Boolean(row.deduct),
    percentOfSalary: Math.max(
      0,
      Math.min(100, Number(row.percentOfSalary) || 0),
    ),
    attendanceLink: (row.attendanceLink || "") as
      | ""
      | "absent"
      | "late"
      | "half_day",
    active: row.active !== false,
  };
}
