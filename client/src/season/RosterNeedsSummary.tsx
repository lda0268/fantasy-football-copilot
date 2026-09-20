import type { RosterNeed, RosterVulnerability } from "../api/types";
import { NEED_SEVERITY_LABELS } from "./labels";

type RosterNeedsSummaryProps = {
  needs: RosterNeed[];
  vulnerabilities: RosterVulnerability[];
  onExploreWaivers?: () => void;
};

export function RosterNeedsSummary({ needs, vulnerabilities, onExploreWaivers }: RosterNeedsSummaryProps) {
  return (
    <section className="panel-card" aria-labelledby="needs-heading">
      <h2 id="needs-heading">Roster Needs</h2>
      {needs.length === 0 ? (
        <p className="muted">No documented roster needs in the current Co-Pilot analysis.</p>
      ) : (
        <ul className="need-pills">
          {needs.map((need) => (
            <li key={`${need.position}-${need.severity}`} data-severity={need.severity}>
              <span className="need-pos">{need.position}</span>
              <span className="need-label">{NEED_SEVERITY_LABELS[need.severity]}</span>
            </li>
          ))}
        </ul>
      )}
      {vulnerabilities.length > 0 ? (
        <ul className="need-notes">
          {vulnerabilities.map((item, index) => (
            <li key={`${item.type}-${item.playerKey ?? index}`}>{item.reason}</li>
          ))}
        </ul>
      ) : null}
      {onExploreWaivers && (needs.length > 0 || vulnerabilities.length > 0) ? (
        <p className="need-explore">
          <a
            href="/waivers"
            className="text-link"
            onClick={(event) => {
              event.preventDefault();
              onExploreWaivers();
            }}
          >
            Explore Waiver Wire
          </a>
        </p>
      ) : null}
    </section>
  );
}
