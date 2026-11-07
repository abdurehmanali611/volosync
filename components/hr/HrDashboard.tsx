"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Toaster } from "sonner";
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  FileText,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTenantRouteGuard } from "@/hooks/useTenantRouteGuard";
import { SubscriptionNotificationCenter } from "@/components/volo/subscription-notification-center";
import { useTenantScopeAndDisplay } from "@/lib/useTenantScopeAndDisplay";
import { isAdminOrManagerRole, readLoggedInRole } from "@/lib/tenantAccess";
import { api as volosyncApi } from "@/lib/api";
import { rememberTenantBrand } from "@/lib/tenantBrand";
import { logoutAction, notifyApiFailure } from "@/lib/actions";
import { ChangeOwnPasswordButton } from "@/components/ChangeOwnPasswordButton";
import { RefreshIconButton } from "@/components/ui/refresh-icon-button";
import { HotelWorkflowGlossary } from "@/components/hotel/HotelWorkflowGlossary";
import { hrCapabilities, hrRoleDisplayLabel } from "@/lib/hrCapabilities";
import { HR_SECTION_COPY, HrPageHero } from "@/components/hr/hrChrome";
import { HrOverviewPanel } from "@/components/hr/HrOverviewPanel";
import { HrEmployeesPanel } from "@/components/hr/HrEmployeesPanel";
import { HrLeavePanel } from "@/components/hr/HrLeavePanel";
import { HrAttendancePanel } from "@/components/hr/HrAttendancePanel";
import { HrDocumentsPanel } from "@/components/hr/HrDocumentsPanel";
import { HrShiftTemplatesPanel } from "@/components/hr/HrShiftTemplatesPanel";
import { HrChecklistsPanel } from "@/components/hr/HrChecklistsPanel";
import { HrCompensationPanel } from "@/components/hr/HrCompensationPanel";
import { HrPeopleOpsPanel } from "@/components/hr/HrPeopleOpsPanel";
import { HrPayrollPanel } from "@/components/hr/HrPayrollPanel";
import {
  HrPayrollSidebarGroup,
  hrPayrollTabForView,
  hrPayrollViewsForCaps,
} from "@/components/hr/HrPayrollSidebarGroup";
import { HrApprovalsSidebarGroup } from "@/components/hr/HrApprovalsSidebarGroup";
import { HrIncidentsPanel } from "@/components/hr/HrIncidentsPanel";
import { HrDepartmentsPanel } from "@/components/hr/HrDepartmentsPanel";
import { HrOtpResetApprovalPanel } from "@/components/hr/HrOtpResetApprovalPanel";
import { HrManagerPendingPanel } from "@/components/hr/HrManagerPendingPanel";
import { HrNotificationCenter } from "@/components/hr/HrNotificationCenter";
import { HrApprovalConfigPanel } from "@/components/hr/HrApprovalConfigPanel";
import type { HrPayrollView } from "@/constants";
import {
  hrApprovalsKindFromSection,
  hrPayrollViewFromTab,
  isHrApprovalsSection,
  HR_APPROVALS_NAV_ITEMS,
} from "@/constants";
import {
  fetchHrAttendance,
  fetchHrDashboardStats,
  fetchHrEmployees,
  fetchHrIncidents,
  fetchHrLeaveRequests,
  fetchHrLibraryDocuments,
  fetchHrPayrollPeriods,
  fetchHrPayslips,
  fetchHrShifts,
  type HrAttendance,
  type HrDashboardStats,
  type HrEmployee,
  type HrIncident,
  type HrLeaveRequest,
  type HrLibraryDocument,
  type HrPayrollPeriod,
  type HrPayslip,
  type HrShift,
} from "@/lib/api/hrSource";

export type HrSection =
  | "dashboard"
  | "employees"
  | "leave"
  | "attendance"
  | "documents"
  | "shift-templates"
  | "checklists"
  | "compensation"
  | "people-ops"
  | "payroll-generate"
  | "payroll-runs"
  | "payroll-settings"
  | "payroll-history"
  | "incidents"
  | "departments"
  | "otp-reset"
  | "manager-pending"
  | "approvals-terminate"
  | "approvals-attendance"
  | "approvals-payroll"
  | "workflows";

const PAYROLL_SECTIONS = new Set<HrSection>([
  "payroll-generate",
  "payroll-runs",
  "payroll-settings",
  "payroll-history",
]);

const APPROVALS_SECTIONS = new Set<HrSection>([
  "manager-pending",
  "approvals-terminate",
  "approvals-attendance",
  "approvals-payroll",
]);

