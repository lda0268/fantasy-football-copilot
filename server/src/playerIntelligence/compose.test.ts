import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseFantasyProsInjuries } from "../fantasypros/parsers/injuries.js";
import { parseFantasyProsPlayers } from "../fantasypros/parsers/players.js";
import { parseRosProjections, parseWeeklyProjections } from "../fantasypros/parsers/projections.js";
import { parseFantasyProsRankings } from "../fantasypros/parsers/rankings.js";
import { toYahooIdentityPlayer } from "../playerIdentity/fromProviders.js";
import { reconcilePlayers } from "../playerIdentity/matcher.js";
import type { PlayerIdentityMatch } from "../playerIdentity/types.js";
import { parseYahooAvailablePlayers } from "../yahoo/parsers/players.js";
import { parseYahooRosterPlayers } from "../yahoo/parsers/roster.js";
import { composePlayerIntelligence } from "./compose.js";
import { evaluateObservation } from "./freshness.js";
import { toYahooLeaguePlayer } from "./fromYahoo.js";
import type { YahooLeaguePlayer } from "./types.js";

const repoSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function yahoo(partial: YahooLeaguePlayer): YahooLeaguePlayer {
  return partial;
}

function identity(partial: PlayerIdentityMatch): PlayerIdentityMatch {
  return partial;
}

