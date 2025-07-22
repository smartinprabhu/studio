import { FixHcTeamPeriodicMetrics } from './types';
import { calculateFixFteForPeriod } from '../fix-fte/calculations';

export function calculateFixHcForPeriod(
  teamInput: Partial<FixHcTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number
): FixHcTeamPeriodicMetrics {
  const fteResult = calculateFixFteForPeriod(teamInput, lobTotalBaseMinutes, standardWorkMinutes);
  return {
    ...fteResult,
    requiredHC: fteResult.requiredFTE,
  };
}
