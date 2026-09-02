export { DEFAULT_MONTE_CARLO_CONFIG, resolveMonteCarloConfig } from "./config";
export type { MonteCarloConfig } from "./config";
export { createRng, sampleWeightedIndex, stableSeedFromKey } from "./rng";
export { classifyMonteCarloDecision, runMonteCarloDraft } from "./simulate";
export type { MonteCarloInput } from "./simulate";
export type {
  CandidateOutcome,
  MonteCarloDecision,
  MonteCarloResult,
  PairOutcome,
  PlayerSurvivalStats,
  ValueDistribution,
} from "./types";
export { attachMonteCarlo, runAttachedMonteCarlo } from "./attach";
