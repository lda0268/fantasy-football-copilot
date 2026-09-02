import type { Player, Position } from "../types/draft";
import type { LeagueDemand } from "./leagueDemand";
import { clamp } from "./math";

export interface OpportunityCostInput {
  player: Player;
  survivalProbability: number;
  availablePlayers: Player[];
  vorById: Map<string, number>;
  leagueDemand: LeagueDemand;
  remainingAfterWindow?: Player[];
}

function bestAtPosition(players: Player[], position: Position): Player | undefined {
  let best: Player | undefined;
  for (const player of players) {
    if (player.position !== position) {
      continue;
    }
    if (!best || player.projectedPoints > best.projectedPoints) {
      best = player;
    }
  }
  return best;
}

function bestOtherPosition(players: Player[], excludeId: string, excludePosition: Position): Player | undefined {
  let best: Player | undefined;
  for (const player of players) {
    if (player.id === excludeId || player.position === excludePosition) {
      continue;
    }
    if (player.position === "K" || player.position === "DEF") {
      continue;
    }
    if (!best || player.projectedPoints > best.projectedPoints) {
      best = player;
    }
  }
  return best;
}

export function positionalWaitLoss(input: {
  player: Player;
  remainingAfterWindow: Player[];
}): number {
  const waitBest = bestAtPosition(
    input.remainingAfterWindow.filter((item) => item.id !== input.player.id),
    input.player.position,
  );
  return Math.max(0, input.player.projectedPoints - (waitBest?.projectedPoints ?? 0));
}

export function calculateOpportunityCost(input: OpportunityCostInput): number {
  const survivalCost = 1 - input.survivalProbability;
  const remaining = (input.remainingAfterWindow ?? input.availablePlayers).filter(
    (player) => player.id !== input.player.id,
  );
  const waitLoss = positionalWaitLoss({ player: input.player, remainingAfterWindow: remaining });
  const waitDrop = clamp(waitLoss / 70, 0, 1);

  const bestOtherNow = bestOtherPosition(input.availablePlayers, input.player.id, input.player.position);
  const otherWait = bestOtherNow
    ? bestAtPosition(remaining, bestOtherNow.position)?.projectedPoints ?? 0
    : 0;
  const takeNowSeq = input.player.projectedPoints + otherWait;
  const takeOtherSeq = (bestOtherNow?.projectedPoints ?? 0) + (bestAtPosition(remaining, input.player.position)?.projectedPoints ?? 0);
  const seqEdge = clamp((takeNowSeq - takeOtherSeq) / 90, -1, 1);
  const seqComponent = clamp(0.5 + seqEdge / 2, 0, 1);

  if (input.player.position !== "QB") {
    return clamp(survivalCost * 0.72 + waitDrop * 0.18 + Math.max(0, seqEdge) * 0.1, 0, 1);
  }

  const reliableQbs = input.availablePlayers.filter(
    (player) => player.position === "QB" && (input.vorById.get(player.id) ?? 0) > 40,
  );
  const qbNeed =
    input.leagueDemand.teamsNeedingQb1 + input.leagueDemand.teamsNeedingQb2OrSuperflex;
  const tightness = clamp(1 - reliableQbs.length / Math.max(qbNeed, 1), 0, 1);
  const isReliable = (input.vorById.get(input.player.id) ?? 0) > 0;
  const qbPremium = isReliable ? tightness : tightness * 0.15;

  return clamp(survivalCost * 0.32 + qbPremium * 0.22 + waitDrop * 0.28 + seqComponent * 0.18, 0, 1);
}
