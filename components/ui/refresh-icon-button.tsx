"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RefreshIconButtonProps = {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
  "aria-label"?: string;
};

/** Header refresh control — disables while busy and spins icon only (not the whole button). */
export function RefreshIconButton({
  busy = false,
  disabled = false,
  onClick,
  className,
  iconClassName,
  "aria-label": ariaLabel = "Refresh",
}: RefreshIconButtonProps) {
  const isDisabled = disabled || busy;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={busy}
      className={cn("h-8 w-8 shrink-0 sm:h-9 sm:w-9", className)}
    >
      <RefreshCw
        className={cn(
          "h-4 w-4",
          busy && "animate-spin",
          iconClassName,
        )}
      />
    </Button>
  );
}
