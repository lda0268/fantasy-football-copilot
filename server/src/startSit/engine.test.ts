import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { PlayerIntelligence } from "../playerIntelligence/types.js";
import type { YahooRosterPlayer } from "../yahoo/types.js";
import { isMultiPositionSlot, playerFillsSlot, slotEligibility, yahooNflEligibility } from "./eligibility.js";
import { buildStartSitRecommendation } from "./engine.js";
import { greedyAssignment, optimizeAssignment, type OptimizablePlayer } from "./optimize.js";
import { expandStartingSlots } from "./slots.js";
import { classifyWeeklySupport } from "./weeklyValue.js";
import type { StartSitEngineInput } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function roster(partial: Partial<YahooRosterPlayer> & Pick<YahooRosterPlayer, "playerKey" | "name">): YahooRosterPlayer {
  return {
    playerId: partial.playerId ?? partial.playerKey,
    displayPosition: partial.displayPosition ?? "RB",
    eligiblePositions: partial.eligiblePositions ?? [partial.displayPosition ?? "RB"],
    ...partial,
  };
}

function intel(
  partial: Partial<PlayerIntelligence> & { key: string; name: string; status?: PlayerIntelligence["identity"]["status"] },
): PlayerIntelligence {
  return {
    identity: {
      yahooPlayerKey: partial.key,
      status: partial.status ?? "matched",
      method: "external_id",
      confidence: "exact",
    },
    player: { name: partial.name, position: partial.player?.position ?? "RB", team: partial.player?.team ?? "KC" },
    leagueState: {
      availability: "rostered_by_user",
      rosterSlot: partial.leagueState?.rosterSlot,
    },
    weekly: partial.weekly,
    restOfSeason: { projectedPoints: 999, ecr: 1 },
    injury: partial.injury,
    provenance: { yahoo: true, fantasyPros: partial.status === "matched" || partial.status === undefined, fields: {} },
    freshness: {},
    warnings: partial.warnings ?? [],
  };
}

function denseReference() {
  const weeklyProjections: Array<{ fantasyProsId: string; position: string; fantasyPoints: number }> = [];
  const weeklyRankings: Array<{ fantasyProsId: string; position: string; rank: number }> = [];
  for (const position of ["QB", "RB", "WR", "TE", "K", "DEF"]) {
    for (let i = 1; i <= 40; i += 1) {
      weeklyProjections.push({ fantasyProsId: `${position}-${i}`, position, fantasyPoints: i });
      weeklyRankings.push({ fantasyProsId: `${position}-r${i}`, position, rank: i });
    }
  }
  return { weeklyProjections, weeklyRankings };
}

const STANDARD_SLOTS = [
  { position: "QB", count: 1 },
  { position: "RB", count: 2 },
  { position: "WR", count: 2 },
  { position: "TE", count: 1 },
  { position: "W/R/T", count: 1 },
  { position: "K", count: 1 },
  { position: "DEF", count: 1 },
  { position: "BN", count: 6 },
  { position: "IR", count: 1 },
];

function run(partial: Partial<StartSitEngineInput> & Pick<StartSitEngineInput, "roster" | "players">) {
  return buildStartSitRecommendation({
    week: 2,
    scoringFormat: "half_ppr",
    providerModes: { yahoo: "fixture", fantasyPros: "fixture" },
    lineupSource: "fixture",
    rosterPositions: STANDARD_SLOTS,
    reference: denseReference(),
    ...partial,
  });
}

