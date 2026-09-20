import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import App from "../App";
import type { CopilotRecommendation, PlayerIntelligence } from "../api/types";
import { DashboardPage } from "./DashboardPage";
import type { DashboardData } from "./loadDashboard";

vi.mock("./loadMyTeam", () => ({
  loadMyTeam: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    standings: [],
    intelligence: [],
  })),
}));

vi.mock("./loadStartSit", () => ({
  loadStartSit: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
  })),
}));

vi.mock("./loadDashboard", () => ({
  loadDashboard: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    standings: [],
    intelligence: [],
  })),
}));

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

function intel(partial: Partial<PlayerIntelligence> & { name: string; key: string }): PlayerIntelligence {
  return {
    identity: { yahooPlayerKey: partial.key, status: "matched" },
    player: { name: partial.name, team: partial.player?.team ?? "KC", position: partial.player?.position ?? "RB" },
    leagueState: {
      availability: "rostered_by_user",
      rosterSlot: "RB",
      ...partial.leagueState,
    },
    weekly: partial.weekly,
    restOfSeason: partial.restOfSeason,
    injury: partial.injury,
    warnings: [],
  };
}

function component(score: number, max: number, available: boolean, reason: string) {
  return { score, max, available, reasons: [reason] };
}

function rec({
  name,
  rank,
  ...overrides
}: Partial<CopilotRecommendation> & { name: string; rank: number }): CopilotRecommendation {
  return {
    action: "consider_add",
    player: intel({
      key: name,
      name,
      leagueState: { availability: "free_agent" },
      player: { name, position: "WR", team: "MIA" },
    }),
    score: 25.1,
    rawScore: 25.1,
    availableMax: 90,
    dataQuality: "strongly_supported",
    reasons: ["RB depth is a current roster need.", "Ranks at the 30 percentile of FantasyPros RBs."],
    warnings: [],
    components: {
      rosterNeed: component(0, 30, true, "Not a documented roster need."),
      restOfSeason: component(9.1, 30, true, "Ranks below the middle of FantasyPros RBs."),
      weeklyValue: component(6, 20, true, "Projects for the current week."),
      healthRisk: component(0, 10, false, "No current FantasyPros injury record available."),
      rosterFit: component(10, 10, true, "Bye week does not conflict."),
    },
    ...overrides,
    rank,
  };
}

function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    team: { teamKey: "T1", teamId: "1", name: "Co-Pilot Test Team", leagueKey: "L1" },
    standings: [
      { rank: 3, teamKey: "T1", teamId: "1", name: "Co-Pilot Test Team", wins: 1, losses: 0, ties: 0, pointsFor: 131.9, pointsAgainst: 118.4 },
    ],
    league: { leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 },
    matchup: {
      week: 2,
      teams: [
        { teamKey: "T1", teamId: "1", name: "Co-Pilot Test Team", points: 87.42, projectedPoints: 126.55, wins: 1, losses: 0, ties: 0 },
        { teamKey: "T2", teamId: "2", name: "Fourth Down Labs", points: 81.18, projectedPoints: 119.2, wins: 0, losses: 1, ties: 0 },
      ],
    },
    intelligence: [
      intel({ key: "r1", name: "Rex Calder", player: { name: "Rex Calder", position: "QB", team: "BUF" }, weekly: { projectedPoints: 22.4, ecr: 8 }, injury: { status: "Questionable" } }),
      intel({ key: "r2", name: "Zero Proj", weekly: { projectedPoints: 0, ecr: 40 } }),
      intel({ key: "r3", name: "Missing Proj" }),
    ],
    recommendations: {
      context: {
        week: 2,
        scoringFormat: "half_ppr",
        providerModes: { yahoo: "fixture", fantasyPros: "fixture" },
      },
      summary: { candidatesConsidered: 40, eligible: 5, recommendationsReturned: 3 },
      recommendations: [
        rec({ name: "Nico Vale", rank: 1, dataQuality: "strongly_supported" }),
        rec({ name: "Ellis Prado", rank: 2, dataQuality: "supported", score: 25 }),
        rec({ name: "Limited K", rank: 3, dataQuality: "limited", score: 19, availableMax: 30 }),
      ],
    },
    ...overrides,
  };
}

