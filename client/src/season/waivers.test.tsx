import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import App from "../App";
import type { CopilotRecommendation, PlayerIntelligence } from "../api/types";
import { WaiverWirePage } from "./WaiverWirePage";
import type { WaiverWireData } from "./loadWaiverWire";

vi.mock("./loadPlayers", () => ({
  loadPlayers: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    players: [],
  })),
}));

vi.mock("./loadStartSit", () => ({
  loadStartSit: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
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

vi.mock("./loadDashboard", () => ({
  loadDashboard: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    standings: [],
    intelligence: [],
  })),
}));

vi.mock("./loadWaiverWire", () => ({
  loadWaiverWire: vi.fn(async () => waiverData()),
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
      availability: "free_agent",
      ...partial.leagueState,
    },
    weekly: partial.weekly,
    restOfSeason: partial.restOfSeason,
    injury: partial.injury,
    warnings: partial.warnings ?? [],
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
      player: { name, position: "WR", team: "MIA" },
    }),
    score: 25.1,
    rawScore: 25.1,
    availableMax: 90,
    dataQuality: "strongly_supported",
    reasons: ["WR depth is a current roster need."],
    warnings: [],
    components: {
      rosterNeed: component(12, 30, true, "WR is a documented roster need."),
      restOfSeason: component(9.1, 30, true, "Ranks below the middle of FantasyPros WRs."),
      weeklyValue: component(6, 20, true, "Projects for the current week."),
      healthRisk: component(0, 10, false, "No current FantasyPros injury record available."),
      rosterFit: component(10, 10, true, "Bye week does not conflict."),
    },
    ...overrides,
    rank,
  };
}

function waiverData(overrides: Partial<WaiverWireData> = {}): WaiverWireData {
  return {
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    recommendations: {
      context: { week: 2, scoringFormat: "half_ppr", providerModes: { yahoo: "fixture", fantasyPros: "fixture" } },
      summary: { candidatesConsidered: 40, eligible: 5, recommendationsReturned: 5 },
      rosterNeeds: [
        { position: "RB", severity: "high", reasons: ["No healthy RB depth."] },
        { position: "WR", severity: "medium", reasons: ["Thin WR bench."] },
      ],
      vulnerabilities: [{ type: "injury", position: "WR", severity: "medium", reason: "A starter is listed as questionable." }],
      recommendations: [
        rec({
          name: "Nico Vale",
          rank: 1,
          player: intel({
            key: "Nico Vale",
            name: "Nico Vale",
            player: { name: "Nico Vale", position: "RB", team: "CHI" },
            weekly: { week: 2, projectedPoints: 14.2, ecr: 22 },
            restOfSeason: { projectedPoints: 140, ecr: 28 },
          }),
          reasons: ["RB is a documented roster need."],
          dropPlayer: {
            playerKey: "drop-1",
            playerId: "1",
            name: "Quinn Mercer",
            displayPosition: "WR",
            selectedPosition: "BN",
          },
        }),
        rec({
          name: "Ellis Prado",
          rank: 2,
          dataQuality: "supported",
          score: 25,
          player: intel({
            key: "Ellis Prado",
            name: "Ellis Prado",
            player: { name: "Ellis Prado", position: "WR", team: "SEA" },
            weekly: { projectedPoints: 0, ecr: 40 },
          }),
        }),
        rec({
          name: "Joss Hale",
          rank: 3,
          player: intel({
            key: "Joss Hale",
            name: "Joss Hale",
            player: { name: "Joss Hale", position: "QB", team: "DEN" },
            leagueState: { availability: "waivers" },
          }),
        }),
        rec({
          name: "Limited K",
          rank: 4,
          dataQuality: "limited",
          score: 19,
          availableMax: 30,
          warnings: ["Weekly FantasyPros projection is unavailable."],
          player: intel({
            key: "Limited K",
            name: "Limited K",
            player: { name: "Limited K", position: "K", team: "JAX" },
          }),
        }),
        rec({
          name: "Missing Proj",
          rank: 5,
          player: intel({
            key: "Missing Proj",
            name: "Missing Proj",
            player: { name: "Missing Proj", position: "TE", team: "BAL" },
          }),
        }),
      ],
    },
    ...overrides,
  };
}

