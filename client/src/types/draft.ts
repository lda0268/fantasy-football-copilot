import { DEFAULT_LEAGUE, type LeagueSettings } from "./league";
import type { PlayerProjection } from "./projections";

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export type ProjectionSource = "league" | "source";

export interface ProjectionStats {
  passYards?: number;
  passTD?: number;
  interceptions?: number;
  rushYards?: number;
  rushTD?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTD?: number;
  returnYards?: number;
  returnTD?: number;
  fumbles?: number;
  twoPointConversions?: number;
  offensiveFumbleReturnTd?: number;
}

export interface EspnSourceMetadata {
  provider: "ESPN";
  season: number;
  format: "PPR";
}

export interface PlayerExpertData {
  overallRank?: number;
  positionalRank?: number;
  auctionValue?: number;
  byeWeek?: number;
  source?: string;
}

export interface PlayerMarketData {
  adp?: number | null;
  positionalAdp?: number | null;
  source?: string;
}

export interface PlayerAnalyticsData {
  projectedPoints?: number;
  leagueAdjustedProjectedPoints?: number;
  vor?: number;
  scarcityScore?: number;
  tier?: number;
  tierDrop?: number;
  tierScarcity?: number;
  rosterNeedScore?: number;
  survivalProbability?: number;
  opportunityCost?: number;
  leagueAdjustedValue?: number;
  recommendationScore?: number;
  recommendationReasons?: string[];
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  adp?: number;
  positionalAdp?: number;
  adpSource?: string;
  projectedPoints: number;
  positionalRank: number;
  espnOverallRank: number;
  espnPositionalRank: number;
  espnAuctionValue: number;
  espnByeWeek: number;
  espnSource: EspnSourceMetadata;
  expert?: PlayerExpertData;
  market?: PlayerMarketData;
  analytics?: PlayerAnalyticsData;
  projection?: PlayerProjection;
  projectionsAvailable?: boolean;
  kickerProjectedPointsPartial?: number;
  defenseProjectedPointsPartial?: number;
  kickerScoringIncomplete?: boolean;
  defenseScoringIncomplete?: boolean;
  expertOverallRank?: number;
  expertPositionalRank?: number;
  expertSource?: string;
  stats?: ProjectionStats;
  sourceProjectedPoints: number;
  projectionSource: ProjectionSource;
  leagueAdjustedProjectedPoints?: number;
  vor?: number;
  scarcityScore?: number;
  tier?: number;
  tierDrop?: number;
  tierScarcity?: number;
  rosterNeedScore?: number;
  survivalProbability?: number;
  opportunityCost?: number;
  leagueAdjustedValue?: number;
  recommendationScore?: number;
  recommendationReasons?: string[];
}

export interface DraftPick {
  overallPick: number;
  round: number;
  teamSlot: number;
  playerId: string;
  playerName: string;
  position: Position;
}

export type RosterSlotType =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "FLEX"
  | "SUPERFLEX"
  | "K"
  | "DEF"
  | "BENCH"
  | "IR";

export interface RosterSlot {
  id: string;
  slotType: RosterSlotType;
  label: string;
  player: Player | null;
}

export interface DraftState {
  currentPick: number;
  teamCount: number;
  userSlot: number;
  picks: DraftPick[];
  roster: RosterSlot[];
  draftedPlayerIds: string[];
  league: LeagueSettings;
}

export const ESPN_2026_PPR_SOURCE: EspnSourceMetadata = {
  provider: "ESPN",
  season: 2026,
  format: "PPR",
};

export function createRosterTemplate(league: LeagueSettings): Array<{
  slotType: RosterSlotType;
  label: string;
}> {
  const slots: Array<{ slotType: RosterSlotType; label: string }> = [];

  for (let i = 1; i <= league.rosterSlots.QB; i += 1) {
    slots.push({ slotType: "QB", label: league.rosterSlots.QB === 1 ? "QB" : `QB${i}` });
  }
  for (let i = 1; i <= league.rosterSlots.RB; i += 1) {
    slots.push({ slotType: "RB", label: `RB${i}` });
  }
  for (let i = 1; i <= league.rosterSlots.WR; i += 1) {
    slots.push({ slotType: "WR", label: `WR${i}` });
  }
  for (let i = 1; i <= league.rosterSlots.TE; i += 1) {
    slots.push({ slotType: "TE", label: league.rosterSlots.TE === 1 ? "TE" : `TE${i}` });
  }
  for (let i = 1; i <= league.rosterSlots.FLEX; i += 1) {
    slots.push({ slotType: "FLEX", label: league.rosterSlots.FLEX === 1 ? "FLEX" : `FLEX${i}` });
  }
  for (let i = 1; i <= league.rosterSlots.SUPERFLEX; i += 1) {
    slots.push({
      slotType: "SUPERFLEX",
      label: "SF (QB/WR/RB/TE)",
    });
  }
  for (let i = 1; i <= league.rosterSlots.K; i += 1) {
    slots.push({ slotType: "K", label: league.rosterSlots.K === 1 ? "K" : `K${i}` });
  }
  for (let i = 1; i <= league.rosterSlots.DEF; i += 1) {
    slots.push({ slotType: "DEF", label: league.rosterSlots.DEF === 1 ? "DEF" : `DEF${i}` });
  }
  for (let i = 1; i <= league.benchCount; i += 1) {
    slots.push({ slotType: "BENCH", label: `BN${i}` });
  }
  for (let i = 1; i <= league.irCount; i += 1) {
    slots.push({ slotType: "IR", label: `IR${i}` });
  }

  return slots;
}

export function createEmptyRoster(league: LeagueSettings = DEFAULT_LEAGUE): RosterSlot[] {
  return createRosterTemplate(league).map((slot, index) => ({
    id: `${slot.slotType}-${index}`,
    slotType: slot.slotType,
    label: slot.label,
    player: null,
  }));
}

export function createInitialDraftState(league: LeagueSettings = DEFAULT_LEAGUE): DraftState {
  return {
    currentPick: 1,
    teamCount: league.teamCount,
    userSlot: 1,
    picks: [],
    roster: createEmptyRoster(league),
    draftedPlayerIds: [],
    league,
  };
}
