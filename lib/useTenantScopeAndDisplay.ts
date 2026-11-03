"use client";

import { useEffect, useState } from "react";
import { readTenantName } from "@/lib/tenantBrand";

function readStoredTenant(fallbackUrl: string): string {
  if (typeof window === "undefined") return fallbackUrl;
  return readTenantName() || fallbackUrl;
}

function readStoredDisplay(): string {
  if (typeof window === "undefined") return "";
  return readTenantName();
}

/**
 * Returns the signed-in tenant's scope and display name from the volosync
 * session (`volosync.user`), with the URL `hotel` param as a fallback only.
 */
export function useTenantScopeAndDisplay(hotelFromUrl: string | null | undefined) {
  const url = (hotelFromUrl ?? "").trim();
  const [tenantScope, setTenantScope] = useState(() => readStoredTenant(url));
  const [displayName, setDisplayName] = useState(() => readStoredDisplay());

  useEffect(() => {
    setTenantScope(readTenantName() || url);
    setDisplayName(readStoredDisplay());
  }, [url]);

  return { tenantScope, displayName };
}
