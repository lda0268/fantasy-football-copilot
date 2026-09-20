import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FantasyProsApiError, FantasyProsErrorCode } from "../errors.js";
import { parseFantasyProsInjuries } from "./injuries.js";
import { parseFantasyProsPlayers } from "./players.js";
import { parseRosProjections, parseWeeklyProjections } from "./projections.js";
import { parseFantasyProsRankings } from "./rankings.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8")) as unknown;
}

describe("FantasyPros player parser", () => {
  it("parses players, names, positions, and optional external ids", () => {
    const players = parseFantasyProsPlayers(readFixture("players.json"));
    const rex = players.find((player) => player.fantasyProsId === "90001");
    assert.ok(rex);
    assert.equal(rex.name, "R. Calder");
    assert.equal(rex.firstName, "Rex");
    assert.equal(rex.position, "QB");
    assert.equal(rex.externalIds?.yahoo, "1001");
    assert.ok(players.some((player) => player.name === "Quinn Mercer"));
    assert.ok(players.some((player) => player.name === "Nico Vale"));
  });

  it("throws on malformed required identity", () => {
    assert.throws(
      () => parseFantasyProsPlayers({ players: [{ player_name: "No Id" }] }),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.PARSE_ERROR,
    );
  });
});

describe("FantasyPros projection parsers", () => {
  it("parses weekly decimal stats and preserves scoring variants", () => {
    const weekly = parseWeeklyProjections(readFixture("projections-weekly.json"), 2, "half_ppr");
    const nash = weekly.find((player) => player.name === "Nash Ellison");
    assert.equal(nash?.week, 2);
    assert.equal(nash?.fantasyPoints, 15.8);
    assert.equal(nash?.fantasyPointsByScoring?.ppr, 19.05);
    assert.equal(nash?.receivingYards, 88.2);
  });

  it("treats explicit zero as zero and missing stats as missing", () => {
    const weekly = parseWeeklyProjections(readFixture("projections-weekly.json"), 2, "half_ppr");
    const zero = weekly.find((player) => player.name === "Zero Proj");
    const bare = weekly.find((player) => player.name === "Bare Projection");
    assert.equal(zero?.fantasyPoints, 0);
    assert.equal(zero?.rushingYards, 0);
    assert.equal(bare?.fantasyPoints, undefined);
    assert.equal(bare?.receptions, undefined);
  });

  it("parses ROS projections separately from weekly", () => {
    const ros = parseRosProjections(readFixture("projections-ros.json"), "half_ppr");
    assert.ok(ros.length > 0);
    assert.equal("week" in ros[0], false);
    assert.ok((ros.find((player) => player.name === "Rex Calder")?.fantasyPoints ?? 0) > 22.4);
  });
});

describe("FantasyPros ranking and injury parsers", () => {
  it("parses weekly and ROS ECR without mixing types", () => {
    const weekly = parseFantasyProsRankings(readFixture("rankings-weekly.json"), "weekly");
    const ros = parseFantasyProsRankings(readFixture("rankings-ros.json"), "ros");
    assert.equal(weekly[0].rankingType, "weekly");
    assert.equal(ros[0].rankingType, "ros");
    assert.equal(weekly.find((player) => player.name === "Milo Grant")?.rank, 12);
    assert.equal(weekly.find((player) => player.name === "Milo Grant")?.positionRank, "RB6");
  });

  it("parses injuries, optional ids, and extra fields", () => {
    const injuries = parseFantasyProsInjuries(readFixture("injuries.json"));
    const quinn = injuries.find((item) => item.name === "Quinn Mercer");
    assert.equal(quinn?.status, "Questionable");
    assert.equal(quinn?.injury, "Ankle");
    assert.equal(quinn?.practiceStatus, "Full");
    assert.equal(injuries.find((item) => item.name === "Theo Banks")?.status, "IR");
    assert.equal(injuries.find((item) => item.name === "Unidentified Practice Report")?.fantasyProsId, undefined);
  });

  it("throws when ranking identity is malformed", () => {
    assert.throws(
      () => parseFantasyProsRankings({ players: [{ player_name: "No Rank" }] }, "weekly"),
      (error: unknown) => error instanceof FantasyProsApiError && error.code === FantasyProsErrorCode.PARSE_ERROR,
    );
  });

  it("ignores unexpected provider fields", () => {
    const players = parseFantasyProsPlayers({
      players: [
        {
          player_id: 42,
          player_name: "Extra Field",
          undocumented_blob: { foo: 1 },
          position_id: "WR",
          positions: ["WR"],
        },
      ],
    });
    assert.equal(players[0].fantasyProsId, "42");
    assert.equal(players[0].name, "Extra Field");
    assert.equal("undocumented_blob" in players[0], false);
  });
});
