export type OgDecision = "ok" | "busy" | "limited";

/** Bounds CPU-heavy social image generation per process and per client window. */
export function createOgGuard({ maxConcurrent = 4, limit = 30, windowMs = 60000, now = Date.now }: { maxConcurrent?: number; limit?: number; windowMs?: number; now?: () => number } = {}) {
  let active = 0;
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    acquire(key: string): OgDecision {
      const time = now();
      for (const [candidate, window] of windows) if (window.startedAt + windowMs <= time) windows.delete(candidate);
      let window = windows.get(key);
      if (!window) { window = { startedAt: time, count: 0 }; windows.set(key, window); }
      if (window.count >= limit) return "limited";
      window.count++;
      if (active >= maxConcurrent) return "busy";
      active++;
      return "ok";
    },
    release() { active = Math.max(0, active - 1); },
  };
}

export function ogClientKey(headers: Headers) {
  const forwarded = headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length <= 64 ? forwarded : "local";
}
