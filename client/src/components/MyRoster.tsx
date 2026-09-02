import type { RosterSlot } from "../types/draft";

interface MyRosterProps {
  roster: RosterSlot[];
}

export function MyRoster({ roster }: MyRosterProps) {
  return (
    <div className="panel">
      <h2>My Roster</h2>
      <div className="roster-grid">
        {roster
          .filter((slot) => slot.slotType !== "IR")
          .map((slot) => (
          <div key={slot.id} className="roster-slot">
            <span className="slot-label">{slot.label}</span>
            <span>{slot.player ? slot.player.name : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
