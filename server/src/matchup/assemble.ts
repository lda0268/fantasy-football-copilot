import { rosterGroup, expandStartingSlots } from "../startSit/slots.js";
import type { PlayerIntelligence } from "../playerIntelligence/types.js";
import type { YahooMatchupTeam, YahooRosterPlayer } from "../yahoo/types.js";
import type {
  AssembleMatchupInput,
  MatchupAvailabilityNote,
  MatchupIntelligence,
  MatchupPlayerView,
  MatchupSide,
  MatchupSlotRow,
  MatchupWeeklyCoverage,
} from "./types.js";

const FLEX_CODES = new Set(["W/R/T", "W/R", "W/T", "Q/W/R/T", "FLEX", "UTIL", "WRT"]);
const EXPLICIT_STATUS = /^(questionable|doubtful|out|ir|injured reserve|suspended|o|q|d|susp|na)\b/i;

const MATCHUP_STATUS_LABELS: Record<string, string> = {
  preevent: "Pregame",
  predraft: "Pregame",
  pregame: "Pregame",
  midevent: "In progress",
  midsession: "In progress",
  inprogress: "In progress",
  postevent: "Final",
  postgame: "Final",
  finished: "Final",
  final: "Final",
};

export function matchupStatusLabel(status?: string): string | undefined {
  if (!status) {
    return undefined;
  }
  return MATCHUP_STATUS_LABELS[status.trim().toLowerCase().replace(/[\s_-]/g, "")];
}

export function displaySlotLabel(position: string): string {
  return FLEX_CODES.has(position.trim().toUpperCase()) ? "FLEX" : position;
}

export function buildMatchupIntelligence(input: AssembleMatchupInput): MatchupIntelligence {
  const slots = expandStartingSlots(input.rosterPositions);
  const intelByKey = new Map(input.players.map((player) => [player.identity.yahooPlayerKey, player]));
  const userMatchup = matchupTeam(input.matchup, input.team.teamKey);
  const opponentMatchup = input.matchup?.teams.find((team) => team.teamKey !== input.team.teamKey);

  const userViews = input.userRoster.map((player) =>
    toView(player, intelByKey.get(player.playerKey), input.team.name),
  );
  const opponentViews = (input.opponentRoster?.players ?? []).map((player) =>
    toView(player, intelByKey.get(player.playerKey), input.opponentRoster?.team.name),
  );

  const userStarters = assignStarters(slots, userViews);
  const opponentStarters = input.opponentRoster ? assignStarters(slots, opponentViews) : slots.map(() => undefined);

  const comparisonSlots: MatchupSlotRow[] = slots.map((slot, index) => {
    const row: MatchupSlotRow = {
      id: slot.id,
      yahooPosition: slot.position,
      displayPosition: displaySlotLabel(slot.position),
    };
    if (userStarters[index]) {
      row.user = userStarters[index];
    }
    if (opponentStarters[index]) {
      row.opponent = opponentStarters[index];
    }
    return row;
  });

  const user = input.matchup
    ? buildSide(input.team.teamKey, userMatchup ?? { teamKey: input.team.teamKey, teamId: input.team.teamId, name: input.team.name }, userViews, userStarters, slots.length)
    : undefined;
  const opponent = input.opponentRoster
    ? buildSide(
        input.opponentRoster.team.teamKey,
        opponentMatchup ?? {
          teamKey: input.opponentRoster.team.teamKey,
          teamId: input.opponentRoster.team.teamId,
          name: input.opponentRoster.team.name,
        },
        opponentViews,
        opponentStarters,
        slots.length,
      )
    : undefined;

  const payload: MatchupIntelligence = {
    providers: {
      yahoo: {
        mode: input.yahooStatus.mode,
        connected: input.yahooStatus.connected,
        fantasyAuthorized: input.yahooStatus.fantasyAuthorized,
      },
      fantasyPros: {
        mode: input.fantasyProsStatus.mode,
        configured: input.fantasyProsStatus.configured,
      },
    },
    fantasyProsAvailable: input.fantasyProsAvailable,
    week: input.matchup?.week ?? input.league?.currentWeek ?? null,
    matchupPresent: Boolean(input.matchup),
    comparison: { slots: comparisonSlots },
    differences: {
      comparable: Boolean(
        user &&
          opponent &&
          user.summary.projectedSlots === user.summary.totalSlots &&
          opponent.summary.projectedSlots === opponent.summary.totalSlots &&
          user.summary.totalSlots === opponent.summary.totalSlots,
      ),
    },
    availabilityNotes: availabilityNotes(user, opponent, comparisonSlots),
  };

  if (input.league) {
    payload.league = {
      leagueKey: input.league.leagueKey,
      leagueId: input.league.leagueId,
      name: input.league.name,
      season: input.league.season,
      currentWeek: input.league.currentWeek,
      scoringType: input.league.scoringType,
    };
  }
  if (input.matchup?.status) {
    payload.matchupStatus = input.matchup.status;
    const label = matchupStatusLabel(input.matchup.status);
    if (label) {
      payload.matchupStatusLabel = label;
    }
  }
  if (user) {
    payload.user = user;
    payload.differences.userKnownProjection = user.summary.knownProjectedPoints;
    payload.differences.userProjectedSlots = user.summary.projectedSlots;
    payload.differences.userInjuryFlags = user.summary.injuryFlags;
  }
  if (opponent) {
    payload.opponent = opponent;
    payload.differences.opponentKnownProjection = opponent.summary.knownProjectedPoints;
    payload.differences.opponentProjectedSlots = opponent.summary.projectedSlots;
    payload.differences.opponentInjuryFlags = opponent.summary.injuryFlags;
  }
  if (input.opponentError) {
    payload.opponentError = input.opponentError;
  }
  return payload;
}

