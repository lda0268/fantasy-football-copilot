import type { MatchupPlayerView } from "../api/types";

export function statusLabel(player?: MatchupPlayerView): string {
  if (!player) {
    return "—";
  }
  return player.injuryStatus ?? player.yahooStatus ?? "—";
}

export function groupLabel(group: "starter" | "bench" | "ir"): string {
  if (group === "ir") {
    return "IR";
  }
  if (group === "bench") {
    return "Bench";
  }
  return "Starter";
}
