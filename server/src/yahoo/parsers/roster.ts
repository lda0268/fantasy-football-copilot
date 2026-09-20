import type { YahooRosterPlayer } from "../types.js";
import { parseRosterPlayerProfile, readSelectedPosition } from "./playerFields.js";
import { collectNamedResources, isPlainObject, readNumber } from "./walk.js";

export function parseYahooRosterPlayers(payload: unknown): YahooRosterPlayer[] {
  const blocks = collectNamedResources(payload, "player");
  return blocks.map((block, index) => normalizePlayer(block, index));
}

export function parseRosterWeek(payload: unknown): number | null {
  const weeks: number[] = [];
  visitWeek(payload, weeks, new Set());
  return weeks[0] ?? null;
}

function normalizePlayer(block: Record<string, unknown>, index: number): YahooRosterPlayer {
  const player = parseRosterPlayerProfile(block, index);
  const selectedPosition = readSelectedPosition(block.selected_position);
  if (selectedPosition === undefined) {
    return player;
  }
  return { ...player, selectedPosition };
}

function visitWeek(node: unknown, weeks: number[], seen: Set<unknown>): void {
  if (node === null || node === undefined || typeof node !== "object" || seen.has(node)) {
    return;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      visitWeek(item, weeks, seen);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  if ("roster" in record && isPlainObject(record.roster)) {
    const week = readNumber(record.roster.week);
    if (week !== undefined) {
      weeks.push(week);
    }
  }
  if ("week" in record && (record.coverage_type === "week" || "players" in record || "roster" in record)) {
    const week = readNumber(record.week);
    if (week !== undefined) {
      weeks.push(week);
    }
  }

  for (const value of Object.values(record)) {
    visitWeek(value, weeks, seen);
  }
}
