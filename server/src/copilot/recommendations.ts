import type { YahooAvailablePlayer, YahooRosterPlayer } from "../yahoo/types.js";
import {
  COPILOT_RECOMMENDATION_DEFAULT_LIMIT,
  COPILOT_RECOMMENDATION_MAX_LIMIT,
} from "./config.js";
import {
  isExcludedOwnership,
  isFreeAgentOwnership,
  needSeverityForPlayer,
  projectionScaleByPosition,
  scoreCandidate,
} from "./candidateScore.js";
import { selectDropCandidateForAdd } from "./drops.js";
import { analyzeRosterNeeds, detectVulnerabilities, primaryPosition } from "./rosterNeeds.js";
import type { CopilotRecommendations, RosterNeed, WaiverRecommendation } from "./types.js";
import { YahooApiError, YahooErrorCode } from "../yahoo/errors.js";

export function parseRecommendationLimit(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") {
    return COPILOT_RECOMMENDATION_DEFAULT_LIMIT;
  }
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw invalidLimit();
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw invalidLimit();
  }
  const limit = Number(text);
  if (limit < 1 || limit > COPILOT_RECOMMENDATION_MAX_LIMIT) {
    throw invalidLimit();
  }
  return limit;
}

function invalidLimit(): YahooApiError {
  return new YahooApiError(
    YahooErrorCode.INVALID_REQUEST,
    `limit must be an integer between 1 and ${COPILOT_RECOMMENDATION_MAX_LIMIT}.`,
    { status: 400 },
  );
}

export function buildCopilotRecommendations(input: {
  week: number | null;
  mode: "fixture" | "live";
  roster: YahooRosterPlayer[];
  freeAgents: YahooAvailablePlayer[];
  limit?: number;
}): CopilotRecommendations {
  const week = input.week;
  const rosterNeeds = analyzeRosterNeeds(input.roster, week);
  const vulnerabilities = detectVulnerabilities(input.roster, week);
  const rosterKeys = new Set(input.roster.map((player) => player.playerKey));
  const rosterNames = new Set(input.roster.map((player) => player.name.trim().toLowerCase()));

  const candidates = input.freeAgents.filter((player) => {
    if (rosterKeys.has(player.playerKey)) {
      return false;
    }
    if (rosterNames.has(player.name.trim().toLowerCase())) {
      return false;
    }
    if (isExcludedOwnership(player.ownershipType) || !isFreeAgentOwnership(player.ownershipType)) {
      return false;
    }
    return needSeverityForPlayer(player, rosterNeeds) !== undefined;
  });

  const projectionScale = projectionScaleByPosition(candidates);
  const scored = candidates.map((player) => {
    const scoredPlayer = scoreCandidate(player, { needs: rosterNeeds, currentWeek: week, projectionScale });
    return { player, ...scoredPlayer };
  });

  scored.sort((a, b) => compareScored(a, b));

  const limit = input.limit ?? COPILOT_RECOMMENDATION_DEFAULT_LIMIT;
  const recommendations: WaiverRecommendation[] = scored.slice(0, limit).map((item, index) => {
    const drop = selectDropCandidate(input.roster, week, item.player, rosterNeeds);
    const recommendation: WaiverRecommendation = {
      rank: index + 1,
      action: drop ? "consider_add_drop" : "consider_add",
      addPlayer: item.player,
      score: item.breakdown.total,
      scoreBreakdown: item.breakdown,
      reasons: item.reasons,
      cautions: item.cautions,
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
    generatedFrom: { week, mode: input.mode },
    rosterNeeds,
    vulnerabilities,
    recommendations,
  };
}

function compareScored(
  a: { player: YahooAvailablePlayer; breakdown: WaiverRecommendation["scoreBreakdown"] },
  b: { player: YahooAvailablePlayer; breakdown: WaiverRecommendation["scoreBreakdown"] },
): number {
  if (b.breakdown.total !== a.breakdown.total) {
    return b.breakdown.total - a.breakdown.total;
  }
  if (b.breakdown.positionNeed !== a.breakdown.positionNeed) {
    return b.breakdown.positionNeed - a.breakdown.positionNeed;
  }
  if (b.breakdown.projectedPoints !== a.breakdown.projectedPoints) {
    return b.breakdown.projectedPoints - a.breakdown.projectedPoints;
  }
  if (b.breakdown.percentOwned !== a.breakdown.percentOwned) {
    return b.breakdown.percentOwned - a.breakdown.percentOwned;
  }
  return a.player.name.localeCompare(b.player.name);
}

function selectDropCandidate(
  roster: YahooRosterPlayer[],
  week: number | null,
  addPlayer: YahooAvailablePlayer,
  needs: RosterNeed[],
): WaiverRecommendation["dropPlayer"] | undefined {
  return selectDropCandidateForAdd(
    roster,
    week,
    primaryPosition(addPlayer),
    needSeverityForPlayer(addPlayer, needs),
  );
}
