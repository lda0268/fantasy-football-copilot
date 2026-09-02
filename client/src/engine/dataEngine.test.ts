import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS } from "../data/mockPlayers";
import { SUPERFLEX_CONSENSUS_ADP } from "../data/superflexConsensusAdp";
import { createEmptyRoster } from "../types/draft";
import { DEFAULT_LEAGUE, withLeagueOverrides } from "../types/league";
import {
  importExpertRankingsFromCsv,
  importMarketAdpFromCsv,
  importMarketAdpFromJson,
} from "./data/importers";
import { mergeMarketAdp } from "./data/mergeUniverse";
import { normalizePlayerName, normalizeTeam } from "./data/normalizeName";
import { matchByIdentity } from "./data/playerMatch";
import {
  getExpertOverallRank,
  getMarketAdp,
  marketAdpScore,
  normalizeAdpValue,
} from "./data/sourceFields";
import { RECOMMENDATION_WEIGHTS } from "./constants";
import { getRecommendations } from "./recommendations";
import { estimateSurvivalProbability } from "./survivalProbability";
import { testPlayer } from "./testPlayers";

describe("player name normalization", () => {
  it("strips punctuation, suffixes, apostrophes, and spacing differences", () => {
    expect(normalizePlayerName("Ja'Marr Chase")).toBe("jamarr chase");
    expect(normalizePlayerName("Brian Robinson Jr.")).toBe("brian robinson");
    expect(normalizePlayerName("Marvin Harrison III")).toBe("marvin harrison");
    expect(normalizePlayerName("A.J. Brown")).toBe(normalizePlayerName("AJ Brown"));
    expect(normalizePlayerName("C.J. Stroud")).toBe(normalizePlayerName("CJ Stroud"));
    expect(normalizePlayerName("Eddy Piñeiro")).toBe(normalizePlayerName("Eddy Pineiro"));
    expect(normalizeTeam("JAC")).toBe("jax");
    expect(normalizeTeam("WSH")).toBe("was");
  });
});

describe("player identity matching", () => {
  it("does not silently merge ambiguous same-name players", () => {
    const result = matchByIdentity(
      { name: "Josh Allen", position: "QB", team: "FA" },
      [
        { name: "Josh Allen", position: "QB", team: "BUF" },
        { name: "Josh Allen", position: "QB", team: "JAX" },
      ],
    );
    expect(result.status).toBe("ambiguous");
    expect(result.record).toBeUndefined();
  });

  it("matches when team disambiguates", () => {
    const result = matchByIdentity(
      { name: "Josh Allen", position: "QB", team: "BUF" },
      [
        { name: "Josh Allen", position: "QB", team: "BUF" },
        { name: "Josh Allen", position: "QB", team: "JAX" },
      ],
    );
    expect(result.status).toBe("matched");
    expect(result.record?.team).toBe("BUF");
  });
});

describe("superflex consensus ADP merge", () => {
  it("attaches consensus Superflex ADP without replacing expert rank", () => {
    const allen = MOCK_PLAYERS.find((player) => player.name === "Josh Allen")!;
    const chase = MOCK_PLAYERS.find((player) => player.name === "Ja'Marr Chase")!;
    const ajBrown = MOCK_PLAYERS.find((player) => player.name === "AJ Brown")!;
    const consensusAllen = SUPERFLEX_CONSENSUS_ADP.find((record) => record.name === "Josh Allen")!;

    expect(getMarketAdp(allen)).toBe(consensusAllen.adp);
    expect(allen.adpSource).toBe("Superflex Consensus");
    expect(getExpertOverallRank(allen)).not.toBe(getMarketAdp(allen));
    expect(getExpertOverallRank(chase)).toBeDefined();
    expect(getMarketAdp(ajBrown)).toBe(18.1);
    expect(allen.expertSource).toBe("ESPN PPR");
  });

  it("skips ambiguous ADP records instead of merging them", () => {
    const players = [
      testPlayer({
        id: "a",
        name: "Josh Allen",
        position: "QB",
        team: "FA",
        positionalRank: 1,
        projectedPoints: 380,
        adp: 40,
      }),
    ];
    const { players: merged, report } = mergeMarketAdp(players, [
      { name: "Josh Allen", position: "QB", team: "BUF", adp: 1.4, source: "Superflex Consensus" },
      { name: "Josh Allen", position: "QB", team: "JAX", adp: 90, source: "Superflex Consensus" },
    ]);
    expect(report.ambiguous).toContain("Josh Allen");
    expect(merged[0].adp).toBe(40);
  });
});

