import { getFantasyProsStatus, getPlayerIntelligence, getYahooLeagues, getYahooStatus } from "../api/season";
import { ApiError } from "../api/http";
import type { FantasyProsStatus, PlayerIntelligence, YahooLeague, YahooStatus } from "../api/types";

export type PlayersPageData = {
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues: YahooLeague[];
  players: PlayerIntelligence[];
  yahooError?: ApiError | Error;
  fantasyProsError?: ApiError | Error;
  intelligenceError?: ApiError | Error;
};

async function settled<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

export async function loadPlayers(): Promise<PlayersPageData> {
  const [yahooStatus, fantasyProsStatus, leagues, intelligence] = await Promise.all([
    settled(getYahooStatus()),
    settled(getFantasyProsStatus()),
    settled(getYahooLeagues()),
    settled(getPlayerIntelligence()),
  ]);

  return {
    yahooStatus: yahooStatus.value,
    fantasyProsStatus: fantasyProsStatus.value,
    leagues: leagues.value?.leagues ?? [],
    players: intelligence.value?.players ?? [],
    yahooError: toError(yahooStatus.error ?? leagues.error ?? yahooFailure(intelligence.error)),
    fantasyProsError: toError(fantasyProsStatus.error),
    intelligenceError: toError(intelligence.error),
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
