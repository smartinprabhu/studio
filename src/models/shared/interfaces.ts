import type { DateRange } from "react-day-picker";
import type { 
  TeamPeriodicMetrics as BaseTeamMetrics,
  AggregatedPeriodicMetrics as BaseAggregatedMetrics,
  MetricDefinition,
  TimeInterval,
  BusinessUnitName
} from "@/components/capacity-insights/types";

// Model Types
export type ModelType = 'volume-backlog' | 'cph' | 'fix-fte' | 'fix-hc' | 'billable-hours';

export interface ModelConfiguration {
  id: ModelType;
  name: string;
  description: string;
  complexity: 'HIGH' | 'MEDIUM' | 'LOW';
  primaryMetricKey: 'requiredHC' | 'requiredFTE';
  useSimplifiedMetrics: boolean;
}

// Extended metrics for model-specific fields
export interface ExtendedTeamPeriodicMetrics extends BaseTeamMetrics {
  // CPH Model
  cph?: number | null;
  
  // Fix Models  
  requiredFTE?: number | null;
  
  // Billable Hours Model
  billableHoursRequire?: number | null;
  handlingCapacity?: number | null;
}

export interface ExtendedAggregatedPeriodicMetrics extends BaseAggregatedMetrics {
  // Billable Hours Model
  billableHoursRequire?: number | null;
  handlingCapacity?: number | null;
}

// Model-specific calculation context
export interface ModelCalculationContext {
  modelType: ModelType;
  useSimplifiedMetrics: boolean;
  primaryMetricKey: 'requiredHC' | 'requiredFTE';
  standardWorkMinutesForPeriod: number;
}

// Model-specific metric definitions
export type ModelMetricDefinitions = {
  teamMetrics: MetricDefinition[];
  aggregatedMetrics: MetricDefinition[];
};

// Validation interface
export interface ModelValidationRule {
  metricKey: string;
  validate: (value: number) => boolean;
  errorMessage: string;
}

export interface ModelValidationRules {
  [modelType: string]: ModelValidationRule[];
}