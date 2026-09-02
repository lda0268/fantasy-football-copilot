import adpRaw from "./imported/superflex_consensus_adp_10team_ppr.json";
import { StaticMarketAdpSource } from "../engine/data/staticSources";
import { importMarketAdpFromJson } from "../engine/data/importers";
import {
  SUPERFLEX_MARKET_LABEL,
  type MarketADPSource,
  type MarketAdpRecord,
  type MarketSourceMeta,
} from "../types/sources";

export const SUPERFLEX_CONSENSUS_FILE_META: MarketSourceMeta = {
  source: SUPERFLEX_MARKET_LABEL,
  leagueSize: 10,
  scoringFormat: "PPR",
  leagueType: "Redraft",
  superflex: true,
  updatedDate: "2026-08-31",
};

export function loadSuperflexConsensusAdp(): MarketAdpRecord[] {
  const imported = importMarketAdpFromJson(adpRaw, SUPERFLEX_MARKET_LABEL);
  if (import.meta.env.DEV && imported.errors.length) {
    console.warn("[ffc] Superflex ADP import issues:", imported.errors);
  }
  return imported.records.map((record) => ({
    ...SUPERFLEX_CONSENSUS_FILE_META,
    ...record,
    source: record.source || SUPERFLEX_MARKET_LABEL,
  }));
}

export const superflexConsensusAdpSource: MarketADPSource = new StaticMarketAdpSource(
  SUPERFLEX_CONSENSUS_FILE_META,
  loadSuperflexConsensusAdp(),
);
