import { yahooNflPosition } from "../playerIdentity/normalize.js";
import type { PlayerIdentityMatch } from "../playerIdentity/types.js";
import { evaluateObservation, FANTASYPROS_DATASET_TTL_MS } from "./freshness.js";
import type {
  ComposePlayerIntelligenceInput,
  FieldProvenance,
  PlayerIntelligence,
  PlayerIntelligenceComposition,
  PlayerIntelligenceSummary,
  YahooLeaguePlayer,
} from "./types.js";
import { yahooAvailability } from "./yahooAvailability.js";

function indexByFantasyProsId<T extends { fantasyProsId?: string }>(rows: T[] | undefined): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const row of rows ?? []) {
    const id = row.fantasyProsId?.trim();
    if (!id) {
      continue;
    }
    const list = index.get(id);
    if (list) {
      list.push(row);
    } else {
      index.set(id, [row]);
    }
  }
  return index;
}

function uniqueValue<T, V>(
  rows: T[] | undefined,
  read: (row: T) => V | undefined,
  fieldLabel: string,
  warnings: string[],
): V | undefined {
  if (!rows || rows.length === 0) {
    return undefined;
  }
  if (rows.length > 1) {
    warnings.push(`Withheld ${fieldLabel} because multiple FantasyPros records exist for this player.`);
    return undefined;
  }
  return read(rows[0]);
}

function setField(
  fields: Record<string, FieldProvenance>,
  name: string,
  provider: FieldProvenance["provider"],
  observedAt?: string,
): void {
  const provenance: FieldProvenance = { provider };
  if (observedAt) {
    provenance.observedAt = observedAt;
  }
  fields[name] = provenance;
}

function unresolvedIdentity(player: YahooLeaguePlayer): PlayerIdentityMatch {
  return {
    yahooPlayerKey: player.playerKey,
    yahooPlayerId: player.playerId,
    yahooName: player.name,
    status: "unresolved",
    method: "none",
    confidence: "none",
    reasons: ["Identity result missing for Yahoo player."],
  };
}

function composeOne(
  player: YahooLeaguePlayer,
  identity: PlayerIdentityMatch,
  input: ComposePlayerIntelligenceInput,
  weeklyById: Map<string, NonNullable<ComposePlayerIntelligenceInput["weeklyProjections"]>>,
  rosById: Map<string, NonNullable<ComposePlayerIntelligenceInput["rosProjections"]>>,
  weeklyEcrById: Map<string, NonNullable<ComposePlayerIntelligenceInput["weeklyRankings"]>>,
  rosEcrById: Map<string, NonNullable<ComposePlayerIntelligenceInput["rosRankings"]>>,
  injuriesById: Map<string, NonNullable<ComposePlayerIntelligenceInput["injuries"]>>,
): PlayerIntelligence {
  const warnings: string[] = [];
  const fields: Record<string, FieldProvenance> = {};
  const availability = yahooAvailability(player);
  setField(fields, "availability", "yahoo", input.observations?.yahooObservedAt);
  if (player.selectedPosition) {
    setField(fields, "rosterSlot", "yahoo", input.observations?.yahooObservedAt);
  }
  if (player.percentOwned !== undefined) {
    setField(fields, "percentOwned", "yahoo", input.observations?.yahooObservedAt);
  }

  const position = yahooNflPosition(player.displayPosition, player.eligiblePositions);
  const record: PlayerIntelligence = {
    identity: {
      yahooPlayerKey: identity.yahooPlayerKey,
      status: identity.status,
      method: identity.method,
      confidence: identity.confidence,
    },
    player: { name: player.name },
    leagueState: { availability },
    provenance: {
      yahoo: true,
      fantasyPros: false,
      fields,
    },
    freshness: {},
    warnings,
  };
  if (identity.yahooPlayerId ?? player.playerId) {
    record.identity.yahooPlayerId = identity.yahooPlayerId ?? player.playerId;
  }
  if (player.team) {
    record.player.team = player.team;
  }
  if (position) {
    record.player.position = position;
  } else if (player.displayPosition) {
    record.player.position = player.displayPosition;
  }
  if (player.selectedPosition) {
    record.leagueState.rosterSlot = player.selectedPosition;
  }
  if (player.percentOwned !== undefined) {
    record.leagueState.percentOwned = player.percentOwned;
  }
  if (player.byeWeek !== undefined) {
    record.leagueState.byeWeek = player.byeWeek;
    setField(fields, "byeWeek", "yahoo", input.observations?.yahooObservedAt);
  }

  const yahooFreshness = evaluateObservation(input.observations?.yahooObservedAt, 24 * 60 * 60 * 1000);
  if (yahooFreshness.observedAt || yahooFreshness.stale !== undefined) {
    record.freshness.yahoo = yahooFreshness;
  }

  if (identity.status !== "matched" || !identity.fantasyProsId) {
    if (identity.status === "ambiguous") {
      warnings.push("FantasyPros intelligence withheld because player identity is ambiguous.");
    } else {
      warnings.push("FantasyPros intelligence unavailable because player identity is unresolved.");
    }
    return record;
  }

  const fpId = identity.fantasyProsId;
  record.identity.fantasyProsId = fpId;
  record.provenance.fantasyPros = true;

  const weekly = uniqueValue(weeklyById.get(fpId), (row) => row, "weekly projection", warnings);
  const ros = uniqueValue(rosById.get(fpId), (row) => row, "ROS projection", warnings);
  const weeklyEcr = uniqueValue(weeklyEcrById.get(fpId), (row) => row, "weekly ECR", warnings);
  const rosEcr = uniqueValue(rosEcrById.get(fpId), (row) => row, "ROS ECR", warnings);
  const injury = uniqueValue(injuriesById.get(fpId), (row) => row, "injury data", warnings);

  if (weekly || weeklyEcr) {
    record.weekly = {};
    if (weekly?.week !== undefined) {
      record.weekly.week = weekly.week;
    }
    if (weekly && weekly.fantasyPoints !== undefined) {
      record.weekly.projectedPoints = weekly.fantasyPoints;
      setField(fields, "weeklyProjection", "fantasypros", input.observations?.fantasyProsObservedAt);
    }
    if (weeklyEcr && weeklyEcr.rank !== undefined) {
      record.weekly.ecr = weeklyEcr.rank;
      setField(fields, "weeklyEcr", "fantasypros", input.observations?.fantasyProsObservedAt);
    }
    if (record.weekly.week === undefined && record.weekly.projectedPoints === undefined && record.weekly.ecr === undefined) {
      delete record.weekly;
    }
  }

  if (ros || rosEcr) {
    record.restOfSeason = {};
    if (ros && ros.fantasyPoints !== undefined) {
      record.restOfSeason.projectedPoints = ros.fantasyPoints;
      setField(fields, "rosProjection", "fantasypros", input.observations?.fantasyProsObservedAt);
    }
    if (rosEcr && rosEcr.rank !== undefined) {
      record.restOfSeason.ecr = rosEcr.rank;
      setField(fields, "rosEcr", "fantasypros", input.observations?.fantasyProsObservedAt);
    }
    if (record.restOfSeason.projectedPoints === undefined && record.restOfSeason.ecr === undefined) {
      delete record.restOfSeason;
    }
  }

  if (injury && (injury.status || injury.practiceStatus || injury.injury)) {
    record.injury = {};
    if (injury.status) {
      record.injury.status = injury.status;
      setField(fields, "injuryStatus", "fantasypros", input.observations?.fantasyProsObservedAt);
    }
    if (injury.practiceStatus) {
      record.injury.practiceStatus = injury.practiceStatus;
    }
    if (injury.injury) {
      record.injury.description = injury.injury;
    }
  }

  const fpFreshness = evaluateObservation(
    input.observations?.fantasyProsObservedAt,
    FANTASYPROS_DATASET_TTL_MS.weeklyProjections,
  );
  if (fpFreshness.observedAt || fpFreshness.stale !== undefined) {
    record.freshness.fantasyPros = fpFreshness;
  }

  return record;
}

