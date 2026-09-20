import { getFantasyProsStatus, listFantasyProsPlayers } from "../fantasypros/service.js";
import { PLAYER_PAGE_MAX_COUNT } from "../yahoo/resources.js";
import { getYahooFreeAgents, getYahooRoster, getYahooStatus } from "../yahoo/season.js";
import { toYahooIdentityPlayer } from "./fromProviders.js";
import { reconcilePlayers } from "./matcher.js";
import type { PlayerIdentityReconciliation, YahooIdentityPlayer } from "./types.js";

export type PlayerIdentityDiagnostic = {
  providers: {
    yahoo: { mode: "fixture" | "live" };
    fantasyPros: { mode: "fixture" | "live" };
  };
} & PlayerIdentityReconciliation;

export async function reconcileCurrentPlayers(): Promise<PlayerIdentityDiagnostic> {
  const [yahooStatus, fantasyProsStatus, roster, freeAgents, fantasyProsPlayers] = await Promise.all([
    getYahooStatus(),
    Promise.resolve(getFantasyProsStatus()),
    getYahooRoster(),
    getYahooFreeAgents({ start: 0, count: PLAYER_PAGE_MAX_COUNT }),
    listFantasyProsPlayers(),
  ]);

  const yahooPlayers: YahooIdentityPlayer[] = [
    ...roster.players.map(toYahooIdentityPlayer),
    ...freeAgents.players.map(toYahooIdentityPlayer),
  ];

  return {
    providers: {
      yahoo: { mode: yahooStatus.mode },
      fantasyPros: { mode: fantasyProsStatus.mode },
    },
    ...reconcilePlayers(yahooPlayers, fantasyProsPlayers),
  };
}
