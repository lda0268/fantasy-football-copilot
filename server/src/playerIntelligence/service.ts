import {
  getFantasyProsStatus,
  listFantasyProsPlayers,
  listInjuries,
  listRankings,
  listRosProjections,
  listWeeklyProjections,
} from "../fantasypros/service.js";
import { reconcilePlayers } from "../playerIdentity/matcher.js";
import { toYahooIdentityPlayer } from "../playerIdentity/fromProviders.js";
import { PLAYER_PAGE_MAX_COUNT } from "../yahoo/resources.js";
import { getYahooFreeAgents, getYahooPlayersByStatus, getYahooRoster, getYahooStatus } from "../yahoo/season.js";
import type { YahooRosterPlayer } from "../yahoo/types.js";
import { composePlayerIntelligence, summarizePlayers } from "./compose.js";
import { toYahooLeaguePlayer } from "./fromYahoo.js";
import type { LeagueAvailability, PlayerIntelligence, PlayerIntelligenceComposition } from "./types.js";

export type PlayerIntelligenceDiagnostic = PlayerIntelligenceComposition & {
  providers: {
    yahoo: { mode: "fixture" | "live" };
    fantasyPros: { mode: "fixture" | "live" };
  };
};

export type PlayerIntelligenceQuery = {
  position?: string;
  availability?: LeagueAvailability;
  identityStatus?: PlayerIntelligence["identity"]["status"];
};

export type PlayerIntelligenceContext = PlayerIntelligenceDiagnostic & {
  week: number | null;
  roster: YahooRosterPlayer[];
  weeklyProjections: Awaited<ReturnType<typeof listWeeklyProjections>>;
  rosProjections: Awaited<ReturnType<typeof listRosProjections>>;
  weeklyRankings: Awaited<ReturnType<typeof listRankings>>;
  rosRankings: Awaited<ReturnType<typeof listRankings>>;
};

export async function composeCurrentPlayerIntelligence(
  query: PlayerIntelligenceQuery = {},
): Promise<PlayerIntelligenceDiagnostic> {
  const loaded = await loadPlayerIntelligenceContext();
  const filtered = filterPlayers(loaded.players, query);
  return {
    providers: loaded.providers,
    summary: summarizePlayers(filtered),
    players: filtered,
  };
}

export async function loadPlayerIntelligenceContext(): Promise<PlayerIntelligenceContext> {
  const [yahooStatus, fantasyProsStatus, roster, freeAgents, waivers, taken, fantasyProsPlayers] = await Promise.all([
    getYahooStatus(),
    Promise.resolve(getFantasyProsStatus()),
    getYahooRoster(),
    getYahooFreeAgents({ start: 0, count: PLAYER_PAGE_MAX_COUNT }),
    getYahooPlayersByStatus("W", { start: 0, count: PLAYER_PAGE_MAX_COUNT }),
    getYahooPlayersByStatus("T", { start: 0, count: PLAYER_PAGE_MAX_COUNT }),
    listFantasyProsPlayers(),
  ]);

  const yahooPlayers = [
    ...roster.players.map((player) => toYahooLeaguePlayer(player, "roster")),
    ...freeAgents.players.map((player) => toYahooLeaguePlayer(player, "available")),
    ...waivers.players.map((player) => toYahooLeaguePlayer(player, "available")),
    ...taken.players.map((player) => toYahooLeaguePlayer(player, "available")),
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
    fantasyProsPlayers,
  );

  const week = roster.week ?? freeAgents.league.currentWeek ?? null;
  const [weeklyProjections, rosProjections, weeklyRankings, rosRankings, injuries] = await Promise.all([
    week !== null ? listWeeklyProjections(week) : Promise.resolve([]),
    listRosProjections(),
    week !== null ? listRankings("weekly", { week }) : Promise.resolve([]),
    listRankings("ros"),
    week !== null ? listInjuries(week) : listInjuries(),
  ]);

  const composed = composePlayerIntelligence({
    yahooPlayers,
    identityResults: identity.results,
    weeklyProjections,
    rosProjections,
    weeklyRankings,
    rosRankings,
    injuries,
  });

  return {
    providers: {
      yahoo: { mode: yahooStatus.mode },
      fantasyPros: { mode: fantasyProsStatus.mode },
    },
    summary: summarizePlayers(composed.players),
    players: composed.players,
    week,
    roster: roster.players,
    weeklyProjections,
    rosProjections,
    weeklyRankings,
    rosRankings,
  };
}

export function filterPlayers(players: PlayerIntelligence[], query: PlayerIntelligenceQuery): PlayerIntelligence[] {
  return players.filter((player) => {
    if (query.position && player.player.position !== query.position) {
      return false;
    }
    if (query.availability && player.leagueState.availability !== query.availability) {
      return false;
    }
    if (query.identityStatus && player.identity.status !== query.identityStatus) {
      return false;
    }
    return true;
  });
}
