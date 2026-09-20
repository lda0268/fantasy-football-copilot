import type { YahooLeague } from "../types.js";
import { parseRosterPositions } from "./rosterPositions.js";
import { collectNamedResources, parseError, readNumber, readString } from "./walk.js";

export function parseYahooLeagues(payload: unknown): YahooLeague[] {
  const blocks = collectNamedResources(payload, "league");
  return blocks.map((block, index) => normalizeLeague(block, index));
}

function normalizeLeague(block: Record<string, unknown>, index: number): YahooLeague {
  const leagueKey = readString(block.league_key);
  const leagueId = readString(block.league_id);
  if (!leagueKey) {
    throw parseError(`Yahoo league at index ${index} is missing league_key.`);
  }
  if (!leagueId) {
    throw parseError(`Yahoo league at index ${index} is missing league_id.`);
  }

  const league: YahooLeague = {
    leagueKey,
    leagueId,
    name: readString(block.name) ?? "",
    season: readString(block.season) ?? "",
  };

  const numTeams = readNumber(block.num_teams);
  if (numTeams !== undefined) {
    league.numTeams = numTeams;
  }
  const currentWeek = readNumber(block.current_week);
  if (currentWeek !== undefined) {
    league.currentWeek = currentWeek;
  }
  const startWeek = readNumber(block.start_week);
  if (startWeek !== undefined) {
    league.startWeek = startWeek;
  }
  const endWeek = readNumber(block.end_week);
  if (endWeek !== undefined) {
    league.endWeek = endWeek;
  }
  const scoringType = readString(block.scoring_type);
  if (scoringType !== undefined) {
    league.scoringType = scoringType;
  }
  const url = readString(block.url);
  if (url !== undefined) {
    league.url = url;
  }
  const rosterPositions = parseRosterPositions(block);
  if (rosterPositions.length > 0) {
    league.rosterPositions = rosterPositions;
  }

  return league;
}

export function selectPrimaryLeague(leagues: YahooLeague[]): YahooLeague | undefined {
  if (leagues.length === 0) {
    return undefined;
  }
  const withWeek = leagues.find((league) => league.currentWeek !== undefined);
  return withWeek ?? leagues[0];
}
