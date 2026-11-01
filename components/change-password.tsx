"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, getToken, getUser, saveSession } from "@/lib/api";

/**
 * Self-service password rotation for every role (store, finance, manager, hr,
 * sales, owner): the backend checks the old password before accepting a new one.
 */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (next !== confirm) return toast.error("The new passwords do not match.");
    if (next.length < 6) return toast.error("Use at least 6 characters.");
    setPending(true);
    try {
      await api.changePassword({ old_password: current, new_password: next });
      const session = getUser();
      if (session) {
        saveSession(getToken() ?? "", { ...session, must_change_password: false });
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated — this one is yours alone.");
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change the password");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
          Current password
        </Label>
        <Input
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          className="border-white/10 bg-white/5 text-white"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
          New password
        </Label>
        <Input
          type="password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          className="border-white/10 bg-white/5 text-white"
          minLength={6}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
          Confirm new password
        </Label>
        <Input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          className="border-white/10 bg-white/5 text-white"
          minLength={6}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={pending || !current || !next || !confirm}
        className="role-gradient-bg w-full border-0 text-white shadow-[0_14px_30px_-16px_var(--role-1)] hover:opacity-90"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}

/** Sidebar control: any role can rotate its own password from here. */
export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 border-white/10 bg-white/[0.03] text-xs text-zinc-300 hover:text-white"
        >
          <KeyRound className="size-3.5" /> Change password
        </Button>
      </DialogTrigger>
      <DialogContent className="border border-white/10 bg-[#0b0b13] text-white ring-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Enter your current password, then choose a new one. Only you can update
            your login password.
          </DialogDescription>
        </DialogHeader>
        <ChangePasswordForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
