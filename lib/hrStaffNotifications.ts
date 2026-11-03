/** Client helpers for the staff HR notification bell. */

import {
  fetchHrNotificationsApi,
  markHrNotificationReadApi,
  type HrNotification,
} from "@/lib/api/hrSource";

export type HrStaffNotification = HrNotification;

export async function listHrStaffNotifications(unreadOnly?: boolean) {
  return fetchHrNotificationsApi(unreadOnly);
}

export async function markHrStaffNotificationRead(id: number) {
  return markHrNotificationReadApi(id);
}

export function hrNotificationSectionFromHref(href: string): string | null {
  try {
    const url = new URL(href, "http://local");
    return url.searchParams.get("section");
  } catch {
    return null;
  }
}
