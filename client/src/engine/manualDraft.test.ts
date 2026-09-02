import { describe, expect, it } from "vitest";
import { MOCK_PLAYERS } from "../data/mockPlayers";
import { applyDraftPick, availableAfterPicks, undoDraftPick } from "./manualDraft";
import { formatPickLabel } from "./pickLabel";
import {
  filterAvailablePlayers,
  getEnterDraftCandidate,
  isTypingTarget,
  playerMatchesQuery,
  positionFilterFromKey,
} from "./playerSearch";
import { createInitialDraftState } from "../types/draft";

function findPlayer(name: string) {
  return MOCK_PLAYERS.find((player) => player.name === name)!;
}

describe("single-click draft", () => {
  it("marks a player drafted and advances the pick immediately", () => {
    const player = findPlayer("Jahmyr Gibbs");
    const next = applyDraftPick(createInitialDraftState(), player);

    expect(next.currentPick).toBe(2);
    expect(next.draftedPlayerIds).toEqual([player.id]);
    expect(next.picks[0]?.playerName).toBe("Jahmyr Gibbs");
    expect(availableAfterPicks(MOCK_PLAYERS, next.draftedPlayerIds).some((p) => p.id === player.id)).toBe(false);
  });

  it("does not draft the same player twice", () => {
    const player = findPlayer("Jahmyr Gibbs");
    const once = applyDraftPick(createInitialDraftState(), player);
    const twice = applyDraftPick(once, player);

    expect(twice).toBe(once);
    expect(twice.picks).toHaveLength(1);
    expect(twice.currentPick).toBe(2);
  });
});

describe("Enter-to-draft from search", () => {
  it("matches partial names", () => {
    expect(playerMatchesQuery(findPlayer("Trey McBride"), "mcbr")).toBe(true);
    expect(playerMatchesQuery(findPlayer("Amon-Ra St. Brown"), "amon")).toBe(true);
    expect(playerMatchesQuery(findPlayer("Jahmyr Gibbs"), "gibbs")).toBe(true);
  });

  it("drafts the unique top search match on Enter", () => {
    const available = availableAfterPicks(MOCK_PLAYERS, []);
    const candidate = getEnterDraftCandidate(available, "gibbs");
    expect(candidate?.name).toBe("Jahmyr Gibbs");

    const next = applyDraftPick(createInitialDraftState(), candidate!);
    expect(next.picks[0]?.playerName).toBe("Jahmyr Gibbs");
  });

  it("drafts McBride from mcbr and Amon-Ra from amon", () => {
    const available = availableAfterPicks(MOCK_PLAYERS, []);
    expect(getEnterDraftCandidate(available, "mcbr")?.name).toBe("Trey McBride");
    expect(getEnterDraftCandidate(available, "amon")?.name).toBe("Amon-Ra St. Brown");
  });
});

describe("undo", () => {
  it("restores the player, pick number, and availability", () => {
    const player = findPlayer("Jahmyr Gibbs");
    const drafted = applyDraftPick(createInitialDraftState(), player);
    const undone = undoDraftPick(drafted);

    expect(undone.currentPick).toBe(1);
    expect(undone.picks).toHaveLength(0);
    expect(undone.draftedPlayerIds).toHaveLength(0);
    expect(availableAfterPicks(MOCK_PLAYERS, undone.draftedPlayerIds).some((p) => p.id === player.id)).toBe(true);
  });
});

describe("keyboard filtering", () => {
  it("maps Q/R/W/T to position filters", () => {
    expect(positionFilterFromKey("q")).toBe("QB");
    expect(positionFilterFromKey("R")).toBe("RB");
    expect(positionFilterFromKey("w")).toBe("WR");
    expect(positionFilterFromKey("t")).toBe("TE");
    expect(positionFilterFromKey("/")).toBeNull();
  });

  it("filters available players by position", () => {
    const qbs = filterAvailablePlayers(MOCK_PLAYERS, "", "QB");
    expect(qbs.length).toBeGreaterThan(0);
    expect(qbs.every((player) => player.position === "QB")).toBe(true);
  });

  it("does not treat inputs as shortcut targets", () => {
    const input = { tagName: "INPUT", isContentEditable: false } as HTMLElement;
    expect(isTypingTarget(input)).toBe(true);
  });
});

describe("pick label", () => {
  it("formats round.pick for a 10-team draft", () => {
    expect(formatPickLabel(4, 10)).toBe("1.04");
    expect(formatPickLabel(14, 10)).toBe("2.04");
  });
});
