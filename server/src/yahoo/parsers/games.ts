import type { YahooGame } from "../types.js";
import {
  collectNamedResources,
  parseError,
  readBooleanFlag,
  readString,
} from "./walk.js";

export function parseYahooGames(payload: unknown): YahooGame[] {
  const blocks = collectNamedResources(payload, "game");
  return blocks.map((block, index) => normalizeGame(block, index));
}

function normalizeGame(block: Record<string, unknown>, index: number): YahooGame {
  const gameKey = readString(block.game_key);
  if (!gameKey) {
    throw parseError(`Yahoo game at index ${index} is missing game_key.`);
  }

  const code = readString(block.code) ?? "";
  const name = readString(block.name) ?? "";
  const season = readString(block.season) ?? "";
  const game: YahooGame = {
    gameKey,
    code,
    name,
    season,
  };

  const gameId = readString(block.game_id);
  if (gameId !== undefined) {
    game.gameId = gameId;
  }

  const isGameOver = readBooleanFlag(block.is_game_over);
  if (isGameOver !== undefined) {
    game.isGameOver = isGameOver;
  }

  return game;
}

export function selectActiveNflGame(games: YahooGame[]): YahooGame | undefined {
  const nfl = games.filter((game) => game.code.toLowerCase() === "nfl");
  if (nfl.length === 0) {
    return undefined;
  }

  const inSeason = nfl.filter((game) => game.isGameOver !== true);
  const pool = inSeason.length > 0 ? inSeason : nfl;
  return [...pool].sort((a, b) => b.season.localeCompare(a.season, undefined, { numeric: true }))[0];
}