export function composePlayerIntelligence(input: ComposePlayerIntelligenceInput): PlayerIntelligenceComposition {
  const identityByKey = new Map(input.identityResults.map((row) => [row.yahooPlayerKey, row]));
  const weeklyById = indexByFantasyProsId(input.weeklyProjections);
  const rosById = indexByFantasyProsId(input.rosProjections);
  const weeklyEcrById = indexByFantasyProsId(input.weeklyRankings);
  const rosEcrById = indexByFantasyProsId(input.rosRankings);
  const injuriesById = indexByFantasyProsId(input.injuries);

  const seen = new Set<string>();
  const players: PlayerIntelligence[] = [];
  const ordered = [...input.yahooPlayers].sort((a, b) => a.playerKey.localeCompare(b.playerKey));
  for (const player of ordered) {
    if (seen.has(player.playerKey)) {
      continue;
    }
    seen.add(player.playerKey);
    const identity = identityByKey.get(player.playerKey) ?? unresolvedIdentity(player);
    players.push(
      composeOne(player, identity, input, weeklyById, rosById, weeklyEcrById, rosEcrById, injuriesById),
    );
  }

  return { players, summary: summarizePlayers(players) };
}

export function summarizePlayers(players: PlayerIntelligence[]): PlayerIntelligenceSummary {
  const summary: PlayerIntelligenceSummary = {
    total: players.length,
    identityMatched: 0,
    identityUnresolved: 0,
    identityAmbiguous: 0,
    withWeeklyProjection: 0,
    withRosProjection: 0,
    withWeeklyEcr: 0,
    withRosEcr: 0,
    withInjuryData: 0,
  };
  for (const player of players) {
    if (player.identity.status === "matched") {
      summary.identityMatched += 1;
    } else if (player.identity.status === "ambiguous") {
      summary.identityAmbiguous += 1;
    } else {
      summary.identityUnresolved += 1;
    }
    if (player.weekly?.projectedPoints !== undefined) {
      summary.withWeeklyProjection += 1;
    }
    if (player.restOfSeason?.projectedPoints !== undefined) {
      summary.withRosProjection += 1;
    }
    if (player.weekly?.ecr !== undefined) {
      summary.withWeeklyEcr += 1;
    }
    if (player.restOfSeason?.ecr !== undefined) {
      summary.withRosEcr += 1;
    }
    if (player.injury) {
      summary.withInjuryData += 1;
    }
  }
  return summary;
}
