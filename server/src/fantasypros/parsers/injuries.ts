import { parseError } from "../errors.js";
import { asArray, isPlainObject, readString } from "../parse.js";
import type { FantasyProsInjury } from "../types.js";

export function parseFantasyProsInjuries(payload: unknown): FantasyProsInjury[] {
  const root = isPlainObject(payload) ? payload : {};
  const list = asArray(root.injuries);
  const source = list.length > 0 ? list : Array.isArray(payload) ? payload : [];
  return source.map((item, index) => normalizeInjury(item, index));
}

function normalizeInjury(value: unknown, index: number): FantasyProsInjury {
  if (!isPlainObject(value)) {
    throw parseError(`FantasyPros injury at index ${index} is malformed.`);
  }
  const name = readString(value.name) ?? readString(value.player_name);
  if (!name) {
    throw parseError(`FantasyPros injury at index ${index} is missing name.`);
  }

  const injury: FantasyProsInjury = { name };
  const fantasyProsId = readString(value.player_id) ?? readString(value.fpid);
  if (fantasyProsId) {
    injury.fantasyProsId = fantasyProsId;
  }
  const team = readString(value.team_id) ?? readString(value.player_team_id);
  if (team) {
    injury.team = team;
  }
  const position = readString(value.position_id) ?? readString(value.player_position_id);
  if (position) {
    injury.position = position.split(",")[0];
  }
  const injuryType = readString(value.injury_type) ?? readString(value.practice_report_injury_type);
  if (injuryType) {
    injury.injury = injuryType;
  }
  const status = readString(value.status) ?? readString(value.status_short);
  if (status) {
    injury.status = status;
  }
  const practiceStatus =
    readString(value.practice_3) ?? readString(value.practice_2) ?? readString(value.practice_1);
  if (practiceStatus) {
    injury.practiceStatus = practiceStatus;
  }
  const lastUpdated = readString(value.injury_update_date) ?? readString(value.last_updated);
  if (lastUpdated) {
    injury.lastUpdated = lastUpdated;
  }
  const probability = readString(value.probability_of_playing);
  if (probability) {
    injury.probabilityOfPlaying = probability;
  }
  return injury;
}