export function isHrPayrollSection(section: string): section is HrSection {
  return PAYROLL_SECTIONS.has(section as HrSection);
}

export function isHrApprovalsDashboardSection(
  section: string,
): section is HrSection {
  return APPROVALS_SECTIONS.has(section as HrSection);
}

export function payrollViewFromSection(section: HrSection): HrPayrollView | null {
  switch (section) {
    case "payroll-generate":
      return "generate";
    case "payroll-runs":
      return "runs";
    case "payroll-settings":
      return "settings";
    case "payroll-history":
      return "history";
    default:
      return null;
  }
}

function sectionFromPayrollView(view: HrPayrollView): HrSection {
  switch (view) {
    case "generate":
      return "payroll-generate";
    case "runs":
      return "payroll-runs";
    case "settings":
      return "payroll-settings";
    case "history":
      return "payroll-history";
  }
}

/** Map REST role codes (HR / MANAGER) to the HR workspace's display roles. */
function normalizeActorRole(raw: string | null): string {
  const value = (raw || "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  if (upper === "MANAGER") return "Manager";
  if (upper === "ADMIN" || upper === "OWNER") return "Admin";
  return value;
}

const NAV: { id: HrSection; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "employees", label: "Employees", icon: Users },
  { id: "otp-reset", label: "OTP resets", icon: KeyRound },
  { id: "workflows", label: "Workflows", icon: GitBranch },
  { id: "leave", label: "Leave", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: ClipboardList },
  { id: "shift-templates", label: "Shift templates", icon: CalendarRange },
  { id: "checklists", label: "Checklists", icon: CheckSquare },
  { id: "compensation", label: "Compensation", icon: Banknote },
  { id: "people-ops", label: "People ops", icon: Briefcase },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "departments", label: "Departments", icon: Building2 },
];

function navForRole(role: string) {
  const caps = hrCapabilities(role);
  return NAV.filter((item) => {
    if (item.id === "employees") return caps.canManageEmployees;
    if (item.id === "departments") return caps.canConfigureDepartments;
    if (item.id === "otp-reset") {
      return role === "Manager" || role === "Admin";
    }
    if (item.id === "workflows") {
      return role === "Manager" || role === "Admin";
    }
    return true;
  }).map((item) => {
    if (item.id === "leave" && role === "Manager") {
      return { ...item, label: "Leave types" };
    }
    if (item.id === "incidents" && role === "Manager") {
      return { ...item, label: "Incident types" };
    }
    return item;
  });
}

function canSeeApprovals(role: string) {
  return role === "Manager" || role === "Admin";
}

function payrollSectionsForRole(role: string): HrSection[] {
  return hrPayrollViewsForCaps(hrCapabilities(role)).map(sectionFromPayrollView);
}

function approvalsSectionsForRole(role: string): HrSection[] {
  if (!canSeeApprovals(role)) return [];
  return [
    "manager-pending",
    ...HR_APPROVALS_NAV_ITEMS.map((item) => item.section as HrSection),
  ];
}