describe("regular-season dashboard", () => {
  it("A. dashboard renders", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
  });

  it("B. loading state", () => {
    render(<DashboardPage navigate={() => undefined} load={() => new Promise(() => undefined)} />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
  });

  it("C. provider error state", async () => {
    render(
      <DashboardPage
        navigate={() => undefined}
        load={() =>
          Promise.resolve(
            dashboardData({
              yahooError: new ApiError(403, "additional_authorization_required", "Yahoo Fantasy API request failed."),
            }),
          )
        }
      />,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/temporarily unavailable/i);
  });

  it("D. fixture/development provider indicator", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    await screen.findByTestId("dashboard");
    expect(screen.getAllByText("Fixture data").length).toBeGreaterThan(0);
  });

  it("E/F. recommendations render backend order without re-sorting", async () => {
    const data = dashboardData({
      recommendations: {
        context: { week: 2, scoringFormat: "half_ppr", providerModes: { yahoo: "fixture", fantasyPros: "fixture" } },
        summary: { candidatesConsidered: 2, eligible: 2, recommendationsReturned: 2 },
        recommendations: [rec({ name: "Second Returned", rank: 2 }), rec({ name: "First Returned", rank: 1 })],
      },
    });
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(data)} />);
    await screen.findByTestId("dashboard");
    const names = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(names.slice(0, 2)).toEqual(["Second Returned", "First Returned"]);
  });

  it("G. strong/supported/limited labels", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    await screen.findByTestId("dashboard");
    expect(screen.getAllByText("Strong support").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Supported").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Limited data").length).toBeGreaterThan(0);
  });

  it("H/I. missing projection is unavailable and zero stays zero", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    await screen.findByTestId("dashboard");
    const cells = screen.getAllByRole("cell").map((node) => node.textContent);
    expect(cells.some((text) => text === "Unavailable")).toBe(true);
    expect(cells.some((text) => text === "0")).toBe(true);
  });

  it("J/K. missing injury is not healthy; injury watch is explicit only", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    await screen.findByTestId("dashboard");
    const watch = screen.getByRole("heading", { name: "Injury Watch" }).parentElement;
    expect(watch?.textContent).toMatch(/Questionable/);
    expect(watch?.textContent).not.toMatch(/Missing Proj/);
    expect(watch?.textContent).not.toMatch(/Healthy/);
  });

  it("L. recommendation detail expands", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    await screen.findByTestId("dashboard");
    fireEvent.click(screen.getAllByRole("button", { name: "Why?" })[0]!);
    expect(screen.getByText("Rest of Season")).toBeTruthy();
    expect(screen.getByText("Health")).toBeTruthy();
    expect(screen.getByText(/9\.1 \/ 30/)).toBeTruthy();
  });

  it("M. score is not rendered as a percentage", async () => {
    render(<DashboardPage navigate={() => undefined} load={() => Promise.resolve(dashboardData())} />);
    const node = await screen.findByTestId("dashboard");
    expect(node.textContent).not.toMatch(/25\.1%/);
    expect(node.textContent).not.toMatch(/Co-Pilot Score\s*25\.1%/);
    expect(screen.getAllByText("Co-Pilot Score").length).toBeGreaterThan(0);
    expect(screen.getAllByText("90 available points").length).toBeGreaterThan(0);
  });

  it("shows current league as identity, not a switcher", async () => {
    render(
      <DashboardPage
        navigate={() => undefined}
        load={() =>
          Promise.resolve(
            dashboardData({
              leagues: [
                { leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 },
                { leagueKey: "L2", leagueId: "2", name: "Co-Pilot Taxi Squad", season: "2026", currentWeek: 2 },
              ],
            }),
          )
        }
      />,
    );
    await screen.findByTestId("dashboard");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByTitle("Co-Pilot Test League").textContent).toBe("Co-Pilot Test League");
  });
});

describe("app routing", () => {
  it("N. Draft Room remains reachable", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Regular Season" })).toBeTruthy();
  });

  it("O. placeholder navigation routes work", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Settings" }));
    expect(await screen.findByTestId("placeholder-page")).toBeTruthy();
    expect(screen.getByText("This feature is not implemented yet.")).toBeTruthy();
  });
});
