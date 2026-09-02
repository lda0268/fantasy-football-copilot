import type { Player, Position } from "../types/draft";

export function playersAtPosition(players: Player[], position: Position): Player[] {
  return players
    .filter((player) => player.position === position)
    .sort(
      (a, b) =>
        b.projectedPoints - a.projectedPoints ||
        a.positionalRank - b.positionalRank,
    );
}
