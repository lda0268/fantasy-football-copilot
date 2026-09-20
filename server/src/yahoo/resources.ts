import { YahooApiError, YahooErrorCode } from "./errors.js";

export const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
export type FantasyPosition = (typeof FANTASY_POSITIONS)[number];

export const PLAYER_PAGE_DEFAULT_COUNT = 25;
export const PLAYER_PAGE_MAX_COUNT = 50;
export const YAHOO_PLAYER_FILTER_COUNT_MAX = 25;
export const PLAYER_SEARCH_MAX_LENGTH = 64;

const LEAGUE_KEY_PATTERN = /^\d+\.l\.\d+$/;
const SEARCH_PATTERN = /^[A-Za-z0-9 .'-]+$/;

export type LeaguePlayerFilters = {
  leagueKey: string;
  start: number;
  count: number;
  position?: FantasyPosition;
  search?: string;
  status?: "FA";
};

function invalidRequest(message: string): YahooApiError {
  return new YahooApiError(YahooErrorCode.INVALID_REQUEST, message, { status: 400 });
}

export function assertSafeLeagueKey(leagueKey: string): string {
  if (!LEAGUE_KEY_PATTERN.test(leagueKey)) {
    throw invalidRequest("Yahoo league key is invalid.");
  }
  return leagueKey;
}

function encodeFilterValue(value: string): string {
  if (value === "" || /[;/?:#&=]/.test(value)) {
    throw invalidRequest("Yahoo filter value is invalid.");
  }
  return encodeURIComponent(value);
}

export function buildLeaguePlayersResource(filters: LeaguePlayerFilters): string {
  const leagueKey = assertSafeLeagueKey(filters.leagueKey);
  const parts: string[] = [];
  if (filters.status) {
    parts.push(`status=${encodeFilterValue(filters.status)}`);
  }
  if (filters.position) {
    parts.push(`position=${encodeFilterValue(filters.position)}`);
  }
  if (filters.search !== undefined) {
    parts.push(`search=${encodeFilterValue(filters.search)}`);
  }
  parts.push(`start=${filters.start}`);
  parts.push(`count=${filters.count}`);
  return `league/${leagueKey}/players;${parts.join(";")}`;
}

export function buildFreeAgentResource(options: {
  leagueKey: string;
  start: number;
  count: number;
  position?: FantasyPosition;
}): string {
  return buildLeaguePlayersResource({
    leagueKey: options.leagueKey,
    start: options.start,
    count: options.count,
    position: options.position,
    status: "FA",
  });
}

export function buildPlayerSearchResource(options: {
  leagueKey: string;
  query: string;
  start: number;
  count: number;
  position?: FantasyPosition;
}): string {
  return buildLeaguePlayersResource({
    leagueKey: options.leagueKey,
    start: options.start,
    count: options.count,
    position: options.position,
    search: options.query,
  });
}

export function isFantasyPosition(value: string): value is FantasyPosition {
  return (FANTASY_POSITIONS as readonly string[]).includes(value);
}

export function assertSearchQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed === "") {
    throw invalidRequest("Search query is required.");
  }
  if (trimmed.length > PLAYER_SEARCH_MAX_LENGTH) {
    throw invalidRequest("Search query is too long.");
  }
  if (!SEARCH_PATTERN.test(trimmed)) {
    throw invalidRequest("Search query contains unsupported characters.");
  }
  return trimmed;
}