describe("waiver wire", () => {
  it("A. Waiver Wire route renders", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    expect(await screen.findByTestId("waiver-wire")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Waiver Wire" })).toBeTruthy();
  });

  it("B/C. full backend order is preserved", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    const ranks = screen.getAllByText(/^#\d+$/).map((node) => node.textContent);
    expect(ranks).toEqual(["#1", "#2", "#3", "#4", "#5"]);
    expect(screen.getByText("Nico Vale")).toBeTruthy();
    expect(screen.getByText("Missing Proj")).toBeTruthy();
  });

  it("D. search filters by player name", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Nico" } });
    expect(screen.getByText("Nico Vale")).toBeTruthy();
    expect(screen.queryByText("Ellis Prado")).toBeNull();
  });

  it("E. search filters by team", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "SEA" } });
    expect(screen.getByText("Ellis Prado")).toBeTruthy();
    expect(screen.queryByText("Nico Vale")).toBeNull();
  });

  it("F. position filter", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "RB" } });
    expect(screen.getByText("Nico Vale")).toBeTruthy();
    expect(screen.queryByText("Ellis Prado")).toBeNull();
  });

  it("G. availability filter", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.change(screen.getByLabelText("Availability"), { target: { value: "waivers" } });
    expect(screen.getByText("Joss Hale")).toBeTruthy();
    expect(screen.queryByText("Nico Vale")).toBeNull();
  });

  it("H. support filter", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.change(screen.getByLabelText("Support"), { target: { value: "limited" } });
    expect(screen.getByText("Limited K")).toBeTruthy();
    expect(screen.queryByText("Nico Vale")).toBeNull();
  });

  it("I. filtering preserves original backend rank", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.change(screen.getByLabelText("Support"), { target: { value: "limited" } });
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.queryByText("#1")).toBeNull();
  });

  it("J/K. missing projection is a dash and explicit zero stays zero", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    const missing = rows.find((row) => row.textContent?.includes("Missing Proj"));
    const zero = rows.find((row) => row.textContent?.includes("Ellis Prado"));
    const cells = (row: HTMLElement | undefined) =>
      row ? within(row).getAllByRole("cell").map((node) => node.textContent) : [];
    expect(cells(missing).includes("—")).toBe(true);
    expect(missing?.textContent).not.toMatch(/Healthy/);
    expect(cells(zero).includes("0")).toBe(true);
  });

  it("L. missing injury is not Healthy", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    const table = screen.getByRole("table");
    expect(table.textContent).not.toMatch(/Healthy/);
    const missing = within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Missing Proj"));
    expect(missing?.textContent).toMatch(/—/);
  });

  it("M. limited-data player remains visible", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    expect(screen.getByText("Limited K")).toBeTruthy();
    expect(screen.getAllByText("Limited data").length).toBeGreaterThan(0);
  });

  it("N. Potential Drop comes only from backend dropPlayer", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    expect(screen.getByText("Quinn Mercer")).toBeTruthy();
    const table = screen.getByRole("table");
    const noDrop = within(table)
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Ellis Prado"));
    expect(noDrop?.textContent).not.toMatch(/Quinn Mercer/);
  });

  it("O. no transactional Add/Drop button exists", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    expect(screen.queryByRole("button", { name: /^(add|claim|drop|submit waiver)$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add\/drop/i })).toBeNull();
  });

  it("P/Q. analysis expansion shows backend component reasons", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    fireEvent.click(screen.getAllByRole("button", { name: "View analysis" })[0]!);
    expect(screen.getByText("Rest of Season")).toBeTruthy();
    expect(screen.getByText("WR is a documented roster need.")).toBeTruthy();
    expect(screen.getByText(/9\.1 \/ 30/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Potential Drop" })).toBeTruthy();
    expect(screen.getByText(/Quinn Mercer · WR · BN/)).toBeTruthy();
  });

  it("R. provider error state", async () => {
    render(
      <WaiverWirePage
        load={() =>
          Promise.resolve(
            waiverData({
              yahooError: new ApiError(403, "additional_authorization_required", "Yahoo Fantasy API request failed."),
            }),
          )
        }
      />,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/temporarily unavailable/i);
  });

  it("S. fixture indicator", async () => {
    render(<WaiverWirePage load={() => Promise.resolve(waiverData())} />);
    await screen.findByTestId("waiver-wire");
    expect(screen.getAllByText("Fixture data").length).toBeGreaterThan(0);
  });
});

describe("waiver routing", () => {
  it("T. Draft Room remains reachable", async () => {
    window.history.pushState({}, "", "/waivers");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });

  it("U. Dashboard remains reachable", async () => {
    window.history.pushState({}, "", "/waivers");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
  });
});
