import type { DraftPick, DraftState, Player } from "../types/draft";
import { getRoundForPick, getTeamSlotForPick } from "./draftOrder";
import { assignPlayerToRoster, removePlayerFromRoster } from "./roster";

export function applyDraftPick(state: DraftState, player: Player): DraftState {
  if (state.draftedPlayerIds.includes(player.id)) {
    return state;
  }

  const overallPick = state.currentPick;
  const round = getRoundForPick(overallPick, state.teamCount);
  const teamSlot = getTeamSlotForPick(overallPick, state.teamCount);
  const isUserPick = teamSlot === state.userSlot;

  const pick: DraftPick = {
    overallPick,
    round,
    teamSlot,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
  };

  return {
    ...state,
    currentPick: state.currentPick + 1,
    picks: [...state.picks, pick],
    draftedPlayerIds: [...state.draftedPlayerIds, player.id],
    roster: isUserPick ? assignPlayerToRoster(state.roster, player, state.league) : state.roster,
  };
}

export function undoDraftPick(state: DraftState): DraftState {
  if (state.picks.length === 0) {
    return state;
  }

  const lastPick = state.picks[state.picks.length - 1];
  const wasUserPick = lastPick.teamSlot === state.userSlot;

  return {
    ...state,
    currentPick: state.currentPick - 1,
    picks: state.picks.slice(0, -1),
    draftedPlayerIds: state.draftedPlayerIds.filter((id) => id !== lastPick.playerId),
    roster: wasUserPick
      ? removePlayerFromRoster(state.roster, lastPick.playerId, state.league)
      : state.roster,
  };
}

export function availableAfterPicks(players: Player[], draftedPlayerIds: string[]): Player[] {
  const drafted = new Set(draftedPlayerIds);
  return players.filter((player) => !drafted.has(player.id));
}
