import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { YahooApiError, YahooErrorCode } from "../errors.js";
import { parseYahooGames, selectActiveNflGame } from "./games.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function wrapGames(games: unknown[]): unknown {
  return {
    fantasy_content: {
      users: {
        "0": {
          user: [
            { guid: "abc" },
            {
              games: Object.fromEntries([
                ...games.map((game, index) => [
                  String(index),
                  { game },
                ]),
                ["count", games.length],
              ]),
            },
          ],
        },
        count: 1,
      },
    },
  };
}

describe("parseYahooGames", () => {
  it("parses one game", () => {
    const games = parseYahooGames(
      wrapGames([
        {
          game_key: "461",
          game_id: "461",
          code: "nfl",
          name: "Football",
          season: "2026",
          is_game_over: 0,
        },
      ]),
    );

    assert.equal(games.length, 1);
    assert.deepEqual(games[0], {
      gameKey: "461",
      gameId: "461",
      code: "nfl",
      name: "Football",
      season: "2026",
      isGameOver: false,
    });
  });

  it("parses multiple games including numeric keys and extra fields", () => {
    const games = parseYahooGames(
      wrapGames([
        {
          game_key: "999",
          code: "nfl",
          name: "Football",
          season: "2026",
          unused: "x",
        },
        {
          game_key: "50",
          code: "mlb",
          name: "Baseball",
          season: "2026",
        },
      ]),
    );

    assert.equal(games.length, 2);
    assert.equal(games[0].gameKey, "999");
    assert.equal(games[1].code, "mlb");
  });

  it("accepts a game object instead of an array", () => {
    const games = parseYahooGames({
      fantasy_content: {
        game: {
          game_key: "7",
          code: "nfl",
          name: "Football",
          season: "2026",
        },
      },
    });
    assert.equal(games[0].gameKey, "7");
  });

  it("ignores missing optional metadata", () => {
    const games = parseYahooGames(
      wrapGames([
        {
          game_key: "1",
          code: "nfl",
          name: "Football",
          season: "2026",
        },
      ]),
    );
    assert.equal(games[0].gameId, undefined);
    assert.equal(games[0].isGameOver, undefined);
  });

  it("throws when game_key is missing", () => {
    assert.throws(
      () => parseYahooGames(wrapGames([{ code: "nfl", name: "Football", season: "2026" }])),
      (error: unknown) =>
        error instanceof YahooApiError &&
        error.code === YahooErrorCode.PARSE_ERROR &&
        error.message.includes("game_key"),
    );
  });

  it("parses the synthetic fixture payload", () => {
    const payload = JSON.parse(readFileSync(path.join(fixturesDir, "games.json"), "utf8"));
    const games = parseYahooGames(payload);
    assert.equal(games.length, 2);
    assert.equal(games[0].gameKey, "999");
    assert.equal(games[0].season, "2026");
    assert.equal(selectActiveNflGame(games)?.gameKey, "999");
  });

  it("selects the latest in-season NFL game", () => {
    const selected = selectActiveNflGame([
      { gameKey: "1", code: "nfl", name: "Football", season: "2025", isGameOver: true },
      { gameKey: "2", code: "nfl", name: "Football", season: "2026", isGameOver: false },
      { gameKey: "3", code: "mlb", name: "Baseball", season: "2026" },
    ]);
    assert.equal(selected?.gameKey, "2");
  });
});
