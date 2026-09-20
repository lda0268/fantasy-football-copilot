import type { PlayerIntelligence } from "../../playerIntelligence/types.js";
import type { YahooRosterPlayer } from "../../yahoo/types.js";
import { rankSeverity } from "../candidateScore.js";
import { isCorePosition, playersAtPosition } from "../rosterNeeds.js";
import type { CopilotPosition, NeedSeverity, RosterNeed } from "../types.js";
import { V2_ECR_SHARE, V2_HEALTH_POINTS, V2_NEED_POINTS, V2_PROJECTION_SHARE, V2_SCORE_WEIGHTS } from "./config.js";
import { referencePercentile, type PositionSignalPool } from "./referencePopulation.js";
import type {
  CopilotV2Component,
  CopilotV2Components,
  CopilotV2DataQuality,
  CopilotV2HealthBand,
} from "./types.js";

export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

export function intelligencePosition(player: PlayerIntelligence): CopilotPosition | undefined {
  return isCorePosition(player.player.position) ? player.player.position : undefined;
}

export function needSeverityForIntelligence(
  player: PlayerIntelligence,
  needs: RosterNeed[],
): NeedSeverity | undefined {
  const position = intelligencePosition(player);
  if (!position) {
    return undefined;
  }
  let best: NeedSeverity | undefined;
  for (const need of needs) {
    if (need.position !== position) {
      continue;
    }
    if (!best || rankSeverity(need.severity) > rankSeverity(best)) {
      best = need.severity;
    }
  }
  return best;
}

export function fantasyProsHealthBand(status: string | undefined): CopilotV2HealthBand {
  if (status === undefined || status.trim() === "") {
    return "unknown";
  }
  const value = status.trim().toUpperCase();
  if (value === "IR" || value === "IR-R" || value.includes("INJURED RESERVE")) {
    return "ir";
  }
  if (value === "O" || value === "OUT") {
    return "out";
  }
  if (value === "D" || value === "DOUBTFUL") {
    return "doubtful";
  }
  if (value === "Q" || value === "QUESTIONABLE") {
    return "questionable";
  }
  if (value === "SUSPENDED" || value === "SUSP" || value === "SUS") {
    return "suspended";
  }
  if (value === "HEALTHY" || value === "ACTIVE" || value === "A") {
    return "healthy";
  }
  return "unknown";
}

export function hasWeeklySignal(player: PlayerIntelligence): boolean {
  return player.weekly?.projectedPoints !== undefined || player.weekly?.ecr !== undefined;
}

export function hasRosSignal(player: PlayerIntelligence): boolean {
  return player.restOfSeason?.projectedPoints !== undefined || player.restOfSeason?.ecr !== undefined;
}

export function classifyDataQuality(player: PlayerIntelligence): CopilotV2DataQuality {
  const weekly = hasWeeklySignal(player);
  const ros = hasRosSignal(player);
  if (weekly && ros) {
    return "strongly_supported";
  }
  if (weekly || ros) {
    return "supported";
  }
  return "limited";
}

export function supportRank(quality: CopilotV2DataQuality): number {
  if (quality === "strongly_supported") {
    return 3;
  }
  if (quality === "supported") {
    return 2;
  }
  return 1;
}

export function combineProjectionAndEcr(projectionNorm: number | undefined, ecrNorm: number | undefined): {
  combined: number | undefined;
  usedProjection: boolean;
  usedEcr: boolean;
} {
  if (projectionNorm !== undefined && ecrNorm !== undefined) {
    return {
      combined: V2_PROJECTION_SHARE * projectionNorm + V2_ECR_SHARE * ecrNorm,
      usedProjection: true,
      usedEcr: true,
    };
  }
  if (projectionNorm !== undefined) {
    return { combined: projectionNorm, usedProjection: true, usedEcr: false };
  }
  if (ecrNorm !== undefined) {
    return { combined: ecrNorm, usedProjection: false, usedEcr: true };
  }
  return { combined: undefined, usedProjection: false, usedEcr: false };
}

export function scoreRosterNeed(player: PlayerIntelligence, needs: RosterNeed[]): CopilotV2Component {
  const max = V2_SCORE_WEIGHTS.rosterNeed;
  const position = intelligencePosition(player);
  const severity = needSeverityForIntelligence(player, needs);
  const score = severity ? V2_NEED_POINTS[severity] : V2_NEED_POINTS.none;
  const reasons: string[] = [];
  if (severity === "high") {
    reasons.push(`${position} depth is a current roster need.`);
  } else if (severity === "medium") {
    reasons.push(`${position} depth is a moderate roster need.`);
  } else if (severity === "low") {
    reasons.push(`${position} depth is a mild roster need.`);
  } else {
    reasons.push(`${position ?? "This position"} is not a documented roster need.`);
  }
  return { score, max, available: true, reasons };
}

