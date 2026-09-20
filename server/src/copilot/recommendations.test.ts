import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseYahooAvailablePlayers } from "../yahoo/parsers/players.js";
import { parseRosterWeek, parseYahooRosterPlayers } from "../yahoo/parsers/roster.js";
import { YahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import type { YahooAvailablePlayer, YahooRosterPlayer } from "../yahoo/types.js";
import { COPILOT_SCORE_WEIGHTS, HEALTH_POINTS, NEED_POINTS } from "./config.js";
import { projectionScaleByPosition, scoreCandidate } from "./candidateScore.js";
import { analyzeRosterNeeds, detectVulnerabilities } from "./rosterNeeds.js";
import { buildCopilotRecommendations, parseRecommendationLimit } from "./recommendations.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../yahoo/fixtures");

function rosterPlayer(overrides: Partial<YahooRosterPlayer> & Pick<YahooRosterPlayer, "playerKey" | "playerId" | "name">): YahooRosterPlayer {
  return { ...overrides };
}

function fa(overrides: Partial<YahooAvailablePlayer> & Pick<YahooAvailablePlayer, "playerKey" | "playerId" | "name">): YahooAvailablePlayer {
  return { ownershipType: "FA", ...overrides };
}

describe("roster needs", () => {
  it("does not create a high need when healthy depth exists", () => {
    const players = [
      rosterPlayer({ playerKey: "1", playerId: "1", name: "QB1", displayPosition: "QB", selectedPosition: "QB" }),
      rosterPlayer({ playerKey: "2", playerId: "2", name: "QB2", displayPosition: "QB", selectedPosition: "BN" }),
    ];
    const needs = analyzeRosterNeeds(players, 2).filter((need) => need.position === "QB");
    assert.equal(needs.length, 0);
  });

  it("marks an empty starting position as high need", () => {
    const needs = analyzeRosterNeeds([], 2);
    const qb = needs.find((need) => need.position === "QB");
    assert.equal(qb?.severity, "high");
  });

  it("marks an IR starter with no backup as high need", () => {
    const players = [
      rosterPlayer({
        playerKey: "1",
        playerId: "1",
        name: "Hurt RB",
        displayPosition: "RB",
        selectedPosition: "RB",
        status: "IR",
      }),
    ];
    const need = analyzeRosterNeeds(players, 2).find((item) => item.position === "RB");
    assert.equal(need?.severity, "high");
  });

  it("does not count IR as healthy depth", () => {
    const players = [
      rosterPlayer({
        playerKey: "1",
        playerId: "1",
        name: "Starter",
        displayPosition: "WR",
        selectedPosition: "WR",
      }),
      rosterPlayer({
        playerKey: "2",
        playerId: "2",
        name: "IR WR",
        displayPosition: "WR",
        selectedPosition: "IR",
        status: "IR",
      }),
    ];
    const need = analyzeRosterNeeds(players, 2).find((item) => item.position === "WR");
    assert.equal(need?.severity, "medium");
    assert.ok(need?.reasons.some((reason) => reason.includes("Only one healthy usable WR")));
  });

  it("treats a questionable starter with a backup as lower severity", () => {
    const players = [
      rosterPlayer({
        playerKey: "1",
        playerId: "1",
        name: "Q WR",
        displayPosition: "WR",
        selectedPosition: "WR",
        status: "Q",
      }),
      rosterPlayer({
        playerKey: "2",
        playerId: "2",
        name: "Backup WR",
        displayPosition: "WR",
        selectedPosition: "BN",
      }),
    ];
    const need = analyzeRosterNeeds(players, 2).find((item) => item.position === "WR");
    assert.equal(need?.severity, "low");
  });

  it("creates a bye-week vulnerability only for the current week", () => {
    const players = [
      rosterPlayer({
        playerKey: "1",
        playerId: "1",
        name: "Bye WR",
        displayPosition: "WR",
        selectedPosition: "WR",
        byeWeek: 2,
      }),
      rosterPlayer({
        playerKey: "2",
        playerId: "2",
        name: "Future WR",
        displayPosition: "WR",
        selectedPosition: "BN",
        byeWeek: 10,
      }),
    ];
    const current = detectVulnerabilities(players, 2).filter((item) => item.type === "bye_week");
    const future = detectVulnerabilities(players, 3).filter((item) => item.type === "bye_week");
    assert.equal(current.length, 1);
    assert.equal(current[0].playerName, "Bye WR");
    assert.equal(current[0].severity, "low");
    assert.equal(future.length, 0);
  });

  it("marks current-week bye with no replacement as a high vulnerability", () => {
    const players = [
      rosterPlayer({
        playerKey: "1",
        playerId: "1",
        name: "Solo K",
        displayPosition: "K",
        selectedPosition: "K",
        byeWeek: 2,
      }),
    ];
    const bye = detectVulnerabilities(players, 2).find((item) => item.type === "bye_week");
    assert.equal(bye?.severity, "high");
    const need = analyzeRosterNeeds(players, 2).find((item) => item.position === "K");
    assert.equal(need?.severity, "medium");
  });
});

