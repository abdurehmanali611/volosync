"use client";

import type { ModuleOption } from "@/constants";
import {
  parseCafeOrderMode,
  parseCafeOrderModeHistory,
  type CafeOrderMode,
  type CafeOrderModeHistoryEntry,
} from "@/lib/cafeOrderMode";
import {
  parseModulesJson,
  tenantHasModule,
  type TenantSubscription,
} from "@/lib/subscriptionModules";
import type { SubscriptionBillingSnapshot } from "@/lib/subscriptionQuarter";

const MODULES_KEY = "tenant_modules";
const SETUP_KEY = "tenant_setup_fee_etb";
const QUARTERLY_KEY = "tenant_quarterly_fee_etb";
const SETUP_APPROVED_KEY = "tenant_setup_fee_approved";
const CREATED_AT_KEY = "tenant_created_at";
const BILLING_STARTED_KEY = "tenant_billing_started_at";
const BILLING_HOLD_KEY = "tenant_billing_hold";
const ILLUSTRATION_KEY = "tenant_is_illustration";
const FREE_TRIAL_KEY = "tenant_free_trial_ends_at";
const PAID_UNTIL_KEY = "tenant_subscription_paid_until";
const PAYMENT_APPROVED_KEY = "tenant_subscription_payment_approved";
const PAID_QUARTERS_KEY = "tenant_paid_quarters_count";
const AWAITING_SELF_SIGNUP_KEY = "tenant_awaiting_self_signup_setup";
const PAYMENT_REF_KEY = "tenant_payment_transaction_ref";
const CAFE_ORDER_MODE_KEY = "tenant_cafe_order_mode";
const CAFE_ORDER_MODE_HISTORY_KEY = "tenant_cafe_order_mode_history";
const CASHIER_CANCEL_ORDERS_KEY = "tenant_cashier_cancel_orders";
const RECEPTION_CM_PORTAL_KEY = "tenant_reception_cm_portal_enabled";
const WAITER_ORDERING_KEY = "tenant_waiter_ordering_enabled";
const WAITER_PAYMENT_APPROVAL_KEY = "tenant_waiter_payment_approval_enabled";

export const TENANT_SUBSCRIPTION_CHANGED_EVENT =
  "hotcol-tenant-subscription-changed";

function notifyTenantSubscriptionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TENANT_SUBSCRIPTION_CHANGED_EVENT));
}

export function persistTenantSubscription(sub: TenantSubscription): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODULES_KEY, JSON.stringify(sub.modules));
  localStorage.setItem(SETUP_KEY, String(sub.setupFeeETB));
  localStorage.setItem(QUARTERLY_KEY, String(sub.quarterlyFeeETB));
  localStorage.setItem(
    SETUP_APPROVED_KEY,
    sub.setupFeeApproved ? "1" : "0",
  );
  localStorage.setItem(CREATED_AT_KEY, sub.createdAt ?? "");
  localStorage.setItem(BILLING_STARTED_KEY, sub.billingStartedAt ?? "");
  localStorage.setItem(BILLING_HOLD_KEY, sub.billingHold ? "1" : "0");
  localStorage.setItem(ILLUSTRATION_KEY, sub.isIllustrationTenant ? "1" : "0");
  localStorage.setItem(FREE_TRIAL_KEY, sub.freeTrialEndsAt ?? "");
  localStorage.setItem(PAID_UNTIL_KEY, sub.subscriptionPaidUntil ?? "");
  localStorage.setItem(
    PAYMENT_APPROVED_KEY,
    sub.subscriptionPaymentApproved ? "1" : "0",
  );
  localStorage.setItem(PAID_QUARTERS_KEY, String(sub.paidQuartersCount ?? 0));
  localStorage.setItem(
    AWAITING_SELF_SIGNUP_KEY,
    sub.awaitingSelfSignupSetup ? "1" : "0",
  );
  localStorage.setItem(PAYMENT_REF_KEY, sub.paymentTransactionRef ?? "");
  localStorage.setItem(CAFE_ORDER_MODE_KEY, parseCafeOrderMode(sub.cafeOrderMode));
  localStorage.setItem(
    CAFE_ORDER_MODE_HISTORY_KEY,
    JSON.stringify(
      parseCafeOrderModeHistory(
        sub.cafeOrderModeHistory,
        parseCafeOrderMode(sub.cafeOrderMode),
        sub.createdAt,
      ),
    ),
  );
  localStorage.setItem(
    CASHIER_CANCEL_ORDERS_KEY,
    sub.cashierCancelOrdersEnabled ? "1" : "0",
  );
  localStorage.setItem(
    RECEPTION_CM_PORTAL_KEY,
    sub.receptionCmPortalEnabled ? "1" : "0",
  );
  localStorage.setItem(
    WAITER_ORDERING_KEY,
    sub.waiterOrderingEnabled ? "1" : "0",
  );
  localStorage.setItem(
    WAITER_PAYMENT_APPROVAL_KEY,
    sub.waiterPaymentApprovalEnabled ? "1" : "0",
  );
  notifyTenantSubscriptionChanged();
}

