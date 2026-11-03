import { SUBSCRIPTION_QUARTER_DAYS } from "@/lib/subscriptionQuarter";

export const SUBSCRIPTION_YEAR_DAYS = SUBSCRIPTION_QUARTER_DAYS * 4;

const LODGING_TYPES = new Set(["Hotel", "Resort", "Pension"]);

export function isLodgingBusinessType(businessType: string | null | undefined): boolean {
  return businessType != null && LODGING_TYPES.has(String(businessType).trim());
}

export function subscriptionRenewalPaymentKind(
  businessType: string | null | undefined,
): "quarterly" | "yearly" {
  return isLodgingBusinessType(businessType) ? "yearly" : "quarterly";
}

export function subscriptionRenewalAmountETB(
  quarterlyFeeETB: number,
  businessType: string | null | undefined,
): number {
  const q = Number(quarterlyFeeETB) || 0;
  return isLodgingBusinessType(businessType) ? q * 4 : q;
}

export function readBusinessTypeFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("business_type")?.trim();
  return raw || null;
}