describe("candidate scoring", () => {
  const rbNeed = [{ position: "RB" as const, severity: "high" as const, reasons: ["need"] }];

  it("scores a high-need candidate above an irrelevant-position candidate when otherwise similar", () => {
    const rb = fa({
      playerKey: "a",
      playerId: "a",
      name: "Need RB",
      displayPosition: "RB",
      projectedPoints: 10,
      percentOwned: 5,
    });
    const wr = fa({
      playerKey: "b",
      playerId: "b",
      name: "Other WR",
      displayPosition: "WR",
      projectedPoints: 10,
      percentOwned: 5,
    });
    const scale = projectionScaleByPosition([rb, wr]);
    const rbScore = scoreCandidate(rb, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    const wrScore = scoreCandidate(wr, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    assert.ok(rbScore.breakdown.positionNeed > wrScore.breakdown.positionNeed);
    assert.ok(rbScore.breakdown.total > wrScore.breakdown.total);
    assert.equal(rbScore.breakdown.positionNeed, NEED_POINTS.high);
  });

  it("scores a healthy candidate above an IR candidate", () => {
    const healthy = fa({
      playerKey: "h",
      playerId: "h",
      name: "Healthy",
      displayPosition: "RB",
      projectedPoints: 8,
    });
    const ir = fa({
      playerKey: "i",
      playerId: "i",
      name: "IR Back",
      displayPosition: "RB",
      status: "IR",
      projectedPoints: 8,
    });
    const scale = projectionScaleByPosition([healthy, ir]);
    const healthyScore = scoreCandidate(healthy, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    const irScore = scoreCandidate(ir, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    assert.ok(healthyScore.breakdown.health > irScore.breakdown.health);
    assert.equal(irScore.breakdown.health, HEALTH_POINTS.ir);
    assert.ok(irScore.cautions.some((item) => item.includes("IR")));
  });

  it("penalizes a current-week bye and does not penalize a future bye", () => {
    const now = fa({
      playerKey: "n",
      playerId: "n",
      name: "Bye Now",
      displayPosition: "RB",
      byeWeek: 2,
      projectedPoints: 9,
    });
    const later = fa({
      playerKey: "l",
      playerId: "l",
      name: "Bye Later",
      displayPosition: "RB",
      byeWeek: 11,
      projectedPoints: 9,
    });
    const scale = projectionScaleByPosition([now, later]);
    const nowScore = scoreCandidate(now, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    const laterScore = scoreCandidate(later, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    assert.equal(nowScore.breakdown.byeWeek, 0);
    assert.equal(laterScore.breakdown.byeWeek, COPILOT_SCORE_WEIGHTS.byeWeek);
  });

  it("treats missing projection as neutral and zero projection as zero", () => {
    const missing = fa({ playerKey: "m", playerId: "m", name: "No Proj", displayPosition: "RB" });
    const zero = fa({
      playerKey: "z",
      playerId: "z",
      name: "Zero Proj",
      displayPosition: "RB",
      projectedPoints: 0,
    });
    const high = fa({
      playerKey: "p",
      playerId: "p",
      name: "High Proj",
      displayPosition: "RB",
      projectedPoints: 12.4,
    });
    const scale = projectionScaleByPosition([missing, zero, high]);
    const missingScore = scoreCandidate(missing, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    const zeroScore = scoreCandidate(zero, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    const highScore = scoreCandidate(high, { needs: rbNeed, currentWeek: 2, projectionScale: scale });
    assert.equal(missingScore.breakdown.projectedPoints, COPILOT_SCORE_WEIGHTS.projectedPoints / 2);
    assert.ok(missingScore.cautions.some((item) => item.includes("projection is unavailable")));
    assert.equal(zeroScore.breakdown.projectedPoints, 0);
    assert.equal(highScore.breakdown.projectedPoints, COPILOT_SCORE_WEIGHTS.projectedPoints);
    assert.equal(high.projectedPoints, 12.4);
  });

  it("treats percent-owned zero as actual zero", () => {
    const zero = fa({
      playerKey: "z",
      playerId: "z",
      name: "Unowned",
      displayPosition: "RB",
      percentOwned: 0,
    });
    const score = scoreCandidate(zero, {
      needs: rbNeed,
      currentWeek: 2,
      projectionScale: projectionScaleByPosition([zero]),
    });
    assert.equal(score.breakdown.percentOwned, 0);
  });

  it("breaks ties deterministically by name after equal components", () => {
    const roster = [
      rosterPlayer({ playerKey: "r", playerId: "r", name: "Solo", displayPosition: "RB", selectedPosition: "RB" }),
    ];
    const result = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster,
      freeAgents: [
        fa({ playerKey: "2", playerId: "2", name: "Zed Runner", displayPosition: "RB", projectedPoints: 8, percentOwned: 4 }),
        fa({ playerKey: "1", playerId: "1", name: "Ann Runner", displayPosition: "RB", projectedPoints: 8, percentOwned: 4 }),
      ],
    });
    assert.equal(result.recommendations[0].addPlayer.name, "Ann Runner");
    assert.equal(result.recommendations[1].addPlayer.name, "Zed Runner");
    assert.equal(result.recommendations[0].score, result.recommendations[1].score);
  });
});

describe("drop logic and ownership", () => {
  it("never selects a starter as a drop", () => {
    const result = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster: [
        rosterPlayer({ playerKey: "k1", playerId: "k1", name: "Only K", displayPosition: "K", selectedPosition: "K" }),
        rosterPlayer({ playerKey: "wr1", playerId: "wr1", name: "WR A", displayPosition: "WR", selectedPosition: "WR" }),
        rosterPlayer({ playerKey: "wr2", playerId: "wr2", name: "WR B", displayPosition: "WR", selectedPosition: "BN" }),
      ],
      freeAgents: [fa({ playerKey: "fa-k", playerId: "9", name: "New K", displayPosition: "K", projectedPoints: 8 })],
    });
    for (const rec of result.recommendations) {
      assert.notEqual(rec.dropPlayer?.playerKey, "k1");
      assert.notEqual(rec.dropPlayer?.playerKey, "wr1");
    }
  });

  it("does not select an IR player solely because the player is IR", () => {
    const result = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster: [
        rosterPlayer({ playerKey: "k1", playerId: "k1", name: "Only K", displayPosition: "K", selectedPosition: "K" }),
        rosterPlayer({
          playerKey: "ir1",
          playerId: "ir1",
          name: "IR WR",
          displayPosition: "WR",
          selectedPosition: "IR",
          status: "IR",
        }),
        rosterPlayer({ playerKey: "wr1", playerId: "wr1", name: "WR A", displayPosition: "WR", selectedPosition: "WR" }),
        rosterPlayer({ playerKey: "wr2", playerId: "wr2", name: "WR B", displayPosition: "WR", selectedPosition: "BN" }),
      ],
      freeAgents: [fa({ playerKey: "fa-k", playerId: "9", name: "New K", displayPosition: "K", projectedPoints: 8 })],
    });
    assert.ok(result.recommendations.every((rec) => rec.dropPlayer?.playerKey !== "ir1"));
  });

  it("may consider a bench player and omits drop when evidence is insufficient", () => {
    const withSurplus = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster: [
        rosterPlayer({ playerKey: "k1", playerId: "k1", name: "Only K", displayPosition: "K", selectedPosition: "K" }),
        rosterPlayer({ playerKey: "wr1", playerId: "wr1", name: "WR A", displayPosition: "WR", selectedPosition: "WR" }),
        rosterPlayer({ playerKey: "wr2", playerId: "wr2", name: "WR B", displayPosition: "WR", selectedPosition: "WR" }),
        rosterPlayer({ playerKey: "wr3", playerId: "wr3", name: "WR C", displayPosition: "WR", selectedPosition: "BN" }),
      ],
      freeAgents: [fa({ playerKey: "fa-k", playerId: "9", name: "New K", displayPosition: "K", projectedPoints: 8 })],
    });
    assert.equal(withSurplus.recommendations[0].action, "consider_add_drop");
    assert.equal(withSurplus.recommendations[0].dropPlayer?.selectedPosition, "BN");

    const thin = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster: [
        rosterPlayer({ playerKey: "k1", playerId: "k1", name: "Only K", displayPosition: "K", selectedPosition: "K" }),
        rosterPlayer({ playerKey: "wr1", playerId: "wr1", name: "WR A", displayPosition: "WR", selectedPosition: "BN" }),
      ],
      freeAgents: [fa({ playerKey: "fa-k", playerId: "9", name: "New K", displayPosition: "K", projectedPoints: 8 })],
    });
    assert.equal(thin.recommendations[0].action, "consider_add");
    assert.equal(thin.recommendations[0].dropPlayer, undefined);
  });

  it("does not create an obvious positional hole by dropping the last usable player", () => {
    const result = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster: [
        rosterPlayer({ playerKey: "k1", playerId: "k1", name: "Only K", displayPosition: "K", selectedPosition: "K" }),
        rosterPlayer({ playerKey: "qb1", playerId: "qb1", name: "QB A", displayPosition: "QB", selectedPosition: "QB" }),
        rosterPlayer({ playerKey: "qb2", playerId: "qb2", name: "QB B", displayPosition: "QB", selectedPosition: "BN" }),
      ],
      freeAgents: [fa({ playerKey: "fa-k", playerId: "9", name: "New K", displayPosition: "K", projectedPoints: 8 })],
    });
    assert.notEqual(result.recommendations[0].dropPlayer?.playerKey, "qb2");
  });

  it("considers FA players and excludes waiver and owned players", () => {
    const roster = [
      rosterPlayer({ playerKey: "k1", playerId: "k1", name: "Only K", displayPosition: "K", selectedPosition: "K" }),
    ];
    const result = buildCopilotRecommendations({
      week: 2,
      mode: "fixture",
      roster,
      freeAgents: [
        fa({ playerKey: "fa", playerId: "1", name: "FA K", displayPosition: "K", projectedPoints: 7 }),
        fa({
          playerKey: "w",
          playerId: "2",
          name: "Waiver K",
          displayPosition: "K",
          projectedPoints: 20,
          ownershipType: "W",
        }),
        fa({
          playerKey: "own",
          playerId: "3",
          name: "Owned K",
          displayPosition: "K",
          projectedPoints: 20,
          ownershipType: "team",
          ownerTeamName: "Other",
        }),
      ],
    });
    assert.deepEqual(
      result.recommendations.map((item) => item.addPlayer.name),
      ["FA K"],
    );
  });
});

