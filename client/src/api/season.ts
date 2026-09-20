import { requestJson } from "./http";
import type {
  CopilotRecommendationsResponse,
  FantasyProsStatus,
  PlayerIntelligence,
  YahooLeague,
  YahooMatchup,
  YahooRoster,
  YahooStanding,
  YahooStatus,
  YahooTeam,
  YahooLeagueSettings,
  YahooRosterPosition,
  StartSitResult,
} from "./types";

export function getYahooStatus(): Promise<YahooStatus> {
  return requestJson<YahooStatus>("/api/yahoo/status");
}

export function getFantasyProsStatus(): Promise<FantasyProsStatus> {
  return requestJson<FantasyProsStatus>("/api/fantasypros/status");
}

export function getYahooLeagues(): Promise<{ leagues: YahooLeague[] }> {
  return requestJson<{ leagues: YahooLeague[] }>("/api/yahoo/leagues");
}

export function getYahooTeam(): Promise<{ team: YahooTeam }> {
  return requestJson<{ team: YahooTeam }>("/api/yahoo/team");
}

export function getYahooRoster(teamKey?: string): Promise<YahooRoster> {
  const query = teamKey ? `?teamKey=${encodeURIComponent(teamKey)}` : "";
  return requestJson<YahooRoster>(`/api/yahoo/roster${query}`);
}

export function getYahooStandings(): Promise<{ league: YahooLeague; standings: YahooStanding[] }> {
  return requestJson<{ league: YahooLeague; standings: YahooStanding[] }>("/api/yahoo/standings");
}

export function getYahooMatchup(): Promise<{ matchup: YahooMatchup }> {
  return requestJson<{ matchup: YahooMatchup }>("/api/yahoo/matchup");
}

export function getYahooScoreboard(): Promise<{ matchups: YahooMatchup[] }> {
  return requestJson<{ matchups: YahooMatchup[] }>("/api/yahoo/scoreboard");
}

export function getYahooLeagueSettings(): Promise<{
  league: YahooLeague;
  rosterPositions: YahooRosterPosition[];
  settings: YahooLeagueSettings;
  source: "fixture" | "live";
}> {
  return requestJson("/api/yahoo/league-settings");
}

export function getPlayerIntelligence(): Promise<{ players: PlayerIntelligence[] }> {
  return requestJson<{ players: PlayerIntelligence[] }>("/api/player-intelligence");
}

export function getCopilotRecommendationsV2(limit?: number): Promise<CopilotRecommendationsResponse> {
  const query = limit != null ? `?limit=${limit}` : "";
  return requestJson<CopilotRecommendationsResponse>(`/api/copilot/v2/recommendations${query}`);
}

export function getStartSit(): Promise<StartSitResult> {
  return requestJson<StartSitResult>("/api/start-sit");
}
