import { describe, expect, it } from "vitest";
import { DRAFT_PLAYERS } from "../../data/draftUniverse";
import { attachProjectionsToUniverse, loadPrimaryPlayerProjections } from "../../data/loadProjections";
import { createEmptyRoster } from "../../types/draft";
import type { PlayerProjection } from "../../types/projections";
import { DEFAULT_LEAGUE, ESPN_BASELINE_LEAGUE, withLeagueOverrides } from "../../types/league";
import { isIdpPosition, normalizePosition } from "../data/normalizePosition";
import { matchByIdentity } from "../data/playerMatch";
import { scorePlayers } from "../recommendations";
import { getReplacementLevel } from "../replacement";
import { calculateProjectedPoints } from "../scoring";
import { testPlayer } from "../testPlayers";
import { calculateVor } from "../vor";
import { parseProjectionCsv } from "./parseProjectionCsv";
import { mergeProjectionsOntoPlayers } from "./mergeProjections";
import {
  projectionsFromSelectedSets,
  selectPrimaryProjectionSets,
} from "./selectProjectionSets";
import { scorePlayerProjection } from "./scoreProjection";

const HEADERS = [
  "id",
  "name",
  "pos",
  "team",
  "set-id",
  "set-userid",
  "set-name",
  "ssn-gms",
  "ssn-ssn",
  "pass-2pt",
  "pass-att",
  "pass-cmp",
  "pass-int",
  "pass-td",
  "pass-yds",
  "rush-2pt",
  "rush-car",
  "rush-td",
  "rush-yds",
  "rec-2pt",
  "rec-rec",
  "rec-tgt",
  "rec-td",
  "rec-yds",
  "fum-lost",
  "kck-xpm",
  "kck-fgm",
  "kck-fga",
  "pr-td",
  "pr-yds",
  "kr-td",
  "kr-yds",
  "tmd-blk",
  "tmd-fmr",
  "tmd-int",
  "tmd-pa",
  "tmd-sck",
  "tmd-saf",
  "tmd-td",
];

function csvRow(values: Record<string, string | number>): string {
  return HEADERS.map((header) => String(values[header] ?? "")).join(",");
}

function csvFrom(rows: Array<Record<string, string | number>>): string {
  return [HEADERS.join(","), ...rows.map(csvRow)].join("\n");
}

function skillPlayer(
  setId: string,
  setName: string,
  id: string,
  name: string,
  pos: string,
  team: string,
  extra: Record<string, string | number> = {},
): Record<string, string | number> {
  return {
    id,
    name,
    pos,
    team,
    "set-id": setId,
    "set-name": setName,
    "ssn-ssn": 2026,
    "ssn-gms": 17,
    ...extra,
  };
}

