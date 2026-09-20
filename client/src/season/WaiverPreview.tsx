import type { CopilotRecommendation } from "../api/types";
import { ROUTES } from "../app/routes";
import { SUPPORT_LABELS, formatScore } from "./labels";

type WaiverPreviewProps = {
  recommendations: CopilotRecommendation[];
  navigate: (to: string) => void;
};

export function WaiverPreview({ recommendations, navigate }: WaiverPreviewProps) {
  const preview = recommendations.slice(0, 4);
  return (
    <section className="panel-card" aria-labelledby="waiver-heading">
      <div className="panel-heading-row">
        <h2 id="waiver-heading">Waiver Wire</h2>
        <a
          href={ROUTES.waivers}
          className="text-link"
          onClick={(event) => {
            event.preventDefault();
            navigate(ROUTES.waivers);
          }}
        >
          View all
        </a>
      </div>
      {preview.length === 0 ? (
        <p className="muted">No available-player recommendations.</p>
      ) : (
        <ol className="waiver-list">
          {preview.map((recommendation) => (
            <li key={recommendation.player.identity.yahooPlayerKey}>
              <span title={recommendation.player.player.name}>
                {recommendation.player.player.name}
                <span className="cell-sub">
                  {recommendation.player.player.position ?? ""}
                  {recommendation.player.player.team ? ` · ${recommendation.player.player.team}` : ""}
                </span>
              </span>
              <span>
                {formatScore(recommendation.score)}
                <span className="cell-sub">{SUPPORT_LABELS[recommendation.dataQuality]}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
