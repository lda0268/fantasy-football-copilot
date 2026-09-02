import type { Player } from "../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../types/league";
import { getMarketAdp } from "./data/sourceFields";
import { getTeamSlotForPick } from "./draftOrder";
import type { DraftLearning } from "./draftLearning";
import { emptyDraftLearning } from "./draftLearning";
import { clamp } from "./math";
import type { LeagueRosters } from "./opponentRosters";
import { cloneLeagueRosters } from "./opponentRosters";
import { assignPlayerToRoster } from "./roster";
import { getRosterNeed } from "./rosterNeed";

export interface PredictedPick {
  overallPick: number;
  teamSlot: number;
  player: Player;
}

export interface DraftWindowSimulation {
  predictedPicks: PredictedPick[];
  remaining: Player[];
}

export function opponentPickScore(input: {
  player: Player;
  currentPick: number;
  roster: ReturnType<LeagueRosters["get"]>;
  learning: DraftLearning;
  league?: LeagueSettings;
  teamCount?: number;
  teamSlot?: number;
}): number {
  const roster = input.roster ?? [];
  const league = input.league ?? DEFAULT_LEAGUE;
  const adp = getMarketAdp(input.player) ?? input.currentPick + 48;
  const adpFit = 1 / (1 + Math.exp((adp - input.currentPick - 3.5) / 6));
  const need = getRosterNeed(roster, input.player, 0.5, league, {
    currentPick: input.currentPick,
    teamCount: input.teamCount ?? league.teamCount,
    userSlot: input.teamSlot ?? 1,
  });
  let score = adpFit * 0.62 + need.score * 0.38;

  if (input.learning.runPosition === input.player.position) {
    score += 0.12;
  }
  const positionReach = input.learning.positionMeanReach[input.player.position];
  if (positionReach !== undefined && positionReach < -4) {
    score += 0.08;
  }

  return clamp(score, 0, 1.2);
}

export function simulateDraftWindow(input: {
  currentPick: number;
  picksUntilUserPick: number;
  userSlot: number;
  teamCount: number;
  availablePlayers: Player[];
  leagueRosters: LeagueRosters;
  league?: LeagueSettings;
  learning?: DraftLearning;
}): DraftWindowSimulation {
  const league = input.league ?? DEFAULT_LEAGUE;
  const learning = input.learning ?? emptyDraftLearning();
  const remaining = [...input.availablePlayers];
  const rosters = cloneLeagueRosters(input.leagueRosters);
  const predictedPicks: PredictedPick[] = [];
  const horizon = Math.max(0, input.picksUntilUserPick);

  for (let offset = 0; offset < horizon; offset += 1) {
    const overallPick = input.currentPick + offset;
    const teamSlot = getTeamSlotForPick(overallPick, input.teamCount);
    if (teamSlot === input.userSlot) {
      continue;
    }
    if (remaining.length === 0) {
      break;
    }

    const roster = rosters.get(teamSlot) ?? [];
    let best = remaining[0];
    let bestScore = -Infinity;
    for (const player of remaining) {
      const score = opponentPickScore({
        player,
        currentPick: overallPick,
        roster,
        learning,
        league,
        teamCount: input.teamCount,
        teamSlot,
      });
      if (score > bestScore) {
        best = player;
        bestScore = score;
      }
    }

    predictedPicks.push({ overallPick, teamSlot, player: best });
    remaining.splice(remaining.findIndex((player) => player.id === best.id), 1);
    rosters.set(teamSlot, assignPlayerToRoster(roster, best, league));
  }

  return { predictedPicks, remaining };
}
