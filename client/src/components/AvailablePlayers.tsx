import type { RefObject } from "react";
import type { Player } from "../types/draft";
import type { PositionFilter } from "../engine/playerSearch";
import type { Recommendation } from "../engine/recommendations";
import { formatExpertRank, formatMarketAdp, formatProjectedPoints } from "../engine/data/sourceFields";
import { survivalPercent } from "../engine/survivalProbability";

interface QuickSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onEnterDraft: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  positionFilter: PositionFilter;
  onPositionFilterChange: (filter: PositionFilter) => void;
}

const FILTERS: PositionFilter[] = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

export function QuickSearch({
  query,
  onQueryChange,
  onEnterDraft,
  inputRef,
  positionFilter,
  onPositionFilterChange,
}: QuickSearchProps) {
  return (
    <div className="quick-search">
      <input
        ref={inputRef}
        className="search-input search-input-focus"
        type="search"
        placeholder="Quick search — type a name, Enter to draft"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnterDraft();
          }
        }}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="position-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={positionFilter === filter ? "filter-btn active" : "filter-btn"}
            onClick={() => onPositionFilterChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}

interface AvailablePlayersProps {
  players: Player[];
  scores?: Map<string, Recommendation>;
  onDraftPlayer: (player: Player) => void;
}

export function AvailablePlayers({ players, scores, onDraftPlayer }: AvailablePlayersProps) {
  return (
    <div className="panel column-scroll">
      <h2>Available Players</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Projected Points</th>
            <th>ESPN Rank</th>
            <th>Superflex ADP</th>
            <th>League Rank</th>
            <th>Recommendation Score</th>
            <th>Survival %</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const scored = scores?.get(player.id);
            return (
              <tr key={player.id} onClick={() => onDraftPlayer(player)}>
                <td>{player.name}</td>
                <td>{player.position}</td>
                <td>{player.team}</td>
                <td>{formatProjectedPoints(player, scored)}</td>
                <td>{formatExpertRank(player)}</td>
                <td>{formatMarketAdp(player)}</td>
                <td>{scored ? scored.leagueAdjustedRank : "—"}</td>
                <td>{scored ? scored.score : "—"}</td>
                <td>{scored ? `${survivalPercent(scored.survivalProbability)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
