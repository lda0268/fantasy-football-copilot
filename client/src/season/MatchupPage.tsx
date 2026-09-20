import { useEffect, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import { ROUTES } from "../app/routes";
import type { MatchupPlayerView, MatchupSide } from "../api/types";
import { DashboardHeader } from "./DashboardHeader";
import { formatScore, formatTableNumber, IDENTITY_LABELS } from "./labels";
import { loadMatchup, type MatchupPageData } from "./loadMatchup";
import { groupLabel, statusLabel } from "./matchupView";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";

type MatchupPageProps = {
  navigate: (to: string) => void;
  load?: () => Promise<MatchupPageData>;
};

export function MatchupPage({ navigate, load = loadMatchup }: MatchupPageProps) {
  const [data, setData] = useState<MatchupPageData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
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

  if (loading) {
    return <LoadingState message="Loading matchup…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const matchup = data.matchup;
  const yahooBlocked = Boolean(data.yahooError) && !matchup?.user;
  const week = matchup?.week ?? data.leagues[0]?.currentWeek;
  const selected = findPlayer(matchup, selectedKey);
  const proposed = data.startSit?.summary.proposedChanges ?? 0;

  return (
    <div className="matchup-page" data-testid="matchup-page">
      <DashboardHeader
        title="Matchup"
        description="This week's head-to-head lineup and player outlook."
        leagueName={matchup?.league?.name}
        week={week}
        yahooStatus={data.yahooStatus}
        fantasyProsStatus={data.fantasyProsStatus}
        leagues={data.leagues}
      />
      <p className="page-links">
        <a href={ROUTES.league} className="text-link" onClick={(event) => { event.preventDefault(); navigate(ROUTES.league); }}>
          View League
        </a>
        <a href={ROUTES.players} className="text-link" onClick={(event) => { event.preventDefault(); navigate(ROUTES.players); }}>
          Research players
        </a>
        <a href={ROUTES.startSit} className="text-link" onClick={(event) => { event.preventDefault(); navigate(ROUTES.startSit); }}>
          Review Start/Sit
        </a>
      </p>
      {yahooBlocked ? (
        <ProviderErrorState message={userFacingApiMessage(data.yahooError)} />
      ) : null}
      {data.fantasyProsError && matchup?.user ? (
        <p className="muted">FantasyPros weekly intelligence is unavailable. Yahoo matchup and lineups are still shown.</p>
      ) : null}
      {!matchup?.fantasyProsAvailable && matchup?.user ? (
        <p className="muted">FantasyPros weekly intelligence is unavailable. Yahoo matchup and lineups are still shown.</p>
      ) : null}

      {!yahooBlocked && !matchup?.matchupPresent ? (
        <EmptyState title="No current matchup" message="Yahoo did not return a head-to-head matchup for this week." />
      ) : null}

      {matchup?.user ? (
        <>
          <section className="panel-card matchup-scoreboard" aria-labelledby="matchup-scoreboard-heading">
            <div className="panel-heading-row">
              <h2 id="matchup-scoreboard-heading">Scoreboard</h2>
              {matchup.matchupStatusLabel ? <p className="matchup-state">{matchup.matchupStatusLabel}</p> : null}
            </div>
            <div className="matchup-board">
              <ScoreboardSide side={matchup.user} you />
              <span className="matchup-vs">vs</span>
              {matchup.opponent ? <ScoreboardSide side={matchup.opponent} /> : <p className="muted">Opponent unavailable</p>}
            </div>
          </section>

          <section className="panel-card" aria-labelledby="lineup-summary-heading">
            <h2 id="lineup-summary-heading">Lineup Summary</h2>
            <div className="lineup-summary-grid">
              <SummaryCard side={matchup.user} />
              {matchup.opponent ? <SummaryCard side={matchup.opponent} /> : null}
            </div>
            {!matchup.differences.comparable && matchup.opponent ? (
              <p className="projection-note">Known FantasyPros totals are not directly comparable because projection coverage differs.</p>
            ) : null}
          </section>

          {proposed > 0 ? (
            <p className="readonly-note">
              Co-Pilot has {proposed} lineup recommendation{proposed === 1 ? "" : "s"} available.{" "}
              <a href={ROUTES.startSit} className="text-link" onClick={(event) => { event.preventDefault(); navigate(ROUTES.startSit); }}>
                Review Start/Sit
              </a>
            </p>
          ) : null}

          <section className="panel-card" aria-labelledby="starting-lineups-heading">
            <h2 id="starting-lineups-heading">Starting Lineups</h2>
            <p className="muted">Yahoo starting lineups as currently set. This page does not apply Start/Sit moves.</p>
            <div className="starting-compare">
              {matchup.comparison.slots.map((row) => (
                <div key={row.id} className="starting-row" data-slot={row.displayPosition}>
                  <PlayerCell
                    slot={row.displayPosition}
                    player={row.user}
                    selected={selectedKey === row.user?.yahooPlayerKey}
                    onSelect={setSelectedKey}
                  />
                  <PlayerCell
                    slot={row.displayPosition}
                    player={row.opponent}
                    selected={selectedKey === row.opponent?.yahooPlayerKey}
                    onSelect={setSelectedKey}
                    emptyLabel={matchup.opponentError ? "Opponent roster unavailable" : "Empty slot"}
                  />
                </div>
              ))}
            </div>
            {selected ? <PlayerDetail player={selected} /> : null}
          </section>

          {matchup.availabilityNotes.length > 0 ? (
            <section className="panel-card" aria-labelledby="availability-notes-heading">
              <h2 id="availability-notes-heading">Availability Notes</h2>
              <p>
                {matchup.availabilityNotes.filter((note) => note.group === "starter").length} starters have explicit
                injury/availability flags.
              </p>
              <ul className="availability-list">
                {matchup.availabilityNotes.map((note) => (
                  <li key={`${note.teamName}-${note.playerName}-${note.group}`}>
                    <span>{note.playerName}</span>
                    <span className="cell-sub">
                      {note.teamName} · {groupLabel(note.group)}
                      {note.slot ? ` · ${note.slot}` : ""}
                    </span>
                    <span className="injury-status">{note.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel-card" aria-labelledby="facts-heading">
            <h2 id="facts-heading">Lineup facts</h2>
            <dl className="intel-grid">
              <div>
                <dt>Known projection</dt>
                <dd>
                  {matchup.user.name}: {formatScore(matchup.differences.userKnownProjection ?? 0)} known pts
                  {matchup.opponent ? ` · ${matchup.opponent.name}: ${formatScore(matchup.differences.opponentKnownProjection ?? 0)} known pts` : ""}
                </dd>
              </div>
              <div>
                <dt>Weekly data coverage</dt>
                <dd>
                  {matchup.user.name}: {matchup.user.summary.projectedSlots}/{matchup.user.summary.totalSlots}
                  {matchup.opponent ? ` · ${matchup.opponent.name}: ${matchup.opponent.summary.projectedSlots}/${matchup.opponent.summary.totalSlots}` : ""}
                </dd>
              </div>
              <div>
                <dt>Explicit injury flags</dt>
                <dd>
                  {matchup.user.name}: {matchup.user.summary.injuryFlags}
                  {matchup.opponent ? ` · ${matchup.opponent.name}: ${matchup.opponent.summary.injuryFlags}` : ""}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel-card" aria-labelledby="bench-heading">
            <h2 id="bench-heading">Bench</h2>
            <div className="bench-split">
              <BenchTable title={matchup.user.name} players={matchup.user.bench} selectedKey={selectedKey} onSelect={setSelectedKey} />
              {matchup.opponent ? (
                <BenchTable title={matchup.opponent.name} players={matchup.opponent.bench} selectedKey={selectedKey} onSelect={setSelectedKey} />
              ) : (
                <p className="muted">{matchup.opponentError ?? "Opponent bench unavailable."}</p>
              )}
            </div>
          </section>

          {(matchup.user.ir.length > 0 || (matchup.opponent?.ir.length ?? 0) > 0) ? (
            <section className="panel-card" aria-labelledby="ir-heading">
              <h2 id="ir-heading">IR / Inactive</h2>
              <div className="bench-split">
                <BenchTable title={matchup.user.name} players={matchup.user.ir} selectedKey={selectedKey} onSelect={setSelectedKey} />
                {matchup.opponent ? (
                  <BenchTable title={matchup.opponent.name} players={matchup.opponent.ir} selectedKey={selectedKey} onSelect={setSelectedKey} />
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {matchup?.opponentError && matchup.user ? (
        <ProviderErrorState title="Opponent roster unavailable" message={matchup.opponentError} />
      ) : null}
    </div>
  );
}

function ScoreboardSide({ side, you }: { side: MatchupSide; you?: boolean }) {
  return (
    <div className={you ? "matchup-side is-you" : "matchup-side"}>
      <p className="matchup-name">
        {side.name}
        {you ? <span className="you-tag">You</span> : null}
      </p>
      <p className="matchup-score">
        <span className="score-label">Score</span>
        {side.points !== undefined ? formatScore(side.points) : "—"}
      </p>
      {side.yahooProjectedPoints !== undefined ? (
        <p className="matchup-proj">
          <span className="score-label">Yahoo projected score</span>
          {formatScore(side.yahooProjectedPoints)}
        </p>
      ) : null}
    </div>
  );
}

function SummaryCard({ side }: { side: MatchupSide }) {
  return (
    <div className="summary-card">
      <h3>{side.name}</h3>
      <p className="projection-points">{formatScore(side.summary.knownProjectedPoints)} known pts</p>
      <p className="projection-complete">
        {side.summary.projectedSlots} of {side.summary.totalSlots} projected
      </p>
      <p className="muted">FantasyPros known lineup projection</p>
      <p className="muted">{side.summary.injuryFlags} explicit injury flags</p>
      <p className="muted">{side.summary.playersWithWeeklyIntelligence} players with weekly intelligence</p>
    </div>
  );
}

function PlayerCell({
  slot,
  player,
  selected,
  onSelect,
  emptyLabel = "Empty slot",
}: {
  slot: string;
  player?: MatchupPlayerView;
  selected: boolean;
  onSelect: (key: string | undefined) => void;
  emptyLabel?: string;
}) {
  if (!player) {
    return (
      <div className="starting-cell is-empty">
        <span className="slot-code">{slot}</span>
        <span className="muted">{emptyLabel}</span>
      </div>
    );
  }
  const proj = formatTableNumber(player.weeklyProjectedPoints);
  const ecr = formatTableNumber(player.weeklyEcr);
  const status = statusLabel(player);
  return (
    <div className={selected ? "starting-cell is-selected" : "starting-cell"}>
      <span className="slot-code">{slot}</span>
      <button
        type="button"
        className="text-btn player-open"
        aria-expanded={selected}
        onClick={() => onSelect(selected ? undefined : player.yahooPlayerKey)}
      >
        {player.name}
      </button>
      <span className="cell-sub">
        {player.position ?? "—"}
        {player.team ? ` · ${player.team}` : ""}
      </span>
      <span className={proj.missing ? "is-missing" : undefined}>Wk {proj.text}</span>
      <span className={ecr.missing ? "is-missing" : undefined}>ECR {ecr.text}</span>
      <span className={status === "—" ? "is-missing" : "injury-status"}>{status}</span>
      <span className="cell-sub">{player.weeklyDataLabel}</span>
    </div>
  );
}

function BenchTable({
  title,
  players,
  selectedKey,
  onSelect,
}: {
  title: string;
  players: MatchupPlayerView[];
  selectedKey?: string;
  onSelect: (key: string | undefined) => void;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {players.length === 0 ? (
        <p className="muted">None listed.</p>
      ) : (
        <ol className="bench-list">
          {players.map((player) => {
            const proj = formatTableNumber(player.weeklyProjectedPoints);
            const ecr = formatTableNumber(player.weeklyEcr);
            return (
              <li key={player.yahooPlayerKey}>
                <button
                  type="button"
                  className="text-btn"
                  aria-expanded={selectedKey === player.yahooPlayerKey}
                  onClick={() => onSelect(selectedKey === player.yahooPlayerKey ? undefined : player.yahooPlayerKey)}
                >
                  {player.name}
                </button>
                <span className="cell-sub">
                  {player.position ?? "—"}
                  {player.team ? ` · ${player.team}` : ""} · Wk {proj.text} · ECR {ecr.text} · {statusLabel(player)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function PlayerDetail({ player }: { player: MatchupPlayerView }) {
  return (
    <section className="player-detail" aria-label={`${player.name} details`}>
      <h3>{player.name}</h3>
      <dl className="intel-grid">
        <div>
          <dt>Fantasy team</dt>
          <dd>{player.fantasyTeam ?? "—"}</dd>
        </div>
        <div>
          <dt>Lineup slot</dt>
          <dd>{player.slot ?? "—"}</dd>
        </div>
        <div>
          <dt>NFL team</dt>
          <dd>{player.team ?? "—"}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{player.position ?? "—"}</dd>
        </div>
        <div>
          <dt>Bye</dt>
          <dd>{player.byeWeek ?? "—"}</dd>
        </div>
        <div>
          <dt>Weekly projection</dt>
          <dd className={formatTableNumber(player.weeklyProjectedPoints).missing ? "is-missing" : undefined}>
            {formatTableNumber(player.weeklyProjectedPoints).text}
          </dd>
        </div>
        <div>
          <dt>Weekly ECR</dt>
          <dd className={formatTableNumber(player.weeklyEcr).missing ? "is-missing" : undefined}>
            {formatTableNumber(player.weeklyEcr).text}
          </dd>
        </div>
        <div>
          <dt>Injury</dt>
          <dd>{player.injuryStatus ?? "—"}</dd>
        </div>
        <div>
          <dt>Practice</dt>
          <dd>{player.practiceStatus ?? "—"}</dd>
        </div>
        <div>
          <dt>Injury description</dt>
          <dd>{player.injuryDescription ?? "—"}</dd>
        </div>
        <div>
          <dt>Identity</dt>
          <dd>{IDENTITY_LABELS[player.identityStatus] ?? player.identityStatus}</dd>
        </div>
      </dl>
      {player.warnings.length > 0 ? (
        <ul className="need-notes">
          {player.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function findPlayer(matchup: MatchupPageData["matchup"], key?: string): MatchupPlayerView | undefined {
  if (!matchup || !key) {
    return undefined;
  }
  const pool = [
    ...matchup.comparison.slots.flatMap((row) => [row.user, row.opponent]),
    ...(matchup.user?.bench ?? []),
    ...(matchup.opponent?.bench ?? []),
    ...(matchup.user?.ir ?? []),
    ...(matchup.opponent?.ir ?? []),
  ];
  return pool.find((player) => player?.yahooPlayerKey === key);
}