function buildMultiSetCsv(): string {
  const consensusSkill = "Projections Consensus";
  const consensusKick = "Projections Consensus";
  const thinConsensus = "Projections Consensus";
  const analyst = "Analyst Bob";
  const rows: Array<Record<string, string | number>> = [
    skillPlayer("111", consensusSkill, "ja", "Josh Allen", "qb", "BUF", {
      "pass-yds": 4000,
      "pass-td": 30,
      "pass-int": 10,
      "rush-yds": 500,
      "rush-td": 8,
      "pass-2pt": 1,
      "rush-2pt": 1,
      "fum-lost": 3,
    }),
    skillPlayer("111", consensusSkill, "jg", "Jahmyr Gibbs", "rb", "DET", {
      "rush-yds": 1200,
      "rush-td": 12,
      "rec-rec": 70,
      "rec-yds": 550,
      "rec-td": 4,
    }),
    skillPlayer("111", consensusSkill, "pn", "Puka Nacua", "wr", "LAR", {
      "rec-rec": 110,
      "rec-yds": 1400,
      "rec-td": 8,
      "pr-yds": 200,
      "kr-yds": 300,
      "pr-td": 1,
      "kr-td": 1,
    }),
    skillPlayer("111", consensusSkill, "tm", "Trey McBride", "te", "ARI", {
      "rec-rec": 100,
      "rec-yds": 1000,
      "rec-td": 10,
    }),
    skillPlayer("111", consensusSkill, "chase-a", "Ja'Marr Chase", "wr", "CIN", { "rec-yds": 1400, "rec-rec": 100, "rec-td": 12 }),
    skillPlayer("111", consensusSkill, "chase-b", "Ja'Marr Chase", "wr", "CIN", { "rec-yds": 900, "rec-rec": 80, "rec-td": 6 }),
    skillPlayer("111", consensusSkill, "lb1", "Roquan Smith", "lb", "BAL", { "tmd-sck": 5 }),
    skillPlayer("444", analyst, "ja-bob", "Josh Allen", "qb", "BUF", { "pass-yds": 9999, "pass-td": 99 }),
  ];

  for (let i = 2; i <= 8; i += 1) {
    rows.push(skillPlayer("111", consensusSkill, `qb${i}`, `QB Depth ${i}`, "qb", "NE", { "pass-yds": 3500 - i * 40, "pass-td": 22 }));
  }
  for (let i = 2; i <= 12; i += 1) {
    rows.push(skillPlayer("111", consensusSkill, `rb${i}`, `RB Depth ${i}`, "rb", "CHI", { "rush-yds": 900 - i * 20, "rush-td": 6, "rec-rec": 30 }));
  }
  for (let i = 2; i <= 18; i += 1) {
    rows.push(skillPlayer("111", consensusSkill, `wr${i}`, `WR Depth ${i}`, "wr", "NYJ", { "rec-rec": 70 - i, "rec-yds": 900 - i * 15, "rec-td": 5 }));
  }
  for (let i = 2; i <= 8; i += 1) {
    rows.push(skillPlayer("111", consensusSkill, `te${i}`, `TE Depth ${i}`, "te", "SEA", { "rec-rec": 50, "rec-yds": 600 - i * 10, "rec-td": 4 }));
  }

  rows.push(skillPlayer("333", thinConsensus, "thin-ja", "Josh Allen", "qb", "BUF", { "pass-yds": 3000 }));
  rows.push(skillPlayer("333", thinConsensus, "thin-qb2", "Thin QB 2", "qb", "DAL", { "pass-yds": 2800 }));

  for (let i = 1; i <= 12; i += 1) {
    rows.push(skillPlayer("222", consensusKick, `k${i}`, `Kicker ${i}`, "pk", "KC", { "kck-xpm": 40, "kck-fgm": 28, "kck-fga": 33 }));
  }
  rows.push(skillPlayer("222", consensusKick, "tex", "Houston Texans", "td", "HOU", {
    "tmd-sck": 45,
    "tmd-int": 15,
    "tmd-fmr": 10,
    "tmd-td": 4,
    "tmd-saf": 1,
    "tmd-blk": 2,
    "tmd-pa": 320,
  }));
  const defTeams = ["ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB"];
  for (let i = 2; i <= 12; i += 1) {
    rows.push(skillPlayer("222", consensusKick, `def${i}`, `Defense ${i}`, "td", defTeams[i - 2], { "tmd-sck": 30, "tmd-int": 10, "tmd-pa": 360 }));
  }

  return csvFrom(rows);
}

