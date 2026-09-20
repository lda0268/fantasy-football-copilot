import type { CopilotPosition } from "../copilot/types.js";
import { combineProjectionAndEcr } from "../copilot/v2/score.js";
import { referencePercentile, type PositionSignalPool } from "../copilot/v2/referencePopulation.js";
import {
  DOUBTFUL_VALUE_MULTIPLIER,
  QUESTIONABLE_VALUE_MULTIPLIER,
  START_SIT_FLEX_ECR_SHARE,
  START_SIT_FLEX_PROJECTION_SHARE,
  isMultiPositionSlot,
} from "./eligibility.js";
import type { StartSitDataQuality, StartSitHealthBand } from "./types.js";

export function classifyWeeklySupport(weekly?: { projectedPoints?: number; ecr?: number }): StartSitDataQuality {
  const hasProj = weekly?.projectedPoints !== undefined;
  const hasEcr = weekly?.ecr !== undefined;
  if (hasProj && hasEcr) {
    return "strongly_supported";
  }
  if (hasProj || hasEcr) {
    return "supported";
  }
  return "limited";
}

export function hasUsableWeeklyIntelligence(quality: StartSitDataQuality): boolean {
  return quality !== "limited";
}

export function healthMultiplier(band: StartSitHealthBand): number {
  if (band === "questionable") {
    return QUESTIONABLE_VALUE_MULTIPLIER;
  }
  if (band === "doubtful") {
    return DOUBTFUL_VALUE_MULTIPLIER;
  }
  return 1;
}

export function weeklyValueForSlot(input: {
  slot: string;
  position?: string;
  weekly?: { projectedPoints?: number; ecr?: number };
  healthBand: StartSitHealthBand;
  pools: Map<CopilotPosition, PositionSignalPool>;
  crossProjectionPool: number[];
}): {
  value?: number;
  projectionNorm?: number;
  ecrNorm?: number;
  usedProjection: boolean;
  usedEcr: boolean;
  reasons: string[];
} {
  const weekly = input.weekly;
  const position = (input.position as CopilotPosition | undefined) ?? undefined;
  const pool = position ? input.pools.get(position) : undefined;
  const projection = weekly?.projectedPoints;
  const ecr = weekly?.ecr;
  const flex = isMultiPositionSlot(input.slot);
  const projectionNorm =
    projection === undefined
      ? undefined
      : flex
        ? referencePercentile(input.crossProjectionPool, projection, true)
        : pool
          ? referencePercentile(pool.weeklyProjection, projection, true)
          : undefined;
  const ecrNorm =
    ecr === undefined || !pool ? undefined : referencePercentile(pool.weeklyEcr, ecr, false);

  const combined = flex
    ? combineFlex(projectionNorm, ecrNorm)
    : combineProjectionAndEcr(projectionNorm, ecrNorm);

  const reasons: string[] = [];
  if (projection === undefined) {
    reasons.push("Weekly projection unavailable; not treated as zero.");
  } else if (projection === 0) {
    reasons.push("Weekly projection is explicitly 0.");
  }
  if (ecr === undefined) {
    reasons.push("Weekly ECR unavailable; not treated as worst rank.");
  }
  if (combined.combined === undefined) {
    return { usedProjection: combined.usedProjection, usedEcr: combined.usedEcr, reasons };
  }

  const adjusted = round4(combined.combined * healthMultiplier(input.healthBand));
  if (input.healthBand === "questionable") {
    reasons.push("Questionable status reduces weekly lineup value by 10%.");
  } else if (input.healthBand === "doubtful") {
    reasons.push("Doubtful status reduces weekly lineup value by 30%.");
  }
  if (flex && combined.usedProjection) {
    reasons.push("FLEX value uses cross-position weekly projection, not a position-only percentile.");
  }
  return {
    value: adjusted,
    projectionNorm: combined.usedProjection ? projectionNorm : undefined,
    ecrNorm: combined.usedEcr ? ecrNorm : undefined,
    usedProjection: combined.usedProjection,
    usedEcr: combined.usedEcr,
    reasons,
  };
}

function combineFlex(projectionNorm: number | undefined, ecrNorm: number | undefined) {
  if (projectionNorm !== undefined && ecrNorm !== undefined) {
    return {
      combined: START_SIT_FLEX_PROJECTION_SHARE * projectionNorm + START_SIT_FLEX_ECR_SHARE * ecrNorm,
      usedProjection: true,
      usedEcr: true,
    };
  }
  return combineProjectionAndEcr(projectionNorm, ecrNorm);
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function crossPositionProjectionPool(pools: Map<CopilotPosition, PositionSignalPool>): number[] {
  const values: number[] = [];
  for (const pool of pools.values()) {
    values.push(...pool.weeklyProjection);
  }
  return values;
}
