import type { DraftPick, Player, Position, RosterSlot } from "../../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../../types/league";
import { getMarketAdp, getPositionalAdp } from "../data/sourceFields";
import { emptyDraftLearning, type DraftLearning } from "../draftLearning";
import {
  countOpponentPicksUntil,
  getRoundForPick,
  getTeamSlotForPick,
  isBackToBackUserTurn,
  listUserPickOveralls,
} from "../draftOrder";
import { mean, percentile } from "../math";
import { countRosteredPosition, type LeagueRosters } from "../opponentRosters";
import { resolveMonteCarloConfig, type MonteCarloConfig } from "./config";
import { createRng, sampleWeightedIndex, type Rng } from "./rng";
import type {
  CandidateOutcome,
  MonteCarloResult,
  PairOutcome,
  PlayerSurvivalStats,
  SimPlayer,
  SimulatedPickCount,
  ValueDistribution,
} from "./types";
import {
  addPlayerToCounts,
  cloneTeamCounts,
  emptyTeamCounts,
  opponentPickWeight,
  plausibleWindow,
  userDecisionScore,
  type TeamCounts,
} from "./weights";

export interface MonteCarloInput {
  availablePlayers: Player[];
  currentPick: number;
  userSlot: number;
  teamCount: number;
  userRoster: RosterSlot[];
  leagueRosters: LeagueRosters;
  vorById: Map<string, number>;
  tiersById: Map<string, { tier: number }>;
  picks?: DraftPick[];
  learning?: DraftLearning;
  league?: LeagueSettings;
  candidateIds: string[];
  config?: Partial<MonteCarloConfig>;
}

function toDistribution(values: number[]): ValueDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: mean(sorted),
    median: percentile(sorted, 0.5),
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
  };
}

function countsFromRoster(roster: RosterSlot[] | undefined): TeamCounts {
  const counts = emptyTeamCounts();
  if (!roster) {
    return counts;
  }
  (["QB", "RB", "WR", "TE", "K", "DEF"] as Position[]).forEach((position) => {
    counts[position] = countRosteredPosition(roster, position);
  });
  return counts;
}

function buildSimPlayers(
  available: Player[],
  vorById: Map<string, number>,
  tiersById: Map<string, { tier: number }>,
  currentPick: number,
): SimPlayer[] {
  return available.map((player, index) => ({
    index,
    player,
    id: player.id,
    name: player.name,
    position: player.position,
    adp: getMarketAdp(player) ?? currentPick + 40 + index,
    positionalAdp: getPositionalAdp(player),
    vor: vorById.get(player.id) ?? 0,
    projectedPoints: player.projectedPoints,
    tier: tiersById.get(player.id)?.tier ?? 9,
  }));
}

function remainingList(flags: boolean[]): number[] {
  const list: number[] = [];
  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index]) {
      list.push(index);
    }
  }
  return list;
}

function pickOpponent(
  remaining: boolean[],
  players: SimPlayer[],
  currentPick: number,
  teamCount: number,
  counts: TeamCounts,
  learning: DraftLearning,
  league: LeagueSettings,
  windowSize: number,
  rng: Rng,
  vorMin: number,
  vorMax: number,
): number {
  const open = remainingList(remaining);
  if (open.length === 0) {
    return -1;
  }
  const window = plausibleWindow(open, players, currentPick, windowSize);
  const weights = window.map((index) =>
    opponentPickWeight({
      player: players[index],
      currentPick,
      teamCount,
      counts,
      learning,
      league,
      vorMin,
      vorMax,
    }),
  );
  const chosen = window[sampleWeightedIndex(weights, rng)];
  return chosen;
}

function pickUserBest(
  remaining: boolean[],
  players: SimPlayer[],
  counts: TeamCounts,
  round: number,
  league: LeagueSettings,
  excludeId?: string,
): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let index = 0; index < remaining.length; index += 1) {
    if (!remaining[index]) {
      continue;
    }
    const player = players[index];
    if (excludeId && player.id === excludeId) {
      continue;
    }
    const score = userDecisionScore(player, counts, round, league);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}

