import type { YahooLeagueSettings, YahooRosterPosition } from "../types.js";
import { parseRosterPositions } from "./rosterPositions.js";
import { collectNamedResources, isPlainObject, readBooleanFlag, readNumber, readString } from "./walk.js";

export function parseLeagueSettings(payload: unknown): YahooLeagueSettings {
  const block = extractSettingsBlock(payload);
  const rosterPositions = parseRosterPositions(payload);
  const settings: YahooLeagueSettings = {};

  assignString(settings, "draftType", block.draft_type);
  assignString(settings, "scoringType", block.scoring_type);
  assignString(settings, "waiverType", block.waiver_type);
  assignString(settings, "waiverRule", block.waiver_rule);
  assignString(settings, "waiverTime", block.waiver_time);
  assignString(settings, "tradeEndDate", block.trade_end_date);
  assignString(settings, "tradeRatifyType", block.trade_ratify_type);
  assignNumber(settings, "playoffStartWeek", block.playoff_start_week);
  assignNumber(settings, "numPlayoffTeams", block.num_playoff_teams);
  assignNumber(settings, "faabBudget", block.faab_budget);
  assignBoolean(settings, "usesFaab", block.uses_faab);
  assignBoolean(settings, "usesPlayoff", block.uses_playoff);

  if (rosterPositions.length > 0) {
    settings.rosterPositions = rosterPositions;
  }

  return settings;
}

export function mergeLeagueSettings(
  settings: YahooLeagueSettings,
  rosterPositions: YahooRosterPosition[],
): YahooLeagueSettings {
  if (rosterPositions.length === 0) {
    return settings;
  }
  return { ...settings, rosterPositions };
}

function extractSettingsBlock(payload: unknown): Record<string, unknown> {
  const named = collectNamedResources(payload, "settings");
  for (const candidate of named) {
    if (isPlainObject(candidate) && Object.keys(candidate).length > 0) {
      return candidate;
    }
  }
  if (isPlainObject(payload) && isPlainObject(payload.settings)) {
    return payload.settings;
  }
  return {};
}

function assignString(
  settings: YahooLeagueSettings,
  key: keyof YahooLeagueSettings,
  value: unknown,
): void {
  const text = readString(value);
  if (text !== undefined) {
    (settings as Record<string, unknown>)[key] = text;
  }
}

function assignNumber(
  settings: YahooLeagueSettings,
  key: keyof YahooLeagueSettings,
  value: unknown,
): void {
  const number = readNumber(value);
  if (number !== undefined) {
    (settings as Record<string, unknown>)[key] = number;
  }
}

function assignBoolean(
  settings: YahooLeagueSettings,
  key: keyof YahooLeagueSettings,
  value: unknown,
): void {
  const flag = readBooleanFlag(value);
  if (flag !== undefined) {
    (settings as Record<string, unknown>)[key] = flag;
  }
}
