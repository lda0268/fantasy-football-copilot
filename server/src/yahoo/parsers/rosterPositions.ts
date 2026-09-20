import type { YahooRosterPosition } from "../types.js";
import { collectNamedResources, readNumber, readString } from "./walk.js";

export function parseRosterPositions(payload: unknown): YahooRosterPosition[] {
  const blocks = collectNamedResources(payload, "roster_position");
  const parsed: YahooRosterPosition[] = [];
  for (const block of blocks) {
    const position = readString(block.position)?.trim();
    if (!position) {
      continue;
    }
    const count = readNumber(block.count) ?? 1;
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }
    parsed.push({ position, count: Math.trunc(count) });
  }
  return mergeRosterPositions(parsed);
}

export function mergeRosterPositions(positions: YahooRosterPosition[]): YahooRosterPosition[] {
  const merged: YahooRosterPosition[] = [];
  for (const item of positions) {
    const existing = merged.find((row) => row.position === item.position);
    if (existing) {
      existing.count += item.count;
    } else {
      merged.push({ position: item.position, count: item.count });
    }
  }
  return merged;
}
