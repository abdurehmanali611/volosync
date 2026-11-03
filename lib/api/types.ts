/**
 * Shared type definitions for volosync API client.
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface cloudinarySuccessResult {
  event: "success";
  info: {
    secure_url: string;
  };
}

/** The user object stored in localStorage after login. */
export interface User {
  id: number;
  username: string;
  name: string;
  /** Volosync role: HR, MANAGER, STORE, FINANCE, SALES, OWNER */
  role: string;
  /** Tenant identifier */
  tenant: string;
  tenant_id?: number;
  must_change_password?: boolean;
}

/** Tenant feedback inbox item (stub — not used in volosync). */
export interface TenantFeedbackInbox {
  id: number;
  message: string;
  created_at: string;
}
