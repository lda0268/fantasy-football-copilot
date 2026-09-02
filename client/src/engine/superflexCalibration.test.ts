import { describe, expect, it } from "vitest";
import { createEmptyRoster } from "../types/draft";
import {
  DEFAULT_LEAGUE,
  ESPN_BASELINE_LEAGUE,
  withLeagueOverrides,
} from "../types/league";
import { getReplacementLevel } from "./replacement";
import { expectedStarterDemand, replacementRankForPosition } from "./starterDemand";
import {
  diminishingDepthFactor,
  getRosterNeed,
  marginalStartingLineupValue,
  starterPressure,
} from "./rosterNeed";
import { optimizeLineup } from "./roster";
import { testPlayer } from "./testPlayers";
import { MOCK_PLAYERS } from "../data/mockPlayers";

const qb = testPlayer({
  id: "qb-cal",
  name: "Cal QB",
  position: "QB",
  positionalRank: 4,
  projectedPoints: 340,
});

const wr = testPlayer({
  id: "wr-cal",
  name: "Cal WR",
  position: "WR",
  positionalRank: 8,
  projectedPoints: 210,
});

const te = testPlayer({
  id: "te-cal",
  name: "Cal TE",
  position: "TE",
  positionalRank: 4,
  projectedPoints: 160,
});

const kicker = testPlayer({
  id: "k-cal",
  name: "Cal K",
  position: "K",
  positionalRank: 1,
  projectedPoints: 0,
});

const defense = testPlayer({
  id: "def-cal",
  name: "Cal DEF",
  position: "DEF",
  positionalRank: 1,
  projectedPoints: 80,
});

function qbRoster(count: number) {
  const qbs = Array.from({ length: count }, (_, index) =>
    testPlayer({
      id: `owned-qb${index}`,
      name: `Owned QB${index}`,
      position: "QB",
      positionalRank: index + 1,
      projectedPoints: 360 - index * 20,
    }),
  );
  return optimizeLineup(qbs, DEFAULT_LEAGUE);
}

function wrRoster(count: number) {
  const wrs = Array.from({ length: count }, (_, index) =>
    testPlayer({
      id: `owned-wr${index}`,
      name: `Owned WR${index}`,
      position: "WR",
      positionalRank: index + 1,
      projectedPoints: 250 - index * 8,
    }),
  );
  return optimizeLineup(wrs, DEFAULT_LEAGUE);
}

function teRoster(count: number) {
  const tes = Array.from({ length: count }, (_, index) =>
    testPlayer({
      id: `owned-te${index}`,
      name: `Owned TE${index}`,
      position: "TE",
      positionalRank: index + 1,
      projectedPoints: 180 - index * 10,
    }),
  );
  return optimizeLineup(tes, DEFAULT_LEAGUE);
}

describe("superflex QB replacement", () => {
  it("places Superflex QB replacement in the 18–22 starter demand band", () => {
    const demand = expectedStarterDemand(DEFAULT_LEAGUE, "QB", MOCK_PLAYERS);
    const rank = replacementRankForPosition(DEFAULT_LEAGUE, "QB", MOCK_PLAYERS);
    expect(demand).toBeGreaterThanOrEqual(18);
    expect(demand).toBeLessThanOrEqual(24);
    expect(rank).toBeGreaterThanOrEqual(19);
    expect(rank).toBeLessThanOrEqual(25);
    expect(rank).toBeGreaterThan(getReplacementLevel(MOCK_PLAYERS, "QB", ESPN_BASELINE_LEAGUE).rank);
  });
});

