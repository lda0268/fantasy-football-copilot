import type { PlayerIntelligence } from "../api/types";
import { ROUTES } from "../app/routes";
import { searchMatches } from "./playersView";

export type CompareKeys = {
  a?: string;
  b?: string;
};

export function parseCompareSearch(search: string): CompareKeys {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const player = params.get("player")?.trim() || undefined;
  const a = params.get("a")?.trim() || player;
  const b = params.get("b")?.trim() || undefined;
  if (a && b && a === b) {
    return { a };
  }
  return { a, b };
}

export function buildComparePath(keys: CompareKeys): string {
  const params = new URLSearchParams();
  if (keys.a && keys.b) {
    params.set("a", keys.a);
    params.set("b", keys.b);
  } else if (keys.a) {
    params.set("player", keys.a);
  } else if (keys.b) {
    params.set("player", keys.b);
  }
  const query = params.toString();
  return query ? `${ROUTES.compare}?${query}` : ROUTES.compare;
}

export function playerByKey(players: PlayerIntelligence[], key: string | undefined): PlayerIntelligence | undefined {
  if (!key) {
    return undefined;
  }
  return players.find((player) => player.identity.yahooPlayerKey === key);
}

export function resolveCompareKeys(players: PlayerIntelligence[], keys: CompareKeys): CompareKeys {
  const a = playerByKey(players, keys.a) ? keys.a : undefined;
  const b = playerByKey(players, keys.b) && keys.b !== a ? keys.b : undefined;
  return { a, b };
}

export function filterCompareCandidates(
  players: PlayerIntelligence[],
  query: string,
  excludeKey?: string,
  limit = 12,
): PlayerIntelligence[] {
  return players
    .filter((player) => player.identity.yahooPlayerKey !== excludeKey)
    .filter((player) => searchMatches(player, query))
    .slice(0, limit);
}

export function numericDifference(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined || right === undefined) {
    return undefined;
  }
  return left - right;
}

export function formatOwnership(value: number | undefined): { text: string; missing: boolean } {
  if (value === undefined) {
    return { text: "—", missing: true };
  }
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return { text: `${display}%`, missing: false };
}

export function comparisonContext(
  playerA: PlayerIntelligence,
  playerB: PlayerIntelligence,
  week: number | null | undefined,
): { positions: string; league: string; week: string } {
  return {
    positions: `${playerA.player.position ?? "Unknown"} vs ${playerB.player.position ?? "Unknown"}`,
    league: `${leagueStatusShort(playerA)} vs ${leagueStatusShort(playerB)}`,
    week: week != null ? `Week ${week}` : "Week unavailable",
  };
}

function leagueStatusShort(player: PlayerIntelligence): string {
  const value = player.leagueState.availability;
  if (value === "rostered_by_user") {
    return "My Team";
  }
  if (value === "rostered_by_other") {
    return "Other Team";
  }
  if (value === "free_agent") {
    return "Free Agent";
  }
  if (value === "waivers") {
    return "Waivers";
  }
  return "Unknown";
}

export function provenanceLabel(provider: "yahoo" | "fantasypros"): string {
  return provider === "yahoo" ? "Yahoo" : "FantasyPros";
}

export const COMPARE_PROVENANCE_FIELDS: Record<string, string> = {
  availability: "League status",
  rosterSlot: "Roster slot",
  percentOwned: "Percent owned",
  byeWeek: "Bye week",
  weeklyProjection: "Weekly projection",
  weeklyEcr: "Weekly ECR",
  rosProjection: "ROS projection",
  rosEcr: "ROS ECR",
  injuryStatus: "Injury status",
};
