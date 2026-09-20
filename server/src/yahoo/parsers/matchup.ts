import { YahooApiError, YahooErrorCode } from "../errors.js";
import type { YahooMatchup, YahooMatchupTeam } from "../types.js";
import {
  collectNamedResources,
  isPlainObject,
  parseError,
  readBooleanFlag,
  readName,
  readNestedNumber,
  readNumber,
  readString,
} from "./walk.js";

export function parseYahooMatchups(payload: unknown): YahooMatchup[] {
  const blocks = collectNamedResources(payload, "matchup");
  if (blocks.length === 0) {
    throw parseError("Yahoo payload contains no matchup.");
  }
  return blocks.map((block, index) => normalizeMatchup(block, index));
}

export function selectMatchupForTeam(matchups: YahooMatchup[], teamKey: string): YahooMatchup {
  const matchup = matchups.find((item) => item.teams.some((team) => team.teamKey === teamKey));
  if (!matchup) {
    throw new YahooApiError(
      YahooErrorCode.MATCHUP_NOT_FOUND,
      "No matchup was found for the authenticated user's team.",
      { status: 404 },
    );
  }
  return matchup;
}

function normalizeMatchup(block: Record<string, unknown>, index: number): YahooMatchup {
  const week = readNumber(block.week);
  if (week === undefined) {
    throw parseError(`Yahoo matchup at index ${index} is missing week.`);
  }

  const teams = collectNamedResources(block, "team").map((team, teamIndex) =>
    normalizeMatchupTeam(team, index, teamIndex),
  );
  if (teams.length !== 2) {
    throw parseError(`Yahoo matchup at index ${index} must contain exactly two teams.`);
  }

  const matchup: YahooMatchup = { week, teams };
  const status = readString(block.status);
  if (status !== undefined) {
    matchup.status = status;
  }
  const isPlayoffs = readBooleanFlag(block.is_playoffs);
  if (isPlayoffs !== undefined) {
    matchup.isPlayoffs = isPlayoffs;
  }
  const isConsolation = readBooleanFlag(block.is_consolation);
  if (isConsolation !== undefined) {
    matchup.isConsolation = isConsolation;
  }
  const isTied = readBooleanFlag(block.is_tied);
  if (isTied !== undefined) {
    matchup.isTied = isTied;
  }
  const winnerTeamKey = readString(block.winner_team_key);
  if (winnerTeamKey !== undefined) {
    matchup.winnerTeamKey = winnerTeamKey;
  }
  return matchup;
}

function normalizeMatchupTeam(
  block: Record<string, unknown>,
  matchupIndex: number,
  teamIndex: number,
): YahooMatchupTeam {
  const teamKey = readString(block.team_key);
  const teamId = readString(block.team_id);
  const name = readName(block.name);
  if (!teamKey) {
    throw parseError(`Yahoo matchup ${matchupIndex} team ${teamIndex} is missing team_key.`);
  }
  if (!teamId) {
    throw parseError(`Yahoo matchup ${matchupIndex} team ${teamIndex} is missing team_id.`);
  }
  if (!name) {
    throw parseError(`Yahoo matchup ${matchupIndex} team ${teamIndex} is missing name.`);
  }

  const team: YahooMatchupTeam = { teamKey, teamId, name };
  const points = readNestedNumber(block.team_points);
  if (points !== undefined) {
    team.points = points;
  }
  const projectedPoints = readNestedNumber(block.team_projected_points);
  if (projectedPoints !== undefined) {
    team.projectedPoints = projectedPoints;
  }

  const standings = isPlainObject(block.team_standings) ? block.team_standings : undefined;
  const totals = standings && isPlainObject(standings.outcome_totals) ? standings.outcome_totals : undefined;
  const wins = readNumber(totals?.wins);
  const losses = readNumber(totals?.losses);
  const ties = readNumber(totals?.ties);
  if (wins !== undefined) {
    team.wins = wins;
  }
  if (losses !== undefined) {
    team.losses = losses;
  }
  if (ties !== undefined) {
    team.ties = ties;
  }
  return team;
}
