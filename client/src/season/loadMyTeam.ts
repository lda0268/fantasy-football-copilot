import {
  getCopilotRecommendationsV2,
  getFantasyProsStatus,
  getPlayerIntelligence,
  getYahooLeagues,
  getYahooMatchup,
  getYahooRoster,
  getYahooStandings,
  getYahooStatus,
  getYahooTeam,
} from "../api/season";
import { ApiError } from "../api/http";
import type {
  CopilotRecommendationsResponse,
  FantasyProsStatus,
  PlayerIntelligence,
  YahooLeague,
  YahooMatchup,
  YahooStanding,
  YahooStatus,
  YahooTeam,
} from "../api/types";
import { yahooRosterAsIntelligence } from "./rosterView";

export type MyTeamData = {
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues: YahooLeague[];
  team?: YahooTeam;
  standings: YahooStanding[];
  league?: YahooLeague;
  matchup?: YahooMatchup;
  intelligence: PlayerIntelligence[];
  recommendations?: CopilotRecommendationsResponse;
  yahooError?: ApiError | Error;
  fantasyProsError?: ApiError | Error;
  intelligenceError?: ApiError | Error;
  recommendationsError?: ApiError | Error;
};

async function settled<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

export async function loadMyTeam(): Promise<MyTeamData> {
  const [yahooStatus, fantasyProsStatus, leagues, team, standings, matchup, intelligence, roster, recommendations] =
    await Promise.all([
      settled(getYahooStatus()),
      settled(getFantasyProsStatus()),
      settled(getYahooLeagues()),
      settled(getYahooTeam()),
      settled(getYahooStandings()),
      settled(getYahooMatchup()),
      settled(getPlayerIntelligence()),
      settled(getYahooRoster()),
      settled(getCopilotRecommendationsV2()),
    ]);

  const yahooDataError = leagues.error ?? team.error ?? standings.error ?? matchup.error;
  const composed = intelligence.value?.players;
  const rosterFallback =
    (!composed || composed.length === 0) && intelligence.error && roster.value
      ? yahooRosterAsIntelligence(roster.value.players)
      : [];

  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    team: team.value?.team ?? roster.value?.team,
    standings: standings.value?.standings ?? [],
    league: standings.value?.league ?? leagues.value?.leagues[0],
    matchup: matchup.value?.matchup,
    intelligence: composed && composed.length > 0 ? composed : rosterFallback,
    recommendations: recommendations.value,
    yahooError: toError(yahooStatus.error ?? yahooDataError),
    fantasyProsError: toError(fantasyProsStatus.error ?? (rosterFallback.length > 0 ? intelligence.error : undefined)),
    intelligenceError: toError(intelligence.error),
    recommendationsError: toError(recommendations.error),
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
