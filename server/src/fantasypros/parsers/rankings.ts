import { parseError } from "../errors.js";
import { asArray, isPlainObject, readNumber, readString } from "../parse.js";
import type { FantasyProsRanking, FantasyProsRankingType } from "../types.js";

export function parseFantasyProsRankings(
  payload: unknown,
  rankingType: FantasyProsRankingType,
): FantasyProsRanking[] {
  const root = isPlainObject(payload) ? payload : {};
  const list = asArray(root.players);
  const source = list.length > 0 ? list : Array.isArray(payload) ? payload : [];
  return source.map((item, index) => normalizeRanking(item, index, rankingType));
}

function normalizeRanking(
  value: unknown,
  index: number,
  rankingType: FantasyProsRankingType,
): FantasyProsRanking {
  if (!isPlainObject(value)) {
    throw parseError(`FantasyPros ranking at index ${index} is malformed.`);
  }
  const fantasyProsId = readString(value.player_id) ?? readString(value.fpid);
  const name = readString(value.player_name) ?? readString(value.name);
  const rank = readNumber(value.rank_ecr) ?? readNumber(value.rank);
  if (!fantasyProsId) {
    throw parseError(`FantasyPros ranking at index ${index} is missing player id.`);
  }
  if (!name) {
    throw parseError(`FantasyPros ranking at index ${index} is missing name.`);
  }
  if (rank === undefined) {
    throw parseError(`FantasyPros ranking at index ${index} is missing rank.`);
  }

  const ranking: FantasyProsRanking = {
    fantasyProsId,
    name,
    rankingType,
    rank,
  };
  const team = readString(value.player_team_id) ?? readString(value.team_id);
  if (team) {
    ranking.team = team;
  }
  const position = readString(value.player_position_id) ?? readString(value.position_id);
  if (position) {
    ranking.position = position.split(",")[0];
  }
  const positionRank = readString(value.pos_rank);
  if (positionRank) {
    ranking.positionRank = positionRank;
  }
  const tier = readNumber(value.tier);
  if (tier !== undefined) {
    ranking.tier = tier;
  }
  return ranking;
}
