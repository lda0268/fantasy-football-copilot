import type { Player, Position, RosterSlot } from "../types/draft";
import { DEFAULT_LEAGUE, slotAcceptsPosition, type LeagueSettings } from "../types/league";
import { getRoundForPick, remainingUserPicksInDraft, scheduledDraftRounds } from "./draftOrder";
import { clamp, logistic } from "./math";
import { assignPlayerToRoster } from "./roster";
import { countRosteredPosition } from "./opponentRosters";

export type RosterNeedKind = "starter" | "flex" | "superflex" | "depth" | "complete";

export interface RosterNeedContext {
  currentPick?: number;
  teamCount?: number;
  userSlot?: number;
  remainingUserPicks?: number;
  baseStarterPoints?: number;
}

export interface RosterNeed {
  kind: RosterNeedKind;
  score: number;
  starterOpen: boolean;
  flexOpen: boolean;
  superflexOpen: boolean;
  starterSlotUtility: number;
  marginalStartingLineupValue: number;
  starterPressure: number;
  diminishingFactor: number;
  completionPressure: number;
  crowdingFactor: number;
}

export function expectedStartableSlots(league: LeagueSettings, position: Position): number {
  const slots = league.rosterSlots;
  switch (position) {
    case "QB":
      return slots.QB + slots.SUPERFLEX;
    case "RB":
      return slots.RB + slots.FLEX;
    case "WR":
      return slots.WR + slots.FLEX;
    case "TE":
      return slots.TE;
    case "K":
      return slots.K;
    case "DEF":
      return slots.DEF;
    default:
      return 0;
  }
}

export function starterLineupPoints(roster: RosterSlot[]): number {
  return roster.reduce((sum, slot) => {
    if (slot.slotType === "BENCH" || slot.slotType === "IR" || !slot.player) {
      return sum;
    }
    return sum + slot.player.projectedPoints;
  }, 0);
}

export function marginalStartingLineupValue(
  roster: RosterSlot[],
  player: Player,
  league: LeagueSettings = DEFAULT_LEAGUE,
  baseStarterPoints?: number,
): number {
  const before = baseStarterPoints ?? starterLineupPoints(roster);
  const after = starterLineupPoints(assignPlayerToRoster(roster, player, league));
  return Math.max(0, after - before);
}

export function diminishingDepthFactor(
  position: Position,
  rosteredCount: number,
  league: LeagueSettings,
): number {
  const after = rosteredCount + 1;
  const startable = Math.max(1, expectedStartableSlots(league, position));
  if (after <= startable) {
    return 1;
  }

  const extra = after - startable;
  if (position === "QB") {
    return extra === 1 ? 0.34 : 0.1;
  }
  if (position === "TE") {
    return Math.max(0.06, 0.48 ** extra);
  }
  if (position === "WR") {
    return Math.max(0.08, 0.6 ** extra);
  }
  if (position === "RB") {
    return Math.max(0.12, 0.68 ** extra);
  }
  return extra >= 1 ? 0.05 : 1;
}

export function starterPressure(input: {
  position: Position;
  rosteredCount: number;
  round: number;
  league: LeagueSettings;
}): number {
  const { position, rosteredCount, round, league } = input;
  const target = expectedStartableSlots(league, position);
  const missing = Math.max(0, target - rosteredCount);

  if (position === "K" || position === "DEF") {
    return missing > 0 ? logistic(round, 14, 0.55) : 0;
  }

  if (missing === 0) {
    if (position === "QB" && rosteredCount === target) {
      return clamp(0.18 * (1 - logistic(round, 11, 0.45)), 0, 0.2);
    }
    return 0.04;
  }

  if (position === "QB") {
    if (league.rosterSlots.SUPERFLEX > 0 && missing >= 2) {
      return clamp(0.42 + 0.58 * logistic(round, 2.4, 1.15), 0, 1);
    }
    if (league.rosterSlots.SUPERFLEX > 0 && missing === 1) {
      return clamp(0.22 + 0.7 * logistic(round, 5.4, 0.75), 0, 1);
    }
    return clamp(0.12 + 0.7 * logistic(round, 4.2, 0.7), 0, 1);
  }

  if (position === "TE") {
    return clamp(0.2 + 0.7 * logistic(round, 6.5, 0.55), 0, 1);
  }

  const midpoint = position === "WR" ? 4.5 : 3.2;
  return clamp(0.18 + 0.65 * logistic(round, midpoint, 0.6) * Math.min(1, missing / target), 0, 1);
}