describe("Yahoo league scoring from raw projections", () => {
  it("scores passing, receiving, rushing, returns, and combined totals exactly", () => {
    expect(calculateProjectedPoints({ passYards: 4000 }, DEFAULT_LEAGUE)).toBe(160);
    expect(calculateProjectedPoints({ passTD: 30 }, DEFAULT_LEAGUE)).toBe(180);
    expect(calculateProjectedPoints({ interceptions: 10 }, DEFAULT_LEAGUE)).toBe(-20);
    expect(calculateProjectedPoints({ receptions: 100 }, DEFAULT_LEAGUE)).toBe(100);
    expect(calculateProjectedPoints({ receivingYards: 1000 }, DEFAULT_LEAGUE)).toBe(100);
    expect(calculateProjectedPoints({ receivingTD: 10 }, DEFAULT_LEAGUE)).toBe(60);
    expect(calculateProjectedPoints({ rushYards: 1000 }, DEFAULT_LEAGUE)).toBe(100);
    expect(calculateProjectedPoints({ rushTD: 10 }, DEFAULT_LEAGUE)).toBe(60);
    expect(calculateProjectedPoints({ returnYards: 500 }, DEFAULT_LEAGUE)).toBe(25);
    expect(calculateProjectedPoints({ returnTD: 2 }, DEFAULT_LEAGUE)).toBe(12);
    expect(
      calculateProjectedPoints(
        {
          passYards: 4000,
          passTD: 30,
          interceptions: 10,
          receptions: 100,
          receivingYards: 1000,
          receivingTD: 10,
          rushYards: 1000,
          rushTD: 10,
          returnYards: 500,
          returnTD: 2,
        },
        DEFAULT_LEAGUE,
      ),
    ).toBe(777);
  });

  it("scores split 2-point conversions once each at 4 points", () => {
    const projection: PlayerProjection = {
      sourcePlayerId: "x",
      name: "Converter",
      team: "BUF",
      position: "QB",
      projectionSetId: "111",
      projectionSetName: "Projections Consensus",
      passing: { twoPointConversions: 1 },
      rushing: { twoPointConversions: 1 },
      receiving: { twoPointConversions: 1 },
    };
    expect(scorePlayerProjection(projection, DEFAULT_LEAGUE).points).toBe(12);
    expect(scorePlayerProjection(projection, DEFAULT_LEAGUE).twoPointConversions).toBe(3);
  });
});

describe("projection set parsing and selection", () => {
  const parsed = parseProjectionCsv(buildMultiSetCsv());
  const selected = selectPrimaryProjectionSets(parsed.projections);
  const chosen = projectionsFromSelectedSets(parsed.projections, selected);

  it("does not treat every CSV row as a player", () => {
    expect(parsed.rowsLoaded).toBeGreaterThan(chosen.projections.length);
    expect(new Set(parsed.projections.map((item) => item.projectionSetId)).size).toBeGreaterThan(1);
  });

  it("selects the most complete consensus skill set and a separate K/DEF consensus set", () => {
    expect(selected.skill?.set.setId).toBe("111");
    expect(selected.kicker?.set.setId).toBe("222");
    expect(selected.defense?.set.setId).toBe("222");
    expect(chosen.projections.some((item) => item.projectionSetId === "444")).toBe(false);
    expect(chosen.projections.some((item) => item.projectionSetId === "333")).toBe(false);
  });

  it("normalizes positions and excludes IDP from the active pool", () => {
    expect(normalizePosition("pk")).toBe("K");
    expect(normalizePosition("td")).toBe("DEF");
    expect(isIdpPosition("lb")).toBe(true);
    expect(parsed.idpRows.length).toBeGreaterThan(0);
    expect(chosen.projections.some((item) => item.name === "Roquan Smith")).toBe(false);
  });

  it("skips duplicate consensus rows instead of averaging them", () => {
    expect(chosen.skippedDuplicates.some((key) => key.includes("jamarr chase"))).toBe(true);
    expect(chosen.projections.some((item) => item.name === "Ja'Marr Chase")).toBe(false);
  });
});

