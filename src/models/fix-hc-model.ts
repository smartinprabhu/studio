import { TeamMetricDefinitions } from '@/components/capacity-insights/types';
import { FIX_FTE_TEAM_METRICS } from './fix-fte-model';

export const FIX_HC_TEAM_METRICS: TeamMetricDefinitions = FIX_FTE_TEAM_METRICS.map(metric =>
  metric.key === 'requiredFTE'
    ? { ...metric, key: 'requiredHC', label: 'Required HC', isHC: true }
    : metric
);
