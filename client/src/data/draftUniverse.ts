import { ESPN_2026_PPR_SOURCE, type Player } from "../types/draft";
import type { ExpertRankingRecord, MarketAdpRecord } from "../types/sources";
import { matchByIdentity } from "../engine/data/playerMatch";
import { normalizePosition } from "../engine/data/normalizePosition";
import {
  formatDatasetIssues,
  validateExpertRecords,
  validateMarketRecords,
  validatePlayers,
} from "../engine/data/validateDataset";
import { attachProjectionsToUniverse, formatProjectionImportReport } from "./loadProjections";
import { loadEspn2026PprRankings } from "./loadEspnRankings";
import { loadSuperflexConsensusAdp } from "./loadSuperflexAdp";
import { getReplacementLevels } from "../engine/replacement";
import { DEFAULT_LEAGUE } from "../types/league";

export interface UniverseMergeReport {
  espnCount: number;
  adpCount: number;
  matched: number;
  espnOnly: string[];
  adpOnly: string[];
  ambiguous: string[];
}

function expertToPlayer(record: ExpertRankingRecord): Player {
  const position = normalizePosition(record.position) ?? record.position;
  const overallRank = record.overallRank;
  const positionalRank = record.positionalRank ?? overallRank;
  const source = record.source;

  return {
    id: record.playerId ?? `espn-${overallRank}-${record.name}`,
    name: record.name,
    team: record.team ?? "FA",
    position,
    projectedPoints: 0,
    positionalRank,
    espnOverallRank: overallRank,
    espnPositionalRank: positionalRank,
    espnAuctionValue: record.auctionValue ?? 0,
    espnByeWeek: record.byeWeek ?? 0,
    espnSource: ESPN_2026_PPR_SOURCE,
    expertOverallRank: overallRank,
    expertPositionalRank: positionalRank,
    expertSource: source,
    expert: {
      overallRank,
      positionalRank,
      auctionValue: record.auctionValue,
      byeWeek: record.byeWeek,
      source,
    },
    market: {
      adp: null,
      positionalAdp: null,
    },
    sourceProjectedPoints: 0,
    projectionSource: "source",
    projectionsAvailable: false,
    adp: undefined,
    positionalAdp: undefined,
    adpSource: undefined,
  };
}

export function mergeEspnWithAdp(
  expertRecords: ExpertRankingRecord[],
  adpRecords: MarketAdpRecord[],
): { players: Player[]; report: UniverseMergeReport } {
  const usedAdp = new Set<MarketAdpRecord>();
  const espnOnly: string[] = [];
  const ambiguous: string[] = [];
  let matched = 0;

  const players = expertRecords.map((record) => {
    const player = expertToPlayer(record);
    const result = matchByIdentity(player, adpRecords);
    if (result.status === "ambiguous") {
      ambiguous.push(player.name);
      return player;
    }
    if (result.status !== "matched" || !result.record) {
      espnOnly.push(player.name);
      return player;
    }

    usedAdp.add(result.record);
    matched += 1;
    const marketSource = result.record.source;
    return {
      ...player,
      adp: result.record.adp,
      positionalAdp: result.record.positionalAdp,
      adpSource: marketSource,
      market: {
        adp: result.record.adp,
        positionalAdp: result.record.positionalAdp ?? null,
        source: marketSource,
      },
    };
  });

  const adpOnly = adpRecords
    .filter((record) => !usedAdp.has(record))
    .map((record) => record.name);

  return {
    players,
    report: {
      espnCount: expertRecords.length,
      adpCount: adpRecords.length,
      matched,
      espnOnly,
      adpOnly,
      ambiguous,
    },
  };
}

export function formatMergeReport(report: UniverseMergeReport): string {
  return [
    `ESPN players: ${report.espnCount}`,
    `ADP records: ${report.adpCount}`,
    `matched: ${report.matched}`,
    `ESPN-only: ${report.espnOnly.length}`,
    `ADP-only: ${report.adpOnly.length}`,
    `ambiguous: ${report.ambiguous.length}`,
  ].join(" · ");
}

const espnRecords = loadEspn2026PprRankings();
const adpRecords = loadSuperflexConsensusAdp();
const merged = mergeEspnWithAdp(espnRecords, adpRecords);
const withProjections = attachProjectionsToUniverse(merged.players);

export const DRAFT_PLAYERS: Player[] = withProjections.players;
export const DRAFT_UNIVERSE_REPORT: UniverseMergeReport = merged.report;
export const PROJECTION_IMPORT_REPORT = withProjections.report;

if (import.meta.env.DEV) {
  const issues = [
    ...validateExpertRecords(espnRecords),
    ...validateMarketRecords(adpRecords),
    ...validatePlayers(DRAFT_PLAYERS),
  ];
  console.info(`[ffc] ${formatMergeReport(DRAFT_UNIVERSE_REPORT)}`);
  console.info(`[ffc] ${formatProjectionImportReport(PROJECTION_IMPORT_REPORT)}`);
  console.info("[ffc] selected projection sets:", PROJECTION_IMPORT_REPORT.selected.reason);
  const replacement = getReplacementLevels(DRAFT_PLAYERS, DEFAULT_LEAGUE);
  console.info("[ffc] replacement ranks/points:", {
    QB: replacement.QB,
    RB: replacement.RB,
    WR: replacement.WR,
    TE: replacement.TE,
    K: replacement.K,
    DEF: replacement.DEF,
  });
  if (PROJECTION_IMPORT_REPORT.unmatchedProjections.length) {
    console.info("[ffc] unmatched projections:", PROJECTION_IMPORT_REPORT.unmatchedProjections.slice(0, 40));
  }
  if (PROJECTION_IMPORT_REPORT.universeWithoutProjection.length && PROJECTION_IMPORT_REPORT.csvRowsLoaded > 0) {
    console.info(
      "[ffc] ESPN/ADP players without projection:",
      PROJECTION_IMPORT_REPORT.universeWithoutProjection.slice(0, 40),
    );
  }
  if (DRAFT_UNIVERSE_REPORT.espnOnly.length) {
    console.info("[ffc] ESPN-only (no ADP match):", DRAFT_UNIVERSE_REPORT.espnOnly.slice(0, 40));
  }
  if (DRAFT_UNIVERSE_REPORT.adpOnly.length) {
    console.info("[ffc] ADP-only (not in ESPN universe):", DRAFT_UNIVERSE_REPORT.adpOnly.slice(0, 40));
  }
  if (DRAFT_UNIVERSE_REPORT.ambiguous.length) {
    console.warn("[ffc] ambiguous matches:", DRAFT_UNIVERSE_REPORT.ambiguous);
  }
  if (issues.length) {
    console.warn("[ffc] dataset validation:\n" + formatDatasetIssues(issues));
  }
}
