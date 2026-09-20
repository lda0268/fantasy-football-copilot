import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TtlCache, cacheKey } from "./cache.js";
import { fantasyProsGet } from "./client.js";
import { FantasyProsApiError, FantasyProsErrorCode } from "./errors.js";
import { consensusRankingsResource, rankingsQuery, weeklyProjectionsQuery } from "./resources.js";
import {
  getFantasyProsStatus,
  listFantasyProsPlayers,
  listInjuries,
  listRankings,
  listRosProjections,
  listWeeklyProjections,
  parseNflWeek,
} from "./service.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { createFantasyProsRouter } from "../routes/fantasypros.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixtureRuntime = { fixtureMode: true as const, apiKey: "", fixturesDir, cache: new TtlCache() };

describe("FantasyPros config and status", () => {
  it("allows fixture mode without an API key", async () => {
    const status = getFantasyProsStatus(fixtureRuntime);
    assert.equal(status.mode, "fixture");
    assert.equal(status.configured, true);
    assert.equal("apiKey" in status, false);
    const players = await listFantasyProsPlayers(fixtureRuntime);
    assert.ok(players.length > 0);
  });

  it("rejects live mode when the API key is missing", async () => {
    await assert.rejects(
      () => listFantasyProsPlayers({ fixtureMode: false, apiKey: "", fixturesDir, fetchImpl: async () => {
        throw new Error("network should not be called");
      } }),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.NOT_CONFIGURED,
    );
  });
});

