import { formatSurvivalProbability } from "../engine/survivalProbability";
import type { Recommendation } from "../engine/recommendations";
import { formatMarketAdp } from "../engine/data/sourceFields";

interface TakeVsWaitProps {
  items: Recommendation[];
}

export function TakeVsWait({ items }: TakeVsWaitProps) {
  const demand = items[0]?.takeVsWait.leagueNeedSummary;

  return (
    <div className="panel column-scroll">
      <h2>Take vs Wait</h2>
      {demand ? <p className="demand-line">League need: {demand}</p> : null}
      {items.length === 0 ? (
        <p className="meta">No recommendations yet.</p>
      ) : (
        items.map((item) => (
          <div key={item.player.id} className="survival-item">
            <div className="top">
              <strong>{item.player.name}</strong>
              <span className="tag">{item.label}</span>
            </div>
            <div className="meta">
              {item.player.position} · ADP {formatMarketAdp(item.player)} ·{" "}
              {formatSurvivalProbability(item.takeVsWait.survivalProbability)} survive · wait drop{" "}
              {Math.round(item.takeVsWait.replacementQualityIfWait)} VOR · tier{" "}
              {item.takeVsWait.tierDropBeforeNextPick.toFixed(0)} pts
            </div>
            {item.takeVsWait.predictedTaken && item.takeVsWait.predictedByTeamSlot ? (
              <div className="wait-detail">
                Predicted gone: team {item.takeVsWait.predictedByTeamSlot} in this window
              </div>
            ) : null}
            {item.takeVsWait.nextBestIfWait ? (
              <div className="wait-detail">
                If you wait: {item.takeVsWait.nextBestIfWait}
                {typeof item.takeVsWait.nextBestIfWaitVorDrop === "number"
                  ? ` (${item.takeVsWait.nextBestIfWaitVorDrop >= 0 ? "-" : "+"}${Math.abs(item.takeVsWait.nextBestIfWaitVorDrop)} VOR)`
                  : ""}
              </div>
            ) : null}
            {item.takeVsWait.runWarning ? (
              <div className="wait-detail">{item.takeVsWait.runWarning}</div>
            ) : null}
            {typeof item.takeVsWait.monteCarloSurvivalProbability === "number" ? (
              <div className="wait-detail">
                MC survive {Math.round(item.takeVsWait.monteCarloSurvivalProbability * 100)}%
                {typeof item.takeVsWait.monteCarloTierSurvival === "number"
                  ? ` · tier ${Math.round(item.takeVsWait.monteCarloTierSurvival * 100)}%`
                  : ""}
                {typeof item.takeVsWait.analyticalSurvivalProbability === "number"
                  ? ` · ADP model ${Math.round(item.takeVsWait.analyticalSurvivalProbability * 100)}%`
                  : ""}
              </div>
            ) : null}
            {typeof item.takeVsWait.monteCarloTakeEv === "number" ? (
              <div className="wait-detail">
                Take EV {item.takeVsWait.monteCarloTakeEv.toFixed(1)} · Wait EV{" "}
                {item.takeVsWait.monteCarloWaitEv?.toFixed(1)} ·{" "}
                {item.takeVsWait.monteCarloDecision ?? item.label}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
