"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { clearSession, type SessionUser } from "@/lib/api";
import { ChangePasswordForm } from "@/components/change-password";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  user,
  workspaceLabel,
  logoUrl,
  tenantName,
}: {
  user: SessionUser;
  workspaceLabel: string;
  logoUrl?: string;
  tenantName?: string;
}) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const tenant = tenantName ?? user.tenant;

  function signOut() {
    clearSession();
    router.replace("/");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            title={`${user.name} · account`}
            aria-label="Account menu"
            className="size-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-1 hover:bg-white/[0.08]"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenant}
                className="size-full rounded-lg object-contain"
              />
            ) : (
              <span className="role-gradient-bg grid size-full place-items-center rounded-lg text-white">
                <Boxes className="size-4" />
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-64 rounded-xl border border-white/10 bg-[#0b0b13] p-1.5 text-zinc-200 shadow-2xl shadow-black/60"
        >
          <DropdownMenuLabel className="px-2 py-2 text-[11px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
            Signed in
          </DropdownMenuLabel>
          <div className="min-w-0 px-2 pb-2">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-zinc-500">{tenant}</p>
          </div>
          <div className="mx-2 mb-1 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
            <ShieldCheck className="size-3.5 text-role-1" />
            {workspaceLabel} workspace
          </div>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            className="gap-2 rounded-lg px-2 py-2 text-[13px] focus:bg-white/10 focus:text-white"
            onSelect={() => setPasswordOpen(true)}
          >
            <KeyRound className="size-4 text-zinc-400" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="gap-2 rounded-lg px-2 py-2 text-[13px]"
            onSelect={signOut}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="border border-white/10 bg-[#0b0b13] text-white ring-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Change your password</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Enter your current password, then choose a new one. Only you can update
              your login password.
            </DialogDescription>
          </DialogHeader>
          <ChangePasswordForm onDone={() => setPasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
