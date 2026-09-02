export const RECOMMENDATION_WEIGHTS = {
  vor: 0.3,
  scarcity: 0.2,
  expert: 0.15,
  adp: 0.1,
  rosterNeed: 0.1,
  opportunityCost: 0.15,
} as const;

export const MIN_TIER_GAP = 8;
export const TIER_GAP_MULTIPLIER = 1.6;
export const ADP_VALUE_WINDOW = 24;