export function scoreValueComponent(
  player: PlayerIntelligence,
  pools: Map<CopilotPosition, PositionSignalPool>,
  kind: "weekly" | "ros",
): CopilotV2Component {
  const max = kind === "weekly" ? V2_SCORE_WEIGHTS.weeklyValue : V2_SCORE_WEIGHTS.restOfSeason;
  const position = intelligencePosition(player);
  const pool = position ? pools.get(position) : undefined;
  const projection = kind === "weekly" ? player.weekly?.projectedPoints : player.restOfSeason?.projectedPoints;
  const ecr = kind === "weekly" ? player.weekly?.ecr : player.restOfSeason?.ecr;
  const projectionValues = kind === "weekly" ? pool?.weeklyProjection ?? [] : pool?.rosProjection ?? [];
  const ecrValues = kind === "weekly" ? pool?.weeklyEcr ?? [] : pool?.rosEcr ?? [];
  const projectionNorm =
    projection !== undefined ? referencePercentile(projectionValues, projection, true) : undefined;
  const ecrNorm = ecr !== undefined ? referencePercentile(ecrValues, ecr, false) : undefined;
  const combined = combineProjectionAndEcr(projectionNorm, ecrNorm);
  const reasons: string[] = [];
  const horizon = kind === "weekly" ? "weekly" : "rest-of-season";
  const positionLabel = position ?? "this position";
  const referenceSize = combined.usedProjection && combined.usedEcr
    ? Math.min(projectionValues.length, ecrValues.length)
    : combined.usedProjection
      ? projectionValues.length
      : combined.usedEcr
        ? ecrValues.length
        : 0;

  if (combined.combined === undefined) {
    if (projection === undefined) {
      reasons.push(
        kind === "weekly"
          ? "Weekly projection unavailable; not treated as zero projected points."
          : "Rest-of-season projection unavailable; not treated as zero projected points.",
      );
    } else if (projectionNorm === undefined) {
      reasons.push(
        kind === "weekly"
          ? `No FantasyPros ${positionLabel} weekly-projection reference population; weekly projection not scored.`
          : `No FantasyPros ${positionLabel} rest-of-season projection reference population; ROS projection not scored.`,
      );
    }
    if (ecr === undefined) {
      reasons.push(kind === "weekly" ? "Weekly ECR unavailable." : "Rest-of-season ECR unavailable.");
    } else if (ecrNorm === undefined) {
      reasons.push(
        kind === "weekly"
          ? `No FantasyPros ${positionLabel} weekly ECR reference population; weekly ECR not scored.`
          : `No FantasyPros ${positionLabel} rest-of-season ECR reference population; ROS ECR not scored.`,
      );
    }
    return { score: 0, max, available: false, reasons };
  }

  if (combined.usedProjection && combined.usedEcr) {
    reasons.push(
      kind === "weekly"
        ? `Projects at the ${pctLabel(combined.combined)} percentile of FantasyPros ${positionLabel}s for the current week (projection + weekly ECR).`
        : `Ranks at the ${pctLabel(combined.combined)} percentile of FantasyPros ${positionLabel}s for the rest of the season (projection + ROS ECR).`,
    );
  } else if (combined.usedProjection) {
    reasons.push(
      kind === "weekly"
        ? `Projects at the ${pctLabel(combined.combined)} percentile of FantasyPros ${positionLabel} weekly projections.`
        : `Projects at the ${pctLabel(combined.combined)} percentile of FantasyPros ${positionLabel} rest-of-season projections.`,
    );
    reasons.push(
      kind === "weekly"
        ? "Weekly ECR unavailable; weekly value uses projection only."
        : "ROS ECR unavailable; ROS value uses projection only.",
    );
  } else {
    reasons.push(
      kind === "weekly"
        ? `Ranks at the ${pctLabel(combined.combined)} percentile of FantasyPros ${positionLabel} weekly ECR.`
        : `Ranks at the ${pctLabel(combined.combined)} percentile of FantasyPros ${positionLabel} rest-of-season ECR.`,
    );
    reasons.push(
      kind === "weekly"
        ? "Weekly projection unavailable; weekly value uses ECR only."
        : "ROS projection unavailable; ROS value uses ECR only.",
    );
  }

  if (projection === 0) {
    reasons.push(`${horizon === "weekly" ? "Weekly" : "Rest-of-season"} projection is explicitly 0.`);
  }

  return {
    score: roundScore(combined.combined * max),
    max,
    available: true,
    reasons,
    normalized: roundScore(combined.combined * 1000) / 1000,
    referenceSize,
  };
}

function pctLabel(normalized: number): string {
  return String(Math.round(normalized * 100));
}