describe("roster construction calibration", () => {
  it("values a QB more on a 0-QB roster than on an identical 2-QB roster", () => {
    const empty = getRosterNeed(createEmptyRoster(DEFAULT_LEAGUE), qb, 0.5, DEFAULT_LEAGUE, {
      currentPick: 31,
    });
    const twoQb = getRosterNeed(qbRoster(2), qb, 0.5, DEFAULT_LEAGUE, { currentPick: 31 });
    expect(empty.score).toBeGreaterThan(twoQb.score + 0.2);
    expect(empty.marginalStartingLineupValue).toBeGreaterThan(twoQb.marginalStartingLineupValue);
  });

  it("raises QB starter pressure as the draft advances with empty QB slots", () => {
    const early = starterPressure({
      position: "QB",
      rosteredCount: 0,
      round: 2,
      league: DEFAULT_LEAGUE,
    });
    const later = starterPressure({
      position: "QB",
      rosteredCount: 0,
      round: 5,
      league: DEFAULT_LEAGUE,
    });
    expect(later).toBeGreaterThan(early);
    expect(later).toBeGreaterThan(0.7);
  });

  it("drops pressure materially after QB2", () => {
    const qb1 = starterPressure({
      position: "QB",
      rosteredCount: 1,
      round: 7,
      league: DEFAULT_LEAGUE,
    });
    const qb2 = starterPressure({
      position: "QB",
      rosteredCount: 2,
      round: 7,
      league: DEFAULT_LEAGUE,
    });
    expect(qb1).toBeGreaterThan(qb2 + 0.25);
  });

  it("does not give QB3 QB2-level starter pressure", () => {
    const qb2Need = starterPressure({
      position: "QB",
      rosteredCount: 1,
      round: 8,
      league: DEFAULT_LEAGUE,
    });
    const qb3Need = starterPressure({
      position: "QB",
      rosteredCount: 2,
      round: 8,
      league: DEFAULT_LEAGUE,
    });
    expect(qb3Need).toBeLessThan(qb2Need * 0.45);
  });

  it("gives WR8 lower marginal roster value than WR3 at the same quality", () => {
    const wr3 = getRosterNeed(wrRoster(2), wr, 0.6, DEFAULT_LEAGUE, { currentPick: 40 });
    const wr8 = getRosterNeed(wrRoster(7), wr, 0.6, DEFAULT_LEAGUE, { currentPick: 40 });
    expect(wr8.score).toBeLessThan(wr3.score);
    expect(wr8.marginalStartingLineupValue).toBeLessThan(wr3.marginalStartingLineupValue);
    expect(diminishingDepthFactor("WR", 7, DEFAULT_LEAGUE)).toBeLessThan(
      diminishingDepthFactor("WR", 2, DEFAULT_LEAGUE),
    );
  });

  it("gives TE5 lower marginal value than TE1", () => {
    const te1 = getRosterNeed(createEmptyRoster(DEFAULT_LEAGUE), te, 0.5, DEFAULT_LEAGUE, {
      currentPick: 50,
    });
    const te5 = getRosterNeed(teRoster(4), te, 0.5, DEFAULT_LEAGUE, { currentPick: 50 });
    expect(te5.score).toBeLessThan(te1.score);
    expect(te5.diminishingFactor).toBeLessThan(te1.diminishingFactor);
  });

  it("applies late K/DEF roster completion without inventing projected points", () => {
    const skillFilled = optimizeLineup(
      [
        testPlayer({ id: "q1", name: "Q1", position: "QB", positionalRank: 1, projectedPoints: 350 }),
        testPlayer({ id: "q2", name: "Q2", position: "QB", positionalRank: 2, projectedPoints: 320 }),
        testPlayer({ id: "r1", name: "R1", position: "RB", positionalRank: 1, projectedPoints: 280 }),
        testPlayer({ id: "r2", name: "R2", position: "RB", positionalRank: 2, projectedPoints: 260 }),
        testPlayer({ id: "r3", name: "R3", position: "RB", positionalRank: 3, projectedPoints: 240 }),
        testPlayer({ id: "w1", name: "W1", position: "WR", positionalRank: 1, projectedPoints: 270 }),
        testPlayer({ id: "w2", name: "W2", position: "WR", positionalRank: 2, projectedPoints: 250 }),
        testPlayer({ id: "w3", name: "W3", position: "WR", positionalRank: 3, projectedPoints: 230 }),
        testPlayer({ id: "w4", name: "W4", position: "WR", positionalRank: 4, projectedPoints: 210 }),
        testPlayer({ id: "t1", name: "T1", position: "TE", positionalRank: 1, projectedPoints: 180 }),
      ],
      DEFAULT_LEAGUE,
    );
    const kNeed = getRosterNeed(skillFilled, kicker, 0.1, DEFAULT_LEAGUE, {
      currentPick: 162,
      remainingUserPicks: 3,
    });
    const defNeed = getRosterNeed(skillFilled, defense, 0.1, DEFAULT_LEAGUE, {
      currentPick: 162,
      remainingUserPicks: 3,
    });
    const extraWr = getRosterNeed(
      skillFilled,
      testPlayer({ id: "w8", name: "W8", position: "WR", positionalRank: 8, projectedPoints: 160 }),
      0.8,
      DEFAULT_LEAGUE,
      { currentPick: 162, remainingUserPicks: 3 },
    );
    expect(kicker.projectedPoints).toBe(0);
    expect(kNeed.completionPressure).toBeGreaterThan(0.9);
    expect(defNeed.completionPressure).toBeGreaterThan(0.9);
    expect(kNeed.score).toBeGreaterThan(extraWr.score);
    expect(defNeed.score).toBeGreaterThan(extraWr.score);
  });

  it("does not hard-cap positions", () => {
    const te6 = getRosterNeed(teRoster(5), te, 0.9, DEFAULT_LEAGUE, { currentPick: 80 });
    expect(te6.score).toBeGreaterThan(0);
    expect(te6.diminishingFactor).toBeGreaterThan(0);
  });

  it("lowers QB demand when Superflex is off", () => {
    const noSf = withLeagueOverrides(DEFAULT_LEAGUE, { rosterSlots: { SUPERFLEX: 0 } });
    const sf = getRosterNeed(createEmptyRoster(DEFAULT_LEAGUE), qb, 0.5, DEFAULT_LEAGUE, {
      currentPick: 21,
    });
    const oneQb = getRosterNeed(createEmptyRoster(noSf), qb, 0.5, noSf, { currentPick: 21 });
    expect(sf.starterPressure).toBeGreaterThan(oneQb.starterPressure);
    expect(sf.score).toBeGreaterThan(oneQb.score);
    expect(replacementRankForPosition(DEFAULT_LEAGUE, "QB", MOCK_PLAYERS)).toBeGreaterThan(
      replacementRankForPosition(noSf, "QB", MOCK_PLAYERS),
    );
  });

  it("does not inherit Superflex QB2 pressure in a 1QB league after QB1", () => {
    const oneQbLeague = ESPN_BASELINE_LEAGUE;
    const afterQb1 = starterPressure({
      position: "QB",
      rosteredCount: 1,
      round: 6,
      league: oneQbLeague,
    });
    const sfAfterQb1 = starterPressure({
      position: "QB",
      rosteredCount: 1,
      round: 6,
      league: DEFAULT_LEAGUE,
    });
    expect(afterQb1).toBeLessThan(0.25);
    expect(sfAfterQb1).toBeGreaterThan(afterQb1 + 0.3);
  });

  it("computes starter-slot marginal value without a flat QB bonus", () => {
    const empty = createEmptyRoster(DEFAULT_LEAGUE);
    const qbMarginal = marginalStartingLineupValue(empty, qb, DEFAULT_LEAGUE);
    const wrMarginal = marginalStartingLineupValue(empty, wr, DEFAULT_LEAGUE);
    expect(qbMarginal).toBe(qb.projectedPoints);
    expect(wrMarginal).toBe(wr.projectedPoints);
    expect(qbMarginal).toBeGreaterThan(wrMarginal);
  });
});
