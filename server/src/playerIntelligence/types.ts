import type {
  PlayerIdentityConfidence,
  PlayerIdentityMatch,
  PlayerIdentityMethod,
  PlayerIdentityStatus,
} from "../playerIdentity/types.js";

export type LeagueAvailability =
  | "rostered_by_user"
  | "rostered_by_other"
  | "free_agent"
  | "waivers"
  | "unknown";

export type IntelligenceProvider = "yahoo" | "fantasypros";

export type FieldProvenance = {
  provider: IntelligenceProvider;
  observedAt?: string;
};

export type YahooLeaguePlayer = {
  playerKey: string;
  playerId?: string;
  name: string;
  team?: string;
  displayPosition?: string;
  eligiblePositions?: string[];
  selectedPosition?: string;
  ownershipType?: string;
  percentOwned?: number;
  byeWeek?: number;
  source: "roster" | "available";
};

export type PlayerIntelligenceIdentity = {
  yahooPlayerKey: string;
  yahooPlayerId?: string;
  fantasyProsId?: string;
  status: PlayerIdentityStatus;
  method: PlayerIdentityMethod;
  confidence: PlayerIdentityConfidence;
};

export type PlayerIntelligence = {
  identity: PlayerIntelligenceIdentity;
  player: {
    name: string;
    team?: string;
    position?: string;
  };
  leagueState: {
    availability: LeagueAvailability;
    rosterSlot?: string;
    percentOwned?: number;
    byeWeek?: number;
  };
  weekly?: {
    week?: number;
    projectedPoints?: number;
    ecr?: number;
  };
  restOfSeason?: {
    projectedPoints?: number;
    ecr?: number;
  };
  injury?: {
    status?: string;
    practiceStatus?: string;
    description?: string;
  };
  provenance: {
    yahoo: boolean;
    fantasyPros: boolean;
    fields: Record<string, FieldProvenance>;
  };
  freshness: {
    yahoo?: {
      observedAt?: string;
      stale?: boolean;
    };
    fantasyPros?: {
      observedAt?: string;
      stale?: boolean;
    };
  };
  warnings: string[];
};

export type PlayerIntelligenceSummary = {
  total: number;
  identityMatched: number;
  identityUnresolved: number;
  identityAmbiguous: number;
  withWeeklyProjection: number;
  withRosProjection: number;
  withWeeklyEcr: number;
  withRosEcr: number;
  withInjuryData: number;
};

export type PlayerIntelligenceComposition = {
  players: PlayerIntelligence[];
  summary: PlayerIntelligenceSummary;
};

export type CompositionObservations = {
  yahooObservedAt?: string;
  fantasyProsObservedAt?: string;
};

export type ComposePlayerIntelligenceInput = {
  yahooPlayers: YahooLeaguePlayer[];
  identityResults: PlayerIdentityMatch[];
  weeklyProjections?: Array<{ fantasyProsId: string; week: number; fantasyPoints?: number }>;
  rosProjections?: Array<{ fantasyProsId: string; fantasyPoints?: number }>;
  weeklyRankings?: Array<{ fantasyProsId: string; rank: number }>;
  rosRankings?: Array<{ fantasyProsId: string; rank: number }>;
  injuries?: Array<{
    fantasyProsId?: string;
    status?: string;
    practiceStatus?: string;
    injury?: string;
  }>;
  observations?: CompositionObservations;
};
