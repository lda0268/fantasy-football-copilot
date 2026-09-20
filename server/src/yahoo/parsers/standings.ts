import type { YahooStanding } from "../types.js";
import {
  isPlainObject,
  collectNamedResources,
  parseError,
  readName,
  readNumber,
  readString,
} from "./walk.js";

export function parseYahooStandings(payload: unknown): YahooStanding[] {
  const blocks = collectNamedResources(payload, "team");
  if (blocks.length === 0) {
    throw parseError("Yahoo payload contains no standings teams.");
  }

  const standings = blocks.map((block, index) => normalizeStanding(block, index));
  return standings.sort((a, b) => a.rank - b.rank);
}

function normalizeStanding(block: Record<string, unknown>, index: number): YahooStanding {
  const teamKey = readString(block.team_key);
  const teamId = readString(block.team_id);
  const name = readName(block.name);
  const standings = isPlainObject(block.team_standings) ? block.team_standings : {};
  const totals = isPlainObject(standings.outcome_totals) ? standings.outcome_totals : {};

  const rank = readNumber(standings.rank) ?? readNumber(block.rank);
  const wins = readNumber(totals.wins);
  const losses = readNumber(totals.losses);
  const ties = readNumber(totals.ties);

  if (!teamKey) {
    throw parseError(`Yahoo standing at index ${index} is missing team_key.`);
  }
  if (!teamId) {
    throw parseError(`Yahoo standing at index ${index} is missing team_id.`);
  }
  if (!name) {
    throw parseError(`Yahoo standing at index ${index} is missing name.`);
  }
  if (rank === undefined) {
    throw parseError(`Yahoo standing at index ${index} is missing rank.`);
  }
  if (wins === undefined || losses === undefined || ties === undefined) {
    throw parseError(`Yahoo standing at index ${index} is missing W/L/T totals.`);
  }

  const standing: YahooStanding = {
    rank,
    teamKey,
    teamId,
    name,
    wins,
    losses,
    ties,
  };

  const percentage = readNumber(totals.percentage) ?? readNumber(standings.percentage);
  if (percentage !== undefined) {
    standing.percentage = percentage;
  }
  const pointsFor = readNumber(standings.points_for) ?? readNumber(block.points_for);
  if (pointsFor !== undefined) {
    standing.pointsFor = pointsFor;
  }
  const pointsAgainst = readNumber(standings.points_against) ?? readNumber(block.points_against);
  if (pointsAgainst !== undefined) {
    standing.pointsAgainst = pointsAgainst;
  }
  const streak = readStreak(standings.streak ?? block.streak);
  if (streak !== undefined) {
    standing.streak = streak;
  }
  const playoffSeed = readNumber(standings.playoff_seed) ?? readNumber(block.playoff_seed);
  if (playoffSeed !== undefined) {
    standing.playoffSeed = playoffSeed;
  }

  return standing;
}

function readStreak(value: unknown): string | undefined {
  const direct = readString(value);
  if (direct !== undefined) {
    return direct;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  const type = readString(value.type);
  const streakValue = readString(value.value) ?? (readNumber(value.value) !== undefined ? String(readNumber(value.value)) : undefined);
  if (type && streakValue) {
    const letter = type.charAt(0).toUpperCase();
    return `${letter}${streakValue}`;
  }
  return undefined;
}
