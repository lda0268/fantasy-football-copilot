import { DRAFT_PLAYERS } from "../data/draftUniverse";
import { createEmptyRoster, createInitialDraftState, type Player, type Position } from "../types/draft";
import { DEFAULT_LEAGUE } from "../types/league";
import { getExpertOverallRank, getMarketAdp, getPositionalAdp } from "./data/sourceFields";
import { learnFromDraft } from "./draftLearning";
import { getPicksUntilUserPick, getRoundForPick, getTeamSlotForPick, isBackToBackUserTurn } from "./draftOrder";
import { applyDraftPick, availableAfterPicks } from "./manualDraft";
import { runMonteCarloDraft } from "./monteCarlo/simulate";
import { createRng, sampleWeightedIndex } from "./monteCarlo/rng";
import {
  emptyTeamCounts,
  opponentPickWeight,
  plausibleWindow,
  type TeamCounts,
} from "./monteCarlo/weights";
import { countRosteredPosition, buildLeagueRosters } from "./opponentRosters";
import { scorePlayers } from "./recommendations";
import { calculateVorForPlayers } from "./vor";
import { detectAllTiers } from "./tiers";

const ROUNDS = 18;
const TEAM_COUNT = 10;
const TOTAL_PICKS = ROUNDS * TEAM_COUNT;
const SLOTS = [1, 3, 5, 8, 10];
const MC_SIMS = 20;

function countsFromRoster(roster: ReturnType<typeof buildLeagueRosters> extends Map<number, infer R> ? R : never): TeamCounts {
  const counts = emptyTeamCounts();
  (["QB", "RB", "WR", "TE", "K", "DEF"] as Position[]).forEach((position) => {
    counts[position] = countRosteredPosition(roster, position);
  });
  return counts;
}

function pickOpponent(input: {
  available: Player[];
  currentPick: number;
  teamSlot: number;
  leagueRosters: ReturnType<typeof buildLeagueRosters>;
  vorById: Map<string, number>;
  tiersById: Map<string, { tier: number }>;
  learning: ReturnType<typeof learnFromDraft>;
  rng: ReturnType<typeof createRng>;
}): Player {
  const simPlayers = input.available.map((player, index) => ({
    index,
    player,
    id: player.id,
    name: player.name,
    position: player.position,
    adp: getMarketAdp(player) ?? input.currentPick + 40 + index,
    positionalAdp: getPositionalAdp(player),
    vor: input.vorById.get(player.id) ?? 0,
    projectedPoints: player.projectedPoints,
    tier: input.tiersById.get(player.id)?.tier ?? 9,
  }));
  const remaining = simPlayers.map((_, index) => index);
  const window = plausibleWindow(remaining, simPlayers, input.currentPick, 32);
  const vors = simPlayers.map((player) => player.vor);
  const vorMin = Math.min(...vors, 0);
  const vorMax = Math.max(...vors, 1);
  const counts = countsFromRoster(input.leagueRosters.get(input.teamSlot) ?? []);
  const weights = window.map((index) =>
    opponentPickWeight({
      player: simPlayers[index],
      currentPick: input.currentPick,
      teamCount: TEAM_COUNT,
      counts,
      learning: input.learning,
      league: DEFAULT_LEAGUE,
      vorMin,
      vorMax,
    }),
  );
  const chosen = window[sampleWeightedIndex(weights, input.rng)];
  return simPlayers[chosen].player;
}

