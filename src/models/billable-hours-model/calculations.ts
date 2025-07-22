import type { 
  ExtendedTeamPeriodicMetrics,
  ExtendedAggregatedPeriodicMetrics,
  ModelCalculationContext 
} from '../shared/interfaces';
import { 
  STANDARD_WEEKLY_WORK_MINUTES, 
  STANDARD_MONTHLY_WORK_MINUTES 
} from '@/components/capacity-insights/types';

export function calculateBillableHoursTeamMetricsForPeriod(
  teamInput: Partial<ExtendedTeamPeriodicMetrics>,
  aggregatedInput: Partial<ExtendedAggregatedPeriodicMetrics>,
  standardWorkMinutes: number = STANDARD_WEEKLY_WORK_MINUTES
): ExtendedTeamPeriodicMetrics {
  const defaults: ExtendedTeamPeriodicMetrics = { ...teamInput };
  
  const billableHours = aggregatedInput.billableHoursRequire ?? 0;
  const teamAllocation = (defaults.volumeMixPercentage ?? 0) / 100;
  const teamBillableHours = billableHours * teamAllocation;
  
  // Linear calculation: billable hours / standard hours
  const standardHoursPerPeriod = standardWorkMinutes / 60;
  defaults.requiredHC = standardHoursPerPeriod > 0 ? teamBillableHours / standardHoursPerPeriod : null;

  // Over/Under calculation
  defaults.overUnderHC = (defaults.actualHC !== null && defaults.requiredHC !== null) 
    ? defaults.actualHC - defaults.requiredHC 
    : null;

  // HC flow calculations (simplified for strategic planning)
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