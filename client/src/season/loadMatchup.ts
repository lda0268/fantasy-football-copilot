import {
  getFantasyProsStatus,
  getMatchupIntelligence,
  getStartSit,
  getYahooLeagues,
  getYahooStatus,
} from "../api/season";
import { ApiError } from "../api/http";
import type { FantasyProsStatus, MatchupIntelligence, StartSitResult, YahooLeague, YahooStatus } from "../api/types";

export type MatchupPageData = {
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues: YahooLeague[];
  matchup?: MatchupIntelligence;
  startSit?: StartSitResult;
  yahooError?: ApiError | Error;
  fantasyProsError?: ApiError | Error;
  matchupError?: ApiError | Error;
  startSitError?: ApiError | Error;
};

async function settled<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

export async function loadMatchup(): Promise<MatchupPageData> {
  const [yahooStatus, fantasyProsStatus, leagues, matchup, startSit] = await Promise.all([
    settled(getYahooStatus()),
    settled(getFantasyProsStatus()),
    settled(getYahooLeagues()),
    settled(getMatchupIntelligence()),
    settled(getStartSit()),
  ]);

  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    matchup: matchup.value,
    startSit: startSit.value,
    yahooError: toError(yahooStatus.error ?? leagues.error ?? yahooFailure(matchup.error)),
    fantasyProsError: toError(fantasyProsStatus.error),
    matchupError: toError(matchup.error),
    startSitError: toError(startSit.error),
  };
}

function yahooFailure(error: unknown): unknown {
  if (error instanceof ApiError && (error.code.startsWith("yahoo") || error.status === 403 || error.code === "not_connected")) {
    return error;
  }
  return undefined;
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
