import { useEffect, useMemo, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import { DashboardHeader } from "./DashboardHeader";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";
import { RosterNeedsSummary } from "./RosterNeedsSummary";
import { WaiverFilters } from "./WaiverFilters";
import { WaiverRecommendationTable } from "./WaiverRecommendationTable";
import { filterRecommendations, type RecommendationFilters } from "./filterRecommendations";
import { loadWaiverWire, type WaiverWireData } from "./loadWaiverWire";

const EMPTY_FILTERS: RecommendationFilters = {
  query: "",
  position: "ALL",
  availability: "ALL",
  support: "ALL",
};

type WaiverWirePageProps = {
  load?: () => Promise<WaiverWireData>;
};

export function WaiverWirePage({ load = loadWaiverWire }: WaiverWirePageProps) {
  const [data, setData] = useState<WaiverWireData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
  const [filters, setFilters] = useState<RecommendationFilters>(EMPTY_FILTERS);

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

  const recommendations = data?.recommendations?.recommendations ?? [];
  const visible = useMemo(() => filterRecommendations(recommendations, filters), [recommendations, filters]);

  if (loading) {
    return <LoadingState message="Loading waiver wire…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const recError = data.recommendationsError ? userFacingApiMessage(data.recommendationsError) : undefined;
  const yahooBlocked = Boolean(data.yahooError);
  const week = data.recommendations?.context.week ?? data.leagues[0]?.currentWeek;
  const leagueName = data.leagues[0]?.name;

  return (
    <div className="waiver-page" data-testid="waiver-wire">
      <DashboardHeader
        title="Waiver Wire"
        description="Available players ranked for your roster using league availability, FantasyPros intelligence, and Co-Pilot roster needs."
        leagueName={leagueName}
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
      <RosterNeedsSummary
        needs={data.recommendations?.rosterNeeds ?? []}
        vulnerabilities={data.recommendations?.vulnerabilities ?? []}
      />
      <section className="panel-card" aria-labelledby="waiver-list-heading">
        <h2 id="waiver-list-heading">Recommended Available Players</h2>
        <WaiverFilters filters={filters} onChange={setFilters} />
        {recError ? (
          <ProviderErrorState message={recError} />
        ) : recommendations.length === 0 ? (
          <EmptyState message="No waiver recommendations are available with the current league data." />
        ) : visible.length === 0 ? (
          <EmptyState message="No players match these filters." />
        ) : (
          <WaiverRecommendationTable recommendations={visible} week={week} />
        )}
      </section>
    </div>
  );
}
