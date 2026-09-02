import espnRaw from "./imported/espn_2026_ppr_top300.json";
import { StaticExpertRankingSource } from "../engine/data/staticSources";
import { importExpertRankingsFromJson } from "../engine/data/importers";
import {
  ESPN_PPR_EXPERT_LABEL,
  type ExpertRankingRecord,
  type ExpertRankingSource,
} from "../types/sources";

type EspnRow = {
  playerId?: string;
  auctionValue?: number;
  byeWeek?: number;
  source?: string;
};

export function loadEspn2026PprRankings(): ExpertRankingRecord[] {
  const imported = importExpertRankingsFromJson(espnRaw, ESPN_PPR_EXPERT_LABEL);
  if (import.meta.env.DEV && imported.errors.length) {
    console.warn("[ffc] ESPN import issues:", imported.errors);
  }
  const extras = new Map(
    (espnRaw as EspnRow[]).map((row) => [row.playerId, row]),
  );

  return imported.records.map((record) => {
    const extra = extras.get(record.playerId);
    return {
      ...record,
      auctionValue: extra?.auctionValue ?? record.auctionValue,
      byeWeek: extra?.byeWeek ?? record.byeWeek,
      source: extra?.source ?? record.source,
    };
  });
}

export const espn2026PprSource: ExpertRankingSource = new StaticExpertRankingSource(
  ESPN_PPR_EXPERT_LABEL,
  loadEspn2026PprRankings(),
);
