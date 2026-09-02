import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRAFT_PLAYERS } from "../data/draftUniverse";
import { applyDraftPick, availableAfterPicks, undoDraftPick } from "../engine/manualDraft";
import {
  getPicksUntilUserPick,
  getRoundForPick,
  getTeamSlotForPick,
  isUserOnClock,
} from "../engine/draftOrder";
import { formatPickLabel } from "../engine/pickLabel";
import {
  filterAvailablePlayers,
  getEnterDraftCandidate,
  isTypingTarget,
  positionFilterFromKey,
  quickDraftPlayers,
  type PositionFilter,
} from "../engine/playerSearch";
import { scorePlayers, type Recommendation } from "../engine/recommendations";
import { runAttachedMonteCarlo, type MonteCarloResult } from "../engine/monteCarlo";
import { learnFromDraft } from "../engine/draftLearning";
import { buildLeagueRosters } from "../engine/opponentRosters";
import { calculateVorForPlayers } from "../engine/vor";
import { detectAllTiers } from "../engine/tiers";
import { ManualPickSource } from "../sources/ManualPickSource";
import { clearDraftState, loadDraftState, saveDraftState } from "../storage/draftStorage";
import type { DraftState, Player } from "../types/draft";
import { createInitialDraftState } from "../types/draft";

export interface PickFeedback {
  label: string;
  playerName: string;
  teamSlot: number;
}

