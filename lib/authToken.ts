const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_EXPIRES_AT_KEY = "auth_token_expires_at";
// Volosync REST auth key (set by the volosync login page).
const VOLOSYNC_TOKEN_KEY = "volosync.token";

/** Decode JWT `exp` (seconds) to epoch ms; null when missing or invalid. */
export function decodeJwtExpMs(token: string): number | null {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: unknown };
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp <= 0) return null;
    return Math.floor(exp) * 1000;
  } catch {
    return null;
  }
}

export function persistAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  const trimmed = String(token ?? "").trim();
  localStorage.setItem(AUTH_TOKEN_KEY, trimmed);
  const expMs = decodeJwtExpMs(trimmed);
  if (expMs != null) {
    localStorage.setItem(AUTH_TOKEN_EXPIRES_AT_KEY, String(expMs));
  } else {
    localStorage.removeItem(AUTH_TOKEN_EXPIRES_AT_KEY);
  }
}

export function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  return t?.trim() ? t.trim() : null;
}

/** True when stored expiry is in the past (30s clock skew). Unknown expiry → false. */
export function isStoredAuthTokenExpired(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(AUTH_TOKEN_EXPIRES_AT_KEY);
  if (raw == null || raw === "") return false;
  const expMs = Number(raw);
  if (!Number.isFinite(expMs)) return false;
  return Date.now() >= expMs - 30_000;
}

export function clearAuthTokenMetadata(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_EXPIRES_AT_KEY);
}
