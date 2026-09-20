import type { YahooAvailablePlayer, YahooRosterPlayer } from "../yahoo/types.js";
import { CORE_POSITIONS } from "./config.js";
import type { CopilotPosition, NeedSeverity, RosterNeed, RosterVulnerability } from "./types.js";

export type InjuryBand = "healthy" | "questionable" | "doubtful" | "out" | "ir";

type AnyPlayer = YahooRosterPlayer | YahooAvailablePlayer;

export function injuryBand(status: string | undefined): InjuryBand {
  const value = (status ?? "").trim().toUpperCase();
  if (value === "IR" || value === "IR-R" || value.includes("INJURED RESERVE")) {
    return "ir";
  }
  if (value === "O" || value === "OUT") {
    return "out";
  }
  if (value === "D" || value === "DOUBTFUL") {
    return "doubtful";
  }
  if (value === "Q" || value === "QUESTIONABLE") {
    return "questionable";
  }
  return "healthy";
}

export function isCorePosition(value: string | undefined): value is CopilotPosition {
  return value !== undefined && (CORE_POSITIONS as readonly string[]).includes(value);
}

export function selectedSlot(player: YahooRosterPlayer): string | undefined {
  return player.selectedPosition;
}

export function isIrSlot(player: YahooRosterPlayer): boolean {
  return selectedSlot(player) === "IR";
}

export function isBench(player: YahooRosterPlayer): boolean {
  return selectedSlot(player) === "BN";
}

export function isStarterSlot(player: YahooRosterPlayer): boolean {
  const slot = selectedSlot(player);
  return slot !== undefined && slot !== "BN" && slot !== "IR";
}

export function primaryPosition(player: AnyPlayer): CopilotPosition | undefined {
  if (isCorePosition(player.displayPosition)) {
    return player.displayPosition;
  }
  return player.eligiblePositions?.find(isCorePosition);
}

export function playerMatchesPosition(player: AnyPlayer, position: CopilotPosition): boolean {
  return player.displayPosition === position || (player.eligiblePositions?.includes(position) ?? false);
}

export function isUnavailable(player: AnyPlayer): boolean {
  const band = injuryBand(player.status);
  return band === "ir" || band === "out";
}

export function isUsableDepth(player: YahooRosterPlayer): boolean {
  if (isIrSlot(player)) {
    return false;
  }
  return !isUnavailable(player);
}

export function isHealthyUsable(player: YahooRosterPlayer): boolean {
  return isUsableDepth(player) && injuryBand(player.status) === "healthy";
}

export function isAvailableThisWeek(player: YahooRosterPlayer, currentWeek: number | null): boolean {
  if (!isUsableDepth(player)) {
    return false;
  }
  if (currentWeek !== null && player.byeWeek === currentWeek) {
    return false;
  }
  return true;
}

export function playersAtPosition(players: YahooRosterPlayer[], position: CopilotPosition): YahooRosterPlayer[] {
  return players.filter((player) => playerMatchesPosition(player, position));
}

export function analyzeRosterNeeds(
  players: YahooRosterPlayer[],
  currentWeek: number | null,
): RosterNeed[] {
  const needs: RosterNeed[] = [];
  for (const position of CORE_POSITIONS) {
    const need = needForPosition(players, position, currentWeek);
    if (need) {
      needs.push(need);
    }
  }
  return needs;
}

