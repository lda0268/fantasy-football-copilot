import { invalidRequest } from "./errors.js";
import type { FantasyProsRankingType, FantasyProsScoring } from "./types.js";

export const FP_SPORT = "nfl";
export const FP_ALL_POSITIONS = "QB:RB:WR:TE:K:DST";
export const DEFAULT_DIAGNOSTIC_SCORING: FantasyProsScoring = "half_ppr";

export const SCORING_TO_PROVIDER: Record<FantasyProsScoring, "STD" | "HALF" | "PPR"> = {
  standard: "STD",
  half_ppr: "HALF",
  ppr: "PPR",
};

export function providerScoring(scoring: FantasyProsScoring): "STD" | "HALF" | "PPR" {
  return SCORING_TO_PROVIDER[scoring];
}

export function parseScoring(value: unknown): FantasyProsScoring {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") {
    return DEFAULT_DIAGNOSTIC_SCORING;
  }
  if (typeof raw !== "string") {
    throw invalidRequest("scoring must be standard, half_ppr, or ppr.");
  }
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "std" || normalized === "standard") {
    return "standard";
  }
  if (normalized === "half" || normalized === "half_ppr" || normalized === "halfppr") {
    return "half_ppr";
  }
  if (normalized === "ppr") {
    return "ppr";
  }
  throw invalidRequest("scoring must be standard, half_ppr, or ppr.");
}

export function assertSeason(season: number): number {
  if (!Number.isInteger(season) || season < 2012 || season > 2100) {
    throw invalidRequest("season is invalid.");
  }
  return season;
}

export function playersResource(): string {
  return `${FP_SPORT}/players`;
}

export function playersQuery(): Record<string, string> {
  return { external_ids: "yahoo:espn:nfl" };
}

export function projectionsResource(season: number): string {
  return `${FP_SPORT}/${assertSeason(season)}/projections`;
}

export function weeklyProjectionsQuery(week: number, scoring: FantasyProsScoring): Record<string, string> {
  return {
    week: String(week),
    scoring: providerScoring(scoring),
    positions: FP_ALL_POSITIONS,
  };
}

export function rosProjectionsQuery(scoring: FantasyProsScoring): Record<string, string> {
  return {
    ros: "true",
    scoring: providerScoring(scoring),
    positions: FP_ALL_POSITIONS,
  };
}

export function consensusRankingsResource(season: number): string {
  return `${FP_SPORT}/${assertSeason(season)}/consensus-rankings`;
}

export function rankingsQuery(
  scoring: FantasyProsScoring,
  rankingType: FantasyProsRankingType,
  week?: number,
): Record<string, string> {
  const query: Record<string, string> = {
    position: "ALL",
    scoring: providerScoring(scoring),
  };
  if (rankingType === "ros") {
    query.type = "ROS";
  } else if (week !== undefined) {
    query.week = String(week);
  }
  return query;
}

export function injuriesResource(): string {
  return `${FP_SPORT}/injuries`;
}

export function injuriesQuery(season: number, week?: number): Record<string, string> {
  const query: Record<string, string> = { year: String(assertSeason(season)) };
  if (week !== undefined) {
    query.week = String(week);
  }
  return query;
}