describe("ADP value normalization", () => {
  it("treats positive adp - currentPick as later market value", () => {
    expect(normalizeAdpValue(12)).toBeGreaterThan(0.5);
    expect(normalizeAdpValue(-12)).toBeLessThan(0.5);
    expect(normalizeAdpValue(400)).toBeLessThanOrEqual(0.85);
    expect(normalizeAdpValue(-400)).toBeGreaterThanOrEqual(0.15);
  });

  it("cannot overwhelm league-adjusted scoring because ADP weight is capped", () => {
    expect(RECOMMENDATION_WEIGHTS.adp).toBe(0.1);
    expect(RECOMMENDATION_WEIGHTS.vor).toBe(0.3);
    const late = marketAdpScore(testPlayer({
      id: "late",
      name: "Late",
      position: "WR",
      positionalRank: 1,
      projectedPoints: 200,
      adp: 80,
    }), 1);
    const early = marketAdpScore(testPlayer({
      id: "early",
      name: "Early",
      position: "WR",
      positionalRank: 1,
      projectedPoints: 200,
      adp: 2,
    }), 1);
    expect(late.score - early.score).toBeLessThan(0.7);
  });
});

describe("survival probability", () => {
  const player = testPlayer({
    id: "p",
    name: "Target",
    position: "WR",
    positionalRank: 1,
    projectedPoints: 250,
    adp: 20,
  });

  it("responds to the current pick", () => {
    const early = estimateSurvivalProbability({
      player,
      currentPick: 1,
      picksUntilUserPick: 18,
    });
    const later = estimateSurvivalProbability({
      player,
      currentPick: 16,
      picksUntilUserPick: 18,
    });
    expect(later).toBeLessThan(early);
  });

  it("drops as player ADP gets closer to the current window", () => {
    const far = estimateSurvivalProbability({
      player: { ...player, adp: 70 },
      currentPick: 1,
      picksUntilUserPick: 18,
    });
    const close = estimateSurvivalProbability({
      player: { ...player, adp: 8 },
      currentPick: 1,
      picksUntilUserPick: 18,
    });
    expect(close).toBeLessThan(far);
    expect(Math.round(close * 100)).toBeGreaterThanOrEqual(0);
    expect(Math.round(far * 100)).toBeLessThanOrEqual(100);
  });

  it("returns a midpoint when ADP is missing", () => {
    expect(
      estimateSurvivalProbability({
        player: { ...player, adp: undefined },
        currentPick: 1,
        picksUntilUserPick: 18,
      }),
    ).toBe(0.5);
  });
});

describe("recommendation fallbacks and source separation", () => {
  it("does not break recommendations when ADP is missing", () => {
    const universe = [
      testPlayer({
        id: "wr1",
        name: "Star WR",
        position: "WR",
        positionalRank: 1,
        projectedPoints: 310,
        adp: undefined,
        espnOverallRank: 1,
      }),
      testPlayer({
        id: "rb1",
        name: "Star RB",
        position: "RB",
        positionalRank: 1,
        projectedPoints: 298,
        adp: undefined,
        espnOverallRank: 2,
      }),
      testPlayer({
        id: "qb1",
        name: "Star QB",
        position: "QB",
        positionalRank: 1,
        projectedPoints: 380,
        adp: undefined,
        espnOverallRank: 12,
      }),
    ];

    const recs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((rec) => Number.isFinite(rec.score))).toBe(true);
    expect(recs.every((rec) => rec.reasons.length >= 2)).toBe(true);
  });

  it("keeps expert rank and ADP as separate inputs", () => {
    const base = {
      position: "WR" as const,
      positionalRank: 1,
      projectedPoints: 280,
    };
    const expertFavorite = testPlayer({
      ...base,
      id: "expert",
      name: "Expert Favorite",
      espnOverallRank: 1,
      expertOverallRank: 1,
      adp: 40,
    });
    const marketFavorite = testPlayer({
      ...base,
      id: "market",
      name: "Market Favorite",
      espnOverallRank: 40,
      expertOverallRank: 40,
      adp: 1.5,
    });
    const filler = testPlayer({
      id: "fill",
      name: "Filler",
      position: "RB",
      positionalRank: 8,
      projectedPoints: 180,
      espnOverallRank: 50,
      adp: 50,
    });

    const recs = getRecommendations({
      availablePlayers: [expertFavorite, marketFavorite, filler],
      playerUniverse: [expertFavorite, marketFavorite, filler],
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    }, 3);

    const expertRec = recs.find((rec) => rec.player.id === "expert")!;
    const marketRec = recs.find((rec) => rec.player.id === "market")!;
    expect(expertRec.expertValue).toBeGreaterThan(marketRec.expertValue);
    expect(marketRec.adpValue).not.toBe(expertRec.adpValue);
    expect(getExpertOverallRank(expertRec.player)).toBe(1);
    expect(getMarketAdp(expertRec.player)).toBe(40);
  });

  it("still produces scores when both expert rank and ADP are missing", () => {
    const universe = [
      testPlayer({
        id: "a",
        name: "A",
        position: "WR",
        positionalRank: 1,
        projectedPoints: 300,
        espnOverallRank: 0,
        expertOverallRank: undefined,
        adp: undefined,
      }),
      testPlayer({
        id: "b",
        name: "B",
        position: "RB",
        positionalRank: 1,
        projectedPoints: 240,
        espnOverallRank: 0,
        expertOverallRank: undefined,
        adp: undefined,
      }),
    ];
    const recs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    }, 2);
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score);
    expect(recs.every((rec) => rec.score >= 0)).toBe(true);
  });
});

