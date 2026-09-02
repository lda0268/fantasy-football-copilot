import type { DraftPick } from "../types/draft";
import type { PickSource } from "./PickSource";

export class ScreenshotPickSource implements PickSource {
  async getPicks(): Promise<DraftPick[]> {
    throw new Error("ScreenshotPickSource is not implemented yet.");
  }
}
