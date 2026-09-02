export function formatPickLabel(overallPick: number, teamCount: number): string {
  const round = Math.ceil(overallPick / teamCount);
  const pickInRound = ((overallPick - 1) % teamCount) + 1;
  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}
