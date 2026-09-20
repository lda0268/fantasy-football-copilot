import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseFantasyProsInjuries } from "../../fantasypros/parsers/injuries.js";
import { parseFantasyProsPlayers } from "../../fantasypros/parsers/players.js";
import { parseRosProjections, parseWeeklyProjections } from "../../fantasypros/parsers/projections.js";
import { parseFantasyProsRankings } from "../../fantasypros/parsers/rankings.js";
import { toYahooIdentityPlayer } from "../../playerIdentity/fromProviders.js";
import { reconcilePlayers } from "../../playerIdentity/matcher.js";
import { composePlayerIntelligence } from "../../playerIntelligence/compose.js";
import { toYahooLeaguePlayer } from "../../playerIntelligence/fromYahoo.js";
import type { PlayerIntelligence } from "../../playerIntelligence/types.js";
import { parseYahooAvailablePlayers } from "../../yahoo/parsers/players.js";
import { parseYahooRosterPlayers } from "../../yahoo/parsers/roster.js";
import type { YahooRosterPlayer } from "../../yahoo/types.js";
import { buildCopilotRecommendations } from "../recommendations.js";
import { V2_SCORE_WEIGHTS } from "./config.js";
import { buildCopilotRecommendationsV2 } from "./recommendations.js";
import type { CopilotV2ReferenceDatasets } from "./referencePopulation.js";
import { classifyDataQuality, fantasyProsHealthBand, roundScore } from "./score.js";

const repoSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function rosterPlayer(
  overrides: Partial<YahooRosterPlayer> & Pick<YahooRosterPlayer, "playerKey" | "playerId" | "name">,
): YahooRosterPlayer {
  return { ...overrides };
}

function intel(overrides: Partial<PlayerIntelligence> & { key: string; name: string }): PlayerIntelligence {
  const { key, name, ...rest } = overrides;
  const baseIdentity = {
    yahooPlayerKey: key,
    yahooPlayerId: key,
    fantasyProsId: `fp-${key}`,
    status: "matched" as const,
    method: "external_id" as const,
    confidence: "exact" as const,
  };
  return {
    identity: { ...baseIdentity, ...rest.identity },
    player: { name, position: "RB", ...rest.player },
    leagueState: { availability: "free_agent", ...rest.leagueState },
    weekly: rest.weekly === undefined && !("weekly" in rest) ? { week: 2, projectedPoints: 12, ecr: 20 } : rest.weekly,
    restOfSeason:
      rest.restOfSeason === undefined && !("restOfSeason" in rest)
        ? { projectedPoints: 120, ecr: 24 }
        : rest.restOfSeason,
    provenance: rest.provenance ?? { yahoo: true, fantasyPros: true, fields: {} },
    freshness: rest.freshness ?? {},
    warnings: rest.warnings ?? [],
    ...(rest.injury ? { injury: rest.injury } : {}),
  };
}

function defaultReference(): CopilotV2ReferenceDatasets {
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF", "DST"];
  const weeklyPoints = [2, 6, 10, 14, 18, 22];
  const weeklyEcr = [2, 8, 16, 30, 50, 80];
  const rosPoints = [30, 70, 110, 150, 190, 230];
  const rosEcr = [3, 12, 24, 40, 70, 99];
  const weeklyProjections = positions.flatMap((position) =>
    weeklyPoints.map((fantasyPoints, index) => ({
      fantasyProsId: `${position}-wp-${index}`,
      position,
      fantasyPoints,
    })),
  );
  const rosProjections = positions.flatMap((position) =>
    rosPoints.map((fantasyPoints, index) => ({
      fantasyProsId: `${position}-rp-${index}`,
      position,
      fantasyPoints,
    })),
  );
  const weeklyRankings = positions.flatMap((position) =>
    weeklyEcr.map((rank, index) => ({
      fantasyProsId: `${position}-we-${index}`,
      position,
      rank,
    })),
  );
  const rosRankings = positions.flatMap((position) =>
    rosEcr.map((rank, index) => ({
      fantasyProsId: `${position}-re-${index}`,
      position,
      rank,
    })),
  );
  return { weeklyProjections, rosProjections, weeklyRankings, rosRankings };
}

function recommend(
  players: PlayerIntelligence[],
  roster: YahooRosterPlayer[] = [],
  limit = 25,
  reference: CopilotV2ReferenceDatasets = defaultReference(),
) {
  return buildCopilotRecommendationsV2({
    week: 2,
    scoringFormat: "half_ppr",
    providerModes: { yahoo: "fixture", fantasyPros: "fixture" },
    roster,
    players,
    reference,
    limit,
  });
}

