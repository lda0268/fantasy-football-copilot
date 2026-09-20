import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import { parseYahooLeagues } from "./leagues.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function wrapLeagues(leagues: unknown[]): unknown {
  return {
    fantasy_content: {
      users: {
        "0": {
          user: [
            { guid: "abc" },
            {
              games: {
                "0": {
                  game: [
                    { game_key: "999", code: "nfl", name: "Football", season: "2026" },
                    {
                      leagues: Object.fromEntries([
                        ...leagues.map((league, index) => [String(index), { league }]),
                        ["count", leagues.length],
                      ]),
                    },
                  ],
                },
                count: 1,
              },
            },
          ],
        },
        count: 1,
      },
    },
  };
}

describe("parseYahooLeagues", () => {
  it("parses one league", () => {
    const leagues = parseYahooLeagues(
      wrapLeagues([
        {
          league_key: "999.l.1",
          league_id: "1",
          name: "Solo",
          season: "2026",
          num_teams: 10,
          current_week: 3,
          start_week: 1,
          end_week: 17,
          scoring_type: "head",
          url: "https://example.invalid/1",
        },
      ]),
    );

    assert.equal(leagues.length, 1);
    assert.deepEqual(leagues[0], {
      leagueKey: "999.l.1",
      leagueId: "1",
      name: "Solo",
      season: "2026",
      numTeams: 10,
      currentWeek: 3,
      startWeek: 1,
      endWeek: 17,
      scoringType: "head",
      url: "https://example.invalid/1",
    });
  });

  it("parses multiple leagues and ignores extra keys", () => {
    const leagues = parseYahooLeagues(
      wrapLeagues([
        {
          league_key: "999.l.123456",
          league_id: "123456",
          name: "Co-Pilot Test League",
          season: "2026",
          extra: true,
        },
        {
          league_key: "999.l.2",
          league_id: 2,
          name: "Second",
          season: 2026,
        },
      ]),
    );

    assert.equal(leagues.length, 2);
    assert.equal(leagues[1].leagueId, "2");
    assert.equal(leagues[1].season, "2026");
  });

  it("allows missing optional metadata", () => {
    const leagues = parseYahooLeagues(
      wrapLeagues([
        {
          league_key: "999.l.9",
          league_id: "9",
          name: "Bare",
          season: "2026",
        },
      ]),
    );
    assert.equal(leagues[0].numTeams, undefined);
    assert.equal(leagues[0].currentWeek, undefined);
    assert.equal(leagues[0].url, undefined);
  });

  it("throws when league_key is missing", () => {
    assert.throws(
      () => parseYahooLeagues(wrapLeagues([{ league_id: "1", name: "X", season: "2026" }])),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("league_key"),
    );
  });

  it("throws when league_id is missing", () => {
    assert.throws(
      () => parseYahooLeagues(wrapLeagues([{ league_key: "999.l.1", name: "X", season: "2026" }])),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("league_id"),
    );
  });

  it("parses the synthetic fixture payload", () => {
    const payload = JSON.parse(readFileSync(path.join(fixturesDir, "leagues.json"), "utf8"));
    const leagues = parseYahooLeagues(payload);
    assert.equal(leagues.length, 2);
    assert.equal(leagues[0].leagueKey, "999.l.123456");
    assert.equal(leagues[0].numTeams, 12);
    assert.equal(leagues[0].currentWeek, 2);
    assert.deepEqual(leagues[0].rosterPositions, [
      { position: "QB", count: 1 },
      { position: "WR", count: 2 },
      { position: "RB", count: 2 },
      { position: "TE", count: 1 },
      { position: "W/R/T", count: 1 },
      { position: "K", count: 1 },
      { position: "DEF", count: 1 },
      { position: "BN", count: 6 },
      { position: "IR", count: 1 },
    ]);
    assert.equal(leagues[1].name, "Co-Pilot Taxi Squad");
  });
});
