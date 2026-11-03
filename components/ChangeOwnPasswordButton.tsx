"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import CustomFormField, { formFieldTypes } from "@/components/customFormField";
import { changeOwnPasswordSchema } from "@/lib/validations";
import { changeOwnPassword } from "@/lib/api/cafeCatalog";
import { cn } from "@/lib/utils";

type FormValues = z.infer<typeof changeOwnPasswordSchema>;

export function ChangeOwnPasswordButton({
  className,
  variant = "ghost",
  size = "icon",
  label,
}: {
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "icon" | "sm" | "default";
  /** When set, show text beside the key icon (e.g. sidebar). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(
            label ? "gap-2" : "shrink-0",
            className,
          )}
          title="Change password"
          aria-label="Change password"
        >
          <KeyRound className="h-4 w-4" />
          {label ? <span>{label}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>
            Enter your current password, then choose a new one. Only you can
            update your login password.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (data) => {
              setPending(true);
              try {
                const ok = await changeOwnPassword(data);
                if (ok) {
                  form.reset();
                  setOpen(false);
                }
              } catch {
                // toast handled in API
              } finally {
                setPending(false);
              }
            })}
          >
            <CustomFormField
              control={form.control}
              name="currentPassword"
              type="password"
              label="Current password"
              fieldType={formFieldTypes.INPUT}
            />
            <CustomFormField
              control={form.control}
              name="newPassword"
              type="password"
              label="New password"
              fieldType={formFieldTypes.INPUT}
            />
            <CustomFormField
              control={form.control}
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              fieldType={formFieldTypes.INPUT}
            />
            <PendingButton
              type="submit"
              pending={pending}
              className="w-full"
            >
              {pending ? "Updating…" : "Update password"}
            </PendingButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