function runSlot(userSlot: number, seed: number) {
  const rng = createRng(seed);
  let state = { ...createInitialDraftState(DEFAULT_LEAGUE), userSlot };
  const userLogs: Array<Record<string, unknown>> = [];
  const flags: string[] = [];

  while (state.currentPick <= TOTAL_PICKS) {
    const available = availableAfterPicks(DRAFT_PLAYERS, state.draftedPlayerIds);
    if (available.length === 0) {
      break;
    }
    const teamSlot = getTeamSlotForPick(state.currentPick, TEAM_COUNT);
    const vorById = calculateVorForPlayers(available, DRAFT_PLAYERS, DEFAULT_LEAGUE);
    const tiersById = detectAllTiers(available);
    const learning = learnFromDraft(state.picks, DRAFT_PLAYERS);
    const leagueRosters = buildLeagueRosters(state.picks, DRAFT_PLAYERS, DEFAULT_LEAGUE);

    if (teamSlot === userSlot) {
      const recs = scorePlayers({
        availablePlayers: available,
        playerUniverse: DRAFT_PLAYERS,
        currentPick: state.currentPick,
        roster: state.roster,
        picksUntilUserPick: getPicksUntilUserPick(state.currentPick, userSlot, TEAM_COUNT),
        userSlot,
        teamCount: TEAM_COUNT,
        league: DEFAULT_LEAGUE,
        picks: state.picks,
      });
      const top = recs[0];
      if (!top) {
        break;
      }
      const candidates = recs.slice(0, 5);
      const mc =
        MC_SIMS > 0
          ? runMonteCarloDraft({
              availablePlayers: available,
              currentPick: state.currentPick,
              userSlot,
              teamCount: TEAM_COUNT,
              userRoster: state.roster,
              leagueRosters,
              vorById,
              tiersById,
              picks: state.picks,
              learning,
              league: DEFAULT_LEAGUE,
              candidateIds: candidates.map((item) => item.player.id),
              config: { simulations: MC_SIMS, seed: seed + state.currentPick, topCandidates: 5, candidateWindow: 28 },
            })
          : null;
      const survival = mc?.playerSurvival.find((item) => item.playerId === top.player.id);
      const cand = mc?.candidates.find((item) => item.playerId === top.player.id);
      const round = getRoundForPick(state.currentPick, TEAM_COUNT);
      const alts = candidates.slice(0, 5).map((item) => ({
        name: item.player.name,
        pos: item.player.position,
        score: item.score,
        vor: Math.round(item.vor * 10) / 10,
        adp: getMarketAdp(item.player) ?? null,
        pts: Math.round(item.player.projectedPoints * 10) / 10,
        label: item.label,
      }));

      if ((top.player.position === "K" || top.player.position === "DEF") && round < 10) {
        flags.push(`R${round} #${state.currentPick}: K/DEF early (${top.player.name})`);
      }
      if (top.takeVsWait.monteCarloDecision) {
        const mcDec = top.takeVsWait.monteCarloDecision;
        if (
          (mcDec === "SAFE TO WAIT" || mcDec === "WAIT POSSIBLE") &&
          cand &&
          cand.evDelta < -20 &&
          top.label === "TAKE NOW"
        ) {
          flags.push(
            `R${round} #${state.currentPick}: contradictory take/wait — rec ${top.label} vs MC ${mcDec} Δ${cand.evDelta.toFixed(1)} (${top.player.name})`,
          );
        }
      }

      userLogs.push({
        round,
        overall: state.currentPick,
        backToBack: isBackToBackUserTurn(state.currentPick, userSlot, TEAM_COUNT),
        player: top.player.name,
        pos: top.player.position,
        pts: Math.round(top.player.projectedPoints * 10) / 10,
        vor: Math.round(top.vor * 10) / 10,
        espn: getExpertOverallRank(top.player) ?? null,
        adp: getMarketAdp(top.player) ?? null,
        recScore: top.score,
        label: top.label,
        mcSurvival: survival ? Math.round(survival.probability * 100) : null,
        mcTier: survival ? Math.round(survival.tierSurvivalProbability * 100) : null,
        mcDecision: cand?.decision ?? null,
        takeEv: cand ? Math.round(cand.takeNow.mean * 10) / 10 : null,
        waitEv: cand ? Math.round(cand.wait.mean * 10) / 10 : null,
        sequence: mc?.bestSequenceLabel ?? mc?.bestPair ? mc.bestSequenceLabel : null,
        pair: mc?.bestPair ? `${mc.bestPair.firstName} + ${mc.bestPair.secondName}` : null,
        reasons: top.reasons.slice(0, 3),
        alternatives: alts,
      });
      state = applyDraftPick(state, top.player);
    } else {
      const player = pickOpponent({
        available,
        currentPick: state.currentPick,
        teamSlot,
        leagueRosters,
        vorById,
        tiersById,
        learning,
        rng,
      });
      state = applyDraftPick(state, player);
    }
  }

  const roster = state.roster;
  const players = roster.map((slot) => slot.player).filter((player): player is Player => player !== null);
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const player of players) {
    counts[player.position] += 1;
  }
  const totalPts = players.reduce((sum, player) => sum + player.projectedPoints, 0);
  const vorById = calculateVorForPlayers(players, DRAFT_PLAYERS, DEFAULT_LEAGUE);
  const totalVor = players.reduce((sum, player) => sum + (vorById.get(player.id) ?? 0), 0);
  const starters = roster.filter((slot) => slot.slotType !== "BENCH" && slot.slotType !== "IR");
  const emptyStarters = starters.filter((slot) => slot.player === null).map((slot) => slot.label);

  if (counts.QB < 2) {
    flags.push(`Only ${counts.QB} QB(s) in Superflex`);
  }
  if (counts.QB >= 4) {
    flags.push(`${counts.QB} QBs drafted`);
  }
  const qbPicks = userLogs.filter((log) => log.pos === "QB") as Array<{ round: number; player: string }>;
  if (qbPicks.filter((log) => log.round <= 3).length >= 2) {
    flags.push(`Two QBs in first 3 rounds: ${qbPicks.filter((log) => log.round <= 3).map((log) => `R${log.round} ${log.player}`).join(", ")}`);
  }
  if (counts.QB === 0) {
    flags.push("Zero QBs — Superflex ignored");
  }
  if (emptyStarters.length) {
    flags.push(`Empty starter slots: ${emptyStarters.join(", ")}`);
  }
  if (counts.RB < 2) {
    flags.push(`Only ${counts.RB} RBs`);
  }
  if (counts.WR < 3) {
    flags.push(`Only ${counts.WR} WRs`);
  }
  if (counts.TE < 1) {
    flags.push("No TE");
  }
  const kPick = userLogs.find((log) => log.pos === "K") as { round?: number } | undefined;
  const defPick = userLogs.find((log) => log.pos === "DEF") as { round?: number } | undefined;
  if ((kPick?.round ?? 99) < 10 || (defPick?.round ?? 99) < 10) {
    flags.push(`K/DEF timing: K R${kPick?.round ?? "-"} DEF R${defPick?.round ?? "-"}`);
  }

  const posVor: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const player of players) {
    posVor[player.position] += vorById.get(player.id) ?? 0;
  }
  const rankedPos = Object.entries(posVor).sort((a, b) => b[1] - a[1]);

  return {
    userSlot,
    firstFive: userLogs.slice(0, 5).map((log) => `${log.round}.${String(log.overall).padStart(2, "0")} ${log.player} (${log.pos})`),
    picks: userLogs,
    roster: roster
      .filter((slot) => slot.slotType !== "IR")
      .map((slot) => `${slot.label}: ${slot.player ? `${slot.player.name} ${slot.player.position} ${slot.player.projectedPoints.toFixed(1)}` : "—"}`),
    counts,
    totalPts: Math.round(totalPts * 10) / 10,
    totalVor: Math.round(totalVor * 10) / 10,
    strongest: rankedPos[0]?.[0],
    weakest: rankedPos.filter(([pos]) => pos !== "K" && pos !== "DEF").slice(-1)[0]?.[0],
    flags,
    emptyStarters,
    qbRounds: qbPicks.map((log) => `R${log.round}`),
    kRound: kPick?.round ?? null,
    defRound: defPick?.round ?? null,
    snakeTurns: userLogs.filter((log) => log.backToBack),
  };
}