describe("FantasyPros client", () => {
  it("sends x-api-key header authentication and does not put the key in the URL", async () => {
    let seenUrl = "";
    let seenKeyHeader = false;
    const body = { players: [{ player_id: 1, player_name: "Unit Test", position_id: "QB", positions: ["QB"] }] };
    const payload = await fantasyProsGet("nfl/players", { external_ids: "yahoo" }, {
      fixtureMode: false,
      apiKey: "unit-test-key",
      baseUrl: "https://example.invalid/public/v2/json",
      fetchImpl: async (url, init) => {
        seenUrl = url;
        const headers = new Headers(init.headers);
        seenKeyHeader = headers.get("x-api-key") === "unit-test-key";
        assert.equal(new URL(url).searchParams.has("x-api-key"), false);
        assert.equal(new URL(url).searchParams.has("api_key"), false);
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    assert.equal(seenKeyHeader, true);
    assert.match(seenUrl, /nfl\/players/);
    assert.ok(payload);
  });

  it("maps unauthorized, rate-limit, HTTP, malformed JSON, and timeout", async () => {
    const fetchStatus = (status: number, body: string) =>
      fantasyProsGet("nfl/players", {}, {
        fixtureMode: false,
        apiKey: "unit-test-key",
        fetchImpl: async () => new Response(body, { status }),
      });

    await assert.rejects(
      () => fetchStatus(401, "{}"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.UNAUTHORIZED,
    );
    await assert.rejects(
      () => fetchStatus(429, "{}"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.RATE_LIMITED,
    );
    await assert.rejects(
      () => fetchStatus(500, "{}"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.HTTP_ERROR,
    );
    await assert.rejects(
      () => fetchStatus(200, "{not-json"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.PARSE_ERROR,
    );
    await assert.rejects(
      () =>
        fantasyProsGet("nfl/players", {}, {
          fixtureMode: false,
          apiKey: "unit-test-key",
          timeoutMs: 20,
          fetchImpl: (_url, init) =>
            new Promise((_, reject) => {
              init.signal?.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              });
            }),
        }),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.HTTP_ERROR,
    );
  });
});

describe("FantasyPros cache and resources", () => {
  it("caches successful fetches and separates dimensions", async () => {
    let fetches = 0;
    const fetchImpl: typeof fetch = async () => {
      fetches += 1;
      return new Response(
        JSON.stringify({ players: [{ player_id: fetches, player_name: "Cached", position_id: "RB", positions: ["RB"] }] }),
        { status: 200 },
      );
    };
    const cache = new TtlCache();
    const runtime = { fixtureMode: false, apiKey: "unit-test-key", cache, fetchImpl, season: 2026 };
    const first = await listFantasyProsPlayers(runtime);
    const second = await listFantasyProsPlayers(runtime);
    assert.equal(fetches, 1);
    assert.equal(first[0].fantasyProsId, second[0].fantasyProsId);

    await listWeeklyProjections(2, "half_ppr", runtime);
    await listWeeklyProjections(3, "half_ppr", runtime);
    assert.ok(fetches >= 3);
    assert.notEqual(cacheKey(["weekly-projections", 2026, 2, "half_ppr"]), cacheKey(["weekly-projections", 2026, 3, "half_ppr"]));
  });

  it("does not cache errors", async () => {
    let fetches = 0;
    const cache = new TtlCache();
    const runtime = {
      fixtureMode: false,
      apiKey: "unit-test-key",
      cache,
      season: 2026,
      fetchImpl: async () => {
        fetches += 1;
        return new Response("{}", { status: 500 });
      },
    };
    await assert.rejects(() => listFantasyProsPlayers(runtime));
    await assert.rejects(() => listFantasyProsPlayers(runtime));
    assert.equal(fetches, 2);
  });

  it("expires cache entries after TTL", () => {
    let now = 1_000;
    const cache = new TtlCache(() => now);
    cache.set("players", { ok: true }, 30);
    assert.deepEqual(cache.get("players"), { ok: true });
    now = 1_031;
    assert.equal(cache.get("players"), undefined);
  });

  it("encodes league season, scoring, week, and ROS flag in resources", () => {
    assert.equal(consensusRankingsResource(2026), "nfl/2026/consensus-rankings");
    assert.deepEqual(weeklyProjectionsQuery(2, "half_ppr"), {
      week: "2",
      scoring: "HALF",
      positions: "QB:RB:WR:TE:K:DST",
    });
    assert.equal(rankingsQuery("ppr", "ros").type, "ROS");
    assert.equal(rankingsQuery("standard", "weekly", 2).week, "2");
    assert.equal(rankingsQuery("standard", "weekly", 2).type, undefined);
  });
});

describe("FantasyPros fixture service and query validation", () => {
  it("loads all fixture collections", async () => {
    const runtime = { ...fixtureRuntime, cache: new TtlCache() };
    assert.ok((await listFantasyProsPlayers(runtime)).length >= 8);
    assert.ok((await listWeeklyProjections(2, "half_ppr", runtime)).length > 0);
    assert.ok((await listRosProjections("half_ppr", runtime)).length > 0);
    assert.ok((await listRankings("weekly", { week: 2 }, runtime)).every((row) => row.rankingType === "weekly"));
    assert.ok((await listRankings("ros", {}, runtime)).every((row) => row.rankingType === "ros"));
    assert.ok((await listInjuries(2, runtime)).length > 0);
  });

  it("rejects invalid weeks", () => {
    assert.throws(
      () => parseNflWeek("0"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () => parseNflWeek("19"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.INVALID_REQUEST,
    );
    const status = getFantasyProsStatus(fixtureRuntime);
    assert.deepEqual(Object.keys(status).sort(), ["configured", "mode"]);
  });
});

describe("FantasyPros diagnostic routes", () => {
  async function requestJson(pathname: string): Promise<{ status: number; body: unknown; text: string }> {
    const app = express();
    app.use("/api/fantasypros", createFantasyProsRouter({ ...fixtureRuntime, cache: new TtlCache() }));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind a port");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}${pathname}`);
      const text = await response.text();
      return { status: response.status, body: JSON.parse(text) as unknown, text };
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }

  it("serves fixture status, collections, and rejects invalid weeks without secrets", async () => {
    const status = await requestJson("/api/fantasypros/status");
    assert.equal(status.status, 200);
    assert.deepEqual(status.body, { configured: true, mode: "fixture" });
    assert.equal(status.text.includes("apiKey"), false);
    assert.equal(status.text.toLowerCase().includes("x-api-key"), false);

    const players = await requestJson("/api/fantasypros/players");
    assert.equal(players.status, 200);
    assert.ok(Array.isArray((players.body as { players: unknown[] }).players));
    assert.ok((players.body as { players: unknown[] }).players.length >= 8);

    const weekly = await requestJson("/api/fantasypros/projections/weekly?week=2");
    assert.equal(weekly.status, 200);
    assert.equal((weekly.body as { projectionType: string; scoring: string }).projectionType, "weekly");
    assert.equal((weekly.body as { scoring: string }).scoring, "half_ppr");

    const ros = await requestJson("/api/fantasypros/projections/ros");
    assert.equal(ros.status, 200);
    assert.equal((ros.body as { projectionType: string }).projectionType, "ros");

    const weeklyRank = await requestJson("/api/fantasypros/rankings/weekly?week=2");
    assert.equal(weeklyRank.status, 200);
    assert.equal((weeklyRank.body as { rankingType: string }).rankingType, "weekly");

    const rosRank = await requestJson("/api/fantasypros/rankings/ros");
    assert.equal(rosRank.status, 200);
    assert.equal((rosRank.body as { rankingType: string }).rankingType, "ros");

    const injuries = await requestJson("/api/fantasypros/injuries");
    assert.equal(injuries.status, 200);
    assert.ok(Array.isArray((injuries.body as { injuries: unknown[] }).injuries));

    const invalidWeek = await requestJson("/api/fantasypros/projections/weekly?week=99");
    assert.equal(invalidWeek.status, 400);
    assert.equal(JSON.stringify(invalidWeek.body).includes("unit-test-key"), false);
  });
});
