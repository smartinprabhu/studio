import { AggregatedMetricDefinitions, TeamMetricDefinitions } from '../shared/interfaces';

export const BILLABLE_HOURS_AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: 'billableHoursRequire', label: 'Billable Hours/Require Hours', isTime: true, isEditableForLob: true },
  { key: 'averageAHT', label: 'Average AHT', isTime: true, isEditableForLob: true },
  { key: 'handlingCapacity', label: 'Handling Capacity', isCount: true, isDisplayOnly: true },
  { key: 'requiredHC', label: 'Required HC', isHC: true }
];

export const BILLABLE_HOURS_TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: 'requiredHC', label: 'Required HC', isHC: true, isDisplayOnly: true },
  { key: 'actualHC', label: 'Actual/Starting HC', isEditableForTeam: true, isHC: true },
  { key: 'overUnderHC', label: 'Over/Under HC', isHC: true, isDisplayOnly: true },
  { key: 'attritionPercentage', label: 'Attrition %', isPercentage: true, isEditableForTeam: true }
];
