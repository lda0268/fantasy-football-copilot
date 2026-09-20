import { formatRecord } from "./labels";
import type { YahooStanding, YahooTeam } from "../api/types";

type TeamOverviewCardProps = {
  team?: YahooTeam;
  standing?: YahooStanding;
};

export function TeamOverviewCard({ team, standing }: TeamOverviewCardProps) {
  const record = standing ? formatRecord(standing.wins, standing.losses, standing.ties) : undefined;
  return (
    <section className="panel-card" aria-labelledby="team-glance-heading">
      <h2 id="team-glance-heading">My Team at a Glance</h2>
      {team ? <p className="panel-lead">{team.name}</p> : <p className="muted">Team name unavailable.</p>}
      <dl className="stat-grid">
        {record ? (
          <>
            <dt>Record</dt>
            <dd>{record}</dd>
          </>
        ) : null}
        {standing?.rank !== undefined ? (
          <>
            <dt>Rank</dt>
            <dd>{standing.rank}</dd>
          </>
        ) : null}
        {standing?.pointsFor !== undefined ? (
          <>
            <dt>Points for</dt>
            <dd>{standing.pointsFor}</dd>
          </>
        ) : null}
        {standing?.pointsAgainst !== undefined ? (
          <>
            <dt>Points against</dt>
            <dd>{standing.pointsAgainst}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
