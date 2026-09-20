export type PlayerIdentityStatus = "matched" | "unresolved" | "ambiguous";
export type PlayerIdentityMethod = "external_id" | "name_team_position" | "name_team" | "none";
export type PlayerIdentityConfidence = "exact" | "high" | "medium" | "none";
export type NflPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export type YahooIdentityPlayer = {
  playerKey: string;
  playerId?: string;
  name: string;
  team?: string;
  displayPosition?: string;
  eligiblePositions?: string[];
};

export type PlayerIdentityMatch = {
  yahooPlayerKey: string;
  yahooPlayerId?: string;
  yahooName: string;
  fantasyProsId?: string;
  fantasyProsName?: string;
  status: PlayerIdentityStatus;
  method: PlayerIdentityMethod;
  confidence: PlayerIdentityConfidence;
  reasons: string[];
};

export type PlayerIdentitySummary = {
  total: number;
  matched: number;
  exact: number;
  high: number;
  medium: number;
  unresolved: number;
  ambiguous: number;
};

export type PlayerIdentityReconciliation = {
  results: PlayerIdentityMatch[];
  summary: PlayerIdentitySummary;
};
