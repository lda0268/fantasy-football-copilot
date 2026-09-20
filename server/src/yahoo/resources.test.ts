import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { YahooApiError, YahooErrorCode } from "./errors.js";
import { assertSearchQuery, buildFreeAgentResource, buildLeagueSettingsResource, buildPlayerSearchResource } from "./resources.js";

describe("Yahoo player resource builders", () => {
  it("encodes leagueKey, status=FA, start, and count", () => {
    assert.equal(
      buildFreeAgentResource({ leagueKey: "999.l.123456", start: 0, count: 25 }),
      "league/999.l.123456/players;status=FA;start=0;count=25",
    );
  });

  it("omits position when not supplied and includes it when supplied", () => {
    assert.equal(
      buildFreeAgentResource({ leagueKey: "999.l.123456", start: 0, count: 25 }).includes("position="),
      false,
    );
    assert.equal(
      buildFreeAgentResource({ leagueKey: "999.l.123456", position: "RB", start: 25, count: 10 }),
      "league/999.l.123456/players;status=FA;position=RB;start=25;count=10",
    );
  });

  it("encodes a search query and optional position without a status filter", () => {
    assert.equal(
      buildPlayerSearchResource({
        leagueKey: "999.l.123456",
        query: "calder",
        start: 0,
        count: 25,
      }),
      "league/999.l.123456/players;search=calder;start=0;count=25",
    );
    assert.equal(
      buildPlayerSearchResource({
        leagueKey: "999.l.123456",
        query: "nico vale",
        position: "WR",
        start: 0,
        count: 25,
      }),
      "league/999.l.123456/players;position=WR;search=nico%20vale;start=0;count=25",
    );
  });

  it("builds a league settings resource from a safe league key", () => {
    assert.equal(buildLeagueSettingsResource("999.l.123456"), "league/999.l.123456/settings");
  });

  it("rejects league keys and search values that could alter the resource path", () => {
    assert.throws(
      () => buildFreeAgentResource({ leagueKey: "999.l.123456/players;status=T", start: 0, count: 25 }),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () =>
        buildPlayerSearchResource({
          leagueKey: "999.l.123456",
          query: "smith;status=T",
          start: 0,
          count: 25,
        }),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () => assertSearchQuery("drop;status=T"),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
  });
});
