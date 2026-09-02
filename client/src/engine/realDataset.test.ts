import { describe, expect, it } from "vitest";
import { DRAFT_PLAYERS, DRAFT_UNIVERSE_REPORT, mergeEspnWithAdp } from "../data/draftUniverse";
import { loadEspn2026PprRankings } from "../data/loadEspnRankings";
import { loadSuperflexConsensusAdp } from "../data/loadSuperflexAdp";
import { applyDraftPick, availableAfterPicks, undoDraftPick } from "./manualDraft";
import {
  filterAvailablePlayers,
  playerMatchesQuery,
  quickDraftPlayers,
} from "./playerSearch";
import { getRecommendations, scorePlayers } from "./recommendations";
import { identityKey, normalizePlayerName } from "./data/normalizeName";
import { normalizePosition } from "./data/normalizePosition";
import { matchByIdentity } from "./data/playerMatch";
import { getExpertOverallRank, getMarketAdp } from "./data/sourceFields";
import { createEmptyRoster, createInitialDraftState } from "../types/draft";
import { DEFAULT_LEAGUE } from "../types/league";
import { testPlayer } from "./testPlayers";

describe("real 2026 dataset loaders", () => {
  it("loads 300 ESPN players", () => {
    expect(loadEspn2026PprRankings()).toHaveLength(300);
  });

  it("loads 300 ADP records", () => {
    expect(loadSuperflexConsensusAdp()).toHaveLength(300);
  });

  it("uses the ESPN Top 300 as the draft-room universe", () => {
    expect(DRAFT_PLAYERS).toHaveLength(300);
    expect(DRAFT_PLAYERS.some((player) => player.id.startsWith("p00"))).toBe(false);
    expect(DRAFT_PLAYERS[0].id.startsWith("espn-2026-")).toBe(true);
  });
});

describe("real dataset identity and merge", () => {
  it("merges Josh Allen with separate expert and market values", () => {
    const allen = DRAFT_PLAYERS.find((player) => player.name === "Josh Allen")!;
    expect(allen.expert?.overallRank).toBe(36);
    expect(allen.expert?.source).toBe("ESPN 2026 PPR Top 300");
    expect(allen.market?.adp).toBe(3);
    expect(allen.market?.source).toBe("10-Team Superflex Consensus ADP");
    expect(getExpertOverallRank(allen)).toBe(36);
    expect(getMarketAdp(allen)).toBe(3);
  });

  it("normalizes James Cook suffixes", () => {
    expect(normalizePlayerName("James Cook III")).toBe(normalizePlayerName("James Cook"));
    const cook = DRAFT_PLAYERS.find((player) => player.name === "James Cook III")!;
    expect(getMarketAdp(cook)).toBe(12);
  });

  it("normalizes D/ST to DEF and matches Houston Texans", () => {
    expect(normalizePosition("DST")).toBe("DEF");
    expect(identityKey("Texans D/ST", "DST", "HOU")).toBe(identityKey("Houston Texans", "DEF", "HOU"));
    const texans = DRAFT_PLAYERS.find((player) => player.name === "Texans D/ST")!;
    expect(texans.position).toBe("DEF");
    expect(getMarketAdp(texans)).toBe(159);
  });

  it("matches Cam Skattebo to Cameron Skattebo", () => {
    const result = matchByIdentity(
      { name: "Cam Skattebo", position: "RB", team: "NYG" },
      [{ name: "Cameron Skattebo", position: "RB", team: "NYG", adp: 53 }],
    );
    expect(result.status).toBe("matched");
    const cam = DRAFT_PLAYERS.find((player) => player.name === "Cam Skattebo")!;
    expect(getMarketAdp(cam)).toBe(53);
  });

  it("matches Kenny Gainwell to Kenneth Gainwell", () => {
    const kenny = DRAFT_PLAYERS.find((player) => player.name === "Kenny Gainwell")!;
    expect(getMarketAdp(kenny)).toBeDefined();
  });

  it("matches Kenneth Walker III to Ken Walker III projections", () => {
    const walker = DRAFT_PLAYERS.find((player) => player.name === "Kenneth Walker III")!;
    expect(walker).toBeDefined();
    expect(walker.projection?.name).toBe("Ken Walker III");
    expect(walker.projectionsAvailable).toBe(true);
    expect(
      matchByIdentity(
        { name: "Kenneth Walker III", position: "RB", team: walker.team },
        [{ name: "Ken Walker III", position: "RB", team: walker.team }],
      ).status,
    ).toBe("matched");
    expect(
      matchByIdentity(
        { name: "Kenneth Walker III", position: "RB", team: walker.team },
        [{ name: "Kenny Gainwell", position: "RB", team: "PIT" }],
      ).status,
    ).toBe("unmatched");
  });

  it("matches Chig Okonkwo to Chigoziem Okonkwo", () => {
    const chig = DRAFT_PLAYERS.find((player) => player.name === "Chig Okonkwo")!;
    expect(getMarketAdp(chig)).toBeDefined();
  });

  it("keeps unmatched ESPN players in the available pool", () => {
    expect(DRAFT_UNIVERSE_REPORT.espnOnly.length).toBeGreaterThan(0);
    const unmatched = DRAFT_PLAYERS.find((player) => DRAFT_UNIVERSE_REPORT.espnOnly.includes(player.name));
    expect(unmatched).toBeDefined();
    expect(unmatched?.market?.adp ?? null).toBeNull();
    expect(getMarketAdp(unmatched!)).toBeUndefined();
  });

  it("reports ADP-only players instead of dropping them silently", () => {
    expect(DRAFT_UNIVERSE_REPORT.adpOnly.length).toBeGreaterThan(0);
  });
});

