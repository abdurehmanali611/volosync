export const CAFE_ORDER_MODES = ["digital", "analog"] as const;

export type CafeOrderMode = (typeof CAFE_ORDER_MODES)[number];

export type CafeOrderModeHistoryEntry = {
  mode: CafeOrderMode;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export const DEFAULT_CAFE_ORDER_MODE: CafeOrderMode = "digital";

export const CAFE_ORDER_MODE_LABELS: Record<CafeOrderMode, string> = {
  digital: "Digital ordering",
  analog: "POS agent (analog)",
};

export const CAFE_ORDER_MODE_SHORT_LABELS: Record<CafeOrderMode, string> = {
  digital: "Digital",
  analog: "POS agent",
};

export const CAFE_ORDER_MODE_DESCRIPTIONS: Record<CafeOrderMode, string> = {
  digital:
    "Kitchen and bar screens, cashier payment, and the current digital order flow.",
  analog:
    "The cashier computer sends tickets through the POS agent. Printing registers the order for service, but payment is still approved later by cashier payment verification. There is no kitchen/bar login.",
};

export function parseCafeOrderMode(raw: unknown): CafeOrderMode {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  return value === "analog" ? "analog" : "digital";
}

export function isAnalogCafeOrderMode(mode: unknown): boolean {
  return parseCafeOrderMode(mode) === "analog";
}

export function unusedCafeOrderMode(current: unknown): CafeOrderMode {
  return parseCafeOrderMode(current) === "analog" ? "digital" : "analog";
}

export function parseCafeOrderModeHistory(
  raw: unknown,
  fallbackMode: CafeOrderMode = DEFAULT_CAFE_ORDER_MODE,
  fallbackFrom: string | null = null,
): CafeOrderModeHistoryEntry[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = null;
    }
  }
  const parsed: CafeOrderModeHistoryEntry[] = [];
  if (Array.isArray(arr)) {
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const from = rec.effectiveFrom != null ? String(rec.effectiveFrom) : "";
      if (!from) continue;
      parsed.push({
        mode: parseCafeOrderMode(rec.mode),
        effectiveFrom: from,
        effectiveTo:
          rec.effectiveTo == null || rec.effectiveTo === ""
            ? null
            : String(rec.effectiveTo),
      });
    }
  }
  if (parsed.length > 0) return parsed;
  return [
    {
      mode: fallbackMode,
      effectiveFrom: fallbackFrom || new Date(0).toISOString(),
      effectiveTo: null,
    },
  ];
}

function formatModeSwitchDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type CafeOrderModeReportNotice = {
  switchedAt: string;
  fromMode: CafeOrderMode;
  toMode: CafeOrderMode;
  title: string;
  body: string;
};

/** Notices for report screens when Apex approved a digital ↔ analog switch. */
export function cafeOrderModeReportNotices(
  history: CafeOrderModeHistoryEntry[],
): CafeOrderModeReportNotice[] {
  const notices: CafeOrderModeReportNotice[] = [];
  for (let i = 1; i < history.length; i += 1) {
    const previous = history[i - 1]!;
    const current = history[i]!;
    if (previous.mode === current.mode) continue;
    const switchedAt = current.effectiveFrom;
    const when = formatModeSwitchDate(switchedAt);
    notices.push({
      switchedAt,
      fromMode: previous.mode,
      toMode: current.mode,
      title: `Order mode changed on ${when}`,
      body:
        current.mode === "digital"
          ? `Until ${when} this property used POS agent tickets with cashier payment approval and no kitchen/bar screens. From ${when} onward, digital ordering applies: cashier, chef, and bar staff can cancel in their usual workflow, and kitchen/bar screens plus cashier payments are recorded.`
          : `Until ${when} this property used digital ordering with kitchen/bar screens and cashier payment recording. From ${when} onward, POS agent tickets apply: tickets print from cashier, payment approval still happens in cashier payment flows, and kitchen/bar logins are no longer used.`,
    });
  }
  return notices;
}

export function cafeModuleSelected(modules: readonly string[]): boolean {
  return modules.includes("Cafe and Restaurant");
}

export function cafeOrderModeNoteLine(mode: unknown): string {
  return `[Cafe order mode: ${parseCafeOrderMode(mode)}]`;
}

export function parseCafeOrderModeFromRequestNote(
  requestNote: string | null | undefined,
): CafeOrderMode | null {
  const match = /\[Cafe order mode:\s*(digital|analog)\]/i.exec(
    String(requestNote || ""),
  );
  return match ? parseCafeOrderMode(match[1]) : null;
}

/** Display mode when Cafe and Restaurant is in the module list; otherwise null. */
export function cafeOrderModeForModules(
  modules: readonly string[] | null | undefined,
  storedMode: unknown,
): CafeOrderMode | null {
  if (!cafeModuleSelected(modules ?? [])) return null;
  return parseCafeOrderMode(storedMode);
}
