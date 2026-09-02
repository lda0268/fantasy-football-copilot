export interface Rng {
  next(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state += 0x6d2b79f5;
      let r = Math.imul(state ^ (state >>> 15), 1 | state);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function sampleWeightedIndex(weights: number[], rng: Rng): number {
  if (weights.length === 0) {
    return -1;
  }
  let total = 0;
  for (const weight of weights) {
    total += weight;
  }
  if (total <= 0) {
    return Math.min(weights.length - 1, Math.floor(rng.next() * weights.length));
  }
  let cursor = rng.next() * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) {
      return index;
    }
  }
  return weights.length - 1;
}

export function stableSeedFromKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
