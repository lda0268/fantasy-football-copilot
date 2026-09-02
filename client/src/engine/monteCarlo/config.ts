export interface MonteCarloConfig {
  simulations: number;
  horizonUserPicks: number;
  topCandidates: number;
  candidateWindow: number;
  seed?: number;
}

export const DEFAULT_MONTE_CARLO_CONFIG: MonteCarloConfig = {
  simulations: 500,
  horizonUserPicks: 2,
  topCandidates: 8,
  candidateWindow: 32,
};

export function resolveMonteCarloConfig(overrides: Partial<MonteCarloConfig> = {}): MonteCarloConfig {
  return {
    ...DEFAULT_MONTE_CARLO_CONFIG,
    ...overrides,
  };
}
