import type { Position } from "./draft";

export interface ExpertRankingRecord {
  playerId?: string;
  name: string;
  team?: string;
  position: Position;
  overallRank: number;
  positionalRank?: number;
  source: string;
  auctionValue?: number;
  byeWeek?: number;
}

export interface ExpertRankingSource {
  readonly label: string;
  getRankings(): Promise<ExpertRankingRecord[]>;
}

export interface MarketAdpRecord {
  playerId?: string;
  name: string;
  team?: string;
  position: Position;
  adp: number;
  positionalAdp?: number;
  source: string;
  leagueSize?: number;
  scoringFormat?: string;
  leagueType?: string;
  superflex?: boolean;
  updatedDate?: string;
}

export interface MarketSourceMeta {
  source: string;
  leagueSize?: number;
  scoringFormat?: string;
  leagueType?: string;
  superflex?: boolean;
  updatedDate?: string;
}

export interface MarketADPSource {
  readonly meta: MarketSourceMeta;
  getAdp(): Promise<MarketAdpRecord[]>;
}

export const SUPERFLEX_CONSENSUS_META: MarketSourceMeta = {
  source: "Superflex Consensus",
  leagueSize: 10,
  scoringFormat: "PPR",
  leagueType: "Redraft",
  superflex: true,
  updatedDate: "2026-09-01",
};

export const ESPN_PPR_EXPERT_LABEL = "ESPN 2026 PPR Top 300";
export const SUPERFLEX_MARKET_LABEL = "10-Team Superflex Consensus ADP";
