import { getCopilotRecommendationsV2, getFantasyProsStatus, getYahooLeagues, getYahooStatus } from "../api/season";
import { ApiError } from "../api/http";
import type {
  CopilotRecommendationsResponse,
  FantasyProsStatus,
  YahooLeague,
  YahooStatus,
} from "../api/types";

export const WAIVER_RECOMMENDATION_LIMIT = 25;

export type WaiverWireData = {
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues: YahooLeague[];
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

export async function loadWaiverWire(): Promise<WaiverWireData> {
  const [yahooStatus, fantasyProsStatus, leagues, recommendations] = await Promise.all([
    settled(getYahooStatus()),
    settled(getFantasyProsStatus()),
    settled(getYahooLeagues()),
    settled(getCopilotRecommendationsV2(WAIVER_RECOMMENDATION_LIMIT)),
  ]);

  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    recommendations: recommendations.value,
    yahooError: toError(yahooStatus.error ?? leagues.error),
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
