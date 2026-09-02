import type { Player, Position } from "../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../types/league";
import { clamp } from "./math";
import { expectedStarterDemand } from "./starterDemand";
import type { PlayerTier } from "./tiers";

export interface ScarcityInput {
  availablePlayers: Player[];
  playerUniverse?: Player[];
  position: Position;
  playerId: string;
  vorById: Map<string, number>;
  tiersById: Map<string, PlayerTier>;
  league?: LeagueSettings;
}

export function calculateScarcityScore(input: ScarcityInput): number {
  const {
    availablePlayers,
    position,
    playerId,
    vorById,
    tiersById,
    league = DEFAULT_LEAGUE,
  } = input;
  const playerUniverse = input.playerUniverse ?? availablePlayers;
  const remaining = availablePlayers.filter((player) => player.position === position);
  const starterSlots = Math.max(1, expectedStarterDemand(league, position, playerUniverse));
  const aboveReplacement = remaining.filter((player) => (vorById.get(player.id) ?? 0) > 0).length;
  const playerTier = tiersById.get(playerId);
  const upcomingDrop = playerTier?.pointsToNextTier ?? 0;
  const dropPressure = playerTier?.tierScarcity ?? clamp(upcomingDrop / 25, 0, 1);
  const remainingPressure = 1 - clamp(remaining.length / Math.max(starterSlots * 1.15, 1), 0, 1);
  const qualityPressure = 1 - clamp(aboveReplacement / Math.max(starterSlots, 1), 0, 1);

  return clamp(
    remainingPressure * 0.35 + qualityPressure * 0.35 + dropPressure * 0.3,
    0,
    1,
  );
}