function simulateOpponents(input: {
  fromPick: number;
  untilPick: number;
  userSlot: number;
  teamCount: number;
  remaining: boolean[];
  players: SimPlayer[];
  teamCounts: TeamCounts[];
  learning: DraftLearning;
  league: LeagueSettings;
  windowSize: number;
  rng: Rng;
  vorMin: number;
  vorMax: number;
  opponentTaken: number[];
}): void {
  for (let overall = input.fromPick; overall < input.untilPick; overall += 1) {
    const slot = getTeamSlotForPick(overall, input.teamCount);
    if (slot === input.userSlot) {
      continue;
    }
    const chosen = pickOpponent(
      input.remaining,
      input.players,
      overall,
      input.teamCount,
      input.teamCounts[slot - 1],
      input.learning,
      input.league,
      input.windowSize,
      input.rng,
      input.vorMin,
      input.vorMax,
    );
    if (chosen < 0) {
      return;
    }
    input.remaining[chosen] = false;
    addPlayerToCounts(input.teamCounts[slot - 1], input.players[chosen].position);
    input.opponentTaken[chosen] += 1;
  }
}

function cloneRemaining(flags: boolean[]): boolean[] {
  return flags.slice();
}

function cloneAllCounts(counts: TeamCounts[]): TeamCounts[] {
  return counts.map(cloneTeamCounts);
}

export function classifyMonteCarloDecision(input: {
  survival: number;
  tierSurvival: number;
  takeEv: number;
  waitEv: number;
  interveningOpponentPicks: number;
}): import("./types").MonteCarloDecision {
  if (input.interveningOpponentPicks <= 0) {
    return "TAKE NOW";
  }
  const delta = input.takeEv - input.waitEv;
  if (input.survival < 0.18 && delta >= -2) {
    return "TAKE NOW";
  }
  if (delta >= 8) {
    return "TAKE NOW";
  }
  if (delta >= 3) {
    return "LEAN TAKE";
  }
  if (input.survival >= 0.58 && input.tierSurvival >= 0.7 && delta <= 0) {
    return "SAFE TO WAIT";
  }
  if (input.survival >= 0.45 && delta < 0) {
    return "WAIT POSSIBLE";
  }
  if (delta >= 0) {
    return "LEAN TAKE";
  }
  return "WAIT POSSIBLE";
}

