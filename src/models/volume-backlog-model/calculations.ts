import type { TeamPeriodicMetrics } from "@/components/capacity-insights/types";

export function calculateTeamMetricsForPeriod(
  teamInputDataCurrentPeriod: Partial<TeamPeriodicMetrics>,
  lobTotalBaseRequiredMinutesForPeriod: number | null,
  standardWorkMinutesForPeriod: number
): TeamPeriodicMetrics {
  const defaults: TeamPeriodicMetrics = {
    aht: null,
    inOfficeShrinkagePercentage: null,
    outOfOfficeShrinkagePercentage: null,
    occupancyPercentage: null,
    backlogPercentage: null,
    attritionPercentage: null,
    volumeMixPercentage: null,
    actualHC: null,
    moveIn: null,
    moveOut: null,
    newHireBatch: null,
    newHireProduction: null,
    handlingCapacity: null,
    _productivity: null,
    _calculatedRequiredAgentMinutes: null,
    _calculatedActualProductiveAgentMinutes: null,
    requiredHC: null,
    overUnderHC: null,
    attritionLossHC: null,
    hcAfterAttrition: null,
    endingHC: null,
    _lobTotalBaseReqMinutesForCalc: null,
    ...teamInputDataCurrentPeriod,
  };

  // Calculate Effective Required Minutes for Team
  // Formula: (LOB Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)
  const baseTeamRequiredMinutes = (lobTotalBaseRequiredMinutesForPeriod ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const effectiveTeamRequiredMinutes = baseTeamRequiredMinutes * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  defaults._calculatedRequiredAgentMinutes = effectiveTeamRequiredMinutes;

  // Calculate Required HC
  // Formula: Effective Required Minutes / (Standard Minutes * (1 - In Office Shrinkage%) * (1 - Out of Office Shrinkage%) * Occupancy%)
  let requiredHC = null;
  const effectiveMinutesPerHC = standardWorkMinutesForPeriod *
    (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100)) *
    (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100)) *
    ((defaults.occupancyPercentage ?? 0) / 100);

  if (effectiveTeamRequiredMinutes > 0 && effectiveMinutesPerHC > 0) {
    requiredHC = effectiveTeamRequiredMinutes / effectiveMinutesPerHC;
  } else if (effectiveTeamRequiredMinutes === 0) {
    requiredHC = 0;
  }

  defaults.requiredHC = requiredHC;
  const currentActualHC = defaults.actualHC ?? 0;
  defaults.overUnderHC = (currentActualHC !== null && requiredHC !== null) ? currentActualHC - requiredHC : null;

  // Calculate Actual Productive Minutes for Team
  // Formula: Actual HC * Standard Minutes * (1 - In Office Shrinkage%) * (1 - Out of Office Shrinkage%) * Occupancy%
  if (currentActualHC !== null && standardWorkMinutesForPeriod > 0) {
    defaults._calculatedActualProductiveAgentMinutes = currentActualHC * standardWorkMinutesForPeriod *
      (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100)) *
      (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100)) *
      ((defaults.occupancyPercentage ?? 0) / 100);
  } else {
    defaults._calculatedActualProductiveAgentMinutes = 0;
  }

  // Calculate HC Flow Adjustments
  // Attrition Loss: Actual HC * Attrition %
  const attritionLossHC = currentActualHC * ((defaults.attritionPercentage ?? 0) / 100);
  defaults.attritionLossHC = attritionLossHC;

  // HC After Attrition: Actual HC - Attrition Loss HC
  const hcAfterAttrition = currentActualHC - attritionLossHC;
  defaults.hcAfterAttrition = hcAfterAttrition;

  // Ending HC: HC After Attrition + New Hire Prod. + Move In - Move Out
  defaults.endingHC = hcAfterAttrition + (defaults.newHireProduction ?? 0) + (defaults.moveIn ?? 0) - (defaults.moveOut ?? 0);

  return defaults;
}
