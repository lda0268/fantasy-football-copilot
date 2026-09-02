import type { DraftPick, Player, Position } from "../types/draft";
import { getMarketAdp } from "./data/sourceFields";

const SKILL_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DEF"];

export interface DraftLearning {
  pickCount: number;
  meanReach: number;
  positionMeanReach: Partial<Record<Position, number>>;
  runPosition: Position | null;
  runLength: number;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function learnFromDraft(picks: DraftPick[], players: Player[]): DraftLearning {
  const byId = new Map(players.map((player) => [player.id, player]));
  const reaches: number[] = [];
  const byPosition: Partial<Record<Position, number[]>> = {};

  for (const pick of picks) {
    const player = byId.get(pick.playerId);
    const adp = player ? getMarketAdp(player) : undefined;
    if (adp === undefined) {
      continue;
    }
    const reach = pick.overallPick - adp;
    reaches.push(reach);
    const list = byPosition[pick.position] ?? [];
    list.push(reach);
    byPosition[pick.position] = list;
  }

  const recent = picks.slice(-6);
  let runPosition: Position | null = null;
  let runLength = 0;
  for (const position of SKILL_POSITIONS) {
    const length = recent.filter((pick) => pick.position === position).length;
    if (length >= 3 && length > runLength) {
      runPosition = position;
      runLength = length;
    }
  }

  const positionMeanReach: Partial<Record<Position, number>> = {};
  for (const position of SKILL_POSITIONS) {
    const values = byPosition[position];
    if (values && values.length > 0) {
      positionMeanReach[position] = average(values);
    }
  }

  return {
    pickCount: picks.length,
    meanReach: average(reaches),
    positionMeanReach,
    runPosition,
    runLength,
  };
}

export function learningSampleConfidence(learning: DraftLearning): number {
  if (learning.pickCount <= 2) {
    return 0;
  }
  return Math.min(1, (learning.pickCount - 2) / 10);
}

export function emptyDraftLearning(): DraftLearning {
  return {
    pickCount: 0,
    meanReach: 0,
    positionMeanReach: {},
    runPosition: null,
    runLength: 0,
  };
}
