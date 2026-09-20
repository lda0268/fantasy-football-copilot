import type { CopilotRecommendationsResponse } from "../api/types";
import { RecommendationCard } from "./RecommendationCard";
import { EmptyState } from "./StatusBlocks";

type RecommendationsPanelProps = {
  payload?: CopilotRecommendationsResponse;
  errorMessage?: string;
};

export function RecommendationsPanel({ payload, errorMessage }: RecommendationsPanelProps) {
  const recommendations = payload?.recommendations.slice(0, 3) ?? [];
  return (
    <section className="panel-card rec-panel" aria-labelledby="rec-heading">
      <h2 id="rec-heading">Co-Pilot Recommendations</h2>
      {errorMessage ? <p className="muted">{errorMessage}</p> : null}
      {!errorMessage && recommendations.length === 0 ? (
        <EmptyState message="No waiver or free-agent recommendations are available." />
      ) : (
        <div className="rec-list">
          {recommendations.map((recommendation) => (
            <RecommendationCard key={recommendation.player.identity.yahooPlayerKey} recommendation={recommendation} />
          ))}
        </div>
      )}
    </section>
  );
}
