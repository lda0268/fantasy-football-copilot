import type { NflPosition } from "../playerIdentity/types.js";
import { normalizeNflPosition } from "../playerIdentity/normalize.js";

export const START_SIT_PROJECTION_SHARE = 0.65;
export const START_SIT_ECR_SHARE = 0.35;
export const START_SIT_FLEX_PROJECTION_SHARE = 0.7;
export const START_SIT_FLEX_ECR_SHARE = 0.3;
export const QUESTIONABLE_VALUE_MULTIPLIER = 0.9;
export const DOUBTFUL_VALUE_MULTIPLIER = 0.7;

const NON_STARTING_SLOTS = new Set(["BN", "BENCH", "IR", "IR+", "IL", "NA"]);

const SLOT_ELIGIBILITY: Record<string, NflPosition[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DEF: ["DEF"],
  DST: ["DEF"],
  "D/ST": ["DEF"],
  FLEX: ["RB", "WR", "TE"],
  UTIL: ["RB", "WR", "TE"],
  "W/R/T": ["RB", "WR", "TE"],
  WRT: ["RB", "WR", "TE"],
  "W/R": ["RB", "WR"],
  "WR/RB": ["WR", "RB"],
  "R/W": ["RB", "WR"],
  "Q/W/R/T": ["QB", "RB", "WR", "TE"],
  SUPERFLEX: ["QB", "RB", "WR", "TE"],
  OP: ["QB", "RB", "WR", "TE"],
};

export function normalizeSlotCode(slot: string | undefined): string {
  return slot?.trim().toUpperCase() ?? "";
}

export function isNonStartingSlot(slot: string | undefined): boolean {
  const code = normalizeSlotCode(slot);
  if (!code) {
    return false;
  }
  if (NON_STARTING_SLOTS.has(code)) {
    return true;
  }
  return code.startsWith("IR") || code.startsWith("BN");
}

export function isStartingSlot(slot: string | undefined): boolean {
  const code = normalizeSlotCode(slot);
  if (!code || isNonStartingSlot(code)) {
    return false;
  }
  return slotEligibility(code) !== undefined;
}

export function slotEligibility(slot: string | undefined): NflPosition[] | undefined {
  const code = normalizeSlotCode(slot);
  if (!code || isNonStartingSlot(code)) {
    return undefined;
  }
  if (SLOT_ELIGIBILITY[code]) {
    return SLOT_ELIGIBILITY[code];
  }
  const asNfl = normalizeNflPosition(code);
  return asNfl ? [asNfl] : undefined;
}

export function isMultiPositionSlot(slot: string | undefined): boolean {
  const accepted = slotEligibility(slot);
  return Boolean(accepted && accepted.length > 1);
}

export function yahooNflEligibility(displayPosition?: string, eligiblePositions?: string[]): NflPosition[] {
  const found: NflPosition[] = [];
  const seen = new Set<NflPosition>();
  for (const value of [displayPosition, ...(eligiblePositions ?? [])]) {
    const normalized = normalizeNflPosition(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      found.push(normalized);
    }
  }
  return found;
}

export function playerFillsSlot(
  playerPositions: NflPosition[],
  slot: string | undefined,
): boolean {
  const accepted = slotEligibility(slot);
  if (!accepted) {
    return false;
  }
  return playerPositions.some((position) => accepted.includes(position));
}
