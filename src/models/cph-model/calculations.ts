import type { 
  ExtendedTeamPeriodicMetrics,
  ModelCalculationContext 
} from '../shared/interfaces';
import { 
  STANDARD_WEEKLY_WORK_MINUTES, 
  STANDARD_MONTHLY_WORK_MINUTES 
} from '@/components/capacity-insights/types';

export function calculateCPHTeamMetricsForPeriod(
  teamInput: Partial<ExtendedTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number = STANDARD_WEEKLY_WORK_MINUTES
): ExtendedTeamPeriodicMetrics {
  const defaults: ExtendedTeamPeriodicMetrics = { ...teamInput };

  // 1. Convert CPH → AHT (min)
  const cphValue = defaults.cph ?? 0;
  defaults.aht = cphValue > 0 ? 60 / cphValue : null;

  // 2. Base and effective required minutes
  const baseMins = (lobTotalBaseMinutes ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const effMins = baseMins * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  defaults._calculatedRequiredAgentMinutes = effMins;

  // 3. Productive minutes per HC
  const shrinkageFactor = 1 - ((defaults.shrinkagePercentage ?? 0) / 100);
  const occupancyFactor = (defaults.occupancyPercentage ?? 85) / 100;
  const effMinPerHC = standardWorkMinutes * shrinkageFactor * occupancyFactor;

  // 4. Required HC
  defaults.requiredHC = (effMins > 0 && effMinPerHC > 0) ? effMins / effMinPerHC : null;

  // 5. Over/Under HC
  defaults.overUnderHC = (defaults.actualHC !== null && defaults.requiredHC !== null) 
    ? defaults.actualHC - defaults.requiredHC 
    : null;

  // 6. HC flow calculations
  if (defaults.actualHC !== null && defaults.attritionPercentage !== null) {
    defaults.attritionLossHC = defaults.actualHC * (defaults.attritionPercentage / 100);
    defaults.hcAfterAttrition = defaults.actualHC - defaults.attritionLossHC;
    
    const moveIn = defaults.moveIn ?? 0;
    const moveOut = defaults.moveOut ?? 0;
    const newHireProduction = defaults.newHireProduction ?? 0;
    
    defaults.endingHC = defaults.hcAfterAttrition + newHireProduction + moveIn - moveOut;
  }

  // 7. Actual productive minutes
  if (defaults.actualHC !== null && shrinkageFactor > 0 && occupancyFactor > 0) {
    defaults._calculatedActualProductiveAgentMinutes = 
      defaults.actualHC * standardWorkMinutes * shrinkageFactor * occupancyFactor;
  }

  return defaults;
}