function matchupTeam(matchup: AssembleMatchupInput["matchup"], teamKey: string): YahooMatchupTeam | undefined {
  return matchup?.teams.find((team) => team.teamKey === teamKey);
}

function assignStarters(slots: ReturnType<typeof expandStartingSlots>, players: MatchupPlayerView[]): Array<MatchupPlayerView | undefined> {
  const assignment: Array<MatchupPlayerView | undefined> = Array(slots.length).fill(undefined);
  const remaining = new Map<string, MatchupPlayerView[]>();
  for (const player of players) {
    if (!player.slot || rosterGroup(player.slot) !== "starter") {
      continue;
    }
    const list = remaining.get(player.slot) ?? [];
    list.push(player);
    remaining.set(player.slot, list);
  }
  for (let index = 0; index < slots.length; index += 1) {
    const next = remaining.get(slots[index].position)?.shift();
    if (next) {
      assignment[index] = next;
    }
  }
  return assignment;
}

function buildSide(
  teamKey: string,
  score: YahooMatchupTeam,
  players: MatchupPlayerView[],
  starters: Array<MatchupPlayerView | undefined>,
  totalSlots: number,
): MatchupSide {
  const filled = starters.filter((player): player is MatchupPlayerView => Boolean(player));
  const known = filled.filter((player) => player.weeklyProjectedPoints !== undefined);
  const side: MatchupSide = {
    teamKey,
    teamId: score.teamId,
    name: score.name,
    summary: {
      knownProjectedPoints: known.reduce((sum, player) => sum + (player.weeklyProjectedPoints ?? 0), 0),
      projectedSlots: known.length,
      totalSlots,
      injuryFlags: filled.filter((player) => Boolean(explicitStatus(player))).length,
      playersWithWeeklyIntelligence: filled.filter((player) => player.identityStatus === "matched" && player.weeklyCoverage !== "none").length,
    },
    bench: players.filter((player) => rosterGroup(player.slot) === "bench"),
    ir: players.filter((player) => rosterGroup(player.slot) === "ir"),
  };
  if (score.points !== undefined) {
    side.points = score.points;
  }
  if (score.projectedPoints !== undefined) {
    side.yahooProjectedPoints = score.projectedPoints;
  }
  return side;
}