describe("player intelligence composition", () => {
  it("attaches FantasyPros intelligence only for matched identities", () => {
    const result = composePlayerIntelligence({
      yahooPlayers: [
        yahoo({ playerKey: "p.exact", playerId: "1", name: "Exact", team: "BUF", displayPosition: "QB", source: "roster", selectedPosition: "QB" }),
        yahoo({ playerKey: "p.high", playerId: "2", name: "High", team: "DET", displayPosition: "RB", source: "available", ownershipType: "FA", percentOwned: 12 }),
        yahoo({ playerKey: "p.medium", playerId: "3", name: "Medium", team: "LAC", displayPosition: "QB", source: "available", ownershipType: "FA" }),
        yahoo({ playerKey: "p.unresolved", playerId: "4", name: "Open", team: "CHI", displayPosition: "RB", source: "available", ownershipType: "FA" }),
        yahoo({ playerKey: "p.ambiguous", playerId: "5", name: "Twin", team: "PHI", displayPosition: "WR", source: "available", ownershipType: "W" }),
      ],
      identityResults: [
        identity({ yahooPlayerKey: "p.exact", yahooPlayerId: "1", yahooName: "Exact", fantasyProsId: "FP1", status: "matched", method: "external_id", confidence: "exact", reasons: [] }),
        identity({ yahooPlayerKey: "p.high", yahooPlayerId: "2", yahooName: "High", fantasyProsId: "FP2", status: "matched", method: "name_team_position", confidence: "high", reasons: [] }),
        identity({ yahooPlayerKey: "p.medium", yahooPlayerId: "3", yahooName: "Medium", fantasyProsId: "FP3", status: "matched", method: "name_team", confidence: "medium", reasons: [] }),
        identity({ yahooPlayerKey: "p.unresolved", yahooPlayerId: "4", yahooName: "Open", status: "unresolved", method: "none", confidence: "none", reasons: [] }),
        identity({ yahooPlayerKey: "p.ambiguous", yahooPlayerId: "5", yahooName: "Twin", status: "ambiguous", method: "external_id", confidence: "none", reasons: [] }),
      ],
      weeklyProjections: [
        { fantasyProsId: "FP1", week: 2, fantasyPoints: 22.4 },
        { fantasyProsId: "FP2", week: 2, fantasyPoints: 0 },
        { fantasyProsId: "FP3", week: 2 },
        { fantasyProsId: "FP4", week: 2, fantasyPoints: 99 },
        { fantasyProsId: "FP5", week: 2, fantasyPoints: 99 },
      ],
      rosProjections: [{ fantasyProsId: "FP1", fantasyPoints: 180 }],
      weeklyRankings: [{ fantasyProsId: "FP1", rank: 8 }],
      rosRankings: [{ fantasyProsId: "FP1", rank: 12 }],
      injuries: [{ fantasyProsId: "FP2", status: "Questionable", practiceStatus: "Full", injury: "Ankle" }],
    });

    const byKey = Object.fromEntries(result.players.map((player) => [player.identity.yahooPlayerKey, player]));
    assert.equal(byKey["p.exact"]?.weekly?.projectedPoints, 22.4);
    assert.equal(byKey["p.exact"]?.weekly?.ecr, 8);
    assert.equal(byKey["p.exact"]?.restOfSeason?.projectedPoints, 180);
    assert.equal(byKey["p.exact"]?.restOfSeason?.ecr, 12);
    assert.equal(byKey["p.high"]?.weekly?.projectedPoints, 0);
    assert.equal(byKey["p.high"]?.injury?.status, "Questionable");
    assert.equal(byKey["p.high"]?.injury?.description, "Ankle");
    assert.equal(byKey["p.medium"]?.weekly?.projectedPoints, undefined);
    assert.equal(byKey["p.unresolved"]?.weekly, undefined);
    assert.equal(byKey["p.unresolved"]?.provenance.fantasyPros, false);
    assert.match(byKey["p.unresolved"]?.warnings.join(" ") ?? "", /unresolved/);
    assert.equal(byKey["p.ambiguous"]?.weekly, undefined);
    assert.match(byKey["p.ambiguous"]?.warnings.join(" ") ?? "", /ambiguous/);
    assert.equal(byKey["p.unresolved"]?.injury, undefined);
  });

  it("keeps Yahoo availability authoritative and does not invent healthy/missing zeros", () => {
    const result = composePlayerIntelligence({
      yahooPlayers: [
        yahoo({ playerKey: "p.own", playerId: "1", name: "Owned", team: "KC", displayPosition: "RB", source: "roster", selectedPosition: "RB" }),
        yahoo({ playerKey: "p.other", playerId: "2", name: "Other", team: "SF", displayPosition: "DEF", source: "available", ownershipType: "team" }),
      ],
      identityResults: [
        identity({ yahooPlayerKey: "p.own", yahooName: "Owned", fantasyProsId: "FP1", status: "matched", method: "external_id", confidence: "exact", reasons: [] }),
        identity({ yahooPlayerKey: "p.other", yahooName: "Other", fantasyProsId: "FP2", status: "matched", method: "name_team_position", confidence: "high", reasons: [] }),
      ],
      weeklyProjections: [{ fantasyProsId: "FP2", week: 2, fantasyPoints: 5 }],
    });
    const owned = result.players.find((player) => player.identity.yahooPlayerKey === "p.own");
    const other = result.players.find((player) => player.identity.yahooPlayerKey === "p.other");
    assert.equal(owned?.leagueState.availability, "rostered_by_user");
    assert.equal(owned?.weekly, undefined);
    assert.equal(owned?.injury, undefined);
    assert.equal(owned?.provenance.fields.availability.provider, "yahoo");
    assert.equal(other?.leagueState.availability, "rostered_by_other");
    assert.equal(other?.player.position, "DEF");
    assert.equal(other?.weekly?.projectedPoints, 5);
    assert.equal(other?.provenance.fields.weeklyProjection.provider, "fantasypros");
  });

  it("withholds duplicate FantasyPros intelligence without changing identity", () => {
    const result = composePlayerIntelligence({
      yahooPlayers: [yahoo({ playerKey: "p.dup", playerId: "9", name: "Dup", team: "DAL", displayPosition: "TE", source: "available", ownershipType: "FA" })],
      identityResults: [
        identity({ yahooPlayerKey: "p.dup", yahooName: "Dup", fantasyProsId: "FP9", status: "matched", method: "external_id", confidence: "exact", reasons: [] }),
      ],
      weeklyProjections: [
        { fantasyProsId: "FP9", week: 2, fantasyPoints: 8 },
        { fantasyProsId: "FP9", week: 2, fantasyPoints: 11 },
      ],
      rosProjections: [{ fantasyProsId: "FP9", fantasyPoints: 90 }],
    });
    assert.equal(result.players[0].identity.status, "matched");
    assert.equal(result.players[0].weekly?.projectedPoints, undefined);
    assert.equal(result.players[0].restOfSeason?.projectedPoints, 90);
    assert.match(result.players[0].warnings.join(" "), /Withheld weekly projection/);
  });

  it("orders deterministically and keeps summary counts consistent", () => {
    const input = {
      yahooPlayers: [
        yahoo({ playerKey: "p.b", playerId: "b", name: "B", team: "BUF", displayPosition: "QB", source: "roster" }),
        yahoo({ playerKey: "p.a", playerId: "a", name: "A", team: "BUF", displayPosition: "QB", source: "roster" }),
        yahoo({ playerKey: "p.a", playerId: "a", name: "A again", team: "BUF", displayPosition: "QB", source: "available", ownershipType: "FA" }),
      ],
      identityResults: [
        identity({ yahooPlayerKey: "p.a", yahooName: "A", fantasyProsId: "FP", status: "matched", method: "external_id", confidence: "exact", reasons: [] }),
        identity({ yahooPlayerKey: "p.b", yahooName: "B", status: "unresolved", method: "none", confidence: "none", reasons: [] }),
      ],
    };
    const first = composePlayerIntelligence(input);
    const second = composePlayerIntelligence(input);
    assert.deepEqual(
      first.players.map((player) => player.identity.yahooPlayerKey),
      ["p.a", "p.b"],
    );
    assert.equal(first.summary.total, 2);
    assert.equal(first.summary.identityMatched + first.summary.identityUnresolved + first.summary.identityAmbiguous, first.summary.total);
    assert.deepEqual(first, second);
  });

  it("does not invent freshness timestamps", () => {
    const without = composePlayerIntelligence({
      yahooPlayers: [yahoo({ playerKey: "p.1", playerId: "1", name: "One", team: "BUF", displayPosition: "QB", source: "roster" })],
      identityResults: [identity({ yahooPlayerKey: "p.1", yahooName: "One", status: "unresolved", method: "none", confidence: "none", reasons: [] })],
    });
    assert.equal(without.players[0].freshness.yahoo, undefined);
    const stale = evaluateObservation("2000-01-01T00:00:00.000Z", 1000, Date.parse("2000-01-02T00:00:00.000Z"));
    assert.equal(stale.stale, true);
  });
});

