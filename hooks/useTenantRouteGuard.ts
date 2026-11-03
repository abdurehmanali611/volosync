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
  loggedInRoleMatchesTerminal,
  moduleBlockMessage,
  subscriptionBlockMessage,
} from "@/lib/tenantAccess";
import { isPaymentPortalMode } from "@/lib/tenantAccessMode";
import { refreshTenantSubscription } from "@/lib/actions";
import { clearAuthStorage } from "@/lib/sessionExpiry";

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

    void (async () => {
      try {
        await refreshTenantSubscription();
      } catch {
        // Keep stored snapshot if live refresh fails.
      }
      if (cancelled) return;

      const status = getSubscriptionPeriodStatus();
      if (!canUseTenantSystem()) {
        toast.error(subscriptionBlockMessage(status));
        if (status === "on_hold") {
          clearAuthStorage();
        }
        router.replace("/");
        return;
      }
      if (options?.requiredModule && !canAccessTenantModule(options.requiredModule)) {
        toast.error(moduleBlockMessage(options.requiredModule));
        router.replace("/");
        return;
      }
      if (options?.roles && options.roles.length > 0) {
        const ok = options.roles.some((r) => loggedInRoleMatchesTerminal(r));
        if (!ok) {
          toast.error("You do not have access to this terminal.");
          router.replace("/");
          return;
        }
      } else if (options?.role) {
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
    })();

    return () => {
      cancelled = true;
    };
  }, [options?.requiredModule, options?.role, options?.roles, router]);
}
