/** Subscription banner/notification helpers — yearly billing, hotcol format. */
import {
  computeSubscriptionPeriodStatus,
  formatSubscriptionDateKey,
  freeTrialDaysRemaining,
  pluralDays,
  subscriptionDaysRemaining,
  type SubscriptionBillingSnapshot,
  type SubscriptionPeriodStatus,
} from "@/lib/subscriptionQuarter";

export type SubscriptionNotification = {
  id: string;
  severity: "critical" | "warning";
  priority: "high";
  title: string;
  message: string;
  status: SubscriptionPeriodStatus;
};

export function buildSubscriptionNotifications(
  snap?: SubscriptionBillingSnapshot | null,
  now: Date = new Date(),
): SubscriptionNotification[] {
  if (!snap) return [];
  const status = computeSubscriptionPeriodStatus(snap, now);

  if (status === "trial_ending") {
    const left = freeTrialDaysRemaining(snap, now) ?? 0;
    return [
      {
        id: "trial-ending",
        severity: "warning",
        priority: "high",
        title: "Free trial ending soon",
        message: `Free trial ends in ${pluralDays(left)}. Submit your yearly payment before ${formatSubscriptionDateKey(snap.freeTrialEndsAt)} to keep access.`,
        status,
      },
    ];
  }

  if (status === "warning") {
    const left = subscriptionDaysRemaining(snap, now) ?? 0;
    return [
      {
        id: "subscription-ending",
        severity: "warning",
        priority: "high",
        title: "Yearly subscription ending soon",
        message: `Your yearly subscription ends in ${pluralDays(left)} on ${formatSubscriptionDateKey(snap.subscriptionPaidUntil)}. Renew now — login is blocked the day after it ends.`,
        status,
      },
    ];
  }

  if (status === "trial_expired" || status === "expired") {
    return [
      {
        id: "subscription-expired",
        severity: "critical",
        priority: "high",
        title: "Subscription expired",
        message:
          status === "trial_expired"
            ? "Your free trial has ended. Submit your yearly payment to restore access for every role."
            : "Your subscription is ended. Submit your yearly payment to restore access for every role.",
        status,
      },
    ];
  }

  if (status === "pending_approval") {
    return [
      {
        id: "payment-pending",
        severity: "warning",
        priority: "high",
        title: "Payment awaiting verification",
        message:
          "Apex is verifying your transaction reference. Access unlocks as soon as the payment is approved.",
        status,
      },
    ];
  }

  if (status === "restricted") {
    return [
      {
        id: "account-restricted",
        severity: "critical",
        priority: "high",
        title: "Account restricted",
        message:
          "Apex has restricted this wholesaler account. Contact Apex to restore access.",
        status,
      },
    ];
  }

  if (status === "on_hold") {
    return [
      {
        id: "billing-hold",
        severity: "warning",
        priority: "high",
        title: "Billing on hold",
        message:
          "Renewals are frozen while Apex holds this account's billing. Access stays open until the hold is released.",
        status,
      },
    ];
  }

  return [];
}

export function subscriptionNotificationSummary(
  rows: SubscriptionNotification[],
): string {
  return rows[0]?.title ?? "";
}