import type { FantasyProsStatus, YahooLeague, YahooStatus } from "../api/types";

type DashboardHeaderProps = {
  title?: string;
  description?: string;
  leagueName?: string;
  week?: number | null;
  yahooStatus?: YahooStatus;
  fantasyProsStatus?: FantasyProsStatus;
  leagues?: YahooLeague[];
};

export function DashboardHeader({
  title = "Dashboard",
  description,
  leagueName,
  week,
  yahooStatus,
  fantasyProsStatus,
  leagues,
}: DashboardHeaderProps) {
  const leagueLabel = leagueName ?? leagues?.[0]?.name ?? "Unavailable";
  return (
    <header className="dash-header">
      <div>
        <p className="dash-kicker">Regular season</p>
        <h1>{title}</h1>
        {description ? <p className="dash-lede">{description}</p> : null}
      </div>
      <div className="dash-header-meta">
        <div className="dash-meta-block dash-league">
          <span className="dash-meta-label">Current league</span>
          <span className="dash-league-name" title={leagueLabel}>
            {leagueLabel}
          </span>
        </div>
        <div className="dash-meta-block">
          <span className="dash-meta-label">Week</span>
          <span className="dash-meta-value">{week != null ? `Week ${week}` : "Unavailable"}</span>
        </div>
        <ProviderChip
          name="Yahoo Fantasy"
          mode={yahooStatus?.mode}
          connected={yahooStatus?.connected}
          authorized={yahooStatus?.fantasyAuthorized}
        />
        <ProviderChip
          name="FantasyPros"
          mode={fantasyProsStatus?.mode}
          connected={fantasyProsStatus?.configured}
        />
      </div>
    </header>
  );
}

function ProviderChip({
  name,
  mode,
  connected,
  authorized,
}: {
  name: string;
  mode?: "live" | "fixture";
  connected?: boolean;
  authorized?: boolean;
}) {
  const fixture = mode === "fixture";
  const liveOk = mode === "live" && connected !== false && authorized !== false;
  const stateLabel = fixture ? "Fixture data" : liveOk ? "Connected" : connected === false ? "Not connected" : "Unavailable";
  return (
    <div className="provider-chip" data-mode={mode ?? "unknown"}>
      <span className="provider-chip-name">{name}</span>
      <span className={fixture ? "provider-chip-state is-dev" : "provider-chip-state"}>
        {stateLabel}
      </span>
    </div>
  );
}
