"use client";

import {
  HR_PAYROLL_NAV_ITEMS,
  type HrPayrollView,
  isHrPayrollTab,
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
import { ChevronRight, Wallet } from "lucide-react";

export function HrPayrollSidebarGroup({
  activeSection,
  onSelect,
  visibleViews,
}: {
  activeSection: string;
  onSelect: (sectionId: string) => void;
  /** Which payroll nested items to show (role-gated). */
  visibleViews: readonly HrPayrollView[];
}) {
  const items = HR_PAYROLL_NAV_ITEMS.filter((item) =>
    visibleViews.includes(item.view),
  );
  if (items.length === 0) return null;

  const payrollActive = isHrPayrollTab(activeSection);

  return (
    <Collapsible defaultOpen={payrollActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip="Payroll"
            size="lg"
            className="h-10 w-full cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:bg-primary/15 data-[active=true]:text-white"
            isActive={payrollActive}
          >
            <Wallet className="opacity-80" />
            <span className="truncate">Payroll</span>
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map(({ id, label }) => (
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

export function hrPayrollViewsForCaps(caps: {
  canRunPayroll: boolean;
  canConfigurePayroll: boolean;
  canViewPayrollReport: boolean;
}): HrPayrollView[] {
  if (!caps.canViewPayrollReport) return [];
  const views: HrPayrollView[] = [];
  if (caps.canRunPayroll) views.push("generate");
  views.push("runs");
  if (caps.canConfigurePayroll) views.push("settings");
  views.push("history");
  return views;
}

export function hrPayrollTabForView(
  view: HrPayrollView,
): (typeof HR_PAYROLL_NAV_ITEMS)[number]["id"] {
  const match = HR_PAYROLL_NAV_ITEMS.find((item) => item.view === view);
  return match?.id ?? "hr-payroll-runs";
}
