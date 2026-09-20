import type { LeagueAvailability, PlayerIntelligence } from "../api/types";
import { PLAYERS_AVAILABILITY_LABELS } from "./labels";
import { intelligenceCoverage, matchedIntelligence } from "./rosterView";
import type { InjuryFilter } from "./rosterView";
import { normalizePosition as normalizePos } from "./filterRecommendations";
import type { PositionFilter } from "./filterRecommendations";

export type PlayersIdentityFilter = "ALL" | "matched" | "unresolved" | "ambiguous";
export type PlayersAvailabilityFilter = "ALL" | LeagueAvailability;
export type PlayersSortKey = "name" | "weeklyProj" | "weeklyEcr" | "rosProj" | "rosEcr" | "owned";
export type SortDirection = "asc" | "desc";

export type PlayersFilters = {
  query: string;
  position: PositionFilter;
  availability: PlayersAvailabilityFilter;
  identity: PlayersIdentityFilter;
  injury: InjuryFilter;
};

export const EMPTY_PLAYERS_FILTERS: PlayersFilters = {
  query: "",
  position: "ALL",
  availability: "ALL",
  identity: "ALL",
  injury: "ALL",
};

export const PLAYERS_SORT_LABELS: Record<PlayersSortKey, string> = {
  name: "Player name",
  weeklyProj: "Week projection",
  weeklyEcr: "Week ECR",
  rosProj: "ROS projection",
  rosEcr: "ROS ECR",
  owned: "Percent owned",
};

export function leagueStatusLabel(availability: LeagueAvailability): string {
  return PLAYERS_AVAILABILITY_LABELS[availability] ?? availability;
}

export function formatPercentOwned(value: number | undefined): { text: string; missing: boolean } {
  if (value === undefined) {
    return { text: "—", missing: true };
  }
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return { text: `${display}% rostered`, missing: false };
}

export function searchMatches(player: PlayerIntelligence, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [player.player.name, player.player.team ?? "", player.player.position ?? ""].join(" ").toLowerCase();
  return haystack.includes(needle);
}

export function filterPlayersView(players: PlayerIntelligence[], filters: PlayersFilters): PlayerIntelligence[] {
  return players.filter((player) => {
    if (!searchMatches(player, filters.query)) {
      return false;
    }
    if (filters.position !== "ALL" && normalizePos(player.player.position) !== filters.position) {
      return false;
    }
    if (filters.availability !== "ALL" && player.leagueState.availability !== filters.availability) {
      return false;
    }
    if (filters.identity !== "ALL" && player.identity.status !== filters.identity) {
      return false;
    }
    const injury = matchedIntelligence(player).injury?.status;
    if (filters.injury === "flagged" && !injury) {
      return false;
    }
    if (filters.injury === "none" && injury) {
      return false;
    }
    return true;
  });
}

export function comparePlayerNames(a: PlayerIntelligence, b: PlayerIntelligence): number {
  const byName = a.player.name.localeCompare(b.player.name, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }
  return a.identity.yahooPlayerKey.localeCompare(b.identity.yahooPlayerKey);
}

export function orderPlayersAlphabetically(players: PlayerIntelligence[]): PlayerIntelligence[] {
  return [...players].sort(comparePlayerNames);
}

function numericField(player: PlayerIntelligence, key: PlayersSortKey): number | undefined {
  const intel = matchedIntelligence(player);
  if (key === "weeklyProj") {
    return intel.weekly?.projectedPoints;
  }
  if (key === "weeklyEcr") {
    return intel.weekly?.ecr;
  }
  if (key === "rosProj") {
    return intel.restOfSeason?.projectedPoints;
  }
  if (key === "rosEcr") {
    return intel.restOfSeason?.ecr;
  }
  if (key === "owned") {
    return player.leagueState.percentOwned;
  }
  return undefined;
}

export function sortPlayers(
  players: PlayerIntelligence[],
  key: PlayersSortKey,
  direction: SortDirection,
): PlayerIntelligence[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...players].sort((a, b) => {
    if (key === "name") {
      return comparePlayerNames(a, b) * dir;
    }
    const left = numericField(a, key);
    const right = numericField(b, key);
    if (left === undefined && right === undefined) {
      return comparePlayerNames(a, b);
    }
    if (left === undefined) {
      return 1;
    }
    if (right === undefined) {
      return -1;
    }
    if (left !== right) {
      return (left - right) * dir;
    }
    return comparePlayerNames(a, b);
  });
}

export function coverageLabel(player: PlayerIntelligence): string {
  return intelligenceCoverage(player);
}
