import type { PlayerIntelligence } from "../api/types";

type InjuryWatchProps = {
  players: PlayerIntelligence[];
};

export function InjuryWatch({ players }: InjuryWatchProps) {
  const injured = players.filter(
    (player) =>
      player.leagueState.availability === "rostered_by_user" &&
      Boolean(player.injury?.status),
  );
  return (
    <section className="panel-card" aria-labelledby="injury-heading">
      <h2 id="injury-heading">Injury Watch</h2>
      {injured.length === 0 ? (
        <p className="muted">No FantasyPros injury records on the current roster.</p>
      ) : (
        <ul className="injury-list">
          {injured.map((player) => (
            <li key={player.identity.yahooPlayerKey}>
              <span className="injury-main">
                <span className="injury-name" title={player.player.name}>
                  {player.player.name}
                </span>
                <span className="injury-status">{player.injury?.status}</span>
              </span>
              {player.injury?.description ? (
                <span className="injury-note muted">{player.injury.description}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
