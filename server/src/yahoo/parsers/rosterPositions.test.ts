import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseRosterPositions } from "./rosterPositions.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("parseRosterPositions", () => {
  it("parses Yahoo-shaped roster_position blocks", () => {
    const positions = parseRosterPositions({
      roster_positions: {
        "0": { roster_position: { position: "QB", count: 1 } },
        "1": { roster_position: { position: "RB", count: 2 } },
        "2": { roster_position: { position: "SUPERFLEX", count: 1 } },
        count: 3,
      },
    });
    assert.deepEqual(positions, [
      { position: "QB", count: 1 },
      { position: "RB", count: 2 },
      { position: "SUPERFLEX", count: 1 },
    ]);
  });

  it("parses the synthetic league-settings fixture", () => {
    const payload = JSON.parse(readFileSync(path.join(fixturesDir, "league-settings.json"), "utf8"));
    const positions = parseRosterPositions(payload);
    assert.equal(positions.find((row) => row.position === "W/R/T")?.count, 1);
    assert.equal(positions.find((row) => row.position === "BN")?.count, 6);
  });
});
