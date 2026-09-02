import type { Recommendation } from "../engine/recommendations";
import { formatMarketAdp } from "../engine/data/sourceFields";
import { survivalPercent } from "../engine/survivalProbability";

interface RecommendationsProps {
  recommendations: Recommendation[];
}

function takeWaitClass(label: Recommendation["label"]): string {
  switch (label) {
    case "TAKE NOW":
      return "tag take-now";
    case "HIGH RISK TO WAIT":
      return "tag high-risk";
    case "STRONG VALUE":
      return "tag strong-value";
    default:
      return "tag wait-possible";
  }
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <div className="panel column-scroll">
      <h2>Recommendations</h2>
      {recommendations.length === 0 ? (
        <p className="meta">No available players.</p>
      ) : (
        recommendations.map((rec) => (
          <div key={rec.player.id} className="recommendation-item">
            <div className="top">
              <strong>
                #{rec.rank} {rec.player.name}
              </strong>
              <span className={takeWaitClass(rec.label)}>{rec.label}</span>
            </div>
            <div className="meta">
              {rec.player.position} · Score {rec.score} · Lg #{rec.leagueAdjustedRank} · ADP{" "}
              {formatMarketAdp(rec.player)} · Survival {survivalPercent(rec.survivalProbability)}%
              {typeof rec.leagueAdjustedProjectedPoints === "number"
                ? ` · ${rec.leagueAdjustedProjectedPoints.toFixed(1)} pts`
                : ""}
              {rec.monteCarlo
                ? ` · 2-pick EV ${rec.monteCarlo.takeNow.mean.toFixed(0)}`
                : ""}
            </div>
            <ul className="reason-list">
              {rec.reasons.slice(0, 5).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
