import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import {
  filterAvailablePlayers,
  paginatePlayers,
  parsePlayerListQuery,
  parsePlayerSearchQuery,
} from "../playerQuery.js";
import { PLAYER_PAGE_MAX_COUNT } from "../resources.js";
import { parseYahooAvailablePlayers } from "./players.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function wrapPlayers(players: unknown[]): unknown {
  return {
    fantasy_content: {
      league: [
        { league_key: "999.l.123456", league_id: "123456" },
        {
          players: Object.fromEntries([
            ...players.map((player, index) => [String(index), player]),
            ["count", players.length],
          ]),
        },
      ],
    },
  };
}

function splitPlayer(identity: Record<string, unknown>, extras?: Record<string, unknown>): unknown {
  if (extras === undefined) {
    return { player: identity };
  }
  return { player: [identity, extras] };
}

describe("parseYahooAvailablePlayers", () => {
  it("parses one player with name parts, positions, injury, and bye", () => {
    const [player] = parseYahooAvailablePlayers(
      wrapPlayers([
        splitPlayer(
          {
            player_key: "999.p.1",
            player_id: "1",
            name: { full: "Nico Vale", first: "Nico", last: "Vale" },
            editorial_team_abbr: "CHI",
            display_position: "RB",
            eligible_positions: [{ position: "RB" }, { position: "W/R/T" }],
            status: "Q",
            status_full: "Questionable",
            bye_weeks: { week: "7" },
            uniform_number: "23",
            image_url: "https://example.invalid/nico.png",
          },
          {
            ownership: { ownership_type: "FA" },
            percent_owned: { value: "12.50" },
            player_points: { total: "9.80" },
            player_projected_points: { total: "11.40" },
          },
        ),
      ]),
    );

    assert.equal(player.playerKey, "999.p.1");
    assert.equal(player.playerId, "1");
    assert.equal(player.name, "Nico Vale");
    assert.equal(player.firstName, "Nico");
    assert.equal(player.lastName, "Vale");
    assert.deepEqual(player.eligiblePositions, ["RB", "W/R/T"]);
    assert.equal(player.status, "Q");
    assert.equal(player.byeWeek, 7);
    assert.equal(player.ownershipType, "FA");
    assert.equal(player.percentOwned, 12.5);
    assert.equal(player.fantasyPoints, 9.8);
    assert.equal(player.projectedPoints, 11.4);
  });

  it("parses waiver and owned players with owner metadata", () => {
    const players = parseYahooAvailablePlayers(
      wrapPlayers([
        splitPlayer(
          { player_key: "999.p.2", player_id: "2", name: "Remy Holt" },
          { ownership: { ownership_type: "W" } },
        ),
        splitPlayer(
          { player_key: "999.p.3", player_id: "3", name: "Rex Calder" },
          {
            ownership: {
              ownership_type: "team",
              owner_team_key: "999.l.123456.t.1",
              owner_team_name: "Co-Pilot Test Team",
            },
          },
        ),
      ]),
    );

    assert.equal(players.length, 2);
    assert.equal(players[0].ownershipType, "W");
    assert.equal(players[1].ownershipType, "team");
    assert.equal(players[1].ownerTeamKey, "999.l.123456.t.1");
    assert.equal(players[1].ownerTeamName, "Co-Pilot Test Team");
  });

  it("parses zero percent owned and zero fantasy points as numeric zero", () => {
    const [player] = parseYahooAvailablePlayers(
      wrapPlayers([
        splitPlayer(
          { player_key: "999.p.4", player_id: "4", name: "Zero Player" },
          {
            percent_owned: { value: "0.00" },
            player_points: { total: "0" },
          },
        ),
      ]),
    );
    assert.equal(player.percentOwned, 0);
    assert.equal(player.fantasyPoints, 0);
    assert.equal(player.projectedPoints, undefined);
  });

  it("allows missing optional metadata", () => {
    const [player] = parseYahooAvailablePlayers(
      wrapPlayers([splitPlayer({ player_key: "999.p.5", player_id: "5", name: "Bare Player" })]),
    );
    assert.equal(player.ownershipType, undefined);
    assert.equal(player.percentOwned, undefined);
    assert.equal(player.editorialTeamAbbr, undefined);
    assert.equal(player.imageUrl, undefined);
  });

  it("ignores extra metadata and numeric keys", () => {
    const [player] = parseYahooAvailablePlayers(
      wrapPlayers([
        splitPlayer(
          {
            player_key: "999.p.6",
            player_id: 6,
            name: "Keyed",
            eligible_positions: { "0": { position: "WR" }, "1": { position: "W/R/T" }, count: 2 },
            extra_yahoo_field: { nested: true },
          },
        ),
      ]),
    );
    assert.equal(player.playerId, "6");
    assert.deepEqual(player.eligiblePositions, ["WR", "W/R/T"]);
  });

  it("throws for a malformed player", () => {
    assert.throws(
      () =>
        parseYahooAvailablePlayers(
          wrapPlayers([splitPlayer({ player_id: "1", name: "No Key" })]),
        ),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.PARSE_ERROR,
    );
  });

  it("parses the free-agent fixture", () => {
    const players = parseYahooAvailablePlayers(
      JSON.parse(readFileSync(path.join(fixturesDir, "free-agents.json"), "utf8")) as unknown,
    );
    assert.ok(players.length >= 20);
    assert.ok(players.every((player) => player.ownershipType === "FA"));
    assert.ok(players.some((player) => player.displayPosition === "QB"));
    assert.ok(players.some((player) => player.displayPosition === "DEF"));
  });
});

