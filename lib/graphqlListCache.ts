/** Short-lived in-memory cache for GraphQL list reads (browser only). */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const listCache = new Map<string, CacheEntry<unknown>>();

function resolveListCacheTtlMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = process.env.NEXT_PUBLIC_GRAPHQL_LIST_CACHE_MS;
  const n = raw ? Number.parseInt(String(raw).trim(), 10) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 20_000;
}

const LIST_CACHE_TTL_MS = resolveListCacheTtlMs();

/**
 * Scope list-cache keys to the signed-in tenant so one property never reuses
 * another property's cached GraphQL list (SaaS isolation).
 */
export function tenantScopedGraphqlListKey(baseKey: string): string {
  const base = String(baseKey ?? "").trim();
  if (typeof window === "undefined") return base;
  const tenant =
    localStorage.getItem("tin_number")?.trim() ||
    localStorage.getItem("hotel_name")?.trim() ||
    "";
  return tenant ? `${tenant}::${base}` : base;
}

function cacheKeyMatchesTarget(cacheKey: string, target: string): boolean {
  if (!cacheKey || !target) return false;
  if (cacheKey === target) return true;
  if (cacheKey.startsWith(`${target}:`) || cacheKey.startsWith(`${target}/`)) {
    return true;
  }
  // Tenant-scoped keys: `${tenant}::${baseKey}` (base may include suffixes).
  const scopedIdx = cacheKey.indexOf("::");
  const scoped =
    scopedIdx >= 0 ? cacheKey.slice(scopedIdx + 2) : cacheKey;
  if (scoped === target) return true;
  if (scoped.startsWith(`${target}:`) || scoped.startsWith(`${target}/`)) {
    return true;
  }
  if (cacheKey.endsWith(`::${target}`)) return true;
  return false;
}

export function readListCache<T>(key: string): T | null {
  if (LIST_CACHE_TTL_MS <= 0) return null;
  const entry = listCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    listCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function writeListCache<T>(key: string, data: T): void {
  if (LIST_CACHE_TTL_MS <= 0) return;
  listCache.set(key, {
    data,
    expiresAt: Date.now() + LIST_CACHE_TTL_MS,
  });
}

/** Drop cached list reads so the next fetch hits the network. */
export function invalidateGraphqlListCache(keys?: string | string[]): void {
  if (!keys) {
    listCache.clear();
    return;
  }
  const targets = Array.isArray(keys) ? keys : [keys];
  for (const key of listCache.keys()) {
    if (targets.some((t) => cacheKeyMatchesTarget(key, t))) {
      listCache.delete(key);
    }
  }
}
