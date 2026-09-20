import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import App from "../App";
import type { YahooRoster, YahooStanding } from "../api/types";
import { LeaguePage } from "./LeaguePage";
import type { LeaguePageData } from "./loadLeague";

vi.mock("./loadDashboard", () => ({
  loadDashboard: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    standings: [],
    intelligence: [],
  })),
}));

vi.mock("./loadMyTeam", () => ({
  loadMyTeam: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    standings: [],
    intelligence: [],
  })),
}));

vi.mock("./loadWaiverWire", () => ({
  loadWaiverWire: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    recommendations: {
      context: { week: 2, scoringFormat: "half_ppr", providerModes: { yahoo: "fixture", fantasyPros: "fixture" } },
      summary: { candidatesConsidered: 0, eligible: 0, recommendationsReturned: 0 },
      recommendations: [],
    },
  })),
}));

vi.mock("./loadStartSit", () => ({
  loadStartSit: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
  })),
}));

vi.mock("./loadPlayers", () => ({
  loadPlayers: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    players: [],
  })),
}));

vi.mock("./loadMatchup", () => ({
  loadMatchup: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
  })),
}));

vi.mock("./loadLeague", () => ({
  loadLeague: vi.fn(async () => leagueData()),
}));

vi.mock("./loadLeagueRoster", () => ({
  loadLeagueRoster: vi.fn(async () => ({
    team: { teamKey: "t.1", teamId: "1", name: "Co-Pilot Test Team", leagueKey: "999.l.123456" },
    week: 2,
    players: [],
  })),
}));

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

function standing(partial: YahooStanding): YahooStanding {
  return partial;
}

function leagueData(overrides: Partial<LeaguePageData> = {}): LeaguePageData {
  return {
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [
      {
        leagueKey: "999.l.123456",
        leagueId: "123456",
        name: "Co-Pilot Test League",
        season: "2026",
        currentWeek: 2,
        numTeams: 10,
        scoringType: "head",
        draftStatus: "postdraft",
      },
    ],
    team: { teamKey: "t.1", teamId: "1", name: "Co-Pilot Test Team", leagueKey: "999.l.123456" },
    standings: [
      standing({
        rank: 1,
        teamKey: "t.6",
        teamId: "6",
        name: "Pocket Passers",
        wins: 1,
        losses: 0,
        ties: 0,
        percentage: 1,
        pointsFor: 142.8,
        pointsAgainst: 101.2,
        streak: "W1",
      }),
      standing({
        rank: 2,
        teamKey: "t.4",
        teamId: "4",
        name: "Red Zone Robots",
        wins: 1,
        losses: 0,
        ties: 0,
        percentage: 1,
        pointsFor: 138.4,
        pointsAgainst: 109.15,
        streak: "W1",
      }),
      standing({
        rank: 3,
        teamKey: "t.1",
        teamId: "1",
        name: "Co-Pilot Test Team",
        wins: 1,
        losses: 0,
        ties: 0,
        percentage: 1,
        pointsFor: 131.9,
        pointsAgainst: 118.4,
        streak: "W1",
      }),
      standing({
        rank: 10,
        teamKey: "t.2",
        teamId: "2",
        name: "Fourth Down Labs",
        wins: 0,
        losses: 1,
        ties: 0,
        percentage: 0,
        pointsFor: 0,
        pointsAgainst: 87.4,
        streak: "L1",
      }),
    ],
    league: {
      leagueKey: "999.l.123456",
      leagueId: "123456",
      name: "Co-Pilot Test League",
      season: "2026",
      currentWeek: 2,
      numTeams: 10,
      scoringType: "head",
      draftStatus: "postdraft",
    },
    matchups: [
      {
        week: 2,
        status: "midevent",
        teams: [
          { teamKey: "t.1", teamId: "1", name: "Co-Pilot Test Team", points: 87.42, projectedPoints: 126.55 },
          { teamKey: "t.2", teamId: "2", name: "Fourth Down Labs", points: 81.18, projectedPoints: 121.3 },
        ],
      },
    ],
    settings: {
      scoringType: "head",
      draftType: "live",
      waiverType: "R",
      waiverTime: "2",
      usesFaab: false,
      tradeEndDate: "2026-11-18",
      tradeRatifyType: "commish",
      usesPlayoff: true,
      playoffStartWeek: 15,
      numPlayoffTeams: 6,
      rosterPositions: [
        { position: "QB", count: 1 },
        { position: "WR", count: 2 },
        { position: "RB", count: 2 },
        { position: "TE", count: 1 },
        { position: "W/R/T", count: 1 },
        { position: "K", count: 1 },
        { position: "DEF", count: 1 },
        { position: "BN", count: 6 },
        { position: "IR", count: 1 },
      ],
    },
    ...overrides,
  };
}

