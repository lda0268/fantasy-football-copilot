import { describe, expect, it } from "vitest";
import { DRAFT_PLAYERS, PROJECTION_IMPORT_REPORT } from "../../data/draftUniverse";
import { loadProjectionCsvText } from "../../data/loadProjections";
import { createEmptyRoster } from "../../types/draft";
import { DEFAULT_LEAGUE } from "../../types/league";
import { getReplacementLevel } from "../replacement";
import { scorePlayers } from "../recommendations";

describe("live 2026 projection CSV", () => {
  it("loads the real imported CSV and scores from consensus projections", () => {
    expect(loadProjectionCsvText()?.length).toBeGreaterThan(1000);
    expect(PROJECTION_IMPORT_REPORT.csvRowsLoaded).toBe(6587);
    expect(PROJECTION_IMPORT_REPORT.selected.skill?.set.setId).toBe("68137");
    expect(PROJECTION_IMPORT_REPORT.matchedToUniverse).toBe(300);
    expect(PROJECTION_IMPORT_REPORT.universeWithoutProjection).toEqual([]);

    const allen = DRAFT_PLAYERS.find((player) => player.name === "Josh Allen")!;
    expect(allen.projection?.projectionSetId).toBe("68137");
    expect(allen.expert?.overallRank).toBe(36);
    expect(allen.market?.adp).toBe(3);
    expect(allen.projectedPoints).toBeCloseTo(406.1078, 3);
    expect(allen.projection?.passing?.yards).toBeCloseTo(3757.42, 2);

    const recs = scorePlayers({
      availablePlayers: DRAFT_PLAYERS,
      playerUniverse: DRAFT_PLAYERS,
      currentPick: 1,
      roster: createEmptyRoster(DEFAULT_LEAGUE),
      league: DEFAULT_LEAGUE,
    });
    const replacement = getReplacementLevel(DRAFT_PLAYERS, "QB", DEFAULT_LEAGUE);
    const allenRec = recs.find((rec) => rec.player.id === allen.id)!;
    expect(allenRec.vor).toBeCloseTo(allen.projectedPoints - replacement.projectedPoints, 1);
    expect(replacement.rank).toBeGreaterThan(15);
    expect(recs[0].score).not.toBe(allen.expert?.overallRank);
  });
});
