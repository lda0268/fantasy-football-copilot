import { parseError } from "../errors.js";
import { asArray, isPlainObject, readString } from "../parse.js";
import type { FantasyProsExternalIds, FantasyProsPlayer } from "../types.js";

export function parseFantasyProsPlayers(payload: unknown): FantasyProsPlayer[] {
  const root = isPlainObject(payload) ? payload : {};
  const list = asArray(root.players);
  if (list.length === 0 && Array.isArray(payload)) {
    return payload.map((item, index) => normalizePlayer(item, index));
  }
  return list.map((item, index) => normalizePlayer(item, index));
}

function normalizePlayer(value: unknown, index: number): FantasyProsPlayer {
  if (!isPlainObject(value)) {
    throw parseError(`FantasyPros player at index ${index} is malformed.`);
  }
  const fantasyProsId = readString(value.player_id) ?? readString(value.fpid);
  const name = readString(value.player_name) ?? readString(value.name);
  if (!fantasyProsId) {
    throw parseError(`FantasyPros player at index ${index} is missing player_id.`);
  }
  if (!name) {
    throw parseError(`FantasyPros player at index ${index} is missing name.`);
  }

  const player: FantasyProsPlayer = { fantasyProsId, name };
  const firstName = readString(value.first_name);
  const lastName = readString(value.last_name);
  if (firstName) {
    player.firstName = firstName;
  }
  if (lastName) {
    player.lastName = lastName;
  }
  const team = readString(value.team_id) ?? readString(value.player_team_id);
  if (team) {
    player.team = team;
  }
  const position = readString(value.position_id) ?? readString(value.player_position_id);
  if (position) {
    player.position = position.split(",")[0];
  }
  const positions = readPositions(value.positions ?? value.player_positions ?? position);
  if (positions) {
    player.positions = positions;
  }
  const externalIds = readExternalIds(value);
  if (Object.keys(externalIds).length > 0) {
    player.externalIds = externalIds;
  }
  return player;
}

function readPositions(value: unknown): string[] | undefined {
  const positions: string[] = [];
  if (typeof value === "string") {
    positions.push(...value.split(/[,:]/).map((item) => item.trim()).filter(Boolean));
  } else {
    for (const item of asArray(value)) {
      const position = readString(item);
      if (position) {
        positions.push(position);
      }
    }
  }
  return positions.length > 0 ? [...new Set(positions)] : undefined;
}

function readExternalIds(block: Record<string, unknown>): FantasyProsExternalIds {
  const ids: FantasyProsExternalIds = {};
  const yahoo = readString(block.yahoo_id) ?? readString(block.player_yahoo_id);
  const espn = readString(block.espn_id);
  const nfl = readString(block.nfl_id);
  const cbs = readString(block.cbs_player_id) ?? readString(block.cbs_id);
  const mfl = readString(block.mflid) ?? readString(block.mfl_id);
  const sportsdata = readString(block.sportsdata_player_id);
  if (yahoo) {
    ids.yahoo = yahoo;
  }
  if (espn) {
    ids.espn = espn;
  }
  if (nfl) {
    ids.nfl = nfl;
  }
  if (cbs) {
    ids.cbs = cbs;
  }
  if (mfl) {
    ids.mfl = mfl;
  }
  if (sportsdata) {
    ids.sportsdata = sportsdata;
  }
  return ids;
}
