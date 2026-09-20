import { useEffect, useMemo, useState } from "react";
import { userFacingApiMessage } from "../api/http";
import { ROUTES } from "../app/routes";
import type { YahooLeagueSettings, YahooMatchup, YahooRoster, YahooRosterPlayer, YahooStanding } from "../api/types";
import { DashboardHeader } from "./DashboardHeader";
import {
  formatDraftStatus,
  formatLineupSlots,
  formatScoringType,
  formatWaiverType,
  formatWinPercentage,
  hasAnySettings,
  lineupSlotLabel,
} from "./leagueView";
import { loadLeague, type LeaguePageData } from "./loadLeague";
import { loadLeagueRoster } from "./loadLeagueRoster";
import { formatRecord, formatTableNumber } from "./labels";
import { EmptyState, LoadingState, ProviderErrorState } from "./StatusBlocks";

type LeaguePageProps = {
  navigate: (to: string) => void;
  load?: () => Promise<LeaguePageData>;
  loadRoster?: (teamKey: string) => Promise<YahooRoster>;
};

export function LeaguePage({
  navigate,
  load = loadLeague,
  loadRoster = loadLeagueRoster,
}: LeaguePageProps) {
  const [data, setData] = useState<LeaguePageData | undefined>();
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | undefined>();
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [roster, setRoster] = useState<YahooRoster | undefined>();
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | undefined>();
  const [rosterCache] = useState(() => new Map<string, YahooRoster>());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setFatal(undefined);
          setSelectedKey((current) => current ?? result.team?.teamKey ?? result.standings[0]?.teamKey);
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

  useEffect(() => {
    if (!selectedKey) {
      setRoster(undefined);
      setRosterError(undefined);
      return;
    }
    const cached = rosterCache.get(selectedKey);
    if (cached) {
      setRoster(cached);
      setRosterError(undefined);
      setRosterLoading(false);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    setRosterError(undefined);
    loadRoster(selectedKey)
      .then((result) => {
        if (!cancelled) {
          rosterCache.set(selectedKey, result);
          setRoster(result);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRoster(undefined);
          setRosterError(userFacingApiMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRosterLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadRoster, rosterCache, selectedKey]);

  const selectedStanding = data?.standings.find((row) => row.teamKey === selectedKey);
  const selectedMatchup = useMemo(
    () => data?.matchups.find((matchup) => matchup.teams.some((team) => team.teamKey === selectedKey)),
    [data, selectedKey],
  );

  if (loading) {
    return <LoadingState message="Loading league…" />;
  }
  if (fatal || !data) {
    return <ProviderErrorState message={fatal ?? "Yahoo Fantasy data is temporarily unavailable."} />;
  }

  const yahooBlocked = Boolean(data.yahooError) && data.standings.length === 0 && !data.league;
  const league = data.league ?? data.leagues[0];
  const week = league?.currentWeek;
  const scoring = formatScoringType(league?.scoringType ?? data.settings.scoringType);
  const isMine = (teamKey: string) => teamKey === data.team?.teamKey;

  return (
    <div className="league-page" data-testid="league">
      <DashboardHeader
        title="League"
        description="Standings, teams, rosters, and league settings."
        leagueName={league?.name}
        week={week}
        yahooStatus={data.yahooStatus}
        fantasyProsStatus={data.fantasyProsStatus}
        leagues={data.leagues}
      />
      {yahooBlocked ? (
        <ProviderErrorState title="Yahoo unavailable" message={userFacingApiMessage(data.yahooError)} />
      ) : (
        <>
          <LeagueOverview
            name={league?.name}
            week={week}
            teamCount={league?.numTeams ?? (data.standings.length > 0 ? data.standings.length : undefined)}
            scoring={scoring}
            season={league?.season}
            draftStatus={formatDraftStatus(league?.draftStatus)}
            userTeam={data.team?.name}
          />
          <section className="panel-card" aria-labelledby="standings-heading">
            <h2 id="standings-heading">Standings</h2>
            {data.standings.length === 0 ? (
              <EmptyState message="Standings are unavailable." />
            ) : (
              <StandingsTable
                standings={data.standings}
                selectedKey={selectedKey}
                userTeamKey={data.team?.teamKey}
                onSelect={setSelectedKey}
              />
            )}
          </section>
          {selectedStanding ? (
            <SelectedTeamPanel
              standing={selectedStanding}
              mine={isMine(selectedStanding.teamKey)}
              matchup={selectedMatchup}
              roster={roster}
              rosterLoading={rosterLoading}
              rosterError={rosterError}
              navigate={navigate}
            />
          ) : null}
          <LeagueSettingsSection settings={data.settings} scoring={scoring} />
        </>
      )}
    </div>
  );
}

function LeagueOverview({
  name,
  week,
  teamCount,
  scoring,
  season,
  draftStatus,
  userTeam,
}: {
  name?: string;
  week?: number;
  teamCount?: number;
  scoring?: string;
  season?: string;
  draftStatus?: string;
  userTeam?: string;
}) {
  const items = [
    { label: "League", value: name },
    { label: "Week", value: week != null ? `Week ${week}` : undefined },
    { label: "Teams", value: teamCount != null ? String(teamCount) : undefined },
    { label: "Scoring", value: scoring },
    { label: "Season", value: season },
    { label: "Draft", value: draftStatus },
    { label: "My team", value: userTeam },
  ].filter((item) => item.value);
  return (
    <section className="panel-card" aria-labelledby="league-overview-heading">
      <h2 id="league-overview-heading">League overview</h2>
      <ul className="league-overview">
        {items.map((item) => (
          <li key={item.label}>
            <span className="dash-meta-label">{item.label}</span>
            <span>{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StandingsTable({
  standings,
  selectedKey,
  userTeamKey,
  onSelect,
}: {
  standings: YahooStanding[];
  selectedKey?: string;
  userTeamKey?: string;
  onSelect: (teamKey: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table league-standings">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Record</th>
            <th>Win %</th>
            <th>Points For</th>
            <th>Points Against</th>
            <th>Streak</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const selected = row.teamKey === selectedKey;
            const mine = row.teamKey === userTeamKey;
            const winPct = formatWinPercentage(row.percentage);
            const pf = formatTableNumber(row.pointsFor);
            const pa = formatTableNumber(row.pointsAgainst);
            const record = formatRecord(row.wins, row.losses, row.ties) ?? "—";
            return (
              <tr key={row.teamKey} className={selected ? "is-open" : undefined} aria-selected={selected}>
                <td>{row.rank}</td>
                <td>
                  <button type="button" className="text-btn" onClick={() => onSelect(row.teamKey)}>
                    {row.name}
                  </button>
                  {mine ? <span className="cell-sub">My Team</span> : null}
                </td>
                <td>{record}</td>
                <td className={winPct.missing ? "is-missing" : undefined}>{winPct.text}</td>
                <td className={pf.missing ? "is-missing" : undefined}>{pf.text}</td>
                <td className={pa.missing ? "is-missing" : undefined}>{pa.text}</td>
                <td>{row.streak ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SelectedTeamPanel({
  standing,
  mine,
  matchup,
  roster,
  rosterLoading,
  rosterError,
  navigate,
}: {
  standing: YahooStanding;
  mine: boolean;
  matchup?: YahooMatchup;
  roster?: YahooRoster;
  rosterLoading: boolean;
  rosterError?: string;
  navigate: (to: string) => void;
}) {
  const record = formatRecord(standing.wins, standing.losses, standing.ties) ?? "—";
  const pf = formatTableNumber(standing.pointsFor);
  const pa = formatTableNumber(standing.pointsAgainst);
  const opponent = matchup?.teams.find((team) => team.teamKey !== standing.teamKey);
  const selectedSide = matchup?.teams.find((team) => team.teamKey === standing.teamKey);
  return (
    <section className="panel-card player-detail" aria-labelledby="selected-team-heading">
      <h2 id="selected-team-heading">{standing.name}</h2>
      {mine ? <p className="cell-sub">My Team</p> : <p className="cell-sub">Other Team</p>}
      <h3>Team</h3>
      <dl className="intel-grid">
        <div>
          <dt>Record</dt>
          <dd>{record}</dd>
        </div>
        <div>
          <dt>Rank</dt>
          <dd>{standing.rank}</dd>
        </div>
        <div>
          <dt>Points for</dt>
          <dd className={pf.missing ? "is-missing" : undefined}>{pf.text}</dd>
        </div>
        <div>
          <dt>Points against</dt>
          <dd className={pa.missing ? "is-missing" : undefined}>{pa.text}</dd>
        </div>
      </dl>
      {mine ? (
        <p>
          <a
            className="text-link"
            href={ROUTES.team}
            onClick={(event) => {
              event.preventDefault();
              navigate(ROUTES.team);
            }}
          >
            View My Team
          </a>
        </p>
      ) : null}
      {matchup && opponent ? (
        <>
          <h3>Current matchup</h3>
          <dl className="intel-grid">
            <div>
              <dt>Opponent</dt>
              <dd>{opponent.name}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>
                {formatTableNumber(selectedSide?.points).text} – {formatTableNumber(opponent.points).text}
              </dd>
            </div>
            <div>
              <dt>Projected</dt>
              <dd>
                {formatTableNumber(selectedSide?.projectedPoints).text} –{" "}
                {formatTableNumber(opponent.projectedPoints).text}
              </dd>
            </div>
          </dl>
        </>
      ) : null}
      <h3>Roster</h3>
      {rosterLoading ? <p role="status">Loading roster…</p> : null}
      {rosterError ? <ProviderErrorState title="Roster unavailable" message={rosterError} /> : null}
      {!rosterLoading && !rosterError && roster ? <TeamRosterTable players={roster.players} navigate={navigate} /> : null}
    </section>
  );
}

function TeamRosterTable({
  players,
  navigate,
}: {
  players: YahooRosterPlayer[];
  navigate: (to: string) => void;
}) {
  if (players.length === 0) {
    return <EmptyState message="No rostered players are available." />;
  }
  return (
    <>
      <div className="table-wrap">
        <table className="data-table league-roster">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Player</th>
              <th>Pos</th>
              <th>NFL Team</th>
              <th>Status</th>
              <th>Bye</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.playerKey}>
                <td>{player.selectedPosition ?? "—"}</td>
                <td>{player.name}</td>
                <td>{player.displayPosition ?? "—"}</td>
                <td>{player.editorialTeamAbbr ?? "—"}</td>
                <td>{player.statusFull ?? player.status ?? "—"}</td>
                <td>{player.byeWeek ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <a
          className="text-link"
          href={ROUTES.players}
          onClick={(event) => {
            event.preventDefault();
            navigate(ROUTES.players);
          }}
        >
          Research players
        </a>
      </p>
    </>
  );
}

function LeagueSettingsSection({ settings, scoring }: { settings: YahooLeagueSettings; scoring?: string }) {
  const lineup = formatLineupSlots(settings.rosterPositions);
  const qb = settings.rosterPositions?.find((row) => row.position === "QB");
  const flex = settings.rosterPositions?.find((row) => lineupSlotLabel(row.position) === "FLEX");
  const bench = settings.rosterPositions?.find((row) => row.position === "BN");
  const ir = settings.rosterPositions?.find((row) => row.position === "IR");
  if (!hasAnySettings(settings) && !scoring) {
    return (
      <section className="panel-card" aria-labelledby="league-settings-heading">
        <h2 id="league-settings-heading">League settings</h2>
        <EmptyState message="League settings are unavailable." />
      </section>
    );
  }
  return (
    <section className="panel-card" aria-labelledby="league-settings-heading">
      <h2 id="league-settings-heading">League settings</h2>
      {lineup.length > 0 ? (
        <>
          <h3>Lineup configuration</h3>
          <ul className="league-lineup">
            {lineup.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          <p className="visually-hidden">
            {qb ? `QB ${qb.count}` : null} {flex ? `FLEX ${flex.count}` : null} {bench ? `BN ${bench.count}` : null}{" "}
            {ir ? `IR ${ir.count}` : null}
          </p>
        </>
      ) : null}
      <h3>Scoring</h3>
      <dl className="intel-grid">
        <div>
          <dt>Scoring format</dt>
          <dd>{scoring ?? "—"}</dd>
        </div>
      </dl>
      {settings.waiverType || settings.waiverTime || settings.usesFaab !== undefined || settings.faabBudget !== undefined ? (
        <>
          <h3>Waivers</h3>
          <dl className="intel-grid">
            {settings.waiverType ? (
              <div>
                <dt>Waiver type</dt>
                <dd>{formatWaiverType(settings.waiverType)}</dd>
              </div>
            ) : null}
            {settings.waiverTime ? (
              <div>
                <dt>Waiver time</dt>
                <dd>{settings.waiverTime}</dd>
              </div>
            ) : null}
            {settings.usesFaab !== undefined ? (
              <div>
                <dt>FAAB</dt>
                <dd>{settings.usesFaab ? "Yes" : "No"}</dd>
              </div>
            ) : null}
            {settings.faabBudget !== undefined ? (
              <div>
                <dt>FAAB budget</dt>
                <dd>{settings.faabBudget}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
      {settings.tradeEndDate || settings.tradeRatifyType ? (
        <>
          <h3>Trades</h3>
          <dl className="intel-grid">
            {settings.tradeEndDate ? (
              <div>
                <dt>Trade deadline</dt>
                <dd>{settings.tradeEndDate}</dd>
              </div>
            ) : null}
            {settings.tradeRatifyType ? (
              <div>
                <dt>Trade review</dt>
                <dd>{settings.tradeRatifyType}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
      {settings.playoffStartWeek !== undefined ||
      settings.numPlayoffTeams !== undefined ||
      settings.usesPlayoff !== undefined ? (
        <>
          <h3>Playoffs</h3>
          <dl className="intel-grid">
            {settings.playoffStartWeek !== undefined ? (
              <div>
                <dt>Playoff start week</dt>
                <dd>{settings.playoffStartWeek}</dd>
              </div>
            ) : null}
            {settings.numPlayoffTeams !== undefined ? (
              <div>
                <dt>Playoff teams</dt>
                <dd>{settings.numPlayoffTeams}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}
    </section>
  );
}
