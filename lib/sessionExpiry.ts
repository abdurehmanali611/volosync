/**
 * Session expiry helpers for volosync (REST, not GraphQL).
 * Clears volosync.token / volosync.user and redirects to login.
 */
import { toast } from "sonner";

const LOGIN_PATH = "/";
const TOAST_ID = "volosync-session-expired";

let redirectScheduled = false;

export function resetSessionExpiryGuard(): void {
  redirectScheduled = false;
}

/** Clears all volosync auth keys from localStorage. */
export function clearAuthStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("volosync.token");
  localStorage.removeItem("volosync.user");
  // Also clear any hotcol-compat keys that might be present.
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_token_expires_at");
  localStorage.removeItem("user_role");
  localStorage.removeItem("tenant_modules");
  localStorage.removeItem("tenant_billing");
  localStorage.removeItem("tenant_access_mode");
}

export function scheduleSessionExpiredRedirect(): void {
  if (typeof window === "undefined") return;
  if (redirectScheduled) return;
  redirectScheduled = true;
  toast.error("Your session has expired. Please sign in again.", {
    id: TOAST_ID,
    duration: 8000,
  });
  clearAuthStorage();
  window.setTimeout(() => {
    window.location.href = LOGIN_PATH;
  }, 1600);
}

export class SessionExpiredError extends Error {
  readonly isSessionExpired = true;
  constructor() {
    super("SESSION_EXPIRED");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(e: unknown): e is SessionExpiredError {
  return e instanceof SessionExpiredError;
}

// Stub GraphQL-specific helpers (kept for import compatibility with copied files).
export function graphqlMessageIndicatesPermissionDenied(_raw: string): boolean {
  return false;
}
export function graphqlMessageIndicatesSessionExpiry(_raw: string): boolean {
  return false;
}
export function graphqlErrorsIndicateSessionExpiry(
  _errors: Array<{ message?: string }> | undefined,
): boolean {
  return false;
}
