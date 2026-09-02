import type { Position, RosterSlotType } from "./draft";

export interface OffensiveScoring {
  passingYardsPerPoint: number;
  passingTd: number;
  interception: number;
  rushingYardsPerPoint: number;
  rushingTd: number;
  reception: number;
  receivingYardsPerPoint: number;
  receivingTd: number;
  returnYardsPerPoint: number;
  returnTd: number;
  twoPointConversion: number;
  fumbleLost: number;
  offensiveFumbleReturnTd: number;
}

export interface KickerScoring {
  fg0to19: number;
  fg20to29: number;
  fg30to39: number;
  fg40to49: number;
  fg50Plus: number;
  patMade: number;
}

export interface PointsAllowedBucket {
  minAllowed: number;
  maxAllowed: number | null;
  points: number;
}

export interface DefenseScoring {
  sack: number;
  interception: number;
  fumbleRecovery: number;
  defensiveTd: number;
  safety: number;
  blockedKick: number;
  extraPointReturned: number;
  pointsAllowed: PointsAllowedBucket[];
}

export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX: number;
  K: number;
  DEF: number;
}

export interface LeagueSettings {
  teamCount: number;
  format: "head-to-head";
  fractionalScoring: boolean;
  negativeScoring: boolean;
  rosterSlots: RosterSlots;
  flexEligibility: Position[];
  superflexEligibility: Position[];
  benchCount: number;
  irCount: number;
  offensiveScoring: OffensiveScoring;
  kickerScoring: KickerScoring;
  defenseScoring: DefenseScoring;
}

export const YAHOO_OFFENSIVE_SCORING: OffensiveScoring = {
  passingYardsPerPoint: 25,
  passingTd: 6,
  interception: -2,
  rushingYardsPerPoint: 10,
  rushingTd: 6,
  reception: 1,
  receivingYardsPerPoint: 10,
  receivingTd: 6,
  returnYardsPerPoint: 20,
  returnTd: 6,
  twoPointConversion: 4,
  fumbleLost: -2,
  offensiveFumbleReturnTd: 6,
};

export const YAHOO_KICKER_SCORING: KickerScoring = {
  fg0to19: 3,
  fg20to29: 3,
  fg30to39: 3,
  fg40to49: 4,
  fg50Plus: 5,
  patMade: 1,
};

export const YAHOO_DEFENSE_SCORING: DefenseScoring = {
  sack: 2,
  interception: 3,
  fumbleRecovery: 3,
  defensiveTd: 6,
  safety: 4,
  blockedKick: 4,
  extraPointReturned: 2,
  pointsAllowed: [
    { minAllowed: 0, maxAllowed: 0, points: 15 },
    { minAllowed: 1, maxAllowed: 6, points: 10 },
    { minAllowed: 7, maxAllowed: 13, points: 7 },
    { minAllowed: 14, maxAllowed: 20, points: 4 },
    { minAllowed: 21, maxAllowed: 27, points: 1 },
    { minAllowed: 28, maxAllowed: 34, points: 0 },
    { minAllowed: 35, maxAllowed: null, points: -3 },
  ],
};

const ESPN_STYLE_OFFENSE: OffensiveScoring = {
  ...YAHOO_OFFENSIVE_SCORING,
  passingTd: 4,
};

export const DEFAULT_LEAGUE: LeagueSettings = {
  teamCount: 10,
  format: "head-to-head",
  fractionalScoring: true,
  negativeScoring: true,
  rosterSlots: {
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 1,
    FLEX: 1,
    SUPERFLEX: 1,
    K: 1,
    DEF: 1,
  },
  flexEligibility: ["RB", "WR", "TE"],
  superflexEligibility: ["QB", "WR", "RB", "TE"],
  benchCount: 7,
  irCount: 2,
  offensiveScoring: { ...YAHOO_OFFENSIVE_SCORING },
  kickerScoring: { ...YAHOO_KICKER_SCORING },
  defenseScoring: {
    ...YAHOO_DEFENSE_SCORING,
    pointsAllowed: YAHOO_DEFENSE_SCORING.pointsAllowed.map((bucket) => ({ ...bucket })),
  },
};

