import { describe, expect, it } from "vitest";
import { createEmptyRoster, type DraftPick } from "../types/draft";
import { DEFAULT_LEAGUE } from "../types/league";
import { optimizeLineup } from "./roster";
import { learnFromDraft } from "./draftLearning";
import { opponentPickScore, simulateDraftWindow } from "./draftSequence";
import { estimateLeagueDemand } from "./leagueDemand";
import { buildLeagueRosters } from "./opponentRosters";
import { scorePlayers } from "./recommendations";
import { estimateSurvivalProbability } from "./survivalProbability";
import { classifyTakeWait } from "./takeVsWait";
import { testPlayer } from "./testPlayers";

function pick(
  overallPick: number,
  teamSlot: number,
  player: { id: string; name: string; position: DraftPick["position"] },
): DraftPick {
  return {
    overallPick,
    round: 1,
    teamSlot,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
  };
}

describe("Ken/Kenneth identity alias", () => {
  it("classifies on-the-clock picks as take now even if next-turn survival is low", () => {
    expect(classifyTakeWait({
      survivalProbability: 0.2,
      adpDelta: 0,
      picksUntilUserPick: 8,
      vorScore: 0.8,
      predictedTaken: true,
    })).toBe("HIGH RISK TO WAIT");
    expect(classifyTakeWait({
      survivalProbability: 0.2,
      adpDelta: 0,
      picksUntilUserPick: 19,
      vorScore: 0.8,
      predictedTaken: true,
      onTheClock: true,
    })).toBe("TAKE NOW");
  });
});

describe("opponent roster demand", () => {
  it("reduces RB starter demand after a team fills both RB slots", () => {
    const rbs = [
      testPlayer({ id: "rb-a", name: "RB A", position: "RB", positionalRank: 1, projectedPoints: 280, adp: 2 }),
      testPlayer({ id: "rb-b", name: "RB B", position: "RB", positionalRank: 2, projectedPoints: 260, adp: 3 }),
    ];
    const wr = testPlayer({ id: "wr-a", name: "WR A", position: "WR", positionalRank: 1, projectedPoints: 270, adp: 4 });
    const universe = [...rbs, wr];
    const empty = estimateLeagueDemand([], DEFAULT_LEAGUE, universe);
    expect(empty.teamsNeedingRbStarters).toBe(10);

    const picks = [
      pick(1, 1, rbs[0]),
      pick(2, 1, rbs[1]),
    ];
    const after = estimateLeagueDemand(picks, DEFAULT_LEAGUE, universe);
    expect(after.teamsNeedingRbStarters).toBe(9);
  });
});

describe("in-draft learning", () => {
  it("detects a QB run and lowers QB survival versus the ADP-only estimate", () => {
    const qb = testPlayer({
      id: "qb-target",
      name: "Target QB",
      position: "QB",
      positionalRank: 4,
      projectedPoints: 340,
      adp: 28,
    });
    const qbs = Array.from({ length: 4 }, (_, index) =>
      testPlayer({
        id: `qb-run-${index}`,
        name: `Run QB ${index}`,
        position: "QB",
        positionalRank: 8 + index,
        projectedPoints: 300 - index * 5,
        adp: 40 + index,
      }),
    );
    const picks = qbs.map((player, index) => pick(20 + index, index + 2, player));
    const learning = learnFromDraft(picks, [...qbs, qb]);
    expect(learning.runPosition).toBe("QB");
    expect(learning.runLength).toBeGreaterThanOrEqual(3);

    const baseline = estimateSurvivalProbability({
      player: qb,
      currentPick: 24,
      picksUntilUserPick: 8,
    });
    const learned = estimateSurvivalProbability({
      player: qb,
      currentPick: 24,
      picksUntilUserPick: 8,
      learning,
    });
    expect(learned).toBeLessThan(baseline);
  });
});

describe("draft window simulation", () => {
  it("prefers filling an open RB need over stacking RB on a team that already has two", () => {
    const earlyRb = testPlayer({
      id: "rb-early",
      name: "Early RB",
      position: "RB",
      positionalRank: 3,
      projectedPoints: 250,
      adp: 12,
    });
    const wr = testPlayer({
      id: "wr-need",
      name: "Need WR",
      position: "WR",
      positionalRank: 3,
      projectedPoints: 240,
      adp: 12,
    });
    const filled = [
      testPlayer({ id: "rb1", name: "RB1", position: "RB", positionalRank: 1, projectedPoints: 280, adp: 2 }),
      testPlayer({ id: "rb2", name: "RB2", position: "RB", positionalRank: 2, projectedPoints: 270, adp: 3 }),
    ];
    const emptyRoster = createEmptyRoster(DEFAULT_LEAGUE);
    const stackedRoster = optimizeLineup(filled, DEFAULT_LEAGUE);

    const stackedScoreRb = opponentPickScore({
      player: earlyRb,
      currentPick: 12,
      roster: stackedRoster,
      learning: learnFromDraft([], []),
    });
    const emptyScoreRb = opponentPickScore({
      player: earlyRb,
      currentPick: 12,
      roster: emptyRoster,
      learning: learnFromDraft([], []),
    });
    const stackedScoreWr = opponentPickScore({
      player: wr,
      currentPick: 12,
      roster: stackedRoster,
      learning: learnFromDraft([], []),
    });

    expect(emptyScoreRb).toBeGreaterThan(stackedScoreRb);
    expect(stackedScoreWr).toBeGreaterThan(stackedScoreRb);
  });

  it("marks an ADP 1 player as likely taken before a long wait", () => {
    const star = testPlayer({
      id: "star",
      name: "Star",
      position: "WR",
      positionalRank: 1,
      projectedPoints: 320,
      adp: 1,
    });
    const rest = Array.from({ length: 20 }, (_, index) =>
      testPlayer({
        id: `p${index}`,
        name: `P${index}`,
        position: index % 2 === 0 ? "RB" : "WR",
        positionalRank: index + 2,
        projectedPoints: 200 - index,
        adp: 15 + index,
      }),
    );
    const available = [star, ...rest];
    const rosters = buildLeagueRosters([], available, DEFAULT_LEAGUE);
    const sequence = simulateDraftWindow({
      currentPick: 1,
      picksUntilUserPick: 9,
      userSlot: 10,
      teamCount: 10,
      availablePlayers: available,
      leagueRosters: rosters,
      league: DEFAULT_LEAGUE,
    });
    expect(sequence.predictedPicks.some((item) => item.player.id === "star")).toBe(true);

    const recs = scorePlayers({
      availablePlayers: available,
      playerUniverse: available,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
      userSlot: 10,
      teamCount: 10,
      picksUntilUserPick: 9,
      picks: [],
    });
    const starRec = recs.find((item) => item.player.id === "star")!;
    expect(starRec.takeVsWait.predictedTaken).toBe(true);
    expect(starRec.label).toBe("HIGH RISK TO WAIT");
  });
});
