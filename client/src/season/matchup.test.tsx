import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import App from "../App";
import type { MatchupIntelligence, MatchupPlayerView, MatchupSide, MatchupSlotRow, StartSitResult } from "../api/types";
import { MatchupPage } from "./MatchupPage";
import type { MatchupPageData } from "./loadMatchup";

vi.mock("./loadDashboard", () => ({
  loadDashboard: vi.fn(async () => ({
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    team: { teamKey: "t.1", teamId: "1", name: "Co-Pilot Test Team", leagueKey: "L1" },
    standings: [],
    matchup: {
      week: 2,
      teams: [
        { teamKey: "t.1", teamId: "1", name: "Co-Pilot Test Team", points: 87.42, projectedPoints: 126.55 },
        { teamKey: "t.2", teamId: "2", name: "Fourth Down Labs", points: 81.18, projectedPoints: 119.2 },
      ],
    },
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

vi.mock("./loadMatchup", () => ({
  loadMatchup: vi.fn(async () => matchupPage()),
}));

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

function player(partial: Partial<MatchupPlayerView> & { name: string; key: string }): MatchupPlayerView {
  const identityStatus = partial.identityStatus ?? "matched";
  const view: MatchupPlayerView = {
    yahooPlayerKey: partial.key,
    name: partial.name,
    weeklyCoverage: partial.weeklyCoverage ?? (identityStatus === "matched" ? "projection+ecr" : "none"),
    weeklyDataLabel:
      partial.weeklyDataLabel ??
      (identityStatus === "unresolved"
        ? "Intelligence unavailable"
        : identityStatus === "ambiguous"
          ? "Identity needs review"
          : "Projection + ECR"),
    identityStatus,
    warnings: partial.warnings ?? [],
  };
  return { ...view, ...partial, yahooPlayerKey: partial.key, name: partial.name };
}

function side(name: string, teamKey: string, overrides: Partial<MatchupSide> = {}): MatchupSide {
  return {
    teamKey,
    teamId: teamKey,
    name,
    points: 42.6,
    yahooProjectedPoints: 110.1,
    summary: {
      knownProjectedPoints: 112.4,
      projectedSlots: 8,
      totalSlots: 9,
      injuryFlags: 1,
      playersWithWeeklyIntelligence: 7,
    },
    bench: [],
    ir: [],
    ...overrides,
  };
}

function slot(id: string, display: string, yahooPosition: string, user?: MatchupPlayerView, opponent?: MatchupPlayerView): MatchupSlotRow {
  return { id, displayPosition: display, yahooPosition, user, opponent };
}

function intelligence(overrides: Partial<MatchupIntelligence> = {}): MatchupIntelligence {
  const userStarters = [
    player({ key: "u-qb", name: "Rex Calder", position: "QB", slot: "QB", team: "BUF", weeklyProjectedPoints: 22.4, weeklyEcr: 8 }),
    player({ key: "u-rb1", name: "Milo Grant", position: "RB", slot: "RB", weeklyProjectedPoints: 16, weeklyEcr: 12 }),
    player({ key: "u-rb2", name: "Theo Banks", position: "RB", slot: "RB", weeklyProjectedPoints: 13.2, weeklyEcr: 24, injuryStatus: "IR" }),
    player({ key: "u-wr1", name: "Nash Ellison", position: "WR", slot: "WR", weeklyProjectedPoints: 15.8, weeklyEcr: 18 }),
    player({ key: "u-wr2", name: "Priya Cole", position: "WR", slot: "WR", weeklyProjectedPoints: 13.25, weeklyEcr: 31 }),
    player({ key: "u-te", name: "Ellis Ward", position: "TE", slot: "TE", weeklyProjectedPoints: 10.8, weeklyEcr: 42 }),
    player({ key: "u-flex", name: "Devon Hart", position: "WR", slot: "W/R/T", weeklyProjectedPoints: 12.05, weeklyEcr: 47 }),
    player({ key: "u-k", name: "Jonah Pike", position: "K", slot: "K", weeklyProjectedPoints: 8.5, weeklyEcr: 14 }),
    player({ key: "u-def", name: "Harbor City", position: "DEF", slot: "DEF", weeklyProjectedPoints: 7, weeklyEcr: 9 }),
  ];
  const oppStarters = [
    player({ key: "o-qb", name: "Nell Voss", position: "QB", slot: "QB", identityStatus: "unresolved", warnings: ["FantasyPros intelligence unavailable because player identity is unresolved."] }),
    player({ key: "o-rb1", name: "Nico Vale", position: "RB", slot: "RB", weeklyProjectedPoints: 10.6, weeklyEcr: 61 }),
    player({
      key: "o-rb2",
      name: "Simone Blake",
      position: "RB",
      slot: "RB",
      weeklyCoverage: "none",
      weeklyDataLabel: "No weekly data",
      injuryStatus: "Questionable",
      practiceStatus: "Limit",
      injuryDescription: "Hamstring",
    }),
    player({ key: "o-wr1", name: "Ellis Prado", position: "WR", slot: "WR", weeklyProjectedPoints: 9.7, weeklyEcr: 54 }),
    player({ key: "o-wr2", name: "Cade Rowan", position: "WR", slot: "WR", identityStatus: "unresolved", warnings: ["unresolved"] }),
    player({ key: "o-te", name: "Wynn O’Connell", position: "TE", slot: "TE", weeklyProjectedPoints: 7.1, weeklyEcr: 16 }),
    player({ key: "o-flex", name: "Omar Voss Jr", position: "TE", slot: "W/R/T", weeklyProjectedPoints: 6.4, weeklyEcr: 22 }),
    player({ key: "o-k", name: "DJ Rowan", position: "K", slot: "K", weeklyProjectedPoints: 8, weeklyEcr: 18 }),
    player({
      key: "o-def",
      name: "Iron Ridge",
      position: "DEF",
      slot: "DEF",
      identityStatus: "ambiguous",
      warnings: ["FantasyPros intelligence withheld because player identity is ambiguous."],
    }),
  ];
  const slots: MatchupSlotRow[] = [
    slot("QB:0", "QB", "QB", userStarters[0], oppStarters[0]),
    slot("RB:0", "RB", "RB", userStarters[1], oppStarters[1]),
    slot("RB:1", "RB", "RB", userStarters[2], oppStarters[2]),
    slot("WR:0", "WR", "WR", userStarters[3], oppStarters[3]),
    slot("WR:1", "WR", "WR", userStarters[4], oppStarters[4]),
    slot("TE:0", "TE", "TE", userStarters[5], oppStarters[5]),
    slot("W/R/T:0", "FLEX", "W/R/T", userStarters[6], oppStarters[6]),
    slot("K:0", "K", "K", userStarters[7], oppStarters[7]),
    slot("DEF:0", "DEF", "DEF", userStarters[8], oppStarters[8]),
  ];
  const user = side("Co-Pilot Test Team", "t.1", {
    points: 87.42,
    yahooProjectedPoints: 126.55,
    summary: { knownProjectedPoints: 118.9, projectedSlots: 9, totalSlots: 9, injuryFlags: 1, playersWithWeeklyIntelligence: 9 },
    bench: [
      player({ key: "u-bn1", name: "Quinn Mercer", position: "WR", slot: "BN", injuryStatus: "Questionable", weeklyProjectedPoints: 8.25 }),
      player({ key: "u-bn2", name: "Harper Dillon", position: "RB", slot: "BN", identityStatus: "ambiguous" }),
    ],
    ir: [player({ key: "u-ir", name: "Maren Solis", position: "WR", slot: "IR", yahooStatus: "IR" })],
  });
  const opponent = side("Fourth Down Labs", "t.2", {
    points: 81.18,
    yahooProjectedPoints: 119.2,
    summary: { knownProjectedPoints: 41.8, projectedSlots: 5, totalSlots: 9, injuryFlags: 1, playersWithWeeklyIntelligence: 5 },
    bench: [
      player({ key: "o-bn1", name: "Ivo Marsh", position: "RB", slot: "BN", identityStatus: "unresolved", yahooStatus: "Out" }),
      player({ key: "o-bn2", name: "Remy Holt", position: "WR", slot: "BN", weeklyProjectedPoints: 0, weeklyEcr: 90 }),
      player({ key: "o-bn3", name: "Joss Hale", position: "QB", slot: "BN", weeklyProjectedPoints: 18.44 }),
    ],
    ir: [player({ key: "o-ir", name: "Pax Irving", position: "WR", slot: "IR", yahooStatus: "IR", identityStatus: "unresolved" })],
  });
  return {
    providers: { yahoo: { mode: "fixture", connected: true }, fantasyPros: { mode: "fixture", configured: true } },
    fantasyProsAvailable: true,
    week: 2,
    league: { leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 },
    matchupPresent: true,
    matchupStatus: "midevent",
    matchupStatusLabel: "In progress",
    user,
    opponent,
    comparison: { slots },
    differences: {
      userKnownProjection: 118.9,
      opponentKnownProjection: 41.8,
      userProjectedSlots: 9,
      opponentProjectedSlots: 5,
      userInjuryFlags: 1,
      opponentInjuryFlags: 1,
      comparable: false,
    },
    availabilityNotes: [
      { teamName: "Co-Pilot Test Team", playerName: "Theo Banks", group: "starter", status: "IR", slot: "RB" },
      { teamName: "Fourth Down Labs", playerName: "Simone Blake", group: "starter", status: "Questionable", slot: "RB" },
      { teamName: "Fourth Down Labs", playerName: "Ivo Marsh", group: "bench", status: "Out", slot: "BN" },
    ],
    ...overrides,
  };
}

function startSit(proposedChanges = 1): StartSitResult {
  return {
    context: { week: 2, scoringFormat: "half_ppr", providerModes: { yahoo: "fixture", fantasyPros: "fixture" }, lineupSource: "fixture" },
    summary: {
      rosterPlayers: 16,
      startingSlots: 9,
      proposedChanges,
      reviewRequired: 0,
      currentProjection: { points: 100, projectedSlots: 9, totalSlots: 9, complete: true },
      recommendedProjection: { points: 105, projectedSlots: 9, totalSlots: 9, complete: true },
      message: "ok",
    },
    currentLineup: [],
    recommendedLineup: [],
    moves: [],
    reviewRequired: [],
    bench: [],
    ir: [],
    lineupSettings: [],
  };
}

function matchupPage(overrides: Partial<MatchupPageData> = {}): MatchupPageData {
  return {
    yahooStatus: { connected: true, fantasyAuthorized: false, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    leagues: [{ leagueKey: "L1", leagueId: "1", name: "Co-Pilot Test League", season: "2026", currentWeek: 2 }],
    matchup: intelligence(),
    startSit: startSit(),
    ...overrides,
  };
}

async function renderMatchup(data: MatchupPageData = matchupPage()) {
  render(<MatchupPage navigate={() => undefined} load={() => Promise.resolve(data)} />);
  return screen.findByTestId("matchup-page");
}

describe("Matchup page", () => {
  it("A. /matchup renders", async () => {
    window.history.pushState({}, "", "/matchup");
    render(<App />);
    expect(await screen.findByTestId("matchup-page")).toBeTruthy();
  });

  it("B/C/D/E/F. week, teams, Yahoo score, and Yahoo projection render", async () => {
    const page = await renderMatchup();
    expect(screen.getByText("Week 2")).toBeTruthy();
    expect(screen.getAllByText("Co-Pilot Test Team").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fourth Down Labs").length).toBeGreaterThan(0);
    expect(page.textContent).toMatch(/87\.4/);
    expect(page.textContent).toMatch(/Yahoo projected score/);
    expect(page.textContent).toMatch(/126\.5/);
  });

  it("G-L. starting lineups, duplicate slots, FLEX, and deterministic alignment", async () => {
    await renderMatchup();
    const rows = document.querySelectorAll(".starting-row");
    expect(rows).toHaveLength(9);
    expect(document.querySelectorAll('[data-slot="WR"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-slot="RB"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-slot="FLEX"]')).toHaveLength(1);
    expect(screen.getByText("Rex Calder")).toBeTruthy();
    expect(screen.getByText("Nell Voss")).toBeTruthy();
    expect(screen.getByText("Devon Hart")).toBeTruthy();
    expect(screen.getByText("Omar Voss Jr")).toBeTruthy();
    expect(rows[0]?.getAttribute("data-slot")).toBe("QB");
    expect(rows[6]?.getAttribute("data-slot")).toBe("FLEX");
  });

  it("M-R. weekly fields, missing as dash, explicit zero, missing injury is not Healthy", async () => {
    const page = await renderMatchup();
    expect(page.textContent).toMatch(/22\.4/);
    expect(page.textContent).toMatch(/ECR 8/);
    const simone = screen.getByRole("button", { name: "Simone Blake" }).closest(".starting-cell");
    expect(simone?.textContent).toMatch(/Wk —/);
    expect(simone?.textContent).toMatch(/ECR —/);
    expect(simone?.textContent).not.toMatch(/Healthy/);
    expect(simone?.textContent).toMatch(/Questionable/);
    const remy = screen.getByText("Remy Holt").closest("li");
    expect(remy?.textContent).toMatch(/Wk 0/);
  });

  it("S-W. explicit injury and unresolved/ambiguous players remain without FP values", async () => {
    await renderMatchup();
    expect(screen.getByRole("button", { name: "Theo Banks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nell Voss" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iron Ridge" })).toBeTruthy();
    const nell = screen.getByRole("button", { name: "Nell Voss" }).closest(".starting-cell");
    expect(nell?.textContent).toMatch(/Intelligence unavailable/);
    expect(nell?.textContent).toMatch(/Wk —/);
    const iron = screen.getByRole("button", { name: "Iron Ridge" }).closest(".starting-cell");
    expect(iron?.textContent).toMatch(/Identity needs review/);
    expect(iron?.textContent).toMatch(/Wk —/);
  });

  it("X-Z. known projection, completeness, and incomparable totals", async () => {
    const page = await renderMatchup();
    expect(page.textContent).toMatch(/118\.9 known pts/);
    expect(page.textContent).toMatch(/9 of 9 projected/);
    expect(page.textContent).toMatch(/5 of 9 projected/);
    expect(page.textContent).toMatch(/not directly comparable/);
  });

  it("AA. no frontend projection delta invented", async () => {
    const page = await renderMatchup();
    expect(page.textContent).not.toMatch(/[+-]\d+(\.\d+)?\s*(pts|points)/i);
    expect(page.textContent).not.toMatch(/delta/i);
  });

  it("AB-AE. injury summary, bench order, and IR", async () => {
    await renderMatchup();
    expect(screen.getByRole("heading", { name: "Availability Notes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ivo Marsh" })).toBeTruthy();
    const bench = screen.getByRole("heading", { name: "Bench" }).parentElement;
    const names = within(bench as HTMLElement)
      .getAllByRole("button")
      .map((node) => node.textContent);
    expect(names.filter((name) => name === "Ivo Marsh" || name === "Remy Holt" || name === "Joss Hale")).toEqual([
      "Ivo Marsh",
      "Remy Holt",
      "Joss Hale",
    ]);
    expect(screen.getByRole("heading", { name: "IR / Inactive" })).toBeTruthy();
    expect(screen.getByText("Maren Solis")).toBeTruthy();
    expect(screen.getByText("Pax Irving")).toBeTruthy();
  });

  it("AF. player details open from already-loaded data", async () => {
    await renderMatchup();
    fireEvent.click(screen.getByRole("button", { name: "Rex Calder" }));
    expect(screen.getByText("Fantasy team")).toBeTruthy();
    expect(screen.getByText("Weekly projection")).toBeTruthy();
    expect(screen.queryByText(/\{/)).toBeNull();
  });

  it("AG-AI. Start/Sit, League, and Players navigation", async () => {
    window.history.pushState({}, "", "/matchup");
    render(<App />);
    await screen.findByTestId("matchup-page");
    expect(screen.getAllByRole("link", { name: "Review Start/Sit" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View League" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Research players" })).toBeTruthy();
    expect(screen.getByText(/Co-Pilot has 1 lineup recommendation available/)).toBeTruthy();
  });

  it("AJ. fixture state visible", async () => {
    await renderMatchup();
    expect(screen.getAllByText("Fixture data").length).toBeGreaterThan(0);
  });

  it("AK. Yahoo unavailable state", async () => {
    render(
      <MatchupPage
        navigate={() => undefined}
        load={() =>
          Promise.resolve(
            matchupPage({
              yahooError: new ApiError(502, "yahoo_http_error", "Yahoo Fantasy API request failed."),
              matchup: undefined,
            }),
          )
        }
      />,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Yahoo Fantasy data is temporarily unavailable/)).toBeTruthy();
  });

  it("AL. FP partial state preserves Yahoo matchup", async () => {
    const page = await renderMatchup(
      matchupPage({
        matchup: intelligence({ fantasyProsAvailable: false }),
        fantasyProsError: new ApiError(502, "fantasypros_http_error", "FantasyPros request failed."),
      }),
    );
    expect(page.textContent).toMatch(/Yahoo matchup and lineups are still shown/);
    expect(screen.getByText("Rex Calder")).toBeTruthy();
  });

  it("AM. opponent-roster error localized", async () => {
    await renderMatchup(
      matchupPage({
        matchup: intelligence({ opponent: undefined, opponentError: "Opponent roster is unavailable." }),
      }),
    );
    expect(screen.getAllByText("Opponent roster is unavailable.").length).toBeGreaterThan(0);
    expect(screen.getByText("Rex Calder")).toBeTruthy();
  });

  it("AN-AR. no win probability, favorite, grade, position winner, or new recommendation", async () => {
    const page = await renderMatchup();
    expect(page.textContent).not.toMatch(/win probability|win %|favorite|underdog|matchup grade|position winner|edge:|advantage:/i);
    expect(page.textContent).not.toMatch(/Sit Milo|swap Rex/i);
  });

  it("AS-AY. other routes remain reachable", async () => {
    window.history.pushState({}, "", "/matchup");
    render(<App />);
    await screen.findByTestId("matchup-page");
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "View Matchup" }));
    expect(await screen.findByTestId("matchup-page")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "My Team" }));
    expect(await screen.findByTestId("my-team")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Waiver Wire" }));
    expect(await screen.findByTestId("waiver-wire")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Start / Sit" }));
    expect(await screen.findByTestId("start-sit")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Players" }));
    expect(await screen.findByTestId("players")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "League" }));
    expect(await screen.findByTestId("league")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });
});
