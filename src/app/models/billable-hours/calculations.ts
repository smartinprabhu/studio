import { BillableHoursTeamPeriodicMetrics } from './types';
import { AggregatedPeriodicMetrics } from '../shared/interfaces';

export function calculateBillableHoursForPeriod(
  teamInput: Partial<BillableHoursTeamPeriodicMetrics>,
  aggregatedInput: Partial<AggregatedPeriodicMetrics>
): BillableHoursTeamPeriodicMetrics {
  const defaults: BillableHoursTeamPeriodicMetrics = { ...teamInput } as BillableHoursTeamPeriodicMetrics;
  const billable = aggregatedInput.billableHoursRequire ?? 0;
  const aht = aggregatedInput.lobAverageAHT ?? 0;

  const reqMins = billable * aht;
  defaults.requiredHC = reqMins / 2400;

  const currentActualHC = defaults.actualHC ?? 0;
  defaults.overUnderHC = (currentActualHC !== null && defaults.requiredHC !== null) ? currentActualHC - defaults.requiredHC : null;

  return defaults;
}
