import type { Player } from "../../types/draft";
import type { ExpertRankingRecord, MarketAdpRecord } from "../../types/sources";
import { identityKey } from "./normalizeName";
import { normalizePosition } from "./normalizePosition";

export interface DatasetIssue {
  message: string;
}

export function validateExpertRecords(records: ExpertRankingRecord[]): DatasetIssue[] {
  return validateRows(
    records.map((record) => ({
      id: record.playerId,
      name: record.name,
      position: record.position,
      rank: record.overallRank,
    })),
    "expert",
  );
}

export function validateMarketRecords(records: MarketAdpRecord[]): DatasetIssue[] {
  return validateRows(
    records.map((record) => ({
      id: record.playerId,
      name: record.name,
      position: record.position,
      adp: record.adp,
    })),
    "market",
  );
}

export function validatePlayers(players: Player[]): DatasetIssue[] {
  return validateRows(
    players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
    })),
    "player",
  );
}

function validateRows(
  rows: Array<{ id?: string; name?: string; position?: string; rank?: number; adp?: number }>,
  label: string,
): DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  const ids = new Set<string>();
  const identities = new Set<string>();

  rows.forEach((row, index) => {
    const rowNo = index + 1;
    if (!row.name?.trim()) {
      issues.push({ message: `${label} row ${rowNo}: missing name` });
    }
    const position = row.position ? normalizePosition(row.position) : undefined;
    if (!position) {
      issues.push({ message: `${label} row ${rowNo}: missing or unsupported position` });
    }
    if (row.rank !== undefined && (!(row.rank > 0) || Number.isNaN(row.rank))) {
      issues.push({ message: `${label} row ${rowNo}: invalid rank` });
    }
    if (row.adp !== undefined && (!(row.adp > 0) || Number.isNaN(row.adp))) {
      issues.push({ message: `${label} row ${rowNo}: invalid ADP` });
    }
    if (row.id) {
      if (ids.has(row.id)) {
        issues.push({ message: `${label} duplicate ID ${row.id}` });
      }
      ids.add(row.id);
    }
    if (row.name && position) {
      const key = identityKey(row.name, position, undefined);
      if (identities.has(key)) {
        issues.push({ message: `${label} duplicate identity ${key}` });
      }
      identities.add(key);
    }
  });

  return issues;
}

export function formatDatasetIssues(issues: DatasetIssue[]): string {
  return issues.map((issue) => `- ${issue.message}`).join("\n");
}
