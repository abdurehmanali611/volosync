import { Suspense } from "react";
import { AppShell } from "@/components/volo/app-shell";

function ShellFallback() {
  return (
    <div className="app-shell-bg flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="role-gradient-bg grid size-12 animate-pulse place-items-center rounded-2xl ring-1 ring-white/20" />
        <p className="text-[10px] font-semibold tracking-[0.28em] text-zinc-500 uppercase">
          Opening workspace
        </p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
