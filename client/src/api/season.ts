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

export function getYahooRoster(): Promise<YahooRoster> {
  return requestJson<YahooRoster>("/api/yahoo/roster");
}

export function getYahooStandings(): Promise<{ league: YahooLeague; standings: YahooStanding[] }> {
  return requestJson<{ league: YahooLeague; standings: YahooStanding[] }>("/api/yahoo/standings");
}

export function getYahooMatchup(): Promise<{ matchup: YahooMatchup }> {
  return requestJson<{ matchup: YahooMatchup }>("/api/yahoo/matchup");
}

export function getPlayerIntelligence(): Promise<{ players: PlayerIntelligence[] }> {
  return requestJson<{ players: PlayerIntelligence[] }>("/api/player-intelligence");
}

export function getCopilotRecommendationsV2(limit?: number): Promise<CopilotRecommendationsResponse> {
  const query = limit != null ? `?limit=${limit}` : "";
  return requestJson<CopilotRecommendationsResponse>(`/api/copilot/v2/recommendations${query}`);
}
