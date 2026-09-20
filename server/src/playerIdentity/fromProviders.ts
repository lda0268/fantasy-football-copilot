import type { YahooAvailablePlayer, YahooRosterPlayer } from "../yahoo/types.js";
import type { YahooIdentityPlayer } from "./types.js";

export function toYahooIdentityPlayer(
  player: Pick<
    YahooRosterPlayer | YahooAvailablePlayer,
    "playerKey" | "playerId" | "name" | "editorialTeamAbbr" | "displayPosition" | "eligiblePositions"
  >,
): YahooIdentityPlayer {
  const identity: YahooIdentityPlayer = {
    playerKey: player.playerKey,
    playerId: player.playerId,
    name: player.name,
  };
  if (player.editorialTeamAbbr) {
    identity.team = player.editorialTeamAbbr;
  }
  if (player.displayPosition) {
    identity.displayPosition = player.displayPosition;
  }
  if (player.eligiblePositions && player.eligiblePositions.length > 0) {
    identity.eligiblePositions = player.eligiblePositions;
  }
  return identity;
}
