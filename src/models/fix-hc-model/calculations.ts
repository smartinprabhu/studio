import type { 
  ExtendedTeamPeriodicMetrics,
  ModelCalculationContext 
} from '../shared/interfaces';
import { calculateFixFTETeamMetricsForPeriod } from '../fix-fte-model/calculations';

export function calculateFixHCTeamMetricsForPeriod(
  teamInput: Partial<ExtendedTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number
): ExtendedTeamPeriodicMetrics {
  // Use Fix FTE calculation but map result to HC
  const fteResult = calculateFixFTETeamMetricsForPeriod(teamInput, lobTotalBaseMinutes, standardWorkMinutes);
  
  // Map requiredFTE to requiredHC
  fteResult.requiredHC = fteResult.requiredFTE;
  delete fteResult.requiredFTE;

  return fteResult;
}