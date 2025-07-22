import { CPHTeamPeriodicMetrics } from './types';
import { STANDARD_WEEKLY_WORK_MINUTES, STANDARD_MONTHLY_WORK_MINUTES } from '../shared/constants';

export function calculateCPHTeamMetricsForPeriod(
  teamInput: Partial<CPHTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number
): CPHTeamPeriodicMetrics {
  const defaults: CPHTeamPeriodicMetrics = { ...teamInput } as CPHTeamPeriodicMetrics;

  // 1. Convert CPH → AHT
  const cph = defaults.cph ?? 0;
  const convertedAHT = cph > 0 ? 60 / cph : null;
  defaults.aht = convertedAHT;

  // 2. Copy Volume & Backlog logic using convertedAHT internally
  const baseMins = (lobTotalBaseMinutes ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const effMins = baseMins * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  const prodMinsPerHC = standardWorkMinutes
    * (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100))
    * (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100))
    * ((defaults.occupancyPercentage ?? 0) / 100);

  defaults.requiredHC = (effMins > 0 && prodMinsPerHC > 0)
    ? effMins / prodMinsPerHC
    : null;

  const currentActualHC = defaults.actualHC ?? 0;
  defaults.overUnderHC = (currentActualHC !== null && defaults.requiredHC !== null) ? currentActualHC - defaults.requiredHC : null;


  // HC flow logic unchanged
  return defaults;
}
