import type { Player } from "../types/draft";

export function interpolateProjectedPoints(
  rankedPlayers: Player[],
  targetRank: number,
): number {
  const ranked = [...rankedPlayers].sort((a, b) => b.projectedPoints - a.projectedPoints);
  if (ranked.length === 0) {
    return 0;
  }

  const index = targetRank - 1;
  if (index >= 0 && index < ranked.length) {
    return ranked[index].projectedPoints;
  }

  if (ranked.length === 1) {
    return ranked[0].projectedPoints;
  }

  const last = ranked[ranked.length - 1];
  const prior = ranked[ranked.length - 2];
  const lastRank = ranked.length;
  const slope = (last.projectedPoints - prior.projectedPoints) / Math.max(1, 1);
  const extrapolated = last.projectedPoints + slope * (targetRank - lastRank);
  return Math.max(extrapolated, last.projectedPoints * 0.88);
}
