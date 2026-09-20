export const COPILOT_SCORE_WEIGHTS = {
  availability: 5,
  positionNeed: 35,
  projectedPoints: 25,
  percentOwned: 10,
  health: 15,
  byeWeek: 10,
} as const;

export const COPILOT_RECOMMENDATION_DEFAULT_LIMIT = 10;
export const COPILOT_RECOMMENDATION_MAX_LIMIT = 25;

export const CORE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

export const NEED_POINTS = {
  high: 35,
  medium: 22,
  low: 10,
  none: 0,
} as const;

export const HEALTH_POINTS = {
  healthy: 15,
  questionable: 8,
  doubtful: 4,
  out: 1,
  ir: 0,
} as const;

export const MIN_REMAINING_USABLE_AFTER_DROP = 2;
