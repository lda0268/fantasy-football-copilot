import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import { parseYahooMatchups, selectMatchupForTeam } from "./matchup.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function wrapScoreboard(matchups: unknown[]): unknown {
  return {
    fantasy_content: {
      league: [
        { league_key: "999.l.123456", league_id: "123456", current_week: 2 },
        {
          scoreboard: {
            week: "2",
            extra_yahoo_field: { ignored: true },
            "0": {
              matchups: Object.fromEntries([
                ...matchups.map((matchup, index) => [String(index), { matchup }]),
                ["count", matchups.length],
              ]),
            },
          },
        },
      ],
    },
  };
}

function splitMatchup(
  meta: Record<string, unknown>,
  teams: unknown[],
): unknown {
  return [
    meta,
    Object.fromEntries(teams.map((team, index) => [String(index), { team }])),
  ];
}

function splitTeam(identity: Record<string, unknown>, extras: Record<string, unknown>): unknown {
  return [identity, extras];
}

describe("parseYahooMatchups", () => {
  it("parses two teams, decimal scores, projected points, and week", () => {
    const [matchup] = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup(
          { week: "2", status: "midevent", is_playoffs: "0", is_consolation: "0", is_tied: "0" },
          [
            splitTeam(
              { team_key: "999.l.123456.t.1", team_id: "1", name: "Co-Pilot Test Team" },
              {
                team_points: { total: "87.42" },
                team_projected_points: { total: "126.55" },
                team_standings: { outcome_totals: { wins: "1", losses: "0", ties: "0" } },
              },
            ),
            splitTeam(
              { team_key: "999.l.123456.t.2", team_id: "2", name: { full: "Fourth Down Labs" } },
              {
                team_points: { total: "81.18" },
                team_projected_points: { total: "121.30" },
                team_standings: { outcome_totals: { wins: "0", losses: "1", ties: "0" } },
              },
            ),
          ],
        ),
      ]),
    );

    assert.equal(matchup.week, 2);
    assert.equal(matchup.status, "midevent");
    assert.equal(matchup.isPlayoffs, false);
    assert.equal(matchup.isConsolation, false);
    assert.equal(matchup.isTied, false);
    assert.equal(matchup.winnerTeamKey, undefined);
    assert.equal(matchup.teams.length, 2);
    assert.equal(matchup.teams[0].points, 87.42);
    assert.equal(matchup.teams[0].projectedPoints, 126.55);
    assert.equal(matchup.teams[0].wins, 1);
    assert.equal(matchup.teams[1].points, 81.18);
    assert.equal(matchup.teams[1].projectedPoints, 121.3);
  });

  it("parses a zero score as numeric zero, not missing", () => {
    const [matchup] = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup({ week: 2 }, [
          splitTeam(
            { team_key: "999.l.123456.t.1", team_id: "1", name: "Zero Home" },
            { team_points: { total: "0.00" } },
          ),
          splitTeam(
            { team_key: "999.l.123456.t.2", team_id: "2", name: "Zero Away" },
            { team_points: { total: "0" } },
          ),
        ]),
      ]),
    );

    assert.equal(matchup.teams[0].points, 0);
    assert.equal(matchup.teams[1].points, 0);
    assert.equal(matchup.teams[0].projectedPoints, undefined);
  });

  it("treats a current matchup as in-progress with no winner", () => {
    const [matchup] = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup({ week: "2", status: "midevent", is_tied: "0" }, [
          { team_key: "999.l.123456.t.1", team_id: "1", name: "A" },
          { team_key: "999.l.123456.t.2", team_id: "2", name: "B" },
        ]),
      ]),
    );

    assert.equal(matchup.winnerTeamKey, undefined);
    assert.equal(matchup.status, "midevent");
    assert.equal(matchup.isTied, false);
  });

  it("parses a completed matchup with a winner and playoff flags", () => {
    const [matchup] = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup(
          {
            week: "16",
            status: "postevent",
            is_playoffs: "1",
            is_consolation: "1",
            is_tied: "0",
            winner_team_key: "999.l.123456.t.8",
          },
          [
            {
              team_key: "999.l.123456.t.8",
              team_id: "8",
              name: "Winner",
              team_points: { total: "112.40" },
            },
            {
              team_key: "999.l.123456.t.9",
              team_id: "9",
              name: "Loser",
              team_points: { total: "90.10" },
            },
          ],
        ),
      ]),
    );

    assert.equal(matchup.week, 16);
    assert.equal(matchup.status, "postevent");
    assert.equal(matchup.isPlayoffs, true);
    assert.equal(matchup.isConsolation, true);
    assert.equal(matchup.winnerTeamKey, "999.l.123456.t.8");
  });

  it("allows missing optional fields", () => {
    const [matchup] = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup({ week: "2" }, [
          { team_key: "999.l.123456.t.1", team_id: "1", name: "Bare Home" },
          { team_key: "999.l.123456.t.2", team_id: "2", name: "Bare Away" },
        ]),
      ]),
    );

    assert.equal(matchup.status, undefined);
    assert.equal(matchup.isPlayoffs, undefined);
    assert.equal(matchup.winnerTeamKey, undefined);
    assert.equal(matchup.teams[0].points, undefined);
    assert.equal(matchup.teams[0].wins, undefined);
  });

  it("ignores unexpected metadata and numeric keys", () => {
    const [matchup] = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup(
          { week: "2", unexpected: { nested: true }, count: 99 },
          [
            {
              team_key: "999.l.123456.t.1",
              team_id: "1",
              name: "Home",
              extra_yahoo_field: { ignored: true },
            },
            { team_key: "999.l.123456.t.2", team_id: "2", name: "Away" },
          ],
        ),
      ]),
    );
    assert.equal(matchup.teams[0].name, "Home");
  });

  it("throws for a malformed matchup missing week", () => {
    assert.throws(
      () =>
        parseYahooMatchups(
          wrapScoreboard([
            splitMatchup({ status: "midevent" }, [
              { team_key: "999.l.123456.t.1", team_id: "1", name: "A" },
              { team_key: "999.l.123456.t.2", team_id: "2", name: "B" },
            ]),
          ]),
        ),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.PARSE_ERROR,
    );
  });

  it("throws for a malformed matchup team", () => {
    assert.throws(
      () =>
        parseYahooMatchups(
          wrapScoreboard([
            splitMatchup({ week: "2" }, [
              { team_id: "1", name: "No Key" },
              { team_key: "999.l.123456.t.2", team_id: "2", name: "B" },
            ]),
          ]),
        ),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.PARSE_ERROR,
    );
  });

  it("throws when a matchup does not contain two teams", () => {
    assert.throws(
      () =>
        parseYahooMatchups(
          wrapScoreboard([
            splitMatchup({ week: "2" }, [
              { team_key: "999.l.123456.t.1", team_id: "1", name: "Only One" },
            ]),
          ]),
        ),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.PARSE_ERROR,
    );
  });
});

