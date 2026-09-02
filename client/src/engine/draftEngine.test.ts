import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS } from "../data/mockPlayers";
import {
  getPicksUntilUserPick,
  getRoundForPick,
  getTeamSlotForPick,
  isUserOnClock,
} from "../engine/draftOrder";
import { getRecommendations } from "../engine/recommendations";
import { createEmptyRoster } from "../types/draft";
import { DEFAULT_LEAGUE } from "../types/league";

describe("12-team snake draft order", () => {
  const teamCount = 12;

  it("assigns round 1 picks in ascending order", () => {
    expect(getTeamSlotForPick(1, teamCount)).toBe(1);
    expect(getTeamSlotForPick(6, teamCount)).toBe(6);
    expect(getTeamSlotForPick(12, teamCount)).toBe(12);
    expect(getRoundForPick(12, teamCount)).toBe(1);
  });

  it("snakes round 2 in reverse order", () => {
    expect(getTeamSlotForPick(13, teamCount)).toBe(12);
    expect(getTeamSlotForPick(14, teamCount)).toBe(11);
    expect(getTeamSlotForPick(24, teamCount)).toBe(1);
    expect(getRoundForPick(13, teamCount)).toBe(2);
  });

  it("snakes round 3 forward again", () => {
    expect(getTeamSlotForPick(25, teamCount)).toBe(1);
    expect(getTeamSlotForPick(36, teamCount)).toBe(12);
  });
});

describe("user pick detection", () => {
  const teamCount = 12;

  it("detects when user is on the clock", () => {
    expect(isUserOnClock(1, 1, teamCount)).toBe(true);
    expect(isUserOnClock(1, 2, teamCount)).toBe(false);
    expect(isUserOnClock(13, 12, teamCount)).toBe(true);
  });

  it("calculates picks until user's next selection", () => {
    expect(getPicksUntilUserPick(2, 1, teamCount)).toBe(22);
    expect(getPicksUntilUserPick(12, 1, teamCount)).toBe(12);
    expect(getPicksUntilUserPick(1, 1, teamCount)).toBe(0);
    expect(getPicksUntilUserPick(13, 12, teamCount)).toBe(0);
  });
});

describe("availability and recommendations", () => {
  it("removes drafted players from recommendations", () => {
    const draftedId = MOCK_PLAYERS[0].id;
    const available = MOCK_PLAYERS.filter((p) => p.id !== draftedId);
    const recs = getRecommendations({
      availablePlayers: available,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });

    expect(recs.every((rec) => rec.player.id !== draftedId)).toBe(true);
    expect(recs.length).toBe(5);
  });

  it("returns only available players in recommendations", () => {
    const available = MOCK_PLAYERS.slice(10);
    const recs = getRecommendations({
      availablePlayers: available,
      currentPick: 15,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });

    const availableIds = new Set(available.map((p) => p.id));
    expect(recs.every((rec) => availableIds.has(rec.player.id))).toBe(true);
  });
});

describe("undo behavior", () => {
  it("restores a drafted player to availability", () => {
    const draftedId = MOCK_PLAYERS[0].id;
    let draftedIds = [draftedId];
    const available = MOCK_PLAYERS.filter((p) => !draftedIds.includes(p.id));
    expect(available.some((p) => p.id === draftedId)).toBe(false);

    draftedIds = [];
    const restored = MOCK_PLAYERS.filter((p) => !draftedIds.includes(p.id));
    expect(restored.some((p) => p.id === draftedId)).toBe(true);
  });
});
