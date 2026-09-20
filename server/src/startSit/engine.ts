import type { PlayerIntelligence } from "../playerIntelligence/types.js";
import type { YahooRosterPlayer } from "../yahoo/types.js";
import { YahooApiError, YahooErrorCode } from "../yahoo/errors.js";
import { buildPositionReferencePools } from "../copilot/v2/referencePopulation.js";
import { availabilityForCandidate, labelBand } from "./availability.js";
import { playerFillsSlot, yahooNflEligibility } from "./eligibility.js";
import { optimizeAssignment, type OptimizablePlayer } from "./optimize.js";
import { expandStartingSlots, rosterGroup } from "./slots.js";
import type {
  StartSitAssignment,
  StartSitEngineInput,
  StartSitLineupPlayer,
  StartSitMove,
  StartSitProjectionTotal,
  StartSitResult,
  StartSitReviewItem,
  StartSitSlot,
} from "./types.js";
import {
  classifyWeeklySupport,
  crossPositionProjectionPool,
  hasUsableWeeklyIntelligence,
  weeklyValueForSlot,
} from "./weeklyValue.js";

type InternalCandidate = OptimizablePlayer & {
  view: StartSitLineupPlayer;
  intel?: PlayerIntelligence;
  roster: YahooRosterPlayer;
  healthBand: ReturnType<typeof availabilityForCandidate>["band"];
};

export function buildStartSitRecommendation(input: StartSitEngineInput): StartSitResult {
  const slots = expandStartingSlots(input.rosterPositions);
  if (slots.length === 0) {
    throw new YahooApiError(
      YahooErrorCode.PARSE_ERROR,
      "Yahoo lineup slot configuration is unavailable for Start/Sit.",
      { status: 502 },
    );
  }

  const intelligenceByKey = new Map(input.players.map((player) => [player.identity.yahooPlayerKey, player]));
  const pools = buildPositionReferencePools({
    weeklyProjections: input.reference?.weeklyProjections,
    weeklyRankings: input.reference?.weeklyRankings,
  });
  const crossProjectionPool = crossPositionProjectionPool(pools);

  const candidates = input.roster.map((roster) =>
    toCandidate(roster, intelligenceByKey.get(roster.playerKey), slots, pools, crossProjectionPool),
  );

  const currentIndexes = assignCurrentLineup(slots, candidates);
  const unconstrained = optimizeAssignment(slots, candidates);
  const locked = conservativeLocks(slots, candidates, currentIndexes, unconstrained);
  const recommendedIndexes = locked.size > 0 ? optimizeAssignment(slots, candidates, locked) : unconstrained;

  const currentLineup = materialize(slots, candidates, currentIndexes);
  const recommendedLineup = materialize(slots, candidates, recommendedIndexes);
  const { moves, reviewRequired } = diffLineups(slots, candidates, currentIndexes, recommendedIndexes, unconstrained);
  const recommendedKeys = new Set(
    recommendedLineup.map((row) => row.player?.yahooPlayerKey).filter((key): key is string => Boolean(key)),
  );

  const benchPlayers = candidates
    .filter((player) => !recommendedKeys.has(player.key) && rosterGroup(player.roster.selectedPosition) !== "ir")
    .map((player) => player.view);
  const irPlayers = candidates.filter((player) => rosterGroup(player.roster.selectedPosition) === "ir").map((player) => player.view);

  const currentProjection = projectionTotal(currentLineup);
  const recommendedProjection = projectionTotal(recommendedLineup);
  const projectedPointsDelta =
    currentProjection.complete && recommendedProjection.complete
      ? round1(recommendedProjection.points - currentProjection.points)
      : undefined;

  const message =
    moves.length === 0
      ? reviewRequired.length > 0
        ? `${reviewRequired.length} lineup comparison${reviewRequired.length === 1 ? "" : "s"} need review because of insufficient weekly intelligence.`
        : "Current lineup already matches recommended lineup."
      : `${moves.length} lineup change${moves.length === 1 ? "" : "s"} identified.`;

  return {
    context: {
      week: input.week,
      scoringFormat: input.scoringFormat,
      providerModes: input.providerModes,
      lineupSource: input.lineupSource,
    },
    summary: {
      rosterPlayers: candidates.length,
      startingSlots: slots.length,
      proposedChanges: moves.length,
      reviewRequired: reviewRequired.length,
      currentProjection,
      recommendedProjection,
      projectedPointsDelta,
      message,
    },
    currentLineup,
    recommendedLineup,
    moves,
    reviewRequired,
    bench: benchPlayers,
    ir: irPlayers,
    lineupSettings: input.rosterPositions,
  };
}

