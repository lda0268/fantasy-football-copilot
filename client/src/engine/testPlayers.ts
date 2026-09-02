import { ESPN_2026_PPR_SOURCE, type Player } from "../types/draft";

export function testPlayer(
  partial: Partial<Player> & Pick<Player, "id" | "name" | "position" | "positionalRank" | "projectedPoints">,
): Player {
  return {
    team: "FA",
    adp: partial.adp ?? partial.positionalRank,
    espnOverallRank: partial.espnOverallRank ?? partial.positionalRank,
    espnPositionalRank: partial.espnPositionalRank ?? partial.positionalRank,
    espnAuctionValue: partial.espnAuctionValue ?? 10,
    espnByeWeek: partial.espnByeWeek ?? 7,
    espnSource: ESPN_2026_PPR_SOURCE,
    sourceProjectedPoints: partial.sourceProjectedPoints ?? partial.projectedPoints,
    projectionSource: partial.projectionSource ?? "source",
    ...partial,
  };
}
