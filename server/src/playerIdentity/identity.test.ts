import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import type { FantasyProsPlayer } from "../fantasypros/types.js";
import { parseFantasyProsPlayers } from "../fantasypros/parsers/players.js";
import { parseYahooAvailablePlayers } from "../yahoo/parsers/players.js";
import { parseYahooRosterPlayers } from "../yahoo/parsers/roster.js";
import { toYahooIdentityPlayer } from "./fromProviders.js";
import { reconcilePlayers } from "./matcher.js";
import { normalizeNflPosition, normalizePlayerName, normalizeTeamAbbr, yahooNflPosition } from "./normalize.js";
import type { YahooIdentityPlayer } from "./types.js";

const repoSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function yahoo(partial: Partial<YahooIdentityPlayer> & Pick<YahooIdentityPlayer, "playerKey" | "name">): YahooIdentityPlayer {
  return partial;
}

function fp(partial: Partial<FantasyProsPlayer> & Pick<FantasyProsPlayer, "fantasyProsId" | "name">): FantasyProsPlayer {
  return partial;
}

describe("player name normalization", () => {
  it("normalizes case, whitespace, periods, apostrophes, hyphens, and suffixes", () => {
    assert.equal(normalizePlayerName("  D.J. Moore  "), "dj moore");
    assert.equal(normalizePlayerName("D. J. Moore"), "dj moore");
    assert.equal(normalizePlayerName("D'Andre Example"), "dandre example");
    assert.equal(normalizePlayerName("D’Andre Example"), "dandre example");
    assert.equal(normalizePlayerName("O’Connell"), "oconnell");
    assert.equal(normalizePlayerName("Smith Jr."), "smith");
    assert.equal(normalizePlayerName("Smith Jr"), "smith");
    assert.equal(normalizePlayerName("Williams II"), "williams");
    assert.equal(normalizePlayerName("Williams III"), "williams");
    assert.equal(normalizePlayerName("Jones-Smith"), "jones smith");
  });
});

describe("team and position normalization", () => {
  it("maps JAX/JAC and WSH/WAS and leaves unknown abbreviations unchanged", () => {
    assert.equal(normalizeTeamAbbr("JAX"), "JAC");
    assert.equal(normalizeTeamAbbr("jac"), "JAC");
    assert.equal(normalizeTeamAbbr("WSH"), "WAS");
    assert.equal(normalizeTeamAbbr("WAS"), "WAS");
    assert.equal(normalizeTeamAbbr("BUF"), "BUF");
    assert.equal(normalizeTeamAbbr("ZZZ"), "ZZZ");
    assert.equal(normalizeTeamAbbr(" "), undefined);
  });

  it("maps DST to DEF and ignores fantasy slots", () => {
    assert.equal(normalizeNflPosition("DST"), "DEF");
    assert.equal(normalizeNflPosition("DEF"), "DEF");
    assert.equal(normalizeNflPosition("QB"), "QB");
    assert.equal(normalizeNflPosition("W/R/T"), undefined);
    assert.equal(normalizeNflPosition("BN"), undefined);
    assert.equal(normalizeNflPosition("IR"), undefined);
    assert.equal(yahooNflPosition("W/R/T", ["W/R/T", "RB"]), "RB");
    assert.equal(yahooNflPosition("QB", ["QB"]), "QB");
  });
});

describe("external Yahoo ID matching", () => {
  it("matches exact Yahoo external IDs even when names differ", () => {
    const result = reconcilePlayers(
      [yahoo({ playerKey: "999.p.12345", playerId: "12345", name: "Rex Calder", team: "BAL", displayPosition: "RB" })],
      [fp({ fantasyProsId: "FP999", name: "R. Calder", team: "BAL", position: "RB", externalIds: { yahoo: "12345" } })],
    );
    assert.equal(result.results[0].status, "matched");
    assert.equal(result.results[0].method, "external_id");
    assert.equal(result.results[0].confidence, "exact");
    assert.equal(result.results[0].fantasyProsId, "FP999");
    assert.equal(result.results[0].reasons[0], "FantasyPros externalIds.yahoo exactly matched Yahoo player ID");
  });

  it("marks duplicate external Yahoo IDs as ambiguous", () => {
    const result = reconcilePlayers(
      [yahoo({ playerKey: "999.p.1002", playerId: "1002", name: "Milo Grant", team: "DET", displayPosition: "RB" })],
      [
        fp({ fantasyProsId: "A", name: "Milo Grant", team: "DET", position: "RB", externalIds: { yahoo: "1002" } }),
        fp({ fantasyProsId: "B", name: "Other Grant", team: "CHI", position: "WR", externalIds: { yahoo: "1002" } }),
      ],
    );
    assert.equal(result.results[0].status, "ambiguous");
    assert.equal(result.results[0].method, "external_id");
    assert.equal(result.results[0].fantasyProsId, undefined);
    assert.match(result.results[0].reasons.join(" "), /A, B/);
  });
});