function names(result: ReturnType<typeof recommend>): string[] {
  return result.recommendations.map((item) => item.player.player.name);
}

describe("copilot recommendation engine v2", () => {
  it("A. free agent eligible", () => {
    const result = recommend([intel({ key: "a", name: "Free Agent" })]);
    assert.equal(result.recommendations[0]?.player.player.name, "Free Agent");
    assert.equal(result.summary.eligible, 1);
  });

  it("B. waiver player eligible", () => {
    const result = recommend([intel({ key: "w", name: "Waiver Wire", leagueState: { availability: "waivers" } })]);
    assert.equal(result.recommendations[0]?.player.player.name, "Waiver Wire");
  });

  it("C. user's rostered player excluded", () => {
    const result = recommend([intel({ key: "u", name: "Mine", leagueState: { availability: "rostered_by_user" } })]);
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.summary.excludedUnavailable, 1);
  });

  it("D. other-team rostered player excluded", () => {
    const result = recommend([intel({ key: "o", name: "Theirs", leagueState: { availability: "rostered_by_other" } })]);
    assert.equal(result.recommendations.length, 0);
  });

  it("E. unknown availability excluded", () => {
    const result = recommend([intel({ key: "x", name: "Unknown", leagueState: { availability: "unknown" } })]);
    assert.equal(result.recommendations.length, 0);
  });

  it("F. ambiguous identity excluded", () => {
    const result = recommend([
      intel({
        key: "amb",
        name: "Ambiguous",
        identity: { yahooPlayerKey: "amb", status: "ambiguous", method: "external_id", confidence: "none" },
      }),
    ]);
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.summary.excludedAmbiguous, 1);
  });

  it("G. unresolved identity is excluded from v2 ranking", () => {
    const result = recommend([
      intel({
        key: "un",
        name: "Unresolved",
        identity: { yahooPlayerKey: "un", status: "unresolved", method: "none", confidence: "none" },
      }),
    ]);
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.summary.excludedUnmatched, 1);
  });

  it("H. strong ROS player outranks short-term-only player", () => {
    const result = recommend([
      intel({
        key: "flash",
        name: "Flash Week",
        weekly: { projectedPoints: 28, ecr: 2 },
        restOfSeason: { projectedPoints: 40, ecr: 90 },
      }),
      intel({
        key: "steady",
        name: "Steady ROS",
        weekly: { projectedPoints: 11, ecr: 30 },
        restOfSeason: { projectedPoints: 210, ecr: 4 },
      }),
    ]);
    assert.equal(result.recommendations[0]?.player.player.name, "Steady ROS");
    assert.ok(
      result.recommendations[0]!.components.restOfSeason.score > result.recommendations[1]!.components.restOfSeason.score,
    );
  });

  it("I. weekly value affects ranking", () => {
    const result = recommend([
      intel({
        key: "low-week",
        name: "Low Week",
        weekly: { projectedPoints: 4, ecr: 80 },
        restOfSeason: { projectedPoints: 150, ecr: 20 },
      }),
      intel({
        key: "high-week",
        name: "High Week",
        weekly: { projectedPoints: 22, ecr: 5 },
        restOfSeason: { projectedPoints: 150, ecr: 20 },
      }),
    ]);
    assert.equal(result.recommendations[0]?.player.player.name, "High Week");
  });

  it("J. roster need affects ranking", () => {
    const roster = [
      rosterPlayer({ playerKey: "qb1", playerId: "1", name: "QB Starter", displayPosition: "QB", selectedPosition: "QB" }),
      rosterPlayer({ playerKey: "qb2", playerId: "2", name: "QB Bench", displayPosition: "QB", selectedPosition: "BN" }),
    ];
    const result = recommend(
      [
        intel({
          key: "qb",
          name: "Backup QB",
          player: { name: "Backup QB", position: "QB" },
          weekly: { projectedPoints: 18, ecr: 8 },
          restOfSeason: { projectedPoints: 180, ecr: 8 },
        }),
        intel({
          key: "rb",
          name: "Needed RB",
          player: { name: "Needed RB", position: "RB" },
          weekly: { projectedPoints: 18, ecr: 8 },
          restOfSeason: { projectedPoints: 180, ecr: 8 },
        }),
      ],
      roster,
    );
    assert.equal(result.recommendations[0]?.player.player.name, "Needed RB");
    assert.ok(
      result.recommendations[0]!.components.rosterNeed.score > result.recommendations[1]!.components.rosterNeed.score,
    );
  });

  it("K. explicit injury status affects health/risk", () => {
    const result = recommend([
      intel({ key: "q", name: "Questionable", injury: { status: "Questionable" } }),
      intel({ key: "h", name: "Healthy", injury: { status: "Healthy" } }),
    ]);
    const questionable = result.recommendations.find((item) => item.player.player.name === "Questionable");
    const healthy = result.recommendations.find((item) => item.player.player.name === "Healthy");
    assert.equal(questionable?.components.healthRisk.score, 5);
    assert.equal(healthy?.components.healthRisk.score, 10);
    assert.ok(questionable?.components.healthRisk.reasons.some((reason) => /questionable/i.test(reason)));
  });

  it("L. missing injury record is not labeled healthy", () => {
    const result = recommend([intel({ key: "m", name: "No Report" })]);
    assert.equal(result.recommendations[0]?.components.healthRisk.score, 0);
    assert.equal(result.recommendations[0]?.components.healthRisk.available, false);
    assert.equal(fantasyProsHealthBand(undefined), "unknown");
    assert.ok(result.recommendations[0]?.reasons.some((reason) => /not treated as healthy/i.test(reason)));
    assert.equal(
      result.recommendations[0]?.reasons.some((reason) => /lists this player as healthy/i.test(reason)),
      false,
    );
  });

  it("M. missing projection is not treated as zero", () => {
    const result = recommend([
      intel({ key: "miss", name: "Missing Proj", weekly: { ecr: 10 } }),
      intel({ key: "zero", name: "Zero Proj", weekly: { projectedPoints: 0, ecr: 10 } }),
    ]);
    const missingRec = result.recommendations.find((item) => item.player.player.name === "Missing Proj");
    assert.ok(missingRec?.components.weeklyValue.reasons.some((reason) => /Weekly projection unavailable/.test(reason)));
  });

  it("N. actual zero projection remains zero", () => {
    const result = recommend([
      intel({
        key: "z",
        name: "Zero",
        weekly: { projectedPoints: 0, ecr: 40 },
        restOfSeason: { projectedPoints: 10, ecr: 80 },
      }),
      intel({
        key: "p",
        name: "Points",
        weekly: { projectedPoints: 15, ecr: 10 },
        restOfSeason: { projectedPoints: 10, ecr: 80 },
      }),
    ]);
    const zero = result.recommendations.find((item) => item.player.player.name === "Zero");
    assert.equal(zero?.player.weekly?.projectedPoints, 0);
    assert.ok(zero?.components.weeklyValue.reasons.some((reason) => /explicitly 0/.test(reason)));
    assert.ok(
      zero!.components.weeklyValue.score <
        result.recommendations.find((item) => item.player.player.name === "Points")!.components.weeklyValue.score,
    );
  });

  it("O. missing ECR uses remaining weekly signal", () => {
    const result = recommend([intel({ key: "ecrless", name: "No ECR", weekly: { projectedPoints: 16 } })]);
    assert.equal(result.recommendations[0]?.components.weeklyValue.available, true);
    assert.ok(result.recommendations[0]?.components.weeklyValue.reasons.some((reason) => /ECR unavailable/.test(reason)));
  });

  it("P. missing ROS is unavailable, not zero invented", () => {
    const result = recommend([intel({ key: "nros", name: "No ROS", restOfSeason: undefined })]);
    assert.equal(result.recommendations[0]?.components.restOfSeason.available, false);
    assert.equal(result.recommendations[0]?.components.restOfSeason.score, 0);
    assert.ok(result.recommendations[0]?.components.restOfSeason.reasons.some((reason) => /not treated as zero/.test(reason)));
  });

  it("Q. stable tie breaking by name then player key", () => {
    const first = recommend([
      intel({
        key: "b",
        name: "Same Score B",
        weekly: { projectedPoints: 10, ecr: 10 },
        restOfSeason: { projectedPoints: 100, ecr: 10 },
      }),
      intel({
        key: "a",
        name: "Same Score A",
        weekly: { projectedPoints: 10, ecr: 10 },
        restOfSeason: { projectedPoints: 100, ecr: 10 },
      }),
    ]);
    const second = recommend([
      intel({
        key: "a",
        name: "Same Score A",
        weekly: { projectedPoints: 10, ecr: 10 },
        restOfSeason: { projectedPoints: 100, ecr: 10 },
      }),
      intel({
        key: "b",
        name: "Same Score B",
        weekly: { projectedPoints: 10, ecr: 10 },
        restOfSeason: { projectedPoints: 100, ecr: 10 },
      }),
    ]);
    assert.deepEqual(names(first), ["Same Score A", "Same Score B"]);
    assert.deepEqual(names(first), names(second));
  });

  it("R. duplicate intelligence warning does not crash scoring", () => {
    const result = recommend([
      intel({
        key: "dup",
        name: "Dup",
        warnings: ["Withheld weekly projection because FantasyPros returned duplicate rows."],
        weekly: undefined,
        restOfSeason: { projectedPoints: 90, ecr: 12 },
      }),
    ]);
    assert.equal(result.recommendations.length, 1);
    assert.ok(result.recommendations[0]?.warnings[0]?.includes("duplicate"));
    assert.equal(result.recommendations[0]?.components.weeklyValue.available, false);
    assert.ok(result.recommendations[0]!.score > 0);
  });

  it("S. DST/DEF works", () => {
    const result = recommend([
      intel({
        key: "dst",
        name: "Harbor City",
        player: { name: "Harbor City", position: "DEF" },
        weekly: { projectedPoints: 8, ecr: 12 },
        restOfSeason: { projectedPoints: 90, ecr: 11 },
      }),
    ]);
    assert.equal(result.recommendations[0]?.player.player.position, "DEF");
    assert.ok(result.recommendations[0]!.score > 0);
  });

  it("T. K works", () => {
    const result = recommend([
      intel({
        key: "k",
        name: "Kicker",
        player: { name: "Kicker", position: "K" },
        weekly: { projectedPoints: 9, ecr: 6 },
        restOfSeason: { projectedPoints: 110, ecr: 7 },
      }),
    ]);
    assert.equal(result.recommendations[0]?.player.player.position, "K");
  });

  it("U. no secrets in result", () => {
    const result = recommend([intel({ key: "s", name: "Safe" })]);
    const payload = JSON.stringify(result);
    assert.equal(payload.includes("FANTASYPROS_API_KEY"), false);
    assert.equal(payload.includes("YAHOO_CLIENT_SECRET"), false);
    assert.equal(payload.includes("access_token"), false);
    assert.equal(payload.includes("refresh_token"), false);
    assert.equal(payload.includes("Authorization"), false);
  });

  it("V. deterministic repeated execution", () => {
    const players = [intel({ key: "2", name: "Beta" }), intel({ key: "1", name: "Alpha", weekly: { projectedPoints: 14, ecr: 9 } })];
    assert.deepEqual(recommend(players), recommend(players));
  });

  it("W/X/Y. score cannot exceed 100, components stay in range, total matches aggregation", () => {
    const result = recommend([
      intel({
        key: "max",
        name: "Max",
        injury: { status: "Healthy" },
        leagueState: { availability: "free_agent", byeWeek: 10 },
      }),
    ]);
    const rec = result.recommendations[0]!;
    assert.ok(rec.score <= 100);
    assert.ok(rec.components.rosterNeed.score <= rec.components.rosterNeed.max);
    assert.ok(rec.components.restOfSeason.score <= rec.components.restOfSeason.max);
    assert.ok(rec.components.weeklyValue.score <= rec.components.weeklyValue.max);
    assert.ok(rec.components.healthRisk.score <= rec.components.healthRisk.max);
    assert.ok(rec.components.rosterFit.score <= rec.components.rosterFit.max);
    const summed = roundScore(
      rec.components.rosterNeed.score +
        rec.components.restOfSeason.score +
        rec.components.weeklyValue.score +
        rec.components.healthRisk.score +
        rec.components.rosterFit.score,
    );
    assert.equal(rec.score, Math.min(100, summed));
    assert.equal(rec.components.rosterNeed.max, V2_SCORE_WEIGHTS.rosterNeed);
    assert.equal(rec.components.restOfSeason.max, V2_SCORE_WEIGHTS.restOfSeason);
    assert.equal(rec.components.weeklyValue.max, V2_SCORE_WEIGHTS.weeklyValue);
    assert.equal(rec.score, rec.rawScore);
    assert.ok(rec.availableMax <= 100);
    assert.ok(rec.availableMax >= rec.components.rosterNeed.max);
  });

  it("Z. dataQuality reflects completeness, not player quality", () => {
    const limited = intel({ key: "lim", name: "Limited", weekly: undefined, restOfSeason: undefined });
    const completeQb = intel({
      key: "comp",
      name: "Complete",
      player: { name: "Complete", position: "QB" },
      weekly: { projectedPoints: 3, ecr: 90 },
      restOfSeason: { projectedPoints: 20, ecr: 90 },
      injury: { status: "Out" },
    });
    assert.equal(classifyDataQuality(limited), "limited");
    assert.equal(classifyDataQuality(completeQb), "strongly_supported");
    const roster = [
      rosterPlayer({ playerKey: "qb1", playerId: "1", name: "QB Starter", displayPosition: "QB", selectedPosition: "QB" }),
      rosterPlayer({ playerKey: "qb2", playerId: "2", name: "QB Bench", displayPosition: "QB", selectedPosition: "BN" }),
    ];
    const result = recommend([limited, completeQb], roster);
    const limitedRec = result.recommendations.find((item) => item.player.player.name === "Limited");
    const completeRec = result.recommendations.find((item) => item.player.player.name === "Complete");
    assert.equal(limitedRec?.dataQuality, "limited");
    assert.equal(completeRec?.dataQuality, "strongly_supported");
    assert.ok((completeRec?.rank ?? 99) < (limitedRec?.rank ?? 0));
    assert.ok(limitedRec?.warnings.some((warning) => /Limited recommendation support/.test(warning)));
  });
});

