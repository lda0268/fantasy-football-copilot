import type { Player } from "../types/draft";
import { clamp } from "./math";
import { getMarketAdp, getPositionalAdp } from "./data/sourceFields";
import type { DraftLearning } from "./draftLearning";

export interface SurvivalInput {
  player: Player;
  currentPick: number;
  picksUntilUserPick: number;
  learning?: DraftLearning;
}

export function estimateSurvivalProbability(input: SurvivalInput): number {
  const { player, currentPick, picksUntilUserPick } = input;

  if (picksUntilUserPick <= 0) {
    return 1;
  }

  const adp = getMarketAdp(player);
  if (adp === undefined) {
    return 0.5;
  }

  const windowEnd = currentPick + picksUntilUserPick - 1;
  const positional = getPositionalAdp(player);
  let expected = positional !== undefined && positional <= 3 && adp > currentPick + 6
    ? adp * 0.9
    : adp;

  const learning = input.learning;
  if (learning) {
    const positionReach = learning.positionMeanReach[player.position] ?? learning.meanReach;
    expected += positionReach * 0.35;
    if (learning.runPosition === player.position) {
      expected -= 3 + learning.runLength;
    }
  }

  const sigma = 5.5 + adp * 0.08;
  const distance = expected - windowEnd;
  const logistic = 1 / (1 + Math.exp(-distance / sigma));
  return clamp(logistic, 0.04, 0.97);
}

export function survivalPercent(probability: number): number {
  return Math.round(probability * 100);
}

export function formatSurvivalProbability(probability: number): string {
  return `${survivalPercent(probability)}%`;
}
