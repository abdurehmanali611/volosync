"use client";

import { useEffect } from "react";

/**
 * Runs `callback` every `delayMs` while the document tab is visible.
 * Pauses the timer when hidden and invokes `callback` once when the tab becomes visible again.
 */
export function useVisibleInterval(
  callback: () => void,
  delayMs: number | null,
): void {
  useEffect(() => {
    if (delayMs == null || delayMs <= 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState === "visible") {
        callback();
      }
    };

    const stop = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const start = () => {
      if (intervalId != null) return;
      intervalId = setInterval(tick, delayMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        callback();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [callback, delayMs]);
}
