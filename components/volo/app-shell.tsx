"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChevronRight, LogOut } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PasswordKeyButton } from "@/components/volo/password-button";
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
import { Separator } from "@/components/ui/separator";
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
  activeLabel,
  isNavActive,
  navFor,
  portalRole,
  ROLE_META,
} from "@/components/volo/nav";
import { SalesMenubar } from "@/components/volo/sales-menubar";
import { UserMenu } from "@/components/volo/user-menu";

function PortalMark({
  logoUrl,
  name,
  fallback,
}: {
  logoUrl?: string;
  name: string;
  fallback: React.ReactNode;
}) {
  if (logoUrl) {
    return (
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] p-1">
        <img src={logoUrl} alt={name} className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span className="role-icon-tile grid size-8 shrink-0 place-items-center rounded-xl">
      {fallback}
    </span>
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
        <SalesMenubar user={user} logoUrl={tenant?.logo_url} />
        <main className="relative z-[1] mx-auto w-full max-w-[1500px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  const meta = ROLE_META[visualRole];
  const MetaIcon = meta.icon;
  const sections = navFor(visualRole);
  const label = activeLabel(visualRole, pathname, currentView);

  return (
    <SidebarProvider className="app-shell-bg">
      <Sidebar collapsible="icon" className="role-sidebar-surface">
        <SidebarHeader className="gap-2 p-3">
          <Link
            href={roleHome(user.role)}
            className="group flex items-center gap-2.5 rounded-xl px-1 py-1"
          >
            {tenant?.logo_url ? (
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-1.5 shadow-[0_14px_32px_-16px_var(--role-1)] ring-1 ring-white/10 transition-transform group-hover:scale-[1.04]">
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="size-full object-contain"
                />
              </span>
            ) : (
              <span className="role-gradient-bg grid size-10 shrink-0 place-items-center rounded-2xl text-white shadow-[0_14px_32px_-14px_var(--role-1)] ring-1 ring-white/20 transition-transform group-hover:scale-[1.04]">
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
          </Link>
          <div className="role-chip flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-medium group-data-[collapsible=icon]:hidden">
            <span className="size-1.5 shrink-0 rounded-full bg-role-1 shadow-[0_0_10px_var(--role-1)]" />
            <span className="truncate">{user.tenant}</span>
          </div>
        </SidebarHeader>
        <div className="role-hairline mx-3 opacity-50" />

        <SidebarContent className="px-1.5 pt-2 pb-2">
          {sections.map((section) => (
            <SidebarGroup key={section.label} className="p-1.5">
              <SidebarGroupLabel className="flex items-center gap-2 px-2 text-[9px] font-semibold tracking-[0.22em] text-white/35 uppercase">
                <span className="truncate">{section.label}</span>
                <span className="h-px flex-1 bg-white/5" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.map((leaf) => {
                    const active = isNavActive(leaf, pathname, currentView);
                    if (leaf.children?.length) {
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
                                  "h-9 w-full rounded-xl px-2.5 text-[13px] text-zinc-400 transition-all duration-150 hover:bg-white/[0.055] hover:text-white",
                                  active && "role-nav-active font-medium",
                                )}
                              >
                                <leaf.icon className="size-4 opacity-85" />
                                <span>{leaf.label}</span>
                                <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-60 transition-transform group-data-[state=open]/nav:rotate-90 group-data-[collapsible=icon]:hidden" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                              <SidebarMenuSub className="mx-2 my-1 gap-0.5 border-white/10 px-2 py-0.5">
                                {leaf.children.map((child) => {
                                  const childActive = currentView === child.view;
                                  return (
                                    <SidebarMenuSubItem key={child.href}>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={childActive}
                                        className={cn(
                                          "h-8 rounded-lg px-2 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white",
                                          childActive && "font-medium text-white",
                                        )}
                                      >
                                        <Link href={child.href}>{child.label}</Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
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
                            "h-9 rounded-xl px-2.5 text-[13px] text-zinc-400 transition-all duration-150 hover:bg-white/[0.055] hover:text-white",
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
        <header className="workspace-chrome relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/5 px-4 sm:px-6 md:h-16">
          <SidebarTrigger className="-ml-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white" />
          <Separator orientation="vertical" className="h-5 bg-white/10" />
          <div className="flex min-w-0 items-center gap-2.5">
            <PortalMark
              logoUrl={tenant?.logo_url}
              name={tenant?.name ?? user.tenant}
              fallback={<MetaIcon className="size-4" />}
            />
            <div className="min-w-0">
              <p className="text-[8.5px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                {meta.label} workspace
              </p>
              <p className="role-text truncate text-[13px] font-semibold tracking-[0.12em] uppercase">
                {label}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList className="items-center gap-1.5 text-[11px]">
                <BreadcrumbItem>
                  <span className="max-w-40 truncate text-zinc-400">
                    {tenant?.name ?? user.tenant}
                  </span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-zinc-600" />
                <BreadcrumbPage className="role-text text-[10px] font-semibold tracking-[0.18em] uppercase">
                  {visualRole}
                </BreadcrumbPage>
              </BreadcrumbList>
            </Breadcrumb>
            <PasswordKeyButton />
            <UserMenu user={user} workspaceLabel={meta.label} />
          </div>
        </header>
        <div className="relative z-[1] flex-1 md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