export function rosterCompletionPressure(input: {
  player: Player;
  roster: RosterSlot[];
  league: LeagueSettings;
  remainingUserPicks: number;
  round: number;
}): number {
  const { player, roster, league, remainingUserPicks, round } = input;
  void league;
  const emptyExclusive = exclusiveEmptyCount(roster, player.position);
  if (emptyExclusive <= 0) {
    return 0;
  }

  const holes = requiredExclusiveHoles(roster);
  const picksLeft = Math.max(1, remainingUserPicks);
  const mustFill = picksLeft <= holes + 2;
  const late = logistic(round, 14.2, 0.7);
  const scarcity = clamp(holes / picksLeft, 0, 1.4);

  if (player.position !== "K" && player.position !== "DEF") {
    if (!mustFill || emptyExclusive === 0) {
      return 0;
    }
    if (player.position === "QB" && countRosteredPosition(roster, "QB") === 0) {
      return clamp(0.55 + 0.4 * scarcity, 0, 1);
    }
    return 0;
  }

  if (mustFill) {
    return 0.97;
  }

  return clamp(0.15 + late * 0.7 + scarcity * 0.2, 0, 0.96);
}

function crowdingPenalty(input: {
  player: Player;
  roster: RosterSlot[];
  remainingUserPicks: number;
}): number {
  const holes = requiredExclusiveHoles(input.roster);
  if (holes <= 0) {
    return 1;
  }

  const fillsExclusive = exclusiveEmptyCount(input.roster, input.player.position) > 0;
  const picksLeft = Math.max(1, input.remainingUserPicks);
  if (picksLeft > holes + 2) {
    return 1;
  }
  if (fillsExclusive) {
    return 1;
  }

  return picksLeft <= holes ? 0.08 : 0.18;
}

function exclusiveEmptyCount(roster: RosterSlot[], position: Position): number {
  return roster.filter(
    (slot) => slot.slotType === position && slot.player === null,
  ).length;
}

function requiredExclusiveHoles(roster: RosterSlot[]): number {
  return roster.filter(
    (slot) =>
      slot.player === null &&
      (slot.slotType === "K" ||
        slot.slotType === "DEF" ||
        slot.slotType === "QB" ||
        slot.slotType === "RB" ||
        slot.slotType === "WR" ||
        slot.slotType === "TE"),
  ).length;
}

function slotUtility(
  player: Player,
  starterOpen: boolean,
  flexOpen: boolean,
  superflexOpen: boolean,
): { kind: RosterNeedKind; score: number } {
  if (starterOpen) {
    return { kind: "starter", score: 1 };
  }
  if (superflexOpen && player.position === "QB") {
    return { kind: "superflex", score: 0.86 };
  }
  if (flexOpen) {
    return { kind: "flex", score: 0.55 };
  }
  if (superflexOpen) {
    return { kind: "superflex", score: 0.48 };
  }
  return { kind: "depth", score: 0.22 };
}

export function getRosterNeed(
  roster: RosterSlot[],
  player: Player,
  vorScore: number,
  league: LeagueSettings = DEFAULT_LEAGUE,
  context: RosterNeedContext = {},
): RosterNeed {
  const starterOpen = roster.some(
    (slot) =>
      slot.slotType === player.position &&
      slot.player === null &&
      slotAcceptsPosition(slot.slotType, player.position, league),
  );
  const flexOpen = roster.some(
    (slot) => slot.slotType === "FLEX" && slot.player === null && slotAcceptsPosition("FLEX", player.position, league),
  );
  const superflexOpen = roster.some(
    (slot) =>
      slot.slotType === "SUPERFLEX" &&
      slot.player === null &&
      slotAcceptsPosition("SUPERFLEX", player.position, league),
  );

  const rosteredCount = countRosteredPosition(roster, player.position);
  const teamCount = context.teamCount ?? league.teamCount;
  const currentPick = context.currentPick ?? 1;
  const round = getRoundForPick(currentPick, teamCount);
  const totalPicks = scheduledDraftRounds(league) * teamCount;
  const remainingUserPicks =
    context.remainingUserPicks ??
    remainingUserPicksInDraft(currentPick, context.userSlot ?? 1, teamCount, totalPicks);

  const utility = slotUtility(player, starterOpen, flexOpen, superflexOpen);
  const marginal = marginalStartingLineupValue(roster, player, league, context.baseStarterPoints);
  const marginalNorm = clamp(marginal / 110, 0, 1);
  const pressure = starterPressure({
    position: player.position,
    rosteredCount,
    round,
    league,
  });
  const diminish = diminishingDepthFactor(player.position, rosteredCount, league);
  const completion = rosterCompletionPressure({
    player,
    roster,
    league,
    remainingUserPicks,
    round,
  });

  const crowding = crowdingPenalty({
    player,
    roster,
    remainingUserPicks,
  });

  let score = utility.score * 0.34 + marginalNorm * 0.33 + pressure * 0.33;
  score *= diminish;
  score = Math.max(score, completion);
  score *= crowding;

  if (vorScore >= 0.78 && diminish >= 0.7 && completion < 0.5) {
    score = Math.max(score, 0.28);
  }

  const kind = completion >= 0.85 ? "complete" : utility.kind;

  return {
    kind,
    score: clamp(score, 0, 1),
    starterOpen,
    flexOpen,
    superflexOpen,
    starterSlotUtility: utility.score,
    marginalStartingLineupValue: marginal,
    starterPressure: pressure,
    diminishingFactor: diminish,
    completionPressure: completion,
    crowdingFactor: crowding,
  };
}