export function runMonteCarloDraft(input: MonteCarloInput): MonteCarloResult {
  const started = Date.now();
  const league = input.league ?? DEFAULT_LEAGUE;
  const config = resolveMonteCarloConfig(input.config);
  const seed = config.seed ?? 20260901;
  const rng = createRng(seed);
  const learning = input.learning ?? emptyDraftLearning();
  const players = buildSimPlayers(input.availablePlayers, input.vorById, input.tiersById, input.currentPick);
  const vors = players.map((player) => player.vor);
  const vorMin = Math.min(...vors, 0);
  const vorMax = Math.max(...vors, 1);
  const teamCounts = Array.from({ length: input.teamCount }, (_, index) =>
    countsFromRoster(input.leagueRosters.get(index + 1)),
  );
  const userCounts = countsFromRoster(input.userRoster);
  const userPicks = listUserPickOveralls(
    input.currentPick,
    input.userSlot,
    input.teamCount,
    Math.max(1, config.horizonUserPicks),
  );
  const currentIsUser = getTeamSlotForPick(input.currentPick, input.teamCount) === input.userSlot;
  const nextUserPick = currentIsUser
    ? (userPicks[1] ?? userPicks[0] ?? input.currentPick)
    : (userPicks[0] ?? input.currentPick);
  const backToBack = currentIsUser && isBackToBackUserTurn(input.currentPick, input.userSlot, input.teamCount);
  const opponentStart = currentIsUser ? input.currentPick + 1 : input.currentPick;
  const intervening = backToBack
    ? 0
    : countOpponentPicksUntil(opponentStart, nextUserPick, input.userSlot, input.teamCount);

  const candidateIds = input.candidateIds.slice(0, config.topCandidates);
  const candidateIndexes = candidateIds
    .map((id) => players.findIndex((player) => player.id === id))
    .filter((index) => index >= 0);

  const baseRemaining = players.map(() => true);
  const survivalCounts = players.map(() => 0);
  const tierSurvivalCounts = players.map(() => 0);
  const bestVorSum = players.map(() => 0);
  const bestPointsSum = players.map(() => 0);
  const bestNameCount = players.map(() => new Map<string, number>());
  const takeValues = candidateIndexes.map(() => [] as number[]);
  const waitValues = candidateIndexes.map(() => [] as number[]);
  const nextNameCounts = candidateIndexes.map(() => new Map<string, { count: number; position: Position; tier: number }>());
  const opponentTaken = players.map(() => 0);

  const sims = Math.max(1, config.simulations);
  for (let sim = 0; sim < sims; sim += 1) {
    const remaining = cloneRemaining(baseRemaining);
    const counts = cloneAllCounts(teamCounts);
    simulateOpponents({
      fromPick: opponentStart,
      untilPick: backToBack ? opponentStart : nextUserPick,
      userSlot: input.userSlot,
      teamCount: input.teamCount,
      remaining,
      players,
      teamCounts: counts,
      learning,
      league,
      windowSize: config.candidateWindow,
      rng,
      vorMin,
      vorMax,
      opponentTaken,
    });

    for (let index = 0; index < players.length; index += 1) {
      if (remaining[index]) {
        survivalCounts[index] += 1;
      }
    }
    const bestAtPos = new Map<string, number>();
    const leftoverTier = new Map<string, number>();
    for (let index = 0; index < players.length; index += 1) {
      if (!remaining[index]) {
        continue;
      }
      const player = players[index];
      leftoverTier.set(`${player.position}|${player.tier}`, 1);
      const best = bestAtPos.get(player.position);
      if (best === undefined || player.vor > players[best].vor) {
        bestAtPos.set(player.position, index);
      }
    }
    for (let index = 0; index < players.length; index += 1) {
      const player = players[index];
      if (leftoverTier.has(`${player.position}|${player.tier}`)) {
        tierSurvivalCounts[index] += 1;
      }
      const best = bestAtPos.get(player.position);
      if (best !== undefined) {
        bestVorSum[index] += players[best].vor;
        bestPointsSum[index] += players[best].projectedPoints;
        const names = bestNameCount[index];
        names.set(players[best].name, (names.get(players[best].name) ?? 0) + 1);
      }
    }

    if (backToBack) {
      for (let c = 0; c < candidateIndexes.length; c += 1) {
        const vor = players[candidateIndexes[c]].vor;
        takeValues[c].push(vor);
        waitValues[c].push(vor);
      }
      continue;
    }
    if (!currentIsUser) {
      continue;
    }

    const ignoreTaken = players.map(() => 0);
    for (let c = 0; c < candidateIndexes.length; c += 1) {
      const candidate = candidateIndexes[c];

      const takeRemaining = cloneRemaining(baseRemaining);
      takeRemaining[candidate] = false;
      const takeCounts = cloneAllCounts(teamCounts);
      const takeUser = cloneTeamCounts(userCounts);
      addPlayerToCounts(takeUser, players[candidate].position);
      simulateOpponents({
        fromPick: opponentStart,
        untilPick: nextUserPick,
        userSlot: input.userSlot,
        teamCount: input.teamCount,
        remaining: takeRemaining,
        players,
        teamCounts: takeCounts,
        learning,
        league,
        windowSize: config.candidateWindow,
        rng,
        vorMin,
        vorMax,
        opponentTaken: ignoreTaken,
      });
      const takeNext = pickUserBest(
        takeRemaining,
        players,
        takeUser,
        getRoundForPick(nextUserPick, input.teamCount),
        league,
      );
      const takeNextVor = takeNext >= 0 ? players[takeNext].vor : 0;
      takeValues[c].push(players[candidate].vor + takeNextVor);
      if (takeNext >= 0) {
        const bucket = nextNameCounts[c];
        const current = bucket.get(players[takeNext].name) ?? {
          count: 0,
          position: players[takeNext].position,
          tier: players[takeNext].tier,
        };
        current.count += 1;
        bucket.set(players[takeNext].name, current);
      }

      const waitRemaining = cloneRemaining(baseRemaining);
      const waitCounts = cloneAllCounts(teamCounts);
      const waitUser = cloneTeamCounts(userCounts);
      const waitNow = pickUserBest(
        waitRemaining,
        players,
        waitUser,
        getRoundForPick(input.currentPick, input.teamCount),
        league,
        players[candidate].id,
      );
      if (waitNow >= 0) {
        waitRemaining[waitNow] = false;
        addPlayerToCounts(waitUser, players[waitNow].position);
      }
      simulateOpponents({
        fromPick: opponentStart,
        untilPick: nextUserPick,
        userSlot: input.userSlot,
        teamCount: input.teamCount,
        remaining: waitRemaining,
        players,
        teamCounts: waitCounts,
        learning,
        league,
        windowSize: config.candidateWindow,
        rng,
        vorMin,
        vorMax,
        opponentTaken: ignoreTaken,
      });
      const waitNext = pickUserBest(
        waitRemaining,
        players,
        waitUser,
        getRoundForPick(nextUserPick, input.teamCount),
        league,
      );
      const waitNowVor = waitNow >= 0 ? players[waitNow].vor : 0;
      const waitNextVor = waitNext >= 0 ? players[waitNext].vor : 0;
      waitValues[c].push(waitNowVor + waitNextVor);
    }
  }

  const playerSurvival: PlayerSurvivalStats[] = players.map((player, index) => {
    const probability = survivalCounts[index] / sims;
    const tierProb = tierSurvivalCounts[index] / sims;
    let expectedBestName: string | undefined;
    let bestCount = 0;
    for (const [name, count] of bestNameCount[index]) {
      if (count > bestCount) {
        bestCount = count;
        expectedBestName = name;
      }
    }
    return {
      playerId: player.id,
      name: player.name,
      position: player.position,
      survived: survivalCounts[index],
      probability,
      standardError: Math.sqrt((probability * (1 - probability)) / sims),
      tier: player.tier,
      tierSurvived: tierSurvivalCounts[index],
      tierSurvivalProbability: tierProb,
      tierExhaustedProbability: 1 - tierProb,
      expectedBestVor: bestVorSum[index] / sims,
      expectedBestPoints: bestPointsSum[index] / sims,
      expectedBestName,
    };
  });

  const survivalById = new Map(playerSurvival.map((item) => [item.playerId, item]));
  const candidates: CandidateOutcome[] = candidateIndexes.map((index, c) => {
    const player = players[index];
    const takeNow = toDistribution(takeValues[c]);
    const wait = toDistribution(waitValues[c]);
    let expectedNextName: string | undefined;
    let expectedNextPosition: Position | undefined;
    let expectedNextTier: number | undefined;
    let best = 0;
    for (const [name, info] of nextNameCounts[c]) {
      if (info.count > best) {
        best = info.count;
        expectedNextName = name;
        expectedNextPosition = info.position;
        expectedNextTier = info.tier;
      }
    }
    const survival = survivalById.get(player.id);
    const decision = classifyMonteCarloDecision({
      survival: survival?.probability ?? 0,
      tierSurvival: survival?.tierSurvivalProbability ?? 0,
      takeEv: takeNow.mean,
      waitEv: wait.mean,
      interveningOpponentPicks: intervening,
    });
    return {
      playerId: player.id,
      name: player.name,
      position: player.position,
      takeNow,
      wait,
      evDelta: takeNow.mean - wait.mean,
      expectedNextName,
      expectedNextPosition,
      expectedNextTier,
      decision,
    };
  });

  const pairs: PairOutcome[] = [];
  if (backToBack) {
    for (let i = 0; i < candidateIndexes.length; i += 1) {
      for (let j = i + 1; j < candidateIndexes.length; j += 1) {
        const first = players[candidateIndexes[i]];
        const second = players[candidateIndexes[j]];
        pairs.push({
          firstId: first.id,
          secondId: second.id,
          firstName: first.name,
          secondName: second.name,
          combinedVor: first.vor + second.vor,
        });
      }
    }
    pairs.sort((a, b) => b.combinedVor - a.combinedVor);
  }

  const bestCandidate = [...candidates].sort((a, b) => b.takeNow.mean - a.takeNow.mean || b.evDelta - a.evDelta)[0];
  const bestPair = pairs[0];
  const opponentFreq: SimulatedPickCount[] = players
    .map((player, index) => ({ playerId: player.id, name: player.name, count: opponentTaken[index] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const runtimeMs = Date.now() - started;

  let bestSequenceLabel: string | undefined;
  if (backToBack && bestPair) {
    bestSequenceLabel = `${bestPair.firstName} + ${bestPair.secondName}`;
  } else if (bestCandidate) {
    const next = bestCandidate.expectedNextName
      ? ` → ${bestCandidate.expectedNextName}`
      : bestCandidate.expectedNextPosition
        ? ` → ${bestCandidate.expectedNextPosition} tier ${bestCandidate.expectedNextTier ?? "?"}`
        : "";
    bestSequenceLabel = `${bestCandidate.name}${next}`;
  }

  return {
    config: {
      simulations: sims,
      horizonUserPicks: config.horizonUserPicks,
      topCandidates: config.topCandidates,
      candidateWindow: config.candidateWindow,
      seed,
    },
    runtimeMs,
    backToBack,
    interveningOpponentPicks: intervening,
    playerSurvival,
    candidates,
    bestCandidateId: bestCandidate?.playerId,
    bestSequenceLabel,
    bestPair,
    pairs: pairs.slice(0, 8),
    diagnostics: {
      simulations: sims,
      runtimeMs,
      seed,
      opponentWindow: config.candidateWindow,
      mostFrequentOpponentPicks: opponentFreq,
    },
  };
}