describe("league-adjusted Superflex recommendation", () => {
  it("lets an elite Superflex QB outrank elite RB/WR when settings justify it", () => {
    const qbs = Array.from({ length: 16 }, (_, index) =>
      testPlayer({
        id: `qb${index + 1}`,
        name: `QB${index + 1}`,
        position: "QB",
        positionalRank: index + 1,
        projectedPoints: index === 0 ? 430 : 310 - index * 8,
        espnOverallRank: 5 + index,
        adp: 10 + index,
      }),
    );
    const wrs = Array.from({ length: 40 }, (_, index) =>
      testPlayer({
        id: `wr${index + 1}`,
        name: `WR${index + 1}`,
        position: "WR",
        positionalRank: index + 1,
        projectedPoints: index === 0 ? 305 : 240 - index * 2,
        espnOverallRank: 8 + index,
        adp: 12 + index,
      }),
    );
    const rbs = Array.from({ length: 30 }, (_, index) =>
      testPlayer({
        id: `rb${index + 1}`,
        name: `RB${index + 1}`,
        position: "RB",
        positionalRank: index + 1,
        projectedPoints: index === 0 ? 298 : 230 - index * 2,
        espnOverallRank: 50 + index,
        adp: 50 + index,
      }),
    );
    const tes = Array.from({ length: 12 }, (_, index) =>
      testPlayer({
        id: `te${index + 1}`,
        name: `TE${index + 1}`,
        position: "TE",
        positionalRank: index + 1,
        projectedPoints: 180 - index * 6,
        espnOverallRank: 90 + index,
        adp: 80 + index,
      }),
    );
    const universe = [...qbs, ...wrs, ...rbs, ...tes];
    const recs = getRecommendations({
      availablePlayers: universe,
      playerUniverse: universe,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    }, 5);
    expect(recs[0].player.position).toBe("QB");
    expect(recs[0].player.id).toBe("qb1");
  });

  it("lets elite RB/WR outrank QBs when their VOR is stronger", () => {
    const recs = getRecommendations({
      availablePlayers: MOCK_PLAYERS,
      playerUniverse: MOCK_PLAYERS,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    }, 12);
    const chase = recs.find((rec) => rec.player.name === "Ja'Marr Chase");
    const nix = recs.find((rec) => rec.player.name === "Bo Nix");
    const skillAheadOfMidQb = recs.some(
      (rec) => rec.player.position === "WR" || rec.player.position === "RB",
    );
    expect(skillAheadOfMidQb).toBe(true);
    expect(chase).toBeDefined();
    if (nix) {
      expect(chase!.score).toBeGreaterThan(nix.score);
    }
    const noSf = withLeagueOverrides(DEFAULT_LEAGUE, { rosterSlots: { SUPERFLEX: 0 } });
    const noSfRecs = getRecommendations({
      availablePlayers: MOCK_PLAYERS,
      playerUniverse: MOCK_PLAYERS,
      currentPick: 1,
      roster: createEmptyRoster(noSf),
      league: noSf,
    }, 8);
    const noSfAllen = noSfRecs.find((rec) => rec.player.name === "Josh Allen");
    const noSfChase = noSfRecs.find((rec) => rec.player.name === "Ja'Marr Chase");
    expect(noSfChase).toBeDefined();
    expect((noSfChase?.score ?? 0)).toBeGreaterThan(noSfAllen?.score ?? 0);
  });
});

describe("generic JSON/CSV importers", () => {
  it("imports Superflex ADP JSON and validates errors", () => {
    const result = importMarketAdpFromJson([
      { name: "Josh Allen", position: "QB", team: "BUF", adp: 1.4, positional_adp: 1 },
      { name: "", position: "WR", adp: 2 },
      { name: "Bad", position: "WR", adp: -1 },
      { name: "No Pos", adp: 4 },
      { name: "Josh Allen", position: "QB", adp: 2 },
    ]);
    expect(result.records).toHaveLength(1);
    expect(result.errors.some((error) => error.message === "Missing player name")).toBe(true);
    expect(result.errors.some((error) => error.message === "Invalid ADP")).toBe(true);
    expect(result.errors.some((error) => error.message === "Missing position")).toBe(true);
    expect(result.errors.some((error) => error.message.includes("Duplicate"))).toBe(true);
  });

  it("imports CSV expert rankings", () => {
    const csv = [
      "name,position,team,rank",
      "Ja'Marr Chase,WR,CIN,1",
      "Justin Jefferson,WR,MIN,2",
    ].join("\n");
    const result = importExpertRankingsFromCsv(csv);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].overallRank).toBe(1);
  });

  it("imports CSV market ADP", () => {
    const csv = [
      "name,position,team,adp,positional_adp",
      "Josh Allen,QB,BUF,1.4,1",
    ].join("\n");
    const result = importMarketAdpFromCsv(csv, "Superflex Consensus");
    expect(result.records[0].adp).toBe(1.4);
    expect(result.records[0].source).toBe("Superflex Consensus");
  });
});
