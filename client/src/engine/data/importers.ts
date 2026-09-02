import type { Position } from "../../types/draft";
import type {
  ExpertRankingRecord,
  ExpertRankingSource,
  MarketADPSource,
  MarketAdpRecord,
  MarketSourceMeta,
} from "../../types/sources";
import { normalizePosition } from "./playerMatch";
import { identityKey } from "./normalizeName";

export interface ImportIssue {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult<T> {
  records: T[];
  errors: ImportIssue[];
}

type RawRow = Record<string, unknown>;

const NAME_KEYS = ["name", "player", "player_name", "playername"];
const TEAM_KEYS = ["team", "nfl_team", "nflteam"];
const POS_KEYS = ["position", "pos"];
const ADP_KEYS = ["adp", "average_draft_position", "avg", "consensus_adp"];
const POS_ADP_KEYS = ["positionaladp", "positional_adp", "pos_adp", "position_adp"];
const RANK_KEYS = ["overallrank", "overall_rank", "rank", "expert_rank"];
const POS_RANK_KEYS = ["positionalrank", "positional_rank", "pos_rank"];
const SOURCE_KEYS = ["source"];
const ID_KEYS = ["playerid", "player_id", "id"];

function readField(row: RawRow, keys: string[]): unknown {
  const entries = Object.entries(row);
  for (const key of keys) {
    const match = entries.find(([name]) => name.toLowerCase().replace(/[\s-]/g, "") === key.replace(/_/g, ""));
    if (match && match[1] !== undefined && match[1] !== "") {
      return match[1];
    }
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asPosition(value: unknown): Position | undefined {
  const text = asString(value);
  return text ? normalizePosition(text) : undefined;
}

export function parseCsv(text: string): RawRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: RawRow = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function validateAndTrackDuplicates(
  name: string,
  position: Position,
  seen: Set<string>,
  row: number,
  errors: ImportIssue[],
): boolean {
  const key = identityKey(name, position);
  if (seen.has(key)) {
    errors.push({ row, message: `Duplicate player: ${name} (${position})` });
    return false;
  }
  seen.add(key);
  return true;
}

export function importMarketAdp(rows: RawRow[], fallbackSource = "Imported ADP"): ImportResult<MarketAdpRecord> {
  const records: MarketAdpRecord[] = [];
  const errors: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const name = asString(readField(row, NAME_KEYS));
    const position = asPosition(readField(row, POS_KEYS));
    const adp = asNumber(readField(row, ADP_KEYS));

    if (!name) {
      errors.push({ row: rowNumber, field: "name", message: "Missing player name" });
      return;
    }
    if (!position) {
      errors.push({ row: rowNumber, field: "position", message: "Missing position" });
      return;
    }
    if (adp === undefined || adp <= 0) {
      errors.push({ row: rowNumber, field: "adp", message: "Invalid ADP" });
      return;
    }
    if (!validateAndTrackDuplicates(name, position, seen, rowNumber, errors)) {
      return;
    }

    records.push({
      playerId: asString(readField(row, ID_KEYS)),
      name,
      team: asString(readField(row, TEAM_KEYS)),
      position,
      adp,
      positionalAdp: asNumber(readField(row, POS_ADP_KEYS)),
      source: asString(readField(row, SOURCE_KEYS)) ?? fallbackSource,
    });
  });

  return { records, errors };
}

export function importExpertRankings(
  rows: RawRow[],
  fallbackSource = "Imported Expert",
): ImportResult<ExpertRankingRecord> {
  const records: ExpertRankingRecord[] = [];
  const errors: ImportIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const name = asString(readField(row, NAME_KEYS));
    const position = asPosition(readField(row, POS_KEYS));
    const overallRank = asNumber(readField(row, RANK_KEYS));

    if (!name) {
      errors.push({ row: rowNumber, field: "name", message: "Missing player name" });
      return;
    }
    if (!position) {
      errors.push({ row: rowNumber, field: "position", message: "Missing position" });
      return;
    }
    if (overallRank === undefined || overallRank <= 0) {
      errors.push({ row: rowNumber, field: "rank", message: "Invalid expert rank" });
      return;
    }
    if (!validateAndTrackDuplicates(name, position, seen, rowNumber, errors)) {
      return;
    }

    records.push({
      playerId: asString(readField(row, ID_KEYS)),
      name,
      team: asString(readField(row, TEAM_KEYS)),
      position,
      overallRank,
      positionalRank: asNumber(readField(row, POS_RANK_KEYS)),
      source: asString(readField(row, SOURCE_KEYS)) ?? fallbackSource,
    });
  });

  return { records, errors };
}

export function importMarketAdpFromJson(payload: unknown, source?: string): ImportResult<MarketAdpRecord> {
  const rows = Array.isArray(payload) ? payload : [];
  if (!Array.isArray(payload)) {
    return { records: [], errors: [{ row: 0, message: "JSON ADP payload must be an array" }] };
  }
  return importMarketAdp(rows as RawRow[], source);
}

export function importMarketAdpFromCsv(text: string, source?: string): ImportResult<MarketAdpRecord> {
  return importMarketAdp(parseCsv(text), source);
}

export function importExpertRankingsFromJson(payload: unknown, source?: string): ImportResult<ExpertRankingRecord> {
  if (!Array.isArray(payload)) {
    return { records: [], errors: [{ row: 0, message: "JSON expert payload must be an array" }] };
  }
  return importExpertRankings(payload as RawRow[], source);
}

export function importExpertRankingsFromCsv(text: string, source?: string): ImportResult<ExpertRankingRecord> {
  return importExpertRankings(parseCsv(text), source);
}

export function toMarketAdpSource(
  records: MarketAdpRecord[],
  meta: MarketSourceMeta,
): MarketADPSource {
  return {
    meta,
    async getAdp() {
      return records.map((record) => ({ ...meta, ...record, source: record.source || meta.source }));
    },
  };
}

export function toExpertRankingSource(
  records: ExpertRankingRecord[],
  label: string,
): ExpertRankingSource {
  return {
    label,
    async getRankings() {
      return records.map((record) => ({ ...record, source: record.source || label }));
    },
  };
}
