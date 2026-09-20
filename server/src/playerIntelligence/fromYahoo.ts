import type { YahooAvailablePlayer, YahooRosterPlayer } from "../yahoo/types.js";
import type { YahooLeaguePlayer } from "./types.js";

export function toYahooLeaguePlayer(
  player: YahooRosterPlayer | YahooAvailablePlayer,
  source: YahooLeaguePlayer["source"],
): YahooLeaguePlayer {
  const converted: YahooLeaguePlayer = {
    playerKey: player.playerKey,
    playerId: player.playerId,
    name: player.name,
    source,
  };
  if (player.editorialTeamAbbr) {
    converted.team = player.editorialTeamAbbr;
  }
  if (player.displayPosition) {
    converted.displayPosition = player.displayPosition;
  }
  if (player.eligiblePositions && player.eligiblePositions.length > 0) {
    converted.eligiblePositions = player.eligiblePositions;
  }
  if ("selectedPosition" in player && player.selectedPosition) {
    converted.selectedPosition = player.selectedPosition;
  }
  if ("ownershipType" in player && player.ownershipType) {
    converted.ownershipType = player.ownershipType;
  }
  if ("percentOwned" in player && player.percentOwned !== undefined) {
    converted.percentOwned = player.percentOwned;
  }
  if (player.byeWeek !== undefined) {
    converted.byeWeek = player.byeWeek;
  }
  return converted;
}
