import {
  TeamPeriodicMetrics,
  AggregatedPeriodicMetrics,
  STANDARD_WEEKLY_WORK_MINUTES,
  STANDARD_MONTHLY_WORK_MINUTES,
  TeamMetricDefinitions,
  AggregatedMetricDefinitions,
  CPH_TEAM_METRIC_ROW_DEFINITIONS,
  CPH_AGGREGATED_METRIC_ROW_DEFINITIONS,
  FIX_FTE_TEAM_METRICS,
  FIX_HC_TEAM_METRICS,
  BILLABLE_HOURS_AGGREGATED_METRICS,
} from '@/components/capacity-insights/types';

export const calculateCphModel = (
  teamInputDataCurrentPeriod: Partial<TeamPeriodicMetrics>,
  lobTotalBaseRequiredMinutesForPeriod: number | null,
  standardWorkMinutesForPeriod: number
): TeamPeriodicMetrics => {
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

  const cph = 60 / (defaults.aht || 1);
  const baseTeamRequiredMinutes = lobTotalBaseRequiredMinutesForPeriod ? (lobTotalBaseRequiredMinutesForPeriod / cph) * (defaults.volumeMixPercentage || 0) / 100 : 0;
  const effectiveTeamRequiredMinutes = baseTeamRequiredMinutes * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  defaults._calculatedRequiredAgentMinutes = effectiveTeamRequiredMinutes;

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

  if (currentActualHC !== null && standardWorkMinutesForPeriod > 0) {
    defaults._calculatedActualProductiveAgentMinutes = currentActualHC * standardWorkMinutesForPeriod *
      (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100)) *
      (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100)) *
      ((defaults.occupancyPercentage ?? 0) / 100);
  } else {
    defaults._calculatedActualProductiveAgentMinutes = 0;
  }

  const attritionLossHC = currentActualHC * ((defaults.attritionPercentage ?? 0) / 100);
  defaults.attritionLossHC = attritionLossHC;
  const hcAfterAttrition = currentActualHC - attritionLossHC;
  defaults.hcAfterAttrition = hcAfterAttrition;
  defaults.endingHC = hcAfterAttrition + (defaults.newHireProduction ?? 0) + (defaults.moveIn ?? 0) - (defaults.moveOut ?? 0);
  defaults._lobTotalBaseReqMinutesForCalc = lobTotalBaseRequiredMinutesForPeriod;

  return defaults;
};

export const calculateFixFteModel = (
  teamInput: Partial<TeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null
): Partial<TeamPeriodicMetrics> => {
  const volumeMixPercentage = teamInput.volumeMixPercentage || 0;
  const simplifiedFteFactor = 10000; // Example factor, adjust as needed
  const simplifiedFTE = lobTotalBaseMinutes ? (lobTotalBaseMinutes * volumeMixPercentage) / simplifiedFteFactor : 0;
  return { requiredFTE: simplifiedFTE };
};

export const calculateFixHcModel = (
  teamInput: Partial<TeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null
): Partial<TeamPeriodicMetrics> => {
  const fteResult = calculateFixFteModel(teamInput, lobTotalBaseMinutes);
  return { requiredHC: fteResult.requiredFTE };
};

export const calculateBillableHoursModel = (
  billableHours: number | null,
  standardHours: number
): Partial<AggregatedPeriodicMetrics> => {
  if (billableHours === null || standardHours <= 0) {
    return { requiredHC: null };
  }
  return {
    requiredHC: billableHours / standardHours,
  };
};
