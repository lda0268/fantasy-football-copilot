import type { Player, ProjectionStats } from "../types/draft";
import type { LeagueSettings } from "../types/league";
import { scorePlayerProjection } from "./projections/scoreProjection";

export function hasProjectionStats(stats: ProjectionStats | undefined): boolean {
  if (!stats) {
    return false;
  }

  return Object.values(stats).some((value) => typeof value === "number" && value !== 0);
}

export function hasUsableProjections(player: Player): boolean {
  if (player.projectionsAvailable === false) {
    return false;
  }
  if (player.projection) {
    return true;
  }
  return hasProjectionStats(player.stats) || player.projectedPoints > 0;
}

export function hasMeaningfulReturnUsage(stats: ProjectionStats | undefined): boolean {
  if (!stats) {
    return false;
  }

  return (stats.returnYards ?? 0) >= 80 || (stats.returnTD ?? 0) > 0;
}

export function calculateProjectedPoints(
  stats: ProjectionStats,
  league: LeagueSettings,
): number {
  const offense = league.offensiveScoring;
  let points = 0;

  points += (stats.passYards ?? 0) / offense.passingYardsPerPoint;
  points += (stats.passTD ?? 0) * offense.passingTd;
  points += (stats.interceptions ?? 0) * offense.interception;
  points += (stats.rushYards ?? 0) / offense.rushingYardsPerPoint;
  points += (stats.rushTD ?? 0) * offense.rushingTd;
  points += (stats.receptions ?? 0) * offense.reception;
  points += (stats.receivingYards ?? 0) / offense.receivingYardsPerPoint;
  points += (stats.receivingTD ?? 0) * offense.receivingTd;
  points += (stats.twoPointConversions ?? 0) * offense.twoPointConversion;
  points += (stats.fumbles ?? 0) * offense.fumbleLost;
  points += (stats.offensiveFumbleReturnTd ?? 0) * offense.offensiveFumbleReturnTd;
  points += (stats.returnYards ?? 0) / offense.returnYardsPerPoint;
  points += (stats.returnTD ?? 0) * offense.returnTd;

  return league.fractionalScoring ? points : Math.round(points);
}

export function applyLeagueProjections(
  players: Player[],
  league: LeagueSettings,
): Player[] {
  return players.map((player) => {
    if (player.projection) {
      const scored = scorePlayerProjection(player.projection, league);
      return {
        ...player,
        sourceProjectedPoints: player.sourceProjectedPoints ?? scored.points,
        projectionSource: "league" as const,
        projectedPoints: scored.points,
        leagueAdjustedProjectedPoints: scored.points,
        projectionsAvailable: true,
        kickerProjectedPointsPartial: scored.kickerProjectedPointsPartial,
        defenseProjectedPointsPartial: scored.defenseProjectedPointsPartial,
        kickerScoringIncomplete: scored.kickerFieldGoalsIncomplete,
        defenseScoringIncomplete: scored.defensePointsAllowedIncomplete,
      };
    }

    const sourceProjectedPoints = player.sourceProjectedPoints ?? player.projectedPoints;
    if (!hasProjectionStats(player.stats)) {
      return {
        ...player,
        sourceProjectedPoints,
        projectionSource: "source" as const,
        projectedPoints: sourceProjectedPoints,
      };
    }

    const leaguePoints = calculateProjectedPoints(player.stats!, league);
    return {
      ...player,
      sourceProjectedPoints,
      projectionSource: "league" as const,
      projectedPoints: leaguePoints,
      leagueAdjustedProjectedPoints: leaguePoints,
      projectionsAvailable: true,
    };
  });
}
