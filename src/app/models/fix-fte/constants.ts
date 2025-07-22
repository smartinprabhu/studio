import { TeamMetricDefinitions } from '../shared/interfaces';

export const FIX_FTE_TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: 'requiredFTE', label: 'Required FTE', isDisplayOnly: true, category: 'PrimaryHC' },
  { key: 'actualHC', label: 'Actual/Starting HC', isHC: true, isEditableForTeam: true, category: 'PrimaryHC' },
  { key: 'overUnderHC', label: 'Over/Under FTE', isDisplayOnly: true, category: 'PrimaryHC' },
  { key: 'inOfficeShrinkagePercentage', label: 'In Office Shrinkage %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  { key: 'outOfOfficeShrinkagePercentage', label: 'Out of Office Shrinkage %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  { key: 'attritionPercentage', label: 'Attrition %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  { key: 'volumeMixPercentage', label: 'Volume Mix %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
];
