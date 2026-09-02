import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS } from "../data/mockPlayers";
import { createEmptyRoster, createRosterTemplate } from "../types/draft";
import {
  DEFAULT_LEAGUE,
  ESPN_BASELINE_LEAGUE,
  slotAcceptsPosition,
  withLeagueOverrides,
} from "../types/league";
import {
  getPicksUntilUserPick,
  getRoundForPick,
  getTeamSlotForPick,
} from "./draftOrder";
import { RECOMMENDATION_WEIGHTS } from "./constants";
import { getRecommendations } from "./recommendations";
import { getReplacementLevel } from "./replacement";
import { optimizeLineup } from "./roster";
import { calculateScarcityScore } from "./scarcity";
import { expectedStarterDemand } from "./starterDemand";
import { detectAllTiers } from "./tiers";
import { testPlayer } from "./testPlayers";
import { calculateVor } from "./vor";

describe("10-team snake draft order", () => {
  const teamCount = 10;

  it("snakes through 10 teams", () => {
    expect(getTeamSlotForPick(1, teamCount)).toBe(1);
    expect(getTeamSlotForPick(10, teamCount)).toBe(10);
    expect(getRoundForPick(10, teamCount)).toBe(1);
    expect(getTeamSlotForPick(11, teamCount)).toBe(10);
    expect(getTeamSlotForPick(20, teamCount)).toBe(1);
    expect(getPicksUntilUserPick(2, 1, teamCount)).toBe(18);
  });
});

describe("roster slot eligibility", () => {
  it("lets Superflex accept QB/RB/WR/TE", () => {
    expect(slotAcceptsPosition("SUPERFLEX", "QB", DEFAULT_LEAGUE)).toBe(true);
    expect(slotAcceptsPosition("SUPERFLEX", "RB", DEFAULT_LEAGUE)).toBe(true);
    expect(slotAcceptsPosition("SUPERFLEX", "WR", DEFAULT_LEAGUE)).toBe(true);
    expect(slotAcceptsPosition("SUPERFLEX", "TE", DEFAULT_LEAGUE)).toBe(true);
    expect(slotAcceptsPosition("SUPERFLEX", "K", DEFAULT_LEAGUE)).toBe(false);
  });

  it("rejects QB from standard FLEX", () => {
    expect(slotAcceptsPosition("FLEX", "QB", DEFAULT_LEAGUE)).toBe(false);
    expect(slotAcceptsPosition("FLEX", "RB", DEFAULT_LEAGUE)).toBe(true);
    expect(slotAcceptsPosition("FLEX", "WR", DEFAULT_LEAGUE)).toBe(true);
    expect(slotAcceptsPosition("FLEX", "TE", DEFAULT_LEAGUE)).toBe(true);
  });

  it("recognizes three WR starter slots", () => {
    const wrSlots = createRosterTemplate(DEFAULT_LEAGUE).filter((slot) => slot.slotType === "WR");
    expect(wrSlots.map((slot) => slot.label)).toEqual(["WR1", "WR2", "WR3"]);
    expect(DEFAULT_LEAGUE.rosterSlots.WR).toBe(3);
  });
});

describe("superflex lineup optimization", () => {
  it("places the highest leftover value in Superflex rather than forcing a QB", () => {
    const lineup = optimizeLineup(
      [
        testPlayer({ id: "qb1", name: "QB1", position: "QB", positionalRank: 1, projectedPoints: 380 }),
        testPlayer({ id: "qb2", name: "QB2", position: "QB", positionalRank: 2, projectedPoints: 250 }),
        testPlayer({ id: "rb1", name: "RB1", position: "RB", positionalRank: 1, projectedPoints: 298 }),
        testPlayer({ id: "rb2", name: "RB2", position: "RB", positionalRank: 2, projectedPoints: 285 }),
        testPlayer({ id: "wr1", name: "WR1", position: "WR", positionalRank: 1, projectedPoints: 310 }),
        testPlayer({ id: "wr2", name: "WR2", position: "WR", positionalRank: 2, projectedPoints: 305 }),
        testPlayer({ id: "wr3", name: "WR3", position: "WR", positionalRank: 3, projectedPoints: 280 }),
        testPlayer({ id: "wr4", name: "WR4", position: "WR", positionalRank: 4, projectedPoints: 275 }),
        testPlayer({ id: "wr5", name: "WR5", position: "WR", positionalRank: 5, projectedPoints: 270 }),
        testPlayer({ id: "te1", name: "TE1", position: "TE", positionalRank: 1, projectedPoints: 220 }),
      ],
      DEFAULT_LEAGUE,
    );

    const superflex = lineup.find((slot) => slot.slotType === "SUPERFLEX");
    expect(superflex?.player?.id).toBe("wr5");
  });
});

