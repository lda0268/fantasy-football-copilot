import type { PlayerIntelligence, YahooRosterPlayer } from "../api/types";
import { normalizePosition, type PositionFilter } from "./filterRecommendations";

export const DEPTH_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

export type RosterGroup = "starter" | "bench" | "ir";
export type InjuryFilter = "ALL" | "flagged" | "none";

export type RosterFilters = {
  query: string;
  position: PositionFilter;
  group: "ALL" | RosterGroup;
  injury: InjuryFilter;
};

export function userRoster(players: PlayerIntelligence[]): PlayerIntelligence[] {
  return players.filter((player) => player.leagueState.availability === "rostered_by_user");
}

export function yahooRosterAsIntelligence(players: YahooRosterPlayer[]): PlayerIntelligence[] {
  return players.map((player) => ({
    identity: {
      yahooPlayerKey: player.playerKey,
      yahooPlayerId: player.playerId,
      status: "unresolved",
      method: "none",
    },
    player: {
      name: player.name,
      team: player.editorialTeamAbbr,
      position: player.displayPosition,
    },
    leagueState: {
      availability: "rostered_by_user",
      rosterSlot: player.selectedPosition,
      byeWeek: player.byeWeek,
    },
    warnings: ["Intelligence unavailable"],
  }));
}

export function rosterGroup(slot?: string): RosterGroup {
  const value = slot?.trim().toUpperCase() ?? "";
  if (value === "IR" || value.startsWith("IR")) {
    return "ir";
  }
  if (value === "BN" || value === "BENCH") {
    return "bench";
  }
  return "starter";
}

export function orderRoster(players: PlayerIntelligence[]): PlayerIntelligence[] {
  const starters: PlayerIntelligence[] = [];
  const bench: PlayerIntelligence[] = [];
  const ir: PlayerIntelligence[] = [];
  for (const player of players) {
    const group = rosterGroup(player.leagueState.rosterSlot);
    if (group === "ir") {
      ir.push(player);
    } else if (group === "bench") {
      bench.push(player);
    } else {
      starters.push(player);
    }
  }
  return [...starters, ...bench, ...ir];
}

export function matchedIntelligence(player: PlayerIntelligence) {
  if (player.identity.status !== "matched") {
    return { weekly: undefined, restOfSeason: undefined, injury: undefined };
  }
  return { weekly: player.weekly, restOfSeason: player.restOfSeason, injury: player.injury };
}

export function intelligenceCoverage(player: PlayerIntelligence): string {
  if (player.identity.status !== "matched") {
    return "No FP intelligence";
  }
  const weekly = player.weekly?.projectedPoints !== undefined || player.weekly?.ecr !== undefined;
  const ros = player.restOfSeason?.projectedPoints !== undefined || player.restOfSeason?.ecr !== undefined;
  if (weekly && ros) {
    return "Weekly + ROS";
  }
  if (weekly) {
    return "Weekly only";
  }
  if (ros) {
    return "ROS only";
  }
  return "No FP intelligence";
}

export function filterRoster(players: PlayerIntelligence[], filters: RosterFilters): PlayerIntelligence[] {
  const query = filters.query.trim().toLowerCase();
  return players.filter((player) => {
    if (query) {
      const haystack = [player.player.name, player.player.team ?? "", player.player.position ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    if (filters.position !== "ALL" && normalizePosition(player.player.position) !== filters.position) {
      return false;
    }
    if (filters.group !== "ALL" && rosterGroup(player.leagueState.rosterSlot) !== filters.group) {
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

export function positionDepth(players: PlayerIntelligence[]): Array<{
  position: (typeof DEPTH_POSITIONS)[number];
  total: number;
  starters: number;
  bench: number;
}> {
  return DEPTH_POSITIONS.map((position) => {
    const atPosition = players.filter((player) => normalizePosition(player.player.position) === position);
    return {
      position,
      total: atPosition.length,
      starters: atPosition.filter((player) => rosterGroup(player.leagueState.rosterSlot) === "starter").length,
      bench: atPosition.filter((player) => rosterGroup(player.leagueState.rosterSlot) === "bench").length,
    };
  });
}

export function rosterHealth(players: PlayerIntelligence[]) {
  return {
    players: players.length,
    injuryFlags: players.filter((player) => Boolean(matchedIntelligence(player).injury?.status)).length,
    enriched: players.filter((player) => player.identity.status === "matched").length,
    unresolved: players.filter((player) => player.identity.status === "unresolved").length,
    ambiguous: players.filter((player) => player.identity.status === "ambiguous").length,
  };
}
