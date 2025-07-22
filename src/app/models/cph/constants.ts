import { TeamMetricDefinitions, AggregatedMetricDefinitions } from '../shared/interfaces';

export const CPH_TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: 'cph', label: 'CPH', isTime: false, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC' },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 1, category: 'PrimaryHC' },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC' },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  { key: "inOfficeShrinkagePercentage", label: "In Office Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  { key: "outOfOfficeShrinkagePercentage", label: "Out of Office Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
];

export const CPH_AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: 'lobAverageCPH', label: 'Average CPH', isEditableForLob: true, step: 0.1, isTime: false },
  { key: "lobVolumeForecast", label: "Volume Forecast", isEditableForLob: true, step: 1, isCount: true },
  { key: "lobTotalBaseRequiredMinutes", label: "Total Base Req Mins", isEditableForLob: true, isTime: true },
  { key: "handlingCapacity", label: "Handling Capacity", isCount: true, isDisplayOnly: true },
  { key: "requiredHC", label: "Required HC", isHC: true },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
];
