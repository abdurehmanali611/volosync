"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readTenantModulesFromStorage,
  TENANT_SUBSCRIPTION_CHANGED_EVENT,
} from "@/lib/tenantModules";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TENANT_SUBSCRIPTION_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TENANT_SUBSCRIPTION_CHANGED_EVENT, callback);
  };
}

function getSnapshot() {
  return JSON.stringify(readTenantModulesFromStorage());
}

function getServerSnapshot() {
  return "[]";
}

export function useTenantModules() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    void raw;
    return readTenantModulesFromStorage();
  }, [raw]);
}
