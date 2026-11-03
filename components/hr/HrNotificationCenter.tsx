"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVisibleInterval } from "@/hooks/useVisibleInterval";
import {
  listHrStaffNotifications,
  markHrStaffNotificationRead,
  type HrStaffNotification,
} from "@/lib/hrStaffNotifications";

const POLL_MS = 15000;

type Props = {
  /** When set, navigate within HR shell instead of full page load. */
  onNavigateSection?: (section: string) => void;
};

function sectionFromHref(href: string): string | null {
  try {
    const url = new URL(href, "http://local");
    const fromQuery = url.searchParams.get("section");
    if (fromQuery) return fromQuery;
  } catch {
    /* fall through */
  }
  // Backend sometimes stores a bare section key (e.g. "manager-pending").
  const bare = href.trim();
  if (/^[a-z][a-z0-9-]*$/i.test(bare)) return bare;
  return null;
}

export function HrNotificationCenter({ onNavigateSection }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HrStaffNotification[]>([]);

  const load = useCallback(async () => {
    try {
      const next = await listHrStaffNotifications();
      setRows(next);
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    // Initial fetch; polling is handled by useVisibleInterval below.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch into local notification list
    void load();
  }, [load]);

  useVisibleInterval(() => {
    void load();
  }, POLL_MS);

  const unread = rows.filter((r) => !r.readAt).length;

  const openItem = async (row: HrStaffNotification) => {
    try {
      if (!row.readAt) {
        await markHrStaffNotificationRead(row.id);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not mark notification read",
      );
    }
    const href = String(row.href || "").trim();
    const section = href ? sectionFromHref(href) : null;
    setOpen(false);
    if (section && onNavigateSection) {
      onNavigateSection(section);
    } else if (href) {
      router.push(href);
    }
    await load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label="HR notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1.5 -top-1.5 h-5 min-w-5 px-1 text-[10px]"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-1.5rem,22rem)] p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">
            Approvals and HR messages for your role.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/80 ${
                      row.readAt ? "opacity-70" : ""
                    }`}
                    onClick={() => void openItem(row)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {row.title}
                      </p>
                      {!row.readAt ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    {row.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {row.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {row.kind.replace(/_/g, " ")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
