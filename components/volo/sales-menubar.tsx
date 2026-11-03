"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, HandCoins, LogOut, PackageSearch } from "lucide-react";
import { clearSession, type SessionUser } from "@/lib/api";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { WorkspaceTopBar } from "@/components/volo/workspace-top-bar";
import { cn } from "@/lib/utils";

/** Flat sales workspace menus — no dropdowns, no duplicated views. */
const ITEMS = [
  { view: "sales", label: "Sales", icon: HandCoins },
  { view: "orders", label: "Active Orders", icon: PackageSearch },
  { view: "history", label: "History", icon: ClipboardList },
] as const;

const TRIGGER =
  "h-8 gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white";

/**
 * The Sales portal has no sidebar: its menus sit in a right-aligned menubar
 * directly under the top-bar icons. Sign-out is a menu item here because there
 * is no sidebar footer to hold it.
 */
export function SalesMenubar({
  user,
  logoUrl,
  tenantName,
}: {
  user: SessionUser;
  logoUrl?: string;
  tenantName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("view") ?? "sales";
  const view = ITEMS.some((entry) => entry.view === requested) ? requested : "sales";

  return (
    <WorkspaceTopBar
      user={user}
      tenantName={tenantName}
      logoUrl={logoUrl}
      workspaceLabel="Sales"
      sticky
      secondary={
        <div className="mx-auto flex w-full max-w-[1500px] items-center px-4 pb-3 sm:px-6 lg:px-8">
          <Menubar className="ml-auto h-10 rounded-xl border-white/10 bg-white/[0.04] p-1 shadow-inner shadow-black/20 ring-1 ring-white/[0.03]">
            {ITEMS.map((entry) => {
              const active = view === entry.view;
              return (
                <MenubarMenu key={entry.view}>
                  <MenubarTrigger asChild>
                    <Link
                      href={`/sales?view=${entry.view}`}
                      className={cn(TRIGGER, active && "role-nav-active")}
                    >
                      <entry.icon className="size-3.5" />
                      {entry.label}
                    </Link>
                  </MenubarTrigger>
                </MenubarMenu>
              );
            })}

            <MenubarMenu>
              <MenubarTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    router.replace("/");
                  }}
                  className={cn(
                    TRIGGER,
                    "text-rose-300/90 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-200",
                  )}
                >
                  <LogOut className="size-3.5" />
                  Signout
                </button>
              </MenubarTrigger>
            </MenubarMenu>
          </Menubar>
        </div>
      }
    />
  );
}
