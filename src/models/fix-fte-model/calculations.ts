import type { 
  ExtendedTeamPeriodicMetrics,
  ModelCalculationContext 
} from '../shared/interfaces';
import { 
  STANDARD_WEEKLY_WORK_MINUTES, 
  STANDARD_MONTHLY_WORK_MINUTES 
} from '@/components/capacity-insights/types';

export function calculateFixFTETeamMetricsForPeriod(
  teamInput: Partial<ExtendedTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number = STANDARD_WEEKLY_WORK_MINUTES
): ExtendedTeamPeriodicMetrics {
  const defaults: ExtendedTeamPeriodicMetrics = { ...teamInput };

  // Simplified calculation - no occupancy or backlog factors
  const baseMins = (lobTotalBaseMinutes ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  defaults._calculatedRequiredAgentMinutes = baseMins;

  // Simplified FTE calculation (produces ~25% lower requirements)
  const simplifiedFTE = baseMins > 0 ? baseMins / (standardWorkMinutes * 0.75) : null;
  defaults.requiredFTE = simplifiedFTE;

  // Over/Under calculation
  defaults.overUnderHC = (defaults.actualHC !== null && simplifiedFTE !== null) 
    ? defaults.actualHC - simplifiedFTE 
    : null;

  // HC flow calculations (same as other models)
  if (defaults.actualHC !== null && defaults.attritionPercentage !== null) {
    defaults.attritionLossHC = defaults.actualHC * (defaults.attritionPercentage / 100);
    defaults.hcAfterAttrition = defaults.actualHC - defaults.attritionLossHC;
    
    const moveIn = defaults.moveIn ?? 0;
    const moveOut = defaults.moveOut ?? 0;
    const newHireProduction = defaults.newHireProduction ?? 0;
    
    defaults.endingHC = defaults.hcAfterAttrition + newHireProduction + moveIn - moveOut;
  }

  return defaults;
}