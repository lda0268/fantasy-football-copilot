import type { ProjectionStats } from "../../types/draft";
import type { LeagueSettings } from "../../types/league";
import type { PlayerProjection, ProjectionScore } from "../../types/projections";

/**
 * 2-point conversions: pass-2pt, rush-2pt, and rec-2pt are treated as
 * independent projected conversion counts (different plays), then scored
 * once each at the league 2-point value. They are never counted as both
 * a TD and a conversion.
 */
export function combinedTwoPointConversions(projection: PlayerProjection): number {
  return (
    (projection.passing?.twoPointConversions ?? 0) +
    (projection.rushing?.twoPointConversions ?? 0) +
    (projection.receiving?.twoPointConversions ?? 0)
  );
}

export function combinedReturnYards(projection: PlayerProjection): number {
  return (projection.returns?.puntReturnYards ?? 0) + (projection.returns?.kickReturnYards ?? 0);
}

export function combinedReturnTouchdowns(projection: PlayerProjection): number {
  return (
    (projection.returns?.puntReturnTouchdowns ?? 0) + (projection.returns?.kickReturnTouchdowns ?? 0)
  );
}

export function toProjectionStats(projection: PlayerProjection): ProjectionStats {
  return {
    passYards: projection.passing?.yards,
    passTD: projection.passing?.touchdowns,
    interceptions: projection.passing?.interceptions,
    rushYards: projection.rushing?.yards,
    rushTD: projection.rushing?.touchdowns,
    receptions: projection.receiving?.receptions,
    receivingYards: projection.receiving?.yards,
    receivingTD: projection.receiving?.touchdowns,
    returnYards: combinedReturnYards(projection) || undefined,
    returnTD: combinedReturnTouchdowns(projection) || undefined,
    fumbles: projection.fumblesLost,
    twoPointConversions: combinedTwoPointConversions(projection) || undefined,
  };
}

export function scoreOffensiveProjection(
  projection: PlayerProjection,
  league: LeagueSettings,
): number {
  const offense = league.offensiveScoring;
  let points = 0;
  points += (projection.passing?.yards ?? 0) / offense.passingYardsPerPoint;
  points += (projection.passing?.touchdowns ?? 0) * offense.passingTd;
  points += (projection.passing?.interceptions ?? 0) * offense.interception;
  points += (projection.rushing?.yards ?? 0) / offense.rushingYardsPerPoint;
  points += (projection.rushing?.touchdowns ?? 0) * offense.rushingTd;
  points += (projection.receiving?.receptions ?? 0) * offense.reception;
  points += (projection.receiving?.yards ?? 0) / offense.receivingYardsPerPoint;
  points += (projection.receiving?.touchdowns ?? 0) * offense.receivingTd;
  points += combinedTwoPointConversions(projection) * offense.twoPointConversion;
  points += (projection.fumblesLost ?? 0) * offense.fumbleLost;
  points += combinedReturnYards(projection) / offense.returnYardsPerPoint;
  points += combinedReturnTouchdowns(projection) * offense.returnTd;
  return points;
}

export function scoreKickerPartial(
  projection: PlayerProjection,
  league: LeagueSettings,
): { points: number; fieldGoalsIncomplete: boolean } {
  const extraPoints = (projection.kicking?.extraPointsMade ?? 0) * league.kickerScoring.patMade;
  const hasFgTotals =
    (projection.kicking?.fieldGoalsMade ?? 0) > 0 || (projection.kicking?.fieldGoalsAttempted ?? 0) > 0;
  return {
    points: extraPoints,
    fieldGoalsIncomplete: hasFgTotals || projection.position === "K",
  };
}

export function scoreDefensePartial(
  projection: PlayerProjection,
  league: LeagueSettings,
): { points: number; pointsAllowedIncomplete: boolean } {
  const defense = league.defenseScoring;
  const stats = projection.teamDefense;
  let points = 0;
  points += (stats?.sacks ?? 0) * defense.sack;
  points += (stats?.interceptions ?? 0) * defense.interception;
  points += (stats?.fumbleRecoveries ?? 0) * defense.fumbleRecovery;
  points += (stats?.touchdowns ?? 0) * defense.defensiveTd;
  points += (stats?.safeties ?? 0) * defense.safety;
  points += (stats?.blockedKicks ?? 0) * defense.blockedKick;
  const hasSeasonPointsAllowed = (stats?.pointsAllowed ?? 0) > 0;
  return {
    points,
    pointsAllowedIncomplete: hasSeasonPointsAllowed || projection.position === "DEF",
  };
}

export function scorePlayerProjection(
  projection: PlayerProjection,
  league: LeagueSettings,
): ProjectionScore {
  const twoPointConversions = combinedTwoPointConversions(projection);
  let points = scoreOffensiveProjection(projection, league);
  const kicker = scoreKickerPartial(projection, league);
  const defense = scoreDefensePartial(projection, league);

  if (projection.position === "K") {
    points += kicker.points;
  }
  if (projection.position === "DEF") {
    points += defense.points;
  }

  if (!league.fractionalScoring) {
    points = Math.round(points);
  }

  return {
    points,
    kickerProjectedPointsPartial: projection.position === "K" ? kicker.points : undefined,
    defenseProjectedPointsPartial: projection.position === "DEF" ? defense.points : undefined,
    kickerFieldGoalsIncomplete: projection.position === "K" && kicker.fieldGoalsIncomplete,
    defensePointsAllowedIncomplete: projection.position === "DEF" && defense.pointsAllowedIncomplete,
    twoPointConversions,
  };
}
