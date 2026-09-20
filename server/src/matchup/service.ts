import {
  getFantasyProsStatus,
  listFantasyProsPlayers,
  listInjuries,
  listRankings,
  listWeeklyProjections,
} from "../fantasypros/service.js";
import { isFantasyProsApiError } from "../fantasypros/errors.js";
import { reconcilePlayers } from "../playerIdentity/matcher.js";
import { toYahooIdentityPlayer } from "../playerIdentity/fromProviders.js";
import { composePlayerIntelligence } from "../playerIntelligence/compose.js";
import { toYahooLeaguePlayer } from "../playerIntelligence/fromYahoo.js";
import type { YahooLeaguePlayer } from "../playerIntelligence/types.js";
import { isYahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import {
  getYahooLeagueSettings,
  getYahooMatchup,
  getYahooRoster,
  getYahooStatus,
  getYahooTeam,
  getYahooTeamRoster,
} from "../yahoo/season.js";
import type { YahooRoster } from "../yahoo/season.js";
import { buildMatchupIntelligence } from "./assemble.js";
import type { MatchupIntelligence } from "./types.js";

export async function getMatchupIntelligence(): Promise<MatchupIntelligence> {
  const [yahooStatus, fantasyProsStatus, team, settings] = await Promise.all([
    getYahooStatus(),
    Promise.resolve(getFantasyProsStatus()),
    getYahooTeam(),
    getYahooLeagueSettings(),
  ]);

  const matchup = await loadMatchup();
  const userRoster = await getYahooRoster();

  let opponentRoster: YahooRoster | undefined;
  let opponentError: string | undefined;
  const opponentKey = matchup?.teams.find((row) => row.teamKey !== team.teamKey)?.teamKey;
  if (opponentKey) {
    try {
      opponentRoster = await getYahooTeamRoster(opponentKey);
    } catch (error) {
      opponentError = opponentRosterMessage(error);
    }
  }

  const fp = await loadFantasyPros(userRoster.week ?? settings.league.currentWeek ?? matchup?.week ?? null);

  const yahooPlayers: YahooLeaguePlayer[] = [
    ...userRoster.players.map((player) => toYahooLeaguePlayer(player, "roster")),
    ...(opponentRoster?.players ?? []).map((player) => {
      const converted = toYahooLeaguePlayer(player, "available");
      converted.ownershipType = "team";
      return converted;
    }),
  ];

  const identity = reconcilePlayers(
    yahooPlayers.map((player) =>
      toYahooIdentityPlayer({
        playerKey: player.playerKey,
        playerId: player.playerId ?? "",
        name: player.name,
        editorialTeamAbbr: player.team,
        displayPosition: player.displayPosition,
        eligiblePositions: player.eligiblePositions,
      }),
    ),
    fp.players,
  );

  const composed = composePlayerIntelligence({
    yahooPlayers,
    identityResults: identity.results,
    weeklyProjections: fp.weeklyProjections,
    rosProjections: fp.rosProjections,
    weeklyRankings: fp.weeklyRankings,
    rosRankings: fp.rosRankings,
    injuries: fp.injuries,
  });

  return buildMatchupIntelligence({
    yahooStatus,
    fantasyProsStatus,
    fantasyProsAvailable: fp.available,
    league: settings.league,
    team,
    matchup,
    rosterPositions: settings.rosterPositions,
    userRoster: userRoster.players,
    opponentRoster: opponentRoster
      ? { team: opponentRoster.team, players: opponentRoster.players }
      : undefined,
    opponentError,
    players: composed.players,
  });
}

async function loadMatchup() {
  try {
    return await getYahooMatchup();
  } catch (error) {
    if (isYahooApiError(error) && error.code === YahooErrorCode.MATCHUP_NOT_FOUND) {
      return undefined;
    }
    throw error;
  }
}

async function loadFantasyPros(week: number | null) {
  try {
    const [players, weeklyProjections, weeklyRankings, injuries] = await Promise.all([
      listFantasyProsPlayers(),
      week !== null ? listWeeklyProjections(week) : Promise.resolve([]),
      week !== null ? listRankings("weekly", { week }) : Promise.resolve([]),
      week !== null ? listInjuries(week) : listInjuries(),
    ]);
    return {
      available: true,
      players,
      weeklyProjections,
      rosProjections: [],
      weeklyRankings,
      rosRankings: [],
      injuries,
    };
  } catch (error) {
    if (isFantasyProsApiError(error) || error instanceof Error) {
      return {
        available: false,
        players: [],
        weeklyProjections: [],
        rosProjections: [],
        weeklyRankings: [],
        rosRankings: [],
        injuries: [],
      };
    }
    throw error;
  }
}

function opponentRosterMessage(error: unknown): string {
  if (isYahooApiError(error) && error.status === 404) {
    return "Opponent roster is unavailable.";
  }
  return "Opponent roster could not be loaded.";
}
