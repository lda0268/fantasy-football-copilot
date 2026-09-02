import type { DraftPick, Player, RosterSlot } from "../types/draft";
import { DEFAULT_LEAGUE, type LeagueSettings } from "../types/league";
import { RECOMMENDATION_WEIGHTS } from "./constants";
import { expertRankScore, marketAdpScore } from "./data/sourceFields";
import { learnFromDraft } from "./draftLearning";
import { getPicksUntilUserPick, isUserOnClock, remainingUserPicksInDraft, scheduledDraftRounds } from "./draftOrder";
import { simulateDraftWindow } from "./draftSequence";
import { estimateLeagueDemand, formatLeagueDemand } from "./leagueDemand";
import { buildLeagueRosters } from "./opponentRosters";
import { clamp, minMaxNormalize } from "./math";
import { calculateOpportunityCost } from "./opportunityCost";
import { buildRecommendationReasons } from "./recommendationReasons";
import { getRosterNeed, starterLineupPoints } from "./rosterNeed";
import { calculateScarcityScore } from "./scarcity";
import { applyLeagueProjections, hasUsableProjections } from "./scoring";
import { analyzeTakeVsWait, type TakeWaitLabel, type TakeVsWaitAnalysis } from "./takeVsWait";
import { detectAllTiers } from "./tiers";
import { calculateVorForPlayers, leagueAdjustedValue } from "./vor";

export type RecommendationLabel = TakeWaitLabel;

export interface Recommendation {
  rank: number;
  player: Player;
  score: number;
  label: RecommendationLabel;
  vor: number;
  leagueAdjustedValue: number;
  leagueAdjustedRank: number;
  leagueAdjustedProjectedPoints?: number;
  tier: number;
  pointsToNextTier: number;
  scarcity: number;
  expertValue: number;
  adpValue: number;
  rosterNeedScore: number;
  survivalProbability: number;
  opportunityCost: number;
  reasons: string[];
  takeVsWait: TakeVsWaitAnalysis;
  analyticalSurvivalProbability?: number;
  monteCarlo?: import("./monteCarlo").CandidateOutcome;
  monteCarloSurvival?: import("./monteCarlo").PlayerSurvivalStats;
}

export interface RecommendationInput {
  availablePlayers: Player[];
  currentPick: number;
  roster: RosterSlot[];
  playerUniverse?: Player[];
  picksUntilUserPick?: number;
  userSlot?: number;
  teamCount?: number;
  league?: LeagueSettings;
  picks?: DraftPick[];
}

function opportunityWindow(input: RecommendationInput, league: LeagueSettings): number {
  const { currentPick, picksUntilUserPick = 0, userSlot = 1 } = input;
  const teamCount = input.teamCount ?? league.teamCount;

  if (picksUntilUserPick > 0) {
    return picksUntilUserPick;
  }

  return getPicksUntilUserPick(currentPick + 1, userSlot, teamCount) + 1;
}

