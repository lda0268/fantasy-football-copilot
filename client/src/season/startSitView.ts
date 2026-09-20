import { WEEKLY_SUPPORT_LABELS } from "./labels";
import type { StartSitAssignment, StartSitLineupPlayer } from "../api/types";

export function formatScoringFormat(value: string | undefined): string {
  if (!value) {
    return "Unavailable";
  }
  if (value === "half_ppr") {
    return "Half PPR";
  }
  if (value === "ppr") {
    return "PPR";
  }
  if (value === "standard") {
    return "Standard";
  }
  return value;
}

export function formatBackendDelta(value: number): string {
  const abs = Number.isInteger(value) ? String(Math.abs(value)) : Math.abs(value).toFixed(1);
  if (value > 0) {
    return `+${abs} pts`;
  }
  if (value < 0) {
    return `−${abs} pts`;
  }
  return `${abs} pts`;
}

export function weeklySupportLabel(quality: string | undefined): string {
  return WEEKLY_SUPPORT_LABELS[quality ?? ""] ?? "Limited weekly data";
}

export function slotChanged(current?: StartSitAssignment, recommended?: StartSitAssignment): boolean {
  return (current?.player?.yahooPlayerKey ?? "") !== (recommended?.player?.yahooPlayerKey ?? "");
}

export function playerStatus(player?: StartSitLineupPlayer): string {
  return player?.injuryStatus ?? "—";
}

export function identityLabel(status: string | undefined): string | undefined {
  if (status === "unresolved" || status === "ambiguous") {
    return "Limited intelligence";
  }
  return undefined;
}
