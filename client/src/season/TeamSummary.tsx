import { formatRecord } from "./labels";
import type { YahooMatchup, YahooStanding, YahooTeam } from "../api/types";

type TeamSummaryProps = {
  team?: YahooTeam;
  standing?: YahooStanding;
  matchup?: YahooMatchup;
};

export function TeamSummary({ team, standing, matchup }: TeamSummaryProps) {
  const record = standing ? formatRecord(standing.wins, standing.losses, standing.ties) : undefined;
  const opponent = matchup?.teams.find((row) => row.teamKey !== team?.teamKey);
  return (
    <section className="panel-card team-summary" aria-labelledby="team-summary-heading">
      <h2 id="team-summary-heading">Team Summary</h2>
      {team ? <p className="panel-lead">{team.name}</p> : <p className="muted">Team name unavailable.</p>}
      <ul className="health-pills">
        {record ? (
          <li>
            <span className="health-value">{record}</span>
            <span className="health-label">Record</span>
          </li>
        ) : null}
        {standing?.rank !== undefined ? (
          <li>
            <span className="health-value">{standing.rank}</span>
            <span className="health-label">Rank</span>
          </li>
        ) : null}
        {standing?.pointsFor !== undefined ? (
          <li>
            <span className="health-value">{standing.pointsFor}</span>
            <span className="health-label">Points for</span>
          </li>
        ) : null}
        {standing?.pointsAgainst !== undefined ? (
          <li>
            <span className="health-value">{standing.pointsAgainst}</span>
            <span className="health-label">Points against</span>
          </li>
        ) : null}
        {matchup && opponent ? (
          <li>
            <span className="health-value">
              Week {matchup.week} vs {opponent.name}
            </span>
            <span className="health-label">Matchup</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
