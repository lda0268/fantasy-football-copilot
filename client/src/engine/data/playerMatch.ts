import type { Player, Position } from "../../types/draft";
import { identityKeys, normalizeTeam } from "./normalizeName";
import { isPosition, normalizePosition } from "./normalizePosition";

export type MatchStatus = "matched" | "unmatched" | "ambiguous";

export interface IdentityMatch<T> {
  status: MatchStatus;
  record?: T;
  candidates: T[];
}

function recordKeys(record: { name: string; position: string; team?: string }): string[] {
  return identityKeys(record.name, record.position, record.team);
}

export function matchByIdentity<T extends { name: string; position: string; team?: string }>(
  player: Pick<Player, "name" | "position" | "team">,
  records: T[],
): IdentityMatch<T> {
  const playerKeys = new Set(identityKeys(player.name, player.position, player.team));
  const sameIdentity = records.filter((record) => recordKeys(record).some((key) => playerKeys.has(key)));

  if (sameIdentity.length === 1) {
    return { status: "matched", record: sameIdentity[0], candidates: sameIdentity };
  }

  if (sameIdentity.length > 1) {
    const playerTeam = normalizeTeam(player.team);
    const byTeam = sameIdentity.filter((record) => normalizeTeam(record.team) === playerTeam);
    if (playerTeam && byTeam.length === 1) {
      return { status: "matched", record: byTeam[0], candidates: sameIdentity };
    }
    return { status: "ambiguous", candidates: sameIdentity };
  }

  return { status: "unmatched", candidates: [] };
}

export { isPosition, normalizePosition };
export type { Position };