describe("fallback matching", () => {
  it("matches unique name+team+position including DST/DEF and team aliases", () => {
    const result = reconcilePlayers(
      [
        yahoo({ playerKey: "999.p.1", playerId: "1", name: "Harbor City", team: "SF", displayPosition: "DEF" }),
        yahoo({ playerKey: "999.p.2", playerId: "2", name: "D.J. Rowan", team: "JAX", displayPosition: "K" }),
      ],
      [
        fp({ fantasyProsId: "DST1", name: "Harbor City", team: "SF", position: "DST" }),
        fp({ fantasyProsId: "K1", name: "DJ Rowan", team: "JAC", position: "K" }),
      ],
    );
    assert.equal(result.results[0].confidence, "high");
    assert.equal(result.results[0].method, "name_team_position");
    assert.equal(result.results[1].confidence, "high");
    assert.equal(result.results[1].fantasyProsId, "K1");
  });

  it("matches apostrophe and hyphen name variants without fuzzy matching", () => {
    const result = reconcilePlayers(
      [
        yahoo({ playerKey: "999.p.a", playerId: "a", name: "D'Andre Example", team: "NYJ", displayPosition: "WR" }),
        yahoo({ playerKey: "999.p.b", playerId: "b", name: "Jean-Luc Example", team: "NO", displayPosition: "TE" }),
      ],
      [
        fp({ fantasyProsId: "A1", name: "D’Andre Example", team: "NYJ", position: "WR" }),
        fp({ fantasyProsId: "B1", name: "Jean Luc Example", team: "NO", position: "TE" }),
      ],
    );
    assert.equal(result.results[0].method, "name_team_position");
    assert.equal(result.results[1].method, "name_team_position");
  });

  it("uses unique name+team when position is missing and rejects explicit position conflicts", () => {
    const missing = reconcilePlayers(
      [yahoo({ playerKey: "999.p.3", playerId: "3", name: "Cade Rowan", team: "LAC", displayPosition: "QB" })],
      [fp({ fantasyProsId: "Q1", name: "Cade Rowan", team: "LAC" })],
    );
    assert.equal(missing.results[0].method, "name_team");
    assert.equal(missing.results[0].confidence, "medium");

    const conflict = reconcilePlayers(
      [yahoo({ playerKey: "999.p.4", playerId: "4", name: "Simone Blake", team: "TB", displayPosition: "WR" })],
      [fp({ fantasyProsId: "W1", name: "Simone Blake", team: "TB", position: "RB" })],
    );
    assert.equal(conflict.results[0].status, "unresolved");
    assert.equal(conflict.results[0].method, "none");
    assert.match(conflict.results[0].reasons.join(" "), /position conflicts/);
  });

  it("does not match first-name-only, last-name-only, or mismatched teams", () => {
    const result = reconcilePlayers(
      [yahoo({ playerKey: "999.p.5", playerId: "5", name: "Riley Cho", team: "CHI", displayPosition: "RB" })],
      [
        fp({ fantasyProsId: "X", name: "Riley", team: "CHI", position: "RB" }),
        fp({ fantasyProsId: "Y", name: "Cho", team: "CHI", position: "RB" }),
        fp({ fantasyProsId: "Z", name: "Riley Cho", team: "DET", position: "RB" }),
      ],
    );
    assert.equal(result.results[0].status, "unresolved");
  });

  it("marks duplicate name+team+position candidates as ambiguous", () => {
    const result = reconcilePlayers(
      [yahoo({ playerKey: "999.p.6", playerId: "6", name: "Nico Vale", team: "CHI", displayPosition: "RB" })],
      [
        fp({ fantasyProsId: "N1", name: "Nico Vale", team: "CHI", position: "RB" }),
        fp({ fantasyProsId: "N2", name: "Nico Vale", team: "CHI", position: "RB" }),
      ],
    );
    assert.equal(result.results[0].status, "ambiguous");
    assert.equal(result.results[0].method, "name_team_position");
  });

  it("does not use a FantasyPros record whose Yahoo ID belongs to someone else", () => {
    const result = reconcilePlayers(
      [yahoo({ playerKey: "999.p.7", playerId: "7", name: "Ellis Ward", team: "BAL", displayPosition: "TE" })],
      [fp({ fantasyProsId: "E1", name: "Ellis Ward", team: "BAL", position: "TE", externalIds: { yahoo: "9999" } })],
    );
    assert.equal(result.results[0].status, "unresolved");
  });
});

