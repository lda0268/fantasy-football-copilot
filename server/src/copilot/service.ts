import { PLAYER_PAGE_MAX_COUNT } from "../yahoo/resources.js";
import { getYahooFreeAgents, getYahooRoster, getYahooStatus } from "../yahoo/season.js";
import { parseRecommendationLimit, buildCopilotRecommendations } from "./recommendations.js";
import type { CopilotRecommendations } from "./types.js";

export async function getCopilotRecommendations(limitRaw: unknown): Promise<CopilotRecommendations> {
  const limit = parseRecommendationLimit(limitRaw);
  const [status, roster, freeAgents] = await Promise.all([
    getYahooStatus(),
    getYahooRoster(),
    getYahooFreeAgents({ start: 0, count: PLAYER_PAGE_MAX_COUNT }),
  ]);

  return buildCopilotRecommendations({
    week: roster.week ?? freeAgents.league.currentWeek ?? null,
    mode: status.mode,
    roster: roster.players,
    freeAgents: freeAgents.players,
    limit,
  });
}
