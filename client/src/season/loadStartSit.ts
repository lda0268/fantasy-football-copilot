import { getFantasyProsStatus, getStartSit, getYahooLeagues, getYahooStatus } from "../api/season";
import { ApiError } from "../api/http";
import type { FantasyProsStatus, StartSitResult, YahooLeague, YahooStatus } from "../api/types";

export type StartSitPageData = {
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues: YahooLeague[];
  recommendation?: StartSitResult;
  yahooError?: ApiError | Error;
  fantasyProsError?: ApiError | Error;
  startSitError?: ApiError | Error;
};

async function settled<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

export async function loadStartSit(): Promise<StartSitPageData> {
  const [yahooStatus, fantasyProsStatus, leagues, startSit] = await Promise.all([
    settled(getYahooStatus()),
    settled(getFantasyProsStatus()),
    settled(getYahooLeagues()),
    settled(getStartSit()),
  ]);

  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    recommendation: startSit.value,
    yahooError: toError(yahooStatus.error ?? leagues.error ?? yahooFailure(startSit.error)),
    fantasyProsError: toError(fantasyProsStatus.error),
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
