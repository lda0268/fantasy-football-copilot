import type { PlayerIntelligence } from "../../playerIntelligence/types.js";
import type { CopilotPosition, NeedSeverity, RosterNeed, RosterVulnerability } from "../types.js";
import type { V2_SCORE_WEIGHTS } from "./config.js";
import type { CopilotV2ReferencePopulations } from "./referencePopulation.js";

export type CopilotV2DataQuality = "strongly_supported" | "supported" | "limited";

export type CopilotV2HealthBand =
  | "healthy"
  | "questionable"
  | "doubtful"
  | "out"
  | "ir"
  | "suspended"
  | "unknown";

export type CopilotV2Component = {
  score: number;
  max: number;
  available: boolean;
  reasons: string[];
  normalized?: number;
  referenceSize?: number;
};

export type CopilotV2Components = {
  rosterNeed: CopilotV2Component;
  restOfSeason: CopilotV2Component;
  weeklyValue: CopilotV2Component;
  healthRisk: CopilotV2Component;
  rosterFit: CopilotV2Component;
};

export type CopilotV2Recommendation = {
  rank: number;
  action: "consider_add" | "consider_add_drop";
  player: PlayerIntelligence;
  score: number;
  rawScore: number;
  availableMax: number;
  components: CopilotV2Components;
  dataQuality: CopilotV2DataQuality;
  reasons: string[];
  warnings: string[];
  dropPlayer?: {
    playerKey: string;
    playerId: string;
    name: string;
    displayPosition?: string;
    selectedPosition?: string;
  };
};

export type CopilotV2Recommendations = {
  context: {
    week: number | null;
    scoringFormat: string;
    providerModes: {
      yahoo: "fixture" | "live";
      fantasyPros: "fixture" | "live";
    };
    referencePopulations: CopilotV2ReferencePopulations;
  };
  summary: {
    candidatesConsidered: number;
    eligible: number;
    excludedUnmatched: number;
    excludedAmbiguous: number;
    excludedUnavailable: number;
    recommendationsReturned: number;
  };
  rosterNeeds: RosterNeed[];
  vulnerabilities: RosterVulnerability[];
  recommendations: CopilotV2Recommendation[];
};

export type CopilotV2Position = CopilotPosition;
export type CopilotV2NeedSeverity = NeedSeverity;
export type CopilotV2WeightKey = keyof typeof V2_SCORE_WEIGHTS;
