import type { YahooAvailablePlayer } from "../types.js";
import { parseRosterPlayerProfile } from "./playerFields.js";
import { collectNamedResources, isPlainObject, readNestedNumber, readString } from "./walk.js";

export function parseYahooAvailablePlayers(payload: unknown): YahooAvailablePlayer[] {
  const blocks = collectNamedResources(payload, "player");
  return blocks.map((block, index) => normalizeAvailablePlayer(block, index));
}

function normalizeAvailablePlayer(block: Record<string, unknown>, index: number): YahooAvailablePlayer {
  const player: YahooAvailablePlayer = parseRosterPlayerProfile(block, index);

  const ownership = isPlainObject(block.ownership) ? block.ownership : undefined;
  const ownershipType = readString(ownership?.ownership_type) ?? readString(block.ownership_type);
  if (ownershipType !== undefined) {
    player.ownershipType = ownershipType;
  }
  const ownerTeamKey = readString(ownership?.owner_team_key) ?? readString(block.owner_team_key);
  if (ownerTeamKey !== undefined) {
    player.ownerTeamKey = ownerTeamKey;
  }
  const ownerTeamName = readString(ownership?.owner_team_name) ?? readString(block.owner_team_name);
  if (ownerTeamName !== undefined) {
    player.ownerTeamName = ownerTeamName;
  }

  const percentOwned =
    readNestedNumber(block.percent_owned, "value") ??
    (isPlainObject(block.percent_owned) ? readNestedNumber(block.percent_owned.value, "value") : undefined);
  if (percentOwned !== undefined) {
    player.percentOwned = percentOwned;
  }

  const fantasyPoints = readNestedNumber(block.player_points);
  if (fantasyPoints !== undefined) {
    player.fantasyPoints = fantasyPoints;
  }
  const projectedPoints = readNestedNumber(block.player_projected_points);
  if (projectedPoints !== undefined) {
    player.projectedPoints = projectedPoints;
  }

  return player;
}
