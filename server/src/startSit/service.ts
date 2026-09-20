import { DEFAULT_DIAGNOSTIC_SCORING } from "../fantasypros/resources.js";
import { loadPlayerIntelligenceContext } from "../playerIntelligence/service.js";
import { getYahooLeagueSettings } from "../yahoo/season.js";
import { YahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import { buildStartSitRecommendation } from "./engine.js";
import type { StartSitResult } from "./types.js";

export async function getStartSitRecommendation(): Promise<StartSitResult> {
  const [context, settings] = await Promise.all([loadPlayerIntelligenceContext(), getYahooLeagueSettings()]);
  if (settings.rosterPositions.length === 0) {
    throw new YahooApiError(
      YahooErrorCode.PARSE_ERROR,
      "Yahoo lineup slot configuration is unavailable for Start/Sit.",
      { status: 502 },
    );
  }
  return buildStartSitRecommendation({
    week: context.week,
    scoringFormat: DEFAULT_DIAGNOSTIC_SCORING,
    providerModes: {
      yahoo: context.providers.yahoo.mode,
      fantasyPros: context.providers.fantasyPros.mode,
    },
    lineupSource: settings.source,
    rosterPositions: settings.rosterPositions,
    roster: context.roster,
    players: context.players,
    reference: {
      weeklyProjections: context.weeklyProjections,
      weeklyRankings: context.weeklyRankings,
    },
  });
}
