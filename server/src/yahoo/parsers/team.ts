import type { YahooTeam } from "../types.js";
import { collectNamedResources, isPlainObject, parseError, readNumber, readString } from "./walk.js";

export function parseYahooTeams(payload: unknown): YahooTeam[] {
  const blocks = collectNamedResources(payload, "team");
  return blocks.map((block, index) => normalizeTeam(block, index));
}

export function parseYahooTeam(payload: unknown): YahooTeam {
  const teams = parseYahooTeams(payload);
  if (teams.length === 0) {
    throw parseError("Yahoo payload contains no team.");
  }
  return teams[0];
}

export function leagueKeyFromTeamKey(teamKey: string): string | undefined {
  const match = teamKey.trim().match(/^(\d+\.l\.\d+)\.t\.\d+$/);
  return match?.[1];
}

function normalizeTeam(block: Record<string, unknown>, index: number): YahooTeam {
  const teamKey = readString(block.team_key);
  const teamId = readString(block.team_id);
  const name = readTeamName(block.name);
  if (!teamKey) {
    throw parseError(`Yahoo team at index ${index} is missing team_key.`);
  }
  if (!teamId) {
    throw parseError(`Yahoo team at index ${index} is missing team_id.`);
  }
  if (!name) {
    throw parseError(`Yahoo team at index ${index} is missing name.`);
  }

  const leagueKey = readString(block.league_key) ?? leagueKeyFromTeamKey(teamKey);
  if (!leagueKey) {
    throw parseError(`Yahoo team at index ${index} is missing leagueKey and team_key is not derivable.`);
  }

  const team: YahooTeam = {
    teamKey,
    teamId,
    name,
    leagueKey,
  };

  const url = readString(block.url);
  if (url !== undefined) {
    team.url = url;
  }
  const logoUrl = readTeamLogoUrl(block.team_logos);
  if (logoUrl !== undefined) {
    team.logoUrl = logoUrl;
  }
  const numberOfMoves = readNumber(block.number_of_moves);
  if (numberOfMoves !== undefined) {
    team.numberOfMoves = numberOfMoves;
  }
  const numberOfTrades = readNumber(block.number_of_trades);
  if (numberOfTrades !== undefined) {
    team.numberOfTrades = numberOfTrades;
  }

  return team;
}

function readTeamName(value: unknown): string | undefined {
  const direct = readString(value);
  if (direct !== undefined) {
    return direct;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  return readString(value.full) ?? readString(value.name) ?? readString(value.team);
}

function readTeamLogoUrl(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const candidates: unknown[] = [value];
  if (isPlainObject(value)) {
    candidates.push(value.team_logo);
    candidates.push(...Object.values(value));
  }
  if (Array.isArray(value)) {
    candidates.push(...value);
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const url = readString(candidate);
      if (url !== undefined) {
        return url;
      }
    }
    if (isPlainObject(candidate)) {
      const nested =
        readString(candidate.url) ??
        (isPlainObject(candidate.team_logo) ? readString(candidate.team_logo.url) : undefined);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
}
