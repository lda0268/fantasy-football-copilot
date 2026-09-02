import type { Player, Position } from "../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../types/league";
import { playersAtPosition } from "./players";
import { interpolateProjectedPoints } from "./projectionCurve";
import { replacementRankForPosition } from "./starterDemand";

export { playersAtPosition };

export function getReplacementLevel(
  playerUniverse: Player[],
  position: Position,
  league: LeagueSettings = DEFAULT_LEAGUE,
): { rank: number; projectedPoints: number } {
  const rank = replacementRankForPosition(league, position, playerUniverse);
  const ranked = playersAtPosition(playerUniverse, position);

  return {
    rank,
    projectedPoints: interpolateProjectedPoints(ranked, rank),
  };
}

export function getReplacementLevels(
  playerUniverse: Player[],
  league: LeagueSettings = DEFAULT_LEAGUE,
): Record<Position, { rank: number; projectedPoints: number }> {
  const positions: Position[] = ["QB", "RB", "WR", "TE", "K", "DEF"];
  return Object.fromEntries(
    positions.map((position) => [position, getReplacementLevel(playerUniverse, position, league)]),
  ) as Record<Position, { rank: number; projectedPoints: number }>;
}
