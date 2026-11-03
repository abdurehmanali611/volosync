"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChevronRight, LogOut } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  api,
  clearSession,
  getUser,
  roleHome,
  ROLE_ROOTS,
  type SessionUser,
  type TenantInfo,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  isNavActive,
  navFor,
  portalRole,
  ROLE_META,
  type NavChild,
} from "@/components/volo/nav";
import { SalesMenubar } from "@/components/volo/sales-menubar";
import { WorkspaceTopBar } from "@/components/volo/workspace-top-bar";

function containsView(child: NavChild, view: string | null): boolean {
  if (!view) return false;
  if (child.view === view) return true;
  return Boolean(child.children?.some((entry) => containsView(entry, view)));
}

function NavSubTree({
  children,
  currentView,
  openGroups,
  onOpenChange,
}: {
  children: NavChild[];
  currentView: string | null;
  openGroups: Record<string, boolean>;
  onOpenChange: (href: string, open: boolean) => void;
}) {
  return (
    <>
      {children.map((child) => {
        if (child.children) {
          const active = containsView(child, currentView);
          const open = openGroups[child.href] ?? active;
          return (
            <Collapsible
              key={child.href}
              open={open}
              onOpenChange={(next) => onOpenChange(child.href, next)}
              className="group/subnav"
            >
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton
                    asChild
                    isActive={active}
                    className={cn(
                      "h-9 w-full cursor-pointer rounded-lg px-2.5 text-[12.5px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white",
                      active && "font-medium text-white",
                    )}
                  >
                    <button type="button" className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-left">{child.label}</span>
                      <ChevronRight className="ml-auto size-3 shrink-0 opacity-60 transition-transform group-data-[state=open]/subnav:rotate-90" />
                    </button>
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="mx-2 my-1 gap-0.5 border-white/10 px-2 py-0.5">
                    <NavSubTree
                      children={child.children}
                      currentView={currentView}
                      openGroups={openGroups}
                      onOpenChange={onOpenChange}
                    />
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuSubItem>
            </Collapsible>
          );
        }

        const active = currentView === child.view;
        return (
          <SidebarMenuSubItem key={child.href}>
            <SidebarMenuSubButton
              asChild
              isActive={active}
              className={cn(
                "h-9 rounded-lg px-2.5 text-[12.5px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white",
                active && "font-medium text-white",
              )}
            >
              <Link href={child.href}>{child.label}</Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const currentView = searchParams.get("view");
  const visualRole = portalRole(pathname);

  function signOut() {
    clearSession();
    router.replace("/");
  }

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.role = visualRole;
    return () => {
      delete root.dataset.role;
    };
  }, [visualRole]);

  useEffect(() => {
    const session = getUser();
    if (!session) {
      router.replace("/");
      return;
    }
    setUser(session);

    // Roles stay inside their own portal: a store login on /manager is
    // bounced back to its home.
    const roots = ROLE_ROOTS[session.role] ?? [];
    const allowed = roots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`),
    );
    if (!allowed) router.replace(roleHome(session.role));
  }, [router, pathname]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .tenantMe()
      .then((response) => {
        if (!cancelled) setTenant(response.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="app-shell-bg flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="role-gradient-bg grid size-12 animate-pulse place-items-center rounded-2xl text-white shadow-[0_18px_40px_-16px_var(--role-1)] ring-1 ring-white/20">
            <Boxes className="size-5" />
          </span>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-zinc-500 uppercase">
            Opening workspace
          </p>
        </div>
      </div>
    );
  }

  if (user.role === "SALES") {
    return (
      <div className="app-shell-bg flex min-h-svh flex-col">
        <SalesMenubar
          user={user}
          logoUrl={tenant?.logo_url}
          tenantName={tenant?.name ?? user.tenant}
        />
        <main className="relative z-[1] mx-auto w-full max-w-[1500px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  const meta = ROLE_META[visualRole];
  const sections = navFor(visualRole);

  return (
    <SidebarProvider className="app-shell-bg">
      <Sidebar collapsible="icon" className="role-sidebar-surface">
        <SidebarHeader className="gap-2 p-3">
          <div className="flex items-center gap-2.5 px-1 py-1">
            {tenant?.logo_url ? (
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-1.5 shadow-[0_14px_32px_-16px_var(--role-1)] ring-1 ring-white/10">
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="size-full object-contain"
                />
              </span>
            ) : (
              <span className="role-gradient-bg grid size-10 shrink-0 place-items-center rounded-2xl text-white shadow-[0_14px_32px_-14px_var(--role-1)] ring-1 ring-white/20">
                <Boxes className="size-5" />
              </span>
            )}
            <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="block font-heading text-[15px] font-semibold tracking-tight text-white">
                VoloSync
              </span>
              <span className="role-text block truncate text-[9px] font-semibold tracking-[0.22em] uppercase">
                {meta.label} portal
              </span>
            </span>
          </div>
        </SidebarHeader>
        <div className="role-hairline mx-3 opacity-50" />

        <SidebarContent className="px-2 pt-2 pb-2">
          {sections.map((section) => (
            <SidebarGroup key={section.label} className="p-1.5">
              <SidebarGroupLabel className="flex items-center gap-2 px-2 text-[9px] font-semibold tracking-[0.22em] text-white/35 uppercase">
                <span className="truncate">{section.label}</span>
                <span className="h-px flex-1 bg-white/5" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {section.items.map((leaf) => {
                    const active = isNavActive(leaf, pathname, currentView);
                    if (leaf.children) {
                      const open = openGroups[leaf.href] ?? active;
                      return (
                        <Collapsible
                          key={leaf.href}
                          open={open}
                          onOpenChange={(next) =>
                            setOpenGroups((current) => ({
                              ...current,
                              [leaf.href]: next,
                            }))
                          }
                          className="group/nav"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                isActive={active}
                                tooltip={leaf.label}
                                className={cn(
                                  "h-10 w-full cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:shadow-sm",
                                  active && "role-nav-active font-medium",
                                )}
                              >
                                <leaf.icon className="size-4 opacity-85" />
                                <span>{leaf.label}</span>
                                <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-60 transition-transform group-data-[state=open]/nav:rotate-90 group-data-[collapsible=icon]:hidden" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                              {leaf.children.length ? (
                                <SidebarMenuSub className="mx-2 my-1 gap-0.5 border-white/10 px-2 py-0.5">
                                  <NavSubTree
                                    children={leaf.children}
                                    currentView={currentView}
                                    openGroups={openGroups}
                                    onOpenChange={(href, open) =>
                                      setOpenGroups((current) => ({
                                        ...current,
                                        [href]: open,
                                      }))
                                    }
                                  />
                                </SidebarMenuSub>
                              ) : (
                                <p className="mx-2 my-1 px-2 py-1 text-[11px] italic text-zinc-600">
                                  Nothing here yet.
                                </p>
                              )}
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }
                    return (
                      <SidebarMenuItem key={leaf.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={leaf.label}
                          className={cn(
                            "h-10 cursor-pointer rounded-xl px-3 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.055] hover:text-white data-[active=true]:shadow-sm",
                            active && "role-nav-active font-medium",
                          )}
                        >
                          <Link href={leaf.href}>
                            <leaf.icon className="size-4 opacity-85" />
                            <span>{leaf.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-white/5 p-3">
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-9 w-full items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] px-2.5 text-xs font-medium text-rose-300 transition hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-200 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">Sign out</span>
          </button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="app-frame relative min-h-svh min-w-0">
        <WorkspaceTopBar
          user={user}
          tenantName={tenant?.name ?? user.tenant}
          logoUrl={tenant?.logo_url}
          workspaceLabel={meta.label}
          sidebarTrigger={
            <SidebarTrigger className="-ml-1 shrink-0 text-zinc-400 hover:bg-white/[0.06] hover:text-white" />
          }
        />
        <div className="relative z-[1] flex-1 md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
