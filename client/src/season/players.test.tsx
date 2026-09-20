import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { PlayerIntelligence } from "../api/types";
import { PlayersPage } from "./PlayersPage";
import type { PlayersPageData } from "./loadPlayers";

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
  loadPlayers: vi.fn(async () => playersData()),
}));

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

function intel(
  partial: Omit<Partial<PlayerIntelligence>, "leagueState" | "identity" | "player"> & {
    name: string;
    key: string;
    identity?: Partial<PlayerIntelligence["identity"]>;
    player?: Partial<PlayerIntelligence["player"]>;
    leagueState?: Partial<PlayerIntelligence["leagueState"]>;
  },
): PlayerIntelligence {
  return {
    identity: {
      yahooPlayerKey: partial.key,
      status: partial.identity?.status ?? "matched",
      method: partial.identity?.method ?? "external_id",
    },
    player: {
      name: partial.name,
      team: partial.player?.team ?? "KC",
      position: partial.player?.position ?? "RB",
    },
    leagueState: {
      availability: partial.leagueState?.availability ?? "free_agent",
      rosterSlot: partial.leagueState?.rosterSlot,
      byeWeek: partial.leagueState?.byeWeek,
      percentOwned: partial.leagueState?.percentOwned,
    },
    weekly: partial.weekly,
    restOfSeason: partial.restOfSeason,
    injury: partial.injury,
    provenance: partial.provenance,
    freshness: partial.freshness,
    warnings: partial.warnings ?? [],
  };
}

function playersData(overrides: Partial<PlayersPageData> = {}): PlayersPageData {
  return {
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    players: [
      intel({
        key: "r1",
        name: "Rex Calder",
        player: { name: "Rex Calder", position: "QB", team: "BUF" },
        leagueState: { availability: "rostered_by_user", rosterSlot: "QB", byeWeek: 12, percentOwned: 99 },
        weekly: { week: 2, projectedPoints: 22.4, ecr: 8 },
        restOfSeason: { projectedPoints: 301.2, ecr: 10 },
        provenance: {
          yahoo: true,
          fantasyPros: true,
          fields: {
            availability: { provider: "yahoo" },
            weeklyProjection: { provider: "fantasypros" },
          },
        },
      }),
      intel({
        key: "o1",
        name: "Wynn OConnell",
        player: { name: "Wynn OConnell", position: "TE", team: "WAS" },
        leagueState: { availability: "rostered_by_other", percentOwned: 67, byeWeek: 14 },
        weekly: { projectedPoints: 6.2, ecr: 22 },
        restOfSeason: { projectedPoints: 80, ecr: 18 },
      }),
      intel({
        key: "w1",
        name: "Remy Holt",
        player: { name: "Remy Holt", position: "WR", team: "TB" },
        leagueState: { availability: "waivers", percentOwned: 12 },
        weekly: { projectedPoints: 8.1, ecr: 40 },
      }),
      intel({
        key: "f1",
        name: "Nico Vale",
        player: { name: "Nico Vale", position: "RB", team: "CHI" },
        leagueState: { availability: "free_agent", percentOwned: 4.2 },
        weekly: { projectedPoints: 11, ecr: 30 },
        restOfSeason: { projectedPoints: 140, ecr: 28 },
      }),
      intel({
        key: "u1",
        name: "Unresolved TE",
        player: { name: "Unresolved TE", position: "TE", team: "BAL" },
        identity: { yahooPlayerKey: "u1", status: "unresolved", method: "none" },
        leagueState: { availability: "rostered_by_user" },
        weekly: { projectedPoints: 99, ecr: 1 },
        restOfSeason: { projectedPoints: 99, ecr: 1 },
        injury: { status: "Out" },
        warnings: ["FantasyPros intelligence unavailable because player identity is unresolved."],
      }),
      intel({
        key: "a1",
        name: "Harper Dillon",
        player: { name: "Harper Dillon", position: "RB", team: "NYG" },
        identity: { yahooPlayerKey: "a1", status: "ambiguous", method: "name_team" },
        leagueState: { availability: "rostered_by_user" },
        weekly: { projectedPoints: 88, ecr: 2 },
        warnings: ["FantasyPros intelligence withheld because player identity is ambiguous."],
      }),
      intel({
        key: "i1",
        name: "Theo Banks",
        player: { name: "Theo Banks", position: "RB", team: "ATL" },
        leagueState: { availability: "rostered_by_user" },
        weekly: { projectedPoints: 13.2, ecr: 24 },
        injury: { status: "IR", practiceStatus: "Out", description: "Knee" },
      }),
      intel({
        key: "z1",
        name: "Zero Proj",
        player: { name: "Zero Proj", position: "RB", team: "DET" },
        leagueState: { availability: "free_agent", percentOwned: 0 },
        weekly: { projectedPoints: 0, ecr: 55 },
      }),
      intel({
        key: "m1",
        name: "Missing Fields",
        player: { name: "Missing Fields", position: "WR", team: "SEA" },
        leagueState: { availability: "free_agent" },
      }),
    ],
    ...overrides,
  };
}

