import type { PlayerIntelligence } from "../../playerIntelligence/types.js";
import type { YahooRosterPlayer } from "../../yahoo/types.js";
import { COPILOT_RECOMMENDATION_DEFAULT_LIMIT } from "../config.js";
import { selectDropCandidateForAdd } from "../drops.js";
import { analyzeRosterNeeds, detectVulnerabilities } from "../rosterNeeds.js";
import { parseRecommendationLimit } from "../recommendations.js";
import { V2_ELIGIBLE_AVAILABILITY } from "./config.js";
import {
  buildPositionReferencePools,
  summarizeReferencePopulations,
  type CopilotV2ReferenceDatasets,
} from "./referencePopulation.js";
import { intelligencePosition, needSeverityForIntelligence, scoreIntelligenceCandidate, supportRank } from "./score.js";
import type { CopilotV2Recommendation, CopilotV2Recommendations } from "./types.js";

const ELIGIBLE = new Set<string>(V2_ELIGIBLE_AVAILABILITY);
const LIMITED_SUPPORT_WARNING =
  "Limited recommendation support: weekly and rest-of-season intelligence are unavailable.";

export { parseRecommendationLimit };

export function isEligibleAdd(player: PlayerIntelligence): boolean {
  return ELIGIBLE.has(player.leagueState.availability);
}

export function buildCopilotRecommendationsV2(input: {
  week: number | null;
  scoringFormat: string;
  providerModes: CopilotV2Recommendations["context"]["providerModes"];
  roster: YahooRosterPlayer[];
  players: PlayerIntelligence[];
  reference?: CopilotV2ReferenceDatasets;
  limit?: number;
}): CopilotV2Recommendations {
  const rosterNeeds = analyzeRosterNeeds(input.roster, input.week);
  const vulnerabilities = detectVulnerabilities(input.roster, input.week);
  let excludedUnmatched = 0;
  let excludedAmbiguous = 0;
  let excludedUnavailable = 0;

  const eligible: PlayerIntelligence[] = [];
  for (const player of input.players) {
    if (!isEligibleAdd(player)) {
      excludedUnavailable += 1;
      continue;
    }
    if (player.identity.status === "ambiguous") {
      excludedAmbiguous += 1;
      continue;
    }
    if (player.identity.status !== "matched") {
      excludedUnmatched += 1;
      continue;
    }
    if (!intelligencePosition(player)) {
      continue;
    }
    eligible.push(player);
  }

  const pools = buildPositionReferencePools(input.reference ?? {});
  const scored = eligible.map((player) => {
    const result = scoreIntelligenceCandidate(player, {
      needs: rosterNeeds,
      roster: input.roster,
      week: input.week,
      pools,
    });
    return { player, ...result };
  });

  scored.sort(compareV2);

  const limit = input.limit ?? COPILOT_RECOMMENDATION_DEFAULT_LIMIT;
  const recommendations: CopilotV2Recommendation[] = scored.slice(0, limit).map((item, index) => {
    const drop = selectDropCandidateForAdd(
      input.roster,
      input.week,
      intelligencePosition(item.player),
      needSeverityForIntelligence(item.player, rosterNeeds),
    );
    const warnings = [...item.player.warnings];
    if (item.dataQuality === "limited" && !warnings.includes(LIMITED_SUPPORT_WARNING)) {
      warnings.push(LIMITED_SUPPORT_WARNING);
    }
    const recommendation: CopilotV2Recommendation = {
      rank: index + 1,
      action: drop ? "consider_add_drop" : "consider_add",
      player: item.player,
      score: item.score,
      rawScore: item.rawScore,
      availableMax: item.availableMax,
      components: item.components,
      dataQuality: item.dataQuality,
      reasons: item.reasons,
      warnings,
    };
    if (drop) {
      recommendation.dropPlayer = drop;
      recommendation.reasons = [
        ...recommendation.reasons,
        `Paired with bench player ${drop.name} because ${drop.displayPosition ?? "that position"} has surplus usable depth.`,
      ];
    }
    return recommendation;
  });

  return {
    context: {
      week: input.week,
      scoringFormat: input.scoringFormat,
      providerModes: input.providerModes,
      referencePopulations: summarizeReferencePopulations(pools),
    },
    summary: {
      candidatesConsidered: input.players.length,
      eligible: eligible.length,
      excludedUnmatched,
      excludedAmbiguous,
      excludedUnavailable,
      recommendationsReturned: recommendations.length,
    },
    rosterNeeds,
    vulnerabilities,
    recommendations,
  };
}

function compareV2(
  a: {
    player: PlayerIntelligence;
    score: number;
    dataQuality: CopilotV2Recommendation["dataQuality"];
    components: CopilotV2Recommendation["components"];
  },
  b: {
    player: PlayerIntelligence;
    score: number;
    dataQuality: CopilotV2Recommendation["dataQuality"];
    components: CopilotV2Recommendation["components"];
  },
): number {
  const supportDiff = supportRank(b.dataQuality) - supportRank(a.dataQuality);
  if (supportDiff !== 0) {
    return supportDiff;
  }
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (b.components.restOfSeason.score !== a.components.restOfSeason.score) {
    return b.components.restOfSeason.score - a.components.restOfSeason.score;
  }
  if (b.components.rosterNeed.score !== a.components.rosterNeed.score) {
    return b.components.rosterNeed.score - a.components.rosterNeed.score;
  }
  if (b.components.weeklyValue.score !== a.components.weeklyValue.score) {
    return b.components.weeklyValue.score - a.components.weeklyValue.score;
  }
  const nameCmp = a.player.player.name.localeCompare(b.player.player.name);
  if (nameCmp !== 0) {
    return nameCmp;
  }
  return a.player.identity.yahooPlayerKey.localeCompare(b.player.identity.yahooPlayerKey);
}
