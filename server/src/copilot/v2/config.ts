export const V2_SCORE_WEIGHTS = {
  rosterNeed: 30,
  restOfSeason: 30,
  weeklyValue: 20,
  healthRisk: 10,
  rosterFit: 10,
} as const;

export const V2_NEED_POINTS = {
  high: 30,
  medium: 19,
  low: 10,
  none: 0,
} as const;

export const V2_HEALTH_POINTS = {
  healthy: 10,
  questionable: 5,
  doubtful: 2,
  out: 0,
  ir: 0,
  suspended: 0,
} as const;

export const V2_PROJECTION_SHARE = 0.65;
export const V2_ECR_SHARE = 0.35;

export const V2_ELIGIBLE_AVAILABILITY = ["free_agent", "waivers"] as const;
