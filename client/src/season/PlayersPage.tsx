import { useEffect, useMemo, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import { ROUTES } from "../app/routes";
import type { PlayerIntelligence } from "../api/types";
import { DashboardHeader } from "./DashboardHeader";
import { POSITION_FILTERS } from "./filterRecommendations";
import { IDENTITY_LABELS, IDENTITY_METHOD_LABELS, formatTableNumber } from "./labels";
import { loadPlayers, type PlayersPageData } from "./loadPlayers";
import {
  EMPTY_PLAYERS_FILTERS,
  PLAYERS_SORT_LABELS,
  coverageLabel,
  filterPlayersView,
  formatPercentOwned,
  leagueStatusLabel,
  orderPlayersAlphabetically,
  sortPlayers,
  type PlayersFilters,
  type PlayersSortKey,
  type SortDirection,
} from "./playersView";
import { matchedIntelligence } from "./rosterView";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";

type PlayersPageProps = {
  navigate: (to: string) => void;
  load?: () => Promise<PlayersPageData>;
};

export function PlayersPage({ navigate, load = loadPlayers }: PlayersPageProps) {
  const [data, setData] = useState<PlayersPageData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
  const [filters, setFilters] = useState<PlayersFilters>(EMPTY_PLAYERS_FILTERS);
  const [sortKey, setSortKey] = useState<PlayersSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedKey, setSelectedKey] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setFatal(undefined);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFatal(userFacingApiMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const players = data?.players ?? [];
    return sortPlayers(filterPlayersView(orderPlayersAlphabetically(players), filters), sortKey, sortDirection);
  }, [data, filters, sortKey, sortDirection]);

  const selected = filtered.find((player) => player.identity.yahooPlayerKey === selectedKey);

  if (loading) {
    return <LoadingState message="Loading players…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const yahooBlocked = Boolean(data.yahooError) && data.players.length === 0;
  const week = data.leagues[0]?.currentWeek;

  return (
    <div className="players-page" data-testid="players">
      <DashboardHeader
        title="Players"
        description="Search and research players across your fantasy league."
        leagueName={data.leagues[0]?.name}
        week={week}
        yahooStatus={data.yahooStatus}
        fantasyProsStatus={data.fantasyProsStatus}
        leagues={data.leagues}
      />
      {yahooBlocked ? (
        <ProviderErrorState
          message={userFacingApiMessage(data.yahooError)}
          detail={data.yahooError instanceof Error ? `${data.yahooError.name}: ${data.yahooError.message}` : undefined}
        />
      ) : null}
      {data.fantasyProsError ? (
        <ProviderErrorState
          title="FantasyPros data unavailable"
          message={userFacingApiMessage(data.fantasyProsError)}
        />
      ) : null}
      {data.intelligenceError && data.players.length === 0 && !yahooBlocked ? (
        <ProviderErrorState message={userFacingApiMessage(data.intelligenceError)} />
      ) : null}
      {!yahooBlocked ? (
        <>
          <PlayersFiltersForm
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(EMPTY_PLAYERS_FILTERS)}
          />
          <section className="panel-card" aria-labelledby="player-results-heading">
            <h2 id="player-results-heading">Player results</h2>
            {data.players.length === 0 ? (
              <EmptyState message="No players are available." />
            ) : filtered.length === 0 ? (
              <EmptyState message="No players match the current search and filters." />
            ) : (
              <PlayersTable
                players={filtered}
                selectedKey={selectedKey}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={(key) => {
                  if (sortKey === key) {
                    setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
                    return;
                  }
                  setSortKey(key);
                  setSortDirection(key === "name" ? "asc" : "desc");
                }}
                onSelect={(player) =>
                  setSelectedKey((current) =>
                    current === player.identity.yahooPlayerKey ? undefined : player.identity.yahooPlayerKey,
                  )
                }
              />
            )}
          </section>
          {selected ? <PlayerResearchPanel player={selected} navigate={navigate} /> : null}
        </>
      ) : null}
    </div>
  );
}