export const ESPN_BASELINE_LEAGUE: LeagueSettings = {
  ...DEFAULT_LEAGUE,
  rosterSlots: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    SUPERFLEX: 0,
    K: 1,
    DEF: 1,
  },
  irCount: 0,
  offensiveScoring: { ...ESPN_STYLE_OFFENSE },
};

export const STANDARD_12_TEAM_1QB: LeagueSettings = {
  ...ESPN_BASELINE_LEAGUE,
  teamCount: 12,
  benchCount: 5,
};

export function cloneLeague(league: LeagueSettings): LeagueSettings {
  return {
    ...league,
    rosterSlots: { ...league.rosterSlots },
    flexEligibility: [...league.flexEligibility],
    superflexEligibility: [...league.superflexEligibility],
    offensiveScoring: { ...league.offensiveScoring },
    kickerScoring: { ...league.kickerScoring },
    defenseScoring: {
      ...league.defenseScoring,
      pointsAllowed: league.defenseScoring.pointsAllowed.map((bucket) => ({ ...bucket })),
    },
  };
}

export function withLeagueOverrides(
  base: LeagueSettings,
  overrides: Partial<Omit<LeagueSettings, "rosterSlots" | "offensiveScoring" | "kickerScoring" | "defenseScoring">> & {
    rosterSlots?: Partial<RosterSlots>;
    offensiveScoring?: Partial<OffensiveScoring>;
    kickerScoring?: Partial<KickerScoring>;
    defenseScoring?: Partial<Omit<DefenseScoring, "pointsAllowed">> & {
      pointsAllowed?: PointsAllowedBucket[];
    };
  },
): LeagueSettings {
  const cloned = cloneLeague(base);
  return {
    ...cloned,
    ...overrides,
    rosterSlots: { ...cloned.rosterSlots, ...overrides.rosterSlots },
    offensiveScoring: { ...cloned.offensiveScoring, ...overrides.offensiveScoring },
    kickerScoring: { ...cloned.kickerScoring, ...overrides.kickerScoring },
    defenseScoring: {
      ...cloned.defenseScoring,
      ...overrides.defenseScoring,
      pointsAllowed:
        overrides.defenseScoring?.pointsAllowed ?? cloned.defenseScoring.pointsAllowed,
    },
    flexEligibility: overrides.flexEligibility
      ? [...overrides.flexEligibility]
      : cloned.flexEligibility,
    superflexEligibility: overrides.superflexEligibility
      ? [...overrides.superflexEligibility]
      : cloned.superflexEligibility,
  };
}

export function dedicatedStarterCount(league: LeagueSettings, position: Position): number {
  if (position === "QB" || position === "RB" || position === "WR" || position === "TE" || position === "K" || position === "DEF") {
    return league.teamCount * league.rosterSlots[position];
  }
  return 0;
}

export function slotEligibility(slotType: RosterSlotType, league: LeagueSettings): Position[] {
  switch (slotType) {
    case "QB":
      return ["QB"];
    case "RB":
      return ["RB"];
    case "WR":
      return ["WR"];
    case "TE":
      return ["TE"];
    case "K":
      return ["K"];
    case "DEF":
      return ["DEF"];
    case "FLEX":
      return [...league.flexEligibility];
    case "SUPERFLEX":
      return [...league.superflexEligibility];
    case "BENCH":
    case "IR":
      return ["QB", "RB", "WR", "TE", "K", "DEF"];
    default:
      return [];
  }
}

export function slotAcceptsPosition(
  slotType: RosterSlotType,
  position: Position,
  league: LeagueSettings,
): boolean {
  return slotEligibility(slotType, league).includes(position);
}
