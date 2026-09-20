import { useEffect, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import type {
  StartSitAssignment,
  StartSitLineupPlayer,
  StartSitMove,
  StartSitProjectionTotal,
  StartSitResult,
} from "../api/types";
import { DashboardHeader } from "./DashboardHeader";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";
import { formatTableNumber } from "./labels";
import { loadStartSit, type StartSitPageData } from "./loadStartSit";
import {
  formatBackendDelta,
  formatScoringFormat,
  identityLabel,
  playerStatus,
  slotChanged,
  weeklySupportLabel,
} from "./startSitView";

type StartSitPageProps = {
  load?: () => Promise<StartSitPageData>;
};

export function StartSitPage({ load = loadStartSit }: StartSitPageProps) {
  const [data, setData] = useState<StartSitPageData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    return <LoadingState message="Loading start / sit…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const rec = data.recommendation;
  const startSitBlocked = Boolean(data.startSitError) && !rec;
  const yahooBlocked = Boolean(data.yahooError) && !rec;
  const week = rec?.context.week ?? data.leagues[0]?.currentWeek;
  const selected = rec ? findPlayer(rec, selectedKey) : undefined;

  return (
    <div className="start-sit-page" data-testid="start-sit">
      <DashboardHeader
        title="Start / Sit"
        description="Optimize this week's lineup using your roster, league eligibility, projections, rankings, and availability."
        leagueName={data.leagues[0]?.name}
        week={week}
        yahooStatus={data.yahooStatus}
        fantasyProsStatus={data.fantasyProsStatus}
        leagues={data.leagues}
      />
      <p className="readonly-note">Read-only recommendations</p>
      {yahooBlocked || startSitBlocked ? (
        <ProviderErrorState
          message={userFacingApiMessage(data.startSitError ?? data.yahooError)}
          detail={
            (data.startSitError ?? data.yahooError) instanceof Error
              ? `${(data.startSitError ?? data.yahooError)!.name}: ${(data.startSitError ?? data.yahooError)!.message}`
              : undefined
          }
        />
      ) : null}
      {data.fantasyProsError ? (
        <ProviderErrorState
          title="FantasyPros data unavailable"
          message={userFacingApiMessage(data.fantasyProsError)}
        />
      ) : null}
      {!rec ? (
        yahooBlocked || startSitBlocked ? null : <EmptyState message="No rostered players are available." />
      ) : rec.summary.startingSlots === 0 ? (
        <EmptyState message="No starting lineup slots are available." />
      ) : (
        <>
          <WeeklySummary rec={rec} />
          <RecommendedChanges rec={rec} />
          <LineupComparison rec={rec} selectedKey={selectedKey} onSelect={setSelectedKey} />
          <BenchSection players={rec.bench} selectedKey={selectedKey} onSelect={setSelectedKey} />
          <IrSection players={rec.ir} selectedKey={selectedKey} onSelect={setSelectedKey} />
          <ReviewRequired rec={rec} />
          {selected ? <PlayerDetails player={selected} /> : null}
          <section className="panel-card">
            <h2 id="lineup-settings-heading">
              <button
                type="button"
                className="text-btn settings-toggle"
                aria-expanded={settingsOpen}
                aria-controls="lineup-settings"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                League lineup
              </button>
            </h2>
            {settingsOpen ? (
              <ul id="lineup-settings" className="settings-list">
                {rec.lineupSettings.map((row) => (
                  <li key={row.position}>
                    {row.position} ×{row.count}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function findPlayer(rec: StartSitResult, key?: string): StartSitLineupPlayer | undefined {
  if (!key) {
    return undefined;
  }
  const fromLineup = [...rec.currentLineup, ...rec.recommendedLineup]
    .map((row) => row.player)
    .find((player) => player?.yahooPlayerKey === key);
  return fromLineup ?? rec.bench.find((player) => player.yahooPlayerKey === key) ?? rec.ir.find((player) => player.yahooPlayerKey === key);
}

function WeeklySummary({ rec }: { rec: StartSitResult }) {
  const current = rec.summary.currentProjection;
  const recommended = rec.summary.recommendedProjection;
  const incomparable = current.complete !== recommended.complete || !current.complete || !recommended.complete;
  return (
    <section className="panel-card" aria-labelledby="weekly-summary-heading">
      <h2 id="weekly-summary-heading">Weekly lineup summary</h2>
      <ul className="health-pills">
        <li>
          <span className="health-value">{rec.context.week != null ? rec.context.week : "—"}</span>
          <span className="health-label">Week</span>
        </li>
        <li>
          <span className="health-value">{rec.summary.startingSlots}</span>
          <span className="health-label">Starting slots</span>
        </li>
        <li>
          <span className="health-value">{rec.summary.proposedChanges}</span>
          <span className="health-label">Recommended changes</span>
        </li>
        <li>
          <span className="health-value">{rec.summary.reviewRequired}</span>
          <span className="health-label">Review required</span>
        </li>
        <li>
          <span className="health-value">{formatScoringFormat(rec.context.scoringFormat)}</span>
          <span className="health-label">Scoring</span>
        </li>
      </ul>
      <div className="projection-pair">
        <ProjectionCard title="Current projection" total={current} />
        <ProjectionCard title="Recommended known projection" total={recommended} />
      </div>
      {incomparable ? (
        <p className="projection-note">These totals are not directly comparable because projection completeness differs.</p>
      ) : null}
      {rec.summary.projectedPointsDelta !== undefined ? (
        <p className="projection-delta">Projected impact {formatBackendDelta(rec.summary.projectedPointsDelta)}</p>
      ) : null}
    </section>
  );
}

function ProjectionCard({ title, total }: { title: string; total: StartSitProjectionTotal }) {
  const points = Number.isInteger(total.points) ? String(total.points) : total.points.toFixed(1);
  return (
    <div className={total.complete ? "projection-card" : "projection-card is-incomplete"}>
      <h3>{title}</h3>
      {total.complete ? (
        <p className="projection-points">{points}</p>
      ) : (
        <>
          <p className="projection-points">
            {points} <span className="projection-known">known pts</span>
          </p>
          <p className="projection-complete">
            {total.projectedSlots} of {total.totalSlots} projected
          </p>
          <p className="incomplete-label">Incomplete projection</p>
        </>
      )}
    </div>
  );
}

function RecommendedChanges({ rec }: { rec: StartSitResult }) {
  const quiet = rec.moves.length === 0 && rec.reviewRequired.length === 0;
  return (
    <section className="panel-card" aria-labelledby="recommended-changes-heading">
      <h2 id="recommended-changes-heading">Recommended changes</h2>
      {quiet ? (
        <EmptyState message="Your current lineup already matches the recommended lineup." />
      ) : rec.moves.length === 0 ? (
        <p className="muted">No automatic lineup changes are recommended.</p>
      ) : (
        <ul className="move-list">
          {rec.moves.map((move) => (
            <li key={move.slotId}>
              <MoveCard move={move} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MoveCard({ move }: { move: StartSitMove }) {
  return (
    <article className="move-card">
      <p className="move-slot">{move.slot}</p>
      <dl className="move-grid">
        <div>
          <dt>Start</dt>
          <dd>{move.startPlayer.name}</dd>
        </div>
        <div>
          <dt>Sit</dt>
          <dd>{move.sitPlayer?.name ?? "Empty slot"}</dd>
        </div>
      </dl>
      <h3 className="move-subhead">Why</h3>
      <ul className="need-notes">
        {move.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {move.warnings.length > 0 ? (
        <>
          <h3 className="move-subhead">Warnings</h3>
          <ul className="need-notes">
            {move.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
      {move.projectedPointsDelta !== undefined ? (
        <p className="move-delta">Projected impact {formatBackendDelta(move.projectedPointsDelta)}</p>
      ) : null}
    </article>
  );
}

function LineupComparison({
  rec,
  selectedKey,
  onSelect,
}: {
  rec: StartSitResult;
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="panel-card" aria-labelledby="lineup-compare-heading">
      <h2 id="lineup-compare-heading">Current vs recommended lineup</h2>
      <div className="lineup-compare">
        <LineupColumn
          title="Current lineup"
          headingId="current-lineup-heading"
          assignments={rec.currentLineup}
          counterpart={rec.recommendedLineup}
          side="current"
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
        <LineupColumn
          title="Recommended lineup"
          headingId="recommended-lineup-heading"
          assignments={rec.recommendedLineup}
          counterpart={rec.currentLineup}
          side="recommended"
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}

function LineupColumn({
  title,
  headingId,
  assignments,
  counterpart,
  side,
  selectedKey,
  onSelect,
}: {
  title: string;
  headingId: string;
  assignments: StartSitAssignment[];
  counterpart: StartSitAssignment[];
  side: "current" | "recommended";
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="lineup-column" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      <ol className="lineup-list">
        {assignments.map((row, index) => {
          const changed = slotChanged(row, counterpart[index]);
          const selected = row.player?.yahooPlayerKey === selectedKey;
          return (
            <li
              key={row.slot.id}
              className={["lineup-row", changed ? "is-changed" : "", selected ? "is-selected" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <LineupPlayerRow assignment={row} changed={changed} side={side} onSelect={onSelect} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LineupPlayerRow({
  assignment,
  changed,
  side,
  onSelect,
}: {
  assignment: StartSitAssignment;
  changed: boolean;
  side: "current" | "recommended";
  onSelect: (key: string) => void;
}) {
  const player = assignment.player;
  const proj = formatTableNumber(player?.weeklyProjectedPoints);
  const ecr = formatTableNumber(player?.weeklyEcr);
  const identity = identityLabel(player?.identityStatus);
  return (
    <div>
      <div className="lineup-row-top">
        <span className="need-pos">{assignment.slot.position}</span>
        {player ? (
          <button type="button" className="text-btn player-name" onClick={() => onSelect(player.yahooPlayerKey)}>
            {player.name}
          </button>
        ) : (
          <span className="player-name">Empty slot</span>
        )}
        {changed ? <span className="change-tag">{side === "recommended" ? "Recommended" : "Change"}</span> : null}
      </div>
      <p className="cell-sub">
        {player?.position ?? "—"} · {player?.team ?? "—"} · Wk {proj.text} · ECR {ecr.text} · {playerStatus(player)} ·{" "}
        {player ? weeklySupportLabel(player.dataQuality) : "—"}
        {identity ? ` · ${identity}` : ""}
      </p>
    </div>
  );
}

function BenchSection({
  players,
  selectedKey,
  onSelect,
}: {
  players: StartSitLineupPlayer[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="panel-card" aria-labelledby="bench-heading">
      <h2 id="bench-heading">Bench</h2>
      {players.length === 0 ? (
        <p className="muted">No bench players.</p>
      ) : (
        <PlayerMiniTable players={players} selectedKey={selectedKey} onSelect={onSelect} />
      )}
    </section>
  );
}

function IrSection({
  players,
  selectedKey,
  onSelect,
}: {
  players: StartSitLineupPlayer[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  if (players.length === 0) {
    return null;
  }
  return (
    <section className="panel-card" aria-labelledby="ir-heading">
      <h2 id="ir-heading">IR / Inactive</h2>
      <PlayerMiniTable players={players} selectedKey={selectedKey} onSelect={onSelect} />
    </section>
  );
}

function PlayerMiniTable({
  players,
  selectedKey,
  onSelect,
}: {
  players: StartSitLineupPlayer[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table start-sit-mini">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Week Proj</th>
            <th>Wk ECR</th>
            <th>Status</th>
            <th>Weekly data</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const proj = formatTableNumber(player.weeklyProjectedPoints);
            const ecr = formatTableNumber(player.weeklyEcr);
            const identity = identityLabel(player.identityStatus);
            return (
              <tr key={player.yahooPlayerKey} className={player.yahooPlayerKey === selectedKey ? "is-open" : undefined}>
                <td>
                  <button type="button" className="text-btn player-name" onClick={() => onSelect(player.yahooPlayerKey)}>
                    {player.name}
                  </button>
                  {identity ? <span className="cell-sub"> {identity}</span> : null}
                </td>
                <td>{player.position ?? "—"}</td>
                <td>{player.team ?? "—"}</td>
                <td className={proj.missing ? "is-missing" : undefined}>{proj.text}</td>
                <td className={ecr.missing ? "is-missing" : undefined}>{ecr.text}</td>
                <td className={player.injuryStatus ? "injury-status" : undefined}>{playerStatus(player)}</td>
                <td>{weeklySupportLabel(player.dataQuality)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReviewRequired({ rec }: { rec: StartSitResult }) {
  return (
    <section className="panel-card" aria-labelledby="review-heading">
      <h2 id="review-heading">Review required</h2>
      {rec.reviewRequired.length === 0 ? (
        <p className="muted">No lineup comparisons need review.</p>
      ) : (
        <>
          <p>
            Co-Pilot does not have enough comparable weekly information to recommend an automatic lineup change.
          </p>
          <ul className="review-list">
            {rec.reviewRequired.map((item) => (
              <li key={item.slotId}>
                <p className="need-pos">{item.slot}</p>
                <p>{item.reason}</p>
                {item.currentPlayer ? <p className="cell-sub">Current: {item.currentPlayer.name}</p> : null}
                {item.candidatePlayer ? <p className="cell-sub">Candidate: {item.candidatePlayer.name}</p> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PlayerDetails({ player }: { player: StartSitLineupPlayer }) {
  const proj = formatTableNumber(player.weeklyProjectedPoints);
  const ecr = formatTableNumber(player.weeklyEcr);
  const identity = identityLabel(player.identityStatus);
  return (
    <section className="panel-card player-detail" aria-labelledby="player-detail-heading">
      <h2 id="player-detail-heading">{player.name}</h2>
      <dl className="intel-grid">
        <div>
          <dt>Position</dt>
          <dd>{player.position ?? "—"}</dd>
        </div>
        <div>
          <dt>NFL team</dt>
          <dd>{player.team ?? "—"}</dd>
        </div>
        <div>
          <dt>Week proj</dt>
          <dd>{proj.text}</dd>
        </div>
        <div>
          <dt>Wk ECR</dt>
          <dd>{ecr.text}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{playerStatus(player)}</dd>
        </div>
        <div>
          <dt>Weekly data</dt>
          <dd>{weeklySupportLabel(player.dataQuality)}</dd>
        </div>
      </dl>
      {identity ? <p className="cell-sub">{identity}</p> : null}
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
    </section>
  );
}
