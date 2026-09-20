import type { LeagueAvailability, YahooLeaguePlayer } from "./types.js";

export function yahooAvailability(player: YahooLeaguePlayer): LeagueAvailability {
  if (player.source === "roster") {
    return "rostered_by_user";
  }
  const ownership = player.ownershipType?.trim().toLowerCase().replace(/[\s_-]/g, "") ?? "";
  if (ownership === "fa" || ownership === "freeagent" || ownership === "freeagents") {
    return "free_agent";
  }
  if (ownership === "w" || ownership === "waiver" || ownership === "waivers") {
    return "waivers";
  }
  if (ownership === "team") {
    return "rostered_by_other";
  }
  return "unknown";
}
