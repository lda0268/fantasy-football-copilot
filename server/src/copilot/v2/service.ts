import { DEFAULT_DIAGNOSTIC_SCORING } from "../../fantasypros/resources.js";
import { loadPlayerIntelligenceContext } from "../../playerIntelligence/service.js";
import { parseRecommendationLimit } from "../recommendations.js";
import { buildCopilotRecommendationsV2 } from "./recommendations.js";
import type { CopilotV2Recommendations } from "./types.js";

export async function getCopilotRecommendationsV2(limitRaw: unknown): Promise<CopilotV2Recommendations> {
  const limit = parseRecommendationLimit(limitRaw);
  const context = await loadPlayerIntelligenceContext();
  return buildCopilotRecommendationsV2({
    week: context.week,
    scoringFormat: DEFAULT_DIAGNOSTIC_SCORING,
    providerModes: {
      yahoo: context.providers.yahoo.mode,
      fantasyPros: context.providers.fantasyPros.mode,
    },
    roster: context.roster,
    players: context.players,
    reference: {
      weeklyProjections: context.weeklyProjections,
      rosProjections: context.rosProjections,
      weeklyRankings: context.weeklyRankings,
      rosRankings: context.rosRankings,
    },
    limit,
  });
}
