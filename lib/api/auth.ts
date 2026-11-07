/**
 * Volosync REST auth helpers.
 * Exposes `refreshTenantSubscription` (used by the app shell, the payment
 * portal and useTenantRouteGuard) plus `logoutAction`.
 */
import { api, API_URL, logoutAction } from "./client";
import { persistTenantSubscription } from "../tenantModules";
import type { TenantSubscription } from "../subscriptionModules";

export { logoutAction };

/**
 * Fetches the current wholesaler's yearly billing snapshot and persists it in
 * localStorage so the route guard and top-bar alert can read it synchronously.
 *
 * Failures propagate: callers keep the stored snapshot rather than inventing an
 * exempt one, so a network blip never silently switches billing enforcement off.
 */
export async function refreshTenantSubscription(): Promise<TenantSubscription> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("volosync.token")
      : null;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await api.get<{ data: TenantSubscription }>(
    `${API_URL}/api/tenants/subscription/`,
  );
  const sub = response.data.data;
  persistTenantSubscription(sub);
  return sub;
}