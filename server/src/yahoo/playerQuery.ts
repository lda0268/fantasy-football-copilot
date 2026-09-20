import { YahooApiError, YahooErrorCode } from "./errors.js";
import type { YahooAvailablePlayer } from "./types.js";
import {
  FANTASY_POSITIONS,
  PLAYER_PAGE_DEFAULT_COUNT,
  PLAYER_PAGE_MAX_COUNT,
  assertSearchQuery,
  isFantasyPosition,
  type FantasyPosition,
} from "./resources.js";

export type PlayerListQuery = {
  start: number;
  count: number;
  position?: FantasyPosition;
};

function invalidRequest(message: string): YahooApiError {
  return new YahooApiError(YahooErrorCode.INVALID_REQUEST, message, { status: 400 });
}

function singleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function parseNonNegativeInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  if (!/^\d+$/.test(value.trim())) {
    throw invalidRequest(`${name} must be a non-negative integer.`);
  }
  return Number(value.trim());
}

export function parsePlayerListQuery(input: {
  position?: unknown;
  start?: unknown;
  count?: unknown;
}): PlayerListQuery {
  const positionRaw = singleQueryValue(input.position)?.trim();
  const start = parseNonNegativeInteger(singleQueryValue(input.start), "start", 0);
  const count = parseNonNegativeInteger(
    singleQueryValue(input.count),
    "count",
    PLAYER_PAGE_DEFAULT_COUNT,
  );

  if (start < 0) {
    throw invalidRequest("start must be >= 0.");
  }
  if (count < 1) {
    throw invalidRequest("count must be >= 1.");
  }
  if (count > PLAYER_PAGE_MAX_COUNT) {
    throw invalidRequest(`count must be <= ${PLAYER_PAGE_MAX_COUNT}.`);
  }

  const query: PlayerListQuery = { start, count };
  if (positionRaw) {
    const position = positionRaw.toUpperCase();
    if (!isFantasyPosition(position)) {
      throw invalidRequest(`position must be one of: ${FANTASY_POSITIONS.join(", ")}.`);
    }
    query.position = position;
  }
  return query;
}

export function parsePlayerSearchQuery(input: {
  q?: unknown;
  position?: unknown;
  start?: unknown;
  count?: unknown;
}): PlayerListQuery & { query: string } {
  const raw = singleQueryValue(input.q);
  if (raw === undefined) {
    throw invalidRequest("Search query is required.");
  }
  return {
    query: assertSearchQuery(raw),
    ...parsePlayerListQuery(input),
  };
}

export function playerMatchesPosition(player: YahooAvailablePlayer, position: FantasyPosition): boolean {
  if (player.displayPosition === position) {
    return true;
  }
  return player.eligiblePositions?.includes(position) ?? false;
}

export function playerMatchesSearch(player: YahooAvailablePlayer, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return false;
  }
  const haystacks = [player.name, player.firstName, player.lastName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return haystacks.some((value) => value.includes(needle));
}

export function filterAvailablePlayers(
  players: YahooAvailablePlayer[],
  options: { position?: FantasyPosition; query?: string },
): YahooAvailablePlayer[] {
  return players.filter((player) => {
    if (options.position && !playerMatchesPosition(player, options.position)) {
      return false;
    }
    if (options.query !== undefined && !playerMatchesSearch(player, options.query)) {
      return false;
    }
    return true;
  });
}

export function paginatePlayers(
  players: YahooAvailablePlayer[],
  start: number,
  count: number,
): YahooAvailablePlayer[] {
  return players.slice(start, start + count);
}