describe("batch reconciliation", () => {
  it("returns one deterministic result per Yahoo player and stable repeated runs", () => {
    const yahooPlayers = [
      yahoo({ playerKey: "999.p.b", playerId: "2", name: "B Player", team: "BUF", displayPosition: "QB" }),
      yahoo({ playerKey: "999.p.a", playerId: "1", name: "A Player", team: "BUF", displayPosition: "QB" }),
      yahoo({ playerKey: "999.p.a", playerId: "1", name: "A Player duplicate key", team: "BUF", displayPosition: "QB" }),
    ];
    const fpPlayers = [fp({ fantasyProsId: "A", name: "A Player", team: "BUF", position: "QB", externalIds: { yahoo: "1" } })];
    const first = reconcilePlayers(yahooPlayers, fpPlayers);
    const second = reconcilePlayers(yahooPlayers, fpPlayers);
    assert.equal(first.summary.total, 2);
    assert.equal(first.summary.matched, 1);
    assert.equal(first.summary.exact, 1);
    assert.equal(first.summary.unresolved, 1);
    assert.equal(
      first.summary.matched + first.summary.unresolved + first.summary.ambiguous,
      first.summary.total,
    );
    assert.deepEqual(
      first.results.map((row) => row.yahooPlayerKey),
      ["999.p.a", "999.p.b"],
    );
    assert.deepEqual(first, second);
  });

  it("does not mutate provider records", () => {
    const yahooPlayer = yahoo({ playerKey: "999.p.8", playerId: "8", name: "Smith Jr.", team: "DAL", displayPosition: "TE" });
    const fpPlayer = fp({ fantasyProsId: "S1", name: "Smith Jr", team: "DAL", position: "TE" });
    reconcilePlayers([yahooPlayer], [fpPlayer]);
    assert.equal(yahooPlayer.name, "Smith Jr.");
    assert.equal(fpPlayer.name, "Smith Jr");
  });

  it("reconciles existing Yahoo and FantasyPros fixtures with mixed outcomes", () => {
    const roster = parseYahooRosterPlayers(
      JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/roster.json"), "utf8")),
    );
    const freeAgents = parseYahooAvailablePlayers(
      JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures/free-agents.json"), "utf8")),
    );
    const fantasyPros = parseFantasyProsPlayers(
      JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures/players.json"), "utf8")),
    );
    const result = reconcilePlayers(
      [...roster.map(toYahooIdentityPlayer), ...freeAgents.map(toYahooIdentityPlayer)],
      fantasyPros,
    );
    const byKey = Object.fromEntries(result.results.map((row) => [row.yahooPlayerKey, row]));
    assert.equal(result.summary.total, result.results.length);
    assert.equal(
      result.summary.matched + result.summary.unresolved + result.summary.ambiguous,
      result.summary.total,
    );
    assert.equal(result.summary.exact + result.summary.high + result.summary.medium, result.summary.matched);
    assert.equal(byKey["999.p.1001"]?.confidence, "exact");
    assert.equal(byKey["999.p.1003"]?.confidence, "high");
    assert.equal(byKey["999.p.1012"]?.confidence, "medium");
    assert.equal(byKey["999.p.1015"]?.status, "unresolved");
    assert.equal(byKey["999.p.1011"]?.status, "ambiguous");
    assert.ok(result.summary.exact > 0 && result.summary.high > 0 && result.summary.medium > 0);
    assert.ok(result.summary.unresolved > 0 && result.summary.ambiguous > 0);
  });
});

describe("Yahoo identity adapter", () => {
  it("copies Yahoo fields without attaching a FantasyPros id", () => {
    const identity = toYahooIdentityPlayer({
      playerKey: "999.p.9",
      playerId: "9",
      name: "Copy",
      editorialTeamAbbr: "GB",
      displayPosition: "WR",
      eligiblePositions: ["WR", "W/R/T"],
    });
    assert.equal(identity.team, "GB");
    assert.equal("fantasyProsId" in identity, false);
  });
});

describe("player identity diagnostic route security", () => {
  it("does not expose secrets in the reconcile payload shape", async () => {
    const app = express();
    app.get("/api/player-identity/reconcile", (_req, res) => {
      res.json({
        providers: { yahoo: { mode: "fixture" }, fantasyPros: { mode: "live" } },
        summary: { total: 1, matched: 1, exact: 1, high: 0, medium: 0, unresolved: 0, ambiguous: 0 },
        results: [
          {
            yahooPlayerKey: "999.p.1",
            yahooPlayerId: "1",
            yahooName: "Rex Calder",
            fantasyProsId: "90001",
            status: "matched",
            method: "external_id",
            confidence: "exact",
            reasons: ["FantasyPros externalIds.yahoo exactly matched Yahoo player ID"],
          },
        ],
      });
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/player-identity/reconcile`);
      const text = await response.text();
      const body = JSON.parse(text) as { summary: { total: number } };
      assert.equal(response.status, 200);
      assert.equal(body.summary.total, 1);
      assert.equal(text.includes("apiKey"), false);
      assert.equal(text.toLowerCase().includes("x-api-key"), false);
      assert.equal(text.includes("access_token"), false);
      assert.equal(text.includes("refresh_token"), false);
      assert.equal(text.includes("Authorization"), false);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