describe("fixture filtering and query validation", () => {
  const freeAgents = parseYahooAvailablePlayers(
    JSON.parse(readFileSync(path.join(fixturesDir, "free-agents.json"), "utf8")) as unknown,
  );
  const searchPlayers = parseYahooAvailablePlayers(
    JSON.parse(readFileSync(path.join(fixturesDir, "player-search.json"), "utf8")) as unknown,
  );

  it("filters RBs and WRs from the free-agent fixture", () => {
    const rbs = filterAvailablePlayers(freeAgents, { position: "RB" });
    const wrs = filterAvailablePlayers(freeAgents, { position: "WR" });
    assert.ok(rbs.length > 0);
    assert.ok(rbs.every((player) => player.displayPosition === "RB" || player.eligiblePositions?.includes("RB")));
    assert.ok(wrs.length > 0);
    assert.ok(wrs.every((player) => player.displayPosition === "WR" || player.eligiblePositions?.includes("WR")));
  });

  it("searches case-insensitively and returns [] when nothing matches", () => {
    const matches = filterAvailablePlayers(searchPlayers, { query: "CaLdEr" });
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, "Rex Calder");
    assert.equal(matches[0].ownershipType, "team");
    assert.deepEqual(filterAvailablePlayers(searchPlayers, { query: "zzzz-nope" }), []);
  });

  it("paginates after filtering", () => {
    const rbs = filterAvailablePlayers(freeAgents, { position: "RB" });
    const page = paginatePlayers(rbs, 1, 2);
    assert.equal(page.length, Math.min(2, Math.max(0, rbs.length - 1)));
    if (rbs.length > 1) {
      assert.equal(page[0].playerKey, rbs[1].playerKey);
    }
  });

  it("enforces count maximum and rejects invalid position and empty search", () => {
    assert.throws(
      () => parsePlayerListQuery({ count: String(PLAYER_PAGE_MAX_COUNT + 1) }),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () => parsePlayerListQuery({ position: "FLEX" }),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () => parsePlayerSearchQuery({ q: "   " }),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
    assert.throws(
      () => parsePlayerSearchQuery({}),
      (error: unknown) => error instanceof YahooApiError && error.code === YahooErrorCode.INVALID_REQUEST,
    );
  });
});
