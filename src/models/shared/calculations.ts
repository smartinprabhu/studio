import type { 
  ExtendedTeamPeriodicMetrics, 
  ExtendedAggregatedPeriodicMetrics,
  ModelCalculationContext,
  ModelType 
} from './interfaces';
import { SIMPLIFIED_FTE_FACTOR } from './constants';

// CPH Model Calculations (mathematically equivalent to Volume & Backlog)
export const calculateCPHModel = (
  teamMetrics: ExtendedTeamPeriodicMetrics,
  lobTotalBaseMinutes: number | null,
  context: ModelCalculationContext
): Partial<ExtendedTeamPeriodicMetrics> => {
  if (!teamMetrics.volumeMixPercentage || !lobTotalBaseMinutes) {
    return { requiredHC: null };
  }

  // Convert CPH to AHT equivalent for calculation
  const cph = teamMetrics.cph || 1;
  const equivalentAHT = 60 / cph; // CPH = 60 / AHT

  // Use same calculation as Volume & Backlog but with CPH-derived AHT
  const teamBaseMinutes = lobTotalBaseMinutes * (teamMetrics.volumeMixPercentage / 100);
  const backlogAdjustment = 1 + ((teamMetrics.backlogPercentage || 0) / 100);
  const effectiveRequiredMinutes = teamBaseMinutes * backlogAdjustment;

  const shrinkageFactor = 1 - ((teamMetrics.shrinkagePercentage || 0) / 100);
  const occupancyFactor = (teamMetrics.occupancyPercentage || 85) / 100;
  const effectiveProductiveMinutes = context.standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor;

  const requiredHC = effectiveProductiveMinutes > 0 ? effectiveRequiredMinutes / effectiveProductiveMinutes : null;

  return {
    _calculatedRequiredAgentMinutes: effectiveRequiredMinutes,
    requiredHC: requiredHC,
    overUnderHC: (teamMetrics.actualHC && requiredHC) ? teamMetrics.actualHC - requiredHC : null
  };
};

// Fix FTE Model Calculations (simplified methodology)
export const calculateFixFTEModel = (
  teamMetrics: ExtendedTeamPeriodicMetrics,
  lobTotalBaseMinutes: number | null,
  context: ModelCalculationContext
): Partial<ExtendedTeamPeriodicMetrics> => {
  if (!teamMetrics.volumeMixPercentage || !lobTotalBaseMinutes) {
    return { requiredFTE: null };
  }

  // Simplified calculation - produces ~25% lower requirements
  const teamBaseMinutes = lobTotalBaseMinutes * (teamMetrics.volumeMixPercentage / 100);
  const simplifiedFTE = teamBaseMinutes / (context.standardWorkMinutesForPeriod * SIMPLIFIED_FTE_FACTOR);

  return {
    _calculatedRequiredAgentMinutes: teamBaseMinutes,
    requiredFTE: simplifiedFTE,
    overUnderHC: (teamMetrics.actualHC && simplifiedFTE) ? teamMetrics.actualHC - simplifiedFTE : null
  };
};

// Fix HC Model Calculations (same as Fix FTE but outputs HC)
export const calculateFixHCModel = (
  teamMetrics: ExtendedTeamPeriodicMetrics,
  lobTotalBaseMinutes: number | null,
  context: ModelCalculationContext
): Partial<ExtendedTeamPeriodicMetrics> => {
  const fteResult = calculateFixFTEModel(teamMetrics, lobTotalBaseMinutes, context);
  
  return {
    _calculatedRequiredAgentMinutes: fteResult._calculatedRequiredAgentMinutes,
    requiredHC: fteResult.requiredFTE, // Same value, different label
    overUnderHC: fteResult.overUnderHC
  };
};

// Billable Hours Model Calculations (strategic linear approach)
export const calculateBillableHoursModel = (
  teamMetrics: ExtendedTeamPeriodicMetrics,
  lobBillableHours: number | null,
  context: ModelCalculationContext
): Partial<ExtendedTeamPeriodicMetrics> => {
  if (!teamMetrics.volumeMixPercentage || !lobBillableHours) {
    return { requiredHC: null };
  }

  // Linear calculation: billable hours / standard hours
  const teamBillableHours = lobBillableHours * (teamMetrics.volumeMixPercentage / 100);
  const standardHoursPerPeriod = context.standardWorkMinutesForPeriod / 60; // Convert to hours
  const requiredHC = teamBillableHours / standardHoursPerPeriod;

  return {
    requiredHC: requiredHC,
    overUnderHC: (teamMetrics.actualHC && requiredHC) ? teamMetrics.actualHC - requiredHC : null
  };
};

// LOB-level calculations for CPH model
export const calculateLOBTotalBaseMinutesForCPH = (
  volume: number | null,
  averageCPH: number | null
): number | null => {
  if (!volume || !averageCPH || averageCPH <= 0) return null;
  
  // Convert CPH to minutes: (Volume / CPH) * 60
  return (volume / averageCPH) * 60;
};

// LOB-level calculations for Billable Hours model
export const calculateLOBRequiredHCForBillableHours = (
  billableHours: number | null,
  standardWorkMinutesForPeriod: number
): number | null => {
  if (!billableHours) return null;
  
  const standardHoursPerPeriod = standardWorkMinutesForPeriod / 60;
  return billableHours / standardHoursPerPeriod;
};

// Generic calculation dispatcher
export const calculateModelMetrics = (
  modelType: ModelType,
  teamMetrics: ExtendedTeamPeriodicMetrics,
  lobData: number | null,
  context: ModelCalculationContext
): Partial<ExtendedTeamPeriodicMetrics> => {
  switch (modelType) {
    case 'cph':
      return calculateCPHModel(teamMetrics, lobData, context);
    case 'fix-fte':
      return calculateFixFTEModel(teamMetrics, lobData, context);
    case 'fix-hc':
      return calculateFixHCModel(teamMetrics, lobData, context);
    case 'billable-hours':
      return calculateBillableHoursModel(teamMetrics, lobData, context);
    default:
      return {}; // Volume & Backlog uses existing calculation
  }
};