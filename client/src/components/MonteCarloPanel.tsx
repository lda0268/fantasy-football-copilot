import type { MonteCarloResult } from "../engine/monteCarlo";
import type { Recommendation } from "../engine/recommendations";
import { survivalPercent } from "../engine/survivalProbability";

interface MonteCarloPanelProps {
  result: MonteCarloResult | null;
  recommendations: Recommendation[];
  recalculating: boolean;
  showDebug: boolean;
}

function mcClass(decision?: string): string {
  if (decision === "TAKE NOW") {
    return "tag take-now";
  }
  if (decision === "LEAN TAKE") {
    return "tag take-now";
  }
  if (decision === "SAFE TO WAIT") {
    return "tag strong-value";
  }
  return "tag wait-possible";
}

export function MonteCarloPanel({
  result,
  recommendations,
  recalculating,
  showDebug,
}: MonteCarloPanelProps) {
  const top = recommendations[0];
  const survival = top?.monteCarloSurvival;
  const candidate = top?.monteCarlo;

  return (
    <div className="panel column-scroll">
      <h2>Monte Carlo</h2>
      <p className="demand-line">
        {result
          ? `${result.config.simulations.toLocaleString()} simulations`
          : "Waiting for first run"}
        {recalculating ? " · recalculating…" : ""}
      </p>
      {!top ? (
        <p className="meta">No candidates yet.</p>
      ) : (
        <>
          {result?.bestSequenceLabel ? (
            <div className="wait-detail">
              Best expected sequence: {result.bestSequenceLabel}
            </div>
          ) : null}
          {result?.bestPair ? (
            <div className="wait-detail">
              Best pair: {result.bestPair.firstName} + {result.bestPair.secondName} (
              {result.bestPair.combinedVor.toFixed(1)} VOR)
            </div>
          ) : null}
          <div className="survival-item">
            <div className="top">
              <strong>{top.player.name}</strong>
              <span className={mcClass(candidate?.decision ?? top.takeVsWait.monteCarloDecision)}>
                {candidate?.decision ?? top.label}
              </span>
            </div>
            <div className="meta">
              Survives next turn:{" "}
              {survival ? `${survivalPercent(survival.probability)}%` : "—"} · Tier survives:{" "}
              {survival ? `${survivalPercent(survival.tierSurvivalProbability)}%` : "—"}
            </div>
            {candidate ? (
              <>
                <div className="wait-detail">
                  Take now: {candidate.takeNow.mean.toFixed(1)} VOR · 25–75%{" "}
                  {candidate.takeNow.p25.toFixed(0)}–{candidate.takeNow.p75.toFixed(0)}
                </div>
                <div className="wait-detail">
                  Wait: {candidate.wait.mean.toFixed(1)} VOR · {candidate.evDelta >= 0 ? "+" : ""}
                  {candidate.evDelta.toFixed(1)} EV
                </div>
                {candidate.expectedNextName ? (
                  <div className="wait-detail">
                    Expected next: {candidate.expectedNextName}
                    {candidate.expectedNextPosition
                      ? ` (${candidate.expectedNextPosition} T${candidate.expectedNextTier ?? "?"})`
                      : ""}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="meta">Deterministic score {top.score} while simulations catch up.</div>
            )}
          </div>
          {showDebug && result ? (
            <div className="mc-debug">
              <div>runtime {result.runtimeMs}ms · seed {result.config.seed}</div>
              <div>
                frequent opponent picks:{" "}
                {result.diagnostics.mostFrequentOpponentPicks
                  .slice(0, 5)
                  .map((item) => `${item.name} (${item.count})`)
                  .join(", ")}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