function toCandidate(
  roster: YahooRosterPlayer,
  intel: PlayerIntelligence | undefined,
  slots: StartSitSlot[],
  pools: ReturnType<typeof buildPositionReferencePools>,
  crossProjectionPool: number[],
): InternalCandidate {
  const identityStatus = intel?.identity.status ?? "unresolved";
  const matched = identityStatus === "matched";
  const weekly = matched ? intel?.weekly : undefined;
  const quality = classifyWeeklySupport(weekly);
  const availability = availabilityForCandidate({
    selectedPosition: roster.selectedPosition,
    yahooStatus: roster.status ?? roster.statusFull,
    fantasyProsInjuryStatus: matched ? intel?.injury?.status : undefined,
    identityMatched: matched,
  });
  const positions = yahooNflEligibility(roster.displayPosition, roster.eligiblePositions);
  const warnings = [
    ...(intel?.warnings ?? []),
    ...availability.warnings,
  ];
  if (!matched) {
    warnings.push(
      identityStatus === "ambiguous"
        ? "Ambiguous identity: FantasyPros intelligence is not attached."
        : "Unresolved identity: FantasyPros intelligence is not attached.",
    );
  }
  const view: StartSitLineupPlayer = {
    yahooPlayerKey: roster.playerKey,
    name: roster.name,
    team: roster.editorialTeamAbbr ?? intel?.player.team,
    position: intel?.player.position ?? positions[0],
    yahooPositions: positions,
    identityStatus,
    currentSlot: roster.selectedPosition,
    weeklyProjectedPoints: weekly?.projectedPoints,
    weeklyEcr: weekly?.ecr,
    dataQuality: quality,
    injuryStatus: matched ? intel?.injury?.status : undefined,
    warnings: unique(warnings),
  };

  const valueBySlot = slots.map((slot) => {
    if (!availability.eligibleToStart || !playerFillsSlot(positions, slot.position)) {
      return undefined;
    }
    const scored = weeklyValueForSlot({
      slot: slot.position,
      position: view.position,
      weekly,
      healthBand: availability.band,
      pools,
      crossProjectionPool,
    });
    return scored.value ?? 0;
  });

  const candidate: InternalCandidate = {
    key: roster.playerKey,
    name: roster.name,
    positions,
    eligibleToStart: availability.eligibleToStart,
    weeklyProjectedPoints: weekly?.projectedPoints,
    valueBySlot,
    view,
    intel,
    roster,
    healthBand: availability.band,
  };
  return candidate;
}

function assignCurrentLineup(slots: StartSitSlot[], players: InternalCandidate[]): Array<number | undefined> {
  const assignment: Array<number | undefined> = Array(slots.length).fill(undefined);
  const remaining = new Map<string, number[]>();
  players.forEach((player, index) => {
    const code = player.roster.selectedPosition;
    if (!code) {
      return;
    }
    const list = remaining.get(code) ?? [];
    list.push(index);
    remaining.set(code, list);
  });
  for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
    const list = remaining.get(slots[slotIndex].position);
    const next = list?.shift();
    if (next !== undefined) {
      assignment[slotIndex] = next;
      players[next].currentSlotId = slots[slotIndex].id;
    }
  }
  return assignment;
}

function conservativeLocks(
  slots: StartSitSlot[],
  players: InternalCandidate[],
  current: Array<number | undefined>,
  unconstrained: Array<number | undefined>,
): Map<number, number> {
  const locked = new Map<number, number>();
  let changed = true;
  let assignment = unconstrained;
  while (changed) {
    changed = false;
    const nextLocks = new Map(locked);
    for (let slot = 0; slot < slots.length; slot += 1) {
      const currentIndex = current[slot];
      const recIndex = assignment[slot];
      if (currentIndex === recIndex) {
        continue;
      }
      if (isClearChange(players, currentIndex, recIndex, slot)) {
        continue;
      }
      if (currentIndex !== undefined && players[currentIndex].eligibleToStart && playerFillsSlot(players[currentIndex].positions, slots[slot].position)) {
        if (nextLocks.get(slot) !== currentIndex) {
          nextLocks.set(slot, currentIndex);
          changed = true;
        }
      }
    }
    if (changed) {
      locked.clear();
      for (const [slot, player] of nextLocks) {
        locked.set(slot, player);
      }
      assignment = optimizeAssignment(slots, players, locked);
    }
  }
  return locked;
}

function isClearChange(
  players: InternalCandidate[],
  sitIndex: number | undefined,
  startIndex: number | undefined,
  slot: number,
): boolean {
  if (startIndex === undefined) {
    return sitIndex === undefined ? false : !players[sitIndex].eligibleToStart;
  }
  const start = players[startIndex];
  if (!start.eligibleToStart || start.valueBySlot[slot] === undefined) {
    return false;
  }
  if (sitIndex === undefined) {
    return hasUsableWeeklyIntelligence(start.view.dataQuality);
  }
  const sit = players[sitIndex];
  if (!sit.eligibleToStart) {
    return true;
  }
  const startUsable = hasUsableWeeklyIntelligence(start.view.dataQuality);
  const sitUsable = hasUsableWeeklyIntelligence(sit.view.dataQuality);
  if (!sitUsable || !startUsable) {
    return false;
  }
  const startValue = start.valueBySlot[slot];
  const sitValue = sit.valueBySlot[slot];
  return startValue !== undefined && (sitValue === undefined || startValue > sitValue);
}