function renderPage(data: PlayersPageData = playersData()) {
  return render(<PlayersPage navigate={() => undefined} load={() => Promise.resolve(data)} />);
}

function resultNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.querySelector(".player-name")?.textContent ?? "");
}

describe("players", () => {
  it("A. /players renders", async () => {
    window.history.pushState({}, "", "/players");
    render(<App />);
    expect(await screen.findByTestId("players")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Players" })).toBeTruthy();
  });

  it("B. search renders", async () => {
    renderPage();
    await screen.findByTestId("players");
    expect(screen.getByRole("searchbox")).toBeTruthy();
  });

  it("C. player results render", async () => {
    renderPage();
    await screen.findByTestId("players");
    expect(screen.getByRole("heading", { name: "Player results" })).toBeTruthy();
    expect(screen.getByText("Rex Calder")).toBeTruthy();
  });

  it("D. player name search", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Nico Vale" } });
    expect(resultNames()).toEqual(["Nico Vale"]);
  });

  it("E. partial-name search", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vale" } });
    expect(resultNames()).toEqual(["Nico Vale"]);
  });

  it("F. NFL team search", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "BUF" } });
    expect(resultNames()).toEqual(["Rex Calder"]);
  });

  it("G. position search", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "QB" } });
    expect(resultNames()).toEqual(["Rex Calder"]);
  });

  it("H. position filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "TE" } });
    expect(resultNames().sort()).toEqual(["Unresolved TE", "Wynn OConnell"].sort());
  });

  it("I. My Team status filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("League status"), { target: { value: "rostered_by_user" } });
    expect(resultNames()).toContain("Rex Calder");
    expect(resultNames()).not.toContain("Nico Vale");
  });

  it("J. Other Team filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("League status"), { target: { value: "rostered_by_other" } });
    expect(resultNames()).toEqual(["Wynn OConnell"]);
  });

  it("K. Waivers filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("League status"), { target: { value: "waivers" } });
    expect(resultNames()).toEqual(["Remy Holt"]);
  });

  it("L. Free Agent filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("League status"), { target: { value: "free_agent" } });
    expect(resultNames()).toContain("Nico Vale");
    expect(resultNames()).not.toContain("Rex Calder");
  });

  it("M. enriched filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("Data status"), { target: { value: "matched" } });
    expect(resultNames()).toContain("Rex Calder");
    expect(resultNames()).not.toContain("Unresolved TE");
    expect(resultNames()).not.toContain("Harper Dillon");
  });

  it("N. unresolved filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("Data status"), { target: { value: "unresolved" } });
    expect(resultNames()).toEqual(["Unresolved TE"]);
  });

  it("O. ambiguous filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("Data status"), { target: { value: "ambiguous" } });
    expect(resultNames()).toEqual(["Harper Dillon"]);
  });

  it("P. injury filter", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByLabelText("Injury"), { target: { value: "flagged" } });
    expect(resultNames()).toEqual(["Theo Banks"]);
  });

  it("Q. clear filters", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vale" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(resultNames().length).toBeGreaterThan(1);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("R. default ordering is deterministic/non-evaluative", async () => {
    renderPage();
    await screen.findByTestId("players");
    expect(resultNames()[0]).toBe("Harper Dillon");
    expect(resultNames()).toEqual([...resultNames()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  });

  it("S. filters do not create recommendation ranking", async () => {
    renderPage();
    const page = await screen.findByTestId("players");
    expect(page.textContent).not.toMatch(/Co-Pilot Rank|Player Score|Player Grade/);
  });

  it("T/U/V/W. weekly and ROS values render", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Rex Calder").closest("tr");
    const cells = within(row as HTMLElement).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toContain("22.4");
    expect(cells).toContain("8");
    expect(cells).toContain("301.2");
    expect(cells).toContain("10");
  });

  it("X. missing numeric field displays —", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Missing Fields").closest("tr");
    expect(row?.textContent).toMatch(/—/);
  });

  it("Y. explicit zero remains 0", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Zero Proj").closest("tr");
    expect(within(row as HTMLElement).getAllByText("0").length).toBeGreaterThan(0);
  });

  it("Z. missing injury is not Healthy", async () => {
    renderPage();
    const page = await screen.findByTestId("players");
    expect(page.textContent).not.toMatch(/Healthy/);
  });

  it("AA. explicit injury displays", async () => {
    renderPage();
    expect(await screen.findByText("IR")).toBeTruthy();
  });

  it("AB. bye week displays", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Rex Calder").closest("tr");
    expect(row?.textContent).toMatch(/12/);
  });

  it("AC. league status labels correct", async () => {
    renderPage();
    await screen.findByTestId("players");
    expect(screen.getAllByText("My Team").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Other Team").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Waivers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free Agent").length).toBeGreaterThan(0);
  });

  it("AD. Yahoo availability not overridden by FP data", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Wynn OConnell").closest("tr");
    expect(row?.textContent).toMatch(/Other Team/);
    expect(row?.textContent).not.toMatch(/Free Agent/);
  });

  it("AE. matched identity shows FP intelligence", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Rex Calder").closest("tr");
    expect(row?.textContent).toMatch(/22\.4/);
  });

  it("AF. unresolved identity withholds FP intelligence", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Unresolved TE").closest("tr");
    expect(row?.textContent).toMatch(/—/);
    expect(row?.textContent).not.toMatch(/99/);
  });

  it("AG. ambiguous identity withholds FP intelligence", async () => {
    renderPage();
    await screen.findByTestId("players");
    const row = screen.getByText("Harper Dillon").closest("tr");
    expect(row?.textContent).not.toMatch(/88/);
  });

  it("AH/AI. details open with player-name heading", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Rex Calder").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    expect(screen.getByRole("heading", { name: "Rex Calder" })).toBeTruthy();
  });

  it("AJ/AK/AL/AM. detail sections render", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Theo Banks").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    expect(screen.getByRole("heading", { name: "This week" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rest of season" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Health" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Data / identity" })).toBeTruthy();
  });

  it("AN. warnings render", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Unresolved TE").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    expect(screen.getByText("FantasyPros intelligence unavailable because player identity is unresolved.")).toBeTruthy();
  });

  it("AO. ownership renders if supplied", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Wynn OConnell").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    expect(screen.getByText("67% rostered")).toBeTruthy();
  });

  it("AP. provenance renders if implemented", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Rex Calder").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    expect(screen.getByRole("heading", { name: "Provenance" })).toBeTruthy();
    expect(screen.getAllByText("League status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Yahoo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FantasyPros").length).toBeGreaterThan(0);
  });

  it("AQ. My Team navigation appears appropriately", async () => {
    const navigate = vi.fn();
    render(<PlayersPage navigate={navigate} load={() => Promise.resolve(playersData())} />);
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Rex Calder").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    fireEvent.click(screen.getByRole("link", { name: "View My Team" }));
    expect(navigate).toHaveBeenCalledWith("/team");
  });

  it("AR. Waiver navigation appears appropriately", async () => {
    const navigate = vi.fn();
    render(<PlayersPage navigate={navigate} load={() => Promise.resolve(playersData())} />);
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Nico Vale").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    fireEvent.click(screen.getByRole("link", { name: "View Waiver Wire" }));
    expect(navigate).toHaveBeenCalledWith("/waivers");
  });

  it("AS. Other Team does not show waiver action", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.click(within(screen.getByText("Wynn OConnell").closest("tr") as HTMLElement).getByRole("button", { name: "View details" }));
    expect(screen.queryByRole("link", { name: "View Waiver Wire" })).toBeNull();
  });

  it("AT/AU/AV/AW. no transaction, trade, start/sit, or score", async () => {
    renderPage();
    const page = await screen.findByTestId("players");
    expect(screen.queryByRole("button", { name: /add|claim|drop|trade|start player|bench player/i })).toBeNull();
    expect(page.textContent).not.toMatch(/Recommended pickup|Must add|Sleeper|Buy|Sell|Hold|Co-Pilot Player Score|Player Grade/);
    expect(page.textContent).not.toMatch(/Start \/ Sit advice/);
  });

  it("AX. fixture state visible", async () => {
    renderPage();
    await screen.findByTestId("players");
    expect(screen.getAllByText("Fixture data").length).toBeGreaterThan(0);
  });

  it("AY. no-search-results state", async () => {
    renderPage();
    await screen.findByTestId("players");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz-no-match" } });
    expect(screen.getByText("No players match the current search and filters.")).toBeTruthy();
  });
});

describe("players routing", () => {
  it("AZ. Dashboard remains reachable", async () => {
    window.history.pushState({}, "", "/players");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
  });

  it("BA. My Team remains reachable", async () => {
    window.history.pushState({}, "", "/players");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "My Team" }));
    expect(await screen.findByTestId("my-team")).toBeTruthy();
  });

  it("BB. Waiver Wire remains reachable", async () => {
    window.history.pushState({}, "", "/players");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Waiver Wire" }));
    expect(await screen.findByTestId("waiver-wire")).toBeTruthy();
  });

  it("BC. Start/Sit remains reachable", async () => {
    window.history.pushState({}, "", "/players");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Start / Sit" }));
    expect(await screen.findByTestId("start-sit")).toBeTruthy();
  });

  it("BD. Draft Room remains reachable", async () => {
    window.history.pushState({}, "", "/players");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });
});
