import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import { parseYahooStandings } from "./standings.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function wrapStandings(teams: unknown[]): unknown {
  return {
    fantasy_content: {
      league: [
        { league_key: "999.l.123456", league_id: "123456", name: "Co-Pilot Test League" },
        {
          standings: {
            extra_yahoo_field: { ignored: true },
            "0": {
              teams: Object.fromEntries([
                ...teams.map((team, index) => [String(index), { team }]),
                ["count", teams.length],
              ]),
            },
          },
        },
      ],
    },
  };
}

function splitStanding(identity: Record<string, unknown>, standings: Record<string, unknown>): unknown {
  return [identity, { team_standings: standings }];
}

describe("parseYahooStandings", () => {
  it("parses rank, W/L/T, percentage, points, streak, and playoff seed", () => {
    const standings = parseYahooStandings(
      wrapStandings([
        splitStanding(
          { team_key: "999.l.123456.t.1", team_id: "1", name: "Co-Pilot Test Team" },
          {
            rank: "3",
            playoff_seed: "3",
            outcome_totals: { wins: "1", losses: "0", ties: "0", percentage: "1.000" },
            points_for: "131.90",
            points_against: "118.40",
            streak: { type: "win", value: "1" },
          },
        ),
        splitStanding(
          { team_key: "999.l.123456.t.2", team_id: "2", name: { full: "Fourth Down Labs" } },
          {
            rank: "7",
            outcome_totals: { wins: "0", losses: "1", ties: "0", percentage: "0.000" },
            points_for: "118.40",
            points_against: "131.90",
            streak: "L1",
          },
        ),
      ]),
    );

    assert.equal(standings.length, 2);
    assert.equal(standings[0].rank, 3);
    assert.equal(standings[0].teamKey, "999.l.123456.t.1");
    assert.equal(standings[0].wins, 1);
    assert.equal(standings[0].losses, 0);
    assert.equal(standings[0].ties, 0);
    assert.equal(standings[0].percentage, 1);
    assert.equal(standings[0].pointsFor, 131.9);
    assert.equal(standings[0].pointsAgainst, 118.4);
    assert.equal(standings[0].streak, "W1");
    assert.equal(standings[0].playoffSeed, 3);
    assert.equal(standings[1].streak, "L1");
    assert.equal(standings[1].playoffSeed, undefined);
  });

  it("sorts by Yahoo rank ascending even when payload order is reversed", () => {
    const standings = parseYahooStandings(
      wrapStandings([
        splitStanding(
          { team_key: "999.l.123456.t.9", team_id: "9", name: "Ninth" },
          { rank: "9", outcome_totals: { wins: "0", losses: "1", ties: "0" } },
        ),
        splitStanding(
          { team_key: "999.l.123456.t.1", team_id: "1", name: "First" },
          { rank: "1", outcome_totals: { wins: "1", losses: "0", ties: "0" } },
        ),
      ]),
    );
    assert.deepEqual(
      standings.map((row) => row.rank),
      [1, 9],
    );
  });

  it("allows missing optional fields", () => {
    const [standing] = parseYahooStandings(
      wrapStandings([
        splitStanding(
          { team_key: "999.l.123456.t.1", team_id: "1", name: "Bare" },
          { rank: "4", outcome_totals: { wins: "0", losses: "0", ties: "0" } },
        ),
      ]),
    );
    assert.equal(standing.percentage, undefined);
    assert.equal(standing.pointsFor, undefined);
    assert.equal(standing.streak, undefined);
    assert.equal(standing.playoffSeed, undefined);
  });

  it("ignores unexpected Yahoo metadata", () => {
    const [standing] = parseYahooStandings(
      wrapStandings([
        [
          { team_key: "999.l.123456.t.1", team_id: "1", name: "Meta", extra: { nested: true } },
          {
            team_standings: {
              rank: 2,
              outcome_totals: { wins: 1, losses: 0, ties: 0, unused: "x" },
              mystery: true,
            },
          },
        ],
      ]),
    );
    assert.equal(standing.name, "Meta");
    assert.equal(standing.rank, 2);
  });

  it("throws when required fields are missing", () => {
    assert.throws(
      () =>
        parseYahooStandings(
          wrapStandings([
            splitStanding(
              { team_key: "999.l.123456.t.1", team_id: "1", name: "No Rank" },
              { outcome_totals: { wins: "1", losses: "0", ties: "0" } },
            ),
          ]),
        ),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.PARSE_ERROR,
    );
    assert.throws(
      () =>
        parseYahooStandings(
          wrapStandings([
            splitStanding(
              { team_id: "1", name: "No Key" },
              { rank: "1", outcome_totals: { wins: "1", losses: "0", ties: "0" } },
            ),
          ]),
        ),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.PARSE_ERROR,
    );
  });

  it("parses the 10-team standings fixture and keeps Co-Pilot Test Team", () => {
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, "standings.json"), "utf8")) as unknown;
    const standings = parseYahooStandings(fixture);
    assert.equal(standings.length, 10);
    assert.deepEqual(
      standings.map((row) => row.rank),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    const copilot = standings.find((row) => row.teamKey === "999.l.123456.t.1");
    assert.equal(copilot?.name, "Co-Pilot Test Team");
    assert.equal(copilot?.rank, 3);
    assert.equal(copilot?.wins, 1);
    assert.equal(copilot?.losses, 0);
  });
});