export function HrDashboard({
  embedded = false,
  section: sectionProp,
}: {
  embedded?: boolean;
  section?: HrSection;
}) {
  useTenantRouteGuard({
    requiredModule: "HR Module",
    roles: embedded ? undefined : ["HR", "Admin", "Manager"],
  });
  const searchParams = useSearchParams();
  const { displayName } = useTenantScopeAndDisplay(searchParams.get("hotel"));
  const [tenantLogo, setTenantLogo] = useState("");
  const logoUrl = tenantLogo;

  const [internalSection, setInternalSection] = useState<HrSection>("dashboard");
  const section = sectionProp ?? internalSection;
  const setSection = useCallback((next: HrSection) => {
    if (!sectionProp) setInternalSection(next);
  }, [sectionProp]);
  const showEmbeddedTabs = embedded && !sectionProp;
  const copy = HR_SECTION_COPY[section] ?? HR_SECTION_COPY.dashboard;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<HrDashboardStats | null>(null);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [leave, setLeave] = useState<HrLeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<HrAttendance[]>([]);
  const [shifts, setShifts] = useState<HrShift[]>([]);
  const [docs, setDocs] = useState<HrLibraryDocument[]>([]);
  const [periods, setPeriods] = useState<HrPayrollPeriod[]>([]);
  const [payslips, setPayslips] = useState<HrPayslip[]>([]);
  const [incidents, setIncidents] = useState<HrIncident[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [actorRole, setActorRole] = useState("");
  const headerLabel = displayName || hrRoleDisplayLabel(actorRole) || "HR";
  const caps = useMemo(() => hrCapabilities(actorRole), [actorRole]);
  const navItems = useMemo(() => navForRole(actorRole), [actorRole]);

  useEffect(() => {
    try {
      setActorRole(normalizeActorRole(readLoggedInRole()));
    } catch {
      setActorRole("");
    }
  }, []);

  /**
   * `/hr` is rendered outside the `(app)` shell, so it has to publish its own
   * role palette for `--role-1/--role-2` (HR uses the Manager purple palette).
   */
  useEffect(() => {
    if (embedded) return;
    const root = document.documentElement;
    const previous = root.dataset.role;
    root.dataset.role = "HR";
    return () => {
      if (previous) root.dataset.role = previous;
      else delete root.dataset.role;
    };
  }, [embedded]);

  useEffect(() => {
    let cancelled = false;
    void volosyncApi
      .tenantMe()
      .then((res) => {
        if (cancelled || !res.data) return;
        setTenantLogo(res.data.logo_url?.trim() || "");
        rememberTenantBrand(res.data);
      })
      .catch(() => {
        // Keep the initials fallback when tenant branding is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sectionProp) return;
    const fromUrl = searchParams.get("section")?.trim();
    if (!fromUrl) return;
    const allowed = new Set<string>([
      "dashboard",
      "employees",
      "leave",
      "attendance",
      "documents",
      "shift-templates",
      "checklists",
      "compensation",
      "people-ops",
      "payroll-generate",
      "payroll-runs",
      "payroll-settings",
      "payroll-history",
      "incidents",
      "departments",
      "otp-reset",
      "manager-pending",
      "approvals-terminate",
      "approvals-attendance",
      "approvals-payroll",
      "workflows",
    ]);
    if (allowed.has(fromUrl)) {
      setInternalSection(fromUrl as HrSection);
    }
  }, [searchParams, sectionProp]);

  useEffect(() => {
    if (!actorRole) return;
    const allowed = new Set<HrSection>([
      ...navForRole(actorRole).map((n) => n.id),
      ...payrollSectionsForRole(actorRole),
      ...approvalsSectionsForRole(actorRole),
    ]);
    if (!allowed.has(section)) {
      setSection("dashboard");
    }
  }, [actorRole, section, setSection]);

  const loadAll = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const [st, emps, lv, att, sh, documents, pr, inc] = await Promise.all([
        fetchHrDashboardStats(),
        fetchHrEmployees(),
        fetchHrLeaveRequests(),
        fetchHrAttendance(),
        fetchHrShifts(),
        fetchHrLibraryDocuments(),
        fetchHrPayrollPeriods(),
        fetchHrIncidents(),
      ]);
      setStats(st);
      setEmployees(emps);
      setLeave(lv);
      setAttendance(att);
      setShifts(sh);
      setDocs(documents);
      setPeriods(pr);
      setIncidents(inc);
      setSelectedPeriodId((current) => current ?? pr[0]?.id ?? null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("hotcol-hr-refresh"));
      }
    } catch (e) {
      notifyApiFailure(e, "Could not load HR data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedPeriodId == null) {
      setPayslips([]);
      return;
    }
    void fetchHrPayslips(selectedPeriodId)
      .then(setPayslips)
      .catch((e) => notifyApiFailure(e, "Could not load payslips"));
  }, [selectedPeriodId]);

  const panel = loading ? (
    <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading HR workspace…
    </div>
  ) : (
    <>
      {section === "dashboard" && stats ? (
        <HrOverviewPanel
          stats={stats}
          employees={employees}
          leave={leave}
          shifts={shifts}
        />
      ) : null}
      {section === "employees" && caps.canManageEmployees ? (
        <HrEmployeesPanel
          employees={employees}
          onRefresh={() => loadAll(true)}
        />
      ) : null}
      {section === "otp-reset" &&
      (actorRole === "Manager" || actorRole === "Admin") ? (
        <HrOtpResetApprovalPanel />
      ) : null}
      {isHrApprovalsDashboardSection(section) &&
      (actorRole === "Manager" || actorRole === "Admin") ? (
        <HrManagerPendingPanel
          kindFilter={hrApprovalsKindFromSection(section)}
        />
      ) : null}
      {section === "workflows" &&
      (actorRole === "Manager" || actorRole === "Admin") ? (
        <HrApprovalConfigPanel />
      ) : null}
      {section === "leave" ? (
        <HrLeavePanel
          leave={leave}
          employees={employees}
          actorRole={actorRole}
          onRefresh={() => loadAll(true)}
        />
      ) : null}
      {section === "attendance" ? (
        <HrAttendancePanel
          employees={employees}
          attendance={attendance}
          shifts={shifts}
          onRefresh={() => loadAll(true)}
          canManageTime={caps.canManageTime}
        />
      ) : null}
      {section === "documents" ? (
        <HrDocumentsPanel
          documents={docs}
          canUpload={caps.canManageEmployees || actorRole === "HR"}
          onRefresh={() => loadAll(true)}
        />
      ) : null}
      {section === "shift-templates" ? (
        <HrShiftTemplatesPanel
          canManage={actorRole === "Manager" || actorRole === "Admin"}
        />
      ) : null}
      {section === "checklists" ? (
        <HrChecklistsPanel
          employees={employees}
          canManageTemplates={actorRole === "Manager" || actorRole === "Admin"}
          canApproveExit={actorRole === "Manager" || actorRole === "Admin"}
          canRunChecklists={actorRole === "HR" || actorRole === "Admin"}
        />
      ) : null}
      {section === "compensation" ? (
        <HrCompensationPanel
          employees={employees}
          canRequest={caps.canManageEmployees || actorRole === "HR"}
          canDecide={actorRole === "Manager" || actorRole === "Admin"}
        />
      ) : null}
      {section === "people-ops" ? (
        <HrPeopleOpsPanel
          employees={employees}
          canRequest={caps.canManageEmployees || actorRole === "HR"}
          canDecide={actorRole === "Manager" || actorRole === "Admin"}
          canManageAssets={actorRole === "Manager" || actorRole === "Admin"}
        />
      ) : null}
      {isHrPayrollSection(section) && caps.canViewPayrollReport ? (
        <HrPayrollPanel
          view={payrollViewFromSection(section)!}
          periods={periods}
          payslips={payslips}
          selectedPeriodId={selectedPeriodId}
          onSelectedPeriodChange={setSelectedPeriodId}
          onPayslipsChange={setPayslips}
          onRefresh={() => loadAll(true)}
          employees={employees}
          canRunPayroll={caps.canRunPayroll}
          canConfigurePayroll={caps.canConfigurePayroll}
          canApprovePayrollPayment={caps.canApprovePayrollPayment}
        />
      ) : null}
      {section === "incidents" ? (
        <HrIncidentsPanel
          employees={employees}
          incidents={incidents}
          actorRole={actorRole}
          onRefresh={() => loadAll(true)}
        />
      ) : null}
      {section === "departments" && caps.canConfigureDepartments ? (
        <HrDepartmentsPanel />
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-6">
        {showEmbeddedTabs ? (
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={section === item.id ? "default" : "outline"}
                className={
                  section === item.id
                    ? "border-primary bg-primary text-white hover:bg-primary/90"
                    : "border-primary/30 hover:bg-primary/10"
                }
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <RefreshIconButton
              busy={refreshing}
              disabled={loading}
              onClick={() => void loadAll(true)}
            />
          </div>
        ) : null}
        {panel}
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <SidebarProvider className="app-shell-bg">
        <div className="flex min-h-svh w-full text-foreground">
          <Sidebar collapsible="icon" className="role-sidebar-surface">
            <SidebarHeader className="gap-2 p-3">
              <div className="group flex items-center gap-2.5 rounded-xl px-1 py-1">
                {logoUrl ? (
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-1.5 shadow-[0_14px_32px_-16px_var(--role-1)] ring-1 ring-white/10 transition-transform group-hover:scale-[1.04]">
                    <img src={logoUrl} alt="HR" className="size-full object-contain" />
                  </span>
                ) : (
                  <span className="role-gradient-bg grid size-10 shrink-0 place-items-center rounded-2xl text-white shadow-[0_14px_32px_-14px_var(--role-1)] ring-1 ring-white/20 transition-transform group-hover:scale-[1.04]">
                    <Users className="size-5" />
                  </span>
                )}
                <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="block font-heading text-[15px] font-semibold tracking-tight text-white">
                    VoloSync
                  </span>
                  <span className="role-text block truncate text-[9px] font-semibold tracking-[0.22em] uppercase">
                    HR portal
                  </span>
                </span>
              </div>
            </SidebarHeader>
            <div className="role-hairline mx-3 shrink-0 opacity-50" />
            <SidebarContent className="flex-1 gap-0 px-2 pb-4 pt-2">
              <SidebarMenu className="gap-1">
                {navItems
                  .filter((item) =>
                    item.id === "dashboard" ||
                    item.id === "employees" ||
                    item.id === "otp-reset",
                  )
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={section === item.id}
                          onClick={() => setSection(item.id)}
                          tooltip={item.label}
                          size="lg"
                          className="h-10 w-full cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:bg-primary/15 data-[active=true]:font-medium data-[active=true]:text-white data-[active=true]:shadow-sm"
                        >
                          <Icon className="opacity-80" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                {canSeeApprovals(actorRole) ? (
                  <HrApprovalsSidebarGroup
                    activeSection={
                      isHrApprovalsSection(section)
                        ? HR_APPROVALS_NAV_ITEMS.find((i) => i.section === section)
                            ?.id ??
                          (section === "manager-pending"
                            ? "hr-approvals-terminate"
                            : "")
                        : ""
                    }
                    onSelect={(id) => {
                      const match = HR_APPROVALS_NAV_ITEMS.find((i) => i.id === id);
                      if (match) setSection(match.section as HrSection);
                    }}
                  />
                ) : null}
                {navItems
                  .filter((item) =>
                    item.id === "workflows" ||
                    item.id === "leave" ||
                    item.id === "attendance" ||
                    item.id === "checklists" ||
                    item.id === "compensation" ||
                    item.id === "people-ops" ||
                    item.id === "documents",
                  )
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={section === item.id}
                          onClick={() => setSection(item.id)}
                          tooltip={item.label}
                          size="lg"
                          className="h-10 w-full cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:bg-primary/15 data-[active=true]:font-medium data-[active=true]:text-white data-[active=true]:shadow-sm"
                        >
                          <Icon className="opacity-80" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                {caps.canViewPayrollReport ? (
                  <HrPayrollSidebarGroup
                    activeSection={
                      payrollViewFromSection(section)
                        ? hrPayrollTabForView(payrollViewFromSection(section)!)
                        : ""
                    }
                    onSelect={(id) => {
                      const view = hrPayrollViewFromTab(id);
                      if (view) setSection(sectionFromPayrollView(view));
                    }}
                    visibleViews={hrPayrollViewsForCaps(caps)}
                  />
                ) : null}
                {navItems
                  .filter((item) => item.id === "incidents" || item.id === "departments")
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={section === item.id}
                          onClick={() => setSection(item.id)}
                          tooltip={item.label}
                          size="lg"
                          className="h-10 w-full cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:bg-primary/15 data-[active=true]:font-medium data-[active=true]:text-white data-[active=true]:shadow-sm"
                        >
                          <Icon className="opacity-80" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="border-t border-white/5 p-4 pt-2">
              <Button
                variant="ghost"
                className="w-full cursor-pointer justify-start gap-2 text-zinc-400 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => logoutAction()}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </Button>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="app-frame relative flex min-h-svh min-w-0 flex-1 flex-col overflow-hidden">
            <header className="workspace-chrome sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-white/5 px-3 md:h-16 md:px-6">
              <SidebarTrigger className="-ml-1 shrink-0 text-zinc-400 hover:bg-white/[0.06] hover:text-white" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xs font-medium uppercase tracking-wider text-white/70 md:text-sm">
                  {headerLabel}
                </h1>
              </div>
              {isAdminOrManagerRole(readLoggedInRole() ?? "") && (
                <SubscriptionNotificationCenter />
              )}
              <RefreshIconButton
                busy={refreshing}
                disabled={loading}
                onClick={() => void loadAll(true)}
              />
              <HrNotificationCenter
                onNavigateSection={(next) => {
                  if (next === "manager-pending") {
                    setSection("approvals-terminate");
                    return;
                  }
                  setSection(next as HrSection);
                }}
              />
              <ChangeOwnPasswordButton />
              <Avatar className="h-8 w-8 border border-white/15 shadow-sm">
                <AvatarImage src={logoUrl || undefined} alt={headerLabel} />
                <AvatarFallback className="text-[10px] font-semibold">
                  {headerLabel.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6 [scrollbar-gutter:stable]">
              <div className="mx-auto max-w-6xl space-y-8 pb-10">
                <HrPageHero title={copy.title} description={copy.description}>
                  <HotelWorkflowGlossary variant="manager" topic="hr" />
                </HrPageHero>
                {panel}
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </>
  );
}
