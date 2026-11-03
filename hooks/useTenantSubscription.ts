"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readTenantSubscriptionFromStorage,
  TENANT_SUBSCRIPTION_CHANGED_EVENT,
} from "@/lib/tenantModules";
import {
  computeSubscriptionPeriodStatus,
  subscriptionAllowsFullSystemAccess,
} from "@/lib/subscriptionQuarter";
import {
  buildSubscriptionNotifications,
  subscriptionNotificationSummary,
} from "@/lib/subscriptionNotifications";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TENANT_SUBSCRIPTION_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TENANT_SUBSCRIPTION_CHANGED_EVENT, callback);
  };
}

function getSnapshot() {
  return JSON.stringify(readTenantSubscriptionFromStorage());
}

function getServerSnapshot() {
  return "{}";
}

export function useTenantSubscriptionState() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    void raw;
    const sub = readTenantSubscriptionFromStorage();
    const status = computeSubscriptionPeriodStatus(sub);
    const notifications = buildSubscriptionNotifications(sub);
    return {
      ...sub,
      status,
      canUseSystem: subscriptionAllowsFullSystemAccess(status),
      notifications,
      summary: subscriptionNotificationSummary(notifications),
    };
  }, [raw]);
}