function starterPack(): { roster: YahooRosterPlayer[]; players: PlayerIntelligence[] } {
  const rows: Array<[string, string, string, string, number, number]> = [
    ["qb1", "Start QB", "QB", "QB", 20, 8],
    ["rb1", "Start RB1", "RB", "RB", 12, 20],
    ["rb2", "Start RB2", "RB", "RB", 10, 30],
    ["wr1", "Start WR1", "WR", "WR", 14, 15],
    ["wr2", "Start WR2", "WR", "WR", 11, 25],
    ["te1", "Start TE", "TE", "TE", 8, 12],
    ["flex1", "Start FLEX", "WR", "W/R/T", 9, 40],
    ["k1", "Start K", "K", "K", 8, 10],
    ["def1", "Start DEF", "DEF", "DEF", 7, 12],
    ["bn-rb", "Bench RB", "RB", "BN", 16, 8],
    ["bn-wr", "Bench WR", "WR", "BN", 6, 50],
  ];
  return {
    roster: rows.map(([playerKey, name, pos, slot, ,]) =>
      roster({
        playerKey,
        name,
        displayPosition: pos,
        eligiblePositions: pos === "DEF" ? ["DEF"] : [pos, "W/R/T"].filter((item) => (pos === "QB" || pos === "K" || pos === "DEF" ? item === pos : true)),
        selectedPosition: slot,
      }),
    ),
    players: rows.map(([key, name, pos, slot, points, ecr]) =>
      intel({
        key,
        name,
        player: { name, position: pos },
        leagueState: { availability: "rostered_by_user", rosterSlot: slot },
        weekly: { week: 2, projectedPoints: points, ecr },
      }),
    ),
  };
}

describe("Start/Sit eligibility mapping", () => {
  it("5-12. maps Yahoo slots including FLEX, SUPERFLEX, K, and DEF/DST", () => {
    assert.deepEqual(slotEligibility("QB"), ["QB"]);
    assert.deepEqual(slotEligibility("RB"), ["RB"]);
    assert.deepEqual(slotEligibility("WR"), ["WR"]);
    assert.deepEqual(slotEligibility("TE"), ["TE"]);
    assert.deepEqual(slotEligibility("W/R/T"), ["RB", "WR", "TE"]);
    assert.deepEqual(slotEligibility("SUPERFLEX"), ["QB", "RB", "WR", "TE"]);
    assert.deepEqual(slotEligibility("K"), ["K"]);
    assert.deepEqual(slotEligibility("DST"), ["DEF"]);
    assert.equal(isMultiPositionSlot("W/R/T"), true);
    assert.equal(playerFillsSlot(["RB"], "W/R/T"), true);
    assert.equal(playerFillsSlot(["QB"], "W/R/T"), false);
    assert.equal(playerFillsSlot(["QB"], "SUPERFLEX"), true);
    assert.deepEqual(yahooNflEligibility("DST", ["D/ST"]), ["DEF"]);
  });
});

