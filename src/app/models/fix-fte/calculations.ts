import { FixFteTeamPeriodicMetrics } from './types';

export function calculateFixFteForPeriod(
  teamInput: Partial<FixFteTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number
): FixFteTeamPeriodicMetrics {
  const defaults: FixFteTeamPeriodicMetrics = { ...teamInput } as FixFteTeamPeriodicMetrics;

  const baseMins = (lobTotalBaseMinutes ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const prodMinsPerFTE = standardWorkMinutes
    * (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100))
    * (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100));

  defaults.requiredFTE = (prodMinsPerFTE > 0)
    ? baseMins / prodMinsPerFTE
    : null;

  const currentActualHC = defaults.actualHC ?? 0;
  defaults.overUnderHC = (currentActualHC !== null && defaults.requiredFTE !== null) ? currentActualHC - defaults.requiredFTE : null;

  return defaults;
}
