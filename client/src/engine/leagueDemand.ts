import type { DraftPick, Player, RosterSlot } from "../types/draft";
import type { LeagueSettings } from "../types/league";
import { buildLeagueRosters, countRosteredPosition, slotOpen } from "./opponentRosters";

export interface LeagueDemand {
  teamsNeedingQb1: number;
  teamsNeedingQb2OrSuperflex: number;
  teamsNeedingRbStarters: number;
  teamsNeedingWrStarters: number;
  flexSpotsRemaining: number;
  superflexSpotsRemaining: number;
}

function demandFromRosters(
  rosters: Map<number, RosterSlot[]>,
  league: LeagueSettings,
): LeagueDemand {
  let teamsNeedingQb1 = 0;
  let teamsNeedingQb2OrSuperflex = 0;
  let teamsNeedingRbStarters = 0;
  let teamsNeedingWrStarters = 0;
  let flexSpotsRemaining = 0;
  let superflexSpotsRemaining = 0;

  for (const roster of rosters.values()) {
    const qbCount = countRosteredPosition(roster, "QB");
    if (slotOpen(roster, "QB")) {
      teamsNeedingQb1 += 1;
    }
    if (league.rosterSlots.SUPERFLEX > 0 && qbCount < league.rosterSlots.QB + 1) {
      teamsNeedingQb2OrSuperflex += 1;
    }
    if (slotOpen(roster, "RB")) {
      teamsNeedingRbStarters += 1;
    }
    if (slotOpen(roster, "WR")) {
      teamsNeedingWrStarters += 1;
    }
    flexSpotsRemaining += roster.filter((slot) => slot.slotType === "FLEX" && slot.player === null).length;
    superflexSpotsRemaining += roster.filter(
      (slot) => slot.slotType === "SUPERFLEX" && slot.player === null,
    ).length;
  }

  return {
    teamsNeedingQb1,
    teamsNeedingQb2OrSuperflex,
    teamsNeedingRbStarters,
    teamsNeedingWrStarters,
    flexSpotsRemaining,
    superflexSpotsRemaining,
  };
}

export function estimateLeagueDemand(
  picks: DraftPick[],
  league: LeagueSettings,
  players?: Player[],
): LeagueDemand {
  if (players && players.length > 0) {
    return demandFromRosters(buildLeagueRosters(picks, players, league), league);
  }

  const byTeam = new Map<number, { QB: number; RB: number; WR: number; TE: number }>();

  for (let slot = 1; slot <= league.teamCount; slot += 1) {
    byTeam.set(slot, { QB: 0, RB: 0, WR: 0, TE: 0 });
  }

  for (const pick of picks) {
    const counts = byTeam.get(pick.teamSlot);
    if (!counts) {
      continue;
    }
    if (pick.position === "QB" || pick.position === "RB" || pick.position === "WR" || pick.position === "TE") {
      counts[pick.position] += 1;
    }
  }

  let teamsNeedingQb1 = 0;
  let teamsNeedingQb2OrSuperflex = 0;
  let teamsNeedingRbStarters = 0;
  let teamsNeedingWrStarters = 0;
  let flexSpotsRemaining = 0;
  let superflexSpotsRemaining = 0;

  for (const counts of byTeam.values()) {
    const qbStartersNeeded = league.rosterSlots.QB;
    const qb2Needed = league.rosterSlots.SUPERFLEX > 0 ? qbStartersNeeded + 1 : qbStartersNeeded;

    if (counts.QB < qbStartersNeeded) {
      teamsNeedingQb1 += 1;
    }
    if (league.rosterSlots.SUPERFLEX > 0 && counts.QB < qb2Needed) {
      teamsNeedingQb2OrSuperflex += 1;
    }
    if (counts.RB < league.rosterSlots.RB) {
      teamsNeedingRbStarters += 1;
    }
    if (counts.WR < league.rosterSlots.WR) {
      teamsNeedingWrStarters += 1;
    }

    const skillStarters = league.rosterSlots.RB + league.rosterSlots.WR + league.rosterSlots.TE;
    const skillDrafted = counts.RB + counts.WR + counts.TE;
    flexSpotsRemaining += Math.max(0, skillStarters + league.rosterSlots.FLEX - skillDrafted);

    const sfFilledByQb = Math.max(0, counts.QB - league.rosterSlots.QB);
    const sfFilledBySkill = Math.max(0, skillDrafted - skillStarters);
    superflexSpotsRemaining += Math.max(
      0,
      league.rosterSlots.SUPERFLEX - sfFilledByQb - Math.min(league.rosterSlots.SUPERFLEX, sfFilledBySkill),
    );
  }

  return {
    teamsNeedingQb1,
    teamsNeedingQb2OrSuperflex,
    teamsNeedingRbStarters,
    teamsNeedingWrStarters,
    flexSpotsRemaining,
    superflexSpotsRemaining,
  };
}

export function formatLeagueDemand(demand: LeagueDemand): string {
  return `QB1 ${demand.teamsNeedingQb1} · SF QB ${demand.teamsNeedingQb2OrSuperflex} · RB ${demand.teamsNeedingRbStarters} · WR ${demand.teamsNeedingWrStarters}`;
}