export function scoreHealthRisk(player: PlayerIntelligence): CopilotV2Component {
  const max = V2_SCORE_WEIGHTS.healthRisk;
  const reasons: string[] = [];
  if (player.injury === undefined) {
    reasons.push("No FantasyPros injury record; not treated as healthy. Health/risk is not scored as positive availability evidence.");
    return { score: 0, max, available: false, reasons };
  }
  const band = fantasyProsHealthBand(player.injury.status);
  if (band === "unknown") {
    reasons.push(
      player.injury.status
        ? `FantasyPros injury status "${player.injury.status}" is not mapped; health/risk is not scored as positive evidence.`
        : "FantasyPros injury record has no status; health/risk is not scored as positive availability evidence.",
    );
    return { score: 0, max, available: false, reasons };
  }
  if (band === "healthy") {
    reasons.push("FantasyPros lists this player as healthy.");
  } else if (band === "questionable") {
    reasons.push("Currently listed as questionable.");
  } else if (band === "doubtful") {
    reasons.push("Currently listed as doubtful.");
  } else if (band === "out") {
    reasons.push("Currently listed as out.");
  } else if (band === "ir") {
    reasons.push("Currently listed as injured reserve.");
  } else {
    reasons.push("Currently listed as suspended.");
  }
  return { score: V2_HEALTH_POINTS[band], max, available: true, reasons };
}

export function scoreRosterFit(
  player: PlayerIntelligence,
  roster: YahooRosterPlayer[],
  week: number | null,
): CopilotV2Component {
  const max = V2_SCORE_WEIGHTS.rosterFit;
  const reasons: string[] = [];
  const byeWeek = player.leagueState.byeWeek;
  if (byeWeek === undefined) {
    reasons.push("Bye week unavailable; roster-fit is not scored as positive evidence and is not a penalty.");
    return { score: 0, max, available: false, reasons };
  }
  if (week !== null && byeWeek === week) {
    reasons.push(`On bye in week ${week}.`);
    return { score: 3, max, available: true, reasons };
  }
  const position = intelligencePosition(player);
  if (position) {
    const sameBye = playersAtPosition(roster, position).filter((item) => item.byeWeek === byeWeek).length;
    if (sameBye >= 2) {
      reasons.push(`Shares bye week ${byeWeek} with existing ${position} depth.`);
      return { score: 6, max, available: true, reasons };
    }
  }
  reasons.push(`Bye week ${byeWeek} does not create an obvious roster conflict.`);
  return { score: max, max, available: true, reasons };
}

export function availableMaxFor(components: CopilotV2Components): number {
  return (
    (components.rosterNeed.available ? components.rosterNeed.max : 0) +
    (components.restOfSeason.available ? components.restOfSeason.max : 0) +
    (components.weeklyValue.available ? components.weeklyValue.max : 0) +
    (components.healthRisk.available ? components.healthRisk.max : 0) +
    (components.rosterFit.available ? components.rosterFit.max : 0)
  );
}

export function scoreIntelligenceCandidate(
  player: PlayerIntelligence,
  input: {
    needs: RosterNeed[];
    roster: YahooRosterPlayer[];
    week: number | null;
    pools: Map<CopilotPosition, PositionSignalPool>;
  },
): {
  components: CopilotV2Components;
  score: number;
  rawScore: number;
  availableMax: number;
  dataQuality: CopilotV2DataQuality;
  reasons: string[];
} {
  const components: CopilotV2Components = {
    rosterNeed: scoreRosterNeed(player, input.needs),
    restOfSeason: scoreValueComponent(player, input.pools, "ros"),
    weeklyValue: scoreValueComponent(player, input.pools, "weekly"),
    healthRisk: scoreHealthRisk(player),
    rosterFit: scoreRosterFit(player, input.roster, input.week),
  };
  const rawTotal =
    components.rosterNeed.score +
    components.restOfSeason.score +
    components.weeklyValue.score +
    components.healthRisk.score +
    components.rosterFit.score;
  const rawScore = Math.min(100, roundScore(rawTotal));
  const dataQuality = classifyDataQuality(player);
  const reasons = [
    ...components.rosterNeed.reasons.slice(0, 1),
    ...components.restOfSeason.reasons.slice(0, 1),
    ...components.weeklyValue.reasons.slice(0, 1),
    ...components.healthRisk.reasons.slice(0, 1),
    ...components.rosterFit.reasons.slice(0, 1),
  ];
  if (dataQuality === "limited") {
    reasons.push("Limited recommendation support: weekly and rest-of-season intelligence are unavailable.");
  }
  return {
    components,
    score: rawScore,
    rawScore,
    availableMax: availableMaxFor(components),
    dataQuality,
    reasons,
  };
}
