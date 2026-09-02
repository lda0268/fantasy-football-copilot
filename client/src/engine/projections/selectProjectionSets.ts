import type { Position } from "../../types/draft";
import type {
  PlayerProjection,
  ProjectionSetCoverage,
  SelectedProjectionSets,
} from "../../types/projections";
import { identityKey } from "../data/normalizeName";
import { uniqueProjectionSets } from "./parseProjectionCsv";

const CONSENSUS_NAME = /projection(s)?\s+consensus/i;
const SKILL: Position[] = ["QB", "RB", "WR", "TE"];

export function describeProjectionSets(projections: PlayerProjection[]): ProjectionSetCoverage[] {
  const sets = uniqueProjectionSets(projections);
  return sets.map((set) => {
    const rows = projections.filter((item) => item.projectionSetId === set.setId);
    const identities = new Map<string, number>();
    const byPosition: Partial<Record<Position, number>> = {};

    for (const row of rows) {
      const key = identityKey(row.name, row.position, row.team);
      identities.set(key, (identities.get(key) ?? 0) + 1);
      byPosition[row.position] = (byPosition[row.position] ?? 0) + 1;
    }

    const uniquePlayers = identities.size;
    const duplicates = [...identities.values()].filter((count) => count > 1).length;
    const skillCount = SKILL.reduce((sum, position) => sum + (byPosition[position] ?? 0), 0);

    return {
      set,
      rowCount: rows.length,
      uniquePlayers,
      duplicates,
      byPosition,
      skillCount,
      kickerCount: byPosition.K ?? 0,
      defenseCount: byPosition.DEF ?? 0,
    };
  });
}

function isConsensus(coverage: ProjectionSetCoverage): boolean {
  return CONSENSUS_NAME.test(coverage.set.setName);
}

function prefersSeason2026(coverage: ProjectionSetCoverage): number {
  return coverage.set.season === "2026" || coverage.set.season === "26" ? 1 : 0;
}

function betterCoverage(
  a: ProjectionSetCoverage | undefined,
  b: ProjectionSetCoverage,
  score: (item: ProjectionSetCoverage) => number,
): ProjectionSetCoverage {
  if (!a) {
    return b;
  }
  const scoreA = score(a);
  const scoreB = score(b);
  if (scoreB !== scoreA) {
    return scoreB > scoreA ? b : a;
  }
  if (b.duplicates !== a.duplicates) {
    return b.duplicates < a.duplicates ? b : a;
  }
  if (prefersSeason2026(b) !== prefersSeason2026(a)) {
    return prefersSeason2026(b) > prefersSeason2026(a) ? b : a;
  }
  return a;
}

/**
 * Choose consensus coverage without averaging sets.
 * Skill (QB/RB/WR/TE), kickers, and team defenses may come from different
 * consensus set IDs when those files split categories.
 */
export function selectPrimaryProjectionSets(
  projections: PlayerProjection[],
): SelectedProjectionSets {
  const consensus = describeProjectionSets(projections).filter(isConsensus);
  const pool = consensus.length > 0 ? consensus : describeProjectionSets(projections);

  const skill = pool.reduce<ProjectionSetCoverage | undefined>(
    (best, item) => betterCoverage(best, item, (coverage) => coverage.skillCount),
    undefined,
  );
  let kicker = pool.reduce<ProjectionSetCoverage | undefined>(
    (best, item) => betterCoverage(best, item, (coverage) => coverage.kickerCount),
    undefined,
  );
  let defense = pool.reduce<ProjectionSetCoverage | undefined>(
    (best, item) => betterCoverage(best, item, (coverage) => coverage.defenseCount),
    undefined,
  );

  if (skill && (skill.kickerCount >= 8 || (kicker && kicker.set.setId === skill.set.setId))) {
    kicker = skill.kickerCount > 0 ? skill : kicker;
  }
  if (skill && (skill.defenseCount >= 8 || (defense && defense.set.setId === skill.set.setId))) {
    defense = skill.defenseCount > 0 ? skill : defense;
  }

  const parts = [
    skill ? `skill set ${skill.set.setId} (${skill.set.setName}, ${skill.skillCount} skill rows)` : "no skill set",
    kicker ? `K set ${kicker.set.setId} (${kicker.kickerCount} K)` : "no K set",
    defense ? `DEF set ${defense.set.setId} (${defense.defenseCount} DEF)` : "no DEF set",
  ];

  return {
    skill,
    kicker,
    defense,
    reason: `Selected the most complete consensus redraft coverage without averaging: ${parts.join("; ")}.`,
  };
}

export function projectionsFromSelectedSets(
  projections: PlayerProjection[],
  selected: SelectedProjectionSets,
): { projections: PlayerProjection[]; skippedDuplicates: string[] } {
  const chosen: PlayerProjection[] = [];
  const skippedDuplicates: string[] = [];

  function take(coverage: ProjectionSetCoverage | undefined, positions: Position[]): void {
    if (!coverage) {
      return;
    }
    const rows = projections.filter(
      (row) => row.projectionSetId === coverage.set.setId && positions.includes(row.position),
    );
    const grouped = new Map<string, PlayerProjection[]>();
    for (const row of rows) {
      const key = identityKey(row.name, row.position, row.team);
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }
    for (const [key, list] of grouped) {
      if (list.length > 1) {
        skippedDuplicates.push(key);
        continue;
      }
      chosen.push(list[0]);
    }
  }

  take(selected.skill, SKILL);
  take(selected.kicker, ["K"]);
  take(selected.defense, ["DEF"]);
  return { projections: chosen, skippedDuplicates };
}
