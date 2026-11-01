"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Header control: opens the self-service password dialog from a key icon. */
export function PasswordKeyButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Change password"
        aria-label="Change password"
        onClick={() => setOpen(true)}
        className={cn(
          "size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white",
          className,
        )}
      >
        <KeyRound className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-white/10 bg-[#0b0b13] text-white ring-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Change your password</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Enter your current password, then choose a new one. Only you can update
              your login password.
            </DialogDescription>
          </DialogHeader>
          <ChangePasswordForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
