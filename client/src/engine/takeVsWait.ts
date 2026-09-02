import type { Player } from "../types/draft";
import type { LeagueDemand } from "./leagueDemand";
import { clamp } from "./math";
import { getMarketAdp } from "./data/sourceFields";
import type { DraftLearning } from "./draftLearning";
import type { DraftWindowSimulation } from "./draftSequence";
import { estimateSurvivalProbability } from "./survivalProbability";
import type { PlayerTier } from "./tiers";

export type TakeWaitLabel = "TAKE NOW" | "WAIT POSSIBLE" | "STRONG VALUE" | "HIGH RISK TO WAIT";

export interface TakeVsWaitAnalysis {
  survivalProbability: number;
  replacementQualityIfWait: number;
  tierDropBeforeNextPick: number;
  positionalDemandBeforeNextPick: number;
  opportunityCost: number;
  picksUntilNextSelection: number;
  marketAdp?: number;
  recommendationScore: number;
  label: TakeWaitLabel;
  predictedTaken: boolean;
  predictedByTeamSlot?: number;
  nextBestIfWait?: string;
  nextBestIfWaitVorDrop?: number;
  leagueNeedSummary?: string;
  runWarning?: string;
  analyticalSurvivalProbability: number;
  monteCarloSurvivalProbability?: number;
  monteCarloTierSurvival?: number;
  monteCarloTakeEv?: number;
  monteCarloWaitEv?: number;
  monteCarloEvDelta?: number;
  monteCarloDecision?: "TAKE NOW" | "LEAN TAKE" | "WAIT POSSIBLE" | "SAFE TO WAIT";
}

export function classifyTakeWait(input: {
  survivalProbability: number;
  adpDelta: number | null;
  picksUntilUserPick: number;
  vorScore: number;
  predictedTaken?: boolean;
  onTheClock?: boolean;
}): TakeWaitLabel {
  if (input.onTheClock || input.picksUntilUserPick <= 0) {
    return input.vorScore >= 0.55 ? "TAKE NOW" : "STRONG VALUE";
  }
  if (input.predictedTaken || input.survivalProbability < 0.28) {
    return "HIGH RISK TO WAIT";
  }
  if (input.survivalProbability < 0.45) {
    return "TAKE NOW";
  }
  if (input.adpDelta !== null && input.adpDelta >= 8 && input.survivalProbability >= 0.5) {
    return "STRONG VALUE";
  }
  if (input.survivalProbability >= 0.58) {
    return "WAIT POSSIBLE";
  }
  return "TAKE NOW";
}

export function analyzeTakeVsWait(input: {
  player: Player;
  currentPick: number;
  picksUntilUserPick: number;
  availablePlayers: Player[];
  vorById: Map<string, number>;
  tiersById: Map<string, PlayerTier>;
  leagueDemand: LeagueDemand;
  opportunityCost: number;
  recommendationScore?: number;
  vorScore?: number;
  learning?: DraftLearning;
  sequence?: DraftWindowSimulation;
  leagueNeedSummary?: string;
  onTheClock?: boolean;
}): TakeVsWaitAnalysis {
  const analyticalSurvivalProbability = estimateSurvivalProbability({
    player: input.player,
    currentPick: input.currentPick,
    picksUntilUserPick: input.picksUntilUserPick,
    learning: input.learning,
  });
  let survivalProbability = analyticalSurvivalProbability;

  const predicted = input.sequence?.predictedPicks.find((pick) => pick.player.id === input.player.id);
  const predictedTaken = Boolean(predicted);
  if (predictedTaken) {
    survivalProbability = Math.min(survivalProbability, 0.2);
  } else if (input.sequence && input.picksUntilUserPick > 0) {
    survivalProbability = clamp(survivalProbability + 0.1, 0.04, 0.97);
  }

  const remaining = input.sequence?.remaining ?? input.availablePlayers;
  const samePosition = remaining
    .filter((player) => player.position === input.player.position && player.id !== input.player.id)
    .sort((a, b) => (input.vorById.get(b.id) ?? 0) - (input.vorById.get(a.id) ?? 0));
  const nextBest = samePosition[0];
  const playerVor = input.vorById.get(input.player.id) ?? 0;
  const nextVor = nextBest ? (input.vorById.get(nextBest.id) ?? 0) : 0;
  const replacementQualityIfWait = playerVor - nextVor;
  const tierDropBeforeNextPick = input.tiersById.get(input.player.id)?.pointsToNextTier ?? 0;
  const marketAdp = getMarketAdp(input.player);
  const adpDelta = marketAdp === undefined ? null : marketAdp - input.currentPick;

  const demand =
    input.player.position === "QB"
      ? input.leagueDemand.teamsNeedingQb1 + input.leagueDemand.teamsNeedingQb2OrSuperflex
      : input.player.position === "RB"
        ? input.leagueDemand.teamsNeedingRbStarters
        : input.player.position === "WR"
          ? input.leagueDemand.teamsNeedingWrStarters
          : Math.ceil(input.leagueDemand.flexSpotsRemaining / 2);

  const positionalDemandBeforeNextPick = clamp(
    demand / Math.max(input.picksUntilUserPick, 1),
    0,
    1,
  );

  const runWarning =
    input.learning?.runPosition === input.player.position
      ? `${input.player.position} run in progress (${input.learning.runLength} of last 6)`
      : undefined;

  return {
    survivalProbability,
    replacementQualityIfWait,
    tierDropBeforeNextPick,
    positionalDemandBeforeNextPick,
    opportunityCost: input.opportunityCost,
    picksUntilNextSelection: input.picksUntilUserPick,
    marketAdp,
    recommendationScore: input.recommendationScore ?? 0,
    predictedTaken,
    predictedByTeamSlot: predicted?.teamSlot,
    nextBestIfWait: nextBest?.name,
    nextBestIfWaitVorDrop: nextBest ? Math.round(replacementQualityIfWait) : undefined,
    leagueNeedSummary: input.leagueNeedSummary,
    runWarning,
    analyticalSurvivalProbability,
    label: classifyTakeWait({
      survivalProbability,
      adpDelta,
      picksUntilUserPick: input.picksUntilUserPick,
      vorScore: input.vorScore ?? 0.5,
      predictedTaken,
      onTheClock: input.onTheClock,
    }),
  };
}
