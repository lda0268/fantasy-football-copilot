import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { StartSitAssignment, StartSitLineupPlayer, StartSitResult } from "../api/types";
import { StartSitPage } from "./StartSitPage";
import type { StartSitPageData } from "./loadStartSit";

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
  loadLeague: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [],
    standings: [],
    matchups: [],
    settings: {},
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
  loadStartSit: vi.fn(async () => startSitPage()),
}));

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

function player(partial: Partial<StartSitLineupPlayer> & { name: string; key: string }): StartSitLineupPlayer {
  return {
    yahooPlayerKey: partial.key,
    name: partial.name,
    team: partial.team,
    position: partial.position,
    yahooPositions: partial.yahooPositions ?? (partial.position ? [partial.position] : []),
    identityStatus: partial.identityStatus ?? "matched",
    currentSlot: partial.currentSlot,
    weeklyProjectedPoints: partial.weeklyProjectedPoints,
    weeklyEcr: partial.weeklyEcr,
    dataQuality: partial.dataQuality ?? "limited",
    injuryStatus: partial.injuryStatus,
    warnings: partial.warnings ?? [],
  };
}

function assignment(position: string, index: number, lineupPlayer?: StartSitLineupPlayer): StartSitAssignment {
  return { slot: { id: `${position}-${index}`, position, index }, player: lineupPlayer };
}

const rex = player({ key: "qb1", name: "Rex Calder", position: "QB", team: "BUF", weeklyProjectedPoints: 22.4, weeklyEcr: 8, dataQuality: "strongly_supported" });
const nash = player({ key: "wr1", name: "Nash Ellison", position: "WR", team: "MIA", weeklyProjectedPoints: 14.1, weeklyEcr: 22, dataQuality: "supported", injuryStatus: "Questionable" });
const priya = player({ key: "wr2", name: "Priya Cole", position: "WR", team: "CIN", weeklyProjectedPoints: 13.2, weeklyEcr: 31, dataQuality: "supported" });
const milo = player({ key: "rb1", name: "Milo Grant", position: "RB", team: "KC", weeklyProjectedPoints: 16.4, weeklyEcr: 12, dataQuality: "strongly_supported" });
const theo = player({ key: "rb2", name: "Theo Banks", position: "RB", team: "CHI", weeklyProjectedPoints: 13.2, weeklyEcr: 18, dataQuality: "supported", injuryStatus: "IR" });
const harper = player({
  key: "rb3",
  name: "Harper Dillon",
  position: "RB",
  team: "NYG",
  identityStatus: "ambiguous",
  dataQuality: "limited",
  warnings: ["Ambiguous identity: FantasyPros intelligence is not attached."],
});
const ellis = player({ key: "te1", name: "Ellis Ward", position: "TE", team: "BAL", weeklyProjectedPoints: 9.8, weeklyEcr: 14, dataQuality: "strongly_supported" });
const devon = player({ key: "wr3", name: "Devon Hart", position: "WR", team: "GB", weeklyProjectedPoints: 11.1, weeklyEcr: 40, dataQuality: "supported" });
const jonah = player({ key: "k1", name: "Jonah Pike", position: "K", team: "DAL", weeklyProjectedPoints: 8.2, weeklyEcr: 9, dataQuality: "supported" });
const harbor = player({ key: "def1", name: "Harbor City", position: "DEF", team: "SF", weeklyProjectedPoints: 10.6, weeklyEcr: 7, dataQuality: "supported" });
const zeroBench = player({ key: "bn1", name: "Zero Proj", position: "RB", team: "DET", weeklyProjectedPoints: 0, weeklyEcr: 55, dataQuality: "supported" });
const missingEcr = player({ key: "bn2", name: "Missing Ecr", position: "WR", team: "SEA", weeklyProjectedPoints: 4.1, dataQuality: "limited" });
const unresolved = player({
  key: "bn3",
  name: "Unresolved TE",
  position: "TE",
  team: "BAL",
  identityStatus: "unresolved",
  dataQuality: "limited",
  warnings: ["Unresolved identity: FantasyPros intelligence is not attached."],
});
const irPlayer = player({ key: "ir1", name: "Quinn Mercer", position: "WR", team: "GB", injuryStatus: "IR", dataQuality: "limited" });

