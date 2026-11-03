/** Detect GraphQL PENDING_MANAGER_APPROVAL so UI can toast success instead of error. */
export function isPendingManagerApprovalError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as {
    message?: string;
    graphQLErrors?: Array<{ extensions?: { code?: string }; message?: string }>;
    extensions?: { code?: string };
  };
  if (anyErr.extensions?.code === "PENDING_MANAGER_APPROVAL") return true;
  if (
    Array.isArray(anyErr.graphQLErrors) &&
    anyErr.graphQLErrors.some(
      (g) => g?.extensions?.code === "PENDING_MANAGER_APPROVAL",
    )
  ) {
    return true;
  }
  const msg = String(anyErr.message || "");
  return /submitted for manager approval/i.test(msg);
}

export function pendingManagerApprovalMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Submitted for Manager approval.";
  }
  const anyErr = err as {
    message?: string;
    graphQLErrors?: Array<{ message?: string }>;
  };
  const fromGql = anyErr.graphQLErrors?.[0]?.message;
  return String(fromGql || anyErr.message || "Submitted for Manager approval.");
}