describe("league-aware replacement and value", () => {
  const universe = MOCK_PLAYERS;
  const allen = MOCK_PLAYERS.find((player) => player.name === "Josh Allen")!;

  it("sets Superflex QB replacement deeper than standard 1QB", () => {
    const superflexRank = getReplacementLevel(universe, "QB", DEFAULT_LEAGUE).rank;
    const oneQbRank = getReplacementLevel(universe, "QB", ESPN_BASELINE_LEAGUE).rank;
    expect(superflexRank).toBeGreaterThan(oneQbRank);
    expect(oneQbRank).toBe(11);
  });

  it("gives elite QBs materially higher VOR in Superflex", () => {
    const sfPoints = getReplacementLevel(universe, "QB", DEFAULT_LEAGUE).projectedPoints;
    const oneQbPoints = getReplacementLevel(universe, "QB", ESPN_BASELINE_LEAGUE).projectedPoints;
    const sfVor = calculateVor(allen, sfPoints);
    const oneQbVor = calculateVor(allen, oneQbPoints);
    expect(sfVor).toBeGreaterThan(oneQbVor + 20);
  });

  it("does not blindly rank every QB ahead of elite RB/WR players", () => {
    const recs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
      picks: [],
    });

    const qbCount = recs.filter((rec) => rec.player.position === "QB").length;
    expect(qbCount).toBeLessThan(5);
    expect(recs.some((rec) => rec.player.position === "WR" || rec.player.position === "RB")).toBe(true);
  });

  it("changes QB values when Superflex is turned off", () => {
    const noSf = withLeagueOverrides(DEFAULT_LEAGUE, { rosterSlots: { SUPERFLEX: 0 } });
    const withSf = getReplacementLevel(universe, "QB", DEFAULT_LEAGUE);
    const withoutSf = getReplacementLevel(universe, "QB", noSf);
    expect(withSf.rank).toBeGreaterThan(withoutSf.rank);
    expect(calculateVor(allen, withSf.projectedPoints)).toBeGreaterThan(
      calculateVor(allen, withoutSf.projectedPoints),
    );

    const sfRecs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    }, 40);
    const noSfRecs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(noSf),
      league: noSf,
    }, 40);
    const sfScore = sfRecs.find((rec) => rec.player.id === allen.id)?.score ?? 0;
    const noSfScore = noSfRecs.find((rec) => rec.player.id === allen.id)?.score ?? 0;
    expect(sfScore).toBeGreaterThan(noSfScore);
  });

  it("increases WR scarcity when WR starter count rises", () => {
    const twoWr = withLeagueOverrides(DEFAULT_LEAGUE, { rosterSlots: { WR: 2 } });
    const wr = universe.find((player) => player.position === "WR")!;
    const vorById = new Map(universe.map((player) => [player.id, player.projectedPoints]));
    const tiersById = detectAllTiers(universe);

    const threeWrScarcity = calculateScarcityScore({
      availablePlayers: universe,
      playerUniverse: universe,
      position: "WR",
      playerId: wr.id,
      vorById,
      tiersById,
      league: DEFAULT_LEAGUE,
    });
    const twoWrScarcity = calculateScarcityScore({
      availablePlayers: universe,
      playerUniverse: universe,
      position: "WR",
      playerId: wr.id,
      vorById,
      tiersById,
      league: twoWr,
    });

    expect(expectedStarterDemand(DEFAULT_LEAGUE, "WR", universe)).toBeGreaterThan(
      expectedStarterDemand(twoWr, "WR", universe),
    );
    expect(threeWrScarcity).toBeGreaterThan(twoWrScarcity);
  });

  it("treats ESPN overall rank as an input rather than the final recommendation", () => {
    expect(RECOMMENDATION_WEIGHTS.expert).toBeLessThan(RECOMMENDATION_WEIGHTS.vor);
    const recs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
      picks: [],
    });
    const espnTopFive = [...universe]
      .sort((a, b) => a.espnOverallRank - b.espnOverallRank)
      .slice(0, 5)
      .map((player) => player.id);
    expect(recs.map((rec) => rec.player.id)).not.toEqual(espnTopFive);
    expect(recs.every((rec) => rec.player.espnOverallRank > 0)).toBe(true);
    expect(recs.every((rec) => rec.player.espnSource.format === "PPR")).toBe(true);
    expect(recs.every((rec) => rec.leagueAdjustedRank >= 1)).toBe(true);
  });

  it("can recommend an elite QB in the first round without ranking every QB over elite skill players", () => {
    const recs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
      picks: [],
    }, 8);
    const eliteQb = recs.some(
      (rec) => rec.player.position === "QB" && rec.player.positionalRank <= 2,
    );
    const allenRec = recs.find((rec) => rec.player.id === allen.id);
    const qbCount = recs.filter((rec) => rec.player.position === "QB").length;
    expect(eliteQb).toBe(true);
    expect(qbCount).toBeLessThan(5);
    expect(allenRec?.leagueAdjustedRank).toBeLessThanOrEqual(5);
  });
});
