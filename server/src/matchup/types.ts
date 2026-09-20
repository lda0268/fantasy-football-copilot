import type { PlayerIdentityStatus } from "../playerIdentity/types.js";
import type { PlayerIntelligence } from "../playerIntelligence/types.js";
import type {
  YahooLeague,
  YahooMatchup,
  YahooRosterPlayer,
  YahooRosterPosition,
  YahooStatus,
  YahooTeam,
} from "../yahoo/types.js";
import type { FantasyProsStatus } from "../fantasypros/types.js";

export type MatchupWeeklyCoverage = "projection+ecr" | "projection" | "ecr" | "none";

export type MatchupPlayerView = {
  yahooPlayerKey: string;
  name: string;
  team?: string;
  position?: string;
  slot?: string;
  byeWeek?: number;
  fantasyTeam?: string;
  weeklyProjectedPoints?: number;
  weeklyEcr?: number;
  injuryStatus?: string;
  practiceStatus?: string;
  injuryDescription?: string;
  yahooStatus?: string;
  identityStatus: PlayerIdentityStatus | string;
  identityMethod?: string;
  weeklyCoverage: MatchupWeeklyCoverage;
  weeklyDataLabel: string;
  warnings: string[];
};

export type MatchupSideSummary = {
  knownProjectedPoints: number;
  projectedSlots: number;
  totalSlots: number;
  injuryFlags: number;
  playersWithWeeklyIntelligence: number;
};

export type MatchupSide = {
  teamKey: string;
  teamId: string;
  name: string;
  points?: number;
  yahooProjectedPoints?: number;
  summary: MatchupSideSummary;
  bench: MatchupPlayerView[];
  ir: MatchupPlayerView[];
};

export type MatchupSlotRow = {
  id: string;
  yahooPosition: string;
  displayPosition: string;
  user?: MatchupPlayerView;
  opponent?: MatchupPlayerView;
};

export type MatchupAvailabilityNote = {
  teamName: string;
  playerName: string;
  slot?: string;
  group: "starter" | "bench" | "ir";
  status: string;
};

export type MatchupIntelligence = {
  providers: {
    yahoo: { mode: "fixture" | "live"; connected?: boolean; fantasyAuthorized?: boolean };
    fantasyPros: { mode: "fixture" | "live"; configured?: boolean };
  };
  fantasyProsAvailable: boolean;
  week: number | null;
  league?: Pick<YahooLeague, "leagueKey" | "leagueId" | "name" | "season" | "currentWeek" | "scoringType">;
  matchupPresent: boolean;
  matchupStatus?: string;
  matchupStatusLabel?: string;
  user?: MatchupSide;
  opponent?: MatchupSide;
  opponentError?: string;
  comparison: { slots: MatchupSlotRow[] };
  differences: {
    userKnownProjection?: number;
    opponentKnownProjection?: number;
    userProjectedSlots?: number;
    opponentProjectedSlots?: number;
    userInjuryFlags?: number;
    opponentInjuryFlags?: number;
    comparable: boolean;
  };
  availabilityNotes: MatchupAvailabilityNote[];
};

export type AssembleMatchupInput = {
  yahooStatus: YahooStatus;
  fantasyProsStatus: Pick<FantasyProsStatus, "configured" | "mode">;
  fantasyProsAvailable: boolean;
  league?: YahooLeague;
  team: YahooTeam;
  matchup?: YahooMatchup;
  rosterPositions: YahooRosterPosition[];
  userRoster: YahooRosterPlayer[];
  opponentRoster?: { team: YahooTeam; players: YahooRosterPlayer[] };
  opponentError?: string;
  players: PlayerIntelligence[];
};
