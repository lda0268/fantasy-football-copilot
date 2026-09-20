import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { userFacingApiMessage } from "../api/http";
import { ROUTES } from "../app/routes";
import type { PlayerIntelligence } from "../api/types";
import { DashboardHeader } from "./DashboardHeader";
import { IDENTITY_LABELS, formatTableNumber } from "./labels";
import { loadPlayers, type PlayersPageData } from "./loadPlayers";
import {
  COMPARE_PROVENANCE_FIELDS,
  buildComparePath,
  comparisonContext,
  filterCompareCandidates,
  formatOwnership,
  numericDifference,
  parseCompareSearch,
  playerByKey,
  provenanceLabel,
  resolveCompareKeys,
  type CompareKeys,
} from "./compareView";
import { coverageLabel, leagueStatusLabel } from "./playersView";
import { matchedIntelligence } from "./rosterView";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";

type ComparePageProps = {
  navigate: (to: string) => void;
  search?: string;
  load?: () => Promise<PlayersPageData>;
};

export function ComparePage({ navigate, search = "", load = loadPlayers }: ComparePageProps) {
  const [data, setData] = useState<PlayersPageData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
  const [keys, setKeys] = useState<CompareKeys>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setKeys(resolveCompareKeys(result.players, parseCompareSearch(search || window.location.search)));
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

  useEffect(() => {
    if (!data) {
      return;
    }
    setKeys(resolveCompareKeys(data.players, parseCompareSearch(search || window.location.search)));
  }, [data, search]);

  const playerA = playerByKey(data?.players ?? [], keys.a);
  const playerB = playerByKey(data?.players ?? [], keys.b);

  if (loading) {
    return <LoadingState message="Loading players…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const yahooBlocked = Boolean(data.yahooError) && data.players.length === 0;
  const week = data.leagues[0]?.currentWeek;
  const intelA = playerA ? matchedIntelligence(playerA) : undefined;
  const intelB = playerB ? matchedIntelligence(playerB) : undefined;
  const complete = Boolean(playerA && playerB);
  const summary = complete && playerA && playerB ? comparisonContext(playerA, playerB, week) : undefined;
  const weeklyDiff = complete ? numericDifference(intelA?.weekly?.projectedPoints, intelB?.weekly?.projectedPoints) : undefined;
  const rosDiff = complete ? numericDifference(intelA?.restOfSeason?.projectedPoints, intelB?.restOfSeason?.projectedPoints) : undefined;
  const crossPosition = complete && playerA && playerB && playerA.player.position !== playerB.player.position;

  function updateKeys(next: CompareKeys) {
    const resolved = resolveCompareKeys(data?.players ?? [], next);
    setKeys(resolved);
    navigate(buildComparePath(resolved));
  }

  return (
    <div className="compare-page" data-testid="compare">
      <DashboardHeader
        title="Player Compare"
        description="Compare weekly, rest-of-season, health, and league context."
        leagueName={data.leagues[0]?.name}
        week={week}
        yahooStatus={data.yahooStatus}
        fantasyProsStatus={data.fantasyProsStatus}
        leagues={data.leagues}
      />
      <p className="page-links">
        <a className="text-link" href={ROUTES.players} onClick={(event) => { event.preventDefault(); navigate(ROUTES.players); }}>
          Research Players
        </a>
      </p>
      {yahooBlocked ? <ProviderErrorState message={userFacingApiMessage(data.yahooError)} /> : null}
      {data.fantasyProsError ? (
        <p className="muted">FantasyPros weekly intelligence is unavailable. Yahoo player records can still be compared.</p>
      ) : null}
      {data.intelligenceError && data.players.length === 0 && !yahooBlocked ? (
        <ProviderErrorState message={userFacingApiMessage(data.intelligenceError)} />
      ) : null}

      {!yahooBlocked ? (
        <>
          <section className="panel-card" aria-labelledby="compare-select-heading">
            <div className="panel-heading-row">
              <h2 id="compare-select-heading">Player selectors</h2>
              <div className="compare-actions">
                <button type="button" className="text-btn" onClick={() => updateKeys({ a: keys.b, b: keys.a })} disabled={!keys.a && !keys.b}>
                  Swap players
                </button>
                <button type="button" className="text-btn" onClick={() => updateKeys({})} disabled={!keys.a && !keys.b}>
                  Clear comparison
                </button>
              </div>
            </div>
            <div className="compare-selectors">
              <PlayerPicker
                label="Player A"
                players={data.players}
                selected={playerA}
                excludeKey={keys.b}
                onSelect={(key) => updateKeys({ a: key, b: keys.b })}
                onClear={() => updateKeys({ a: undefined, b: keys.b })}
              />
              <PlayerPicker
                label="Player B"
                players={data.players}
                selected={playerB}
                excludeKey={keys.a}
                onSelect={(key) => updateKeys({ a: keys.a, b: key })}
                onClear={() => updateKeys({ a: keys.a, b: undefined })}
              />
            </div>
          </section>

          {!complete ? (
            <EmptyState
              title="Select two players to compare."
              message={playerA || playerB ? "Choose a second player to complete the comparison." : "Search the loaded player universe. No default pairing is selected."}
            />
          ) : null}

          {playerA || playerB ? (
            <section className="panel-card" aria-labelledby="compare-cards-heading">
              <h2 id="compare-cards-heading">Selected players</h2>
              {summary ? (
                <p className="compare-summary">
                  {summary.positions}
                  <span className="cell-sub">{summary.league}</span>
                  <span className="cell-sub">{summary.week}</span>
                </p>
              ) : null}
              <div className="compare-cards">
                {playerA ? <PlayerCard player={playerA} navigate={navigate} /> : <p className="muted">Player A not selected.</p>}
                {playerB ? <PlayerCard player={playerB} navigate={navigate} /> : <p className="muted">Player B not selected.</p>}
              </div>
            </section>
          ) : null}

          {complete && playerA && playerB ? (
            <>
              <CompareSection title="This Week" headingId="compare-week-heading">
                <CompareRow label="Weekly projection" left={formatTableNumber(intelA?.weekly?.projectedPoints)} right={formatTableNumber(intelB?.weekly?.projectedPoints)} difference={weeklyDiff} showDifference />
                <CompareRow label="Weekly ECR" left={formatTableNumber(intelA?.weekly?.ecr)} right={formatTableNumber(intelB?.weekly?.ecr)} />
                <CompareRow label="Weekly data" left={{ text: coverageWeekly(playerA), missing: false }} right={{ text: coverageWeekly(playerB), missing: false }} />
                {crossPosition ? (
                  <p className="muted">ECR values are shown as recorded and are not normalized across positions.</p>
                ) : null}
              </CompareSection>
              <CompareSection title="Rest of Season" headingId="compare-ros-heading">
                <CompareRow label="ROS projection" left={formatTableNumber(intelA?.restOfSeason?.projectedPoints)} right={formatTableNumber(intelB?.restOfSeason?.projectedPoints)} difference={rosDiff} showDifference />
                <CompareRow label="ROS ECR" left={formatTableNumber(intelA?.restOfSeason?.ecr)} right={formatTableNumber(intelB?.restOfSeason?.ecr)} />
              </CompareSection>
              <CompareSection title="Health / Availability" headingId="compare-health-heading">
                <CompareRow label="Injury status" left={{ text: intelA?.injury?.status ?? "—", missing: !intelA?.injury?.status }} right={{ text: intelB?.injury?.status ?? "—", missing: !intelB?.injury?.status }} />
                <CompareRow label="Practice status" left={{ text: intelA?.injury?.practiceStatus ?? "—", missing: !intelA?.injury?.practiceStatus }} right={{ text: intelB?.injury?.practiceStatus ?? "—", missing: !intelB?.injury?.practiceStatus }} />
                <CompareRow label="Injury description" left={{ text: intelA?.injury?.description ?? "—", missing: !intelA?.injury?.description }} right={{ text: intelB?.injury?.description ?? "—", missing: !intelB?.injury?.description }} />
              </CompareSection>
              <CompareSection title="League Context" headingId="compare-league-heading">
                <CompareRow label="League status" left={{ text: leagueStatusLabel(playerA.leagueState.availability), missing: false }} right={{ text: leagueStatusLabel(playerB.leagueState.availability), missing: false }} />
                <CompareRow label="Bye" left={{ text: playerA.leagueState.byeWeek != null ? String(playerA.leagueState.byeWeek) : "—", missing: playerA.leagueState.byeWeek == null }} right={{ text: playerB.leagueState.byeWeek != null ? String(playerB.leagueState.byeWeek) : "—", missing: playerB.leagueState.byeWeek == null }} />
                <CompareRow label="Percent owned" left={formatOwnership(playerA.leagueState.percentOwned)} right={formatOwnership(playerB.leagueState.percentOwned)} />
              </CompareSection>
              <CompareSection title="Data / Identity" headingId="compare-data-heading">
                <CompareRow label="Identity" left={{ text: IDENTITY_LABELS[playerA.identity.status] ?? playerA.identity.status, missing: false }} right={{ text: IDENTITY_LABELS[playerB.identity.status] ?? playerB.identity.status, missing: false }} />
                <CompareRow label="Completeness" left={{ text: coverageLabel(playerA), missing: false }} right={{ text: coverageLabel(playerB), missing: false }} />
              </CompareSection>
              <section className="panel-card" aria-labelledby="compare-warnings-heading">
                <h2 id="compare-warnings-heading">Warnings</h2>
                <div className="compare-cards">
                  <WarningList player={playerA} />
                  <WarningList player={playerB} />
                </div>
              </section>
              {(hasProvenance(playerA) || hasProvenance(playerB) || hasFreshness(playerA) || hasFreshness(playerB)) ? (
                <section className="panel-card" aria-labelledby="compare-source-heading">
                  <h2 id="compare-source-heading">Sources</h2>
                  <div className="compare-cards">
                    <SourceList player={playerA} />
                    <SourceList player={playerB} />
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function coverageWeekly(player: PlayerIntelligence): string {
  const intel = matchedIntelligence(player);
  if (player.identity.status !== "matched") {
    return coverageLabel(player);
  }
  const proj = intel.weekly?.projectedPoints !== undefined;
  const ecr = intel.weekly?.ecr !== undefined;
  if (proj && ecr) {
    return "Projection + ECR";
  }
  if (proj) {
    return "Projection only";
  }
  if (ecr) {
    return "ECR only";
  }
  return "No weekly data";
}

function PlayerPicker({
  label,
  players,
  selected,
  excludeKey,
  onSelect,
  onClear,
}: {
  label: string;
  players: PlayerIntelligence[];
  selected?: PlayerIntelligence;
  excludeKey?: string;
  onSelect: (key: string) => void;
  onClear: () => void;
}) {
  const listId = useId();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(
    () => filterCompareCandidates(players, query, excludeKey),
    [players, query, excludeKey],
  );

  useEffect(() => {
    setActive(0);
  }, [query, excludeKey]);

  return (
    <div className="player-picker">
      <label htmlFor={inputId}>{label}</label>
      {selected ? (
        <p className="picker-selected">
          {selected.player.name}
          <span className="cell-sub">
            {selected.player.position ?? "—"}
            {selected.player.team ? ` · ${selected.player.team}` : ""} · {leagueStatusLabel(selected.leagueState.availability)}
          </span>
        </p>
      ) : (
        <p className="muted">No player selected.</p>
      )}
      <div className="picker-row">
        <input
          id={inputId}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].identity.yahooPlayerKey}` : undefined}
          placeholder="Search name, team, or position"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && results[active]) {
              event.preventDefault();
              onSelect(results[active].identity.yahooPlayerKey);
              setQuery("");
              setOpen(false);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button type="button" className="text-btn" onClick={onClear} disabled={!selected}>
          {`Clear ${label}`}
        </button>
      </div>
      {open ? (
        <ul id={listId} role="listbox" className="picker-list" aria-label={`${label} results`}>
          {results.length === 0 ? (
            <li className="muted">No matching players.</li>
          ) : (
            results.map((player, index) => {
              const key = player.identity.yahooPlayerKey;
              return (
                <li key={key} role="option" id={`${listId}-${key}`} aria-selected={index === active}>
                  <button
                    type="button"
                    className={index === active ? "picker-option is-active" : "picker-option"}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      onSelect(key);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    {player.player.name}
                    <span className="cell-sub">
                      {player.player.position ?? "—"}
                      {player.player.team ? ` · ${player.player.team}` : ""} · {leagueStatusLabel(player.leagueState.availability)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

function PlayerCard({ player, navigate }: { player: PlayerIntelligence; navigate: (to: string) => void }) {
  const owned = formatOwnership(player.leagueState.percentOwned);
  const availability = player.leagueState.availability;
  return (
    <article className="summary-card">
      <h3>{player.player.name}</h3>
      <p>
        {player.player.position ?? "—"}
        {player.player.team ? ` · ${player.player.team}` : ""}
      </p>
      <p>{leagueStatusLabel(availability)}</p>
      <p className="muted">Bye {player.leagueState.byeWeek ?? "—"}</p>
      <p className={owned.missing ? "is-missing" : undefined}>{owned.missing ? "Owned —" : `Owned ${owned.text}`}</p>
      <p>{IDENTITY_LABELS[player.identity.status] ?? player.identity.status}</p>
      <p className="page-links">
        {availability === "rostered_by_user" ? (
          <a className="text-link" href={ROUTES.team} onClick={(event) => { event.preventDefault(); navigate(ROUTES.team); }}>
            View My Team
          </a>
        ) : null}
        {availability === "free_agent" || availability === "waivers" ? (
          <a className="text-link" href={ROUTES.waivers} onClick={(event) => { event.preventDefault(); navigate(ROUTES.waivers); }}>
            View Waiver Wire
          </a>
        ) : null}
      </p>
    </article>
  );
}

function CompareSection({ title, headingId, children }: { title: string; headingId: string; children: ReactNode }) {
  return (
    <section className="panel-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      <div className="compare-grid">{children}</div>
    </section>
  );
}

function CompareRow({
  label,
  left,
  right,
  difference,
  showDifference,
}: {
  label: string;
  left: { text: string; missing: boolean };
  right: { text: string; missing: boolean };
  difference?: number;
  showDifference?: boolean;
}) {
  const diff = formatTableNumber(difference);
  return (
    <div className="compare-row">
      <p className="compare-row-label">{label}</p>
      <p className={left.missing ? "is-missing" : undefined}>{left.text}</p>
      <p className={right.missing ? "is-missing" : undefined}>{right.text}</p>
      {showDifference ? <p className={diff.missing ? "is-missing" : undefined}>Difference {diff.text}</p> : null}
    </div>
  );
}

function WarningList({ player }: { player: PlayerIntelligence }) {
  return (
    <div>
      <h3>{player.player.name}</h3>
      {player.warnings.length === 0 ? (
        <p className="muted">No composed warnings.</p>
      ) : (
        <ul className="need-notes">
          {player.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceList({ player }: { player: PlayerIntelligence }) {
  const fields = Object.entries(player.provenance?.fields ?? {});
  return (
    <div>
      <h3>{player.player.name}</h3>
      {fields.length === 0 && !hasFreshness(player) ? (
        <p className="muted">No source metadata.</p>
      ) : (
        <dl className="intel-grid">
          {fields.map(([field, meta]) => (
            <div key={field}>
              <dt>{COMPARE_PROVENANCE_FIELDS[field] ?? field}</dt>
              <dd>{provenanceLabel(meta.provider)}</dd>
            </div>
          ))}
          {player.freshness?.yahoo?.observedAt ? (
            <div>
              <dt>Yahoo observed</dt>
              <dd>{player.freshness.yahoo.observedAt}</dd>
            </div>
          ) : null}
          {player.freshness?.fantasyPros?.observedAt ? (
            <div>
              <dt>FantasyPros observed</dt>
              <dd>{player.freshness.fantasyPros.observedAt}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}

function hasProvenance(player: PlayerIntelligence): boolean {
  return Object.keys(player.provenance?.fields ?? {}).length > 0;
}

function hasFreshness(player: PlayerIntelligence): boolean {
  return Boolean(player.freshness?.yahoo?.observedAt || player.freshness?.fantasyPros?.observedAt);
}
