/** Short TTL cache for public ranking pages; authenticated viewers stay uncached. */
export function createRankingCache<T>({ ttlMs = 15000, max = 32, now = Date.now }: { ttlMs?: number; max?: number; now?: () => number } = {}) {
  const entries = new Map<string, { expiresAt: number; value: T }>();
  return async (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now()) return hit.value;
    const value = await load();
    if (entries.size >= max) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, { expiresAt: now() + ttlMs, value });
    return value;
  };
}
