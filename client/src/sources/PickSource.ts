import type { DraftPick } from "../types/draft";

export interface PickSource {
  getPicks(): Promise<DraftPick[]>;
}
