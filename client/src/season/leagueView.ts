import type { YahooLeagueSettings, YahooRosterPosition } from "../api/types";

const FLEX_POSITIONS = new Set(["W/R/T", "W/R", "W/T", "Q/W/R/T"]);

const SCORING_TYPE_LABELS: Record<string, string> = {
  head: "Head-to-head",
  h2h: "Head-to-head",
  point: "Points",
  points: "Points",
};

const WAIVER_TYPE_LABELS: Record<string, string> = {
  R: "Rolling list",
  F: "FAAB",
  C: "Continual rolling list",
};

export function lineupSlotLabel(position: string): string {
  return FLEX_POSITIONS.has(position) ? "FLEX" : position;
}

export function formatLineupSlots(positions: YahooRosterPosition[] | undefined): string[] {
  return (positions ?? []).map((row) => `${lineupSlotLabel(row.position)} ×${row.count}`);
}

export function formatScoringType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return SCORING_TYPE_LABELS[value] ?? value;
}

export function formatWaiverType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return WAIVER_TYPE_LABELS[value] ?? value;
}

export function formatDraftStatus(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.replace(/_/g, " ");
}

export function formatWinPercentage(value: number | undefined): { text: string; missing: boolean } {
  if (value === undefined) {
    return { text: "—", missing: true };
  }
  if (value === 0) {
    return { text: "0", missing: false };
  }
  if (value <= 1) {
    return { text: value.toFixed(3), missing: false };
  }
  return { text: String(value), missing: false };
}

export function hasAnySettings(settings: YahooLeagueSettings): boolean {
  return Boolean(
    settings.draftType ||
      settings.scoringType ||
      settings.waiverType ||
      settings.waiverRule ||
      settings.waiverTime ||
      settings.usesFaab !== undefined ||
      settings.faabBudget !== undefined ||
      settings.tradeEndDate ||
      settings.tradeRatifyType ||
      settings.usesPlayoff !== undefined ||
      settings.playoffStartWeek !== undefined ||
      settings.numPlayoffTeams !== undefined ||
      (settings.rosterPositions && settings.rosterPositions.length > 0),
  );
}
