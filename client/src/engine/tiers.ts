import type { Player, Position } from "../types/draft";
import { MIN_TIER_GAP, TIER_GAP_MULTIPLIER } from "./constants";
import { clamp, median } from "./math";
import { playersAtPosition } from "./players";

export interface PlayerTier {
  playerId: string;
  tier: number;
  pointsToNextTier: number;
  tierScarcity: number;
}

export function detectPositionalTiers(players: Player[], position: Position): PlayerTier[] {
  const ranked = [...playersAtPosition(players, position)].sort(
    (a, b) => b.projectedPoints - a.projectedPoints,
  );

  if (ranked.length === 0) {
    return [];
  }

  const gaps = ranked.slice(0, -1).map((player, index) => {
    return player.projectedPoints - ranked[index + 1].projectedPoints;
  });
  const typicalGap = median(gaps);
  const threshold = Math.max(MIN_TIER_GAP, typicalGap * TIER_GAP_MULTIPLIER);

  const tierByIndex: number[] = [];
  let tier = 1;

  ranked.forEach((player, index) => {
    tierByIndex[index] = tier;
    const gap = index < ranked.length - 1
      ? player.projectedPoints - ranked[index + 1].projectedPoints
      : 0;
    if (gap >= threshold) {
      tier += 1;
    }
  });

  const firstIndexOfTier = new Map<number, number>();
  ranked.forEach((_player, index) => {
    const assigned = tierByIndex[index];
    if (!firstIndexOfTier.has(assigned)) {
      firstIndexOfTier.set(assigned, index);
    }
  });

  return ranked.map((player, index) => {
    const assigned = tierByIndex[index];
    const nextTierIndex = firstIndexOfTier.get(assigned + 1);
    const nextTierLeader = nextTierIndex === undefined ? null : ranked[nextTierIndex];
    const pointsToNextTier = nextTierLeader
      ? player.projectedPoints - nextTierLeader.projectedPoints
      : 0;

    return {
      playerId: player.id,
      tier: assigned,
      pointsToNextTier,
      tierScarcity: clamp(pointsToNextTier / 25, 0, 1),
    };
  });
}

export function detectAllTiers(players: Player[]): Map<string, PlayerTier> {
  const result = new Map<string, PlayerTier>();
  const positions: Position[] = ["QB", "RB", "WR", "TE", "K", "DEF"];

  for (const position of positions) {
    for (const tier of detectPositionalTiers(players, position)) {
      result.set(tier.playerId, tier);
    }
  }

  return result;
}
