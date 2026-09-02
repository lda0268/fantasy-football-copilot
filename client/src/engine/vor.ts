import type { Player, Position } from "../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../types/league";
import { getReplacementLevel } from "./replacement";

export function calculateVor(
  player: Player,
  replacementPoints: number,
): number {
  return player.projectedPoints - replacementPoints;
}

export function calculateVorForPlayers(
  players: Player[],
  playerUniverse: Player[],
  league: LeagueSettings = DEFAULT_LEAGUE,
): Map<string, number> {
  const replacementCache = new Map<Position, number>();
  const result = new Map<string, number>();

  for (const player of players) {
    let replacement = replacementCache.get(player.position);
    if (replacement === undefined) {
      replacement = getReplacementLevel(playerUniverse, player.position, league).projectedPoints;
      replacementCache.set(player.position, replacement);
    }

    result.set(player.id, calculateVor(player, replacement));
  }

  return result;
}

export function leagueAdjustedValue(vor: number): number {
  return vor;
}