const reports = SLOTS.map((slot, index) => runSlot(slot, 20260901 + index * 17));

const firstRounds = SLOTS.map((slot) => {
  const recs = scorePlayers({
    availablePlayers: DRAFT_PLAYERS,
    playerUniverse: DRAFT_PLAYERS,
    currentPick: slot,
    roster: createEmptyRoster(DEFAULT_LEAGUE),
    picksUntilUserPick: 0,
    userSlot: slot,
    teamCount: TEAM_COUNT,
    league: DEFAULT_LEAGUE,
    picks: [],
  }).slice(0, 8);
  return {
    slot,
    top: recs.map(
      (item) =>
        `${item.player.name} ${item.player.position} score ${item.score} vor ${item.vor.toFixed(1)} pts ${item.player.projectedPoints.toFixed(1)}`,
    ),
  };
});

const compact = reports.map((report) => ({
  slot: report.userSlot,
  firstFive: report.firstFive,
  counts: report.counts,
  totalPts: report.totalPts,
  totalVor: report.totalVor,
  qbRounds: report.qbRounds,
  kRound: report.kRound,
  defRound: report.defRound,
  emptyStarters: report.emptyStarters,
  strongest: report.strongest,
  weakest: report.weakest,
  flags: report.flags,
  roster: report.roster,
}));

console.log(JSON.stringify({ firstRounds, compact }, null, 2));
