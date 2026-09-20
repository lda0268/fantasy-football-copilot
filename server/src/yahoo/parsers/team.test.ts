import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import { leagueKeyFromTeamKey, parseYahooTeam, parseYahooTeams } from "./team.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function wrapTeam(team: unknown): unknown {
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
                      leagues: {
                        "0": { league: [{ league_key: "999.l.123456", league_id: "123456" }, { teams: { "0": { team } } }] },
                        count: 1,
                      },
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

describe("parseYahooTeam", () => {
  it("parses a normal team and optional fields", () => {
    const team = parseYahooTeam(
      wrapTeam({
        team_key: "999.l.123456.t.1",
        team_id: "1",
        name: "Co-Pilot Test Team",
        url: "https://example.invalid/team/1",
        number_of_moves: "3",
        number_of_trades: 1,
        team_logos: [{ team_logo: { url: "https://example.invalid/logo.png" } }],
        extra_yahoo_field: { nested: true },
      }),
    );

    assert.deepEqual(team, {
      teamKey: "999.l.123456.t.1",
      teamId: "1",
      name: "Co-Pilot Test Team",
      leagueKey: "999.l.123456",
      url: "https://example.invalid/team/1",
      logoUrl: "https://example.invalid/logo.png",
      numberOfMoves: 3,
      numberOfTrades: 1,
    });
  });

  it("derives leagueKey from teamKey", () => {
    assert.equal(leagueKeyFromTeamKey("999.l.123456.t.8"), "999.l.123456");
    const team = parseYahooTeam(
      wrapTeam({
        team_key: "461.l.55.t.12",
        team_id: 12,
        name: "Derived",
      }),
    );
    assert.equal(team.leagueKey, "461.l.55");
    assert.equal(team.teamId, "12");
  });

  it("allows missing optional fields", () => {
    const team = parseYahooTeam(
      wrapTeam({
        team_key: "999.l.123456.t.1",
        team_id: "1",
        name: "Bare Team",
      }),
    );
    assert.equal(team.url, undefined);
    assert.equal(team.logoUrl, undefined);
    assert.equal(team.numberOfMoves, undefined);
  });

  it("throws when team_key is missing", () => {
    assert.throws(
      () => parseYahooTeam(wrapTeam({ team_id: "1", name: "No Key" })),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("team_key"),
    );
  });

  it("throws when team_key cannot yield leagueKey", () => {
    assert.throws(
      () =>
        parseYahooTeam(
          wrapTeam({
            team_key: "not-a-team-key",
            team_id: "1",
            name: "Broken",
          }),
        ),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("leagueKey"),
    );
  });

  it("parses the synthetic fixture payload", () => {
    const payload = JSON.parse(readFileSync(path.join(fixturesDir, "team.json"), "utf8"));
    const team = parseYahooTeam(payload);
    assert.equal(team.teamKey, "999.l.123456.t.1");
    assert.equal(team.name, "Co-Pilot Test Team");
    assert.equal(team.leagueKey, "999.l.123456");
    assert.equal(team.logoUrl, "https://example.invalid/logos/copilot.png");
  });

  it("returns multiple teams when present", () => {
    const teams = parseYahooTeams({
      fantasy_content: {
        team: { team_key: "999.l.1.t.1", team_id: "1", name: "One" },
      },
    });
    assert.equal(teams.length, 1);
  });
});
