export type YahooDataMode = "live" | "fixture";

export type YahooStatus = {
  connected: boolean;
  fantasyAuthorized: boolean;
  mode: YahooDataMode;
  expiresAt: number | null;
};

export type FantasyProsStatus = {
  configured: boolean;
  mode: "live" | "fixture";
};

export type YahooLeague = {
  leagueKey: string;
  leagueId: string;
  name: string;
  season: string;
  numTeams?: number;
  currentWeek?: number;
  scoringType?: string;
};

export type YahooTeam = {
  teamKey: string;
  teamId: string;
  name: string;
  leagueKey: string;
};

export type YahooRosterPlayer = {
  playerKey: string;
  playerId: string;
  name: string;
  editorialTeamAbbr?: string;
  displayPosition?: string;
  selectedPosition?: string;
  byeWeek?: number;
};

export type YahooRoster = {
  team: YahooTeam;
  week: number | null;
  players: YahooRosterPlayer[];
};

export type YahooStanding = {
  rank: number;
  teamKey: string;
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor?: number;
  pointsAgainst?: number;
};

export type YahooMatchupTeam = {
  teamKey: string;
  teamId: string;
  name: string;
  points?: number;
  projectedPoints?: number;
  wins?: number;
  losses?: number;
  ties?: number;
};

export type YahooMatchup = {
  week: number;
  status?: string;
  teams: YahooMatchupTeam[];
};

export type LeagueAvailability =
  | "rostered_by_user"
  | "rostered_by_other"
  | "free_agent"
  | "waivers"
  | "unknown";

export type DataQuality = "strongly_supported" | "supported" | "limited";

export type PlayerIdentityStatus = "matched" | "unresolved" | "ambiguous";

export type PlayerIntelligence = {
  identity: {
    yahooPlayerKey: string;
    yahooPlayerId?: string;
    fantasyProsId?: string;
    status: PlayerIdentityStatus | string;
    method?: string;
    confidence?: string;
  };
  player: { name: string; team?: string; position?: string };
  leagueState: {
    availability: LeagueAvailability;
    rosterSlot?: string;
    byeWeek?: number;
    percentOwned?: number;
  };
  weekly?: { week?: number; projectedPoints?: number; ecr?: number };
  restOfSeason?: { projectedPoints?: number; ecr?: number };
  injury?: { status?: string; practiceStatus?: string; description?: string };
  warnings: string[];
};

export type RecommendationComponent = {
  score: number;
  max: number;
  available: boolean;
  reasons: string[];
};

export type NeedSeverity = "low" | "medium" | "high";

export type RosterNeed = {
  position: string;
  severity: NeedSeverity;
  reasons: string[];
};

export type RosterVulnerability = {
  type: string;
  position?: string;
  playerKey?: string;
  playerName?: string;
  severity: NeedSeverity;
  reason: string;
};

export type DropCandidate = {
  playerKey: string;
  playerId: string;
  name: string;
  displayPosition?: string;
  selectedPosition?: string;
};

export type CopilotRecommendation = {
  rank: number;
  action: string;
  player: PlayerIntelligence;
  score: number;
  rawScore: number;
  availableMax: number;
  components: {
    rosterNeed: RecommendationComponent;
    restOfSeason: RecommendationComponent;
    weeklyValue: RecommendationComponent;
    healthRisk: RecommendationComponent;
    rosterFit: RecommendationComponent;
  };
  dataQuality: DataQuality;
  reasons: string[];
  warnings: string[];
  dropPlayer?: DropCandidate;
};

export type CopilotRecommendationsResponse = {
  context: {
    week: number | null;
    scoringFormat: string;
    providerModes: { yahoo: YahooDataMode; fantasyPros: "live" | "fixture" };
  };
  summary: {
    candidatesConsidered: number;
    eligible: number;
    recommendationsReturned: number;
  };
  rosterNeeds?: RosterNeed[];
  vulnerabilities?: RosterVulnerability[];
  recommendations: CopilotRecommendation[];
};

export type StartSitDataQuality = "strongly_supported" | "supported" | "limited";

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
  yahooPositions: string[];
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

export type YahooRosterPosition = {
  position: string;
  count: number;
};

export type StartSitResult = {
  context: {
    week: number | null;
    scoringFormat: string;
    providerModes: { yahoo: YahooDataMode; fantasyPros: "live" | "fixture" };
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

export type ApiErrorBody = {
  error?: string;
  message?: string;
};
