import type { YahooAvailablePlayer } from "../yahoo/types.js";
import type { CORE_POSITIONS } from "./config.js";

export type CopilotPosition = (typeof CORE_POSITIONS)[number];
export type NeedSeverity = "low" | "medium" | "high";

export type RosterNeed = {
  position: CopilotPosition;
  severity: NeedSeverity;
  reasons: string[];
};

export type RosterVulnerability = {
  type: "injury" | "bye_week" | "thin_depth" | "empty_slot";
  position?: CopilotPosition;
  playerKey?: string;
  playerName?: string;
  severity: NeedSeverity;
  reason: string;
};

export type CandidateScoreBreakdown = {
  availability: number;
  positionNeed: number;
  projectedPoints: number;
  percentOwned: number;
  health: number;
  byeWeek: number;
  total: number;
};

export type WaiverRecommendation = {
  rank: number;
  action: "consider_add" | "consider_add_drop";
  addPlayer: YahooAvailablePlayer;
  dropPlayer?: {
    playerKey: string;
    playerId: string;
    name: string;
    displayPosition?: string;
    selectedPosition?: string;
  };
  score: number;
  scoreBreakdown: CandidateScoreBreakdown;
  reasons: string[];
  cautions: string[];
};

export type CopilotRecommendations = {
  generatedFrom: {
    week: number | null;
    mode: "fixture" | "live";
  };
  rosterNeeds: RosterNeed[];
  vulnerabilities: RosterVulnerability[];
  recommendations: WaiverRecommendation[];
};
