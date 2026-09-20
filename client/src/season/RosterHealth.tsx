import type { PlayerIntelligence } from "../api/types";
import { positionDepth, rosterHealth } from "./rosterView";

type RosterHealthProps = {
  players: PlayerIntelligence[];
};

export function RosterHealth({ players }: RosterHealthProps) {
  const health = rosterHealth(players);
  const depth = positionDepth(players);
  return (
    <section className="panel-card" aria-labelledby="health-heading">
      <h2 id="health-heading">Roster Health</h2>
      <ul className="health-pills">
        <li>
          <span className="health-value">{health.players}</span>
          <span className="health-label">Players</span>
        </li>
        <li>
          <span className="health-value">{health.injuryFlags}</span>
          <span className="health-label">Injury flags</span>
        </li>
        <li>
          <span className="health-value">{health.enriched}</span>
          <span className="health-label">Enriched</span>
        </li>
        <li>
          <span className="health-value">{health.unresolved}</span>
          <span className="health-label">Unresolved</span>
        </li>
        <li>
          <span className="health-value">{health.ambiguous}</span>
          <span className="health-label">Needs review</span>
        </li>
      </ul>
      <h3 className="depth-heading">Position depth</h3>
      <ul className="depth-grid">
        {depth.map((row) => (
          <li key={row.position}>
            <span className="need-pos">{row.position}</span>
            <span className="depth-total">{row.total}</span>
            <span className="cell-sub">
              {row.starters === 1 ? "1 starter" : `${row.starters} starters`} · {row.bench} bench
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
