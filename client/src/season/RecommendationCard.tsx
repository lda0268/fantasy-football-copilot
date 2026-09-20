import { useState } from "react";
import type { CopilotRecommendation } from "../api/types";
import { AVAILABILITY_LABELS, SUPPORT_LABELS, formatScore } from "./labels";

const COMPONENT_LABELS = {
  rosterNeed: "Roster Need",
  restOfSeason: "Rest of Season",
  weeklyValue: "Weekly Value",
  healthRisk: "Health",
  rosterFit: "Roster Fit",
} as const;

type RecommendationCardProps = {
  recommendation: CopilotRecommendation;
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [open, setOpen] = useState(false);
  const player = recommendation.player;
  const support = SUPPORT_LABELS[recommendation.dataQuality];
  const availability = AVAILABILITY_LABELS[player.leagueState.availability];
  const primaryReasons = recommendation.reasons.slice(0, 2);
  const scoreText = formatScore(recommendation.score);
  return (
    <article className="rec-card" data-support={recommendation.dataQuality}>
      <div className="rec-card-top">
        <div className="rec-identity">
          <h3>{player.player.name}</h3>
          <p className="rec-meta">
            <span>{player.player.position ?? "Pos n/a"}</span>
            {player.player.team ? <span>{player.player.team}</span> : null}
            <span>{availability}</span>
            <span>{support}</span>
          </p>
        </div>
        <div className="rec-score" aria-label={`Co-Pilot Score ${scoreText}`}>
          <span className="rec-score-value">{scoreText}</span>
          <span className="rec-score-label">Co-Pilot Score</span>
          <span className="rec-score-max">{recommendation.availableMax} available points</span>
        </div>
      </div>
      <ul className="rec-reasons">
        {primaryReasons.map((reason) => (
          <li key={reason} title={reason}>
            {reason}
          </li>
        ))}
      </ul>
      <button type="button" className="text-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide details" : "Why?"}
      </button>
      {open ? <RecommendationBreakdown recommendation={recommendation} /> : null}
    </article>
  );
}

type RecommendationBreakdownProps = RecommendationCardProps & {
  showAllReasons?: boolean;
};

export function RecommendationBreakdown({ recommendation, showAllReasons }: RecommendationBreakdownProps) {
  return (
    <dl className="rec-breakdown">
      {(Object.keys(COMPONENT_LABELS) as Array<keyof typeof COMPONENT_LABELS>).map((key) => {
        const component = recommendation.components[key];
        const reasons = showAllReasons ? component.reasons : component.reasons.slice(0, 1);
        return (
          <div key={key} className="rec-breakdown-row">
            <dt>{COMPONENT_LABELS[key]}</dt>
            <dd>
              {component.available
                ? `${formatScore(component.score)} / ${component.max}`
                : "Unavailable"}
              {reasons.map((reason) => (
                <span key={reason} className="breakdown-reason">
                  {reason}
                </span>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
