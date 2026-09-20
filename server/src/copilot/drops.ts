import type { YahooRosterPlayer } from "../yahoo/types.js";
import { MIN_REMAINING_USABLE_AFTER_DROP } from "./config.js";
import { rankSeverity } from "./candidateScore.js";
import {
  isAvailableThisWeek,
  isBench,
  isStarterSlot,
  playersAtPosition,
  primaryPosition,
} from "./rosterNeeds.js";
import type { CopilotPosition, NeedSeverity, WaiverRecommendation } from "./types.js";

export function selectDropCandidateForAdd(
  roster: YahooRosterPlayer[],
  week: number | null,
  addPosition: CopilotPosition | undefined,
  addSeverity: NeedSeverity | undefined,
): WaiverRecommendation["dropPlayer"] | undefined {
  if (!addSeverity || rankSeverity(addSeverity) < rankSeverity("medium")) {
    return undefined;
  }

  const bench = roster.filter(isBench);
  const options = bench
    .filter((player) => canDropWithoutHole(roster, player, week, addPosition))
    .sort((a, b) => surplus(roster, b, week) - surplus(roster, a, week) || a.name.localeCompare(b.name));

  const chosen = options[0];
  if (!chosen) {
    return undefined;
  }

  const drop: NonNullable<WaiverRecommendation["dropPlayer"]> = {
    playerKey: chosen.playerKey,
    playerId: chosen.playerId,
    name: chosen.name,
  };
  if (chosen.displayPosition) {
    drop.displayPosition = chosen.displayPosition;
  }
  if (chosen.selectedPosition) {
    drop.selectedPosition = chosen.selectedPosition;
  }
  return drop;
}

function canDropWithoutHole(
  roster: YahooRosterPlayer[],
  drop: YahooRosterPlayer,
  week: number | null,
  addPosition: CopilotPosition | undefined,
): boolean {
  if (isStarterSlot(drop)) {
    return false;
  }
  const position = primaryPosition(drop);
  if (!position) {
    return false;
  }
  if (addPosition && position === addPosition) {
    const remaining = playersAtPosition(roster, position).filter(
      (player) => player.playerKey !== drop.playerKey && isAvailableThisWeek(player, week),
    );
    if (remaining.length < MIN_REMAINING_USABLE_AFTER_DROP) {
      return false;
    }
  }
  const remaining = playersAtPosition(roster, position).filter(
    (player) => player.playerKey !== drop.playerKey && isAvailableThisWeek(player, week),
  );
  return remaining.length >= MIN_REMAINING_USABLE_AFTER_DROP;
}

function surplus(roster: YahooRosterPlayer[], player: YahooRosterPlayer, week: number | null): number {
  const position = primaryPosition(player);
  if (!position) {
    return 0;
  }
  return playersAtPosition(roster, position).filter((item) => isAvailableThisWeek(item, week)).length;
}
