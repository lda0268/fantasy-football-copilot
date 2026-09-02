import type { Player } from "../../types/draft";
import type { ExpertRankingRecord, MarketAdpRecord } from "../../types/sources";
import { matchByIdentity } from "./playerMatch";

export interface MergeReport {
  matched: number;
  unmatched: string[];
  ambiguous: string[];
}

export function mergeMarketAdp(
  players: Player[],
  records: MarketAdpRecord[],
): { players: Player[]; report: MergeReport } {
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  let matched = 0;

  const next = players.map((player) => {
    const result = matchByIdentity(player, records);
    if (result.status === "ambiguous") {
      ambiguous.push(player.name);
      return player;
    }
    if (result.status !== "matched" || !result.record) {
      unmatched.push(player.name);
      return {
        ...player,
        adp: undefined,
        positionalAdp: undefined,
        adpSource: undefined,
      };
    }

    matched += 1;
    return {
      ...player,
      adp: result.record.adp,
      positionalAdp: result.record.positionalAdp,
      adpSource: result.record.source,
      team: player.team || result.record.team || player.team,
    };
  });

  return { players: next, report: { matched, unmatched, ambiguous } };
}

export function mergeExpertRankings(
  players: Player[],
  records: ExpertRankingRecord[],
): { players: Player[]; report: MergeReport } {
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  let matched = 0;

  const next = players.map((player) => {
    const result = matchByIdentity(player, records);
    if (result.status === "ambiguous") {
      ambiguous.push(player.name);
      return player;
    }
    if (result.status !== "matched" || !result.record) {
      unmatched.push(player.name);
      return {
        ...player,
        expertOverallRank: undefined,
        expertPositionalRank: undefined,
        expertSource: undefined,
      };
    }

    matched += 1;
    return {
      ...player,
      expertOverallRank: result.record.overallRank,
      expertPositionalRank: result.record.positionalRank,
      expertSource: result.record.source,
    };
  });

  return { players: next, report: { matched, unmatched, ambiguous } };
}
