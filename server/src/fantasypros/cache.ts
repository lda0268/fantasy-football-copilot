export const FP_CACHE_TTL_MS = {
  players: 24 * 60 * 60 * 1000,
  weeklyProjections: 30 * 60 * 1000,
  rosProjections: 6 * 60 * 60 * 1000,
  ecr: 30 * 60 * 1000,
  injuries: 15 * 60 * 1000,
} as const;

export type CacheClock = () => number;

export class TtlCache {
  private readonly store = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(private readonly now: CacheClock = () => Date.now()) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  size(): number {
    return this.store.size;
  }
}

export function cacheKey(parts: Array<string | number | boolean | undefined>): string {
  return parts.map((part) => (part === undefined ? "" : String(part))).join("|");
}
