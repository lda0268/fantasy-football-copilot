import { useState } from "react";
import type { CopilotRecommendation, PlayerIntelligence } from "../api/types";
import { RecommendationBreakdown } from "./RecommendationCard";
import { AVAILABILITY_LABELS, SUPPORT_LABELS, formatScore, formatTableNumber } from "./labels";

type WaiverRecommendationTableProps = {
  recommendations: CopilotRecommendation[];
  week?: number | null;
};

export function WaiverRecommendationTable({ recommendations, week }: WaiverRecommendationTableProps) {
  const [openRank, setOpenRank] = useState<number | undefined>();
  const open = recommendations.find((recommendation) => recommendation.rank === openRank);
  return (
    <>
    <div className="table-wrap">
      <table className="data-table waiver-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Availability</th>
            <th>Score</th>
            <th>Support</th>
            <th>Wk Proj</th>
            <th>Wk ECR</th>
            <th>ROS Proj</th>
            <th>ROS ECR</th>
            <th>Injury</th>
            <th>Why</th>
            <th>Potential Drop</th>
            <th>
              <span className="visually-hidden">Analysis</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((recommendation) => (
            <WaiverRow
              key={recommendation.player.identity.yahooPlayerKey}
              recommendation={recommendation}
              open={openRank === recommendation.rank}
              onToggle={() => setOpenRank(openRank === recommendation.rank ? undefined : recommendation.rank)}
            />
          ))}
        </tbody>
      </table>
    </div>
      {open ? (
        <div className="waiver-analysis-panel">
          <h3>{open.player.player.name}</h3>
          <WaiverAnalysis recommendation={open} week={week} />
        </div>
      ) : null}
    </>
  );
}

function WaiverRow({
  recommendation,
  open,
  onToggle,
}: {
  recommendation: CopilotRecommendation;
  open: boolean;
  onToggle: () => void;
}) {
  const player = recommendation.player;
  const weeklyProj = formatTableNumber(player.weekly?.projectedPoints);
  const weeklyEcr = formatTableNumber(player.weekly?.ecr);
  const rosProj = formatTableNumber(player.restOfSeason?.projectedPoints);
  const rosEcr = formatTableNumber(player.restOfSeason?.ecr);
  const injury = player.injury?.status;
  const reason = recommendation.reasons[0];
  const drop = recommendation.dropPlayer;
  return (
      <tr data-support={recommendation.dataQuality} className={open ? "is-open" : undefined}>
        <td className="waiver-rank">#{recommendation.rank}</td>
        <td className="roster-player">
          <span className="player-name" title={player.player.name}>
            {player.player.name}
          </span>
        </td>
        <td>{player.player.position ?? "—"}</td>
        <td>{player.player.team ?? "—"}</td>
        <td>{AVAILABILITY_LABELS[player.leagueState.availability]}</td>
        <td>
          <span className="waiver-score" aria-label={`Co-Pilot Score ${formatScore(recommendation.score)}`}>
            {formatScore(recommendation.score)}
          </span>
          <span className="cell-sub">{recommendation.availableMax} available points</span>
        </td>
        <td>{SUPPORT_LABELS[recommendation.dataQuality]}</td>
        <td className={weeklyProj.missing ? "is-missing" : undefined} title={weeklyProj.missing ? "Unavailable" : undefined}>
          {weeklyProj.text}
        </td>
        <td className={weeklyEcr.missing ? "is-missing" : undefined} title={weeklyEcr.missing ? "Unavailable" : undefined}>
          {weeklyEcr.text}
        </td>
        <td className={rosProj.missing ? "is-missing" : undefined} title={rosProj.missing ? "Unavailable" : undefined}>
          {rosProj.text}
        </td>
        <td className={rosEcr.missing ? "is-missing" : undefined} title={rosEcr.missing ? "Unavailable" : undefined}>
          {rosEcr.text}
        </td>
        <td>{injury ?? "—"}</td>
        <td className="waiver-reason" title={reason}>
          {reason ?? "—"}
        </td>
        <td>
          {drop ? (
            <span title={[drop.name, drop.displayPosition, drop.selectedPosition].filter(Boolean).join(" · ")}>
              {drop.name}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td>
          <button type="button" className="text-btn" aria-expanded={open} onClick={onToggle}>
            {open ? "Hide analysis" : "View analysis"}
          </button>
        </td>
      </tr>
  );
}

function WaiverAnalysis({ recommendation, week }: { recommendation: CopilotRecommendation; week?: number | null }) {
  const drop = recommendation.dropPlayer;
  return (
    <div className="waiver-analysis">
      <RecommendationBreakdown recommendation={recommendation} showAllReasons />
      <ComposedIntelligence player={recommendation.player} week={week} />
      {recommendation.warnings.length > 0 ? (
        <section>
          <h3>Warnings</h3>
          <ul>
            {recommendation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {drop ? (
        <section className="potential-drop">
          <h3>Potential Drop</h3>
          <p>
            {[drop.name, drop.displayPosition, drop.selectedPosition].filter(Boolean).join(" · ")}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ComposedIntelligence({ player, week }: { player: PlayerIntelligence; week?: number | null }) {
  if (player.identity.status !== "matched") {
    return null;
  }
  const weekLabel = player.weekly?.week ?? week;
  const weeklyProj = formatTableNumber(player.weekly?.projectedPoints);
  const weeklyEcr = formatTableNumber(player.weekly?.ecr);
  const rosProj = formatTableNumber(player.restOfSeason?.projectedPoints);
  const rosEcr = formatTableNumber(player.restOfSeason?.ecr);
  return (
    <section className="intel-grid-wrap">
      <h3>FantasyPros intelligence</h3>
      <dl className="intel-grid">
        <div>
          <dt>{weekLabel != null ? `Week ${weekLabel} Projection` : "Weekly Projection"}</dt>
          <dd className={weeklyProj.missing ? "is-missing" : undefined}>{weeklyProj.text}</dd>
        </div>
        <div>
          <dt>Weekly ECR</dt>
          <dd className={weeklyEcr.missing ? "is-missing" : undefined}>{weeklyEcr.text}</dd>
        </div>
        <div>
          <dt>ROS Projection</dt>
          <dd className={rosProj.missing ? "is-missing" : undefined}>{rosProj.text}</dd>
        </div>
        <div>
          <dt>ROS ECR</dt>
          <dd className={rosEcr.missing ? "is-missing" : undefined}>{rosEcr.text}</dd>
        </div>
        <div>
          <dt>Injury Status</dt>
          <dd>{player.injury?.status ?? "No injury data"}</dd>
        </div>
        <div>
          <dt>Practice Status</dt>
          <dd>{player.injury?.practiceStatus ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
