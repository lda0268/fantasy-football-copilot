import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { yahooGet } from "./client.js";
import { isYahooApiError, YahooApiError, YahooErrorCode } from "./errors.js";
import { parseYahooGames, selectActiveNflGame } from "./parsers/games.js";
import { parseYahooLeagues, selectPrimaryLeague } from "./parsers/leagues.js";
import { mergeLeagueSettings, parseLeagueSettings } from "./parsers/leagueSettings.js";
import { parseRosterPositions } from "./parsers/rosterPositions.js";
import { parseYahooMatchups, selectMatchupForTeam } from "./parsers/matchup.js";
import { parseYahooAvailablePlayers } from "./parsers/players.js";
import { parseRosterWeek, parseYahooRosterPlayers } from "./parsers/roster.js";
import { parseYahooStandings } from "./parsers/standings.js";
import { leagueKeyFromTeamKey, parseYahooTeam, parseYahooTeams } from "./parsers/team.js";
import {
  filterAvailablePlayers,
  paginatePlayers,
  type PlayerListQuery,
} from "./playerQuery.js";
import {
  YAHOO_PLAYER_FILTER_COUNT_MAX,
  assertSafeTeamKey,
  buildFreeAgentResource,
  buildLeagueSettingsResource,
  buildPlayerSearchResource,
  buildPlayersByStatusResource,
  buildTeamRosterResource,
} from "./resources.js";
import { loadYahooTokens } from "./tokenStore.js";
import type {
  YahooAvailablePlayer,
  YahooGame,
  YahooLeague,
  YahooLeagueSettings,
  YahooMatchup,
  YahooRosterPlayer,
  YahooRosterPosition,
  YahooStanding,
  YahooStatus,
  YahooTeam,
} from "./types.js";

export interface YahooRoster {
  team: YahooTeam;
  week: number | null;
  players: YahooRosterPlayer[];
}

