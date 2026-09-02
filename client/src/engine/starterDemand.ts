import type { Player, Position } from "../types/draft";
import {
  dedicatedStarterCount,
  type LeagueSettings,
} from "../types/league";
import { playersAtPosition } from "./players";

export function expectedStarterDemand(
  league: LeagueSettings,
  position: Position,
  playerUniverse: Player[],
): number {
  const dedicated = dedicatedStarterCount(league, position);
  const flexShare = sharedSlotDemand(
    league,
    position,
    playerUniverse,
    league.rosterSlots.FLEX,
    league.flexEligibility,
    1,
  );
  const superflexShare = superflexSlotDemand(league, position, playerUniverse);
  const startableDepth = superflexStartableDepth(league, position);

  return dedicated + flexShare + superflexShare + startableDepth;
}

function superflexSlotDemand(
  league: LeagueSettings,
  position: Position,
  playerUniverse: Player[],
): number {
  const slotsPerTeam = league.rosterSlots.SUPERFLEX;
  const eligibility = league.superflexEligibility;
  if (slotsPerTeam <= 0 || !eligibility.includes(position)) {
    return 0;
  }

  const totalSlots = league.teamCount * slotsPerTeam;
  const qbEligible = eligibility.includes("QB");
  const skillEligible = eligibility.filter((item) => item !== "QB");
  const qbQuality = qbEligible
    ? marginalSharedSlotQuality(league, playerUniverse, "QB", totalSlots) * 1.55
    : 0;
  const skillQualities = skillEligible.map((item) =>
    marginalSharedSlotQuality(league, playerUniverse, item, totalSlots),
  );
  const bestSkill = Math.max(1, ...skillQualities, 0);
  const qbShare = qbEligible ? qbQuality / (qbQuality + bestSkill) : 0;

  if (position === "QB") {
    return totalSlots * qbShare;
  }

  const skillSlots = totalSlots * (1 - qbShare);
  const skillTotal = skillQualities.reduce((sum, value) => sum + Math.max(value, 1), 0);
  const index = skillEligible.indexOf(position);
  if (index < 0 || skillTotal <= 0) {
    return 0;
  }

  return skillSlots * (Math.max(skillQualities[index], 1) / skillTotal);
}

function superflexStartableDepth(league: LeagueSettings, position: Position): number {
  if (position !== "QB" || league.rosterSlots.SUPERFLEX <= 0) {
    return 0;
  }

  return league.teamCount * 0.2 * league.rosterSlots.SUPERFLEX;
}

function sharedSlotDemand(
  league: LeagueSettings,
  position: Position,
  playerUniverse: Player[],
  slotsPerTeam: number,
  eligibility: Position[],
  positionBias: number,
): number {
  if (slotsPerTeam <= 0 || !eligibility.includes(position)) {
    return 0;
  }

  const totalSlots = league.teamCount * slotsPerTeam;
  const weights = eligibility.map((eligible) => {
    const quality = marginalSharedSlotQuality(league, playerUniverse, eligible, totalSlots);
    return Math.max(quality, 1) * (eligible === position ? positionBias : 1);
  });

  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const positionIndex = eligibility.indexOf(position);
  if (positionIndex < 0 || totalWeight <= 0) {
    return 0;
  }

  return totalSlots * (weights[positionIndex] / totalWeight);
}

function marginalSharedSlotQuality(
  league: LeagueSettings,
  playerUniverse: Player[],
  position: Position,
  sharedSlots: number,
): number {
  const ranked = playersAtPosition(playerUniverse, position);
  if (ranked.length === 0) {
    return 1;
  }

  const afterDedicated = dedicatedStarterCount(league, position);
  const start = Math.min(ranked.length - 1, afterDedicated);
  const take = Math.max(1, sharedSlots);
  const slice = ranked.slice(start, start + take);
  const used = slice.length > 0 ? slice : [ranked[ranked.length - 1]];
  return used.reduce((sum, player) => sum + player.projectedPoints, 0) / used.length;
}

export function replacementRankForPosition(
  league: LeagueSettings,
  position: Position,
  playerUniverse: Player[],
): number {
  const demand = expectedStarterDemand(league, position, playerUniverse);
  return Math.max(1, Math.round(demand) + 1);
}
