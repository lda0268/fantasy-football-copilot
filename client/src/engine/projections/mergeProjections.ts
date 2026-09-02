import type { Player } from "../../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../../types/league";
import type { PlayerProjection, ProjectionImportReport } from "../../types/projections";
import { identityKey } from "../data/normalizeName";
import { matchByIdentity } from "../data/playerMatch";
import { scorePlayerProjection, toProjectionStats } from "./scoreProjection";

export interface ProjectionMergeResult {
  players: Player[];
  report: Pick<
    ProjectionImportReport,
    | "matchedToUniverse"
    | "unmatchedProjections"
    | "universeWithoutProjection"
    | "duplicateProjectionRecords"
    | "ambiguousProjectionRecords"
  >;
}

function duplicateIdentities(projections: PlayerProjection[]): string[] {
  const counts = new Map<string, PlayerProjection[]>();
  for (const projection of projections) {
    const key = identityKey(projection.name, projection.position, projection.team);
    const list = counts.get(key) ?? [];
    list.push(projection);
    counts.set(key, list);
  }
  return [...counts.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key]) => key);
}

export function mergeProjectionsOntoPlayers(
  players: Player[],
  projections: PlayerProjection[],
  league: LeagueSettings = DEFAULT_LEAGUE,
): ProjectionMergeResult {
  const duplicateProjectionRecords = duplicateIdentities(projections);
  const duplicateSet = new Set(duplicateProjectionRecords);
  const usable = projections.filter(
    (projection) => !duplicateSet.has(identityKey(projection.name, projection.position, projection.team)),
  );

  const used = new Set<PlayerProjection>();
  const ambiguousProjectionRecords: string[] = [];
  let matchedToUniverse = 0;

  const nextPlayers = players.map((player) => {
    const result = matchByIdentity(player, usable);
    if (result.status === "ambiguous") {
      ambiguousProjectionRecords.push(player.name);
      return player;
    }
    if (result.status !== "matched" || !result.record) {
      return player;
    }

    used.add(result.record);
    matchedToUniverse += 1;
    const scored = scorePlayerProjection(result.record, league);
    const stats = toProjectionStats(result.record);

    return {
      ...player,
      projection: result.record,
      stats,
      projectedPoints: scored.points,
      sourceProjectedPoints: scored.points,
      projectionSource: "league" as const,
      projectionsAvailable: true,
      leagueAdjustedProjectedPoints: scored.points,
      kickerProjectedPointsPartial: scored.kickerProjectedPointsPartial,
      defenseProjectedPointsPartial: scored.defenseProjectedPointsPartial,
      kickerScoringIncomplete: scored.kickerFieldGoalsIncomplete,
      defenseScoringIncomplete: scored.defensePointsAllowedIncomplete,
    };
  });

  const unmatchedProjections = usable
    .filter((projection) => !used.has(projection))
    .map((projection) => projection.name);
  const universeWithoutProjection = nextPlayers
    .filter((player) => !player.projectionsAvailable)
    .map((player) => player.name);

  return {
    players: nextPlayers,
    report: {
      matchedToUniverse,
      unmatchedProjections,
      universeWithoutProjection,
      duplicateProjectionRecords,
      ambiguousProjectionRecords,
    },
  };
}
