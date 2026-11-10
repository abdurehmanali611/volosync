"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ModuleOption } from "@/constants";
import {
  canAccessTenantModule,
  canAccessTerminalRole,
  canUseTenantSystem,
  getSubscriptionPeriodStatus,
  hasAuthToken,
  isAdminOrManagerRole,
  loggedInRoleMatchesTerminal,
  moduleBlockMessage,
  readLoggedInRole,
  subscriptionBlockMessage,
} from "@/lib/tenantAccess";
import {
  isPaymentPortalMode,
  persistTenantAccessMode,
} from "@/lib/tenantAccessMode";
import { refreshTenantSubscription } from "@/lib/actions";
import { clearAuthStorage } from "@/lib/sessionExpiry";
import { TENANT_SUBSCRIPTION_CHANGED_EVENT } from "@/lib/tenantModules";

/** Redirect home if subscription or module access is denied. */
export function useTenantRouteGuard(options?: {
  requiredModule?: ModuleOption;
  role?: string;
  /** Allow any of these terminal roles (e.g. HR page for HR | Admin | Manager). */
  roles?: string[];
}) {
  const router = useRouter();

  useEffect(() => {
    if (!hasAuthToken()) {
      router.replace("/");
      return;
    }

    if (isPaymentPortalMode()) {
      router.replace("/PaymentVerification");
      return;
    }

    let cancelled = false;

    const check = () => {
      const status = getSubscriptionPeriodStatus();
      if (!canUseTenantSystem()) {
        // A manager still gets the payment portal; every other role is just
        // told the subscription ended and sent back to the login screen.
        if (isAdminOrManagerRole(readLoggedInRole())) {
          persistTenantAccessMode("payment_portal", "yearly");
          router.replace("/PaymentVerification");
          return;
        }
        toast.error(subscriptionBlockMessage(status));
        clearAuthStorage();
        router.replace("/");
        return;
      }
      if (options?.requiredModule && !canAccessTenantModule(options.requiredModule)) {
        toast.error(moduleBlockMessage(options.requiredModule));
        router.replace(isAdminOrManagerRole(readLoggedInRole()) ? "/manager" : "/");
        return;
      }
      if (options?.roles && options.roles.length > 0) {
        const ok = options.roles.some((r) => loggedInRoleMatchesTerminal(r));
        if (!ok) {
          toast.error("You do not have access to this terminal.");
          router.replace("/");
        }
        return;
      }
      if (options?.role) {
        if (!canAccessTerminalRole(options.role)) {
          toast.error("This terminal is not included in your property subscription.");
          router.replace("/");
          return;
        }
        if (!loggedInRoleMatchesTerminal(options.role)) {
          toast.error("You do not have access to this terminal.");
          router.replace("/");
        }
      }
    };

    void (async () => {
      try {
        await refreshTenantSubscription();
      } catch {
        // Keep stored snapshot if live refresh fails.
      }
      if (!cancelled) check();
    })();

    // Apex can add/remove modules mid-session: re-check the stored snapshot
    // without re-fetching (the refresh itself dispatches this event).
    const onChanged = () => {
      if (!cancelled) check();
    };
    window.addEventListener(TENANT_SUBSCRIPTION_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(TENANT_SUBSCRIPTION_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, [options?.requiredModule, options?.role, options?.roles, router]);
}
