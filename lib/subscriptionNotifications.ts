/** Subscription banner/notification helpers. */
import type { SubscriptionPeriodStatus } from "@/lib/subscriptionQuarter";

export type SubscriptionNotification = {
  id: string;
  severity: "critical" | "warning";
  priority: "high";
  title: string;
  message: string;
  status: SubscriptionPeriodStatus;
};

export function buildSubscriptionNotifications(
  _snap?: unknown,
  _now?: Date,
): SubscriptionNotification[] {
  return [];
}

export function subscriptionNotificationSummary(
  rows: SubscriptionNotification[],
): string {
  return rows[0]?.title ?? "";
}

export function getSubscriptionRenewalNotice(): string | null {
  return null;
}
