import { AggregatedMetricDefinitions } from '@/components/capacity-insights/types';

export const BILLABLE_HOURS_AGGREGATED_METRICS: AggregatedMetricDefinitions = [
  { key: 'billableHoursRequire', label: 'Billable Hours/Require Hours', isEditableForLob: true, isTime: true },
  { key: 'averageAHT', label: 'Average AHT', isTime: true, isEditableForLob: true },
  { key: 'handlingCapacity', label: 'Handling Capacity', isCount: true },
  { key: 'requiredHC', label: 'Required HC', isHC: true, isDisplayOnly: true }
];
