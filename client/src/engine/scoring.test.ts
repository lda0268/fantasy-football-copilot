import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS } from "../data/mockPlayers";
import { calculateProjectedPoints } from "./scoring";
import { DEFAULT_LEAGUE, withLeagueOverrides } from "../types/league";

describe("Yahoo league scoring", () => {
  it("awards 6 points per passing TD", () => {
    const six = calculateProjectedPoints({ passTD: 1 }, DEFAULT_LEAGUE);
    const four = calculateProjectedPoints(
      { passTD: 1 },
      withLeagueOverrides(DEFAULT_LEAGUE, { offensiveScoring: { passingTd: 4 } }),
    );
    expect(six).toBe(6);
    expect(four).toBe(4);
  });

  it("deducts 2 points per interception", () => {
    expect(calculateProjectedPoints({ interceptions: 1 }, DEFAULT_LEAGUE)).toBe(-2);
  });

  it("gives one point per reception in full PPR", () => {
    expect(calculateProjectedPoints({ receptions: 8 }, DEFAULT_LEAGUE)).toBe(8);
  });

  it("scores return yards and return TDs from combined usage", () => {
    expect(calculateProjectedPoints({ returnYards: 40 }, DEFAULT_LEAGUE)).toBe(2);
    expect(calculateProjectedPoints({ returnYards: 200 }, DEFAULT_LEAGUE)).toBe(10);
    expect(calculateProjectedPoints({ returnYards: 500, returnTD: 2 }, DEFAULT_LEAGUE)).toBe(37);
  });

  it("does not rank a turnover-heavy QB above an efficient passer on raw yards alone", () => {
    const efficient = calculateProjectedPoints(
      { passYards: 3800, passTD: 35, interceptions: 8, rushYards: 500, rushTD: 6, fumbles: 2 },
      DEFAULT_LEAGUE,
    );
    const reckless = calculateProjectedPoints(
      { passYards: 4500, passTD: 22, interceptions: 22, rushYards: 80, rushTD: 1, fumbles: 8 },
      DEFAULT_LEAGUE,
    );
    expect(efficient).toBeGreaterThan(reckless);
  });

  it("applies league scoring to Josh Allen rather than the ESPN source total", () => {
    const allen = MOCK_PLAYERS.find((player) => player.name === "Josh Allen")!;
    expect(allen.projectionSource).toBe("league");
    expect(allen.projectedPoints).toBeGreaterThan(allen.sourceProjectedPoints);
    expect(allen.projectedPoints).toBeGreaterThan(400);
  });
});