describe("copilot v2 fixture comparison", () => {
  function loadFixtures() {
    const roster = parseYahooRosterPlayers(JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/roster.json"), "utf8")));
    const freeAgents = parseYahooAvailablePlayers(
      JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/free-agents.json"), "utf8")),
    );
    const fantasyPros = parseFantasyProsPlayers(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/players.json"), "utf8")),
    );
    const weekly = parseWeeklyProjections(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/projections-weekly.json"), "utf8")),
      2,
      "half_ppr",
    );
    const ros = parseRosProjections(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/projections-ros.json"), "utf8")),
      "half_ppr",
    );
    const weeklyRank = parseFantasyProsRankings(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/rankings-weekly.json"), "utf8")),
      "weekly",
    );
    const rosRank = parseFantasyProsRankings(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/rankings-ros.json"), "utf8")),
      "ros",
    );
    const injuries = parseFantasyProsInjuries(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/injuries.json"), "utf8")),
    );
    const yahooPlayers = [
      ...roster.map((player) => toYahooLeaguePlayer(player, "roster")),
      ...freeAgents.map((player) => toYahooLeaguePlayer(player, "available")),
    ];
    const identity = reconcilePlayers(
      yahooPlayers.map((player) =>
        toYahooIdentityPlayer({
          playerKey: player.playerKey,
          playerId: player.playerId ?? "",
          name: player.name,
          editorialTeamAbbr: player.team,
          displayPosition: player.displayPosition,
          eligiblePositions: player.eligiblePositions,
        }),
      ),
      fantasyPros,
    );
    const composed = composePlayerIntelligence({
      yahooPlayers,
      identityResults: identity.results,
      weeklyProjections: weekly,
      rosProjections: ros,
      weeklyRankings: weeklyRank,
      rosRankings: rosRank,
      injuries,
    });
    return { roster, freeAgents, composed, weekly, ros, weeklyRank, rosRank };
  }

  it("only recommends Yahoo-available matched players and stays deterministic", () => {
    const { roster, freeAgents, composed, weekly, ros, weeklyRank, rosRank } = loadFixtures();
    const v1 = buildCopilotRecommendations({ week: 2, mode: "fixture", roster, freeAgents, limit: 10 });
    const reference = {
      weeklyProjections: weekly,
      rosProjections: ros,
      weeklyRankings: weeklyRank,
      rosRankings: rosRank,
    };
    const v2 = buildCopilotRecommendationsV2({
      week: 2,
      scoringFormat: "half_ppr",
      providerModes: { yahoo: "fixture", fantasyPros: "fixture" },
      roster,
      players: composed.players,
      reference,
      limit: 10,
    });
    const again = buildCopilotRecommendationsV2({
      week: 2,
      scoringFormat: "half_ppr",
      providerModes: { yahoo: "fixture", fantasyPros: "fixture" },
      roster,
      players: composed.players,
      reference,
      limit: 10,
    });
    assert.deepEqual(v2, again);
    for (const rec of v2.recommendations) {
      assert.ok(rec.player.leagueState.availability === "free_agent" || rec.player.leagueState.availability === "waivers");
      assert.equal(rec.player.identity.status, "matched");
      assert.ok(rec.score <= 100);
      assert.ok(rec.reasons.length > 0);
    }
    assert.ok(v2.summary.excludedUnmatched > 0 || v2.summary.excludedAmbiguous > 0);
    assert.ok(v1.recommendations.length > 0);
    assert.ok(v2.recommendations.length > 0);
    const payload = JSON.stringify(v2);
    assert.equal(payload.includes("FANTASYPROS_API_KEY"), false);
    assert.equal(payload.includes("access_token"), false);
  });
});

describe("copilot v2 calibration", () => {
  const wrReference: CopilotV2ReferenceDatasets = {
    weeklyProjections: [3, 6, 9, 12, 15, 18, 21, 24].map((fantasyPoints, index) => ({
      fantasyProsId: `wr-w-${index}`,
      position: "WR",
      fantasyPoints,
    })),
    rosProjections: [40, 70, 100, 130, 160, 190, 220, 250].map((fantasyPoints, index) => ({
      fantasyProsId: `wr-r-${index}`,
      position: "WR",
      fantasyPoints,
    })),
    weeklyRankings: [2, 8, 16, 24, 32, 48, 64, 90].map((rank, index) => ({
      fantasyProsId: `wr-we-${index}`,
      position: "WR",
      rank,
    })),
    rosRankings: [3, 10, 20, 30, 45, 60, 80, 110].map((rank, index) => ({
      fantasyProsId: `wr-re-${index}`,
      position: "WR",
      rank,
    })),
  };

  it("A. single eligible candidate is not automatically the 50th percentile", () => {
    const result = recommend(
      [
        intel({
          key: "elite",
          name: "Elite WR",
          player: { name: "Elite WR", position: "WR" },
          weekly: { projectedPoints: 24, ecr: 2 },
          restOfSeason: { projectedPoints: 250, ecr: 3 },
        }),
      ],
      [],
      25,
      wrReference,
    );
    const weekly = result.recommendations[0]?.components.weeklyValue.normalized;
    assert.notEqual(weekly, 0.5);
    assert.ok((weekly ?? 0) > 0.8);
  });

  it("B. elite n=1 candidate scores strongly against the position reference", () => {
    const result = recommend(
      [
        intel({
          key: "elite",
          name: "Elite WR",
          player: { name: "Elite WR", position: "WR" },
          weekly: { projectedPoints: 24, ecr: 2 },
          restOfSeason: { projectedPoints: 250, ecr: 3 },
        }),
      ],
      [],
      25,
      wrReference,
    );
    assert.ok((result.recommendations[0]?.components.weeklyValue.score ?? 0) >= 16);
    assert.ok((result.recommendations[0]?.components.restOfSeason.score ?? 0) >= 24);
  });

  it("C. weak n=1 candidate scores weakly against the position reference", () => {
    const result = recommend(
      [
        intel({
          key: "weak",
          name: "Weak WR",
          player: { name: "Weak WR", position: "WR" },
          weekly: { projectedPoints: 3, ecr: 90 },
          restOfSeason: { projectedPoints: 40, ecr: 110 },
        }),
      ],
      [],
      25,
      wrReference,
    );
    assert.ok((result.recommendations[0]?.components.weeklyValue.score ?? 99) <= 6);
    assert.ok((result.recommendations[0]?.components.restOfSeason.score ?? 99) <= 8);
  });

  it("D. adding another eligible candidate does not change an unchanged player's football value", () => {
    const elite = intel({
      key: "elite",
      name: "Elite WR",
      player: { name: "Elite WR", position: "WR" },
      weekly: { projectedPoints: 24, ecr: 2 },
      restOfSeason: { projectedPoints: 250, ecr: 3 },
    });
    const other = intel({
      key: "other",
      name: "Other WR",
      player: { name: "Other WR", position: "WR" },
      weekly: { projectedPoints: 12, ecr: 24 },
      restOfSeason: { projectedPoints: 130, ecr: 30 },
    });
    const alone = recommend([elite], [], 25, wrReference);
    const together = recommend([elite, other], [], 25, wrReference);
    const a = alone.recommendations[0]!;
    const b = together.recommendations.find((item) => item.player.player.name === "Elite WR")!;
    assert.equal(a.components.weeklyValue.normalized, b.components.weeklyValue.normalized);
    assert.equal(a.components.restOfSeason.normalized, b.components.restOfSeason.normalized);
    assert.equal(a.components.weeklyValue.score, b.components.weeklyValue.score);
    assert.equal(a.components.restOfSeason.score, b.components.restOfSeason.score);
  });

  it("E. position populations remain separate", () => {
    const mixed: CopilotV2ReferenceDatasets = {
      weeklyProjections: [
        ...[18, 20, 22, 24, 26].map((fantasyPoints, index) => ({
          fantasyProsId: `qb-${index}`,
          position: "QB",
          fantasyPoints,
        })),
        ...[5, 8, 11, 14, 17].map((fantasyPoints, index) => ({
          fantasyProsId: `wr-${index}`,
          position: "WR",
          fantasyPoints,
        })),
      ],
      rosProjections: [
        { fantasyProsId: "qb-r", position: "QB", fantasyPoints: 200 },
        { fantasyProsId: "wr-r", position: "WR", fantasyPoints: 140 },
      ],
    };
    const result = recommend(
      [
        intel({
          key: "qb",
          name: "Mid QB",
          player: { name: "Mid QB", position: "QB" },
          weekly: { projectedPoints: 20 },
          restOfSeason: { projectedPoints: 200 },
        }),
        intel({
          key: "wr",
          name: "Top WR",
          player: { name: "Top WR", position: "WR" },
          weekly: { projectedPoints: 17 },
          restOfSeason: { projectedPoints: 140 },
        }),
      ],
      [],
      25,
      mixed,
    );
    const qb = result.recommendations.find((item) => item.player.player.name === "Mid QB")!;
    const wr = result.recommendations.find((item) => item.player.player.name === "Top WR")!;
    assert.ok((wr.components.weeklyValue.normalized ?? 0) > (qb.components.weeklyValue.normalized ?? 1));
  });

  it("F. lower ECR scores better than higher ECR", () => {
    const result = recommend(
      [
        intel({
          key: "high",
          name: "High ECR",
          player: { name: "High ECR", position: "WR" },
          weekly: { ecr: 90 },
          restOfSeason: { ecr: 110 },
        }),
        intel({
          key: "low",
          name: "Low ECR",
          player: { name: "Low ECR", position: "WR" },
          weekly: { ecr: 2 },
          restOfSeason: { ecr: 3 },
        }),
      ],
      [],
      25,
      wrReference,
    );
    assert.equal(result.recommendations[0]?.player.player.name, "Low ECR");
    assert.ok(result.recommendations[0]!.components.weeklyValue.score > result.recommendations[1]!.components.weeklyValue.score);
  });

  it("G. higher projection scores better than lower projection", () => {
    const result = recommend(
      [
        intel({
          key: "low",
          name: "Low Proj",
          player: { name: "Low Proj", position: "WR" },
          weekly: { projectedPoints: 3 },
          restOfSeason: { projectedPoints: 40 },
        }),
        intel({
          key: "high",
          name: "High Proj",
          player: { name: "High Proj", position: "WR" },
          weekly: { projectedPoints: 24 },
          restOfSeason: { projectedPoints: 250 },
        }),
      ],
      [],
      25,
      wrReference,
    );
    assert.equal(result.recommendations[0]?.player.player.name, "High Proj");
  });

  it("H. missing weekly remains missing", () => {
    const result = recommend([intel({ key: "miss", name: "Missing Week", weekly: undefined })]);
    assert.equal(result.recommendations[0]?.components.weeklyValue.available, false);
    assert.ok(result.recommendations[0]?.components.weeklyValue.reasons.some((reason) => /not treated as zero/.test(reason)));
  });

  it("I. explicit weekly projection 0 remains real zero", () => {
    const result = recommend(
      [
        intel({
          key: "z",
          name: "Zero",
          player: { name: "Zero", position: "WR" },
          weekly: { projectedPoints: 0 },
          restOfSeason: { projectedPoints: 130, ecr: 30 },
        }),
      ],
      [],
      25,
      {
        ...wrReference,
        weeklyProjections: [...(wrReference.weeklyProjections ?? []), { fantasyProsId: "zero", position: "WR", fantasyPoints: 0 }],
      },
    );
    assert.equal(result.recommendations[0]?.player.weekly?.projectedPoints, 0);
    assert.equal(result.recommendations[0]?.components.weeklyValue.available, true);
    assert.ok(result.recommendations[0]?.components.weeklyValue.reasons.some((reason) => /explicitly 0/.test(reason)));
  });

  it("J. missing ROS remains missing", () => {
    const result = recommend([intel({ key: "nros", name: "No ROS", restOfSeason: undefined })]);
    assert.equal(result.recommendations[0]?.components.restOfSeason.available, false);
    assert.equal(result.recommendations[0]?.dataQuality, "supported");
  });

  it("K. no injury record is not treated as healthy", () => {
    const result = recommend([intel({ key: "m", name: "No Report" })]);
    assert.equal(result.recommendations[0]?.components.healthRisk.available, false);
    assert.equal(result.recommendations[0]?.components.healthRisk.score, 0);
    assert.equal(fantasyProsHealthBand(undefined), "unknown");
    assert.equal(result.recommendations[0]?.reasons.some((reason) => /lists this player as healthy/.test(reason)), false);
  });

  it("L. missing bye does not earn unsupported maximum fit points", () => {
    const result = recommend([intel({ key: "bye", name: "No Bye" })]);
    assert.equal(result.recommendations[0]?.components.rosterFit.available, false);
    assert.equal(result.recommendations[0]?.components.rosterFit.score, 0);
    assert.notEqual(result.recommendations[0]?.components.rosterFit.score, result.recommendations[0]?.components.rosterFit.max);
  });

  it("M/N. limited-data candidate remains visible with a support warning", () => {
    const result = recommend([intel({ key: "lim", name: "Limited", weekly: undefined, restOfSeason: undefined })]);
    assert.equal(result.recommendations.length, 1);
    assert.equal(result.recommendations[0]?.dataQuality, "limited");
    assert.ok(result.recommendations[0]?.warnings.some((warning) => /Limited recommendation support/.test(warning)));
  });

  it("O. supported recommendation ranks before otherwise comparable limited-data candidate", () => {
    const result = recommend([
      intel({ key: "lim", name: "Limited Need", weekly: undefined, restOfSeason: undefined }),
      intel({
        key: "sup",
        name: "Supported",
        weekly: { projectedPoints: 6, ecr: 50 },
        restOfSeason: { projectedPoints: 70, ecr: 70 },
      }),
    ]);
    assert.equal(result.recommendations[0]?.player.player.name, "Supported");
    assert.equal(result.recommendations[1]?.dataQuality, "limited");
  });

  it("P. deterministic ordering remains stable", () => {
    const players = [intel({ key: "2", name: "Beta" }), intel({ key: "1", name: "Alpha" })];
    assert.deepEqual(recommend(players), recommend(players));
  });

  it("Q. total/component bounds remain valid", () => {
    const rec = recommend([
      intel({
        key: "max",
        name: "Max",
        injury: { status: "Healthy" },
        leagueState: { availability: "free_agent", byeWeek: 10 },
      }),
    ]).recommendations[0]!;
    assert.ok(rec.score <= 100);
    assert.ok(rec.rawScore <= 100);
    for (const component of Object.values(rec.components)) {
      assert.ok(component.score <= component.max);
    }
  });

  it("R. v1 remains unchanged on fixtures", () => {
    const roster = parseYahooRosterPlayers(JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/roster.json"), "utf8")));
    const freeAgents = parseYahooAvailablePlayers(
      JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/free-agents.json"), "utf8")),
    );
    const v1a = buildCopilotRecommendations({ week: 2, mode: "fixture", roster, freeAgents, limit: 10 });
    const v1b = buildCopilotRecommendations({ week: 2, mode: "fixture", roster, freeAgents, limit: 10 });
    assert.deepEqual(v1a, v1b);
    assert.equal(v1a.recommendations[0]?.scoreBreakdown.availability, 5);
  });

  it("S. pure scoring logic does not call providers", () => {
    const scoreSrc = readFileSync(path.join(repoSrc, "copilot/v2/score.ts"), "utf8");
    const refSrc = readFileSync(path.join(repoSrc, "copilot/v2/referencePopulation.ts"), "utf8");
    for (const src of [scoreSrc, refSrc]) {
      assert.equal(src.includes("fantasypros/client"), false);
      assert.equal(src.includes("fantasypros/service"), false);
      assert.equal(src.includes("fetch("), false);
      assert.equal(src.includes("yahooGet"), false);
    }
  });

  it("T. no secrets", () => {
    const payload = JSON.stringify(recommend([intel({ key: "s", name: "Safe" })]));
    assert.equal(payload.includes("FANTASYPROS_API_KEY"), false);
    assert.equal(payload.includes("YAHOO_CLIENT_SECRET"), false);
    assert.equal(payload.includes("access_token"), false);
  });
});
