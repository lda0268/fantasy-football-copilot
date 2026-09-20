import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { PlayerIntelligence } from "../api/types";
import { MyTeamPage } from "./MyTeamPage";
import type { MyTeamData } from "./loadMyTeam";

vi.mock("./loadDashboard", () => ({
  loadDashboard: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
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

vi.mock("./loadWaiverWire", () => ({
  loadWaiverWire: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    recommendations: {
      context: { week: 2, scoringFormat: "half_ppr", providerModes: { yahoo: "fixture", fantasyPros: "fixture" } },
      summary: { candidatesConsidered: 1, eligible: 1, recommendationsReturned: 0 },
      recommendations: [],
    },
  })),
}));

vi.mock("./loadMyTeam", () => ({
  loadMyTeam: vi.fn(async () => teamData()),
}));

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

function intel(partial: Omit<Partial<PlayerIntelligence>, "leagueState"> & {
  name: string;
  key: string;
  leagueState?: Partial<PlayerIntelligence["leagueState"]>;
}): PlayerIntelligence {
  return {
    identity: { yahooPlayerKey: partial.key, status: partial.identity?.status ?? "matched", method: partial.identity?.method },
    player: { name: partial.name, team: partial.player?.team ?? "KC", position: partial.player?.position ?? "RB" },
    leagueState: {
      availability: "rostered_by_user",
      rosterSlot: partial.leagueState?.rosterSlot ?? "RB",
      byeWeek: partial.leagueState?.byeWeek,
    },
    weekly: partial.weekly,
    restOfSeason: partial.restOfSeason,
    injury: partial.injury,
    warnings: partial.warnings ?? [],
  };
}

function teamData(overrides: Partial<MyTeamData> = {}): MyTeamData {
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
        { teamKey: "T1", teamId: "1", name: "Co-Pilot Test Team" },
        { teamKey: "T2", teamId: "2", name: "Fourth Down Labs" },
      ],
    },
    intelligence: [
      intel({
        key: "r1",
        name: "Rex Calder",
        player: { name: "Rex Calder", position: "QB", team: "BUF" },
        leagueState: { rosterSlot: "QB", byeWeek: 12 },
        weekly: { week: 2, projectedPoints: 22.4, ecr: 8 },
        restOfSeason: { projectedPoints: 301.2, ecr: 10 },
        identity: { yahooPlayerKey: "r1", status: "matched", method: "external_id" },
      }),
      intel({
        key: "r2",
        name: "Zero Proj",
        player: { name: "Zero Proj", position: "RB", team: "DET" },
        leagueState: { rosterSlot: "BN" },
        weekly: { projectedPoints: 0, ecr: 40 },
      }),
      intel({
        key: "r3",
        name: "Missing Proj",
        player: { name: "Missing Proj", position: "WR", team: "CIN" },
        leagueState: { rosterSlot: "WR" },
      }),
      intel({
        key: "r4",
        name: "Quinn Mercer",
        player: { name: "Quinn Mercer", position: "WR", team: "GB" },
        leagueState: { rosterSlot: "IR" },
        injury: { status: "Questionable", practiceStatus: "Limited", description: "Ankle" },
      }),
      intel({
        key: "r5",
        name: "Unresolved TE",
        player: { name: "Unresolved TE", position: "TE", team: "BAL" },
        leagueState: { rosterSlot: "BN" },
        identity: { yahooPlayerKey: "r5", status: "unresolved", method: "none" },
        weekly: { projectedPoints: 99, ecr: 1 },
        restOfSeason: { projectedPoints: 99, ecr: 1 },
        injury: { status: "Out" },
        warnings: ["FantasyPros intelligence unavailable because player identity is unresolved."],
      }),
      intel({
        key: "r6",
        name: "Ambiguous K",
        player: { name: "Ambiguous K", position: "K", team: "JAX" },
        leagueState: { rosterSlot: "K" },
        identity: { yahooPlayerKey: "r6", status: "ambiguous", method: "name_team" },
        weekly: { projectedPoints: 88, ecr: 2 },
        warnings: ["FantasyPros intelligence withheld because player identity is ambiguous."],
      }),
    ],
    recommendations: {
      context: { week: 2, scoringFormat: "half_ppr", providerModes: { yahoo: "fixture", fantasyPros: "fixture" } },
      summary: { candidatesConsidered: 10, eligible: 2, recommendationsReturned: 2 },
      rosterNeeds: [{ position: "K", severity: "medium", reasons: ["Only one healthy usable K is on the roster."] }],
      vulnerabilities: [{ type: "thin_depth", position: "K", severity: "medium", reason: "Only one healthy usable K is on the roster." }],
      recommendations: [],
    },
    ...overrides,
  };
}

function namesInTable(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1]?.querySelector(".player-name")?.textContent ?? "");
}

