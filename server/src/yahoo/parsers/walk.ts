import { YahooApiError, YahooErrorCode } from "../errors.js";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function readString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export function readBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === 0 || value === "0" || value === "false") {
    return false;
  }
  return undefined;
}

export function numericKeyedValues(value: unknown): unknown[] {
  if (!isPlainObject(value)) {
    return [];
  }

  return Object.keys(value)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => value[key]);
}

export function unwrapNamedBlocks(value: unknown, name: string): Record<string, unknown>[] {
  const merged = mergeSplitResource(value, name);
  const source = merged ?? value;
  const blocks: Record<string, unknown>[] = [];

  for (const entry of asArray(source)) {
    if (!isPlainObject(entry)) {
      continue;
    }
    if (isSubresourceContainer(entry)) {
      continue;
    }
    if (name in entry && !looksLikeResource(entry, name)) {
      blocks.push(...unwrapNamedBlocks(entry[name], name));
      continue;
    }
    blocks.push(entry);
  }

  return blocks;
}

function mergeSplitResource(value: unknown, name: string): Record<string, unknown> | undefined {
  if (name !== "team" && name !== "player" && name !== "matchup") {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parts =
    name === "matchup"
      ? value.filter(isPlainObject)
      : value.filter(isPlainObject).filter((entry) => !isSubresourceContainer(entry));
  if (parts.length <= 1) {
    return undefined;
  }

  const identityParts = parts.filter((entry) => looksLikeResource(entry, name));
  if (identityParts.length !== 1) {
    return undefined;
  }

  return Object.assign({}, ...parts);
}

function isSubresourceContainer(entry: Record<string, unknown>): boolean {
  const keys = Object.keys(entry);
  if (keys.length === 0) {
    return false;
  }
  const subresources = new Set([
    "leagues",
    "teams",
    "players",
    "roster",
    "standings",
    "scoreboard",
    "settings",
    "draftresults",
    "draft_results",
  ]);
  return keys.every((key) => subresources.has(key));
}

function looksLikeResource(entry: Record<string, unknown>, name: string): boolean {
  if (name === "game") {
    return "game_key" in entry || "game_id" in entry;
  }
  if (name === "league") {
    return "league_key" in entry || "league_id" in entry;
  }
  if (name === "team") {
    return "team_key" in entry || "team_id" in entry;
  }
  if (name === "player") {
    return "player_key" in entry || "player_id" in entry;
  }
  if (name === "matchup") {
    return "week" in entry || "status" in entry || "winner_team_key" in entry || "is_playoffs" in entry;
  }
  return false;
}

export function collectNamedResources(root: unknown, name: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  visit(root, name, found, new Set());
  return found;
}

function visit(
  node: unknown,
  name: string,
  found: Record<string, unknown>[],
  seen: Set<unknown>,
): void {
  if (node === null || node === undefined) {
    return;
  }
  if (typeof node !== "object") {
    return;
  }
  if (seen.has(node)) {
    return;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      visit(item, name, found, seen);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  if (name in record) {
    found.push(...unwrapNamedBlocks(record[name], name));
  }

  for (const value of numericKeyedValues(record)) {
    visit(value, name, found, seen);
  }

  for (const [key, value] of Object.entries(record)) {
    if (/^\d+$/.test(key) || key === name || key === "count") {
      continue;
    }
    visit(value, name, found, seen);
  }
}

export function readName(value: unknown): string | undefined {
  const direct = readString(value);
  if (direct !== undefined) {
    return direct;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  return readString(value.full) ?? readString(value.name) ?? readString(value.team);
}

export function readNestedNumber(value: unknown, key = "total"): number | undefined {
  const direct = readNumber(value);
  if (direct !== undefined) {
    return direct;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  return readNumber(value[key]) ?? readNumber(value.total);
}

export function parseError(message: string): YahooApiError {
  return new YahooApiError(YahooErrorCode.PARSE_ERROR, message);
}
