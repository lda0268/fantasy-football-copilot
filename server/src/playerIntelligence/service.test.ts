import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterPlayers } from "./service.js";
import type { PlayerIntelligence } from "./types.js";

function player(
  name: string,
  options: {
    key: string;
    position: string;
    availability: PlayerIntelligence["leagueState"]["availability"];
    status: PlayerIntelligence["identity"]["status"];
  },
): PlayerIntelligence {
  return {
    identity: {
      yahooPlayerKey: options.key,
      status: options.status,
      method: "none",
      confidence: "none",
    },
    player: { name, position: options.position },
    leagueState: { availability: options.availability },
    provenance: { yahoo: true, fantasyPros: false, fields: {} },
    freshness: {},
    warnings: [],
  };
}

describe("player intelligence query filters", () => {
  const players = [
    player("Alpha", { key: "1", position: "QB", availability: "rostered_by_user", status: "matched" }),
    player("Bravo", { key: "2", position: "RB", availability: "rostered_by_other", status: "unresolved" }),
    player("Charlie", { key: "3", position: "WR", availability: "waivers", status: "ambiguous" }),
  ];

  it("filters by position, availability, and identity without scoring", () => {
    assert.equal(filterPlayers(players, { position: "RB" })[0]?.player.name, "Bravo");
    assert.equal(filterPlayers(players, { availability: "waivers" })[0]?.player.name, "Charlie");
    assert.equal(filterPlayers(players, { identityStatus: "matched" })[0]?.player.name, "Alpha");
    assert.deepEqual(
      filterPlayers(players, {}).map((row) => row.player.name),
      ["Alpha", "Bravo", "Charlie"],
    );
  });
});