async function readFixture(fileName: string): Promise<unknown> {
  const filePath = path.join(config.yahoo.fixturesDir, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function readFixtureIfPresent(fileName: string): Promise<unknown | undefined> {
  try {
    return await readFixture(fileName);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function notFound(message: string): YahooApiError {
  return new YahooApiError(YahooErrorCode.HTTP_ERROR, message, { status: 404 });
}

function invalidRequest(message: string): YahooApiError {
  return new YahooApiError(YahooErrorCode.INVALID_REQUEST, message, { status: 400 });
}

export async function getYahooStatus(): Promise<YahooStatus> {
  const tokens = await loadYahooTokens();
  const mode = config.yahoo.fixtureMode ? "fixture" : "live";

  if (!tokens) {
    return {
      connected: false,
      fantasyAuthorized: false,
      mode,
      expiresAt: null,
    };
  }

  return {
    connected: true,
    fantasyAuthorized: await probeFantasyAuthorization(),
    mode,
    expiresAt: tokens.expiresAt,
  };
}

async function probeFantasyAuthorization(): Promise<boolean> {
  try {
    await yahooGet("users;use_login=1/games");
    return true;
  } catch (error) {
    if (isYahooApiError(error) && error.code === YahooErrorCode.ADDITIONAL_AUTH_REQUIRED) {
      return false;
    }
    if (isYahooApiError(error) && error.code === YahooErrorCode.NOT_CONNECTED) {
      return false;
    }
    return false;
  }
}

export async function listYahooGames(): Promise<YahooGame[]> {
  if (config.yahoo.fixtureMode) {
    return parseYahooGames(await readFixture("games.json"));
  }

  return parseYahooGames(await yahooGet("users;use_login=1/games"));
}

export async function listYahooLeagues(): Promise<YahooLeague[]> {
  if (config.yahoo.fixtureMode) {
    return parseYahooLeagues(await readFixture("leagues.json"));
  }

  const nflGame = await discoverActiveNflGame();
  if (!nflGame) {
    return [];
  }

  return parseYahooLeagues(
    await yahooGet(`users;use_login=1/games;game_keys=${nflGame.gameKey}/leagues`),
  );
}

export async function getYahooLeagueSettings(): Promise<{
  league: YahooLeague;
  rosterPositions: YahooRosterPosition[];
  settings: YahooLeagueSettings;
  source: "fixture" | "live";
}> {
  const league = await requirePrimaryLeague();
  if (config.yahoo.fixtureMode) {
    const settingsPayload = await readFixture("league-settings.json");
    const parsedSettings = parseLeagueSettings(settingsPayload);
    const fromLeague = league.rosterPositions ?? [];
    const fromSettingsFile = parsedSettings.rosterPositions ?? parseRosterPositions(settingsPayload);
    const rosterPositions = fromLeague.length > 0 ? fromLeague : fromSettingsFile;
    const settings = mergeLeagueSettings(
      {
        ...parsedSettings,
        scoringType: parsedSettings.scoringType ?? league.scoringType,
      },
      rosterPositions,
    );
    return {
      league: { ...league, rosterPositions },
      rosterPositions,
      settings,
      source: "fixture",
    };
  }

  const settingsPayload = await yahooGet(buildLeagueSettingsResource(league.leagueKey));
  const parsedSettings = parseLeagueSettings(settingsPayload);
  const fromSettings = parsedSettings.rosterPositions ?? parseRosterPositions(settingsPayload);
  const rosterPositions = fromSettings.length > 0 ? fromSettings : (league.rosterPositions ?? []);
  const settings = mergeLeagueSettings(parsedSettings, rosterPositions);
  return {
    league: { ...league, rosterPositions },
    rosterPositions,
    settings,
    source: "live",
  };
}

export async function getYahooTeam(): Promise<YahooTeam> {
  if (config.yahoo.fixtureMode) {
    return parseYahooTeam(await readFixture("team.json"));
  }

  return discoverLiveUserTeam();
}

export async function getYahooRoster(): Promise<YahooRoster> {
  if (config.yahoo.fixtureMode) {
    const team = parseYahooTeam(await readFixture("team.json"));
    const rosterPayload = await readFixture("roster.json");
    const league = selectPrimaryLeague(await listYahooLeagues());
    return {
      team,
      week: parseRosterWeek(rosterPayload) ?? league?.currentWeek ?? null,
      players: parseYahooRosterPlayers(rosterPayload),
    };
  }

  const team = await discoverLiveUserTeam();
  const league = selectPrimaryLeague(await listYahooLeagues());
  const rosterPayload = await yahooGet(buildTeamRosterResource(team.teamKey));
  return {
    team,
    week: parseRosterWeek(rosterPayload) ?? getCurrentLeagueWeek(league),
    players: parseYahooRosterPlayers(rosterPayload),
  };
}

export async function getYahooTeamRoster(teamKey: string): Promise<YahooRoster> {
  const safeKey = assertSafeTeamKey(teamKey);
  const league = await requirePrimaryLeague();
  if (leagueKeyFromTeamKey(safeKey) !== league.leagueKey) {
    throw invalidRequest("Team is not in the current league.");
  }

  const { standings } = await getYahooStandings();
  const standing = standings.find((row) => row.teamKey === safeKey);
  if (!standing) {
    throw notFound("No Yahoo roster was found for that team.");
  }

  const identity: YahooTeam = {
    teamKey: standing.teamKey,
    teamId: standing.teamId,
    name: standing.name,
    leagueKey: league.leagueKey,
  };

  if (config.yahoo.fixtureMode) {
    const userTeam = await getYahooTeam();
    const fileName = safeKey === userTeam.teamKey ? "roster.json" : `roster-${standing.teamId}.json`;
    const rosterPayload = await readFixtureIfPresent(fileName);
    if (!rosterPayload) {
      throw notFound("No Yahoo roster was found for that team.");
    }
    return {
      team: parseTeamIdentity(rosterPayload, identity),
      week: parseRosterWeek(rosterPayload) ?? getCurrentLeagueWeek(league),
      players: parseYahooRosterPlayers(rosterPayload),
    };
  }

  const rosterPayload = await yahooGet(buildTeamRosterResource(safeKey));
  return {
    team: parseTeamIdentity(rosterPayload, identity),
    week: parseRosterWeek(rosterPayload) ?? getCurrentLeagueWeek(league),
    players: parseYahooRosterPlayers(rosterPayload),
  };
}

function parseTeamIdentity(payload: unknown, fallback: YahooTeam): YahooTeam {
  try {
    return parseYahooTeam(payload);
  } catch {
    return fallback;
  }
}

export async function getYahooMatchup(): Promise<YahooMatchup> {
  const team = await getYahooTeam();
  const { matchups } = await listYahooMatchups();
  return selectMatchupForTeam(matchups, team.teamKey);
}

export async function listYahooMatchups(): Promise<{ league: YahooLeague; matchups: YahooMatchup[] }> {
  const league = await requirePrimaryLeague();
  const payload = config.yahoo.fixtureMode
    ? await readFixture("scoreboard.json")
    : await yahooGet(scoreboardResource(league));
  return {
    league,
    matchups: parseYahooMatchups(payload),
  };
}

export async function getYahooStandings(): Promise<{ league: YahooLeague; standings: YahooStanding[] }> {
  const league = await requirePrimaryLeague();
  const payload = config.yahoo.fixtureMode
    ? await readFixture("standings.json")
    : await yahooGet(`league/${league.leagueKey}/standings`);
  return {
    league,
    standings: parseYahooStandings(payload),
  };
}

export type YahooPlayerListResult = {
  league: YahooLeague;
  players: YahooAvailablePlayer[];
  pagination: { start: number; count: number; total: number | null };
};

export async function getYahooFreeAgents(query: PlayerListQuery): Promise<YahooPlayerListResult> {
  return getYahooPlayersByStatus("FA", query);
}

export async function getYahooPlayersByStatus(
  status: "FA" | "W" | "T",
  query: PlayerListQuery,
): Promise<YahooPlayerListResult> {
  const league = await requirePrimaryLeague();
  if (config.yahoo.fixtureMode) {
    const fileName = status === "FA" ? "free-agents.json" : "player-search.json";
    const parsed = parseYahooAvailablePlayers(await readFixture(fileName));
    const byStatus =
      status === "FA"
        ? parsed
        : parsed.filter((player) => ownershipMatchesStatus(player.ownershipType, status));
    return pageParsedPlayers(league, byStatus, query);
  }

  const players = await fetchYahooPlayerPages(query, (page) =>
    status === "FA"
      ? buildFreeAgentResource({
          leagueKey: league.leagueKey,
          start: page.start,
          count: page.count,
          position: query.position,
        })
      : buildPlayersByStatusResource({
          leagueKey: league.leagueKey,
          start: page.start,
          count: page.count,
          position: query.position,
          status,
        }),
  );
  return {
    league,
    players,
    pagination: { start: query.start, count: players.length, total: null },
  };
}

function pageParsedPlayers(
  league: YahooLeague,
  players: YahooAvailablePlayer[],
  query: PlayerListQuery & { query?: string },
): YahooPlayerListResult {
  const filtered = filterAvailablePlayers(players, {
    position: query.position,
    query: query.query,
  });
  const page = paginatePlayers(filtered, query.start, query.count);
  return {
    league,
    players: page,
    pagination: {
      start: query.start,
      count: page.length,
      total: filtered.length,
    },
  };
}

function ownershipMatchesStatus(ownershipType: string | undefined, status: "W" | "T"): boolean {
  const ownership = ownershipType?.trim().toLowerCase().replace(/[\s_-]/g, "") ?? "";
  if (status === "W") {
    return ownership === "w" || ownership === "waiver" || ownership === "waivers";
  }
  return ownership === "team";
}

export async function getYahooPlayerSearch(
  query: PlayerListQuery & { query: string },
): Promise<YahooPlayerListResult & { query: string }> {
  const league = await requirePrimaryLeague();
  if (config.yahoo.fixtureMode) {
    const page = pageFixturePlayers(league, await readFixture("player-search.json"), query);
    return { ...page, query: query.query };
  }

  const players = await fetchYahooPlayerPages(query, (page) =>
    buildPlayerSearchResource({
      leagueKey: league.leagueKey,
      query: query.query,
      start: page.start,
      count: page.count,
      position: query.position,
    }),
  );
  return {
    league,
    query: query.query,
    players,
    pagination: { start: query.start, count: players.length, total: null },
  };
}

function pageFixturePlayers(
  league: YahooLeague,
  payload: unknown,
  query: PlayerListQuery & { query?: string },
): YahooPlayerListResult {
  return pageParsedPlayers(league, parseYahooAvailablePlayers(payload), query);
}

async function fetchYahooPlayerPages(
  query: PlayerListQuery,
  buildResource: (page: { start: number; count: number }) => string,
): Promise<YahooAvailablePlayer[]> {
  const players: YahooAvailablePlayer[] = [];
  let remaining = query.count;
  let start = query.start;
  while (remaining > 0) {
    const pageCount = Math.min(remaining, YAHOO_PLAYER_FILTER_COUNT_MAX);
    const batch = parseYahooAvailablePlayers(await yahooGet(buildResource({ start, count: pageCount })));
    players.push(...batch);
    if (batch.length < pageCount) {
      break;
    }
    start += pageCount;
    remaining -= pageCount;
  }
  return players;
}

async function discoverActiveNflGame(): Promise<YahooGame | undefined> {
  const games = parseYahooGames(await yahooGet("users;use_login=1/games"));
  return selectActiveNflGame(games);
}

async function discoverPrimaryLeague(): Promise<YahooLeague | undefined> {
  return selectPrimaryLeague(await listYahooLeagues());
}

async function requirePrimaryLeague(): Promise<YahooLeague> {
  const league = await discoverPrimaryLeague();
  if (!league) {
    throw notFound("No NFL Fantasy league was found for the authenticated user.");
  }
  return league;
}

function getCurrentLeagueWeek(league: YahooLeague | undefined): number | null {
  return league?.currentWeek ?? null;
}

function scoreboardResource(league: YahooLeague): string {
  const week = league.currentWeek;
  if (week !== undefined) {
    return `league/${league.leagueKey}/scoreboard;week=${week}`;
  }
  return `league/${league.leagueKey}/scoreboard`;
}

async function discoverLiveUserTeam(): Promise<YahooTeam> {
  const nflGame = await discoverActiveNflGame();
  if (!nflGame) {
    throw notFound("No NFL Fantasy game was found for the authenticated user.");
  }

  const leagues = parseYahooLeagues(
    await yahooGet(`users;use_login=1/games;game_keys=${nflGame.gameKey}/leagues`),
  );
  const league = selectPrimaryLeague(leagues);
  if (!league) {
    throw notFound("No NFL Fantasy league was found for the authenticated user.");
  }

  const teams = parseYahooTeams(
    await yahooGet(
      `users;use_login=1/games;game_keys=${nflGame.gameKey}/leagues;league_keys=${league.leagueKey}/teams`,
    ),
  );
  const team = teams.find((item) => item.leagueKey === league.leagueKey) ?? teams[0];
  if (!team) {
    throw notFound("No Yahoo fantasy team was found for the authenticated user.");
  }
  return team;
}
