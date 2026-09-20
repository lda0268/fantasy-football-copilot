import type { PlayerIntelligence } from "../api/types";
import {
  AVAILABILITY_LABELS,
  IDENTITY_LABELS,
  IDENTITY_METHOD_LABELS,
  formatTableNumber,
} from "./labels";
import { intelligenceCoverage, matchedIntelligence } from "./rosterView";

type MyTeamRosterTableProps = {
  players: PlayerIntelligence[];
  selectedKey?: string;
  onSelect: (player: PlayerIntelligence) => void;
};

export function MyTeamRosterTable({ players, selectedKey, onSelect }: MyTeamRosterTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table my-team-table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Week Proj</th>
            <th>Wk ECR</th>
            <th>ROS Proj</th>
            <th>ROS ECR</th>
            <th>Injury</th>
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
            const open = selectedKey === player.identity.yahooPlayerKey;
            return (
              <tr
                key={player.identity.yahooPlayerKey}
                className={open ? "is-open" : undefined}
                aria-selected={open}
              >
                <td className="roster-slot">{player.leagueState.rosterSlot ?? "—"}</td>
                <td className="roster-player">
                  <span className="player-name" title={player.player.name}>
                    {player.player.name}
                  </span>
                  <span className="cell-sub">{IDENTITY_LABELS[player.identity.status] ?? player.identity.status}</span>
                </td>
                <td>{player.player.position ?? "—"}</td>
                <td>{player.player.team ?? "—"}</td>
                <td className={weeklyProj.missing ? "is-missing" : undefined} title={weeklyProj.missing ? "Unavailable" : undefined}>
                  {weeklyProj.text}
                </td>
                <td className={weeklyEcr.missing ? "is-missing" : undefined} title={weeklyEcr.missing ? "Unavailable" : undefined}>
                  {weeklyEcr.text}
                </td>
                <td className={rosProj.missing ? "is-missing" : undefined} title={rosProj.missing ? "Unavailable" : undefined}>
                  {rosProj.text}
                </td>
                <td className={rosEcr.missing ? "is-missing" : undefined} title={rosEcr.missing ? "Unavailable" : undefined}>
                  {rosEcr.text}
                </td>
                <td className={intel.injury?.status ? "injury-status" : undefined}>{intel.injury?.status ?? "—"}</td>
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

export function PlayerDetailPanel({ player }: { player: PlayerIntelligence }) {
  const intel = matchedIntelligence(player);
  const weeklyProj = formatTableNumber(intel.weekly?.projectedPoints);
  const weeklyEcr = formatTableNumber(intel.weekly?.ecr);
  const rosProj = formatTableNumber(intel.restOfSeason?.projectedPoints);
  const rosEcr = formatTableNumber(intel.restOfSeason?.ecr);
  const weekLabel = intel.weekly?.week;
  return (
    <section className="player-detail" aria-labelledby="player-detail-heading">
      <h3 id="player-detail-heading">{player.player.name}</h3>
      <dl className="intel-grid">
        <div>
          <dt>Roster slot</dt>
          <dd>{player.leagueState.rosterSlot ?? "—"}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{player.player.position ?? "—"}</dd>
        </div>
        <div>
          <dt>NFL team</dt>
          <dd>{player.player.team ?? "—"}</dd>
        </div>
        <div>
          <dt>Bye week</dt>
          <dd>{player.leagueState.byeWeek ?? "—"}</dd>
        </div>
        <div>
          <dt>Roster state</dt>
          <dd>{AVAILABILITY_LABELS[player.leagueState.availability] ?? player.leagueState.availability}</dd>
        </div>
        <div>
          <dt>Identity</dt>
          <dd>{IDENTITY_LABELS[player.identity.status] ?? player.identity.status}</dd>
        </div>
      </dl>
      <h4>Weekly outlook</h4>
      <dl className="intel-grid">
        <div>
          <dt>{weekLabel != null ? `Week ${weekLabel} projection` : "Projection"}</dt>
          <dd className={weeklyProj.missing ? "is-missing" : undefined}>{weeklyProj.text}</dd>
        </div>
        <div>
          <dt>Weekly ECR</dt>
          <dd className={weeklyEcr.missing ? "is-missing" : undefined}>{weeklyEcr.text}</dd>
        </div>
      </dl>
      <h4>Rest of season</h4>
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
      <h4>Health</h4>
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
      <h4>Identity / data</h4>
      <dl className="intel-grid">
        <div>
          <dt>Match method</dt>
          <dd>
            {player.identity.method
              ? (IDENTITY_METHOD_LABELS[player.identity.method] ?? player.identity.method)
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Intelligence</dt>
          <dd>{intelligenceCoverage(player)}</dd>
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
