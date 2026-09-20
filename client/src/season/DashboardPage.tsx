import { useEffect, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import { DashboardHeader } from "./DashboardHeader";
import { InjuryWatch } from "./InjuryWatch";
import { loadDashboard, type DashboardData } from "./loadDashboard";
import { MatchupCard } from "./MatchupCard";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { RosterTable } from "./RosterTable";
import { LoadingState, ProviderErrorState } from "./StatusBlocks";
import { TeamOverviewCard } from "./TeamOverviewCard";
import { WaiverPreview } from "./WaiverPreview";

type DashboardPageProps = {
  navigate: (to: string) => void;
  load?: () => Promise<DashboardData>;
};

export function DashboardPage({ navigate, load = loadDashboard }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();

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

  if (loading) {
    return <LoadingState />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const week = data.recommendations?.context.week ?? data.league?.currentWeek ?? data.matchup?.week;
  const standing = data.standings.find((row) => row.teamKey === data.team?.teamKey);
  const yahooBlocked = Boolean(data.yahooError);
  const recError = data.recommendationsError ? userFacingApiMessage(data.recommendationsError) : undefined;

  return (
    <div className="dashboard" data-testid="dashboard">
      <DashboardHeader
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
      <div className="dash-grid-top">
        <TeamOverviewCard team={data.team} standing={standing} />
        <MatchupCard matchup={data.matchup} userTeamKey={data.team?.teamKey} standings={data.standings} navigate={navigate} />
      </div>
      <div className="dash-grid-mid">
        <RecommendationsPanel payload={data.recommendations} errorMessage={recError} />
        <div className="dash-side">
          <InjuryWatch players={data.intelligence} />
          <WaiverPreview recommendations={data.recommendations?.recommendations ?? []} navigate={navigate} />
        </div>
      </div>
      <RosterTable players={data.intelligence} />
    </div>
  );
}