function myRoster(): YahooRoster {
  return {
    team: { teamKey: "t.1", teamId: "1", name: "Co-Pilot Test Team", leagueKey: "999.l.123456" },
    week: 2,
    players: [
      {
        playerKey: "p1",
        playerId: "1",
        name: "Rex Calder",
        selectedPosition: "QB",
        displayPosition: "QB",
        editorialTeamAbbr: "BUF",
        byeWeek: 12,
      },
      {
        playerKey: "p2",
        playerId: "2",
        name: "Quinn Mercer",
        selectedPosition: "WR",
        displayPosition: "WR",
        editorialTeamAbbr: "GB",
        status: "Q",
        byeWeek: 5,
      },
    ],
  };
}

function otherRoster(): YahooRoster {
  return {
    team: { teamKey: "t.2", teamId: "2", name: "Fourth Down Labs", leagueKey: "999.l.123456" },
    week: 2,
    players: [
      {
        playerKey: "p9",
        playerId: "9",
        name: "Wynn O’Connell",
        selectedPosition: "TE",
        displayPosition: "TE",
        editorialTeamAbbr: "WAS",
        byeWeek: 14,
      },
      {
        playerKey: "p10",
        playerId: "10",
        name: "Ivo Marsh",
        selectedPosition: "BN",
        displayPosition: "RB",
        editorialTeamAbbr: "CHI",
        status: "O",
      },
    ],
  };
}

async function renderLeague(options?: {
  data?: LeaguePageData;
  roster?: (teamKey: string) => Promise<YahooRoster>;
}) {
  const load = vi.fn(async () => options?.data ?? leagueData());
  const loadRoster =
    options?.roster ??
    (async (teamKey: string) => (teamKey === "t.2" ? otherRoster() : myRoster()));
  render(<LeaguePage navigate={vi.fn()} load={load} loadRoster={loadRoster} />);
  await screen.findByTestId("league");
  return { load, loadRoster };
}