describe("player intelligence fixture integration", () => {
  it("composes Yahoo and FantasyPros fixtures without HTTP and without secrets", () => {
    const roster = parseYahooRosterPlayers(JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/roster.json"), "utf8")));
    const freeAgents = parseYahooAvailablePlayers(JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/free-agents.json"), "utf8")));
    const fantasyPros = parseFantasyProsPlayers(JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/players.json"), "utf8")));
    const weekly = parseWeeklyProjections(JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/projections-weekly.json"), "utf8")), 2, "half_ppr");
    const ros = parseRosProjections(JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/projections-ros.json"), "utf8")), "half_ppr");
    const weeklyRank = parseFantasyProsRankings(JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/rankings-weekly.json"), "utf8")), "weekly");
    const rosRank = parseFantasyProsRankings(JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/rankings-ros.json"), "utf8")), "ros");
    const injuries = parseFantasyProsInjuries(JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/injuries.json"), "utf8")));

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
    const byKey = Object.fromEntries(composed.players.map((player) => [player.identity.yahooPlayerKey, player]));
    assert.equal(composed.summary.total, composed.players.length);
    assert.ok(composed.summary.identityMatched > 0);
    assert.ok(composed.summary.identityUnresolved > 0);
    assert.ok(composed.summary.identityAmbiguous > 0);
    assert.equal(byKey["999.p.1001"]?.weekly?.projectedPoints, 22.4);
    assert.equal(byKey["999.p.1001"]?.provenance.fields.weeklyProjection.provider, "fantasypros");
    assert.equal(byKey["999.p.1011"]?.weekly, undefined);
    assert.equal(byKey["999.p.1015"]?.weekly, undefined);
    const payload = JSON.stringify(composed);
    assert.equal(payload.includes("apiKey"), false);
    assert.equal(payload.includes("access_token"), false);
    assert.equal(payload.includes("FANTASYPROS_API_KEY"), false);
  });
});
