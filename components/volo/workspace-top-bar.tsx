"use client";

import { ApexChatButton } from "@/components/volo/apex-chat-button";
import { ManagerMessagesButton } from "@/components/volo/manager-messages-button";
import { NotificationsButton } from "@/components/volo/notifications-button";
import { PasswordKeyButton } from "@/components/volo/password-button";
import { RefreshButton } from "@/components/volo/refresh-button";
import { SubscriptionNotificationCenter } from "@/components/volo/subscription-notification-center";
import { TrialBillingButton } from "@/components/volo/subscription-trial-button";
import { Boxes } from "lucide-react";
import type { SessionUser } from "@/lib/api";
import { isAdminOrManagerRole } from "@/lib/tenantAccess";
import { cn } from "@/lib/utils";

type WorkspaceTopBarProps = {
  user: SessionUser;
  tenantName: string;
  logoUrl?: string;
  workspaceLabel: string;
  sidebarTrigger?: React.ReactNode;
  secondary?: React.ReactNode;
  sticky?: boolean;
};

/**
 * One header for every portal: wholesaler name, support/action icons, then the
 * wholesaler logo. The logo is branding only — sign-out lives in the sidebar
 * footer (or the Sales menu) and the password changer is its own icon here.
 */
export function WorkspaceTopBar({
  user,
  tenantName,
  logoUrl,
  workspaceLabel,
  sidebarTrigger,
  secondary,
  sticky,
}: WorkspaceTopBarProps) {
  return (
    <header
      className={cn(
        "workspace-chrome border-b border-white/5",
        sticky ? "sticky top-0 z-40" : "relative z-30",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4 sm:px-6 md:h-16">
        {sidebarTrigger}

        <div className="flex min-w-0 items-center">
          <span className="truncate font-heading text-[16px] font-semibold tracking-tight text-white">
            {tenantName}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {isAdminOrManagerRole(user.role) && (
            <>
              <TrialBillingButton />
              <SubscriptionNotificationCenter />
            </>
          )}
          {user.role === "MANAGER" && (
            <>
              <ApexChatButton />
              <ManagerMessagesButton />
            </>
          )}
          <NotificationsButton user={user} />
          <RefreshButton />
          <PasswordKeyButton />
          <span
            title={`${tenantName} · ${workspaceLabel} workspace`}
            aria-label={`${tenantName} logo`}
            className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-1"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenantName}
                className="size-full rounded-lg object-contain"
              />
            ) : (
              <span className="role-gradient-bg grid size-full place-items-center rounded-lg text-white">
                <Boxes className="size-4" />
              </span>
            )}
          </span>
        </div>
      </div>

      {secondary}
    </header>
  );
}
