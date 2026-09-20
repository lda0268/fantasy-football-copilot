import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import { parseRosterWeek, parseYahooRosterPlayers } from "./roster.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function playerResource(player: unknown, selected?: unknown): unknown {
  if (selected === undefined) {
    return { player };
  }
  return { player: [player, { selected_position: selected }] };
}

function wrapPlayers(players: unknown[]): unknown {
  return {
    fantasy_content: {
      team: [
        { team_key: "999.l.123456.t.1", team_id: "1", name: "Co-Pilot Test Team" },
        {
          roster: {
            coverage_type: "week",
            week: "2",
            extra_meta: true,
            "0": {
              players: Object.fromEntries([
                ...players.map((player, index) => [String(index), player]),
                ["count", players.length],
              ]),
            },
          },
        },
      ],
    },
  };
}

describe("parseYahooRosterPlayers", () => {
  it("parses a single player", () => {
    const players = parseYahooRosterPlayers(
      wrapPlayers([
        playerResource({
          player_key: "999.p.1",
          player_id: "1",
          name: { full: "Ada West", first: "Ada", last: "West" },
          editorial_team_abbr: "KC",
          display_position: "QB",
          eligible_positions: [{ position: "QB" }],
          bye_weeks: { week: "10" },
          uniform_number: "15",
          image_url: "https://example.invalid/ada.png",
        }, { coverage_type: "week", week: "2", position: "QB" }),
      ]),
    );

    assert.equal(players.length, 1);
    assert.equal(players[0].playerKey, "999.p.1");
    assert.equal(players[0].name, "Ada West");
    assert.equal(players[0].firstName, "Ada");
    assert.equal(players[0].selectedPosition, "QB");
    assert.deepEqual(players[0].eligiblePositions, ["QB"]);
    assert.equal(players[0].byeWeek, 10);
  });

  it("parses multiple players, injury status, and numeric keys", () => {
    const players = parseYahooRosterPlayers(
      wrapPlayers([
        playerResource({
          player_key: "999.p.2",
          player_id: "2",
          name: "Bo Reed",
          display_position: "RB",
          eligible_positions: { "0": { position: "RB" }, "1": { position: "W/R/T" }, count: 2 },
        }, { position: "RB" }),
        playerResource({
          player_key: "999.p.3",
          player_id: 3,
          name: { full: "Cy Lang", first: "Cy", last: "Lang" },
          status: "Q",
          status_full: "Questionable",
          extra_stats: { ignored: true },
        }),
      ]),
    );

    assert.equal(players.length, 2);
    assert.deepEqual(players[0].eligiblePositions, ["RB", "W/R/T"]);
    assert.equal(players[1].playerId, "3");
    assert.equal(players[1].status, "Q");
    assert.equal(players[1].statusFull, "Questionable");
    assert.equal(players[1].selectedPosition, undefined);
  });

  it("allows missing optional fields", () => {
    const players = parseYahooRosterPlayers(
      wrapPlayers([
        playerResource({
          player_key: "999.p.9",
          player_id: "9",
          name: "Bare Player",
        }),
      ]),
    );
    assert.equal(players[0].editorialTeamAbbr, undefined);
    assert.equal(players[0].byeWeek, undefined);
    assert.equal(players[0].imageUrl, undefined);
  });

  it("throws when player_key is missing", () => {
    assert.throws(
      () =>
        parseYahooRosterPlayers(
          wrapPlayers([playerResource({ player_id: "1", name: "No Key" })]),
        ),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("player_key"),
    );
  });

  it("throws when name is missing", () => {
    assert.throws(
      () =>
        parseYahooRosterPlayers(
          wrapPlayers([playerResource({ player_key: "999.p.1", player_id: "1" })]),
        ),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("name"),
    );
  });

  it("parses week coverage and the synthetic fixture roster", () => {
    const payload = JSON.parse(readFileSync(path.join(fixturesDir, "roster.json"), "utf8"));
    assert.equal(parseRosterWeek(payload), 2);
    const players = parseYahooRosterPlayers(payload);
    assert.equal(players.length, 16);
    assert.equal(players[0].selectedPosition, "QB");
    assert.equal(players[10].status, "Q");
    assert.equal(players[15].selectedPosition, "IR");
    assert.ok(players.some((player) => player.displayPosition === "DEF"));
  });
});
