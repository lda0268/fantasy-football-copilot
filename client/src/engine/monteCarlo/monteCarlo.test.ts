import { describe, expect, it } from "vitest";
import { createEmptyRoster } from "../../types/draft";
import { DEFAULT_LEAGUE } from "../../types/league";
import { listUserPickOveralls, isBackToBackUserTurn, countOpponentPicksUntil } from "../draftOrder";
import { learnFromDraft } from "../draftLearning";
import { optimizeLineup } from "../roster";
import { testPlayer } from "../testPlayers";
import { detectAllTiers } from "../tiers";
import { calculateVorForPlayers } from "../vor";
import { createRng, sampleWeightedIndex } from "./rng";
import { runMonteCarloDraft } from "./simulate";
import { classifyMonteCarloDecision } from "./simulate";
import type { LeagueRosters } from "../opponentRosters";
import { buildLeagueRosters } from "../opponentRosters";

function skillPool() {
  const qbs = Array.from({ length: 8 }, (_, index) =>
    testPlayer({
      id: `qb${index + 1}`,
      name: `QB${index + 1}`,
      position: "QB",
      positionalRank: index + 1,
      projectedPoints: 400 - index * 12,
      adp: 4 + index * 6,
    }),
  );
  const rbs = Array.from({ length: 10 }, (_, index) =>
    testPlayer({
      id: `rb${index + 1}`,
      name: `RB${index + 1}`,
      position: "RB",
      positionalRank: index + 1,
      projectedPoints: 320 - index * 10,
      adp: 2 + index * 5,
    }),
  );
  const wrs = Array.from({ length: 12 }, (_, index) =>
    testPlayer({
      id: `wr${index + 1}`,
      name: `WR${index + 1}`,
      position: "WR",
      positionalRank: index + 1,
      projectedPoints: 300 - index * 8,
      adp: 3 + index * 5,
    }),
  );
  const tes = Array.from({ length: 6 }, (_, index) =>
    testPlayer({
      id: `te${index + 1}`,
      name: `TE${index + 1}`,
      position: "TE",
      positionalRank: index + 1,
      projectedPoints: 220 - index * 10,
      adp: 18 + index * 8,
    }),
  );
  return [...qbs, ...rbs, ...wrs, ...tes];
}

function emptyRosters(teamCount = 10): LeagueRosters {
  return buildLeagueRosters([], [], { ...DEFAULT_LEAGUE, teamCount });
}

describe("seeded RNG", () => {
  it("reproduces the same stream for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const left = [a.next(), a.next(), a.next()];
    const right = [b.next(), b.next(), b.next()];
    expect(left).toEqual(right);
  });

  it("can produce different paths for different seeds", () => {
    const a = createRng(1);
    const b = createRng(99);
    expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()]);
  });

  it("samples higher weights more often but not always", () => {
    const rng = createRng(7);
    let first = 0;
    for (let i = 0; i < 400; i += 1) {
      if (sampleWeightedIndex([9, 1], rng) === 0) {
        first += 1;
      }
    }
    expect(first).toBeGreaterThan(280);
    expect(first).toBeLessThan(400);
  });
});

describe("snake helpers for Monte Carlo", () => {
  it("lists team 1 picks as 1,20,21,40", () => {
    expect(listUserPickOveralls(1, 1, 10, 4)).toEqual([1, 20, 21, 40]);
  });

  it("lists team 10 picks as 10,11,30,31", () => {
    expect(listUserPickOveralls(1, 10, 10, 4)).toEqual([10, 11, 30, 31]);
  });

  it("treats 20/21 as a back-to-back user turn for slot 1", () => {
    expect(isBackToBackUserTurn(20, 1, 10)).toBe(true);
    expect(isBackToBackUserTurn(1, 1, 10)).toBe(false);
    expect(countOpponentPicksUntil(21, 21, 1, 10)).toBe(0);
  });
});

