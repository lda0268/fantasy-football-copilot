import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS } from "../data/mockPlayers";
import { calculateScarcityScore } from "./scarcity";
import { getReplacementLevel } from "./replacement";
import { getRecommendations } from "./recommendations";
import { detectPositionalTiers } from "./tiers";
import { calculateVor, calculateVorForPlayers } from "./vor";
import { createEmptyRoster } from "../types/draft";
import { STANDARD_12_TEAM_1QB } from "../types/league";
import { testPlayer } from "./testPlayers";

describe("replacement-level determination", () => {
  it("uses the league-aware positional rank for 12-team 1QB", () => {
    const universe = Array.from({ length: 16 }, (_, index) =>
      testPlayer({
        id: `qb${index + 1}`,
        name: `QB${index + 1}`,
        position: "QB",
        positionalRank: index + 1,
        projectedPoints: 400 - index * 10,
      }),
    );

    const replacement = getReplacementLevel(universe, "QB", STANDARD_12_TEAM_1QB);
    expect(replacement.rank).toBe(13);
    expect(replacement.projectedPoints).toBe(280);
  });

  it("interpolates replacement points when the exact rank is missing", () => {
    const universe = [
      testPlayer({ id: "rb1", name: "RB1", position: "RB", positionalRank: 1, projectedPoints: 300 }),
      testPlayer({ id: "rb20", name: "RB20", position: "RB", positionalRank: 20, projectedPoints: 180 }),
      testPlayer({ id: "rb24", name: "RB24", position: "RB", positionalRank: 24, projectedPoints: 160 }),
    ];

    const replacement = getReplacementLevel(universe, "RB", STANDARD_12_TEAM_1QB);
    expect(replacement.rank).toBeGreaterThan(24);
    expect(replacement.projectedPoints).toBeLessThan(160);
  });
});

describe("VOR calculation", () => {
  it("subtracts replacement projected points from the player", () => {
    const star = testPlayer({
      id: "wr1",
      name: "WR1",
      position: "WR",
      positionalRank: 1,
      projectedPoints: 310,
    });

    expect(calculateVor(star, 140)).toBe(170);
  });

  it("derives VOR from dataset replacement rather than a hardcoded number", () => {
    const universe = [
      testPlayer({ id: "te1", name: "TE1", position: "TE", positionalRank: 1, projectedPoints: 220 }),
      testPlayer({ id: "te13", name: "TE13", position: "TE", positionalRank: 13, projectedPoints: 150 }),
    ];
    const replacement = getReplacementLevel(universe, "TE", STANDARD_12_TEAM_1QB);
    const vors = calculateVorForPlayers(universe, universe, STANDARD_12_TEAM_1QB);

    expect(vors.get("te1")).toBe(220 - replacement.projectedPoints);
    expect(vors.get("te13")).toBe(150 - replacement.projectedPoints);
  });
});

describe("positional tier detection", () => {
  it("starts a new tier after a meaningful projected-point gap", () => {
    const players = [
      testPlayer({ id: "a", name: "A", position: "WR", positionalRank: 1, projectedPoints: 300 }),
      testPlayer({ id: "b", name: "B", position: "WR", positionalRank: 2, projectedPoints: 295 }),
      testPlayer({ id: "c", name: "C", position: "WR", positionalRank: 3, projectedPoints: 240 }),
      testPlayer({ id: "d", name: "D", position: "WR", positionalRank: 4, projectedPoints: 238 }),
    ];

    const tiers = detectPositionalTiers(players, "WR");
    const byId = Object.fromEntries(tiers.map((tier) => [tier.playerId, tier]));

    expect(byId.a.tier).toBe(1);
    expect(byId.b.tier).toBe(1);
    expect(byId.c.tier).toBe(2);
    expect(byId.d.tier).toBe(2);
    expect(byId.a.pointsToNextTier).toBe(60);
    expect(byId.c.pointsToNextTier).toBe(0);
  });
});

describe("scarcity score", () => {
  it("increases when fewer quality players remain and a tier drop is near", () => {
    const scarcePlayer = testPlayer({
      id: "rb1",
      name: "RB1",
      position: "RB",
      positionalRank: 1,
      projectedPoints: 290,
    });
    const plentifulPlayer = testPlayer({
      id: "qb1",
      name: "QB1",
      position: "QB",
      positionalRank: 1,
      projectedPoints: 360,
    });

    const available = [
      scarcePlayer,
      testPlayer({ id: "rb2", name: "RB2", position: "RB", positionalRank: 2, projectedPoints: 200 }),
      plentifulPlayer,
      ...Array.from({ length: 12 }, (_, index) =>
        testPlayer({
          id: `qb${index + 2}`,
          name: `QB${index + 2}`,
          position: "QB",
          positionalRank: index + 2,
          projectedPoints: 340 - index,
        }),
      ),
    ];

    const vorById = new Map([
      ["rb1", 120],
      ["rb2", 30],
      ["qb1", 40],
      ...available.filter((p) => p.position === "QB" && p.id !== "qb1").map((p) => [p.id, 20] as const),
    ]);
    const tiersById = new Map([
      ["rb1", { playerId: "rb1", tier: 1, pointsToNextTier: 90, tierScarcity: 1 }],
      ["qb1", { playerId: "qb1", tier: 1, pointsToNextTier: 4, tierScarcity: 0.16 }],
    ]);

    const rbScarcity = calculateScarcityScore({
      availablePlayers: available,
      position: "RB",
      playerId: "rb1",
      vorById,
      tiersById,
      league: STANDARD_12_TEAM_1QB,
    });
    const qbScarcity = calculateScarcityScore({
      availablePlayers: available,
      position: "QB",
      playerId: "qb1",
      vorById,
      tiersById,
      league: STANDARD_12_TEAM_1QB,
    });

    expect(rbScarcity).toBeGreaterThan(qbScarcity);
    expect(rbScarcity).toBeGreaterThan(0);
    expect(qbScarcity).toBeGreaterThanOrEqual(0);
    expect(rbScarcity).toBeLessThanOrEqual(1);
  });
});

describe("QB raw points do not dominate rankings", () => {
  it("does not rank five quarterbacks first at pick 1 in a 1QB 12-team league", () => {
    const recs = getRecommendations({
      availablePlayers: MOCK_PLAYERS,
      playerUniverse: MOCK_PLAYERS,
      currentPick: 1,
      roster: createEmptyRoster(STANDARD_12_TEAM_1QB),
      picksUntilUserPick: 0,
      userSlot: 1,
      teamCount: 12,
      league: STANDARD_12_TEAM_1QB,
    });

    const qbCount = recs.filter((rec) => rec.player.position === "QB").length;
    expect(recs).toHaveLength(5);
    expect(qbCount).toBeLessThan(5);
    expect(recs[0].player.position).not.toBe("QB");
    expect(MOCK_PLAYERS.some((player) => player.position === "QB" && player.projectedPoints > recs[0].player.projectedPoints)).toBe(true);
  });
});
