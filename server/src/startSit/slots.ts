import type { YahooRosterPosition } from "../yahoo/types.js";
import { isNonStartingSlot, isStartingSlot, normalizeSlotCode } from "./eligibility.js";
import type { StartSitSlot } from "./types.js";

export function expandStartingSlots(positions: YahooRosterPosition[]): StartSitSlot[] {
  const slots: StartSitSlot[] = [];
  const counts = new Map<string, number>();
  for (const row of positions) {
    const code = normalizeSlotCode(row.position);
    if (!isStartingSlot(code)) {
      continue;
    }
    for (let index = 0; index < row.count; index += 1) {
      const occurrence = counts.get(code) ?? 0;
      counts.set(code, occurrence + 1);
      slots.push({
        id: `${code}:${occurrence}`,
        position: row.position,
        index: occurrence,
      });
    }
  }
  return slots;
}

export function rosterGroup(slot?: string): "starter" | "bench" | "ir" {
  const code = normalizeSlotCode(slot);
  if (code === "IR" || code.startsWith("IR")) {
    return "ir";
  }
  if (isNonStartingSlot(code)) {
    return "bench";
  }
  return "starter";
}
