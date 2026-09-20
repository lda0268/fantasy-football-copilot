import { CORE_POSITIONS } from "../config.js";
import { isCorePosition } from "../rosterNeeds.js";
import { normalizeNflPosition } from "../../playerIdentity/normalize.js";
import type { CopilotPosition } from "../types.js";

export type CopilotV2ReferenceRow = {
  fantasyProsId: string;
  position?: string;
  fantasyPoints?: number;
  rank?: number;
};

export type CopilotV2ReferenceDatasets = {
  weeklyProjections?: CopilotV2ReferenceRow[];
  rosProjections?: CopilotV2ReferenceRow[];
  weeklyRankings?: CopilotV2ReferenceRow[];
  rosRankings?: CopilotV2ReferenceRow[];
};

export type PositionSignalPool = {
  weeklyProjection: number[];
  weeklyEcr: number[];
  rosProjection: number[];
  rosEcr: number[];
};

export type PositionReferenceSizes = {
  weeklyProjection: number;
  weeklyEcr: number;
  rosProjection: number;
  rosEcr: number;
};

export type CopilotV2ReferencePopulations = Record<CopilotPosition, PositionReferenceSizes>;

function emptyPool(): PositionSignalPool {
  return { weeklyProjection: [], weeklyEcr: [], rosProjection: [], rosEcr: [] };
}

function emptySizes(): PositionReferenceSizes {
  return { weeklyProjection: 0, weeklyEcr: 0, rosProjection: 0, rosEcr: 0 };
}

function corePosition(value: string | undefined): CopilotPosition | undefined {
  const normalized = normalizeNflPosition(value);
  return isCorePosition(normalized) ? normalized : undefined;
}

function uniqueNumericById(
  rows: CopilotV2ReferenceRow[] | undefined,
  read: (row: CopilotV2ReferenceRow) => number | undefined,
): Map<CopilotPosition, number[]> {
  const grouped = new Map<CopilotPosition, Map<string, number[]>>();
  for (const row of rows ?? []) {
    const position = corePosition(row.position);
    const value = read(row);
    if (!position || value === undefined || !Number.isFinite(value)) {
      continue;
    }
    const byId = grouped.get(position) ?? new Map<string, number[]>();
    const list = byId.get(row.fantasyProsId) ?? [];
    list.push(value);
    byId.set(row.fantasyProsId, list);
    grouped.set(position, byId);
  }

  const pools = new Map<CopilotPosition, number[]>();
  for (const [position, byId] of grouped) {
    const values: number[] = [];
    for (const observed of byId.values()) {
      const unique = [...new Set(observed)];
      if (unique.length !== 1) {
        continue;
      }
      values.push(unique[0] as number);
    }
    pools.set(position, values);
  }
  return pools;
}

export function emptyReferencePopulations(): CopilotV2ReferencePopulations {
  return Object.fromEntries(CORE_POSITIONS.map((position) => [position, emptySizes()])) as CopilotV2ReferencePopulations;
}

export function buildPositionReferencePools(datasets: CopilotV2ReferenceDatasets = {}): Map<CopilotPosition, PositionSignalPool> {
  const weeklyProjection = uniqueNumericById(datasets.weeklyProjections, (row) => row.fantasyPoints);
  const rosProjection = uniqueNumericById(datasets.rosProjections, (row) => row.fantasyPoints);
  const weeklyEcr = uniqueNumericById(datasets.weeklyRankings, (row) => row.rank);
  const rosEcr = uniqueNumericById(datasets.rosRankings, (row) => row.rank);

  const pools = new Map<CopilotPosition, PositionSignalPool>();
  for (const position of CORE_POSITIONS) {
    const pool = emptyPool();
    pool.weeklyProjection = weeklyProjection.get(position) ?? [];
    pool.weeklyEcr = weeklyEcr.get(position) ?? [];
    pool.rosProjection = rosProjection.get(position) ?? [];
    pool.rosEcr = rosEcr.get(position) ?? [];
    pools.set(position, pool);
  }
  return pools;
}

export function summarizeReferencePopulations(
  pools: Map<CopilotPosition, PositionSignalPool>,
): CopilotV2ReferencePopulations {
  const summary = emptyReferencePopulations();
  for (const position of CORE_POSITIONS) {
    const pool = pools.get(position) ?? emptyPool();
    summary[position] = {
      weeklyProjection: pool.weeklyProjection.length,
      weeklyEcr: pool.weeklyEcr.length,
      rosProjection: pool.rosProjection.length,
      rosEcr: pool.rosEcr.length,
    };
  }
  return summary;
}

/**
 * Percentile of `value` in a position reference sample.
 * p = (count_strictly_worse + 0.5 * count_equal) / n
 * Higher projection is better; lower ECR is better.
 * Empty sample returns undefined (signal cannot be normalized).
 */
export function referencePercentile(values: number[], value: number, higherIsBetter: boolean): number | undefined {
  const n = values.length;
  if (n === 0) {
    return undefined;
  }
  let worse = 0;
  let equal = 0;
  for (const item of values) {
    if (item === value) {
      equal += 1;
    } else if (higherIsBetter ? item < value : item > value) {
      worse += 1;
    }
  }
  return (worse + 0.5 * equal) / n;
}