const currentLineup = [
  assignment("QB", 0, rex),
  assignment("WR", 0, nash),
  assignment("WR", 1, priya),
  assignment("RB", 0, milo),
  assignment("RB", 1, theo),
  assignment("TE", 0, ellis),
  assignment("FLEX", 0, devon),
  assignment("K", 0, jonah),
  assignment("DEF", 0, harbor),
];

const recommendedLineup = currentLineup.map((row, index) => (index === 4 ? assignment("RB", 1, harper) : row));

function result(overrides: Partial<StartSitResult> = {}): StartSitResult {
  return {
    context: {
      week: 2,
      scoringFormat: "half_ppr",
      providerModes: { yahoo: "fixture", fantasyPros: "fixture" },
      lineupSource: "fixture",
    },
    summary: {
      rosterPlayers: 13,
      startingSlots: 9,
      proposedChanges: 1,
      reviewRequired: 1,
      currentProjection: { points: 119, projectedSlots: 9, totalSlots: 9, complete: true },
      recommendedProjection: { points: 105.8, projectedSlots: 8, totalSlots: 9, complete: false },
      message: "1 recommended lineup change.",
    },
    currentLineup,
    recommendedLineup,
    moves: [
      {
        type: "swap",
        slot: "RB",
        slotId: "RB-1",
        startPlayer: harper,
        sitPlayer: theo,
        weeklyValue: {},
        reasons: ["Theo Banks is listed as IR and is not recommended to start."],
        warnings: ["Replacement has limited weekly intelligence."],
      },
    ],
    reviewRequired: [
      {
        slot: "FLEX",
        slotId: "FLEX-0",
        currentPlayer: devon,
        candidatePlayer: missingEcr,
        reason: "Insufficient weekly intelligence to compare these players.",
      },
    ],
    bench: [zeroBench, missingEcr, unresolved],
    ir: [irPlayer],
    lineupSettings: [
      { position: "QB", count: 1 },
      { position: "WR", count: 2 },
      { position: "RB", count: 2 },
      { position: "TE", count: 1 },
      { position: "FLEX", count: 1 },
      { position: "K", count: 1 },
      { position: "DEF", count: 1 },
    ],
    ...overrides,
  };
}

function startSitPage(overrides: Partial<StartSitPageData> = {}): StartSitPageData {
  return {
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    recommendation: result(),
    ...overrides,
  };
}

function renderPage(data: StartSitPageData = startSitPage()) {
  return render(<StartSitPage load={() => Promise.resolve(data)} />);
}

function columnNames(heading: string): string[] {
  const headingNode = screen.getByRole("heading", { name: heading });
  const column = headingNode.closest("section");
  if (!column) {
    return [];
  }
  return within(column as HTMLElement)
    .getAllByRole("button")
    .map((node) => node.textContent ?? "");
}

