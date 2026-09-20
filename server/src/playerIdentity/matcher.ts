import type { FantasyProsPlayer } from "../fantasypros/types.js";
import { normalizeNflPosition, normalizePlayerName, normalizeTeamAbbr, yahooNflPosition } from "./normalize.js";
import type {
  PlayerIdentityMatch,
  PlayerIdentityReconciliation,
  PlayerIdentitySummary,
  YahooIdentityPlayer,
} from "./types.js";

type IndexedFantasyPros = {
  player: FantasyProsPlayer;
  name: string;
  team?: string;
  position?: ReturnType<typeof normalizeNflPosition>;
  yahooId?: string;
};

function indexKey(parts: Array<string | undefined>): string | undefined {
  if (parts.some((part) => !part)) {
    return undefined;
  }
  return parts.join("|");
}

function pushIndex(index: Map<string, IndexedFantasyPros[]>, key: string | undefined, row: IndexedFantasyPros): void {
  if (!key) {
    return;
  }
  const list = index.get(key);
  if (list) {
    list.push(row);
  } else {
    index.set(key, [row]);
  }
}

function uniquePlayers(rows: IndexedFantasyPros[]): IndexedFantasyPros[] {
  const seen = new Set<string>();
  const unique: IndexedFantasyPros[] = [];
  for (const row of rows) {
    if (seen.has(row.player.fantasyProsId)) {
      continue;
    }
    seen.add(row.player.fantasyProsId);
    unique.push(row);
  }
  return unique.sort((a, b) => a.player.fantasyProsId.localeCompare(b.player.fantasyProsId));
}

function idsFor(rows: IndexedFantasyPros[]): string {
  return uniquePlayers(rows)
    .map((row) => row.player.fantasyProsId)
    .join(", ");
}

function nameMatchAllowed(row: IndexedFantasyPros, yahooPlayerId: string): boolean {
  return !row.yahooId || row.yahooId === yahooPlayerId;
}

function matchFields(yahoo: YahooIdentityPlayer): Pick<PlayerIdentityMatch, "yahooPlayerKey" | "yahooPlayerId" | "yahooName"> {
  const fields: Pick<PlayerIdentityMatch, "yahooPlayerKey" | "yahooPlayerId" | "yahooName"> = {
    yahooPlayerKey: yahoo.playerKey,
    yahooName: yahoo.name,
  };
  if (yahoo.playerId) {
    fields.yahooPlayerId = yahoo.playerId;
  }
  return fields;
}

function matched(
  yahoo: YahooIdentityPlayer,
  row: IndexedFantasyPros,
  method: PlayerIdentityMatch["method"],
  confidence: PlayerIdentityMatch["confidence"],
  reasons: string[],
): PlayerIdentityMatch {
  return {
    ...matchFields(yahoo),
    fantasyProsId: row.player.fantasyProsId,
    fantasyProsName: row.player.name,
    status: "matched",
    method,
    confidence,
    reasons,
  };
}

function unresolved(yahoo: YahooIdentityPlayer, reasons: string[]): PlayerIdentityMatch {
  return {
    ...matchFields(yahoo),
    status: "unresolved",
    method: "none",
    confidence: "none",
    reasons,
  };
}

function ambiguous(yahoo: YahooIdentityPlayer, method: PlayerIdentityMatch["method"], reasons: string[]): PlayerIdentityMatch {
  return {
    ...matchFields(yahoo),
    status: "ambiguous",
    method,
    confidence: "none",
    reasons,
  };
}

function compareYahoo(a: YahooIdentityPlayer, b: YahooIdentityPlayer): number {
  return a.playerKey.localeCompare(b.playerKey) || (a.playerId ?? "").localeCompare(b.playerId ?? "");
}

export function reconcilePlayers(
  yahooPlayers: YahooIdentityPlayer[],
  fantasyProsPlayers: FantasyProsPlayer[],
): PlayerIdentityReconciliation {
  const indexed = fantasyProsPlayers.map((player) => {
    const yahooId = player.externalIds?.yahoo?.trim();
    return {
      player,
      name: normalizePlayerName(player.name),
      team: normalizeTeamAbbr(player.team),
      position: normalizeNflPosition(player.position) ?? normalizeNflPosition(player.positions?.[0]),
      yahooId: yahooId || undefined,
    } satisfies IndexedFantasyPros;
  });

  const byYahooId = new Map<string, IndexedFantasyPros[]>();
  const byName = new Map<string, IndexedFantasyPros[]>();
  const byNameTeamPosition = new Map<string, IndexedFantasyPros[]>();
  const byNameTeam = new Map<string, IndexedFantasyPros[]>();

  for (const row of indexed) {
    pushIndex(byYahooId, row.yahooId, row);
    pushIndex(byName, row.name || undefined, row);
    pushIndex(byNameTeamPosition, indexKey([row.name, row.team, row.position]), row);
    pushIndex(byNameTeam, indexKey([row.name, row.team]), row);
  }

  const seenKeys = new Set<string>();
  const orderedYahoo = [...yahooPlayers].sort(compareYahoo);
  const results: PlayerIdentityMatch[] = [];

  for (const yahoo of orderedYahoo) {
    if (seenKeys.has(yahoo.playerKey)) {
      continue;
    }
    seenKeys.add(yahoo.playerKey);
    results.push(matchYahooPlayer(yahoo, byYahooId, byName, byNameTeamPosition, byNameTeam));
  }

  return { results, summary: summarize(results) };
}

