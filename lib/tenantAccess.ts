"use client";

import type { ModuleOption } from "@/constants";
import {
  computeSubscriptionPeriodStatus,
  subscriptionAllowsFullSystemAccess,
  type SubscriptionPeriodStatus,
} from "@/lib/subscriptionQuarter";
import { tenantHasModule } from "@/lib/subscriptionModules";
import { parseCafeOrderMode } from "@/lib/cafeOrderMode";
import { readTenantBillingFromStorage, readTenantModulesFromStorage } from "@/lib/tenantModules";
import { isPaymentPortalMode } from "@/lib/tenantAccessMode";

export const TERMINAL_PAGE_MODULES: Record<string, ModuleOption | undefined> = {
  Admin: undefined,
  Manager: undefined,
  Kitchen: "Cafe and Restaurant",
  Barista: "Cafe and Restaurant",
  Cashier: "Cafe and Restaurant",
  Store: "Inventory",
  CostControl: "Financial Management",
  Finance: "Financial Management",
  HotelCashier: "Credit Management",
  Reception: "Room Management",
  CMLeader: "Cleaning and Maintenance",
  HR: "HR Module",
};

export function readSubscriptionBillingSnapshot() {
  return readTenantBillingFromStorage();
}

export function getSubscriptionPeriodStatus(): SubscriptionPeriodStatus {
  return computeSubscriptionPeriodStatus(readSubscriptionBillingSnapshot());
}

export function canUseTenantSystem(): boolean {
  if (isPaymentPortalMode()) return false;
  const status = getSubscriptionPeriodStatus();
  return subscriptionAllowsFullSystemAccess(status);
}

export function canAccessTenantModule(module: ModuleOption): boolean {
  if (!canUseTenantSystem()) return false;
  return tenantHasModule(readTenantModulesFromStorage(), module);
}

export function canAccessTerminalRole(role: string): boolean {
  if (!canUseTenantSystem()) return false;
  const modules = readTenantModulesFromStorage();
  if (
    (role === "Kitchen" || role === "Barista") &&
    parseCafeOrderMode(
      typeof window === "undefined"
        ? "digital"
        : localStorage.getItem("tenant_cafe_order_mode"),
    ) === "analog"
  ) {
    return false;
  }
  // Unified cashier terminal: café POS and/or credit desk.
  if (role === "Cashier" || role === "HotelCashier") {
    return (
      tenantHasModule(modules, "Cafe and Restaurant") ||
      tenantHasModule(modules, "Credit Management")
    );
  }
  const required = TERMINAL_PAGE_MODULES[role];
  if (!required) return true;
  return tenantHasModule(modules, required);
}

export function readLoggedInRole(): string | null {
  if (typeof window === "undefined") return null;
  // Volosync stores session as JSON in "volosync.user"; fall back to "user_role".
  try {
    const raw = localStorage.getItem("volosync.user");
    if (raw) {
      const user = JSON.parse(raw) as { role?: string };
      if (user.role) return user.role;
    }
  } catch {
    // ignore
  }
  const role = localStorage.getItem("user_role")?.trim();
  return role || null;
}

export function isAdminOrManagerRole(role: string | null | undefined): boolean {
  return role === "MANAGER" || role === "OWNER";
}

export function canAccessTenantOwnerPage(): boolean {
  return isAdminOrManagerRole(readLoggedInRole());
}

export function hasAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  // Volosync stores the token under "volosync.token".
  return Boolean(localStorage.getItem("volosync.token")?.trim());
}

function isCashierFamilyRole(role: string): boolean {
  return role === "Cashier" || role === "HotelCashier";
}

/** True when the signed-in staff role matches the terminal (e.g. Cashier on /Cashier). */
export function loggedInRoleMatchesTerminal(terminalRole: string): boolean {
  const logged = readLoggedInRole();
  if (!logged) return false;
  if (logged.toLowerCase() === terminalRole.toLowerCase()) return true;
  // Cashier and legacy HotelCashier are the same staff role.
  if (isCashierFamilyRole(logged) && isCashierFamilyRole(terminalRole)) {
    return true;
  }
  return false;
}

export function subscriptionBlockMessage(status: SubscriptionPeriodStatus): string {
  if (status === "restricted") {
    return "This wholesaler account is restricted. Contact Apex to restore access.";
  }
  if (status === "on_hold") {
    return "Billing is on hold for this wholesaler. Renewals stay frozen until Apex releases the hold.";
  }
  if (status === "trial_ending") {
    return "Your free trial is ending soon. Submit the yearly payment to keep access after it ends.";
  }
  if (status === "trial_expired") {
    return "Your free trial has ended.";
  }
  if (status === "expired") {
    return "Your subscription is ended.";
  }
  if (status === "pending_approval") {
    return "Your payment is awaiting Apex verification. Access unlocks once Apex approves it.";
  }
  if (status === "setup_pending") {
    return "Setup approval is pending. Sign-in unlocks once Apex verifies your payment.";
  }
  return "This wholesaler cannot access the system right now.";
}

export function moduleBlockMessage(module: ModuleOption): string {
  return `"${module}" is not subscribed for this wholesaler. Contact Apex to add the module.`;
}
