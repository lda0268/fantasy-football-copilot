import type { DraftPick } from "../types/draft";
import type { PickSource } from "./PickSource";

export class ManualPickSource implements PickSource {
  constructor(private readonly getStatePicks: () => DraftPick[]) {}

  async getPicks(): Promise<DraftPick[]> {
    return [...this.getStatePicks()];
  }
}