export function readTenantModulesFromStorage(): ModuleOption[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MODULES_KEY);
    if (!raw) return [];
    return parseModulesJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readTenantBillingFromStorage(): SubscriptionBillingSnapshot {
  if (typeof window === "undefined") {
    return {
      setupFeeETB: 0,
      quarterlyFeeETB: 0,
      setupFeeApproved: true,
      subscriptionPaymentApproved: true,
      createdAt: null,
      billingStartedAt: null,
      billingHold: false,
      isIllustrationTenant: false,
      freeTrialEndsAt: null,
      subscriptionPaidUntil: null,
      paidQuartersCount: 0,
      awaitingSelfSignupSetup: false,
      paymentTransactionRef: null,
    };
  }
  return {
    setupFeeETB: Number(localStorage.getItem(SETUP_KEY) ?? 0) || 0,
    quarterlyFeeETB: Number(localStorage.getItem(QUARTERLY_KEY) ?? 0) || 0,
    setupFeeApproved: localStorage.getItem(SETUP_APPROVED_KEY) !== "0",
    subscriptionPaymentApproved:
      localStorage.getItem(PAYMENT_APPROVED_KEY) === "1",
    createdAt: localStorage.getItem(CREATED_AT_KEY) || null,
    billingStartedAt: localStorage.getItem(BILLING_STARTED_KEY) || null,
    billingHold: localStorage.getItem(BILLING_HOLD_KEY) === "1",
    isIllustrationTenant: localStorage.getItem(ILLUSTRATION_KEY) === "1",
    freeTrialEndsAt: localStorage.getItem(FREE_TRIAL_KEY) || null,
    subscriptionPaidUntil: localStorage.getItem(PAID_UNTIL_KEY) || null,
    paidQuartersCount: Number(localStorage.getItem(PAID_QUARTERS_KEY) ?? 0) || 0,
    awaitingSelfSignupSetup:
      localStorage.getItem(AWAITING_SELF_SIGNUP_KEY) === "1",
    paymentTransactionRef: localStorage.getItem(PAYMENT_REF_KEY) || null,
  };
}

export function readCafeOrderModeFromStorage(): CafeOrderMode {
  if (typeof window === "undefined") return "digital";
  return parseCafeOrderMode(localStorage.getItem(CAFE_ORDER_MODE_KEY));
}

export function readCafeOrderModeHistoryFromStorage(): CafeOrderModeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  let raw: unknown = [];
  try {
    raw = JSON.parse(localStorage.getItem(CAFE_ORDER_MODE_HISTORY_KEY) || "[]");
  } catch {
    raw = [];
  }
  return parseCafeOrderModeHistory(
    raw,
    readCafeOrderModeFromStorage(),
    localStorage.getItem(CREATED_AT_KEY) || null,
  );
}

export function readCashierCancelOrdersEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CASHIER_CANCEL_ORDERS_KEY) === "1";
}

export function readReceptionCmPortalEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(RECEPTION_CM_PORTAL_KEY) === "1";
}

export function readWaiterOrderingEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(WAITER_ORDERING_KEY) === "1";
}

export function readWaiterPaymentApprovalEnabledFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(WAITER_PAYMENT_APPROVAL_KEY) === "1";
}

export function readTenantSubscriptionFromStorage(): TenantSubscription {
  const modules = readTenantModulesFromStorage();
  const billing = readTenantBillingFromStorage();
  return {
    modules,
    ...billing,
    cafeOrderMode: readCafeOrderModeFromStorage(),
    cafeOrderModeHistory: readCafeOrderModeHistoryFromStorage(),
    cashierCancelOrdersEnabled: readCashierCancelOrdersEnabledFromStorage(),
    receptionCmPortalEnabled: readReceptionCmPortalEnabledFromStorage(),
    waiterOrderingEnabled: readWaiterOrderingEnabledFromStorage(),
    waiterPaymentApprovalEnabled:
      readWaiterPaymentApprovalEnabledFromStorage(),
  };
}

export function hasTenantModule(required: ModuleOption): boolean {
  return tenantHasModule(readTenantModulesFromStorage(), required);
}

export function clearTenantSubscriptionStorage(): void {
  if (typeof window === "undefined") return;
  for (const k of [
    MODULES_KEY,
    SETUP_KEY,
    QUARTERLY_KEY,
    SETUP_APPROVED_KEY,
    CREATED_AT_KEY,
    BILLING_STARTED_KEY,
    BILLING_HOLD_KEY,
    ILLUSTRATION_KEY,
    FREE_TRIAL_KEY,
    PAID_UNTIL_KEY,
    PAYMENT_APPROVED_KEY,
    PAID_QUARTERS_KEY,
    AWAITING_SELF_SIGNUP_KEY,
    PAYMENT_REF_KEY,
    CAFE_ORDER_MODE_KEY,
    CAFE_ORDER_MODE_HISTORY_KEY,
    CASHIER_CANCEL_ORDERS_KEY,
    RECEPTION_CM_PORTAL_KEY,
    WAITER_ORDERING_KEY,
    WAITER_PAYMENT_APPROVAL_KEY,
  ]) {
    localStorage.removeItem(k);
  }
  notifyTenantSubscriptionChanged();
}