describe("recommendation endpoint helpers and fixtures", () => {
  it("validates limit", () => {
    assert.equal(parseRecommendationLimit(undefined), 10);
    assert.equal(parseRecommendationLimit("3"), 3);
    assert.throws(
      () => parseRecommendationLimit("0"),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () => parseRecommendationLimit("26"),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
  });

  it("builds ranked fixture recommendations from existing Yahoo fixtures", () => {
    const rosterPayload = JSON.parse(readFileSync(path.join(fixturesDir, "roster.json"), "utf8")) as unknown;
    const faPayload = JSON.parse(readFileSync(path.join(fixturesDir, "free-agents.json"), "utf8")) as unknown;
    const result = buildCopilotRecommendations({
      week: parseRosterWeek(rosterPayload),
      mode: "fixture",
      roster: parseYahooRosterPlayers(rosterPayload),
      freeAgents: parseYahooAvailablePlayers(faPayload),
      limit: 10,
    });

    assert.equal(result.generatedFrom.mode, "fixture");
    assert.equal(result.generatedFrom.week, 2);
    assert.ok(result.rosterNeeds.length > 0);
    assert.ok(result.vulnerabilities.length > 0);
    assert.ok(result.recommendations.length > 0);
    assert.equal(result.recommendations[0].rank, 1);
    assert.ok(result.recommendations[0].scoreBreakdown.total > 0);
    assert.ok(result.recommendations[0].reasons.length > 0);
    const names = result.recommendations.map((item) => item.addPlayer.name);
    assert.equal(new Set(names).has("Harbor City"), false);
  });
});
