/** Days per billing year — volosync bills yearly, never quarterly. */
export const SUBSCRIPTION_YEAR_DAYS = 365;

/** Warn this many days before a free trial ends. */
export const TRIAL_PAYMENT_WINDOW_DAYS = 10;
/** Warn this many days before a paid year ends. */
export const SUBSCRIPTION_WARNING_DAYS = 7;

export type SubscriptionPeriodStatus =
  | "exempt"
  | "on_hold"
  | "restricted"
  | "trial"
  | "trial_ending"
  | "trial_expired"
  | "setup_pending"
  | "pending_approval"
  | "active"
  | "warning"
  | "expired";

export type SubscriptionBillingSnapshot = {
  setupFeeETB: number;
  quarterlyFeeETB: number;
  /** The console's yearly price — what the payment portal asks for. */
  annualFeeETB?: number;
  setupFeeApproved: boolean;
  subscriptionPaymentApproved: boolean;
  createdAt: string | null;
  billingStartedAt: string | null;
  billingHold: boolean;
  isIllustrationTenant: boolean;
  /** ACTIVE | SUSPENDED | BANNED | DELETED, set by Apex in the console. */
  accountStatus?: string;
  freeTrialEndsAt: string | null;
  subscriptionPaidUntil: string | null;
  paidQuartersCount: number;
  /** A yearly payment is sitting in Apex's queue awaiting verification. */
  paymentPending?: boolean;
  /** Set at login — true only for /SignUp tenants awaiting Apex setup approval. */
  awaitingSelfSignupSetup?: boolean;
  paymentTransactionRef?: string | null;
};

export function subscriptionBillingApplies(snap: SubscriptionBillingSnapshot): boolean {
  return !snap.isIllustrationTenant;
}

export function parseSubscriptionDate(raw: string | null | undefined): Date | null {
  if (raw == null || String(raw).trim() === "") return null;
  const text = String(raw).trim();
  // A bare calendar date must stay on that date in local time, not shift a
  // day behind for anyone west of UTC.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysBetweenCalendar(start: Date, end: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function freeTrialDaysRemaining(
  snap: SubscriptionBillingSnapshot,
  now: Date = new Date(),
): number | null {
  const end = parseSubscriptionDate(snap.freeTrialEndsAt);
  if (!end) return null;
  return daysBetweenCalendar(now, end);
}

export function subscriptionDaysRemaining(
  snap: SubscriptionBillingSnapshot,
  now: Date = new Date(),
): number | null {
  const end = parseSubscriptionDate(snap.subscriptionPaidUntil);
  if (!end) return null;
  return daysBetweenCalendar(now, end);
}

/**
 * Yearly standing, mirroring BackEnd/billing/access.py.
 *
 * A paid year wins over an old trial date, so an approved renewal clears a
 * trial that has since ended. There is no grace period: a yearly subscription
 * warns 7 days out and blocks the login on its final day.
 */
export function computeSubscriptionPeriodStatus(
  snap: SubscriptionBillingSnapshot,
  now: Date = new Date(),
): SubscriptionPeriodStatus {
  if (!subscriptionBillingApplies(snap)) return "exempt";
  if ((snap.accountStatus ?? "ACTIVE") !== "ACTIVE") return "restricted";
  // A hold freezes renewals without revoking access.
  if (snap.billingHold) return "on_hold";

  // An active free trial is the current billing window: it governs access and
  // its own 10-day warning, even when the tenant row also carries the yearly
  // renewal date the console stamps at signup. Checking the paid date first
  // (the old behaviour) hid every trial warning on those tenants.
  const trialLeft = freeTrialDaysRemaining(snap, now);
  if (trialLeft !== null && trialLeft >= 0) {
    return trialLeft <= TRIAL_PAYMENT_WINDOW_DAYS ? "trial_ending" : "trial";
  }

  const daysLeft = subscriptionDaysRemaining(snap, now);
  if (daysLeft !== null) {
    if (daysLeft <= 0) return snap.paymentPending ? "pending_approval" : "expired";
    return daysLeft <= SUBSCRIPTION_WARNING_DAYS ? "warning" : "active";
  }

  // A trial that ended with no paid year on record blocks access. An approved
  // renewal writes a future paid date, so it wins and retires the old trial.
  if (trialLeft !== null) {
    return snap.paymentPending ? "pending_approval" : "trial_expired";
  }

  // Neither a trial nor a paid year on record: nothing to enforce yet.
  return "exempt";
}

export function subscriptionAllowsFullSystemAccess(
  status: SubscriptionPeriodStatus,
): boolean {
  return (
    status === "exempt" ||
    status === "on_hold" ||
    status === "trial" ||
    status === "trial_ending" ||
    status === "active" ||
    status === "warning"
  );
}

export function subscriptionAllowsSystemAccess(
  status: SubscriptionPeriodStatus,
): boolean {
  return subscriptionAllowsFullSystemAccess(status);
}

export function formatSubscriptionDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatSubscriptionDateKey(raw: string | null | undefined): string {
  const d = parseSubscriptionDate(raw);
  return d ? formatSubscriptionDate(d) : "—";
}

export function subscriptionAmountDueETB(
  snap: SubscriptionBillingSnapshot,
  years = 1,
): number {
  return (Number(snap.annualFeeETB) || 0) * years;
}

export function pluralDays(count: number): string {
  return `${count} day${Math.abs(count) === 1 ? "" : "s"}`;
}
