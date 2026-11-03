"use client";

export type TenantAccessMode = "full" | "payment_portal";
export type TenantPaymentKind = "setup" | "quarterly" | "yearly";

const ACCESS_MODE_KEY = "tenant_access_mode";
const PAYMENT_KIND_KEY = "tenant_payment_kind";

export function persistTenantAccessMode(
  mode: TenantAccessMode,
  paymentKind?: TenantPaymentKind | null,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_MODE_KEY, mode);
  if (paymentKind) {
    localStorage.setItem(PAYMENT_KIND_KEY, paymentKind);
  } else {
    localStorage.removeItem(PAYMENT_KIND_KEY);
  }
}

export function readTenantAccessMode(): TenantAccessMode {
  if (typeof window === "undefined") return "full";
  const raw = localStorage.getItem(ACCESS_MODE_KEY);
  return raw === "payment_portal" ? "payment_portal" : "full";
}

export function readTenantPaymentKind(): TenantPaymentKind | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PAYMENT_KIND_KEY);
  if (raw === "setup" || raw === "quarterly" || raw === "yearly") return raw;
  return null;
}

export function clearTenantAccessModeStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_MODE_KEY);
  localStorage.removeItem(PAYMENT_KIND_KEY);
}

export function isPaymentPortalMode(): boolean {
  return readTenantAccessMode() === "payment_portal";
}
