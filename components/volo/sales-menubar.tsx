"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes,
  Check,
  ChevronDown,
  ClipboardList,
  HandCoins,
  KeyRound,
  LogOut,
  PackageSearch,
} from "lucide-react";
import { clearSession, type SessionUser } from "@/lib/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PasswordKeyButton } from "@/components/volo/password-button";
import { UserMenu } from "@/components/volo/user-menu";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from "@/components/ui/menubar";

const LINKS = [
  { view: "stock", label: "My stock", icon: PackageSearch },
  { view: "history", label: "My history", icon: ClipboardList },
  { view: "password", label: "Password", icon: KeyRound },
] as const;

export function SalesMenubar({
  user,
  logoUrl,
}: {
  user: SessionUser;
  logoUrl?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "stock";
  const current = LINKS.find((link) => link.view === view) ?? LINKS[0];

  const go = (next: string) => router.push(`/sales?view=${next}`);

  function signOut() {
    clearSession();
    router.replace("/");
  }

  return (
    <header className="workspace-chrome sticky top-0 z-40 border-b border-white/5">
      <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/sales?view=stock" className="group flex items-center gap-2.5">
          {logoUrl ? (
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] p-1.5 ring-1 ring-white/10 transition-transform group-hover:scale-105">
              <img
                src={logoUrl}
                alt={user.tenant}
                className="size-full object-contain"
              />
            </span>
          ) : (
            <span className="role-gradient-bg grid size-9 place-items-center rounded-xl text-white shadow-[0_12px_30px_-12px_var(--role-1)] ring-1 ring-white/20 transition-transform group-hover:scale-105">
              <Boxes className="size-[18px]" />
            </span>
          )}
          <span className="leading-tight">
            <span className="block font-heading text-[15px] font-semibold tracking-tight text-white">
              VoloSync
            </span>
            <span className="role-text block text-[9px] font-semibold tracking-[0.22em] uppercase">
              Agent portal
            </span>
          </span>
        </Link>

        <Menubar className="h-9 rounded-xl border-white/10 bg-white/[0.04] p-1 shadow-inner shadow-black/20 ring-1 ring-white/[0.03]">
          <MenubarMenu>
            <MenubarTrigger className="h-7 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.07] hover:text-white data-[state=open]:bg-white/[0.08] data-[state=open]:text-white">
              <current.icon className="size-3.5 text-role-1" />
              {current.label}
              <ChevronDown className="size-3 text-zinc-500" />
            </MenubarTrigger>
            <MenubarContent className="w-56 rounded-xl border border-white/10 bg-[#0b0b13] p-1.5 text-zinc-200 shadow-2xl shadow-black/60">
              {LINKS.map((link) => (
                <MenubarItem
                  key={link.view}
                  onSelect={() => go(link.view)}
                  className="gap-2 rounded-lg px-2 py-2 text-[13px] focus:bg-white/10 focus:text-white"
                >
                  <link.icon className="size-4 text-zinc-400" />
                  {link.label}
                  {view === link.view && <Check className="ml-auto size-3.5 text-role-1" />}
                </MenubarItem>
              ))}
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger className="h-7 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.07] hover:text-white data-[state=open]:bg-white/[0.08] data-[state=open]:text-white">
              <HandCoins className="size-3.5 text-role-1" />
              Quick actions
              <ChevronDown className="size-3 text-zinc-500" />
            </MenubarTrigger>
            <MenubarContent className="w-60 rounded-xl border border-white/10 bg-[#0b0b13] p-1.5 text-zinc-200 shadow-2xl shadow-black/60">
              <MenubarItem
                onSelect={() => go("stock")}
                className="gap-2 rounded-lg px-2 py-2 text-[13px] focus:bg-white/10 focus:text-white"
              >
                <HandCoins className="size-4 text-rose-300" />
                Record a sale
                <MenubarShortcut className="text-[10px] text-zinc-500">OPEN</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onSelect={() => go("history")}
                className="gap-2 rounded-lg px-2 py-2 text-[13px] focus:bg-white/10 focus:text-white"
              >
                <ClipboardList className="size-4 text-fuchsia-300" />
                Review settlements
              </MenubarItem>
              <MenubarSeparator className="bg-white/10" />
              <MenubarItem
                onSelect={() => go("password")}
                className="gap-2 rounded-lg px-2 py-2 text-[13px] focus:bg-white/10 focus:text-white"
              >
                <KeyRound className="size-4 text-amber-300" />
                Update my password
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger className="h-7 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.07] hover:text-white data-[state=open]:bg-white/[0.08] data-[state=open]:text-white">
              Account
              <ChevronDown className="size-3 text-zinc-500" />
            </MenubarTrigger>
            <MenubarContent className="w-52 rounded-xl border border-white/10 bg-[#0b0b13] p-1.5 text-zinc-200 shadow-2xl shadow-black/60">
              <MenubarItem
                onSelect={() => go("password")}
                className="gap-2 rounded-lg px-2 py-2 text-[13px] focus:bg-white/10 focus:text-white"
              >
                <KeyRound className="size-4 text-zinc-400" />
                Change password
              </MenubarItem>
              <MenubarSeparator className="bg-white/10" />
              <MenubarItem
                variant="destructive"
                onSelect={signOut}
                className="gap-2 rounded-lg px-2 py-2 text-[13px]"
              >
                <LogOut className="size-4" />
                Sign out
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <div className="ml-auto flex items-center gap-2">
          <Breadcrumb className="hidden lg:block">
            <BreadcrumbList className="items-center gap-1.5 text-[11px]">
              <BreadcrumbItem>
                <span className="max-w-40 truncate text-zinc-400">{user.tenant}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-zinc-600" />
              <BreadcrumbPage className="role-text text-[10px] font-semibold tracking-[0.18em] uppercase">
                SALES
              </BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
          <PasswordKeyButton />
          <UserMenu user={user} workspaceLabel="Sales" />
        </div>
      </div>
      <div className="role-hairline" />
    </header>
  );
}
