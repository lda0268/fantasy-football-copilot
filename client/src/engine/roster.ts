import type { Player, RosterSlot } from "../types/draft";
import { createEmptyRoster } from "../types/draft";
import { DEFAULT_LEAGUE, slotAcceptsPosition, type LeagueSettings } from "../types/league";

const STARTER_PRIORITY = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPERFLEX",
  "K",
  "DEF",
] as const;

export function optimizeLineup(
  players: Player[],
  league: LeagueSettings = DEFAULT_LEAGUE,
): RosterSlot[] {
  const roster = createEmptyRoster(league);
  const remaining = [...players].sort((a, b) => b.projectedPoints - a.projectedPoints);

  const fill = (predicate: (slot: RosterSlot) => boolean) => {
    for (const slot of roster) {
      if (!predicate(slot) || slot.player) {
        continue;
      }
      const index = remaining.findIndex((player) =>
        slotAcceptsPosition(slot.slotType, player.position, league),
      );
      if (index >= 0) {
        slot.player = remaining.splice(index, 1)[0];
      }
    }
  };

  for (const slotType of STARTER_PRIORITY) {
    fill((slot) => slot.slotType === slotType);
  }
  fill((slot) => slot.slotType === "BENCH");
  fill((slot) => slot.slotType === "IR");

  return roster;
}

export function assignPlayerToRoster(
  roster: RosterSlot[],
  player: Player,
  league: LeagueSettings = DEFAULT_LEAGUE,
): RosterSlot[] {
  const current = roster
    .map((slot) => slot.player)
    .filter((assigned): assigned is Player => assigned !== null);
  return optimizeLineup([...current, player], league);
}

export function removePlayerFromRoster(
  roster: RosterSlot[],
  playerId: string,
  league: LeagueSettings = DEFAULT_LEAGUE,
): RosterSlot[] {
  const remaining = roster
    .map((slot) => slot.player)
    .filter((assigned): assigned is Player => assigned !== null && assigned.id !== playerId);
  return optimizeLineup(remaining, league);
}
