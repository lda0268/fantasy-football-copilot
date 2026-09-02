import { ESPN_2026_PPR_SOURCE, type DraftPick, type Player, type Position, type RosterSlot } from "../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../types/league";
import { optimizeLineup } from "./roster";

export type LeagueRosters = Map<number, RosterSlot[]>;

function playerFromPick(pick: DraftPick): Player {
  return {
    id: pick.playerId,
    name: pick.playerName,
    position: pick.position,
    team: "FA",
    projectedPoints: 0,
    positionalRank: 0,
    espnOverallRank: 0,
    espnPositionalRank: 0,
    espnAuctionValue: 0,
    espnByeWeek: 0,
    espnSource: ESPN_2026_PPR_SOURCE,
    sourceProjectedPoints: 0,
    projectionSource: "source",
  };
}

export function buildLeagueRosters(
  picks: DraftPick[],
  players: Player[],
  league: LeagueSettings = DEFAULT_LEAGUE,
): LeagueRosters {
  const byId = new Map(players.map((player) => [player.id, player]));
  const byTeam = new Map<number, Player[]>();

  for (let slot = 1; slot <= league.teamCount; slot += 1) {
    byTeam.set(slot, []);
  }

  for (const pick of picks) {
    const rostered = byTeam.get(pick.teamSlot);
    if (!rostered) {
      continue;
    }
    rostered.push(byId.get(pick.playerId) ?? playerFromPick(pick));
  }

  const rosters: LeagueRosters = new Map();
  for (const [slot, teamPlayers] of byTeam) {
    rosters.set(slot, optimizeLineup(teamPlayers, league));
  }
  return rosters;
}

export function cloneLeagueRosters(rosters: LeagueRosters): LeagueRosters {
  return new Map(
    [...rosters.entries()].map(([slot, roster]) => [
      slot,
      roster.map((item) => ({ ...item })),
    ]),
  );
}

export function countRosteredPosition(roster: RosterSlot[], position: Position): number {
  return roster.filter((slot) => slot.player?.position === position).length;
}

export function slotOpen(roster: RosterSlot[], slotType: RosterSlot["slotType"]): boolean {
  return roster.some((slot) => slot.slotType === slotType && slot.player === null);
}
