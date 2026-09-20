export type YahooDataMode = "live" | "fixture";

export interface YahooGame {
  gameKey: string;
  gameId?: string;
  code: string;
  name: string;
  season: string;
  isGameOver?: boolean;
}

export interface YahooLeague {
  leagueKey: string;
  leagueId: string;
  name: string;
  season: string;
  numTeams?: number;
  currentWeek?: number;
  startWeek?: number;
  endWeek?: number;
  scoringType?: string;
  url?: string;
}

export interface YahooStatus {
  connected: boolean;
  fantasyAuthorized: boolean;
  mode: YahooDataMode;
  expiresAt: number | null;
}

export interface YahooTeam {
  teamKey: string;
  teamId: string;
  name: string;
  leagueKey: string;
  url?: string;
  logoUrl?: string;
  numberOfMoves?: number;
  numberOfTrades?: number;
}

export interface YahooRosterPlayer {
  playerKey: string;
  playerId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  editorialTeamAbbr?: string;
  displayPosition?: string;
  eligiblePositions?: string[];
  selectedPosition?: string;
  status?: string;
  statusFull?: string;
  byeWeek?: number;
  uniformNumber?: string;
  imageUrl?: string;
}

export interface YahooMatchupTeam {
  teamKey: string;
  teamId: string;
  name: string;
  points?: number;
  projectedPoints?: number;
  wins?: number;
  losses?: number;
  ties?: number;
}

export interface YahooMatchup {
  week: number;
  status?: string;
  isPlayoffs?: boolean;
  isConsolation?: boolean;
  isTied?: boolean;
  winnerTeamKey?: string;
  teams: YahooMatchupTeam[];
}

export interface YahooStanding {
  rank: number;
  teamKey: string;
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  percentage?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  streak?: string;
  playoffSeed?: number;
}

export interface YahooAvailablePlayer {
  playerKey: string;
  playerId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  editorialTeamAbbr?: string;
  displayPosition?: string;
  eligiblePositions?: string[];
  status?: string;
  statusFull?: string;
  byeWeek?: number;
  uniformNumber?: string;
  imageUrl?: string;
  ownershipType?: string;
  ownerTeamKey?: string;
  ownerTeamName?: string;
  percentOwned?: number;
  fantasyPoints?: number;
  projectedPoints?: number;
}

export interface YahooPlayerPage {
  players: YahooAvailablePlayer[];
  start: number;
  count: number;
  total?: number;
}
