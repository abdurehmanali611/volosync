/** Tenant identity helpers for copied HR surfaces and PDF exports. */

export type TenantBrand = {
  companyName: string;
  tinNumber: string;
  logoUrl: string | null;
};

type StoredSession = { tenant?: string } | null;

function readSession(): StoredSession {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(
      window.localStorage.getItem("volosync.user") || "null",
    ) as StoredSession;
  } catch {
    return null;
  }
}

/** The signed-in tenant's display name (volosync session, not hotcol keys). */
export function readTenantName(): string {
  return readSession()?.tenant?.trim() || "";
}

export function readTenantBrand(): TenantBrand {
  if (typeof window === "undefined") {
    return { companyName: "Organization", tinNumber: "", logoUrl: null };
  }
  return {
    companyName: readTenantName() || "Organization",
    tinNumber: localStorage.getItem("tenant_tin")?.trim() || "",
    logoUrl: localStorage.getItem("tenant_logo_url")?.trim() || null,
  };
}

/** Cache the tenant identity returned by `/api/tenants/me/` for sync exports. */
export function rememberTenantBrand(
  tenant:
    | { name?: string | null; tin?: string | null; logo_url?: string | null }
    | null
    | undefined,
): void {
  if (typeof window === "undefined" || !tenant) return;
  if (tenant.tin != null) localStorage.setItem("tenant_tin", tenant.tin);
  localStorage.setItem("tenant_logo_url", tenant.logo_url || "");
}
