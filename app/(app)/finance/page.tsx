// Server wrapper: auth-gated client screens are opted out of Next 16
// instant-navigation validation, which only a Server Component may do.
export const instant = false;

import { Suspense } from "react";
import { WorkspaceLoading } from "@/components/volo/workspace-loading";
import FinanceClient from "./client";

export default function Page() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <FinanceClient />
    </Suspense>
  );
}
