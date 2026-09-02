import type { Player } from "../types/draft";
import { getExpertOverallRank, getMarketAdp } from "./data/sourceFields";
import type { Recommendation } from "./recommendations";

export type PositionFilter = "ALL" | "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function playerMatchesQuery(player: Player, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }

  const compactQuery = normalizeSearchText(trimmed);
  const name = player.name.toLowerCase();
  const compactName = normalizeSearchText(player.name);
  const tokens = name.split(/[^a-z0-9]+/).filter(Boolean);

  return (
    name.includes(trimmed) ||
    compactName.includes(compactQuery) ||
    tokens.some((token) => token.startsWith(trimmed) || token.includes(trimmed)) ||
    player.team.toLowerCase().includes(trimmed) ||
    player.position.toLowerCase() === trimmed
  );
}

export function compareAvailablePlayers(
  a: Player,
  b: Player,
  scores?: Map<string, Recommendation>,
): number {
  const scoreA = scores?.get(a.id)?.score;
  const scoreB = scores?.get(b.id)?.score;
  if (scoreA !== undefined && scoreB !== undefined && scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  const adpA = getMarketAdp(a) ?? Number.POSITIVE_INFINITY;
  const adpB = getMarketAdp(b) ?? Number.POSITIVE_INFINITY;
  if (adpA !== adpB) {
    return adpA - adpB;
  }

  return (getExpertOverallRank(a) ?? 9999) - (getExpertOverallRank(b) ?? 9999);
}

export function filterAvailablePlayers(
  players: Player[],
  query: string,
  positionFilter: PositionFilter = "ALL",
  scores?: Map<string, Recommendation>,
): Player[] {
  return players
    .filter((player) => {
      const positionOk = positionFilter === "ALL" || player.position === positionFilter;
      return positionOk && playerMatchesQuery(player, query);
    })
    .sort((a, b) => compareAvailablePlayers(a, b, scores));
}

export function getEnterDraftCandidate(
  players: Player[],
  query: string,
  positionFilter: PositionFilter = "ALL",
): Player | null {
  if (!query.trim()) {
    return null;
  }

  const matches = filterAvailablePlayers(players, query, positionFilter);
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    return null;
  }

  const compactQuery = normalizeSearchText(query);
  if (compactQuery.length < 2) {
    return null;
  }

  const uniqueLastName = matches.filter((player) => {
    const tokens = player.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return tokens[tokens.length - 1]?.startsWith(query.trim().toLowerCase());
  });

  if (uniqueLastName.length === 1) {
    return uniqueLastName[0];
  }

  const strong = matches.filter((player) => {
    const compactName = normalizeSearchText(player.name);
    return compactName.includes(compactQuery);
  });

  return strong.length === 1 ? strong[0] : null;
}

export function positionFilterFromKey(key: string): PositionFilter | null {
  switch (key.toLowerCase()) {
    case "q":
      return "QB";
    case "r":
      return "RB";
    case "w":
      return "WR";
    case "t":
      return "TE";
    case "k":
      return "K";
    case "d":
      return "DEF";
    default:
      return null;
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object" || !("tagName" in target)) {
    return false;
  }

  const element = target as { tagName: string; isContentEditable?: boolean };
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(element.isContentEditable);
}

export function quickDraftPlayers(
  players: Player[],
  limit = 30,
  scores?: Map<string, Recommendation>,
): Player[] {
  return [...players]
    .sort((a, b) => compareAvailablePlayers(a, b, scores))
    .slice(0, limit);
}
