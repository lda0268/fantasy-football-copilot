import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseFantasyProsInjuries } from "../fantasypros/parsers/injuries.js";
import { parseFantasyProsPlayers } from "../fantasypros/parsers/players.js";
import { parseWeeklyProjections } from "../fantasypros/parsers/projections.js";
import { parseFantasyProsRankings } from "../fantasypros/parsers/rankings.js";
import { toYahooIdentityPlayer } from "../playerIdentity/fromProviders.js";
import { reconcilePlayers } from "../playerIdentity/matcher.js";
import { composePlayerIntelligence } from "../playerIntelligence/compose.js";
import { toYahooLeaguePlayer } from "../playerIntelligence/fromYahoo.js";
import { parseLeagueSettings } from "../yahoo/parsers/leagueSettings.js";
import { parseYahooMatchups, selectMatchupForTeam } from "../yahoo/parsers/matchup.js";
import { parseYahooRosterPlayers } from "../yahoo/parsers/roster.js";
import { parseYahooTeam } from "../yahoo/parsers/team.js";
import { buildMatchupIntelligence, matchupStatusLabel } from "./assemble.js";

const repoSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readYahoo(name: string): unknown {
  return JSON.parse(readFileSync(path.join(repoSrc, "yahoo/fixtures", name), "utf8"));
}

function readFp(name: string): unknown {
  return JSON.parse(readFileSync(path.join(repoSrc, "fantasypros/fixtures", name), "utf8"));
}

function assemble(options?: { opponent?: boolean; fantasyPros?: boolean }) {
  const includeOpponent = options?.opponent !== false;
  const includeFp = options?.fantasyPros !== false;
  const userTeam = parseYahooTeam(readYahoo("roster.json"));
  const userRoster = parseYahooRosterPlayers(readYahoo("roster.json"));
  const opponentRoster = parseYahooRosterPlayers(readYahoo("roster-2.json"));
  const opponentTeam = parseYahooTeam(readYahoo("roster-2.json"));
  const matchup = selectMatchupForTeam(parseYahooMatchups(readYahoo("scoreboard.json")), userTeam.teamKey);
  const settings = parseLeagueSettings(readYahoo("league-settings.json"));
  const yahooPlayers = [
    ...userRoster.map((player) => toYahooLeaguePlayer(player, "roster")),
    ...(includeOpponent ? opponentRoster.map((player) => {
      const converted = toYahooLeaguePlayer(player, "available");
      converted.ownershipType = "team";
      return converted;
    }) : []),
  ];
  const fpPlayers = includeFp ? parseFantasyProsPlayers(readFp("players.json")) : [];
  const identity = reconcilePlayers(
    yahooPlayers.map((player) =>
      toYahooIdentityPlayer({
        playerKey: player.playerKey,
        playerId: player.playerId ?? "",
        name: player.name,
        editorialTeamAbbr: player.team,
        displayPosition: player.displayPosition,
        eligiblePositions: player.eligiblePositions,
      }),
    ),
    fpPlayers,
  );
  const composed = composePlayerIntelligence({
    yahooPlayers,
    identityResults: identity.results,
    weeklyProjections: includeFp ? parseWeeklyProjections(readFp("projections-weekly.json"), 2, "half_ppr") : [],
    weeklyRankings: includeFp ? parseFantasyProsRankings(readFp("rankings-weekly.json"), "weekly") : [],
    injuries: includeFp ? parseFantasyProsInjuries(readFp("injuries.json")) : [],
  });
  return buildMatchupIntelligence({
    yahooStatus: { connected: true, fantasyAuthorized: true, mode: "fixture", expiresAt: null },
    fantasyProsStatus: { configured: true, mode: "fixture" },
    fantasyProsAvailable: includeFp,
    league: {
      leagueKey: "999.l.123456",
      leagueId: "123456",
      name: "Co-Pilot Test League",
      season: "2026",
      currentWeek: 2,
      scoringType: "head",
    },
    team: userTeam,
    matchup,
    rosterPositions: settings.rosterPositions ?? [],
    userRoster,
    opponentRoster: includeOpponent ? { team: opponentTeam, players: opponentRoster } : undefined,
    opponentError: includeOpponent ? undefined : "Opponent roster is unavailable.",
    players: composed.players,
  });
}

