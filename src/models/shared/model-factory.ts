import type { ModelType, ModelMetricDefinitions } from './interfaces';
import { CPH_MODEL_DEFINITIONS } from '../cph-model/definitions';
import { FIX_FTE_MODEL_DEFINITIONS } from '../fix-fte-model/definitions';
import { FIX_HC_MODEL_DEFINITIONS } from '../fix-hc-model/definitions';
import { BILLABLE_HOURS_MODEL_DEFINITIONS } from '../billable-hours-model/definitions';
import { 
  TEAM_METRIC_ROW_DEFINITIONS, 
  AGGREGATED_METRIC_ROW_DEFINITIONS 
} from '@/components/capacity-insights/types';

export const getModelDefinitions = (modelType: ModelType): ModelMetricDefinitions => {
  switch (modelType) {
    case 'cph':
      return CPH_MODEL_DEFINITIONS;
    case 'fix-fte':
      return FIX_FTE_MODEL_DEFINITIONS;
    case 'fix-hc':
      return FIX_HC_MODEL_DEFINITIONS;
    case 'billable-hours':
      return BILLABLE_HOURS_MODEL_DEFINITIONS;
    case 'volume-backlog':
    default:
      return {
        teamMetrics: TEAM_METRIC_ROW_DEFINITIONS,
        aggregatedMetrics: AGGREGATED_METRIC_ROW_DEFINITIONS
      };
  }
};

export const getModelDisplayName = (modelType: ModelType): string => {
  switch (modelType) {
    case 'cph': return 'CPH Model';
    case 'fix-fte': return 'Fix FTE Model';
    case 'fix-hc': return 'Fix HC Model';
    case 'billable-hours': return 'Billable Hours Model';
    case 'volume-backlog': return 'Volume & Backlog Hybrid';
    default: return 'Unknown Model';
  }
};

export const isSimplifiedModel = (modelType: ModelType): boolean => {
  return ['fix-fte', 'fix-hc', 'billable-hours'].includes(modelType);
};

export const getPrimaryMetricKey = (modelType: ModelType): 'requiredHC' | 'requiredFTE' => {
  return modelType === 'fix-fte' ? 'requiredFTE' : 'requiredHC';
};