export function useDraftRoom() {
  const [state, setState] = useState<DraftState>(() => loadDraftState());
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [pickFeedback, setPickFeedback] = useState<PickFeedback | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  useEffect(() => {
    saveDraftState(state);
  }, [state]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        window.clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const pickSource = useMemo(
    () => new ManualPickSource(() => state.picks),
    [state.picks],
  );

  const availablePlayers = useMemo(
    () => availableAfterPicks(DRAFT_PLAYERS, state.draftedPlayerIds),
    [state.draftedPlayerIds],
  );

  const onClock = isUserOnClock(state.currentPick, state.userSlot, state.teamCount);
  const currentRound = getRoundForPick(state.currentPick, state.teamCount);
  const currentTeamSlot = getTeamSlotForPick(state.currentPick, state.teamCount);
  const picksUntilUser = getPicksUntilUserPick(
    state.currentPick,
    state.userSlot,
    state.teamCount,
  );

  const scoredAvailable = useMemo(
    () =>
      scorePlayers({
        availablePlayers,
        playerUniverse: DRAFT_PLAYERS,
        currentPick: state.currentPick,
        roster: state.roster,
        picksUntilUserPick: picksUntilUser,
        userSlot: state.userSlot,
        teamCount: state.teamCount,
        league: state.league,
        picks: state.picks,
      }),
    [availablePlayers, picksUntilUser, state.currentPick, state.league, state.picks, state.roster, state.teamCount, state.userSlot],
  );

  const playerScores = useMemo(
    () => new Map(scoredAvailable.map((item) => [item.player.id, item])),
    [scoredAvailable],
  );

  const filteredPlayers = useMemo(
    () => filterAvailablePlayers(availablePlayers, searchQuery, positionFilter, playerScores),
    [availablePlayers, searchQuery, positionFilter, playerScores],
  );

  const quickPlayers = useMemo(
    () => quickDraftPlayers(availablePlayers, 30, playerScores),
    [availablePlayers, playerScores],
  );

  const recommendations = useMemo(
    () =>
      scoredAvailable.slice(0, 5).map((item, index) => ({
        ...item,
        rank: index + 1,
      })),
    [scoredAvailable],
  );

  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcRecs, setMcRecs] = useState<Recommendation[] | null>(null);
  const [mcKey, setMcKey] = useState("");
  const boardKey = `${state.currentPick}:${state.draftedPlayerIds.join(",")}:${state.userSlot}`;
  const mcRecalculating = mcKey !== boardKey;

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      const vorById = calculateVorForPlayers(availablePlayers, DRAFT_PLAYERS, state.league);
      const tiersById = detectAllTiers(availablePlayers);
      const learning = learnFromDraft(state.picks, DRAFT_PLAYERS);
      const leagueRosters = buildLeagueRosters(state.picks, DRAFT_PLAYERS, state.league);
      const { recommendations: attached, result } = runAttachedMonteCarlo({
        recommendations,
        availablePlayers,
        currentPick: state.currentPick,
        userSlot: state.userSlot,
        teamCount: state.teamCount,
        userRoster: state.roster,
        leagueRosters,
        vorById,
        tiersById,
        picks: state.picks,
        learning,
        league: state.league,
      });
      if (cancelled) {
        return;
      }
      setMcResult(result);
      setMcRecs(attached);
      setMcKey(boardKey);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [availablePlayers, boardKey, recommendations, state.currentPick, state.league, state.picks, state.roster, state.teamCount, state.userSlot]);

  const rankedRecommendations = useMemo(() => {
    if (!mcRecs) {
      return recommendations;
    }
    const byId = new Map(mcRecs.map((item) => [item.player.id, item]));
    return recommendations.map((item) => {
      const extra = byId.get(item.player.id);
      return extra ? { ...item, ...extra, rank: item.rank, player: extra.player } : item;
    });
  }, [mcRecs, recommendations]);

  const takeVsWait = rankedRecommendations;

  const showPickFeedback = useCallback((nextState: DraftState, player: Player) => {
    const pick = nextState.picks[nextState.picks.length - 1];
    if (!pick) {
      return;
    }

    setPickFeedback({
      label: formatPickLabel(pick.overallPick, nextState.teamCount),
      playerName: player.name,
      teamSlot: pick.teamSlot,
    });

    if (feedbackTimer.current) {
      window.clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => {
      setPickFeedback(null);
    }, 2200);
  }, []);

  const markDrafted = useCallback(
    (player: Player) => {
      setState((prev) => {
        const next = applyDraftPick(prev, player);
        if (next === prev) {
          return prev;
        }
        showPickFeedback(next, player);
        setSearchQuery("");
        return next;
      });
    },
    [showPickFeedback],
  );

  const undoLastPick = useCallback(() => {
    setState((prev) => undoDraftPick(prev));
    setPickFeedback(null);
  }, []);

  const draftTopSearchMatch = useCallback(() => {
    const candidate = getEnterDraftCandidate(availablePlayers, searchQuery, positionFilter);
    if (candidate) {
      markDrafted(candidate);
    }
  }, [availablePlayers, markDrafted, positionFilter, searchQuery]);

  const resetDraft = useCallback(() => {
    clearDraftState();
    setState(createInitialDraftState());
    setSearchQuery("");
    setPositionFilter("ALL");
    setPickFeedback(null);
  }, []);

  const setUserSlot = useCallback((slot: number) => {
    setState((prev) => ({ ...prev, userSlot: slot }));
  }, []);

  const setTeamCount = useCallback((count: number) => {
    setState((prev) => ({ ...prev, teamCount: count }));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (!typing) {
          event.preventDefault();
          undoLastPick();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSearchQuery("");
        if (!typing) {
          setPositionFilter("ALL");
        }
        return;
      }

      if (typing) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      const nextFilter = positionFilterFromKey(event.key);
      if (nextFilter) {
        event.preventDefault();
        setPositionFilter(nextFilter);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoLastPick]);

  return {
    state,
    pickSource,
    searchQuery,
    setSearchQuery,
    positionFilter,
    setPositionFilter,
    searchInputRef,
    pickFeedback,
    filteredPlayers,
    availablePlayers,
    quickPlayers,
    onClock,
    currentRound,
    currentTeamSlot,
    picksUntilUser,
    recommendations: rankedRecommendations,
    playerScores,
    takeVsWait,
    monteCarlo: mcResult,
    monteCarloRecalculating: mcRecalculating,
    markDrafted,
    draftTopSearchMatch,
    undoLastPick,
    resetDraft,
    setUserSlot,
    setTeamCount,
  };
}
