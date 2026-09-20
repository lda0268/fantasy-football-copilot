import {
  getCopilotRecommendationsV2,
  getFantasyProsStatus,
  getPlayerIntelligence,
  getYahooLeagues,
  getYahooMatchup,
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

export type DashboardData = {
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
  recommendationsError?: ApiError | Error;
};

async function settled<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

export async function loadDashboard(): Promise<DashboardData> {
  const [
    yahooStatus,
    fantasyProsStatus,
    leagues,
    team,
    standings,
    matchup,
    intelligence,
    recommendations,
  ] = await Promise.all([
    settled(getYahooStatus()),
    settled(getFantasyProsStatus()),
    settled(getYahooLeagues()),
    settled(getYahooTeam()),
    settled(getYahooStandings()),
    settled(getYahooMatchup()),
    settled(getPlayerIntelligence()),
    settled(getCopilotRecommendationsV2()),
  ]);

  const yahooDataError =
    leagues.error ?? team.error ?? standings.error ?? matchup.error ?? intelligence.error;

  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    team: team.value?.team,
    standings: standings.value?.standings ?? [],
    league: standings.value?.league ?? leagues.value?.leagues[0],
    matchup: matchup.value?.matchup,
    intelligence: intelligence.value?.players ?? [],
    recommendations: recommendations.value,
    yahooError: toError(yahooStatus.error ?? yahooDataError),
    fantasyProsError: toError(fantasyProsStatus.error),
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