function matchYahooPlayer(
  yahoo: YahooIdentityPlayer,
  byYahooId: Map<string, IndexedFantasyPros[]>,
  byName: Map<string, IndexedFantasyPros[]>,
  byNameTeamPosition: Map<string, IndexedFantasyPros[]>,
  byNameTeam: Map<string, IndexedFantasyPros[]>,
): PlayerIdentityMatch {
  const yahooId = yahoo.playerId?.trim() ?? "";
  const idHits = yahooId ? uniquePlayers(byYahooId.get(yahooId) ?? []) : [];
  if (idHits.length === 1) {
    return matched(yahoo, idHits[0], "external_id", "exact", [
      "FantasyPros externalIds.yahoo exactly matched Yahoo player ID",
    ]);
  }
  if (idHits.length > 1) {
    return ambiguous(yahoo, "external_id", [
      `Multiple FantasyPros records claim the same Yahoo external ID ${yahooId}: ${idsFor(idHits)}.`,
    ]);
  }

  const name = normalizePlayerName(yahoo.name);
  const team = normalizeTeamAbbr(yahoo.team);
  const position = yahooNflPosition(yahoo.displayPosition, yahoo.eligiblePositions);

  const nameTeamPositionKey = indexKey([name, team, position]);
  const nameTeamPositionHits = uniquePlayers(
    (nameTeamPositionKey ? byNameTeamPosition.get(nameTeamPositionKey) ?? [] : []).filter((row) =>
      nameMatchAllowed(row, yahooId),
    ),
  );
  if (nameTeamPositionHits.length === 1) {
    return matched(yahoo, nameTeamPositionHits[0], "name_team_position", "high", [
      "Normalized name, team, and position matched exactly",
    ]);
  }
  if (nameTeamPositionHits.length > 1) {
    return ambiguous(yahoo, "name_team_position", [
      "Multiple FantasyPros players matched the same normalized identity",
    ]);
  }

  const nameTeamKey = indexKey([name, team]);
  const nameTeamHits = uniquePlayers(
    (nameTeamKey ? byNameTeam.get(nameTeamKey) ?? [] : []).filter((row) => nameMatchAllowed(row, yahooId)),
  );
  if (nameTeamHits.length === 0) {
    return unresolved(yahoo, describeUnresolved(name, team, position, byName.get(name)));
  }

  const conflicting = nameTeamHits.filter((row) => row.position && position && row.position !== position);
  if (conflicting.length > 0) {
    return unresolved(yahoo, [
      `Normalized name and team matched FantasyPros ${idsFor(nameTeamHits)}, but position conflicts (${position} vs ${conflicting
        .map((row) => row.position)
        .join(", ")}). Unresolved is safer than incorrectly matched.`,
    ]);
  }
  if (nameTeamHits.length === 1) {
    return matched(yahoo, nameTeamHits[0], "name_team", "medium", [
      "Normalized name and team matched exactly with no conflicting position",
    ]);
  }
  return ambiguous(yahoo, "name_team", [
    "Multiple FantasyPros players matched the same normalized identity",
  ]);
}

function describeUnresolved(
  name: string,
  team: string | undefined,
  position: string | undefined,
  sameName: IndexedFantasyPros[] | undefined,
): string[] {
  const reasons = ["No unique FantasyPros player matched this Yahoo player."];
  if (!name) {
    reasons.push("Normalized name is empty.");
  }
  if (!team) {
    reasons.push("NFL team is missing.");
  }
  if (!position) {
    reasons.push("NFL position is missing.");
  }
  const sameNameIds = uniquePlayers(sameName ?? []);
  if (sameNameIds.length > 1) {
    reasons.push(`Multiple FantasyPros players share this normalized name: ${idsFor(sameNameIds)}.`);
  }
  return reasons;
}

function summarize(matches: PlayerIdentityMatch[]): PlayerIdentitySummary {
  const summary: PlayerIdentitySummary = {
    total: matches.length,
    matched: 0,
    exact: 0,
    high: 0,
    medium: 0,
    unresolved: 0,
    ambiguous: 0,
  };
  for (const match of matches) {
    if (match.status === "matched") {
      summary.matched += 1;
      if (match.confidence === "exact") {
        summary.exact += 1;
      } else if (match.confidence === "high") {
        summary.high += 1;
      } else if (match.confidence === "medium") {
        summary.medium += 1;
      }
    } else if (match.status === "unresolved") {
      summary.unresolved += 1;
    } else {
      summary.ambiguous += 1;
    }
  }
  return summary;
}
