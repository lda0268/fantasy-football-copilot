import type { YahooAvailablePlayer } from "../yahoo/types.js";
import {
  COPILOT_SCORE_WEIGHTS,
  HEALTH_POINTS,
  NEED_POINTS,
} from "./config.js";
import { injuryBand, isCorePosition, playerMatchesPosition, primaryPosition } from "./rosterNeeds.js";
import type { CandidateScoreBreakdown, CopilotPosition, NeedSeverity, RosterNeed } from "./types.js";

const FREE_AGENT_OWNERSHIP = new Set(["fa", "freeagent", "freeagents"]);

export function isFreeAgentOwnership(ownershipType: string | undefined): boolean {
  if (!ownershipType) {
    return false;
  }
  const normalized = ownershipType.trim().toLowerCase().replace(/[\s_-]/g, "");
  return FREE_AGENT_OWNERSHIP.has(normalized);
}

export function isExcludedOwnership(ownershipType: string | undefined): boolean {
  if (!ownershipType) {
    return true;
  }
  const normalized = ownershipType.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (FREE_AGENT_OWNERSHIP.has(normalized)) {
    return false;
  }
  return (
    normalized === "w" ||
    normalized === "waiver" ||
    normalized === "waivers" ||
    normalized === "team" ||
    normalized === "owned" ||
    normalized === "t"
  );
}

export function needSeverityForPlayer(player: YahooAvailablePlayer, needs: RosterNeed[]): NeedSeverity | undefined {
  let best: NeedSeverity | undefined;
  for (const need of needs) {
    if (!playerMatchesPosition(player, need.position)) {
      continue;
    }
    if (!best || rankSeverity(need.severity) > rankSeverity(best)) {
      best = need.severity;
    }
  }
  return best;
}

export function rankSeverity(severity: NeedSeverity): number {
  if (severity === "high") {
    return 3;
  }
  if (severity === "medium") {
    return 2;
  }
  return 1;
}

export function projectionScaleByPosition(
  candidates: YahooAvailablePlayer[],
): Map<string, { min: number; max: number }> {
  const grouped = new Map<string, number[]>();
  for (const player of candidates) {
    if (player.projectedPoints === undefined) {
      continue;
    }
    const position = primaryPosition(player) ?? "UNK";
    const list = grouped.get(position) ?? [];
    list.push(player.projectedPoints);
    grouped.set(position, list);
  }

  const scales = new Map<string, { min: number; max: number }>();
  for (const [position, values] of grouped) {
    scales.set(position, { min: Math.min(...values), max: Math.max(...values) });
  }
  return scales;
}

export function scoreCandidate(
  player: YahooAvailablePlayer,
  options: {
    needs: RosterNeed[];
    currentWeek: number | null;
    projectionScale: Map<string, { min: number; max: number }>;
  },
): { breakdown: CandidateScoreBreakdown; reasons: string[]; cautions: string[] } {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const severity = needSeverityForPlayer(player, options.needs);
  const position = primaryPosition(player);
  const weights = COPILOT_SCORE_WEIGHTS;

  const availability = isFreeAgentOwnership(player.ownershipType) ? weights.availability : 0;
  if (availability > 0) {
    reasons.push("Available as a free agent.");
  }

  const positionNeed = severity ? NEED_POINTS[severity] : NEED_POINTS.none;
  if (severity && position) {
    reasons.push(`Addresses a ${severity} roster need at ${position}.`);
  }

  const projectedPoints = projectionComponent(player, options.projectionScale, weights.projectedPoints, reasons, cautions);
  const percentOwned = percentOwnedComponent(player, weights.percentOwned, reasons, cautions);
  const health = healthComponent(player, weights.health, reasons, cautions);
  const byeWeek = byeComponent(player, options.currentWeek, weights.byeWeek, reasons, cautions);

  const total = roundScore(
    availability + positionNeed + projectedPoints + percentOwned + health + byeWeek,
  );

  return {
    breakdown: {
      availability: roundScore(availability),
      positionNeed: roundScore(positionNeed),
      projectedPoints: roundScore(projectedPoints),
      percentOwned: roundScore(percentOwned),
      health: roundScore(health),
      byeWeek: roundScore(byeWeek),
      total,
    },
    reasons,
    cautions,
  };
}

function projectionComponent(
  player: YahooAvailablePlayer,
  scale: Map<string, { min: number; max: number }>,
  weight: number,
  reasons: string[],
  cautions: string[],
): number {
  if (player.projectedPoints === undefined) {
    cautions.push("Yahoo projection is unavailable, so projection was treated neutrally.");
    return weight / 2;
  }

  const position = primaryPosition(player) ?? "UNK";
  const bounds = scale.get(position);
  if (!bounds || bounds.min === bounds.max) {
    reasons.push(`Projected for ${formatNumber(player.projectedPoints)} points in the available Yahoo data.`);
    return weight / 2;
  }

  const normalized = ((player.projectedPoints - bounds.min) / (bounds.max - bounds.min)) * weight;
  reasons.push(`Projected for ${formatNumber(player.projectedPoints)} points in the available Yahoo data.`);
  return normalized;
}

function percentOwnedComponent(
  player: YahooAvailablePlayer,
  weight: number,
  reasons: string[],
  cautions: string[],
): number {
  if (player.percentOwned === undefined) {
    cautions.push("Yahoo percent owned is unavailable, so popularity was treated neutrally.");
    return weight / 2;
  }
  if (player.percentOwned > 0) {
    reasons.push(`Yahoo percent owned is ${formatNumber(player.percentOwned)}%.`);
  }
  return (player.percentOwned / 100) * weight;
}

function healthComponent(
  player: YahooAvailablePlayer,
  _weight: number,
  reasons: string[],
  cautions: string[],
): number {
  const band = injuryBand(player.status);
  const points = HEALTH_POINTS[band];
  if (band === "healthy") {
    reasons.push("No Yahoo injury designation is present.");
    return points;
  }
  cautions.push(
    `${statusLabel(player)} designation reduces the health component of the score.`,
  );
  return points;
}

function byeComponent(
  player: YahooAvailablePlayer,
  currentWeek: number | null,
  weight: number,
  reasons: string[],
  cautions: string[],
): number {
  if (currentWeek !== null && player.byeWeek === currentWeek) {
    cautions.push(`On a Week ${currentWeek} bye, which reduces usefulness this week.`);
    return 0;
  }
  if (player.byeWeek !== undefined) {
    reasons.push(`Bye week ${player.byeWeek} is not the current week, so bye was not penalized.`);
  }
  return weight;
}

function statusLabel(player: YahooAvailablePlayer): string {
  return player.statusFull ?? player.status ?? "Injury";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function candidatePosition(player: YahooAvailablePlayer): CopilotPosition | undefined {
  return primaryPosition(player) ?? (isCorePosition(player.displayPosition) ? player.displayPosition : undefined);
}
