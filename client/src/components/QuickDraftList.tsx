import type { Player } from "../types/draft";
import { formatMarketAdp } from "../engine/data/sourceFields";

interface QuickDraftListProps {
  players: Player[];
  onDraftPlayer: (player: Player) => void;
}

export function QuickDraftList({ players, onDraftPlayer }: QuickDraftListProps) {
  return (
    <div className="panel quick-draft">
      <h2>Quick Draft</h2>
      <div className="quick-draft-list">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            className="quick-draft-item"
            onClick={() => onDraftPlayer(player)}
          >
            <span className="qd-adp">{formatMarketAdp(player)}</span>
            <span className="qd-name">{player.name}</span>
            <span className="qd-pos">{player.position}</span>
            <span className="qd-team">{player.team}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