describe("start / sit", () => {
  it("A. /start-sit renders", async () => {
    window.history.pushState({}, "", "/start-sit");
    render(<App />);
    expect(await screen.findByTestId("start-sit")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Start / Sit" })).toBeTruthy();
  });

  it("B. week displays", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getAllByText("Week").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("C. starting-slot count displays", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getByText("Starting slots")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("D. proposed-change count displays", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getAllByText("Recommended changes").length).toBeGreaterThan(0);
    const summary = screen.getByRole("heading", { name: "Weekly lineup summary" }).parentElement;
    expect(summary?.textContent).toMatch(/1\s*Recommended changes/);
  });

  it("E. current lineup renders", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getByRole("heading", { name: "Current lineup" })).toBeTruthy();
    expect(columnNames("Current lineup")).toContain("Theo Banks");
  });

  it("F. recommended lineup renders", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getByRole("heading", { name: "Recommended lineup" })).toBeTruthy();
    expect(columnNames("Recommended lineup")).toContain("Harper Dillon");
  });

  it("G. backend slot order preserved", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const current = screen.getByRole("heading", { name: "Current lineup" }).closest("section");
    const slots = within(current as HTMLElement)
      .getAllByText(/^(QB|WR|RB|TE|FLEX|K|DEF)$/)
      .map((node) => node.textContent);
    expect(slots).toEqual(["QB", "WR", "WR", "RB", "RB", "TE", "FLEX", "K", "DEF"]);
  });

  it("H. move start player renders", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const moves = screen.getByRole("heading", { name: "Recommended changes" }).parentElement;
    expect(moves?.textContent).toMatch(/Start\s*Harper Dillon/);
  });

  it("I. move sit player renders", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const moves = screen.getByRole("heading", { name: "Recommended changes" }).parentElement;
    expect(moves?.textContent).toMatch(/Sit\s*Theo Banks/);
  });

  it("J. backend reason renders", async () => {
    renderPage();
    expect(await screen.findByText("Theo Banks is listed as IR and is not recommended to start.")).toBeTruthy();
  });

  it("K. backend warning renders", async () => {
    renderPage();
    expect(await screen.findByText("Replacement has limited weekly intelligence.")).toBeTruthy();
  });

  it("L. supplied projected delta renders", async () => {
    renderPage(
      startSitPage({
        recommendation: result({
          moves: [
            {
              type: "swap",
              slot: "RB",
              slotId: "RB-1",
              startPlayer: harper,
              sitPlayer: theo,
              weeklyValue: {},
              projectedPointsDelta: 3.8,
              reasons: ["Theo Banks is listed as IR and is not recommended to start."],
              warnings: [],
            },
          ],
        }),
      }),
    );
    expect(await screen.findByText("Projected impact +3.8 pts")).toBeTruthy();
  });

  it("M. missing projected delta does not become zero", async () => {
    renderPage();
    const page = await screen.findByTestId("start-sit");
    expect(page.textContent).not.toMatch(/Projected impact 0/);
    expect(page.textContent).not.toMatch(/\+0 pts|−0 pts/);
  });

  it("N. complete projection total renders normally", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const current = screen.getByRole("heading", { name: "Current projection" }).parentElement;
    expect(current?.textContent).toMatch(/119/);
    expect(current?.textContent).not.toMatch(/Incomplete projection/);
  });

  it("O. incomplete projection shows completeness", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const recommended = screen.getByRole("heading", { name: "Recommended known projection" }).parentElement;
    expect(recommended?.textContent).toMatch(/105\.8/);
    expect(recommended?.textContent).toMatch(/known pts/);
    expect(recommended?.textContent).toMatch(/8 of 9 projected/);
    expect(recommended?.textContent).toMatch(/Incomplete projection/);
  });

  it("P. incomplete recommended projection is not shown as a negative comparison", async () => {
    renderPage();
    const page = await screen.findByTestId("start-sit");
    expect(page.textContent).toMatch(/not directly comparable/);
    expect(page.textContent).not.toMatch(/−13/);
    expect(page.textContent).not.toMatch(/worse/);
    expect(page.querySelector(".projection-card.is-incomplete")?.className).not.toMatch(/danger|negative/);
  });

  it("Q. missing projection displays —", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getAllByText("Harper Dillon").length).toBeGreaterThan(0);
    const recommended = screen.getByRole("heading", { name: "Recommended lineup" }).closest("section");
    expect(recommended?.textContent).toMatch(/Wk —/);
  });

  it("R. explicit zero displays 0", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const bench = screen.getByRole("heading", { name: "Bench" }).parentElement;
    expect(bench?.textContent).toMatch(/Zero Proj/);
    expect(within(bench as HTMLElement).getAllByText("0").length).toBeGreaterThan(0);
  });

  it("S. missing ECR displays —", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const bench = screen.getByRole("heading", { name: "Bench" }).parentElement as HTMLElement;
    const row = within(bench)
      .getAllByRole("row")
      .find((item) => item.textContent?.includes("Missing Ecr"));
    expect(row?.textContent).toMatch(/—/);
  });

  it("T. missing injury is not Healthy", async () => {
    renderPage();
    const page = await screen.findByTestId("start-sit");
    expect(page.textContent).not.toMatch(/Healthy/);
  });

  it("U. explicit IR displays", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getAllByText("IR").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "IR / Inactive" })).toBeTruthy();
    expect(screen.getByText("Quinn Mercer")).toBeTruthy();
  });

  it("V. Questionable displays", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getAllByText(/Questionable/).length).toBeGreaterThan(0);
  });

  it("W. reviewRequired renders", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Review required" })).toBeTruthy();
    expect(screen.getByText(/does not have enough comparable weekly information/)).toBeTruthy();
    expect(screen.getByText("Insufficient weekly intelligence to compare these players.")).toBeTruthy();
  });

  it("X. frontend does not resolve reviewRequired", async () => {
    renderPage();
    const review = (await screen.findByRole("heading", { name: "Review required" })).parentElement;
    expect(review?.textContent).toMatch(/Current: Devon Hart/);
    expect(review?.textContent).toMatch(/Candidate: Missing Ecr/);
    expect(review?.querySelector("button")).toBeNull();
  });

  it("Y. unresolved player remains visible", async () => {
    renderPage();
    expect(await screen.findByText("Unresolved TE")).toBeTruthy();
    expect(screen.getAllByText("Limited intelligence").length).toBeGreaterThan(0);
  });

  it("Z. ambiguous player remains visible", async () => {
    renderPage();
    expect((await screen.findAllByText("Harper Dillon")).length).toBeGreaterThan(0);
    const recommended = screen.getByRole("heading", { name: "Recommended lineup" }).closest("section");
    expect(recommended?.textContent).toMatch(/Limited intelligence/);
  });

  it("AA. bench renders", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getByRole("heading", { name: "Bench" })).toBeTruthy();
    expect(screen.getByText("Zero Proj")).toBeTruthy();
  });

  it("AB. bench order preserved", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    const bench = screen.getByRole("heading", { name: "Bench" }).parentElement as HTMLElement;
    const names = within(bench)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("button").textContent);
    expect(names).toEqual(["Zero Proj", "Missing Ecr", "Unresolved TE"]);
  });

  it("AC. IR section renders", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "IR / Inactive" })).toBeTruthy();
  });

  it("AD. no-change state renders", async () => {
    renderPage(
      startSitPage({
        recommendation: result({
          moves: [],
          reviewRequired: [],
          summary: {
            rosterPlayers: 13,
            startingSlots: 9,
            proposedChanges: 0,
            reviewRequired: 0,
            currentProjection: { points: 119, projectedSlots: 9, totalSlots: 9, complete: true },
            recommendedProjection: { points: 119, projectedSlots: 9, totalSlots: 9, complete: true },
            message: "Current lineup already matches the recommended lineup.",
          },
        }),
      }),
    );
    expect(await screen.findByText("Your current lineup already matches the recommended lineup.")).toBeTruthy();
  });

  it("AE. changed slot is textually identifiable", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getByText("Change")).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
  });

  it("AF. fixture state visible", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.getAllByText("Fixture data").length).toBeGreaterThan(0);
  });

  it("AG. lineup settings render if exposed", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    fireEvent.click(screen.getByRole("button", { name: "League lineup" }));
    expect(screen.getByText("QB ×1")).toBeTruthy();
    expect(screen.getByText("WR ×2")).toBeTruthy();
    expect(screen.getByText("FLEX ×1")).toBeTruthy();
  });

  it("AH. no transaction/apply button exists", async () => {
    renderPage();
    await screen.findByTestId("start-sit");
    expect(screen.queryByRole("button", { name: /apply|save lineup|submit|start player|bench player|confirm change/i })).toBeNull();
    expect(screen.getByText("Read-only recommendations")).toBeTruthy();
  });
});

describe("start / sit routing", () => {
  it("AI. Dashboard remains reachable", async () => {
    window.history.pushState({}, "", "/start-sit");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
  });

  it("AJ. My Team remains reachable", async () => {
    window.history.pushState({}, "", "/start-sit");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "My Team" }));
    expect(await screen.findByTestId("my-team")).toBeTruthy();
  });

  it("AK. Waiver Wire remains reachable", async () => {
    window.history.pushState({}, "", "/start-sit");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Waiver Wire" }));
    expect(await screen.findByTestId("waiver-wire")).toBeTruthy();
  });

  it("AL. Draft Room remains reachable", async () => {
    window.history.pushState({}, "", "/start-sit");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });
});
