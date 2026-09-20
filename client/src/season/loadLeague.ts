import {
  getFantasyProsStatus,
  getYahooLeagueSettings,
  getYahooLeagues,
  getYahooScoreboard,
  getYahooStandings,
  getYahooStatus,
  getYahooTeam,
} from "../api/season";
import { ApiError } from "../api/http";
import type {
  FantasyProsStatus,
  YahooLeague,
  YahooLeagueSettings,
  YahooMatchup,
  YahooStanding,
  YahooStatus,
  YahooTeam,
} from "../api/types";

export type LeaguePageData = {
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues: YahooLeague[];
  team?: YahooTeam;
  standings: YahooStanding[];
  league?: YahooLeague;
  matchups: YahooMatchup[];
  settings: YahooLeagueSettings;
  yahooError?: ApiError | Error;
  fantasyProsError?: ApiError | Error;
};

async function settled<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

export async function loadLeague(): Promise<LeaguePageData> {
  const [yahooStatus, fantasyProsStatus, leagues, team, standings, scoreboard, settings] = await Promise.all([
    settled(getYahooStatus()),
    settled(getFantasyProsStatus()),
    settled(getYahooLeagues()),
    settled(getYahooTeam()),
    settled(getYahooStandings()),
    settled(getYahooScoreboard()),
    settled(getYahooLeagueSettings()),
  ]);

  const yahooDataError = leagues.error ?? team.error ?? standings.error;
  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    team: team.value?.team,
    standings: standings.value?.standings ?? [],
    league: settings.value?.league ?? standings.value?.league ?? leagues.value?.leagues[0],
    matchups: scoreboard.value?.matchups ?? [],
    settings: settings.value?.settings ?? { rosterPositions: settings.value?.rosterPositions },
    yahooError: toError(yahooStatus.error ?? yahooDataError),
    fantasyProsError: toError(fantasyProsStatus.error),
  };
}

function toError(error: unknown): ApiError | Error | undefined {
  if (!error) {
    return undefined;
  }
  if (error instanceof ApiError || error instanceof Error) {
    return error;
  }
  return new Error("Request failed.");
}