function toView(yahoo: YahooRosterPlayer, intel: PlayerIntelligence | undefined, fantasyTeam?: string): MatchupPlayerView {
  const matched = intel?.identity.status === "matched";
  const weekly = matched ? intel?.weekly : undefined;
  const injury = matched ? intel?.injury : undefined;
  const coverage = weeklyCoverage(weekly?.projectedPoints, weekly?.ecr);
  const view: MatchupPlayerView = {
    yahooPlayerKey: yahoo.playerKey,
    name: yahoo.name,
    identityStatus: intel?.identity.status ?? "unresolved",
    weeklyCoverage: coverage,
    weeklyDataLabel: weeklyDataLabel(intel?.identity.status ?? "unresolved", coverage),
    warnings: intel?.warnings ?? ["Intelligence unavailable"],
  };
  if (yahoo.editorialTeamAbbr) {
    view.team = yahoo.editorialTeamAbbr;
  }
  if (yahoo.displayPosition) {
    view.position = yahoo.displayPosition;
  } else if (intel?.player.position) {
    view.position = intel.player.position;
  }
  if (yahoo.selectedPosition) {
    view.slot = yahoo.selectedPosition;
  }
  if (yahoo.byeWeek !== undefined) {
    view.byeWeek = yahoo.byeWeek;
  }
  if (fantasyTeam) {
    view.fantasyTeam = fantasyTeam;
  }
  if (weekly?.projectedPoints !== undefined) {
    view.weeklyProjectedPoints = weekly.projectedPoints;
  }
  if (weekly?.ecr !== undefined) {
    view.weeklyEcr = weekly.ecr;
  }
  if (injury?.status) {
    view.injuryStatus = injury.status;
  }
  if (injury?.practiceStatus) {
    view.practiceStatus = injury.practiceStatus;
  }
  if (injury?.description) {
    view.injuryDescription = injury.description;
  }
  const yahooStatus = yahoo.statusFull ?? expandYahooStatus(yahoo.status);
  if (yahooStatus) {
    view.yahooStatus = yahooStatus;
  }
  if (intel?.identity.method) {
    view.identityMethod = intel.identity.method;
  }
  return view;
}

function weeklyCoverage(projectedPoints?: number, ecr?: number): MatchupWeeklyCoverage {
  if (projectedPoints !== undefined && ecr !== undefined) {
    return "projection+ecr";
  }
  if (projectedPoints !== undefined) {
    return "projection";
  }
  if (ecr !== undefined) {
    return "ecr";
  }
  return "none";
}

function weeklyDataLabel(status: string, coverage: MatchupWeeklyCoverage): string {
  if (status === "unresolved") {
    return "Intelligence unavailable";
  }
  if (status === "ambiguous") {
    return "Identity needs review";
  }
  if (coverage === "projection+ecr") {
    return "Projection + ECR";
  }
  if (coverage === "projection") {
    return "Projection only";
  }
  if (coverage === "ecr") {
    return "ECR only";
  }
  return "No weekly data";
}

function expandYahooStatus(status?: string): string | undefined {
  const code = status?.trim().toUpperCase();
  if (!code) {
    return undefined;
  }
  if (code === "Q") {
    return "Questionable";
  }
  if (code === "D") {
    return "Doubtful";
  }
  if (code === "O") {
    return "Out";
  }
  if (code === "IR" || code.startsWith("IR")) {
    return "IR";
  }
  if (code === "SUSP") {
    return "Suspended";
  }
  if (EXPLICIT_STATUS.test(code)) {
    return status;
  }
  return undefined;
}

function explicitStatus(player: MatchupPlayerView): string | undefined {
  for (const value of [player.injuryStatus, player.yahooStatus]) {
    if (value && EXPLICIT_STATUS.test(value.trim())) {
      return value;
    }
  }
  return undefined;
}

function availabilityNotes(
  user: MatchupSide | undefined,
  opponent: MatchupSide | undefined,
  slots: MatchupSlotRow[],
): MatchupAvailabilityNote[] {
  const notes: MatchupAvailabilityNote[] = [];
  for (const row of slots) {
    pushNote(notes, user?.name, row.user, "starter");
    pushNote(notes, opponent?.name, row.opponent, "starter");
  }
  for (const player of user?.bench ?? []) {
    pushNote(notes, user?.name, player, "bench");
  }
  for (const player of opponent?.bench ?? []) {
    pushNote(notes, opponent?.name, player, "bench");
  }
  for (const player of user?.ir ?? []) {
    pushNote(notes, user?.name, player, "ir");
  }
  for (const player of opponent?.ir ?? []) {
    pushNote(notes, opponent?.name, player, "ir");
  }
  return notes;
}

function pushNote(
  notes: MatchupAvailabilityNote[],
  teamName: string | undefined,
  player: MatchupPlayerView | undefined,
  group: MatchupAvailabilityNote["group"],
): void {
  if (!player || !teamName) {
    return;
  }
  const status = explicitStatus(player);
  if (!status) {
    return;
  }
  const note: MatchupAvailabilityNote = {
    teamName,
    playerName: player.name,
    group,
    status,
  };
  if (player.slot) {
    note.slot = player.slot;
  }
  notes.push(note);
}
