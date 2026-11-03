/**
 * Pay-path readiness: bank name + account + base salary > 0.
 * Incomplete employees stay on ESS but are excluded from payroll / bank export.
 */
export function isHrEmployeePayrollReady(employee: {
  bankName?: string | null;
  accountNumber?: string | null;
  baseSalaryETB?: number | null;
}): boolean {
  const bank = String(employee?.bankName ?? "").trim();
  const account = String(employee?.accountNumber ?? "").trim();
  const salary = Number(employee?.baseSalaryETB);
  return Boolean(bank && account && Number.isFinite(salary) && salary > 0);
}
