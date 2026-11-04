/**
 * Volosync REST API client — replaces the hotcol GraphQL client.
 * All HR and other module API files import { api, API_URL } from here.
 */
import axios from "axios";
import { scheduleSessionExpiredRedirect } from "@/lib/sessionExpiry";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://volosync-backend.vercel.app";

/** Ensure the URL never has a trailing slash. */
export const API_URL = BASE.replace(/\/+$/, "");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("volosync.token");
}

export const api = axios.create({ timeout: 60_000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * An expired token makes every list come back empty, which panels read as
 * "nothing registered yet". Sign the user out instead of faking an empty
 * workspace; a failed sign-in keeps its own message on the login page.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const url = (error as { config?: { url?: string } })?.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login/")) {
      scheduleSessionExpiredRedirect();
    }
    return Promise.reject(error);
  },
);

/** Extracts a user-readable error message from a failed response. */
export function notifyApiFailure(error: unknown, fallback = "Request failed"): void {
  const msg =
    (error as { response?: { data?: { errors?: { message?: string }; detail?: string } } })
      ?.response?.data?.errors?.message ??
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
    (error instanceof Error ? error.message : null) ??
    fallback;
  // Import toast lazily to avoid circular deps.
  import("sonner").then(({ toast }) => toast.error(String(msg)));
}

export function logoutAction(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("volosync.token");
  window.localStorage.removeItem("volosync.user");
  window.location.replace("/");
}

// Stub exports to satisfy imports left over from copied hotcol files.
// These are no-ops in the REST context.
export function invalidateGraphqlListCache(_key?: string): void {}
export function readListCache<T = unknown>(_key: string): T[] | null { return null; }
export function writeListCache<T = unknown>(_key: string, _data: T[]): void {}
export function tenantScopedGraphqlListKey(key: string): string { return key; }
export const GRAPHQL_TIMEOUT_MS = 60_000;
