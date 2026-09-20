import { parseError } from "../errors.js";
import { asArray, isPlainObject, readNumber, readStatsObject, readString } from "../parse.js";
import type {
  FantasyProsRosProjection,
  FantasyProsScoring,
  FantasyProsScoringPoints,
  FantasyProsWeeklyProjection,
} from "../types.js";

export function parseWeeklyProjections(
  payload: unknown,
  week: number,
  scoring: FantasyProsScoring,
): FantasyProsWeeklyProjection[] {
  return parseProjectionBlocks(payload).map((block, index) => {
    const base = normalizeProjection(block, index, scoring);
    return { ...base, week };
  });
}

export function parseRosProjections(
  payload: unknown,
  scoring: FantasyProsScoring,
): FantasyProsRosProjection[] {
  return parseProjectionBlocks(payload).map((block, index) => normalizeProjection(block, index, scoring));
}

function parseProjectionBlocks(payload: unknown): Record<string, unknown>[] {
  const root = isPlainObject(payload) ? payload : {};
  const list = asArray(root.players);
  const source = list.length > 0 ? list : Array.isArray(payload) ? payload : [];
  return source.map((item, index) => {
    if (!isPlainObject(item)) {
      throw parseError(`FantasyPros projection at index ${index} is malformed.`);
    }
    return item;
  });
}

function normalizeProjection(
  block: Record<string, unknown>,
  index: number,
  scoring: FantasyProsScoring,
): Omit<FantasyProsWeeklyProjection, "week"> {
  const fantasyProsId = readString(block.fpid) ?? readString(block.player_id);
  const name = readString(block.name) ?? readString(block.player_name);
  if (!fantasyProsId) {
    throw parseError(`FantasyPros projection at index ${index} is missing player id.`);
  }
  if (!name) {
    throw parseError(`FantasyPros projection at index ${index} is missing name.`);
  }

  const stats = readStatsObject(block.stats) ?? {};
  const byScoring = readScoringPoints(stats);
  const fantasyPoints = pointsForScoring(byScoring, scoring);

  const projection: Omit<FantasyProsWeeklyProjection, "week"> = {
    fantasyProsId,
    name,
    scoring,
  };
  const team = readString(block.team_id) ?? readString(block.player_team_id);
  if (team) {
    projection.team = team;
  }
  const position = readString(block.position_id) ?? readString(block.player_position_id);
  if (position) {
    projection.position = position;
  }
  if (fantasyPoints !== undefined) {
    projection.fantasyPoints = fantasyPoints;
  }
  if (byScoring.standard !== undefined || byScoring.halfPpr !== undefined || byScoring.ppr !== undefined) {
    projection.fantasyPointsByScoring = byScoring;
  }

  const passingYards = readNumber(stats.pass_yds);
  const passingTouchdowns = readNumber(stats.pass_tds);
  const interceptions = readNumber(stats.pass_ints);
  const rushingYards = readNumber(stats.rush_yds);
  const rushingTouchdowns = readNumber(stats.rush_tds);
  const receptions = readNumber(stats.rec_rec);
  const receivingYards = readNumber(stats.rec_yds);
  const receivingTouchdowns = readNumber(stats.rec_tds);
  if (passingYards !== undefined) {
    projection.passingYards = passingYards;
  }
  if (passingTouchdowns !== undefined) {
    projection.passingTouchdowns = passingTouchdowns;
  }
  if (interceptions !== undefined) {
    projection.interceptions = interceptions;
  }
  if (rushingYards !== undefined) {
    projection.rushingYards = rushingYards;
  }
  if (rushingTouchdowns !== undefined) {
    projection.rushingTouchdowns = rushingTouchdowns;
  }
  if (receptions !== undefined) {
    projection.receptions = receptions;
  }
  if (receivingYards !== undefined) {
    projection.receivingYards = receivingYards;
  }
  if (receivingTouchdowns !== undefined) {
    projection.receivingTouchdowns = receivingTouchdowns;
  }
  return projection;
}

function readScoringPoints(stats: Record<string, unknown>): FantasyProsScoringPoints {
  const points: FantasyProsScoringPoints = {};
  const standard = readNumber(stats.points);
  const halfPpr = readNumber(stats.points_half);
  const ppr = readNumber(stats.points_ppr);
  if (standard !== undefined) {
    points.standard = standard;
  }
  if (halfPpr !== undefined) {
    points.halfPpr = halfPpr;
  }
  if (ppr !== undefined) {
    points.ppr = ppr;
  }
  return points;
}

function pointsForScoring(points: FantasyProsScoringPoints, scoring: FantasyProsScoring): number | undefined {
  if (scoring === "ppr") {
    return points.ppr;
  }
  if (scoring === "half_ppr") {
    return points.halfPpr;
  }
  return points.standard;
}
