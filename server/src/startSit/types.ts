import type { NflPosition } from "../playerIdentity/types.js";
import type { PlayerIdentityStatus } from "../playerIdentity/types.js";
import type { YahooRosterPosition } from "../yahoo/types.js";

export type StartSitDataQuality = "strongly_supported" | "supported" | "limited";
export type StartSitProviderMode = "live" | "fixture";
export type StartSitHealthBand =
  | "healthy"
  | "questionable"
  | "doubtful"
  | "out"
  | "ir"
  | "suspended"
  | "unknown";

export type StartSitSlot = {
  id: string;
  position: string;
  index: number;
};

export type StartSitLineupPlayer = {
  yahooPlayerKey: string;
  name: string;
  team?: string;
  position?: string;
  yahooPositions: NflPosition[];
  identityStatus: PlayerIdentityStatus | string;
  currentSlot?: string;
  weeklyProjectedPoints?: number;
  weeklyEcr?: number;
  weeklyValue?: number;
  dataQuality: StartSitDataQuality;
  injuryStatus?: string;
  warnings: string[];
};

export type StartSitAssignment = {
  slot: StartSitSlot;
  player?: StartSitLineupPlayer;
};

export type StartSitMove = {
  type: "swap";
  slot: string;
  slotId: string;
  startPlayer: StartSitLineupPlayer;
  sitPlayer?: StartSitLineupPlayer;
  weeklyValue: {
    start?: number;
    sit?: number;
  };
  projectedPointsDelta?: number;
  reasons: string[];
  warnings: string[];
};

export type StartSitReviewItem = {
  slot: string;
  slotId: string;
  currentPlayer?: StartSitLineupPlayer;
  candidatePlayer?: StartSitLineupPlayer;
  reason: string;
};

export type StartSitProjectionTotal = {
  points: number;
  projectedSlots: number;
  totalSlots: number;
  complete: boolean;
};

export type StartSitResult = {
  context: {
    week: number | null;
    scoringFormat: string;
    providerModes: { yahoo: StartSitProviderMode; fantasyPros: StartSitProviderMode };
    lineupSource: "fixture" | "live";
  };
  summary: {
    rosterPlayers: number;
    startingSlots: number;
    proposedChanges: number;
    reviewRequired: number;
    currentProjection: StartSitProjectionTotal;
    recommendedProjection: StartSitProjectionTotal;
    projectedPointsDelta?: number;
    message: string;
  };
  currentLineup: StartSitAssignment[];
  recommendedLineup: StartSitAssignment[];
  moves: StartSitMove[];
  reviewRequired: StartSitReviewItem[];
  bench: StartSitLineupPlayer[];
  ir: StartSitLineupPlayer[];
  lineupSettings: YahooRosterPosition[];
};

export type StartSitEngineInput = {
  week: number | null;
  scoringFormat: string;
  providerModes: StartSitResult["context"]["providerModes"];
  lineupSource: "fixture" | "live";
  rosterPositions: YahooRosterPosition[];
  roster: import("../yahoo/types.js").YahooRosterPlayer[];
  players: import("../playerIntelligence/types.js").PlayerIntelligence[];
  reference?: {
    weeklyProjections?: Array<{ fantasyProsId: string; position?: string; fantasyPoints?: number }>;
    weeklyRankings?: Array<{ fantasyProsId: string; position?: string; rank?: number }>;
  };
};
