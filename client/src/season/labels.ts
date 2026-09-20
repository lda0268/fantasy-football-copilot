import type { DataQuality, LeagueAvailability } from "../api/types";

export const SUPPORT_LABELS: Record<DataQuality, string> = {
  strongly_supported: "Strong support",
  supported: "Supported",
  limited: "Limited data",
};

export const AVAILABILITY_LABELS: Record<LeagueAvailability, string> = {
  rostered_by_user: "On roster",
  rostered_by_other: "Rostered",
  free_agent: "Free agent",
  waivers: "Waivers",
  unknown: "Unknown",
};

export const NEED_SEVERITY_LABELS: Record<"low" | "medium" | "high", string> = {
  high: "High Need",
  medium: "Moderate Need",
  low: "Low Need",
};

export const IDENTITY_LABELS: Record<string, string> = {
  matched: "Enriched",
  unresolved: "Intelligence unavailable",
  ambiguous: "Identity needs review",
};

export const IDENTITY_METHOD_LABELS: Record<string, string> = {
  external_id: "Yahoo ID match",
  name_team_position: "Name, team, and position",
  name_team: "Name and team",
  none: "None",
};

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatOptionalNumber(value: number | undefined): { text: string; missing: boolean } {
  if (value === undefined) {
    return { text: "Unavailable", missing: true };
  }
  return { text: Number.isInteger(value) ? String(value) : value.toFixed(1), missing: false };
}

export function formatTableNumber(value: number | undefined): { text: string; missing: boolean } {
  if (value === undefined) {
    return { text: "—", missing: true };
  }
  return { text: Number.isInteger(value) ? String(value) : value.toFixed(1), missing: false };
}

export function formatRecord(wins?: number, losses?: number, ties?: number): string | undefined {
  if (wins === undefined || losses === undefined) {
    return undefined;
  }
  if (ties && ties > 0) {
    return `${wins}-${losses}-${ties}`;
  }
  return `${wins}-${losses}`;
}
