import type { DraftPick } from "../types/draft";
import type { PickSource } from "./PickSource";

export class YahooPickSource implements PickSource {
  async getPicks(): Promise<DraftPick[]> {
    throw new Error("YahooPickSource is not implemented yet.");
  }
}