describe("my team", () => {
  it("A. My Team route renders", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    expect(await screen.findByTestId("my-team")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "My Team" })).toBeTruthy();
  });

  it("B/C. full roster renders in Yahoo slot groups", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    expect(namesInTable()).toEqual([
      "Rex Calder",
      "Missing Proj",
      "Ambiguous K",
      "Zero Proj",
      "Unresolved TE",
      "Quinn Mercer",
    ]);
  });

  it("D/E/F/G. matched player displays weekly and ROS intelligence", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    const row = within(screen.getByRole("table"))
      .getAllByRole("row")
      .find((item) => item.textContent?.includes("Rex Calder"));
    const cells = row ? within(row).getAllByRole("cell").map((cell) => cell.textContent) : [];
    expect(cells).toContain("22.4");
    expect(cells).toContain("8");
    expect(cells).toContain("301.2");
    expect(cells).toContain("10");
  });

  it("H/I. missing projection is a dash and zero stays zero", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const missing = rows.find((row) => row.textContent?.includes("Missing Proj"));
    const zero = rows.find((row) => row.textContent?.includes("Zero Proj"));
    expect(within(missing!).getAllByRole("cell").some((cell) => cell.textContent === "—")).toBe(true);
    expect(within(zero!).getAllByRole("cell").some((cell) => cell.textContent === "0")).toBe(true);
  });

  it("J/K. missing injury is not Healthy; explicit injury displays", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    const table = screen.getByRole("table");
    expect(table.textContent).not.toMatch(/Healthy/);
    expect(within(table).getByText("Questionable")).toBeTruthy();
  });

  it("L/M. unresolved and ambiguous identities do not display FantasyPros intelligence", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    const unresolved = rows.find((row) => row.textContent?.includes("Unresolved TE"));
    const ambiguous = rows.find((row) => row.textContent?.includes("Ambiguous K"));
    expect(unresolved?.textContent).not.toMatch(/99/);
    expect(unresolved?.textContent).not.toMatch(/Out/);
    expect(ambiguous?.textContent).not.toMatch(/88/);
  });

  it("N. identity presentation labels are correct", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    expect(screen.getAllByText("Enriched").length).toBeGreaterThan(0);
    expect(screen.getByText("Intelligence unavailable")).toBeTruthy();
    expect(screen.getByText("Identity needs review")).toBeTruthy();
  });

  it("O/P. player details open with composed intelligence", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0]!);
    expect(screen.getByRole("heading", { name: "Rex Calder" })).toBeTruthy();
    expect(screen.getByText("Weekly outlook")).toBeTruthy();
    expect(screen.getByText("Yahoo ID match")).toBeTruthy();
    expect(screen.getByText("Weekly + ROS")).toBeTruthy();
  });

  it("Q/R. position filter hides without reordering", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "WR" } });
    expect(namesInTable()).toEqual(["Missing Proj", "Quinn Mercer"]);
  });

  it("S. injury filter", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    fireEvent.change(screen.getByLabelText("Injury"), { target: { value: "flagged" } });
    expect(namesInTable()).toEqual(["Quinn Mercer"]);
  });

  it("T. clear filters", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "QB" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(namesInTable().length).toBe(6);
  });

  it("U. roster needs come from backend", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    expect(screen.getByText("Moderate Need")).toBeTruthy();
    expect(screen.getByText("Only one healthy usable K is on the roster.")).toBeTruthy();
  });

  it("V. Explore Waiver Wire navigates to /waivers", async () => {
    const navigate = vi.fn();
    render(<MyTeamPage navigate={navigate} load={() => Promise.resolve(teamData())} />);
    await screen.findByTestId("my-team");
    fireEvent.click(screen.getByRole("link", { name: "Explore Waiver Wire" }));
    expect(navigate).toHaveBeenCalledWith("/waivers");
  });

  it("W/X. no Start/Sit or trade recommendations", async () => {
    render(<MyTeamPage navigate={() => undefined} load={() => Promise.resolve(teamData())} />);
    const page = await screen.findByTestId("my-team");
    expect(page.textContent).not.toMatch(/\bStart\b/);
    expect(page.textContent).not.toMatch(/\bSit\b/);
    expect(page.textContent).not.toMatch(/Sell high|Buy low|Trade value|\bTrade\b/);
  });
});

describe("my team routing", () => {
  it("Y. Dashboard remains reachable", async () => {
    window.history.pushState({}, "", "/team");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
  });

  it("Z. Waiver Wire remains reachable", async () => {
    window.history.pushState({}, "", "/team");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Waiver Wire" }));
    expect(await screen.findByTestId("waiver-wire")).toBeTruthy();
  });

  it("AA. Draft Room remains reachable", async () => {
    window.history.pushState({}, "", "/team");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });
});