function diffLineups(
  slots: StartSitSlot[],
  players: InternalCandidate[],
  current: Array<number | undefined>,
  recommended: Array<number | undefined>,
  unconstrained: Array<number | undefined>,
): { moves: StartSitMove[]; reviewRequired: StartSitReviewItem[] } {
  const moves: StartSitMove[] = [];
  const reviewRequired: StartSitReviewItem[] = [];
  for (let slot = 0; slot < slots.length; slot += 1) {
    const sitIndex = current[slot];
    const startIndex = recommended[slot];
    const unconstrainedIndex = unconstrained[slot];
    if (sitIndex === startIndex) {
      if (unconstrainedIndex !== startIndex && sitIndex !== undefined && unconstrainedIndex !== undefined) {
        reviewRequired.push({
          slot: slots[slot].position,
          slotId: slots[slot].id,
          currentPlayer: players[sitIndex].view,
          candidatePlayer: players[unconstrainedIndex].view,
          reason: reviewReason(players[sitIndex], players[unconstrainedIndex]),
        });
      }
      continue;
    }
    if (startIndex === undefined) {
      continue;
    }
    const start = players[startIndex];
    const sit = sitIndex !== undefined ? players[sitIndex] : undefined;
    const reasons = changeReasons(sit, start, slots[slot].position);
    const startPoints = start.view.weeklyProjectedPoints;
    const sitPoints = sit?.view.weeklyProjectedPoints;
    const projectedPointsDelta =
      startPoints !== undefined && sitPoints !== undefined ? round1(startPoints - sitPoints) : undefined;
    moves.push({
      type: "swap",
      slot: slots[slot].position,
      slotId: slots[slot].id,
      startPlayer: start.view,
      sitPlayer: sit?.view,
      weeklyValue: {
        start: start.valueBySlot[slot],
        sit: sit?.valueBySlot[slot],
      },
      projectedPointsDelta,
      reasons,
      warnings: unique([...(start.view.warnings), ...(sit?.view.warnings ?? [])]).filter((warning) =>
        /Questionable|Doubtful|Out|IR|unresolved|ambiguous|unavailable/i.test(warning),
      ),
    });
  }
  return { moves, reviewRequired };
}

function reviewReason(current: InternalCandidate, candidate: InternalCandidate): string {
  if (current.view.identityStatus !== "matched") {
    return `${current.name} is a current starter without matched FantasyPros identity, so ${candidate.name} is not automatically recommended.`;
  }
  if (!hasUsableWeeklyIntelligence(current.view.dataQuality)) {
    return `${current.name} lacks usable weekly intelligence, so ${candidate.name} is not automatically recommended.`;
  }
  return `Insufficient data to start ${candidate.name} over ${current.name}.`;
}

function changeReasons(sit: InternalCandidate | undefined, start: InternalCandidate, slot: string): string[] {
  const reasons: string[] = [];
  const startPts = start.view.weeklyProjectedPoints;
  const sitPts = sit?.view.weeklyProjectedPoints;
  if (startPts !== undefined && sitPts !== undefined) {
    const delta = round1(startPts - sitPts);
    if (delta > 0) {
      reasons.push(`${start.name} projects ${delta} more points this week.`);
    } else if (delta < 0) {
      reasons.push(`${start.name} projects ${Math.abs(delta)} fewer points this week but has the stronger weekly lineup value.`);
    }
  }
  if (start.view.weeklyEcr !== undefined && sit?.view.weeklyEcr !== undefined && start.view.position === sit.view.position) {
    if ((start.view.weeklyEcr ?? Infinity) < (sit.view.weeklyEcr ?? Infinity)) {
      reasons.push(`${start.name} has the stronger weekly ECR.`);
    }
  }
  if (sit && !sit.eligibleToStart) {
    reasons.push(`${sit.name} is listed as ${labelBand(sit.healthBand)} and is not recommended to start.`);
  }
  if (sit?.healthBand === "doubtful") {
    reasons.push(`${sit.name} is listed as Doubtful.`);
  }
  if (reasons.length === 0) {
    reasons.push(`${start.name} has the stronger deterministic weekly lineup value for ${slot}.`);
  }
  return reasons;
}

function materialize(
  slots: StartSitSlot[],
  players: InternalCandidate[],
  indexes: Array<number | undefined>,
): StartSitAssignment[] {
  return slots.map((slot, index) => {
    const playerIndex = indexes[index];
    const player = playerIndex !== undefined ? withSlotValue(players[playerIndex], index) : undefined;
    return { slot, player };
  });
}

function withSlotValue(player: InternalCandidate, slotIndex: number): StartSitLineupPlayer {
  return { ...player.view, weeklyValue: player.valueBySlot[slotIndex] };
}

function projectionTotal(lineup: StartSitAssignment[]): StartSitProjectionTotal {
  let points = 0;
  let projectedSlots = 0;
  for (const row of lineup) {
    const value = row.player?.weeklyProjectedPoints;
    if (value !== undefined) {
      points += value;
      projectedSlots += 1;
    }
  }
  return {
    points: round1(points),
    projectedSlots,
    totalSlots: lineup.length,
    complete: projectedSlots === lineup.length && lineup.every((row) => row.player),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