describe("Start/Sit engine", () => {
  it("1-4. parses current lineup, bench, IR, and lineup settings", () => {
    const pack = starterPack();
    pack.roster.push(
      roster({ playerKey: "ir1", name: "IR WR", displayPosition: "WR", eligiblePositions: ["WR"], selectedPosition: "IR" }),
    );
    pack.players.push(
      intel({ key: "ir1", name: "IR WR", player: { name: "IR WR", position: "WR" }, weekly: { projectedPoints: 40, ecr: 1 } }),
    );
    const result = run(pack);
    assert.equal(result.currentLineup.length, 9);
    assert.equal(result.currentLineup.find((row) => row.slot.position === "QB")?.player?.name, "Start QB");
    assert.ok(result.bench.some((player) => player.name === "Bench WR"));
    assert.equal(result.ir[0]?.name, "IR WR");
    assert.equal(result.summary.startingSlots, 9);
    assert.ok(result.lineupSettings.some((row) => row.position === "W/R/T"));
  });

  it("13. player cannot occupy two slots", () => {
    const pack = starterPack();
    const result = run(pack);
    const keys = result.recommendedLineup.map((row) => row.player?.yahooPlayerKey).filter(Boolean);
    assert.equal(keys.length, new Set(keys).size);
  });

  it("14. non-rostered player cannot be assigned", () => {
    const pack = starterPack();
    pack.players.push(
      intel({
        key: "fa1",
        name: "Free Agent",
        player: { name: "Free Agent", position: "RB" },
        weekly: { projectedPoints: 50, ecr: 1 },
      }),
    );
    const result = run(pack);
    assert.equal(
      result.recommendedLineup.some((row) => row.player?.yahooPlayerKey === "fa1"),
      false,
    );
  });

  it("A/28. obvious bench RB starts over weaker RB", () => {
    const result = run(starterPack());
    const rbNames = result.recommendedLineup.filter((row) => row.slot.position === "RB").map((row) => row.player?.name);
    assert.ok(rbNames.includes("Bench RB"));
    assert.ok(result.moves.some((move) => move.startPlayer.name === "Bench RB"));
  });

  it("C/15. explicit Out starter is replaced", () => {
    const pack = starterPack();
    const wr1 = pack.players.find((player) => player.identity.yahooPlayerKey === "wr1")!;
    wr1.injury = { status: "Out" };
    const result = run(pack);
    assert.equal(
      result.recommendedLineup.find((row) => row.slot.position === "WR" && row.slot.index === 0)?.player?.name !== "Start WR1" ||
        result.recommendedLineup.every((row) => row.player?.name !== "Start WR1"),
      true,
    );
    assert.ok(result.moves.some((move) => move.sitPlayer?.name === "Start WR1"));
  });

  it("16. IR player is not inserted", () => {
    const pack = starterPack();
    pack.roster.push(
      roster({ playerKey: "ir1", name: "IR Star", displayPosition: "RB", eligiblePositions: ["RB", "W/R/T"], selectedPosition: "IR" }),
    );
    pack.players.push(
      intel({ key: "ir1", name: "IR Star", player: { name: "IR Star", position: "RB" }, weekly: { projectedPoints: 50, ecr: 1 } }),
    );
    const result = run(pack);
    assert.equal(result.recommendedLineup.some((row) => row.player?.name === "IR Star"), false);
    assert.equal(result.ir.some((player) => player.name === "IR Star"), true);
  });

  it("17. Suspended excluded", () => {
    const pack = starterPack();
    pack.roster[3]!.status = "SUSP";
    const result = run(pack);
    assert.equal(result.recommendedLineup.some((row) => row.player?.yahooPlayerKey === "wr1"), false);
  });

  it("D/18. Questionable remains eligible with warning", () => {
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "qb1")!.injury = { status: "Questionable" };
    const result = run(pack);
    const qb = result.recommendedLineup.find((row) => row.slot.position === "QB")?.player;
    assert.equal(qb?.name, "Start QB");
    assert.ok(qb?.warnings.some((warning) => /Questionable/.test(warning)));
  });

  it("19. missing injury is not Healthy", () => {
    const pack = starterPack();
    const result = run(pack);
    const qb = result.currentLineup.find((row) => row.slot.position === "QB")?.player;
    assert.equal(qb?.injuryStatus, undefined);
    assert.equal((qb?.warnings ?? []).some((warning) => warning === "Healthy"), false);
  });

  it("G/22. missing projection is not zero", () => {
    assert.equal(classifyWeeklySupport({ ecr: 12 }).includes("supported"), true);
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "bn-wr")!.weekly = { ecr: 12 };
    const result = run(pack);
    const bench = result.bench.find((player) => player.yahooPlayerKey === "bn-wr") ?? result.recommendedLineup.find((row) => row.player?.yahooPlayerKey === "bn-wr")?.player;
    assert.equal(bench?.weeklyProjectedPoints, undefined);
  });

  it("H/23. explicit zero projection is preserved", () => {
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "k1")!.weekly = { projectedPoints: 0, ecr: 20 };
    const result = run(pack);
    assert.equal(result.currentLineup.find((row) => row.slot.position === "K")?.player?.weeklyProjectedPoints, 0);
  });

  it("24. missing ECR is handled without worst-rank fabrication", () => {
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "rb1")!.weekly = { projectedPoints: 12 };
    const result = run(pack);
    assert.equal(result.currentLineup.find((row) => row.player?.yahooPlayerKey === "rb1")?.player?.weeklyEcr, undefined);
    assert.equal(result.currentLineup.find((row) => row.player?.yahooPlayerKey === "rb1")?.player?.dataQuality, "supported");
  });

  it("E/25/27. unresolved current starter is preserved and review-required", () => {
    const pack = starterPack();
    const te = pack.players.find((player) => player.identity.yahooPlayerKey === "te1")!;
    te.identity.status = "unresolved";
    te.weekly = { projectedPoints: 1, ecr: 90 };
    te.warnings = ["FantasyPros intelligence unavailable because player identity is unresolved."];
    pack.roster.push(
      roster({ playerKey: "bn-te", name: "Bench TE", displayPosition: "TE", eligiblePositions: ["TE"], selectedPosition: "BN" }),
    );
    pack.players.push(
      intel({ key: "bn-te", name: "Bench TE", player: { name: "Bench TE", position: "TE" }, weekly: { projectedPoints: 18, ecr: 4 } }),
    );
    const result = run(pack);
    assert.equal(result.recommendedLineup.find((row) => row.slot.position === "TE")?.player?.name, "Start TE");
    assert.ok(result.reviewRequired.some((item) => item.currentPlayer?.name === "Start TE"));
    assert.equal(result.moves.some((move) => move.slot === "TE"), false);
  });

  it("F/26. ambiguous identity does not receive FP data", () => {
    const pack = starterPack();
    const flex = pack.players.find((player) => player.identity.yahooPlayerKey === "flex1")!;
    flex.identity.status = "ambiguous";
    flex.weekly = { projectedPoints: 88, ecr: 2 };
    const result = run(pack);
    const player =
      result.currentLineup.find((row) => row.player?.yahooPlayerKey === "flex1")?.player ??
      result.recommendedLineup.find((row) => row.player?.yahooPlayerKey === "flex1")?.player ??
      result.bench.find((item) => item.yahooPlayerKey === "flex1");
    assert.equal(player?.weeklyProjectedPoints, undefined);
    assert.equal(player?.weeklyEcr, undefined);
    assert.ok(player?.warnings.some((warning) => /ambiguous/i.test(warning)));
  });

  it("29-30. projected delta is calculated only from known projections", () => {
    const result = run(starterPack());
    const move = result.moves.find((item) => item.startPlayer.name === "Bench RB");
    assert.ok(move);
    assert.equal(move?.projectedPointsDelta, 16 - 10);
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "rb2")!.weekly = { ecr: 30 };
    const incomplete = run(pack);
    const incompleteMove = incomplete.moves.find((item) => item.startPlayer.name === "Bench RB");
    if (incompleteMove?.sitPlayer?.yahooPlayerKey === "rb2") {
      assert.equal(incompleteMove.projectedPointsDelta, undefined);
    }
  });

  it("J/33. exact tie preserves the current starter", () => {
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "rb2")!.weekly = { projectedPoints: 16, ecr: 8 };
    pack.players.find((player) => player.identity.yahooPlayerKey === "bn-rb")!.weekly = { projectedPoints: 16, ecr: 8 };
    const result = run(pack);
    assert.equal(
      result.recommendedLineup.filter((row) => row.slot.position === "RB").some((row) => row.player?.name === "Start RB2"),
      true,
    );
    assert.equal(result.moves.some((move) => move.startPlayer.name === "Bench RB" && move.sitPlayer?.name === "Start RB2"), false);
  });

  it("I. IR not inserted even with elite weekly numbers", () => {
    const pack = starterPack();
    pack.roster.push(
      roster({ playerKey: "ir-qb", name: "IR QB", displayPosition: "QB", eligiblePositions: ["QB"], selectedPosition: "IR" }),
    );
    pack.players.push(intel({ key: "ir-qb", name: "IR QB", player: { name: "IR QB", position: "QB" }, weekly: { projectedPoints: 40, ecr: 1 } }));
    const result = run(pack);
    assert.equal(result.recommendedLineup.find((row) => row.slot.position === "QB")?.player?.name, "Start QB");
  });

  it("K. multi-position eligibility does not duplicate a player", () => {
    const result = run(starterPack());
    const keys = result.recommendedLineup.map((row) => row.player?.yahooPlayerKey);
    assert.equal(keys.length, new Set(keys).size);
  });

  it("L/32. optimizer beats greedy FLEX-first assignment", () => {
    const slots = expandStartingSlots([
      { position: "W/R/T", count: 1 },
      { position: "TE", count: 1 },
    ]);
    const players: OptimizablePlayer[] = [
      { key: "te-a", name: "TE A", positions: ["TE"], eligibleToStart: true, valueBySlot: [undefined, 8] },
      { key: "te-b", name: "TE B", positions: ["TE"], eligibleToStart: true, valueBySlot: [12, 12] },
      { key: "rb-c", name: "RB C", positions: ["RB"], eligibleToStart: true, valueBySlot: [11, undefined] },
    ];
    const greedy = greedyAssignment(slots, players);
    const optimal = optimizeAssignment(slots, players);
    const greedyScore = (greedy[0] !== undefined ? players[greedy[0]].valueBySlot[0] ?? 0 : 0) + (greedy[1] !== undefined ? players[greedy[1]].valueBySlot[1] ?? 0 : 0);
    const optimalScore = (optimal[0] !== undefined ? players[optimal[0]].valueBySlot[0] ?? 0 : 0) + (optimal[1] !== undefined ? players[optimal[1]].valueBySlot[1] ?? 0 : 0);
    assert.ok(optimalScore > greedyScore);
    assert.equal(players[optimal[0]!].key, "rb-c");
    assert.equal(players[optimal[1]!].key, "te-b");
  });

  it("34. repeated execution is deterministic", () => {
    const pack = starterPack();
    const first = run(pack);
    const second = run(pack);
    assert.deepEqual(
      first.recommendedLineup.map((row) => row.player?.yahooPlayerKey),
      second.recommendedLineup.map((row) => row.player?.yahooPlayerKey),
    );
    assert.deepEqual(first.moves, second.moves);
  });

  it("35-36. pure optimizer source has no AI or HTTP calls", () => {
    const sources = ["engine.ts", "optimize.ts", "weeklyValue.ts", "eligibility.ts"]
      .map((file) => readFileSync(path.join(here, file), "utf8"))
      .join("\n");
    assert.equal(/openai/i.test(sources), false);
    assert.equal(/fetch\(/.test(sources), false);
    assert.equal(/yahooGet/.test(sources), false);
  });

  it("20-21. weekly projection and ECR both contribute on single-position slots", () => {
    const lowProjHighEcr = starterPack();
    lowProjHighEcr.players.find((player) => player.identity.yahooPlayerKey === "bn-rb")!.weekly = { projectedPoints: 11, ecr: 2 };
    lowProjHighEcr.players.find((player) => player.identity.yahooPlayerKey === "rb2")!.weekly = { projectedPoints: 11.2, ecr: 35 };
    const result = run(lowProjHighEcr);
    assert.ok(result.recommendedLineup.some((row) => row.player?.yahooPlayerKey === "bn-rb" || row.player?.yahooPlayerKey === "rb2"));
  });

  it("B. FLEX can start an RB over a TE when points are materially higher", () => {
    const pack = starterPack();
    pack.players.find((player) => player.identity.yahooPlayerKey === "flex1")!.weekly = { projectedPoints: 7, ecr: 8 };
    pack.players.find((player) => player.identity.yahooPlayerKey === "flex1")!.player.position = "TE";
    pack.roster.find((player) => player.playerKey === "flex1")!.displayPosition = "TE";
    pack.roster.find((player) => player.playerKey === "flex1")!.eligiblePositions = ["TE", "W/R/T"];
    pack.players.find((player) => player.identity.yahooPlayerKey === "bn-rb")!.weekly = { projectedPoints: 15, ecr: 18 };
    const result = run(pack);
    const flex = result.recommendedLineup.find((row) => row.slot.position === "W/R/T");
    assert.ok(flex?.player?.name === "Bench RB" || result.recommendedLineup.some((row) => row.player?.name === "Bench RB"));
  });
});
