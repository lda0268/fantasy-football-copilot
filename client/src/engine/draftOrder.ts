import type { LeagueSettings } from "../types/league";

export function getRoundForPick(overallPick: number, teamCount: number): number {
  return Math.ceil(overallPick / teamCount);
}

export function getTeamSlotForPick(overallPick: number, teamCount: number): number {
  const round = getRoundForPick(overallPick, teamCount);
  const positionInRound = (overallPick - 1) % teamCount;

  if (round % 2 === 1) {
    return positionInRound + 1;
  }

  return teamCount - positionInRound;
}

export function isUserOnClock(
  currentPick: number,
  userSlot: number,
  teamCount: number,
): boolean {
  return getTeamSlotForPick(currentPick, teamCount) === userSlot;
}

export function getPicksUntilUserPick(
  currentPick: number,
  userSlot: number,
  teamCount: number,
): number {
  if (isUserOnClock(currentPick, userSlot, teamCount)) {
    return 0;
  }

  let pick = currentPick;
  let safety = 0;

  while (safety < teamCount * 2) {
    if (getTeamSlotForPick(pick, teamCount) === userSlot) {
      return pick - currentPick;
    }
    pick += 1;
    safety += 1;
  }

  return teamCount;
}

export function getNextUserPick(
  currentPick: number,
  userSlot: number,
  teamCount: number,
): number {
  if (isUserOnClock(currentPick, userSlot, teamCount)) {
    return currentPick;
  }

  return currentPick + getPicksUntilUserPick(currentPick, userSlot, teamCount);
}

export function scheduledDraftRounds(
  league: Pick<LeagueSettings, "rosterSlots" | "benchCount">,
): number {
  const slots = league.rosterSlots;
  return (
    slots.QB +
    slots.RB +
    slots.WR +
    slots.TE +
    slots.FLEX +
    slots.SUPERFLEX +
    slots.K +
    slots.DEF +
    league.benchCount
  );
}

export function remainingUserPicksInDraft(
  currentPick: number,
  userSlot: number,
  teamCount: number,
  totalPicks: number,
): number {
  let count = 0;
  for (let pick = Math.max(1, currentPick); pick <= totalPicks; pick += 1) {
    if (getTeamSlotForPick(pick, teamCount) === userSlot) {
      count += 1;
    }
  }
  return count;
}

export function listUserPickOveralls(
  fromPick: number,
  userSlot: number,
  teamCount: number,
  count: number,
): number[] {
  const picks: number[] = [];
  let pick = Math.max(1, fromPick);
  const limit = fromPick + teamCount * count * 2 + teamCount;
  while (picks.length < count && pick <= limit) {
    if (getTeamSlotForPick(pick, teamCount) === userSlot) {
      picks.push(pick);
    }
    pick += 1;
  }
  return picks;
}

export function isBackToBackUserTurn(
  overallPick: number,
  userSlot: number,
  teamCount: number,
): boolean {
  return (
    getTeamSlotForPick(overallPick, teamCount) === userSlot &&
    getTeamSlotForPick(overallPick + 1, teamCount) === userSlot
  );
}

export function countOpponentPicksUntil(
  fromPick: number,
  untilPickExclusive: number,
  userSlot: number,
  teamCount: number,
): number {
  let count = 0;
  for (let pick = fromPick; pick < untilPickExclusive; pick += 1) {
    if (getTeamSlotForPick(pick, teamCount) !== userSlot) {
      count += 1;
    }
  }
  return count;
}
