import type { Position } from "../../types/draft";

const IDP_POSITIONS = new Set([
  "LB",
  "CB",
  "DE",
  "DT",
  "S",
  "DB",
  "OLB",
  "ILB",
  "MLB",
  "FS",
  "SS",
  "NB",
  "NT",
  "ED",
  "DL",
]);

export function compactPositionToken(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function isIdpPosition(value: string | undefined): boolean {
  const compact = compactPositionToken(value);
  return IDP_POSITIONS.has(compact);
}

export function normalizePosition(value: string | undefined): Position | undefined {
  if (!value) {
    return undefined;
  }

  const compact = compactPositionToken(value);
  if (compact === "DST" || compact === "ST" || compact === "TD" || compact === "DEF") {
    return "DEF";
  }
  if (compact === "PK" || compact === "K") {
    return "K";
  }
  if (compact === "QB" || compact === "RB" || compact === "WR" || compact === "TE") {
    return compact;
  }
  return undefined;
}

export function isPosition(value: string): value is Position {
  return normalizePosition(value) !== undefined;
}
