import { useEffect, useMemo, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import { ROUTES } from "../app/routes";
import { DashboardHeader } from "./DashboardHeader";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";
import { MyTeamFilters } from "./MyTeamFilters";
import { MyTeamRosterTable, PlayerDetailPanel } from "./MyTeamRosterTable";
import { RosterHealth } from "./RosterHealth";
import { RosterNeedsSummary } from "./RosterNeedsSummary";
import { TeamSummary } from "./TeamSummary";
import { loadMyTeam, type MyTeamData } from "./loadMyTeam";
import { filterRoster, orderRoster, userRoster, type RosterFilters } from "./rosterView";
import type { PlayerIntelligence } from "../api/types";

const EMPTY_FILTERS: RosterFilters = {
  query: "",
  position: "ALL",
  group: "ALL",
  injury: "ALL",
};

type MyTeamPageProps = {
  navigate: (to: string) => void;
  load?: () => Promise<MyTeamData>;
};

export function MyTeamPage({ navigate, load = loadMyTeam }: MyTeamPageProps) {
  const [data, setData] = useState<MyTeamData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
  const [filters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setFatal(undefined);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFatal(userFacingApiMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const roster = useMemo(() => orderRoster(userRoster(data?.intelligence ?? [])), [data]);
  const visible = useMemo(() => filterRoster(roster, filters), [roster, filters]);
  const selected = visible.find((player) => player.identity.yahooPlayerKey === selectedKey);

  if (loading) {
    return <LoadingState message="Loading my team…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const week = data.recommendations?.context.week ?? data.league?.currentWeek ?? data.matchup?.week;
  const standing = data.standings.find((row) => row.teamKey === data.team?.teamKey);
  const yahooBlocked = Boolean(data.yahooError);
  const rosterUnavailable = Boolean(data.intelligenceError) && roster.length === 0;

  return (
    <div className="my-team-page" data-testid="my-team">
      <DashboardHeader
        title="My Team"
        description="Your roster, weekly outlook, rest-of-season value, and roster health."
        leagueName={data.league?.name}
        week={week}
        yahooStatus={data.yahooStatus}
        fantasyProsStatus={data.fantasyProsStatus}
        leagues={data.leagues}
      />
      {yahooBlocked ? (
        <ProviderErrorState
          message={userFacingApiMessage(data.yahooError)}
          detail={data.yahooError instanceof Error ? `${data.yahooError.name}: ${data.yahooError.message}` : undefined}
        />
      ) : null}
      {data.fantasyProsError ? (
        <ProviderErrorState
          title="FantasyPros data unavailable"
          message={userFacingApiMessage(data.fantasyProsError)}
        />
      ) : null}
      {data.recommendationsError ? (
        <ProviderErrorState
          title="Co-Pilot analysis unavailable"
          message={userFacingApiMessage(data.recommendationsError)}
        />
      ) : null}
      {!yahooBlocked ? <TeamSummary team={data.team} standing={standing} matchup={data.matchup} /> : null}
      {!yahooBlocked && !rosterUnavailable ? <RosterHealth players={roster} /> : null}
      <RosterNeedsSummary
        needs={data.recommendations?.rosterNeeds ?? []}
        vulnerabilities={data.recommendations?.vulnerabilities ?? []}
        onExploreWaivers={() => navigate(ROUTES.waivers)}
      />
      <section className="panel-card" aria-labelledby="full-roster-heading">
        <h2 id="full-roster-heading">Full Roster</h2>
        {rosterUnavailable ? (
          <ProviderErrorState message="Roster data is unavailable." />
        ) : roster.length === 0 ? (
          <EmptyState message="No rostered players are available." />
        ) : (
          <>
            <MyTeamFilters filters={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />
            {visible.length === 0 ? (
              <EmptyState message="No players match these filters." />
            ) : (
              <MyTeamRosterTable
                players={visible}
                selectedKey={selectedKey}
                onSelect={(player: PlayerIntelligence) =>
                  setSelectedKey(player.identity.yahooPlayerKey === selectedKey ? undefined : player.identity.yahooPlayerKey)
                }
              />
            )}
            {selected ? <PlayerDetailPanel player={selected} /> : null}
          </>
        )}
      </section>
    </div>
  );
}