describe("matchup intelligence assembly", () => {
  it("identifies user and opponent from Yahoo matchup and rosters", () => {
    const result = assemble();
    assert.equal(result.user?.name, "Co-Pilot Test Team");
    assert.equal(result.opponent?.name, "Fourth Down Labs");
    assert.equal(result.user?.teamKey, "999.l.123456.t.1");
    assert.equal(result.opponent?.teamKey, "999.l.123456.t.2");
  });

  it("classifies current Yahoo starters, bench, and IR without recommended lineup", () => {
    const result = assemble();
    const userNames = result.comparison.slots.map((row) => row.user?.name);
    assert.ok(userNames.includes("Rex Calder"));
    assert.ok(userNames.includes("Devon Hart"));
    assert.equal(result.user?.bench.some((player) => player.name === "Quinn Mercer"), true);
    assert.equal(result.user?.ir.some((player) => player.name === "Maren Solis"), true);
    assert.equal(result.opponent?.bench.map((player) => player.name)[0], "Ivo Marsh");
    assert.equal(result.opponent?.ir[0]?.name, "Pax Irving");
  });

  it("reuses identity reconciliation for matched, unresolved, and ambiguous players", () => {
    const result = assemble();
    const rex = result.comparison.slots.find((row) => row.user?.name === "Rex Calder")?.user;
    const nell = result.comparison.slots.find((row) => row.opponent?.name === "Nell Voss")?.opponent;
    const iron = result.comparison.slots.find((row) => row.opponent?.name === "Iron Ridge")?.opponent;
    const harper = result.user?.bench.find((player) => player.name === "Harper Dillon");
    assert.equal(rex?.identityStatus, "matched");
    assert.equal(nell?.identityStatus, "unresolved");
    assert.equal(iron?.identityStatus, "ambiguous");
    assert.equal(harper?.identityStatus, "ambiguous");
    assert.equal(nell?.weeklyProjectedPoints, undefined);
    assert.equal(iron?.weeklyProjectedPoints, undefined);
    assert.equal(harper?.weeklyEcr, undefined);
  });

  it("keeps missing projections unset, preserves explicit zero, and does not invent Healthy", () => {
    const result = assemble();
    const cade = result.comparison.slots.find((row) => row.opponent?.name === "Cade Rowan")?.opponent;
    const simone = result.comparison.slots.find((row) => row.opponent?.name === "Simone Blake")?.opponent;
    const remy = result.opponent?.bench.find((player) => player.name === "Remy Holt");
    const nash = result.comparison.slots.find((row) => row.user?.name === "Nash Ellison")?.user;
    assert.equal(cade?.weeklyProjectedPoints, undefined);
    assert.equal(simone?.weeklyProjectedPoints, undefined);
    assert.equal(simone?.injuryStatus, "Questionable");
    assert.equal(remy?.weeklyProjectedPoints, 0);
    assert.ok(nash?.weeklyProjectedPoints !== undefined);
    const serialized = JSON.stringify(result);
    assert.equal(/Healthy/.test(serialized), false);
    assert.equal("winProbability" in result, false);
    assert.equal(serialized.includes("favorite"), false);
    assert.equal(serialized.includes("underdog"), false);
    assert.equal(serialized.includes("matchup grade"), false);
  });

  it("aggregates known FantasyPros points without treating missing as zero", () => {
    const result = assemble();
    const opponentKnown = result.opponent?.summary.knownProjectedPoints ?? 0;
    const projected = result.opponent?.summary.projectedSlots ?? 0;
    const total = result.opponent?.summary.totalSlots ?? 0;
    assert.ok(projected < total);
    assert.equal(result.differences.comparable, false);
    const starterPoints = result.comparison.slots
      .map((row) => row.opponent?.weeklyProjectedPoints)
      .filter((value): value is number => value !== undefined)
      .reduce((sum, value) => sum + value, 0);
    assert.equal(opponentKnown, starterPoints);
    assert.equal(result.user?.yahooProjectedPoints, 126.55);
    assert.equal(result.user?.points, 87.42);
    assert.equal(result.matchupStatusLabel, "In progress");
  });

  it("aligns duplicate WR/RB slots and FLEX from Yahoo lineup settings", () => {
    const result = assemble();
    const wr = result.comparison.slots.filter((row) => row.displayPosition === "WR");
    const rb = result.comparison.slots.filter((row) => row.displayPosition === "RB");
    const flex = result.comparison.slots.filter((row) => row.displayPosition === "FLEX");
    assert.equal(wr.length, 2);
    assert.equal(rb.length, 2);
    assert.equal(flex.length, 1);
    assert.equal(wr[0]?.yahooPosition, "WR");
    assert.equal(flex[0]?.yahooPosition, "W/R/T");
    assert.equal(wr[0]?.id, "WR:0");
    assert.equal(wr[1]?.id, "WR:1");
  });

  it("maps Yahoo scores and labels Yahoo projection separately from FP known totals", () => {
    const result = assemble();
    assert.notEqual(result.user?.yahooProjectedPoints, result.user?.summary.knownProjectedPoints);
    assert.equal(result.user?.yahooProjectedPoints, 126.55);
    assert.ok((result.user?.summary.knownProjectedPoints ?? 0) > 0);
  });

  it("preserves opponent Yahoo players when FantasyPros is unavailable", () => {
    const result = assemble({ fantasyPros: false });
    assert.equal(result.fantasyProsAvailable, false);
    assert.ok(result.comparison.slots.some((row) => row.opponent?.name === "Nell Voss"));
    assert.ok(result.comparison.slots.every((row) => row.opponent?.weeklyProjectedPoints === undefined));
  });

  it("keeps the user side when opponent roster is missing", () => {
    const result = assemble({ opponent: false });
    assert.equal(result.opponent, undefined);
    assert.equal(result.opponentError, "Opponent roster is unavailable.");
    assert.equal(result.user?.name, "Co-Pilot Test Team");
    assert.ok(result.comparison.slots.some((row) => row.user?.name === "Rex Calder"));
  });

  it("does not attach FantasyPros values to unresolved or ambiguous identities", () => {
    const result = assemble();
    const unresolved = result.comparison.slots.find((row) => row.opponent?.identityStatus === "unresolved")?.opponent;
    const ambiguous = result.comparison.slots.find((row) => row.opponent?.identityStatus === "ambiguous")?.opponent;
    assert.ok(unresolved);
    assert.ok(ambiguous);
    assert.equal(unresolved?.weeklyProjectedPoints, undefined);
    assert.equal(unresolved?.weeklyEcr, undefined);
    assert.equal(unresolved?.injuryStatus, undefined);
    assert.equal(ambiguous?.weeklyProjectedPoints, undefined);
    assert.equal(ambiguous?.weeklyEcr, undefined);
  });

  it("does not infer matchup state from score and only maps known Yahoo status", () => {
    assert.equal(matchupStatusLabel("midevent"), "In progress");
    assert.equal(matchupStatusLabel("mystery"), undefined);
    const result = assemble();
    assert.ok(!("winnerTeamKey" in result));
  });

  it("counts explicit injury flags without scoring an advantage", () => {
    const result = assemble();
    assert.ok((result.availabilityNotes.length ?? 0) > 0);
    assert.ok(result.availabilityNotes.some((note) => /Questionable|Out|IR/.test(note.status)));
    assert.equal(result.differences.userInjuryFlags !== undefined, true);
    assert.equal(JSON.stringify(result).includes("advantage"), false);
  });
});