describe("monte carlo simulation", () => {
  const available = skillPool();
  const vorById = calculateVorForPlayers(available, available, DEFAULT_LEAGUE);
  const tiersById = detectAllTiers(available);

  it("does not mutate the real available player list", () => {
    const snapshot = available.map((player) => player.id);
    runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 1,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1", "wr1", "qb1"],
      config: { simulations: 40, seed: 11, topCandidates: 3 },
    });
    expect(available.map((player) => player.id)).toEqual(snapshot);
  });

  it("returns 100% survival when there are zero intervening opponent picks", () => {
    const result = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 20,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1", "wr1", "qb1"],
      config: { simulations: 30, seed: 3, topCandidates: 3 },
    });
    expect(result.backToBack).toBe(true);
    expect(result.interveningOpponentPicks).toBe(0);
    expect(result.playerSurvival.every((item) => item.probability === 1)).toBe(true);
  });

  it("does not simulate opponents between back-to-back user picks", () => {
    const result = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 20,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["qb1", "rb1", "wr1"],
      config: { simulations: 20, seed: 5, topCandidates: 3 },
    });
    expect(result.diagnostics.mostFrequentOpponentPicks.every((item) => item.count === 0)).toBe(true);
    expect(result.bestPair).toBeDefined();
    expect(result.pairs.length).toBeGreaterThan(0);
  });

  it("lowers survival when more opponents pick", () => {
    const short = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 18,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1"],
      config: { simulations: 80, seed: 8, topCandidates: 1 },
    });
    const long = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 2,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1"],
      config: { simulations: 80, seed: 8, topCandidates: 1 },
    });
    const shortRb = short.playerSurvival.find((item) => item.playerId === "rb1")!;
    const longRb = long.playerSurvival.find((item) => item.playerId === "rb1")!;
    expect(long.interveningOpponentPicks).toBeGreaterThan(short.interveningOpponentPicks);
    expect(longRb.probability).toBeLessThan(shortRb.probability);
  });

  it("keeps exact player survival different from same-tier survival", () => {
    const result = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 1,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["qb1", "rb1", "wr1"],
      config: { simulations: 80, seed: 12, topCandidates: 3 },
    });
    const qb = result.playerSurvival.find((item) => item.playerId === "qb1")!;
    expect(qb.tierSurvivalProbability).toBeGreaterThanOrEqual(qb.probability);
  });

  it("selects the ADP favorite more often but not always", () => {
    const result = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 1,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1", "wr1"],
      config: { simulations: 120, seed: 21, topCandidates: 2 },
    });
    const favorite = result.diagnostics.mostFrequentOpponentPicks[0];
    expect(favorite.count).toBeGreaterThan(0);
    const total = result.diagnostics.mostFrequentOpponentPicks.reduce((sum, item) => sum + item.count, 0);
    expect(favorite.count).toBeLessThan(total);
  });

  it("has a 0-QB Superflex team draft QBs more often than a 2-QB team", () => {
    const twoQbRoster = optimizeLineup(
      [
        testPlayer({ id: "owned-qb1", name: "Owned QB1", position: "QB", positionalRank: 8, projectedPoints: 300, adp: 40 }),
        testPlayer({ id: "owned-qb2", name: "Owned QB2", position: "QB", positionalRank: 9, projectedPoints: 280, adp: 50 }),
      ],
      DEFAULT_LEAGUE,
    );
    const empty = emptyRosters();
    const stacked: LeagueRosters = new Map(empty);
    stacked.set(2, twoQbRoster);

    const hungry = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 2,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: empty,
      vorById,
      tiersById,
      candidateIds: ["qb1"],
      config: { simulations: 100, seed: 33, topCandidates: 1 },
    });
    const fed = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 2,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: stacked,
      vorById,
      tiersById,
      candidateIds: ["qb1"],
      config: { simulations: 100, seed: 33, topCandidates: 1 },
    });
    const hungryQb = hungry.playerSurvival.find((item) => item.playerId === "qb1")!.probability;
    const fedQb = fed.playerSurvival.find((item) => item.playerId === "qb1")!.probability;
    expect(hungryQb).toBeLessThanOrEqual(fedQb);
  });

  it("raises run-position odds without making them certain", () => {
    const picks = Array.from({ length: 6 }, (_, index) => ({
      overallPick: 10 + index,
      round: 2,
      teamSlot: index + 2,
      playerId: `qb${index + 3}`,
      playerName: `QB${index + 3}`,
      position: "QB" as const,
    }));
    const learning = learnFromDraft(picks, available);
    expect(learning.runPosition).toBe("QB");
    const result = runMonteCarloDraft({
      availablePlayers: available.filter((player) => player.id !== "qb3"),
      currentPick: 16,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      learning,
      picks,
      candidateIds: ["qb1"],
      config: { simulations: 80, seed: 44, topCandidates: 1 },
    });
    const qb = result.playerSurvival.find((item) => item.playerId === "qb1")!;
    expect(qb.probability).toBeGreaterThan(0);
    expect(qb.probability).toBeLessThan(1);
  });

  it("reproduces candidate EV with a fixed seed", () => {
    const input = {
      availablePlayers: available,
      currentPick: 1,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1", "wr1", "qb1"],
      config: { simulations: 60, seed: 77, topCandidates: 3 },
    };
    const a = runMonteCarloDraft(input);
    const b = runMonteCarloDraft(input);
    expect(a.candidates.map((item) => item.takeNow.mean)).toEqual(b.candidates.map((item) => item.takeNow.mean));
    expect(a.playerSurvival[0].probability).toBe(b.playerSurvival[0].probability);
  });

  it("can prefer taking a scarce player now over waiting", () => {
    const result = runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 1,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1", "wr1", "qb1"],
      config: { simulations: 80, seed: 55, topCandidates: 3 },
    });
    expect(result.candidates.some((item) => item.evDelta > 0 || item.decision.includes("TAKE"))).toBe(true);
  });

  it("classifies high same-tier survival as safe to wait when wait EV is better", () => {
    expect(
      classifyMonteCarloDecision({
        survival: 0.61,
        tierSurvival: 0.74,
        takeEv: 132.4,
        waitEv: 138.9,
        interveningOpponentPicks: 9,
      }),
    ).toBe("SAFE TO WAIT");
  });

  it("stays well under a catastrophic runtime budget", () => {
    const started = Date.now();
    runMonteCarloDraft({
      availablePlayers: available,
      currentPick: 1,
      userSlot: 1,
      teamCount: 10,
      userRoster: createEmptyRoster(DEFAULT_LEAGUE),
      leagueRosters: emptyRosters(),
      vorById,
      tiersById,
      candidateIds: ["rb1", "wr1", "qb1", "te1"],
      config: { simulations: 120, seed: 1, topCandidates: 4, candidateWindow: 24 },
    });
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