describe("real dataset recommendations and draft flow", () => {
  it("scores recommendations when ADP is missing", () => {
    const player = DRAFT_PLAYERS.find((item) => getMarketAdp(item) === undefined)!;
    const recs = getRecommendations({
      availablePlayers: [player, ...DRAFT_PLAYERS.filter((item) => item.id !== player.id).slice(0, 8)],
      playerUniverse: DRAFT_PLAYERS,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((rec) => Number.isFinite(rec.score))).toBe(true);
  });

  it("scores recommendations when ESPN rank is missing", () => {
    const withoutExpert = testPlayer({
      id: "no-expert",
      name: "No Expert",
      position: "RB",
      positionalRank: 12,
      projectedPoints: 0,
      espnOverallRank: 0,
      expertOverallRank: undefined,
      expert: { overallRank: undefined, source: undefined },
      adp: 40,
      market: { adp: 40, positionalAdp: 12, source: "10-Team Superflex Consensus ADP" },
      projectionsAvailable: false,
    });
    const scored = scorePlayers({
      availablePlayers: [withoutExpert, ...DRAFT_PLAYERS.slice(0, 6)],
      playerUniverse: [withoutExpert, ...DRAFT_PLAYERS.slice(0, 6)],
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });
    const noExpert = scored.find((rec) => rec.player.id === "no-expert");
    expect(noExpert).toBeDefined();
    expect(Number.isFinite(noExpert!.score)).toBe(true);
    expect(scored.every((rec) => Number.isFinite(rec.score))).toBe(true);
  });

  it("does not invent projection-dependent values", () => {
    const recs = scorePlayers({
      availablePlayers: DRAFT_PLAYERS.slice(0, 20),
      playerUniverse: DRAFT_PLAYERS,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });
    const hasRealProjections = DRAFT_PLAYERS.some((player) => player.projection);
    if (hasRealProjections) {
      const withProjection = recs.find((rec) => rec.player.projection);
      expect(withProjection?.leagueAdjustedProjectedPoints).toBeDefined();
      expect(withProjection?.player.analytics?.projectedPoints).toBe(
        withProjection?.leagueAdjustedProjectedPoints,
      );
    } else {
      expect(recs[0].player.projectionsAvailable).toBe(false);
      expect(recs[0].leagueAdjustedProjectedPoints).toBeUndefined();
      expect(recs[0].player.analytics?.projectedPoints).toBeUndefined();
    }
  });

  it("removes drafted real players immediately and restores them on undo", () => {
    const player = DRAFT_PLAYERS.find((item) => item.name === "Jahmyr Gibbs")!;
    let state = applyDraftPick(createInitialDraftState(), player);
    expect(availableAfterPicks(DRAFT_PLAYERS, state.draftedPlayerIds).some((item) => item.id === player.id)).toBe(false);
    state = undoDraftPick(state);
    expect(availableAfterPicks(DRAFT_PLAYERS, state.draftedPlayerIds).some((item) => item.id === player.id)).toBe(true);
  });

  it("supports quick search on real names", () => {
    expect(playerMatchesQuery(DRAFT_PLAYERS.find((player) => player.name === "Ja'Marr Chase")!, "jamarr")).toBe(true);
    const cooks = filterAvailablePlayers(DRAFT_PLAYERS, "cook", "RB");
    expect(cooks.some((player) => player.name.includes("Cook"))).toBe(true);
  });

  it("ranks QB/RB/WR/TE together", () => {
    const mixed = ["QB", "RB", "WR", "TE"].map(
      (position) => DRAFT_PLAYERS.find((player) => player.position === position)!,
    );
    const recs = scorePlayers({
      availablePlayers: mixed,
      playerUniverse: mixed,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });
    expect(recs).toHaveLength(4);
    expect(new Set(recs.map((rec) => rec.player.position))).toEqual(new Set(["QB", "RB", "WR", "TE"]));
    expect(recs.every((rec) => Number.isFinite(rec.score))).toBe(true);
    const quick = quickDraftPlayers(DRAFT_PLAYERS, 10);
    expect(quick.length).toBe(10);
  });
});

describe("merge helper isolation", () => {
  it("does not overwrite expert fields when attaching ADP", () => {
    const { players } = mergeEspnWithAdp(loadEspn2026PprRankings(), loadSuperflexConsensusAdp());
    const allen = players.find((player) => player.name === "Josh Allen")!;
    expect(allen.expert?.overallRank).toBe(36);
    expect(allen.market?.adp).toBe(3);
  });
});
