/**
 * Volosync REST auth helpers.
 * Exposes `refreshTenantSubscription` (used by useTenantRouteGuard) and
 * `logoutAction` (used by HrDashboard) against the volosync Django backend.
 */
import { api, API_URL, logoutAction } from "./client";
import { persistTenantSubscription } from "../tenantModules";
import type { ModuleOption } from "@/constants";
import type { TenantSubscription } from "../subscriptionModules";

export { logoutAction };

type TenantFlags = {
  module_inventory?: boolean;
  module_hr?: boolean;
} | null;

function modulesFromTenant(tenant: TenantFlags): ModuleOption[] {
  const modules: ModuleOption[] = ["Credentials(Common)"];
  if (tenant?.module_inventory !== false) modules.push("Inventory");
  if (tenant?.module_hr !== false) modules.push("HR Module");
  return modules;
}

function fallbackSubscription(modules: ModuleOption[]): TenantSubscription {
  return {
    modules,
    setupFeeETB: 0,
    quarterlyFeeETB: 0,
    setupFeeApproved: true,
    createdAt: null,
    billingStartedAt: null,
    billingHold: false,
    isIllustrationTenant: true,
    freeTrialEndsAt: null,
    subscriptionPaidUntil: null,
    subscriptionPaymentApproved: true,
    paidQuartersCount: 0,
    awaitingSelfSignupSetup: false,
    paymentTransactionRef: null,
    cafeOrderMode: "digital",
    cafeOrderModeHistory: [],
    cashierCancelOrdersEnabled: false,
    receptionCmPortalEnabled: false,
    waiterOrderingEnabled: false,
    waiterPaymentApprovalEnabled: false,
    hrSoloManagerEnabled: false,
    hrBiometricsEnabled: false,
  };
}

/**
 * Fetches the current tenant subscription from the volosync backend and
 * persists it in localStorage so the route guard can read it synchronously.
 *
 * If the backend has not yet deployed `/api/tenants/subscription/`, the module
 * list is derived from the tenant's `module_inventory` / `module_hr` flags
 * exposed by `/api/tenants/me/`.
 */
export async function refreshTenantSubscription(): Promise<TenantSubscription> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("volosync.token")
      : null;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await api.get<{ data: TenantSubscription }>(
      `${API_URL}/api/tenants/subscription/`,
    );
    const sub = response.data.data;
    persistTenantSubscription(sub);
    return sub;
  } catch (error) {
    let tenant: TenantFlags = null;
    try {
      const me = await api.get<{ data: TenantFlags }>(
        `${API_URL}/api/tenants/me/`,
      );
      tenant = me.data.data;
    } catch {
      throw error;
    }
    if (!tenant) throw error;
    const sub = fallbackSubscription(modulesFromTenant(tenant));
    persistTenantSubscription(sub);
    return sub;
  }
}
