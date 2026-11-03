// HR workspace — self-contained shell (SidebarProvider + session guard inside HrDashboard).
// Intentionally outside the (app) layout group so the outer AppShell sidebar doesn't nest.
export const instant = false;

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { HrDashboard } from "@/components/hr/HrDashboard";

export default function HrPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Opening HR…</p>
        </div>
      }
    >
      <HrDashboard />
    </Suspense>
  );
}
