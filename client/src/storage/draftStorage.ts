import type { DraftState } from "../types/draft";
import { createEmptyRoster, createInitialDraftState } from "../types/draft";
import { DEFAULT_LEAGUE } from "../types/league";

const STORAGE_KEY = "ffc-draft-state-v4";

export function loadDraftState(): DraftState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialDraftState();
    }

    const parsed = JSON.parse(raw) as DraftState;
    const league = parsed.league?.rosterSlots ? parsed.league : DEFAULT_LEAGUE;
    const base = createInitialDraftState(league);
    const roster =
      parsed.roster?.length === base.roster.length
        ? parsed.roster
        : createEmptyRoster(league);

    return {
      ...base,
      ...parsed,
      league,
      teamCount: league.teamCount,
      roster,
    };
  } catch {
    return createInitialDraftState();
  }
}

export function saveDraftState(state: DraftState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearDraftState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
