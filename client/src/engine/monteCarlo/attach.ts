import type { DraftPick, Player, RosterSlot } from "../../types/draft";
import type { LeagueSettings } from "../../types/league";
import type { DraftLearning } from "../draftLearning";
import type { LeagueRosters } from "../opponentRosters";
import type { Recommendation } from "../recommendations";
import { stableSeedFromKey } from "./rng";
import { runMonteCarloDraft, type MonteCarloInput } from "./simulate";
import type { MonteCarloResult } from "./types";

export function attachMonteCarlo(
  recommendations: Recommendation[],
  result: MonteCarloResult,
): Recommendation[] {
  const survivalById = new Map(result.playerSurvival.map((item) => [item.playerId, item]));
  const candidateById = new Map(result.candidates.map((item) => [item.playerId, item]));

  return recommendations.map((item) => {
    const survival = survivalById.get(item.player.id);
    const candidate = candidateById.get(item.player.id);
    const reasons = [...item.reasons];
    if (candidate && Math.abs(candidate.evDelta) >= 3) {
      const delta = candidate.evDelta >= 0 ? `+${candidate.evDelta.toFixed(1)}` : candidate.evDelta.toFixed(1);
      reasons.unshift(
        `Taking this player now produces ${delta} expected 2-pick VOR versus waiting`,
      );
    }
    return {
      ...item,
      monteCarlo: candidate,
      monteCarloSurvival: survival,
      takeVsWait: {
        ...item.takeVsWait,
        monteCarloSurvivalProbability: survival?.probability,
        monteCarloTierSurvival: survival?.tierSurvivalProbability,
        monteCarloTakeEv: candidate?.takeNow.mean,
        monteCarloWaitEv: candidate?.wait.mean,
        monteCarloEvDelta: candidate?.evDelta,
        monteCarloDecision: candidate?.decision,
      },
    };
  });
}

export function runAttachedMonteCarlo(input: {
  recommendations: Recommendation[];
  availablePlayers: Player[];
  currentPick: number;
  userSlot: number;
  teamCount: number;
  userRoster: RosterSlot[];
  leagueRosters: LeagueRosters;
  vorById: Map<string, number>;
  tiersById: Map<string, { tier: number }>;
  picks: DraftPick[];
  learning: DraftLearning;
  league: LeagueSettings;
  seed?: number;
}): { recommendations: Recommendation[]; result: MonteCarloResult } {
  const candidateIds = input.recommendations.slice(0, 8).map((item) => item.player.id);
  const seed = input.seed ?? stableSeedFromKey(
    `${input.currentPick}:${input.picks.map((pick) => pick.playerId).join(",")}`,
  );
  const payload: MonteCarloInput = {
    availablePlayers: input.availablePlayers,
    currentPick: input.currentPick,
    userSlot: input.userSlot,
    teamCount: input.teamCount,
    userRoster: input.userRoster,
    leagueRosters: input.leagueRosters,
    vorById: input.vorById,
    tiersById: input.tiersById,
    picks: input.picks,
    learning: input.learning,
    league: input.league,
    candidateIds,
    config: { seed, simulations: 400, topCandidates: 8 },
  };
  const result = runMonteCarloDraft(payload);
  return {
    recommendations: attachMonteCarlo(input.recommendations, result),
    result,
  };
}
