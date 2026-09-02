import type { Position } from "../../types/draft";
import type { LeagueSettings } from "../../types/league";
import type { DraftLearning } from "../draftLearning";
import { learningSampleConfidence } from "../draftLearning";
import { getRoundForPick } from "../draftOrder";
import { clamp } from "../math";
import type { SimPlayer } from "./types";

export interface TeamCounts {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
}

export function emptyTeamCounts(): TeamCounts {
  return { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
}

export function cloneTeamCounts(counts: TeamCounts): TeamCounts {
  return { ...counts };
}

export function addPlayerToCounts(counts: TeamCounts, position: Position): void {
  counts[position] += 1;
}

export function plausibleWindow(
  remaining: number[],
  players: SimPlayer[],
  currentPick: number,
  windowSize: number,
): number[] {
  const ranked: Array<{ index: number; rank: number }> = [];
  for (const index of remaining) {
    const player = players[index];
    const adpGap = player.adp - currentPick;
    if (adpGap > 32 && player.vor < 55) {
      continue;
    }
    const reachGap = adpGap < 0 ? -adpGap * 0.35 : adpGap;
    const vorBoost = player.vor > 80 ? -6 : player.vor > 40 ? -2 : 0;
    ranked.push({ index, rank: reachGap + vorBoost });
  }
  const pool = ranked.length >= 8 ? ranked : remaining.map((index) => ({ index, rank: 0 }));
  pool.sort((a, b) => a.rank - b.rank);
  return pool.slice(0, Math.max(8, windowSize)).map((item) => item.index);
}

export function opponentNeedMultiplier(
  counts: TeamCounts,
  position: Position,
  round: number,
  league: LeagueSettings,
): number {
  if (position === "QB") {
    if (counts.QB === 0) {
      return league.rosterSlots.SUPERFLEX > 0 ? 1.75 : 1.45;
    }
    if (counts.QB === 1) {
      return league.rosterSlots.SUPERFLEX > 0 ? 1.32 : 0.55;
    }
    if (counts.QB === 2) {
      return 0.48;
    }
    return 0.22;
  }
  if (position === "RB") {
    if (counts.RB < league.rosterSlots.RB) {
      return 1.42;
    }
    if (counts.RB < league.rosterSlots.RB + league.rosterSlots.FLEX + 1) {
      return 1.12;
    }
    return 0.72;
  }
  if (position === "WR") {
    if (counts.WR < league.rosterSlots.WR) {
      return 1.4;
    }
    if (counts.WR < league.rosterSlots.WR + league.rosterSlots.FLEX + 1) {
      return 1.1;
    }
    return 0.74;
  }
  if (position === "TE") {
    if (counts.TE === 0) {
      return 1.35;
    }
    if (counts.TE === 1) {
      return 0.88;
    }
    return 0.55;
  }
  const hole = counts[position] === 0;
  if (round < 9) {
    return hole ? 0.14 : 0.08;
  }
  return hole ? 1.2 : 0.35;
}

export function opponentPickWeight(input: {
  player: SimPlayer;
  currentPick: number;
  teamCount: number;
  counts: TeamCounts;
  learning: DraftLearning;
  league: LeagueSettings;
  vorMin: number;
  vorMax: number;
}): number {
  const round = getRoundForPick(input.currentPick, input.teamCount);
  const sigma = 6 + input.player.adp * 0.06;
  const market = 1 / (1 + Math.exp((input.player.adp - input.currentPick - 2.5) / sigma));
  const need = opponentNeedMultiplier(input.counts, input.player.position, round, input.league);
  const confidence = learningSampleConfidence(input.learning);
  let run = 1;
  if (input.learning.runPosition === input.player.position) {
    run += 0.08 * input.learning.runLength * confidence;
  }
  const positionReach = input.learning.positionMeanReach[input.player.position] ?? input.learning.meanReach;
  if (positionReach < -4) {
    run += 0.1 * confidence;
  }
  const vorNorm = input.vorMax <= input.vorMin
    ? 0.5
    : clamp((input.player.vor - input.vorMin) / (input.vorMax - input.vorMin), 0, 1);
  const value = 0.78 + vorNorm * 0.45;
  const positional = input.player.positionalAdp !== undefined && input.player.positionalAdp <= 3
    ? 1.08
    : 1;
  return Math.max(0.0001, market * need * clamp(run, 0.7, 1.4) * value * positional);
}

export function userDecisionScore(
  player: SimPlayer,
  counts: TeamCounts,
  round: number,
  league: LeagueSettings,
): number {
  return player.vor + 28 * opponentNeedMultiplier(counts, player.position, round, league);
}