describe("player matching and scoring flags", () => {
  it("matches suffix and DEF naming without fuzzy last names", () => {
    const result = matchByIdentity(
      { name: "James Cook III", position: "RB", team: "BUF" },
      [{ name: "James Cook", position: "RB", team: "BUF", projectionSetId: "111", projectionSetName: "x", sourcePlayerId: "1" }],
    );
    expect(result.status).toBe("matched");
    const def = matchByIdentity(
      { name: "Texans D/ST", position: "DEF", team: "HOU" },
      [{ name: "Houston Texans", position: "DEF", team: "HOU", projectionSetId: "222", projectionSetName: "x", sourcePlayerId: "2" }],
    );
    expect(def.status).toBe("matched");
    const tank = matchByIdentity(
      { name: "Tank Dell", position: "WR", team: "HOU" },
      [{ name: "Nathaniel Dell", position: "WR", team: "HOU", projectionSetId: "111", projectionSetName: "x", sourcePlayerId: "3" }],
    );
    expect(tank.status).toBe("unmatched");
    const walker = matchByIdentity(
      { name: "Kenneth Walker III", position: "RB", team: "SEA" },
      [{ name: "Ken Walker III", position: "RB", team: "SEA", projectionSetId: "68137", projectionSetName: "x", sourcePlayerId: "WalkKe01" }],
    );
    expect(walker.status).toBe("matched");
  });

  it("keeps ESPN/ADP players usable when a projection is missing", () => {
    const player = testPlayer({
      id: "no-proj",
      name: "No Projection",
      position: "WR",
      positionalRank: 20,
      projectedPoints: 0,
      projectionsAvailable: false,
      expert: { overallRank: 80 },
      adp: 90,
    });
    const recs = scorePlayers({
      availablePlayers: [player],
      playerUniverse: [player],
      currentPick: 40,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });
    expect(Number.isFinite(recs[0].score)).toBe(true);
  });

  it("marks kicker and defense scoring as partial", () => {
    const parsed = parseProjectionCsv(buildMultiSetCsv());
    const selected = selectPrimaryProjectionSets(parsed.projections);
    const chosen = projectionsFromSelectedSets(parsed.projections, selected);
    const kicker = chosen.projections.find((item) => item.position === "K")!;
    const defense = chosen.projections.find((item) => item.name === "Houston Texans")!;
    const kScore = scorePlayerProjection(kicker, DEFAULT_LEAGUE);
    const dScore = scorePlayerProjection(defense, DEFAULT_LEAGUE);
    expect(kScore.kickerFieldGoalsIncomplete).toBe(true);
    expect(kScore.kickerProjectedPointsPartial).toBe(40);
    expect(kScore.points).toBe(40);
    expect(dScore.defensePointsAllowedIncomplete).toBe(true);
    expect(dScore.points).toBe(45 * 2 + 15 * 3 + 10 * 3 + 4 * 6 + 1 * 4 + 2 * 4);
  });
});

describe("replacement and VOR with projections", () => {
  const parsed = parseProjectionCsv(buildMultiSetCsv());
  const selected = selectPrimaryProjectionSets(parsed.projections);
  const chosen = projectionsFromSelectedSets(parsed.projections, selected);
  const universe = mergeProjectionsOntoPlayers(
    chosen.projections.map((projection, index) =>
      testPlayer({
        id: projection.sourcePlayerId,
        name: projection.name,
        team: projection.team,
        position: projection.position,
        positionalRank: index + 1,
        projectedPoints: 0,
      }),
    ),
    chosen.projections,
  ).players;

  it("deepens QB replacement in Superflex versus 1QB", () => {
    const sf = getReplacementLevel(universe, "QB", DEFAULT_LEAGUE);
    const oneQb = getReplacementLevel(universe, "QB", ESPN_BASELINE_LEAGUE);
    expect(sf.rank).toBeGreaterThan(oneQb.rank);
    const allen = universe.find((player) => player.name === "Josh Allen")!;
    expect(calculateVor(allen, sf.projectedPoints)).toBeGreaterThan(calculateVor(allen, oneQb.projectedPoints));
  });

  it("uses a deeper WR replacement with 3 WR starters than with 2", () => {
    const twoWr = withLeagueOverrides(DEFAULT_LEAGUE, { rosterSlots: { WR: 2 } });
    expect(getReplacementLevel(universe, "WR", DEFAULT_LEAGUE).rank).toBeGreaterThan(
      getReplacementLevel(universe, "WR", twoWr).rank,
    );
  });
});

describe("real file loader", () => {
  it("loads the production CSV when present without inventing rows", () => {
    const loaded = loadPrimaryPlayerProjections();
    if (!loaded.parsed) {
      expect(loaded.projections).toEqual([]);
      return;
    }
    expect(loaded.parsed.rowsLoaded).toBeGreaterThan(loaded.projections.length);
    expect(loaded.selected?.skill || loaded.selected?.kicker).toBeTruthy();
  });

  it("does not drop ESPN players when attaching missing projections", () => {
    const attached = attachProjectionsToUniverse(DRAFT_PLAYERS);
    expect(attached.players.length).toBe(DRAFT_PLAYERS.length);
  });
});
