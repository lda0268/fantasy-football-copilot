interface DraftStatusProps {
  currentPick: number;
  currentRound: number;
  teamCount: number;
  userSlot: number;
  picksUntilUser: number;
  currentTeamSlot: number;
  onClock: boolean;
  onUserSlotChange: (slot: number) => void;
}

export function DraftStatus({
  currentPick,
  currentRound,
  teamCount,
  userSlot,
  picksUntilUser,
  currentTeamSlot,
  onClock,
  onUserSlotChange,
}: DraftStatusProps) {
  return (
    <div className="panel">
      <h2>Draft Status</h2>
      {onClock && <div className="on-clock">YOU&apos;RE ON THE CLOCK</div>}
      <div className="status-grid">
        <div className="status-item">
          <div className="label">Overall Pick</div>
          <div className="value">{currentPick}</div>
        </div>
        <div className="status-item">
          <div className="label">Round</div>
          <div className="value">{currentRound}</div>
        </div>
        <div className="status-item">
          <div className="label">Teams</div>
          <div className="value">{teamCount}</div>
        </div>
        <div className="status-item">
          <div className="label">Your Slot</div>
          <div className="value">
            <select
              className="slot-select"
              value={userSlot}
              onChange={(e) => onUserSlotChange(Number(e.target.value))}
            >
              {Array.from({ length: teamCount }, (_, i) => i + 1).map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="status-item">
          <div className="label">Picks Until You</div>
          <div className="value">{picksUntilUser}</div>
        </div>
        <div className="status-item">
          <div className="label">On Clock</div>
          <div className="value">Team {currentTeamSlot}</div>
        </div>
      </div>
    </div>
  );
}
