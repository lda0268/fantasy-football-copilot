import type { Player } from "../../types/draft";
import { ADP_VALUE_WINDOW } from "../constants";
import { clamp } from "../math";

export function getExpertOverallRank(player: Player): number | undefined {
  const rank = player.expert?.overallRank ?? player.expertOverallRank ?? player.espnOverallRank;
  return typeof rank === "number" && rank > 0 ? rank : undefined;
}

export function getExpertPositionalRank(player: Player): number | undefined {
  const rank = player.expert?.positionalRank ?? player.expertPositionalRank ?? player.espnPositionalRank;
  return typeof rank === "number" && rank > 0 ? rank : undefined;
}

export function getMarketAdp(player: Player): number | undefined {
  const adp = player.market?.adp ?? player.adp;
  if (typeof adp !== "number" || Number.isNaN(adp) || adp <= 0) {
    return undefined;
  }
  return adp;
}

export function getPositionalAdp(player: Player): number | undefined {
  const positional = player.market?.positionalAdp ?? player.positionalAdp;
  if (typeof positional !== "number" || Number.isNaN(positional) || positional <= 0) {
    return undefined;
  }
  return positional;
}

export function calculateAdpDelta(adp: number, currentOverallPick: number): number {
  return adp - currentOverallPick;
}

export function normalizeAdpValue(adpDelta: number): number {
  return clamp(0.5 + adpDelta / (ADP_VALUE_WINDOW * 2), 0.15, 0.85);
}

export function marketAdpScore(
  player: Player,
  currentOverallPick: number,
): { delta: number | null; score: number } {
  const adp = getMarketAdp(player);
  if (adp === undefined) {
    return { delta: null, score: 0.5 };
  }

  const delta = calculateAdpDelta(adp, currentOverallPick);
  return { delta, score: normalizeAdpValue(delta) };
}

export function formatMarketAdp(player: Player): string {
  const adp = getMarketAdp(player);
  return adp === undefined ? "—" : adp.toFixed(1);
}

export function formatExpertRank(player: Player): string {
  const rank = getExpertOverallRank(player);
  return rank === undefined ? "—" : String(Math.round(rank));
}

export function formatProjectedPoints(
  player: Player,
  scored?: { leagueAdjustedProjectedPoints?: number },
): string {
  const points = scored?.leagueAdjustedProjectedPoints ?? player.leagueAdjustedProjectedPoints ?? (
    player.projectionsAvailable ? player.projectedPoints : undefined
  );
  if (typeof points !== "number" || Number.isNaN(points)) {
    return "—";
  }
  const label = points.toFixed(1);
  if (player.kickerScoringIncomplete || player.defenseScoringIncomplete) {
    return `${label}*`;
  }
  return label;
}

export function expertRankScore(player: Player, universe: Player[]): number {
  const rank = getExpertOverallRank(player);
  if (rank === undefined) {
    return 0.5;
  }

  const ranks = universe
    .map((item) => getExpertOverallRank(item))
    .filter((value): value is number => value !== undefined);
  if (ranks.length === 0) {
    return 0.5;
  }

  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  if (maxRank <= minRank) {
    return 0.5;
  }

  return clamp(1 - (rank - minRank) / (maxRank - minRank), 0, 1);
}
