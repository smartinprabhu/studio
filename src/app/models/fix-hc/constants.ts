import { TeamMetricDefinitions } from '../shared/interfaces';

export const FIX_HC_TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
    { key: 'requiredHC', label: 'Required HC', isDisplayOnly: true, category: 'PrimaryHC' },
    { key: 'actualHC', label: 'Actual/Starting HC', isHC: true, isEditableForTeam: true, category: 'PrimaryHC' },
    { key: 'overUnderHC', label: 'Over/Under HC', isDisplayOnly: true, category: 'PrimaryHC' },
    { key: 'inOfficeShrinkagePercentage', label: 'In Office Shrinkage %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
    { key: 'outOfOfficeShrinkagePercentage', label: 'Out of Office Shrinkage %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
    { key: 'attritionPercentage', label: 'Attrition %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
    { key: 'volumeMixPercentage', label: 'Volume Mix %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
];
