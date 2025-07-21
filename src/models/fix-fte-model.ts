import { TeamMetricDefinitions } from '@/components/capacity-insights/types';

export const FIX_FTE_TEAM_METRICS: TeamMetricDefinitions = [
  { key: 'requiredFTE', label: 'Required FTE', isDisplayOnly: true, category: 'PrimaryHC' },
  { key: 'volumeMixPercentage', label: 'Volume Mix %', isPercentage: true, isEditableForTeam: true },
  { key: 'attritionPercentage', label: 'Attrition %', isPercentage: true, isEditableForTeam: true },
];
