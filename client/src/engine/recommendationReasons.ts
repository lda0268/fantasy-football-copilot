import type { Player } from "../types/draft";
import type { LeagueSettings } from "../types/league";
import { clamp } from "./math";
import { hasMeaningfulReturnUsage } from "./scoring";
import { getExpertOverallRank, getMarketAdp } from "./data/sourceFields";

export function buildRecommendationReasons(params: {
  player: Player;
  league: LeagueSettings;
  vor: number;
  vorScore: number;
  pointsToNextTier: number;
  tier: number;
  scarcity: number;
  survivalProbability: number;
  starterOpen: boolean;
  superflexOpen: boolean;
  reliableQbsRemaining: number;
  qbNeed: number;
  adpDelta: number | null;
  leagueAdjustedRank: number;
  predictedTaken?: boolean;
  predictedByTeamSlot?: number;
  nextBestIfWait?: string;
  runWarning?: string;
}): string[] {
  const { player, league } = params;
  const candidates: Array<{ reason: string; weight: number }> = [];
  const projected = player.leagueAdjustedProjectedPoints ?? player.projectedPoints;
  const projectionsOn = player.projectionsAvailable !== false && projected > 0;

  if (projectionsOn) {
    candidates.push({
      reason: `Projected ${projected.toFixed(1)} points in your scoring`,
      weight: 0.97,
    });
    candidates.push({
      reason: `${params.vor >= 0 ? "+" : ""}${params.vor.toFixed(1)} points over replacement`,
      weight: 0.96,
    });
  }
  if (player.position === "QB" && params.tier === 1) {
    candidates.push({ reason: "Elite QB tier", weight: 0.9 });
  }
  if (player.position === "QB" && league.rosterSlots.SUPERFLEX > 0) {
    candidates.push({ reason: "Superflex scarcity", weight: 0.78 });
  }
  if (params.predictedTaken && params.predictedByTeamSlot) {
    candidates.push({
      reason: `Likely drafted by team ${params.predictedByTeamSlot} before your next pick`,
      weight: 0.93,
    });
  }
  if (params.runWarning) {
    candidates.push({ reason: params.runWarning, weight: 0.9 });
  }
  if (params.survivalProbability <= 0.35) {
    candidates.push({ reason: "Low probability to survive next turn", weight: 0.91 });
  }
  if (params.nextBestIfWait && params.survivalProbability < 0.5) {
    candidates.push({
      reason: `If you wait, next best is ${params.nextBestIfWait}`,
      weight: 0.74,
    });
  }
  if (player.position === "QB" && league.rosterSlots.SUPERFLEX > 0 && params.vorScore >= 0.7) {
    candidates.push({ reason: "Elite Superflex QB value", weight: 0.88 });
  }
  if (params.vorScore >= 0.78) {
    candidates.push({ reason: "High VOR in this league", weight: 0.85 });
  }
  if (params.adpDelta !== null && params.adpDelta >= 6) {
    candidates.push({ reason: "Strong consensus ADP value", weight: 0.8 });
  }
  if (
    params.adpDelta !== null &&
    params.leagueAdjustedRank > 0 &&
    Math.round((getMarketAdp(player) ?? 0) - params.leagueAdjustedRank) >= 8
  ) {
    const gap = Math.round((getMarketAdp(player) ?? 0) - params.leagueAdjustedRank);
    candidates.push({ reason: `Market is ${gap} picks lower than our value`, weight: 0.86 });
  }
  if (player.position === "WR" && params.pointsToNextTier >= 10) {
    candidates.push({ reason: "Large WR tier drop approaching", weight: 0.84 });
  }
  if (player.position === "RB" && params.pointsToNextTier >= 12) {
    candidates.push({ reason: "Large RB tier drop approaching", weight: 0.84 });
  }
  if (player.position === "QB" && league.offensiveScoring.passingTd >= 6 && params.vorScore >= 0.45) {
    candidates.push({ reason: "6-point passing TD format increases QB value", weight: 0.7 });
  }
  if (player.position === "QB" && params.reliableQbsRemaining <= 6 && params.qbNeed > 0) {
    candidates.push({
      reason: `Only ${params.reliableQbsRemaining} viable QB2 options remain`,
      weight: 0.88,
    });
  }
  if (
    (player.position === "WR" || player.position === "RB" || player.position === "TE") &&
    (player.stats?.receptions ?? 0) >= 70 &&
    league.offensiveScoring.reception >= 1
  ) {
    candidates.push({ reason: "Full-PPR target volume", weight: 0.72 });
  }
  if (player.position === "WR" && league.rosterSlots.WR >= 3) {
    candidates.push({ reason: "WR scarcity: 3 starters required", weight: 0.7 + params.scarcity * 0.2 });
  }
  if (player.position === "TE" && params.scarcity >= 0.45) {
    candidates.push({ reason: "Positional scarcity at TE", weight: 0.68 });
  }
  if (hasMeaningfulReturnUsage(player.stats)) {
    candidates.push({ reason: "Return-yard scoring adds extra value", weight: 0.5 });
  }
  if (params.starterOpen) {
    candidates.push({
      reason: `Fills starting ${player.position} need`,
      weight: 0.83,
    });
  } else if (params.superflexOpen && player.position === "QB") {
    candidates.push({ reason: "Strong Superflex QB utility", weight: 0.7 });
  }
  if (getExpertOverallRank(player) !== undefined && getMarketAdp(player) !== undefined) {
    candidates.push({
      reason: `${Math.round(params.survivalProbability * 100)}% chance available next turn`,
      weight: clamp(0.3 + params.survivalProbability * 0.15, 0, 0.45),
    });
  }

  candidates.push({
    reason: `League-adjusted projection at ${player.position}`,
    weight: 0.22,
  });
  candidates.push({
    reason: `Ranked #${Math.max(params.leagueAdjustedRank, 1)} on league analytics`,
    weight: 0.18,
  });

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((item) => item.reason);
}
