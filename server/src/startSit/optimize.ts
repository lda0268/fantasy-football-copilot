import type { NflPosition } from "../playerIdentity/types.js";
import { playerFillsSlot } from "./eligibility.js";
import type { StartSitSlot } from "./types.js";
import { round4 } from "./weeklyValue.js";

export type OptimizablePlayer = {
  key: string;
  name: string;
  positions: NflPosition[];
  eligibleToStart: boolean;
  currentSlotId?: string;
  weeklyProjectedPoints?: number;
  weeklyEcrNorm?: number;
  valueBySlot: Array<number | undefined>;
};

export function optimizeAssignment(
  slots: StartSitSlot[],
  players: OptimizablePlayer[],
  locked: Map<number, number> = new Map(),
): Array<number | undefined> {
  const n = players.length;
  const m = slots.length;
  if (m === 0) {
    return [];
  }
  if (n > 22) {
    throw new Error("Start/Sit optimizer supports at most 22 roster players.");
  }

  const size = 1 << n;
  const neg = Number.NEGATIVE_INFINITY;
  const best = Array.from({ length: m + 1 }, () => Array<number>(size).fill(neg));
  const kept = Array.from({ length: m + 1 }, () => Array<number>(size).fill(-1));
  const prevMask = Array.from({ length: m + 1 }, () => Array<number>(size).fill(-1));
  const prevPick = Array.from({ length: m + 1 }, () => Array<number>(size).fill(-2));
  const tieKey = Array.from({ length: m + 1 }, () => Array<string>(size).fill(""));

  best[0][0] = 0;
  kept[0][0] = 0;
  tieKey[0][0] = "";

  const lockedPlayerToSlot = new Map<number, number>();
  for (const [slotIndex, playerIndex] of locked) {
    lockedPlayerToSlot.set(playerIndex, slotIndex);
  }

  for (let slot = 0; slot < m; slot += 1) {
    for (let mask = 0; mask < size; mask += 1) {
      if (best[slot][mask] === neg) {
        continue;
      }
      const candidates: number[] = [];
      for (let player = 0; player < n; player += 1) {
        if ((mask & (1 << player)) !== 0) {
          continue;
        }
        const requiredPlayer = locked.get(slot);
        const requiredSlot = lockedPlayerToSlot.get(player);
        const value = players[player].valueBySlot[slot];
        const lockedHere = requiredPlayer === player;
        if (value === undefined && !lockedHere) {
          continue;
        }
        if (requiredSlot !== undefined && requiredSlot !== slot) {
          continue;
        }
        if (requiredPlayer !== undefined && requiredPlayer !== player) {
          continue;
        }
        candidates.push(player);
      }

      const canLeaveEmpty = candidates.length === 0 && locked.get(slot) === undefined;
      if (canLeaveEmpty) {
        consider(slot, mask, mask, -1, 0, 0);
      }
      for (const player of candidates) {
        const value = players[player].valueBySlot[slot] ?? 0;
        const keep = players[player].currentSlotId === slots[slot].id ? 1 : 0;
        consider(slot, mask, mask | (1 << player), player, value, keep);
      }
    }
  }

  function consider(
    slot: number,
    mask: number,
    nextMask: number,
    pick: number,
    addScore: number,
    addKept: number,
  ): void {
    const nextSlot = slot + 1;
    const nextScore = round4(best[slot][mask] + addScore);
    const nextKept = kept[slot][mask] + addKept;
    const nextKey = `${tieKey[slot][mask]}|${pick < 0 ? "_" : players[pick].key}`;
    const currentScore = best[nextSlot][nextMask];
    const better =
      currentScore === neg ||
      nextScore > currentScore ||
      (nextScore === currentScore && nextKept > kept[nextSlot][nextMask]) ||
      (nextScore === currentScore &&
        nextKept === kept[nextSlot][nextMask] &&
        nextKey < tieKey[nextSlot][nextMask]);
    if (!better) {
      return;
    }
    best[nextSlot][nextMask] = nextScore;
    kept[nextSlot][nextMask] = nextKept;
    prevMask[nextSlot][nextMask] = mask;
    prevPick[nextSlot][nextMask] = pick;
    tieKey[nextSlot][nextMask] = nextKey;
  }

  let bestMask = 0;
  for (let mask = 0; mask < size; mask += 1) {
    if (best[m][mask] === neg) {
      continue;
    }
    const better =
      best[m][bestMask] === neg ||
      best[m][mask] > best[m][bestMask] ||
      (best[m][mask] === best[m][bestMask] && kept[m][mask] > kept[m][bestMask]) ||
      (best[m][mask] === best[m][bestMask] &&
        kept[m][mask] === kept[m][bestMask] &&
        tieKey[m][mask] < tieKey[m][bestMask]);
    if (better) {
      bestMask = mask;
    }
  }

  const assignment: Array<number | undefined> = Array(m).fill(undefined);
  let mask = bestMask;
  for (let slot = m; slot > 0; slot -= 1) {
    const pick = prevPick[slot][mask];
    if (pick >= 0) {
      assignment[slot - 1] = pick;
    }
    mask = prevMask[slot][mask];
    if (mask < 0) {
      break;
    }
  }
  return assignment;
}

export function greedyAssignment(slots: StartSitSlot[], players: OptimizablePlayer[]): Array<number | undefined> {
  const used = new Set<number>();
  return slots.map((slot, slotIndex) => {
    let best: number | undefined;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < players.length; index += 1) {
      if (used.has(index)) {
        continue;
      }
      const value = players[index].valueBySlot[slotIndex];
      if (value === undefined) {
        continue;
      }
      if (value > bestValue || (value === bestValue && (best === undefined || players[index].key < players[best].key))) {
        best = index;
        bestValue = value;
      }
    }
    if (best !== undefined) {
      used.add(best);
    }
    return best;
  });
}

export function canFill(player: OptimizablePlayer, slot: StartSitSlot): boolean {
  return player.eligibleToStart && playerFillsSlot(player.positions, slot.position);
}
