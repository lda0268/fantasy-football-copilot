import type { Position } from "./draft";

export interface ProjectionSet {
  setId: string;
  setName: string;
  analystName?: string;
  season?: string;
  source: string;
}

export interface PassingProjection {
  attempts?: number;
  completions?: number;
  yards?: number;
  touchdowns?: number;
  interceptions?: number;
  twoPointConversions?: number;
}

export interface RushingProjection {
  attempts?: number;
  yards?: number;
  touchdowns?: number;
  twoPointConversions?: number;
}

export interface ReceivingProjection {
  targets?: number;
  receptions?: number;
  yards?: number;
  touchdowns?: number;
  twoPointConversions?: number;
}

export interface KickingProjection {
  extraPointsMade?: number;
  extraPointsAttempted?: number;
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
}

export interface ReturnProjection {
  puntReturnYards?: number;
  puntReturnTouchdowns?: number;
  kickReturnYards?: number;
  kickReturnTouchdowns?: number;
}

export interface TeamDefenseProjection {
  sacks?: number;
  interceptions?: number;
  fumbleRecoveries?: number;
  safeties?: number;
  touchdowns?: number;
  pointsAllowed?: number;
  yardsAllowed?: number;
  blockedKicks?: number;
  forcedFumbles?: number;
}

export interface PlayerProjection {
  sourcePlayerId: string;
  name: string;
  team: string;
  position: Position;
  projectionSetId: string;
  projectionSetName: string;
  games?: number;
  season?: string;
  passing?: PassingProjection;
  rushing?: RushingProjection;
  receiving?: ReceivingProjection;
  fumblesLost?: number;
  kicking?: KickingProjection;
  returns?: ReturnProjection;
  teamDefense?: TeamDefenseProjection;
}

export interface ProjectionScore {
  points: number;
  kickerProjectedPointsPartial?: number;
  defenseProjectedPointsPartial?: number;
  kickerFieldGoalsIncomplete: boolean;
  defensePointsAllowedIncomplete: boolean;
  twoPointConversions: number;
}

export interface ProjectionSetCoverage {
  set: ProjectionSet;
  rowCount: number;
  uniquePlayers: number;
  duplicates: number;
  byPosition: Partial<Record<Position, number>>;
  skillCount: number;
  kickerCount: number;
  defenseCount: number;
}

export interface SelectedProjectionSets {
  skill?: ProjectionSetCoverage;
  kicker?: ProjectionSetCoverage;
  defense?: ProjectionSetCoverage;
  reason: string;
}

export interface ProjectionImportReport {
  csvRowsLoaded: number;
  setsFound: ProjectionSetCoverage[];
  selected: SelectedProjectionSets;
  offensivePlayers: number;
  kickers: number;
  defenses: number;
  excludedIdpRows: number;
  matchedToUniverse: number;
  unmatchedProjections: string[];
  universeWithoutProjection: string[];
  duplicateProjectionRecords: string[];
  ambiguousProjectionRecords: string[];
}
