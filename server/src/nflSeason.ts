export function currentNflSeason(now = new Date()): number {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  return month >= 3 ? year : year - 1;
}

export const NFL_REGULAR_WEEK_MIN = 1;
export const NFL_REGULAR_WEEK_MAX = 18;