function PlayersFiltersForm({
  filters,
  onChange,
  onClear,
}: {
  filters: PlayersFilters;
  onChange: (next: PlayersFilters) => void;
  onClear: () => void;
}) {
  return (
    <form className="waiver-filters players-filters" onSubmit={(event) => event.preventDefault()}>
      <label className="waiver-search players-search">
        <span className="dash-meta-label">Search</span>
        <input
          type="search"
          value={filters.query}
          placeholder="Name, NFL team, or position"
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
      </label>
      <label>
        <span className="dash-meta-label">Position</span>
        <select
          value={filters.position}
          onChange={(event) => onChange({ ...filters, position: event.target.value as PlayersFilters["position"] })}
        >
          {POSITION_FILTERS.map((position) => (
            <option key={position} value={position}>
              {position === "ALL" ? "All" : position}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="dash-meta-label">League status</span>
        <select
          value={filters.availability}
          onChange={(event) =>
            onChange({ ...filters, availability: event.target.value as PlayersFilters["availability"] })
          }
        >
          <option value="ALL">All</option>
          <option value="rostered_by_user">My Team</option>
          <option value="rostered_by_other">Other Team</option>
          <option value="waivers">Waivers</option>
          <option value="free_agent">Free Agent</option>
        </select>
      </label>
      <label>
        <span className="dash-meta-label">Data status</span>
        <select
          value={filters.identity}
          onChange={(event) => onChange({ ...filters, identity: event.target.value as PlayersFilters["identity"] })}
        >
          <option value="ALL">All</option>
          <option value="matched">Enriched</option>
          <option value="unresolved">Intelligence unavailable</option>
          <option value="ambiguous">Identity needs review</option>
        </select>
      </label>
      <label>
        <span className="dash-meta-label">Injury</span>
        <select
          value={filters.injury}
          onChange={(event) => onChange({ ...filters, injury: event.target.value as PlayersFilters["injury"] })}
        >
          <option value="ALL">All</option>
          <option value="flagged">Injury flagged</option>
          <option value="none">No explicit injury flag</option>
        </select>
      </label>
      <button type="button" className="text-btn filter-clear" onClick={onClear}>
        Clear filters
      </button>
    </form>
  );
}

function PlayersTable({
  players,
  selectedKey,
  sortKey,
  sortDirection,
  onSort,
  onSelect,
}: {
  players: PlayerIntelligence[];
  selectedKey?: string;
  sortKey: PlayersSortKey;
  sortDirection: SortDirection;
  onSort: (key: PlayersSortKey) => void;
  onSelect: (player: PlayerIntelligence) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table players-table">
        <thead>
          <tr>
            <SortHeader label="Player" column="name" active={sortKey} direction={sortDirection} onSort={onSort} />
            <th>Pos</th>
            <th>NFL Team</th>
            <th>League Status</th>
            <SortHeader label="Week Proj" column="weeklyProj" active={sortKey} direction={sortDirection} onSort={onSort} />
            <SortHeader label="Wk ECR" column="weeklyEcr" active={sortKey} direction={sortDirection} onSort={onSort} />
            <SortHeader label="ROS Proj" column="rosProj" active={sortKey} direction={sortDirection} onSort={onSort} />
            <SortHeader label="ROS ECR" column="rosEcr" active={sortKey} direction={sortDirection} onSort={onSort} />
            <th>Injury</th>
            <th>Bye</th>
            <SortHeader label="% Owned" column="owned" active={sortKey} direction={sortDirection} onSort={onSort} />
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const intel = matchedIntelligence(player);
            const weeklyProj = formatTableNumber(intel.weekly?.projectedPoints);
            const weeklyEcr = formatTableNumber(intel.weekly?.ecr);
            const rosProj = formatTableNumber(intel.restOfSeason?.projectedPoints);
            const rosEcr = formatTableNumber(intel.restOfSeason?.ecr);
            const owned = formatPercentOwned(player.leagueState.percentOwned);
            const open = selectedKey === player.identity.yahooPlayerKey;
            return (
              <tr key={player.identity.yahooPlayerKey} className={open ? "is-open" : undefined} aria-selected={open}>
                <td className="roster-player">
                  <span className="player-name" title={player.player.name}>
                    {player.player.name}
                  </span>
                  <span className="cell-sub">{IDENTITY_LABELS[player.identity.status] ?? player.identity.status}</span>
                </td>
                <td>{player.player.position ?? "—"}</td>
                <td>{player.player.team ?? "—"}</td>
                <td>{leagueStatusLabel(player.leagueState.availability)}</td>
                <td className={weeklyProj.missing ? "is-missing" : undefined}>{weeklyProj.text}</td>
                <td className={weeklyEcr.missing ? "is-missing" : undefined}>{weeklyEcr.text}</td>
                <td className={rosProj.missing ? "is-missing" : undefined}>{rosProj.text}</td>
                <td className={rosEcr.missing ? "is-missing" : undefined}>{rosEcr.text}</td>
                <td className={intel.injury?.status ? "injury-status" : undefined}>{intel.injury?.status ?? "—"}</td>
                <td>{player.leagueState.byeWeek ?? "—"}</td>
                <td className={owned.missing ? "is-missing" : undefined}>{owned.missing ? "—" : owned.text.replace(" rostered", "")}</td>
                <td>
                  <button type="button" className="text-btn" aria-expanded={open} onClick={() => onSelect(player)}>
                    {open ? "Hide details" : "View details"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string;
  column: PlayersSortKey;
  active: PlayersSortKey;
  direction: SortDirection;
  onSort: (key: PlayersSortKey) => void;
}) {
  const isActive = active === column;
  return (
    <th aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={isActive ? "sort-btn is-active" : "sort-btn"}
        onClick={() => onSort(column)}
      >
        {label}
        {isActive ? <span className="sort-dir">{direction === "asc" ? "↑" : "↓"}</span> : null}
        <span className="visually-hidden">
          {isActive ? `, sorted ${direction === "asc" ? "ascending" : "descending"}` : `, sort by ${PLAYERS_SORT_LABELS[column]}`}
        </span>
      </button>
    </th>
  );
}

function PlayerResearchPanel({ player, navigate }: { player: PlayerIntelligence; navigate: (to: string) => void }) {
  const intel = matchedIntelligence(player);
  const weeklyProj = formatTableNumber(intel.weekly?.projectedPoints);
  const weeklyEcr = formatTableNumber(intel.weekly?.ecr);
  const rosProj = formatTableNumber(intel.restOfSeason?.projectedPoints);
  const rosEcr = formatTableNumber(intel.restOfSeason?.ecr);
  const owned = formatPercentOwned(player.leagueState.percentOwned);
  const availability = player.leagueState.availability;
  const headingId = "player-research-heading";
  return (
    <section className="panel-card player-detail" aria-labelledby={headingId}>
      <h2 id={headingId}>{player.player.name}</h2>
      <h3>Player</h3>
      <dl className="intel-grid">
        <div>
          <dt>NFL team</dt>
          <dd>{player.player.team ?? "—"}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{player.player.position ?? "—"}</dd>
        </div>
        <div>
          <dt>Bye week</dt>
          <dd>{player.leagueState.byeWeek ?? "—"}</dd>
        </div>
      </dl>
      <h3>League status</h3>
      <dl className="intel-grid">
        <div>
          <dt>Availability</dt>
          <dd>{leagueStatusLabel(availability)}</dd>
        </div>
        <div>
          <dt>Percent owned</dt>
          <dd>{owned.text}</dd>
        </div>
        <div>
          <dt>Yahoo player key</dt>
          <dd>{player.identity.yahooPlayerKey}</dd>
        </div>
      </dl>
      {availability === "rostered_by_user" ? (
        <p>
          <a
            className="text-link"
            href={ROUTES.team}
            onClick={(event) => {
              event.preventDefault();
              navigate(ROUTES.team);
            }}
          >
            View My Team
          </a>
        </p>
      ) : null}
      {availability === "free_agent" || availability === "waivers" ? (
        <p>
          <a
            className="text-link"
            href={ROUTES.waivers}
            onClick={(event) => {
              event.preventDefault();
              navigate(ROUTES.waivers);
            }}
          >
            View Waiver Wire
          </a>
        </p>
      ) : null}
      <h3>This week</h3>
      <dl className="intel-grid">
        <div>
          <dt>{intel.weekly?.week != null ? `Week ${intel.weekly.week} projection` : "Weekly projection"}</dt>
          <dd className={weeklyProj.missing ? "is-missing" : undefined}>{weeklyProj.text}</dd>
        </div>
        <div>
          <dt>Weekly ECR</dt>
          <dd className={weeklyEcr.missing ? "is-missing" : undefined}>{weeklyEcr.text}</dd>
        </div>
      </dl>
      <h3>Rest of season</h3>
      <dl className="intel-grid">
        <div>
          <dt>ROS projection</dt>
          <dd className={rosProj.missing ? "is-missing" : undefined}>{rosProj.text}</dd>
        </div>
        <div>
          <dt>ROS ECR</dt>
          <dd className={rosEcr.missing ? "is-missing" : undefined}>{rosEcr.text}</dd>
        </div>
      </dl>
      <h3>Health</h3>
      <dl className="intel-grid">
        <div>
          <dt>Injury status</dt>
          <dd>{intel.injury?.status ?? "—"}</dd>
        </div>
        <div>
          <dt>Practice status</dt>
          <dd>{intel.injury?.practiceStatus ?? "—"}</dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{intel.injury?.description ?? "—"}</dd>
        </div>
      </dl>
      <h3>Data / identity</h3>
      <dl className="intel-grid">
        <div>
          <dt>Identity</dt>
          <dd>{IDENTITY_LABELS[player.identity.status] ?? player.identity.status}</dd>
        </div>
        <div>
          <dt>Match method</dt>
          <dd>
            {player.identity.method ? (IDENTITY_METHOD_LABELS[player.identity.method] ?? player.identity.method) : "—"}
          </dd>
        </div>
        <div>
          <dt>Data completeness</dt>
          <dd>{coverageLabel(player)}</dd>
        </div>
      </dl>
      {player.warnings.length > 0 ? (
        <>
          <h3>Warnings</h3>
          <ul className="need-notes">
            {player.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
      {player.provenance ? (
        <>
          <h3>Provenance</h3>
          <dl className="intel-grid">
            {Object.entries(player.provenance.fields).map(([field, meta]) => (
              <div key={field}>
                <dt>{provenanceFieldLabel(field)}</dt>
                <dd>{meta.provider === "yahoo" ? "Yahoo" : "FantasyPros"}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      {player.freshness?.yahoo?.observedAt || player.freshness?.fantasyPros?.observedAt ? (
        <>
          <h3>Data freshness</h3>
          <dl className="intel-grid">
            {player.freshness.yahoo?.observedAt ? (
              <div>
                <dt>Yahoo observed</dt>
                <dd>{player.freshness.yahoo.observedAt}</dd>
              </div>
            ) : null}
            {player.freshness.fantasyPros?.observedAt ? (
              <div>
                <dt>FantasyPros observed</dt>
                <dd>{player.freshness.fantasyPros.observedAt}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
    </section>
  );
}

function provenanceFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    availability: "League status",
    rosterSlot: "Roster slot",
    percentOwned: "Percent owned",
    byeWeek: "Bye week",
    weeklyProjection: "Weekly projection",
    weeklyEcr: "Weekly ECR",
    rosProjection: "ROS projection",
    rosEcr: "ROS ECR",
    injuryStatus: "Injury status",
  };
  return labels[field] ?? field;
}
