import type { RosterFilters } from "./rosterView";
import { POSITION_FILTERS } from "./filterRecommendations";

type MyTeamFiltersProps = {
  filters: RosterFilters;
  onChange: (next: RosterFilters) => void;
  onClear: () => void;
};

export function MyTeamFilters({ filters, onChange, onClear }: MyTeamFiltersProps) {
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
          onChange={(event) => onChange({ ...filters, position: event.target.value as RosterFilters["position"] })}
        >
          {POSITION_FILTERS.map((position) => (
            <option key={position} value={position}>
              {position === "ALL" ? "All" : position}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="dash-meta-label">Roster group</span>
        <select
          value={filters.group}
          onChange={(event) => onChange({ ...filters, group: event.target.value as RosterFilters["group"] })}
        >
          <option value="ALL">All</option>
          <option value="starter">Starters</option>
          <option value="bench">Bench</option>
          <option value="ir">IR</option>
        </select>
      </label>
      <label>
        <span className="dash-meta-label">Injury</span>
        <select
          value={filters.injury}
          onChange={(event) => onChange({ ...filters, injury: event.target.value as RosterFilters["injury"] })}
        >
          <option value="ALL">All</option>
          <option value="flagged">Injury flags</option>
          <option value="none">No injury record</option>
        </select>
      </label>
      <button type="button" className="text-btn filter-clear" onClick={onClear}>
        Clear filters
      </button>
    </form>
  );
}
