export type HrDepartmentSetting = {
  code: string;
  label: string;
  active: boolean;
};

export function slugHrDepartmentCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function activeHrDepartments(rows: HrDepartmentSetting[] = []) {
  return rows.filter((r) => r.active);
}

export function hrDepartmentLabel(
  code: string,
  rows: HrDepartmentSetting[] = [],
) {
  return rows.find((r) => r.code === code)?.label || code.replaceAll("_", " ");
}
