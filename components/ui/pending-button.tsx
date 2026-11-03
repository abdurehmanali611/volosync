"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentProps<typeof Button>;

export type PendingButtonProps = ButtonProps & {
  pending?: boolean;
};

/**
 * Disables the control and shows a spinner while `pending` is true (e.g. GraphQL / DB round-trip).
 */
export function PendingButton({
  pending,
  disabled,
  className,
  children,
  ...props
}: PendingButtonProps) {
  return (
    <Button
      disabled={disabled || pending}
      className={cn(pending && "cursor-wait", className)}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
