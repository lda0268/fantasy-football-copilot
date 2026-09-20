import type { NflPosition } from "./types.js";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

const TEAM_ALIASES: Record<string, string> = {
  JAX: "JAC",
  JAC: "JAC",
  WSH: "WAS",
  WAS: "WAS",
};

const NFL_POSITIONS = new Set<NflPosition>(["QB", "RB", "WR", "TE", "K", "DEF"]);

const POSITION_ALIASES: Record<string, NflPosition> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DEF",
  DST: "DEF",
};

export function normalizePlayerName(name: string): string {
  const lowered = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[-–—]/g, " ")
    .replace(/\./g, "")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/'/g, "")
    .trim()
    .replace(/\s+/g, " ");

  if (!lowered) {
    return "";
  }

  const tokens = collapseInitialTokens(stripTrailingSuffixes(lowered.split(" ")));
  return tokens.join(" ");
}

function stripTrailingSuffixes(tokens: string[]): string[] {
  const next = [...tokens];
  while (next.length > 1 && SUFFIXES.has(next[next.length - 1] ?? "")) {
    next.pop();
  }
  return next;
}

function collapseInitialTokens(tokens: string[]): string[] {
  const collapsed: string[] = [];
  let initials = "";
  for (const token of tokens) {
    if (token.length === 1) {
      initials += token;
      continue;
    }
    if (initials) {
      collapsed.push(initials);
      initials = "";
    }
    collapsed.push(token);
  }
  if (initials) {
    collapsed.push(initials);
  }
  return collapsed;
}

export function normalizeTeamAbbr(team: string | undefined): string | undefined {
  if (!team) {
    return undefined;
  }
  const trimmed = team.trim().toUpperCase();
  if (!trimmed) {
    return undefined;
  }
  return TEAM_ALIASES[trimmed] ?? trimmed;
}

export function normalizeNflPosition(position: string | undefined): NflPosition | undefined {
  if (!position) {
    return undefined;
  }
  const key = position.trim().toUpperCase().replace(/[\s/]/g, "");
  if (!key || key === "BN" || key === "IR" || key === "FLEX" || key === "UTIL" || key === "OP" || key === "WRTE" || key === "WRT") {
    return undefined;
  }
  return POSITION_ALIASES[key];
}

export function yahooNflPosition(
  displayPosition: string | undefined,
  eligiblePositions: string[] | undefined,
): NflPosition | undefined {
  const fromDisplay = normalizeNflPosition(displayPosition);
  if (fromDisplay) {
    return fromDisplay;
  }
  for (const position of eligiblePositions ?? []) {
    const normalized = normalizeNflPosition(position);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

export function isNflPosition(position: string | undefined): position is NflPosition {
  return position !== undefined && NFL_POSITIONS.has(position as NflPosition);
}

export const TEAM_NORMALIZATION_MAP = TEAM_ALIASES;
