import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseLeagueSettings } from "./leagueSettings.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("parseLeagueSettings", () => {
  it("parses roster positions and optional Yahoo settings from the fixture", () => {
    const payload = JSON.parse(readFileSync(path.join(fixturesDir, "league-settings.json"), "utf8"));
    const settings = parseLeagueSettings(payload);
    assert.equal(settings.draftType, "live");
    assert.equal(settings.scoringType, "head");
    assert.equal(settings.waiverType, "R");
    assert.equal(settings.waiverTime, "2");
    assert.equal(settings.usesFaab, false);
    assert.equal(settings.faabBudget, undefined);
    assert.equal(settings.tradeEndDate, "2026-11-18");
    assert.equal(settings.tradeRatifyType, "commish");
    assert.equal(settings.usesPlayoff, true);
    assert.equal(settings.playoffStartWeek, 15);
    assert.equal(settings.numPlayoffTeams, 6);
    assert.equal(settings.rosterPositions?.find((row) => row.position === "QB")?.count, 1);
    assert.equal(settings.rosterPositions?.find((row) => row.position === "W/R/T")?.count, 1);
    assert.equal(settings.rosterPositions?.find((row) => row.position === "BN")?.count, 6);
    assert.equal(settings.rosterPositions?.find((row) => row.position === "IR")?.count, 1);
  });

  it("does not invent settings when Yahoo omits them", () => {
    const settings = parseLeagueSettings({
      settings: {
        roster_positions: {
          "0": { roster_position: { position: "QB", count: 1 } },
          count: 1,
        },
      },
    });
    assert.equal(settings.waiverType, undefined);
    assert.equal(settings.tradeEndDate, undefined);
    assert.equal(settings.playoffStartWeek, undefined);
    assert.equal(settings.usesFaab, undefined);
    assert.equal(settings.faabBudget, undefined);
    assert.deepEqual(settings.rosterPositions, [{ position: "QB", count: 1 }]);
  });
});
