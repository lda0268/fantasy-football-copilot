import type { DraftPick } from "../types/draft";

interface DraftHistoryProps {
  picks: DraftPick[];
}

export function DraftHistory({ picks }: DraftHistoryProps) {
  const recentPicks = [...picks].reverse().slice(0, 20);

  return (
    <div className="panel column-scroll">
      <h2>Draft History</h2>
      {picks.length === 0 ? (
        <p className="meta">No picks yet.</p>
      ) : (
        <div>
          <div className="history-item history-header">
            <span>Pick</span>
            <span>Rd</span>
            <span>Slot</span>
            <span>Player</span>
            <span>Pos</span>
          </div>
          <ul className="history-list">
            {recentPicks.map((pick) => (
              <li key={`${pick.overallPick}-${pick.playerId}`} className="history-item">
                <span>{pick.overallPick}</span>
                <span>{pick.round}</span>
                <span>T{pick.teamSlot}</span>
                <span>{pick.playerName}</span>
                <span>{pick.position}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
