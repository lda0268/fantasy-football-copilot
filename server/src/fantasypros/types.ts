export type FantasyProsScoring = "standard" | "half_ppr" | "ppr";
export type FantasyProsRankingType = "weekly" | "ros";
export type FantasyProsDataMode = "fixture" | "live";

export type FantasyProsExternalIds = {
  yahoo?: string;
  espn?: string;
  nfl?: string;
  cbs?: string;
  mfl?: string;
  sportsdata?: string;
};

export type FantasyProsPlayer = {
  fantasyProsId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  team?: string;
  position?: string;
  positions?: string[];
  externalIds?: FantasyProsExternalIds;
};

export type FantasyProsScoringPoints = {
  standard?: number;
  halfPpr?: number;
  ppr?: number;
};

export type FantasyProsWeeklyProjection = {
  fantasyProsId: string;
  name: string;
  team?: string;
  position?: string;
  week: number;
  scoring?: FantasyProsScoring;
  fantasyPoints?: number;
  fantasyPointsByScoring?: FantasyProsScoringPoints;
  passingYards?: number;
  passingTouchdowns?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTouchdowns?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
};

export type FantasyProsRosProjection = {
  fantasyProsId: string;
  name: string;
  team?: string;
  position?: string;
  scoring?: FantasyProsScoring;
  fantasyPoints?: number;
  fantasyPointsByScoring?: FantasyProsScoringPoints;
  passingYards?: number;
  passingTouchdowns?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTouchdowns?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
};

export type FantasyProsRanking = {
  fantasyProsId: string;
  name: string;
  team?: string;
  position?: string;
  rankingType: FantasyProsRankingType;
  rank: number;
  positionRank?: string;
  tier?: number;
};

export type FantasyProsInjury = {
  fantasyProsId?: string;
  name: string;
  team?: string;
  position?: string;
  injury?: string;
  status?: string;
  practiceStatus?: string;
  lastUpdated?: string;
  probabilityOfPlaying?: string;
};

export type FantasyProsStatus = {
  configured: boolean;
  mode: FantasyProsDataMode;
};
