import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import App from "../App";
import type { PlayerIntelligence } from "../api/types";
import { ComparePage } from "./ComparePage";
import type { PlayersPageData } from "./loadPlayers";
import { numericDifference, parseCompareSearch } from "./compareView";

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
  loadMatchup: vi.fn(async () => ({
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
        leagueState: { availability: "rostered_by_user", byeWeek: 12, percentOwned: 99 },
        weekly: { week: 2, projectedPoints: 22.4, ecr: 8 },
        restOfSeason: { projectedPoints: 301.2, ecr: 10 },
        provenance: { yahoo: true, fantasyPros: true, fields: { availability: { provider: "yahoo" }, weeklyProjection: { provider: "fantasypros" } } },
        freshness: { yahoo: { observedAt: "2026-09-16T12:00:00Z" } },
      }),
      intel({
        key: "n1",
        name: "Nash Ellison",
        player: { name: "Nash Ellison", position: "WR", team: "MIA" },
        leagueState: { availability: "rostered_by_user", byeWeek: 11, percentOwned: 88 },
        weekly: { projectedPoints: 15.8, ecr: 18 },
        restOfSeason: { projectedPoints: 184.3, ecr: 20 },
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
        leagueState: { availability: "free_agent", percentOwned: 0 },
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
        leagueState: { availability: "rostered_by_user", percentOwned: 54 },
        weekly: { projectedPoints: 13.2, ecr: 24 },
        injury: { status: "IR", practiceStatus: "Out", description: "Knee" },
      }),
      intel({
        key: "z1",
        name: "Zero Proj",
        player: { name: "Zero Proj", position: "RB", team: "FA" },
        leagueState: { availability: "free_agent" },
        weekly: { projectedPoints: 0, ecr: 90 },
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

async function renderCompare(data: PlayersPageData = playersData(), search = "") {
  render(<ComparePage navigate={() => undefined} search={search} load={() => Promise.resolve(data)} />);
  return screen.findByTestId("compare");
}

async function pick(label: string, name: string, query = name) {
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.change(input, { target: { value: query } });
  fireEvent.click(within(screen.getByRole("listbox", { name: `${label} results` })).getByRole("button", { name: new RegExp(name) }));
}

describe("compare helpers", () => {
  it("parses URL keys and withholds numeric difference when a value is missing", () => {
    expect(parseCompareSearch("?player=r1")).toEqual({ a: "r1", b: undefined });
    expect(parseCompareSearch("?a=r1&b=r1")).toEqual({ a: "r1" });
    expect(numericDifference(16.8, 14.2)).toBeCloseTo(2.6);
    expect(numericDifference(16.8, undefined)).toBeUndefined();
  });
});

describe("Player Compare page", () => {
  it("A/B. /compare renders empty state", async () => {
    window.history.pushState({}, "", "/compare");
    render(<App />);
    expect(await screen.findByTestId("compare")).toBeTruthy();
    expect(screen.getByText("Select two players to compare.")).toBeTruthy();
  });

  it("C-H. selectors search by name, partial name, team, and position", async () => {
    await renderCompare();
    fireEvent.change(screen.getByRole("combobox", { name: "Player A" }), { target: { value: "rex" } });
    expect(within(screen.getByRole("listbox", { name: "Player A results" })).getByText("Rex Calder")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Player A" }), { target: { value: "BUF" } });
    expect(within(screen.getByRole("listbox", { name: "Player A results" })).getByText("Rex Calder")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Player B" }), { target: { value: "WR" } });
    const bList = screen.getByRole("listbox", { name: "Player B results" });
    expect(within(bList).getByText("Nash Ellison")).toBeTruthy();
    expect(within(bList).getByText("Remy Holt")).toBeTruthy();
  });

  it("I-K. selected players render and the same player cannot occupy both sides", async () => {
    await renderCompare();
    await pick("Player A", "Rex Calder", "Rex");
    fireEvent.change(screen.getByRole("combobox", { name: "Player B" }), { target: { value: "Rex" } });
    expect(within(screen.getByRole("listbox", { name: "Player B results" })).queryByText("Rex Calder")).toBeNull();
    await pick("Player B", "Nash Ellison", "Nash");
    expect(screen.getAllByRole("heading", { name: "Rex Calder" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Nash Ellison" }).length).toBeGreaterThan(0);
  });

  it("L/M. swap and clear work", async () => {
    await renderCompare();
    await pick("Player A", "Rex Calder", "Rex");
    await pick("Player B", "Nico Vale", "Nico");
    fireEvent.click(screen.getByRole("button", { name: "Swap players" }));
    const cards = document.querySelector(".compare-cards");
    const names = within(cards as HTMLElement).getAllByRole("heading").map((node) => node.textContent);
    expect(names.slice(0, 2)).toEqual(["Nico Vale", "Rex Calder"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear comparison" }));
    expect(screen.getByText("Select two players to compare.")).toBeTruthy();
  });

  it("N-AB. league labels, weekly/ROS fields, missing/zero/injury/bye/ownership", async () => {
    const page = await renderCompare();
    await pick("Player A", "Rex Calder", "Rex");
    await pick("Player B", "Nico Vale", "Nico");
    expect(page.textContent).toMatch(/My Team/);
    expect(page.textContent).toMatch(/Free Agent/);
    expect(page.textContent).toMatch(/22\.4/);
    expect(page.textContent).toMatch(/ECR/);
    expect(page.textContent).toMatch(/301\.2/);
    expect(page.textContent).toMatch(/99%/);
    expect(page.textContent).toMatch(/Bye 12/);
    expect(page.textContent).toMatch(/Difference 11\.4/);
    fireEvent.click(screen.getByRole("button", { name: "Clear Player B" }));
    await pick("Player B", "Wynn OConnell", "Wynn");
    expect(page.textContent).toMatch(/Other Team/);
    expect(page.textContent).toMatch(/67%/);
    fireEvent.click(screen.getByRole("button", { name: "Clear Player B" }));
    await pick("Player B", "Remy Holt", "Remy");
    expect(page.textContent).toMatch(/Waivers/);
    expect(page.textContent).toMatch(/Difference —/);
    fireEvent.click(screen.getByRole("button", { name: "Clear comparison" }));
    await pick("Player A", "Zero Proj", "Zero");
    await pick("Player B", "Missing Fields", "Missing");
    expect(page.textContent).toMatch(/Wk|0/);
    expect(within(screen.getByRole("heading", { name: "This Week" }).parentElement as HTMLElement).getAllByText("0").length).toBeGreaterThan(0);
    expect(page.textContent).not.toMatch(/Healthy/);
    expect(page.textContent).toMatch(/Owned —/);
  });

  it("AC-AG. identity, completeness, injury, and warnings", async () => {
    const page = await renderCompare();
    await pick("Player A", "Theo Banks", "Theo");
    await pick("Player B", "Unresolved TE", "Unresolved");
    expect(page.textContent).toMatch(/IR/);
    expect(page.textContent).toMatch(/Enriched/);
    expect(page.textContent).toMatch(/Intelligence unavailable/);
    expect(page.textContent).toMatch(/No FP intelligence/);
    expect(page.textContent).toMatch(/FantasyPros intelligence unavailable because player identity is unresolved/);
    expect(page.textContent).not.toMatch(/99/);
    fireEvent.click(screen.getByRole("button", { name: "Clear Player B" }));
    await pick("Player B", "Harper Dillon", "Harper");
    expect(page.textContent).toMatch(/Identity needs review/);
    expect(page.textContent).toMatch(/FantasyPros intelligence withheld because player identity is ambiguous/);
    expect(page.textContent).not.toMatch(/Better player|Advantage|Edge:|winner/i);
  });

  it("AH-AS. provenance, same and cross position, no recommendation chrome", async () => {
    const page = await renderCompare();
    await pick("Player A", "Nash Ellison", "Nash");
    await pick("Player B", "Remy Holt", "Remy");
    expect(page.textContent).toMatch(/WR vs WR/);
    fireEvent.click(screen.getByRole("button", { name: "Clear Player B" }));
    await pick("Player B", "Nico Vale", "Nico");
    expect(page.textContent).toMatch(/WR vs RB/);
    expect(page.textContent).toMatch(/not normalized across positions/);
    expect(page.textContent).toMatch(/Yahoo/);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bench" })).toBeNull();
    expect(page.textContent).not.toMatch(/Better player|Advantage|Edge:|winner/i);
  });

  it("AT-AV/AW-AX. navigation and query preselection", async () => {
    window.history.pushState({}, "", "/compare?player=r1");
    const first = render(<App />);
    await screen.findByTestId("compare");
    expect((await screen.findAllByText("Rex Calder")).length).toBeGreaterThan(0);
    expect(screen.getByText("Choose a second player to complete the comparison.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View My Team" })).toBeTruthy();
    first.unmount();
    window.history.pushState({}, "", "/compare?a=nope&b=also-nope");
    render(<App />);
    expect(await screen.findByText("Select two players to compare.")).toBeTruthy();
  });

  it("AY/AZ. fixture chip and provider error states", async () => {
    await renderCompare();
    expect(screen.getAllByText("Fixture data").length).toBeGreaterThan(0);
    render(
      <ComparePage
        navigate={() => undefined}
        load={() =>
          Promise.resolve(
            playersData({
              yahooError: new ApiError(502, "yahoo_http_error", "Yahoo Fantasy API request failed."),
              players: [],
            }),
          )
        }
      />,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("BA-BH. other routes remain reachable", async () => {
    window.history.pushState({}, "", "/compare");
    render(<App />);
    await screen.findByTestId("compare");
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(await screen.findByTestId("dashboard")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("link", { name: "Matchup" }));
    expect(await screen.findByTestId("matchup-page")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Draft Room" }));
    expect(await screen.findByText("Undo Last Pick")).toBeTruthy();
  });
});
