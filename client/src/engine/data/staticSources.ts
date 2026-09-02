import type { MarketAdpRecord, MarketADPSource, MarketSourceMeta } from "../../types/sources";
import type { ExpertRankingRecord, ExpertRankingSource } from "../../types/sources";

export class StaticMarketAdpSource implements MarketADPSource {
  constructor(
    public readonly meta: MarketSourceMeta,
    private readonly records: MarketAdpRecord[],
  ) {}

  async getAdp(): Promise<MarketAdpRecord[]> {
    return this.records.map((record) => ({
      ...this.meta,
      ...record,
      source: record.source || this.meta.source,
    }));
  }
}

export class StaticExpertRankingSource implements ExpertRankingSource {
  constructor(
    public readonly label: string,
    private readonly records: ExpertRankingRecord[],
  ) {}

  async getRankings(): Promise<ExpertRankingRecord[]> {
    return this.records.map((record) => ({ ...record, source: record.source || this.label }));
  }
}
