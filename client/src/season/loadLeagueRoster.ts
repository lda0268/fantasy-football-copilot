import { getYahooRoster } from "../api/season";
import type { YahooRoster } from "../api/types";

export function loadLeagueRoster(teamKey: string): Promise<YahooRoster> {
  return getYahooRoster(teamKey);
}
