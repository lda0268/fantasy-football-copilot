import type { Position } from "../../types/draft";
import type { PlayerProjection, ProjectionSet } from "../../types/projections";
import { parseCsv } from "../data/importers";
import { isIdpPosition, normalizePosition } from "../data/normalizePosition";

export const PROJECTION_SOURCE_LABEL = "2026 Preseason Projection Sets";

type RawRow = Record<string, unknown>;

function read(row: RawRow, key: string): unknown {
  const wanted = key.toLowerCase().replace(/_/g, "-");
  const match = Object.entries(row).find(
    ([name]) => name.toLowerCase().replace(/_/g, "-") === wanted,
  );
  return match?.[1];
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function optionalGroup<T extends Record<string, number | undefined>>(
  values: T,
): T | undefined {
  return Object.values(values).some((value) => value !== undefined) ? values : undefined;
}

export interface ParsedProjectionFile {
  rowsLoaded: number;
  projections: PlayerProjection[];
  idpRows: RawRow[];
  skippedMissingIdentity: number;
}

export function parseProjectionCsv(text: string): ParsedProjectionFile {
  const rows = parseCsv(text);
  const projections: PlayerProjection[] = [];
  const idpRows: RawRow[] = [];
  let skippedMissingIdentity = 0;

  for (const row of rows) {
    const name = asString(read(row, "name"));
    const rawPos = asString(read(row, "pos"));
    if (isIdpPosition(rawPos)) {
      idpRows.push(row);
      continue;
    }

    const position = normalizePosition(rawPos);
    if (!name || !position) {
      skippedMissingIdentity += 1;
      continue;
    }

    projections.push(rowToProjection(row, name, position));
  }

  return {
    rowsLoaded: rows.length,
    projections,
    idpRows,
    skippedMissingIdentity,
  };
}

function rowToProjection(row: RawRow, name: string, position: Position): PlayerProjection {
  const setId = asString(read(row, "set-id")) ?? "unknown";
  const setName = asString(read(row, "set-name")) ?? "Unknown set";

  return {
    sourcePlayerId: asString(read(row, "id")) ?? `${setId}-${name}-${position}`,
    name,
    team: asString(read(row, "team")) ?? "FA",
    position,
    projectionSetId: setId,
    projectionSetName: setName,
    games: asNumber(read(row, "ssn-gms")),
    season: asString(read(row, "ssn-ssn")),
    passing: optionalGroup({
      attempts: asNumber(read(row, "pass-att")),
      completions: asNumber(read(row, "pass-cmp")),
      yards: asNumber(read(row, "pass-yds")),
      touchdowns: asNumber(read(row, "pass-td")),
      interceptions: asNumber(read(row, "pass-int")),
      twoPointConversions: asNumber(read(row, "pass-2pt")),
    }),
    rushing: optionalGroup({
      attempts: asNumber(read(row, "rush-car")),
      yards: asNumber(read(row, "rush-yds")),
      touchdowns: asNumber(read(row, "rush-td")),
      twoPointConversions: asNumber(read(row, "rush-2pt")),
    }),
    receiving: optionalGroup({
      targets: asNumber(read(row, "rec-tgt")),
      receptions: asNumber(read(row, "rec-rec")),
      yards: asNumber(read(row, "rec-yds")),
      touchdowns: asNumber(read(row, "rec-td")),
      twoPointConversions: asNumber(read(row, "rec-2pt")),
    }),
    fumblesLost: asNumber(read(row, "fum-lost")),
    kicking: optionalGroup({
      extraPointsMade: asNumber(read(row, "kck-xpm")),
      extraPointsAttempted: asNumber(read(row, "kck-xpa")),
      fieldGoalsMade: asNumber(read(row, "kck-fgm")),
      fieldGoalsAttempted: asNumber(read(row, "kck-fga")),
    }),
    returns: optionalGroup({
      puntReturnYards: asNumber(read(row, "pr-yds")),
      puntReturnTouchdowns: asNumber(read(row, "pr-td")),
      kickReturnYards: asNumber(read(row, "kr-yds")),
      kickReturnTouchdowns: asNumber(read(row, "kr-td")),
    }),
    teamDefense: optionalGroup({
      sacks: asNumber(read(row, "tmd-sck")),
      interceptions: asNumber(read(row, "tmd-int")),
      fumbleRecoveries: asNumber(read(row, "tmd-fmr")),
      forcedFumbles: asNumber(read(row, "tmd-fmf")),
      safeties: asNumber(read(row, "tmd-saf")),
      touchdowns: asNumber(read(row, "tmd-td")),
      pointsAllowed: asNumber(read(row, "tmd-pa")),
      yardsAllowed: asNumber(read(row, "tmd-ya")),
      blockedKicks: asNumber(read(row, "tmd-blk")),
    }),
  };
}

export function uniqueProjectionSets(projections: PlayerProjection[]): ProjectionSet[] {
  const byId = new Map<string, ProjectionSet>();
  for (const projection of projections) {
    if (byId.has(projection.projectionSetId)) {
      continue;
    }
    byId.set(projection.projectionSetId, {
      setId: projection.projectionSetId,
      setName: projection.projectionSetName,
      season: projection.season,
      source: PROJECTION_SOURCE_LABEL,
    });
  }
  return [...byId.values()];
}