describe("selectMatchupForTeam", () => {
  it("selects the matchup containing 999.l.123456.t.1 even when it is not first", () => {
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, "scoreboard.json"), "utf8")) as unknown;
    const matchups = parseYahooMatchups(fixture);
    assert.ok(matchups.length > 1);
    assert.equal(
      matchups[0].teams.some((team) => team.teamKey === "999.l.123456.t.1"),
      false,
    );

    const selected = selectMatchupForTeam(matchups, "999.l.123456.t.1");
    assert.equal(selected.week, 2);
    assert.equal(selected.winnerTeamKey, undefined);
    assert.equal(selected.isTied, false);
    assert.deepEqual(
      selected.teams.map((team) => team.teamKey),
      ["999.l.123456.t.1", "999.l.123456.t.2"],
    );
    assert.equal(selected.teams[0].name, "Co-Pilot Test Team");
    assert.equal(selected.teams[1].name, "Fourth Down Labs");
    assert.equal(selected.teams[0].points, 87.42);
    assert.equal(selected.teams[1].points, 81.18);
    assert.equal(selected.teams[0].projectedPoints, 126.55);
    assert.equal(selected.teams[1].projectedPoints, 121.3);
  });

  it("throws YAHOO_MATCHUP_NOT_FOUND when the user team is absent", () => {
    const matchups = parseYahooMatchups(
      wrapScoreboard([
        splitMatchup({ week: "2" }, [
          { team_key: "999.l.123456.t.3", team_id: "3", name: "A" },
          { team_key: "999.l.123456.t.4", team_id: "4", name: "B" },
        ]),
      ]),
    );
    assert.throws(
      () => selectMatchupForTeam(matchups, "999.l.123456.t.1"),
      (error: unknown) =>
        error instanceof YahooApiError && error.code === YahooErrorCode.MATCHUP_NOT_FOUND,
    );
  });
});
