"use client";

import { useSearchParams } from "next/navigation";

export function useView(fallback: string) {
  const searchParams = useSearchParams();
  return [searchParams.get("view") ?? fallback] as const;
}
