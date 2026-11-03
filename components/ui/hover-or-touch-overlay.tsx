"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type HoverOrTouchOverlayProps = {
  children: ReactNode;
  /** Centered overlay on md+ screens (shown on hover). */
  overlay: ReactNode;
  /** Always-visible action below content on screens smaller than md. */
  mobileAction: ReactNode;
  className?: string;
  mediaClassName?: string;
};

/**
 * Desktop (md+): overlay on hover.
 * Mobile: dedicated action row — no hover required.
 */
export function HoverOrTouchOverlay({
  children,
  overlay,
  mobileAction,
  className,
  mediaClassName,
}: HoverOrTouchOverlayProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("group relative", mediaClassName)}>
        {children}
        <div className="absolute inset-0 hidden items-center justify-center bg-black/40 opacity-0 transition-opacity md:flex md:group-hover:opacity-100">
          {overlay}
        </div>
      </div>
      <div className="md:hidden">{mobileAction}</div>
    </div>
  );
}
