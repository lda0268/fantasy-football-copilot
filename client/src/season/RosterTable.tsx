import type { PlayerIntelligence } from "../api/types";
import { formatOptionalNumber } from "./labels";

type RosterTableProps = {
  players: PlayerIntelligence[];
};

export function RosterTable({ players }: RosterTableProps) {
  const roster = players.filter((player) => player.leagueState.availability === "rostered_by_user");
  return (
    <section className="panel-card" aria-labelledby="roster-heading">
      <h2 id="roster-heading">My Roster</h2>
      {roster.length === 0 ? (
        <p className="muted">Roster data is unavailable.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Player</th>
                <th>Team</th>
                <th>Projected</th>
                <th>ECR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((player) => {
                const projected = formatOptionalNumber(player.weekly?.projectedPoints);
                const ecr = formatOptionalNumber(player.weekly?.ecr);
                const injury = player.injury?.status;
                return (
                  <tr key={player.identity.yahooPlayerKey}>
                    <td className="roster-slot">{player.leagueState.rosterSlot ?? "—"}</td>
                    <td className="roster-player">
                      <span className="player-name" title={player.player.name}>
                        {player.player.name}
                      </span>
                      {player.player.position ? <span className="cell-sub">{player.player.position}</span> : null}
                    </td>
                    <td>{player.player.team ?? "—"}</td>
                    <td className={projected.missing ? "is-missing" : undefined}>{projected.text}</td>
                    <td className={ecr.missing ? "is-missing" : undefined}>{ecr.text}</td>
                    <td>{injury ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