export function scorePlayers(input: RecommendationInput): Recommendation[] {
  const league = input.league ?? DEFAULT_LEAGUE;
  const playerUniverse = applyLeagueProjections(input.playerUniverse ?? input.availablePlayers, league);
  const availablePlayers = applyLeagueProjections(input.availablePlayers, league);

  if (availablePlayers.length === 0) {
    return [];
  }

  const projectionsAvailable = playerUniverse.some(hasUsableProjections);
  const vorById = calculateVorForPlayers(availablePlayers, playerUniverse, league);
  const tiersById = detectAllTiers(availablePlayers);
  const vors = availablePlayers.map((player) => vorById.get(player.id) ?? 0);
  const minVor = Math.min(...vors);
  const maxVor = Math.max(...vors);
  const window = opportunityWindow(input, league);
  const onTheClock = isUserOnClock(
    input.currentPick,
    input.userSlot ?? 1,
    input.teamCount ?? league.teamCount,
  );
  const picks = input.picks ?? [];
  const leagueDemand = estimateLeagueDemand(picks, league, playerUniverse);
  const leagueNeedSummary = formatLeagueDemand(leagueDemand);
  const learning = learnFromDraft(picks, playerUniverse);
  const leagueRosters = buildLeagueRosters(picks, playerUniverse, league);
  const sequence = simulateDraftWindow({
    currentPick: input.currentPick,
    picksUntilUserPick: window,
    userSlot: input.userSlot ?? 1,
    teamCount: input.teamCount ?? league.teamCount,
    availablePlayers,
    leagueRosters,
    league,
    learning,
  });
  const baseStarterPoints = starterLineupPoints(input.roster);
  const vorOrder = [...availablePlayers].sort(
    (a, b) => (vorById.get(b.id) ?? 0) - (vorById.get(a.id) ?? 0),
  );
  const leagueAdjustedRankById = new Map(
    vorOrder.map((player, index) => [player.id, index + 1]),
  );

  const scored = availablePlayers.map((player) => {
    const vor = vorById.get(player.id) ?? 0;
    const adjusted = leagueAdjustedValue(vor);
    const vorScore = projectionsAvailable ? minMaxNormalize(adjusted, minVor, maxVor) : 0.5;
    const tierInfo = tiersById.get(player.id);
    const tier = tierInfo?.tier ?? 1;
    const pointsToNextTier = tierInfo?.pointsToNextTier ?? 0;
    const scarcity = calculateScarcityScore({
      availablePlayers,
      playerUniverse,
      position: player.position,
      playerId: player.id,
      vorById,
      tiersById,
      league,
    });
    const tierValue = clamp(pointsToNextTier / 25, 0, 1);
    const scarcityOrTier = scarcity * 0.65 + tierValue * 0.35;
    const market = marketAdpScore(player, input.currentPick);
    const expertValue = expertRankScore(player, playerUniverse);
    const rosterNeed = getRosterNeed(input.roster, player, vorScore, league, {
      currentPick: input.currentPick,
      teamCount: input.teamCount ?? league.teamCount,
      userSlot: input.userSlot ?? 1,
      remainingUserPicks: remainingUserPicksInDraft(
        input.currentPick,
        input.userSlot ?? 1,
        input.teamCount ?? league.teamCount,
        scheduledDraftRounds(league) * (input.teamCount ?? league.teamCount),
      ),
      baseStarterPoints,
    });
    let takeVsWait = analyzeTakeVsWait({
      player,
      currentPick: input.currentPick,
      picksUntilUserPick: window,
      availablePlayers,
      vorById,
      tiersById,
      leagueDemand,
      opportunityCost: 0,
      vorScore,
      learning,
      sequence,
      leagueNeedSummary,
      onTheClock,
    });
    const combinedOpportunity = calculateOpportunityCost({
      player,
      survivalProbability: takeVsWait.survivalProbability,
      availablePlayers,
      vorById,
      leagueDemand,
      remainingAfterWindow: sequence.remaining,
    });

    const raw =
      (vorScore * RECOMMENDATION_WEIGHTS.vor +
        scarcityOrTier * RECOMMENDATION_WEIGHTS.scarcity +
        expertValue * RECOMMENDATION_WEIGHTS.expert +
        market.score * RECOMMENDATION_WEIGHTS.adp +
        rosterNeed.score * RECOMMENDATION_WEIGHTS.rosterNeed +
        combinedOpportunity * RECOMMENDATION_WEIGHTS.opportunityCost) *
      rosterNeed.crowdingFactor;

    const score = Math.round(clamp(raw, 0, 1) * 100);
    takeVsWait = {
      ...takeVsWait,
      opportunityCost: combinedOpportunity,
      recommendationScore: score,
    };

    const reasons = buildRecommendationReasons({
      player,
      league,
      vor,
      vorScore,
      pointsToNextTier,
      tier,
      scarcity,
      survivalProbability: takeVsWait.survivalProbability,
      starterOpen: rosterNeed.starterOpen,
      superflexOpen: rosterNeed.superflexOpen,
      reliableQbsRemaining: availablePlayers.filter(
        (item) => item.position === "QB" && (vorById.get(item.id) ?? 0) > 40,
      ).length,
      qbNeed: leagueDemand.teamsNeedingQb1 + leagueDemand.teamsNeedingQb2OrSuperflex,
      predictedTaken: takeVsWait.predictedTaken,
      predictedByTeamSlot: takeVsWait.predictedByTeamSlot,
      nextBestIfWait: takeVsWait.nextBestIfWait,
      runWarning: takeVsWait.runWarning,
      adpDelta: market.delta,
      leagueAdjustedRank: leagueAdjustedRankById.get(player.id) ?? 0,
    });

    const projected = projectionsAvailable && hasUsableProjections(player) ? player.projectedPoints : undefined;
    const tierScarcity = clamp(pointsToNextTier / 25, 0, 1);
    const analytics = {
      projectedPoints: projected,
      leagueAdjustedProjectedPoints: projected,
      vor: projectionsAvailable ? vor : undefined,
      scarcityScore: scarcity,
      tier,
      tierDrop: pointsToNextTier,
      tierScarcity,
      rosterNeedScore: rosterNeed.score,
      survivalProbability: takeVsWait.survivalProbability,
      opportunityCost: combinedOpportunity,
      leagueAdjustedValue: projectionsAvailable ? Math.round(adjusted * 10) / 10 : undefined,
      recommendationScore: score,
      recommendationReasons: reasons,
    };

    const enrichedPlayer = {
      ...player,
      leagueAdjustedProjectedPoints: projected,
      vor: projectionsAvailable ? vor : undefined,
      scarcityScore: scarcity,
      tier,
      tierDrop: pointsToNextTier,
      tierScarcity,
      rosterNeedScore: rosterNeed.score,
      survivalProbability: takeVsWait.survivalProbability,
      opportunityCost: combinedOpportunity,
      leagueAdjustedValue: analytics.leagueAdjustedValue,
      recommendationScore: score,
      recommendationReasons: reasons,
      analytics,
    };

    return {
      rank: 0,
      player: enrichedPlayer,
      vor,
      leagueAdjustedValue: analytics.leagueAdjustedValue ?? 0,
      leagueAdjustedRank: leagueAdjustedRankById.get(player.id) ?? 0,
      leagueAdjustedProjectedPoints: projected,
      tier,
      pointsToNextTier,
      scarcity,
      expertValue,
      adpValue: market.delta ?? 0,
      rosterNeedScore: rosterNeed.score,
      survivalProbability: takeVsWait.survivalProbability,
      opportunityCost: combinedOpportunity,
      reasons,
      takeVsWait,
      label: takeVsWait.label,
      score,
      analyticalSurvivalProbability: takeVsWait.analyticalSurvivalProbability,
    };
  });

  const ranked = scored.sort((a, b) => b.score - a.score || b.leagueAdjustedValue - a.leagueAdjustedValue);
  if (projectionsAvailable) {
    return ranked;
  }

  return ranked.map((item, index) => ({
    ...item,
    leagueAdjustedRank: index + 1,
  }));
}

export function getRecommendations(
  input: RecommendationInput,
  limit = 5,
): Recommendation[] {
  return scorePlayers(input)
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}
