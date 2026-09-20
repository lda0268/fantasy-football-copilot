import { formatRecord } from "./labels";
import type { YahooMatchup, YahooMatchupTeam, YahooStanding } from "../api/types";

type MatchupCardProps = {
  matchup?: YahooMatchup;
  userTeamKey?: string;
  standings: YahooStanding[];
};

export function MatchupCard({ matchup, userTeamKey, standings }: MatchupCardProps) {
  if (!matchup) {
    return (
      <section className="panel-card" aria-labelledby="matchup-heading">
        <h2 id="matchup-heading">Matchup</h2>
        <p className="muted">Matchup data is unavailable.</p>
      </section>
    );
  }

  const user = matchup.teams.find((team) => team.teamKey === userTeamKey) ?? matchup.teams[0];
  const opponent = matchup.teams.find((team) => team.teamKey !== user?.teamKey);
  return (
    <section className="panel-card" aria-labelledby="matchup-heading">
      <h2 id="matchup-heading">Week {matchup.week} Matchup</h2>
      <div className="matchup-split">
        <MatchupSide team={user} standing={standings.find((row) => row.teamKey === user?.teamKey)} you />
        <span className="matchup-vs">vs</span>
        <MatchupSide team={opponent} standing={standings.find((row) => row.teamKey === opponent?.teamKey)} />
      </div>
    </section>
  );
}

function MatchupSide({
  team,
  standing,
  you,
}: {
  team?: YahooMatchupTeam;
  standing?: YahooStanding;
  you?: boolean;
}) {
  if (!team) {
    return <div className="matchup-side muted">Opponent unavailable</div>;
  }
  const record = formatRecord(team.wins ?? standing?.wins, team.losses ?? standing?.losses, team.ties ?? standing?.ties);
  return (
    <div className={you ? "matchup-side is-you" : "matchup-side"}>
      <p className="matchup-name">
        {team.name}
        {you ? <span className="you-tag">You</span> : null}
      </p>
      <p className="matchup-score">{team.points !== undefined ? team.points : "—"}</p>
      {team.projectedPoints !== undefined ? (
        <p className="matchup-proj muted">Projected {team.projectedPoints}</p>
      ) : null}
      {record ? <p className="muted">{record}{standing?.rank ? ` · Rank ${standing.rank}` : ""}</p> : null}
    </div>
  );
}
