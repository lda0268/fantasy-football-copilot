import type { RecommendationFilters } from "./filterRecommendations";
import { POSITION_FILTERS } from "./filterRecommendations";

type WaiverFiltersProps = {
  filters: RecommendationFilters;
  onChange: (next: RecommendationFilters) => void;
};

export function WaiverFilters({ filters, onChange }: WaiverFiltersProps) {
  return (
    <form className="waiver-filters" onSubmit={(event) => event.preventDefault()}>
      <label className="waiver-search">
        <span className="dash-meta-label">Search</span>
        <input
          type="search"
          value={filters.query}
          placeholder="Name, team, or position"
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
      </label>
      <label>
        <span className="dash-meta-label">Position</span>
        <select
          value={filters.position}
          onChange={(event) => onChange({ ...filters, position: event.target.value as RecommendationFilters["position"] })}
        >
          {POSITION_FILTERS.map((position) => (
            <option key={position} value={position}>
              {position === "ALL" ? "All" : position}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="dash-meta-label">Availability</span>
        <select
          value={filters.availability}
          onChange={(event) =>
            onChange({ ...filters, availability: event.target.value as RecommendationFilters["availability"] })
          }
        >
          <option value="ALL">All</option>
          <option value="free_agent">Free Agent</option>
          <option value="waivers">Waivers</option>
        </select>
      </label>
      <label>
        <span className="dash-meta-label">Support</span>
        <select
          value={filters.support}
          onChange={(event) => onChange({ ...filters, support: event.target.value as RecommendationFilters["support"] })}
        >
          <option value="ALL">All</option>
          <option value="strongly_supported">Strong support</option>
          <option value="supported">Supported</option>
          <option value="limited">Limited data</option>
        </select>
      </label>
    </form>
  );
}
