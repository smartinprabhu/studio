import type { ModelConfiguration, ModelValidationRules } from './interfaces';

export const AVAILABLE_MODELS: ModelConfiguration[] = [
  { 
    id: 'volume-backlog', 
    name: 'Volume & Backlog Hybrid', 
    description: 'Full demand-driven operational planning', 
    complexity: 'HIGH',
    primaryMetricKey: 'requiredHC',
    useSimplifiedMetrics: false
  },
  { 
    id: 'cph', 
    name: 'CPH Model', 
    description: 'Contacts Per Hour approach (identical to Volume & Backlog)', 
    complexity: 'HIGH',
    primaryMetricKey: 'requiredHC',
    useSimplifiedMetrics: false
  },
  { 
    id: 'fix-fte', 
    name: 'Fix FTE Model', 
    description: 'Simplified FTE capacity planning', 
    complexity: 'MEDIUM',
    primaryMetricKey: 'requiredFTE',
    useSimplifiedMetrics: true
  },
  { 
    id: 'fix-hc', 
    name: 'Fix HC Model', 
    description: 'Simplified HC capacity planning', 
    complexity: 'MEDIUM',
    primaryMetricKey: 'requiredHC',
    useSimplifiedMetrics: true
  },
  { 
    id: 'billable-hours', 
    name: 'Billable Hours Model', 
    description: 'Strategic long-term planning', 
    complexity: 'LOW',
    primaryMetricKey: 'requiredHC',
    useSimplifiedMetrics: true
  }
];

export const MODEL_VALIDATION_RULES: ModelValidationRules = {
  'cph': [
    {
      metricKey: 'cph',
      validate: (value: number) => value > 0 && value <= 10,
      errorMessage: 'CPH must be between 0.1 and 10.0'
    }
  ],
  'fix-fte': [
    {
      metricKey: 'volumeMixPercentage',
      validate: (value: number) => value >= 0 && value <= 100,
      errorMessage: 'Volume Mix % must be between 0 and 100'
    }
  ],
  'fix-hc': [
    {
      metricKey: 'volumeMixPercentage',
      validate: (value: number) => value >= 0 && value <= 100,
      errorMessage: 'Volume Mix % must be between 0 and 100'
    }
  ],
  'billable-hours': [
    {
      metricKey: 'billableHoursRequire',
      validate: (value: number) => value > 0,
      errorMessage: 'Billable Hours must be positive'
    }
  ]
};

// Simplified FTE factor for Fix models (based on ~25% lower requirements)
export const SIMPLIFIED_FTE_FACTOR = 1.33; // Produces ~25% lower requirements than Volume & Backlog