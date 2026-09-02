import type { ProjectionImportReport, PlayerProjection } from "../types/projections";
import { DEFAULT_LEAGUE } from "../types/league";
import { parseProjectionCsv } from "../engine/projections/parseProjectionCsv";
import {
  describeProjectionSets,
  projectionsFromSelectedSets,
  selectPrimaryProjectionSets,
} from "../engine/projections/selectProjectionSets";
import { mergeProjectionsOntoPlayers } from "../engine/projections/mergeProjections";
import type { Player } from "../types/draft";

const csvModules = import.meta.glob(
  [
    "./imported/projection-set-preseason-all-2026.csv",
    "../../projection-set-preseason-all-2026.csv",
    "../../../projection-set-preseason-all-2026.csv",
  ],
  {
    query: "?raw",
    eager: true,
    import: "default",
  },
) as Record<string, string>;

export const PROJECTION_CSV_FILENAME = "projection-set-preseason-all-2026.csv";

export function loadProjectionCsvText(): string | undefined {
  const imported = Object.entries(csvModules).find(([path]) => path.includes("/imported/"));
  return (imported?.[1] ?? Object.values(csvModules)[0]) || undefined;
}

export function loadPrimaryPlayerProjections(csvText = loadProjectionCsvText()): {
  projections: PlayerProjection[];
  skippedDuplicates: string[];
  parsed: ReturnType<typeof parseProjectionCsv> | undefined;
  selected: ReturnType<typeof selectPrimaryProjectionSets> | undefined;
} {
  if (!csvText) {
    return { projections: [], skippedDuplicates: [], parsed: undefined, selected: undefined };
  }

  const parsed = parseProjectionCsv(csvText);
  const selected = selectPrimaryProjectionSets(parsed.projections);
  const { projections, skippedDuplicates } = projectionsFromSelectedSets(parsed.projections, selected);
  return { projections, skippedDuplicates, parsed, selected };
}

export function attachProjectionsToUniverse(players: Player[], csvText = loadProjectionCsvText()) {
  const loaded = loadPrimaryPlayerProjections(csvText);
  const merged = mergeProjectionsOntoPlayers(players, loaded.projections, DEFAULT_LEAGUE);

  const report: ProjectionImportReport = {
    csvRowsLoaded: loaded.parsed?.rowsLoaded ?? 0,
    setsFound: loaded.parsed ? describeProjectionSets(loaded.parsed.projections) : [],
    selected: loaded.selected ?? { reason: `No ${PROJECTION_CSV_FILENAME} found in client/src/data/imported/.` },
    offensivePlayers: loaded.projections.filter((item) => ["QB", "RB", "WR", "TE"].includes(item.position)).length,
    kickers: loaded.projections.filter((item) => item.position === "K").length,
    defenses: loaded.projections.filter((item) => item.position === "DEF").length,
    excludedIdpRows: loaded.parsed?.idpRows.length ?? 0,
    matchedToUniverse: merged.report.matchedToUniverse,
    unmatchedProjections: merged.report.unmatchedProjections,
    universeWithoutProjection: merged.report.universeWithoutProjection,
    duplicateProjectionRecords: [
      ...merged.report.duplicateProjectionRecords,
      ...loaded.skippedDuplicates,
    ],
    ambiguousProjectionRecords: merged.report.ambiguousProjectionRecords,
  };

  return { players: merged.players, report };
}

export function formatProjectionImportReport(report: ProjectionImportReport): string {
  const selectedIds = [
    report.selected.skill?.set.setId,
    report.selected.kicker?.set.setId,
    report.selected.defense?.set.setId,
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  return [
    `CSV rows: ${report.csvRowsLoaded}`,
    `sets: ${report.setsFound.length}`,
    `selected set IDs: ${selectedIds.join(", ") || "none"}`,
    `QB/RB/WR/TE: ${report.offensivePlayers}`,
    `K: ${report.kickers}`,
    `DEF: ${report.defenses}`,
    `IDP excluded: ${report.excludedIdpRows}`,
    `matched: ${report.matchedToUniverse}`,
    `unmatched projections: ${report.unmatchedProjections.length}`,
    `universe without projection: ${report.universeWithoutProjection.length}`,
  ].join(" · ");
}
