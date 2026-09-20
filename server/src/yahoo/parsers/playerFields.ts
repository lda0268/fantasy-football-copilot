import type { YahooRosterPlayer } from "../types.js";
import {
  asArray,
  isPlainObject,
  numericKeyedValues,
  parseError,
  readNumber,
  readString,
} from "./walk.js";

export function parseRosterPlayerProfile(
  block: Record<string, unknown>,
  index: number,
): Omit<YahooRosterPlayer, "selectedPosition"> {
  const playerKey = readString(block.player_key);
  const playerId = readString(block.player_id);
  const name = readPlayerFullName(block.name);
  if (!playerKey) {
    throw parseError(`Yahoo player at index ${index} is missing player_key.`);
  }
  if (!playerId) {
    throw parseError(`Yahoo player at index ${index} is missing player_id.`);
  }
  if (!name) {
    throw parseError(`Yahoo player at index ${index} is missing name.`);
  }

  const player: Omit<YahooRosterPlayer, "selectedPosition"> = {
    playerKey,
    playerId,
    name,
  };

  const firstName = isPlainObject(block.name) ? readString(block.name.first) : undefined;
  const lastName = isPlainObject(block.name) ? readString(block.name.last) : undefined;
  if (firstName !== undefined) {
    player.firstName = firstName;
  }
  if (lastName !== undefined) {
    player.lastName = lastName;
  }

  const editorialTeamAbbr = readString(block.editorial_team_abbr);
  if (editorialTeamAbbr !== undefined) {
    player.editorialTeamAbbr = editorialTeamAbbr;
  }
  const displayPosition = readString(block.display_position);
  if (displayPosition !== undefined) {
    player.displayPosition = displayPosition;
  }
  const eligiblePositions = readPositions(block.eligible_positions);
  if (eligiblePositions !== undefined) {
    player.eligiblePositions = eligiblePositions;
  }
  const status = readString(block.status);
  if (status !== undefined) {
    player.status = status;
  }
  const statusFull = readString(block.status_full);
  if (statusFull !== undefined) {
    player.statusFull = statusFull;
  }
  const byeWeek = readByeWeek(block.bye_weeks);
  if (byeWeek !== undefined) {
    player.byeWeek = byeWeek;
  }
  const uniformNumber = readString(block.uniform_number);
  if (uniformNumber !== undefined) {
    player.uniformNumber = uniformNumber;
  }
  const imageUrl = readImageUrl(block);
  if (imageUrl !== undefined) {
    player.imageUrl = imageUrl;
  }

  return player;
}

export function readPlayerFullName(value: unknown): string | undefined {
  const direct = readString(value);
  if (direct !== undefined) {
    return direct;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  const combined = [readString(value.first), readString(value.last)].filter(Boolean).join(" ");
  return readString(value.full) ?? (combined !== "" ? combined : undefined);
}

export function readPositions(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const positions: string[] = [];
  for (const item of [...asArray(value), ...numericKeyedValues(value)]) {
    if (typeof item === "string") {
      const position = readString(item);
      if (position) {
        positions.push(position);
      }
      continue;
    }
    if (isPlainObject(item)) {
      const position = readString(item.position);
      if (position) {
        positions.push(position);
      }
    }
  }

  return positions.length > 0 ? [...new Set(positions)] : undefined;
}

export function readSelectedPosition(value: unknown): string | undefined {
  const direct = readString(value);
  if (direct !== undefined) {
    return direct;
  }
  if (isPlainObject(value)) {
    return readString(value.position);
  }
  for (const item of asArray(value)) {
    if (isPlainObject(item)) {
      const position = readString(item.position);
      if (position) {
        return position;
      }
    }
  }
  return undefined;
}

export function readByeWeek(value: unknown): number | undefined {
  const direct = readNumber(value);
  if (direct !== undefined) {
    return direct;
  }
  if (isPlainObject(value)) {
    return readNumber(value.week);
  }
  return undefined;
}

export function readImageUrl(block: Record<string, unknown>): string | undefined {
  const direct = readString(block.image_url);
  if (direct !== undefined) {
    return direct;
  }
  if (isPlainObject(block.headshot)) {
    return readString(block.headshot.url);
  }
  return undefined;
}
