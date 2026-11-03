"use client";

import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Tenant side of the Apex support conversation. The Apex console has not
 * shipped its half yet, so this opens an honest empty state instead of a
 * dead composer.
 */
export function ApexChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Chat with Apex"
        aria-label="Chat with Apex"
        onClick={() => setOpen(true)}
        className="size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
      >
        <MessageCircle className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-white/10 bg-[#0b0b13] text-white ring-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Chat with Apex</DialogTitle>
            <DialogDescription className="text-zinc-400">
              A direct line to the team that runs VoloSync.
            </DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <span className="role-gradient-bg grid size-11 place-items-center rounded-2xl text-white shadow-[0_16px_34px_-16px_var(--role-1)] ring-1 ring-white/20">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-4 font-heading text-sm font-semibold text-white">
              Apex chat is coming online
            </p>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-400">
              The Apex team is still building their side of this conversation in
              the admin console. Once it is live, your messages and their replies
              will appear here.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
