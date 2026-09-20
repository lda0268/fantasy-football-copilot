import type { CopilotRecommendation, DataQuality, LeagueAvailability } from "../api/types";

export const POSITION_FILTERS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"] as const;
export type PositionFilter = (typeof POSITION_FILTERS)[number];

export type AvailabilityFilter = "ALL" | Extract<LeagueAvailability, "free_agent" | "waivers">;
export type SupportFilter = "ALL" | DataQuality;

export type RecommendationFilters = {
  query: string;
  position: PositionFilter;
  availability: AvailabilityFilter;
  support: SupportFilter;
};

export function normalizePosition(position?: string): string {
  const value = position?.trim().toUpperCase() ?? "";
  if (value === "DST" || value === "D/ST") {
    return "DEF";
  }
  return value;
}

export function filterRecommendations(
  recommendations: CopilotRecommendation[],
  filters: RecommendationFilters,
): CopilotRecommendation[] {
  const query = filters.query.trim().toLowerCase();
  return recommendations.filter((recommendation) => {
    const player = recommendation.player;
    if (query) {
      const haystack = [player.player.name, player.player.team ?? "", player.player.position ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    if (filters.position !== "ALL" && normalizePosition(player.player.position) !== filters.position) {
      return false;
    }
    if (filters.availability !== "ALL" && player.leagueState.availability !== filters.availability) {
      return false;
    }
    if (filters.support !== "ALL" && recommendation.dataQuality !== filters.support) {
      return false;
    }
    return true;
  });
}
