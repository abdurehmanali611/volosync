"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Hard refresh for when a client-fetched panel is out of date or stuck. */
export function RefreshButton() {
  const [spinning, setSpinning] = useState(false);

  function refresh() {
    if (spinning) return;
    setSpinning(true);
    window.setTimeout(() => window.location.reload(), 350);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Refresh data"
      aria-label="Refresh data"
      onClick={refresh}
      className="size-9 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
    >
      <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
    </Button>
  );
}
