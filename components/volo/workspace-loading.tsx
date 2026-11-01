import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceLoading() {
  return (
    <div className="space-y-6">
      <div className="role-hero space-y-2.5 rounded-3xl px-5 py-5 sm:px-6 sm:py-6">
        <Skeleton className="h-2.5 w-28 bg-role-1/25" />
        <Skeleton className="h-8 w-72 max-w-full bg-white/[0.07]" />
        <Skeleton className="h-4 w-96 max-w-full bg-white/[0.05]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl bg-white/[0.045]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl bg-white/[0.035]" />
        <Skeleton className="h-72 rounded-2xl bg-white/[0.035]" />
      </div>
    </div>
  );
}