export function detectVulnerabilities(
  players: YahooRosterPlayer[],
  currentWeek: number | null,
): RosterVulnerability[] {
  const vulnerabilities: RosterVulnerability[] = [];

  for (const position of CORE_POSITIONS) {
    const atPosition = playersAtPosition(players, position);
    const usable = atPosition.filter(isUsableDepth);
    const availableNow = atPosition.filter((player) => isAvailableThisWeek(player, currentWeek));
    const starters = atPosition.filter(isStarterSlot);

    if (usable.length === 0) {
      vulnerabilities.push({
        type: "empty_slot",
        position,
        severity: "high",
        reason: `No usable ${position} is on the roster.`,
      });
    } else if (atPosition.filter(isHealthyUsable).length === 1) {
      vulnerabilities.push({
        type: "thin_depth",
        position,
        severity: "medium",
        reason: `Only one healthy usable ${position} is on the roster.`,
      });
    }

    for (const starter of starters) {
      const band = injuryBand(starter.status);
      if (band === "ir" || band === "out") {
        const hasReplacement = availableNow.some((player) => player.playerKey !== starter.playerKey);
        vulnerabilities.push({
          type: "injury",
          position,
          playerKey: starter.playerKey,
          playerName: starter.name,
          severity: hasReplacement ? "medium" : "high",
          reason: `${starter.name} is designated ${starter.status ?? band} at ${position}.`,
        });
      } else if (band === "doubtful" || band === "questionable") {
        vulnerabilities.push({
          type: "injury",
          position,
          playerKey: starter.playerKey,
          playerName: starter.name,
          severity: band === "doubtful" ? "medium" : "low",
          reason: `${starter.name} is designated ${starter.status ?? band} at ${position}.`,
        });
      }

      if (currentWeek !== null && starter.byeWeek === currentWeek) {
        const replacement = availableNow.some((player) => player.playerKey !== starter.playerKey);
        vulnerabilities.push({
          type: "bye_week",
          position,
          playerKey: starter.playerKey,
          playerName: starter.name,
          severity: replacement ? "low" : "high",
          reason: replacement
            ? `${starter.name} has a Week ${currentWeek} bye at ${position}, with a roster replacement available.`
            : `${starter.name} has a Week ${currentWeek} bye at ${position}, and no usable replacement is rostered.`,
        });
      }
    }
  }

  return vulnerabilities;
}

function needForPosition(
  players: YahooRosterPlayer[],
  position: CopilotPosition,
  currentWeek: number | null,
): RosterNeed | undefined {
  const atPosition = playersAtPosition(players, position);
  const usable = atPosition.filter(isUsableDepth);
  const healthy = atPosition.filter(isHealthyUsable);
  const availableNow = atPosition.filter((player) => isAvailableThisWeek(player, currentWeek));
  const starters = atPosition.filter(isStarterSlot);
  const reasons: string[] = [];

  const unusableStarter = starters.find((player) => isUnavailable(player) || isIrSlot(player));
  if (usable.length === 0) {
    reasons.push(`No usable ${position} is on the active roster.`);
    return { position, severity: "high", reasons };
  }
  if (unusableStarter && availableNow.filter((player) => player.playerKey !== unusableStarter.playerKey).length === 0) {
    reasons.push(
      `${unusableStarter.name} is not usable at ${position} and no active replacement is rostered.`,
    );
    return { position, severity: "high", reasons };
  }

  const starterOnBye = starters.find(
    (player) => currentWeek !== null && player.byeWeek === currentWeek,
  );
  if (
    starterOnBye &&
    availableNow.filter((player) => player.playerKey !== starterOnBye.playerKey).length === 0
  ) {
    reasons.push(
      `${starterOnBye.name} is on a Week ${currentWeek} bye at ${position} with no rostered replacement.`,
    );
    return { position, severity: "medium", reasons };
  }

  const injuredStarter = starters.find((player) => {
    const band = injuryBand(player.status);
    return band === "questionable" || band === "doubtful";
  });
  const backupUsable = usable.filter((player) => player.playerKey !== injuredStarter?.playerKey);
  if (injuredStarter && backupUsable.length === 0) {
    reasons.push(
      `${injuredStarter.name} has an injury designation at ${position} and remaining healthy depth is weak.`,
    );
    return { position, severity: "medium", reasons };
  }
  if (injuredStarter && backupUsable.some(isHealthyUsable)) {
    reasons.push(
      `${injuredStarter.name} is ${injuredStarter.status} at ${position}, but a healthy roster option exists.`,
    );
    return { position, severity: "low", reasons };
  }

  if (healthy.length === 1) {
    reasons.push(`Only one healthy usable ${position} is on the roster.`);
    return { position, severity: "medium", reasons };
  }

  if (healthy.length === 2 && (position === "RB" || position === "WR")) {
    reasons.push(`${position} depth is limited to two healthy usable players.`);
    return { position, severity: "low", reasons };
  }

  return undefined;
}
