import { fantasyProsHealthBand } from "../copilot/v2/score.js";
import type { StartSitHealthBand } from "./types.js";
import { rosterGroup } from "./slots.js";

export function yahooHealthBand(status: string | undefined): StartSitHealthBand {
  return fantasyProsHealthBand(status);
}

export function isHardUnavailable(band: StartSitHealthBand): boolean {
  return band === "out" || band === "ir" || band === "suspended";
}

export function availabilityForCandidate(input: {
  selectedPosition?: string;
  yahooStatus?: string;
  fantasyProsInjuryStatus?: string;
  identityMatched: boolean;
}): {
  eligibleToStart: boolean;
  band: StartSitHealthBand;
  warnings: string[];
  blockReason?: string;
} {
  const warnings: string[] = [];
  const group = rosterGroup(input.selectedPosition);
  if (group === "ir") {
    return {
      eligibleToStart: false,
      band: "ir",
      warnings: ["Yahoo lists this player in an IR slot; not eligible for a starting assignment."],
      blockReason: "Yahoo IR slot",
    };
  }

  const yahooBand = yahooHealthBand(input.yahooStatus);
  if (isHardUnavailable(yahooBand)) {
    return {
      eligibleToStart: false,
      band: yahooBand,
      warnings: [`Yahoo lists this player as ${labelBand(yahooBand)}; not eligible to start.`],
      blockReason: `Yahoo ${labelBand(yahooBand)}`,
    };
  }

  if (input.identityMatched && input.fantasyProsInjuryStatus !== undefined) {
    const fpBand = fantasyProsHealthBand(input.fantasyProsInjuryStatus);
    if (isHardUnavailable(fpBand)) {
      return {
        eligibleToStart: false,
        band: fpBand,
        warnings: [`FantasyPros lists this player as ${labelBand(fpBand)}; not eligible to start.`],
        blockReason: `FantasyPros ${labelBand(fpBand)}`,
      };
    }
    if (fpBand === "questionable") {
      warnings.push("Listed as Questionable; remains eligible with risk.");
    } else if (fpBand === "doubtful") {
      warnings.push("Listed as Doubtful; remains eligible with elevated risk.");
    }
    return { eligibleToStart: true, band: fpBand, warnings };
  }

  if (yahooBand === "questionable") {
    warnings.push("Yahoo lists this player as Questionable; remains eligible with risk.");
    return { eligibleToStart: true, band: yahooBand, warnings };
  }
  if (yahooBand === "doubtful") {
    warnings.push("Yahoo lists this player as Doubtful; remains eligible with elevated risk.");
    return { eligibleToStart: true, band: yahooBand, warnings };
  }

  return { eligibleToStart: true, band: "unknown", warnings };
}

export function labelBand(band: StartSitHealthBand): string {
  if (band === "ir") {
    return "IR";
  }
  if (band === "out") {
    return "Out";
  }
  if (band === "suspended") {
    return "Suspended";
  }
  if (band === "questionable") {
    return "Questionable";
  }
  if (band === "doubtful") {
    return "Doubtful";
  }
  if (band === "healthy") {
    return "Healthy";
  }
  return "unknown";
}
