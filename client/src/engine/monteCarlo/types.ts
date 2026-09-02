import type { Player, Position } from "../../types/draft";

export type MonteCarloDecision = "TAKE NOW" | "LEAN TAKE" | "WAIT POSSIBLE" | "SAFE TO WAIT";

export interface ValueDistribution {
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export interface PlayerSurvivalStats {
  playerId: string;
  name: string;
  position: Position;
  survived: number;
  probability: number;
  standardError: number;
  tier: number;
  tierSurvived: number;
  tierSurvivalProbability: number;
  tierExhaustedProbability: number;
  expectedBestVor: number;
  expectedBestPoints: number;
  expectedBestName?: string;
}

export interface CandidateOutcome {
  playerId: string;
  name: string;
  position: Position;
  takeNow: ValueDistribution;
  wait: ValueDistribution;
  evDelta: number;
  expectedNextName?: string;
  expectedNextPosition?: Position;
  expectedNextTier?: number;
  decision: MonteCarloDecision;
}

export interface PairOutcome {
  firstId: string;
  secondId: string;
  firstName: string;
  secondName: string;
  combinedVor: number;
}

export interface SimulatedPickCount {
  playerId: string;
  name: string;
  count: number;
}

export interface MonteCarloDiagnostics {
  simulations: number;
  runtimeMs: number;
  seed: number;
  opponentWindow: number;
  mostFrequentOpponentPicks: SimulatedPickCount[];
}

export interface MonteCarloResult {
  config: {
    simulations: number;
    horizonUserPicks: number;
    topCandidates: number;
    candidateWindow: number;
    seed: number;
  };
  runtimeMs: number;
  backToBack: boolean;
  interveningOpponentPicks: number;
  playerSurvival: PlayerSurvivalStats[];
  candidates: CandidateOutcome[];
  bestCandidateId?: string;
  bestSequenceLabel?: string;
  bestPair?: PairOutcome;
  pairs: PairOutcome[];
  diagnostics: MonteCarloDiagnostics;
}

export interface SimPlayer {
  index: number;
  player: Player;
  id: string;
  name: string;
  position: Position;
  adp: number;
  positionalAdp?: number;
  vor: number;
  projectedPoints: number;
  tier: number;
}