describe("league", () => {
  it("A. /league renders", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    expect(await screen.findByTestId("league")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "League" })).toBeTruthy();
  });

  it("B/C/D/E. league overview fields render", async () => {
    await renderLeague();
    expect((await screen.findAllByText("Co-Pilot Test League")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Week 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Head-to-head").length).toBeGreaterThan(0);
  });

  it("F/G/H/I/J/K/L. standings render in Yahoo rank order", async () => {
    await renderLeague();
    const table = (await screen.findAllByRole("table"))[0];
    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(bodyRows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["1", "2", "3", "10"]);
    expect(screen.getByRole("button", { name: "Pocket Passers" })).toBeTruthy();
    expect(screen.getByText("142.8")).toBeTruthy();
    expect(screen.getByText("101.2")).toBeTruthy();
    expect(screen.getAllByText("1-0").length).toBeGreaterThan(0);
  });

  it("M. My Team identified textually", async () => {
    await renderLeague();
    await screen.findByTestId("league");
    expect(screen.getAllByText("My Team").length).toBeGreaterThan(0);
  });

  it("N/O/P. team selection and My Team link", async () => {
    const navigate = vi.fn();
    render(<LeaguePage navigate={navigate} load={async () => leagueData()} loadRoster={async () => myRoster()} />);
    await screen.findByRole("heading", { name: "Co-Pilot Test Team" });
    fireEvent.click(screen.getByRole("link", { name: "View My Team" }));
    expect(navigate).toHaveBeenCalledWith("/team");
  });

  it("Q/R/S/T/U. other team roster loads", async () => {
    await renderLeague();
    fireEvent.click(await screen.findByRole("button", { name: "Fourth Down Labs" }));
    expect(await screen.findByRole("heading", { name: "Fourth Down Labs" })).toBeTruthy();
    expect(screen.getByText("Other Team")).toBeTruthy();
    expect(screen.getByText("Wynn O’Connell")).toBeTruthy();
    expect(screen.getAllByText("TE").length).toBeGreaterThan(0);
    expect(screen.getByText("WAS")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "View My Team" })).toBeNull();
  });

  it("V. missing roster data displays —", async () => {
    await renderLeague();
    fireEvent.click(await screen.findByRole("button", { name: "Fourth Down Labs" }));
    await screen.findByText("Ivo Marsh");
    const row = screen.getByText("Ivo Marsh").closest("tr");
    expect(row?.textContent).toContain("—");
  });

  it("W. roster failure does not crash page", async () => {
    render(
      <LeaguePage
        navigate={vi.fn()}
        load={async () => leagueData()}
        loadRoster={async (teamKey) => {
          if (teamKey === "t.2") {
            throw new ApiError(404, "yahoo_http_error", "No Yahoo roster was found for that team.");
          }
          return myRoster();
        }}
      />,
    );
    expect(await screen.findByTestId("league")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Fourth Down Labs" }));
    expect(await screen.findByText("Roster unavailable")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Standings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pocket Passers" })).toBeTruthy();
  });

  it("X/Y/Z/AA/AB. lineup settings render", async () => {
    await renderLeague();
    expect(await screen.findByText("QB ×1")).toBeTruthy();
    expect(screen.getByText("FLEX ×1")).toBeTruthy();
    expect(screen.getByText("BN ×6")).toBeTruthy();
    expect(screen.getByText("IR ×1")).toBeTruthy();
  });

  it("AC/AD/AE/AF. scoring, waiver, trade, and playoff settings render", async () => {
    await renderLeague();
    expect(await screen.findByText("Scoring format")).toBeTruthy();
    expect(screen.getByText("Rolling list")).toBeTruthy();
    expect(screen.getByText("2026-11-18")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
  });

  it("AG. missing setting does not invent default", async () => {
    await renderLeague({
      data: leagueData({
        settings: { scoringType: "head", rosterPositions: [{ position: "QB", count: 1 }] },
      }),
    });
    expect(await screen.findByText("QB ×1")).toBeTruthy();
    expect(screen.queryByText("Trade deadline")).toBeNull();
    expect(screen.queryByText("Playoff start week")).toBeNull();
    expect(screen.queryByText("FAAB budget")).toBeNull();
  });

  it("AH. explicit zero remains zero", async () => {
    await renderLeague();
    await screen.findByTestId("league");
    const labs = (await screen.findByRole("button", { name: "Fourth Down Labs" })).closest("tr");
    expect(labs?.textContent).toContain("0");
    expect(within(labs as HTMLElement).getAllByRole("cell")[4].textContent).toBe("0");
  });

  it("AI. fixture state visible", async () => {
    await renderLeague();
    expect((await screen.findAllByText("Fixture data")).length).toBeGreaterThan(0);
  });

  it("AJ. Yahoo unavailable state", async () => {
    render(
      <LeaguePage
        navigate={vi.fn()}
        load={async () =>
          leagueData({
            yahooError: new ApiError(502, "yahoo_http_error", "Yahoo Fantasy API request failed."),
            leagues: [],
            standings: [],
            league: undefined,
            matchups: [],
            settings: {},
          })
        }
        loadRoster={async () => myRoster()}
      />,
    );
    expect(await screen.findByText("Yahoo unavailable")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Standings" })).toBeNull();
  });

  it("AK/AL/AM/AN/AO. no ranking, grades, odds, or trade recommendations", async () => {
    await renderLeague();
    await screen.findByTestId("league");
    expect(screen.queryByText(/power ranking/i)).toBeNull();
    expect(screen.queryByText(/team grade/i)).toBeNull();
    expect(screen.queryByText(/playoff odds/i)).toBeNull();
    expect(screen.queryByText(/championship odds/i)).toBeNull();
    expect(screen.queryByText(/trade with this team/i)).toBeNull();
    expect(screen.queryByText(/best trade/i)).toBeNull();
  });
});

describe("league routing", () => {
  it("AP. Dashboard remains reachable", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
  });

  it("AQ. My Team remains reachable", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "My Team" }));
    expect(await screen.findByTestId("my-team")).toBeTruthy();
  });

  it("AR. Waiver Wire remains reachable", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Waiver Wire" }));
    expect(await screen.findByTestId("waiver-wire")).toBeTruthy();
  });

  it("AS. Start / Sit remains reachable", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Start / Sit" }));
    expect(await screen.findByTestId("start-sit")).toBeTruthy();
  });

  it("AT. Players remains reachable", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Players" }));
    expect(await screen.findByTestId("players")).toBeTruthy();
  });

  it("AU. Draft Room remains reachable", async () => {
    window.history.pushState({}, "", "/league");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });
});
