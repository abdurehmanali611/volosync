"use client";

import {
  HR_APPROVALS_NAV_ITEMS,
  isHrApprovalsTab,
  type HrApprovalsTabId,
} from "@/constants";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronRight, ClipboardCheck } from "lucide-react";

export function HrApprovalsSidebarGroup({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (sectionId: string) => void;
}) {
  const approvalsActive =
    isHrApprovalsTab(activeSection) || activeSection === "hr-manager-pending";

  return (
    <Collapsible defaultOpen={approvalsActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip="Approvals"
            size="lg"
            className="h-10 w-full cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:bg-primary/15 data-[active=true]:text-white"
            isActive={approvalsActive}
          >
            <ClipboardCheck className="opacity-80" />
            <span className="truncate">Approvals</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {HR_APPROVALS_NAV_ITEMS.map(({ id, label }) => (
              <SidebarMenuSubItem key={id}>
                <SidebarMenuSubButton asChild isActive={activeSection === id}>
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="h-9 w-full rounded-lg px-2.5 text-[12.5px] text-zinc-400 hover:bg-white/[0.055] hover:text-white data-[active=true]:text-white"
                  >
                    {label}
                  </button>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function hrApprovalsTabForKind(
  kind: (typeof HR_APPROVALS_NAV_ITEMS)[number]["kind"],
): HrApprovalsTabId {
  const match = HR_APPROVALS_NAV_ITEMS.find((item) => item.kind === kind);
  return match?.id ?? "hr-approvals-terminate";
}
