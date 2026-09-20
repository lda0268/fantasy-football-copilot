import { FP_CACHE_TTL_MS } from "../fantasypros/cache.js";

export const FANTASYPROS_DATASET_TTL_MS = FP_CACHE_TTL_MS;

export function evaluateObservation(
  observedAt: string | undefined,
  ttlMs: number,
  now = Date.now(),
): { observedAt?: string; stale?: boolean } {
  if (!observedAt) {
    return {};
  }
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) {
    return { observedAt };
  }
  return {
    observedAt,
    stale: now - parsed > ttlMs,
  };
}
