

Create four additional capacity planning model UIs that mirror the exact structure, formulas, and business logic found in your Excel workbook `docs/Front End View of Capacity Planning (2).xlsx`. The existing `src/app/page.tsx` contains a perfect implementation of the **Volume \& Backlog Hybrid Model**. The four new models represent: (1) **CPH Model** - mathematically identical but uses Contacts Per Hour instead of AHT, (2) **Fix FTE Model** - simplified resource planning outputting FTE instead of HC, (3) **Fix HC Model** - identical to Fix FTE but outputs HC, and (4) **Billable Hours Model** - strategic long-term planning with linear growth patterns.

## Detailed Model Specifications

### 1. CPH (Contacts Per Hour) Model

**Status**: Functionally identical to Volume \& Backlog Hybrid Model
**Week 1 Required HC**: 723.88 (exactly same as Volume \& Backlog)

**Exact Changes Required**:

```typescript
// Replace AHT with CPH in team metrics
{ key: 'cph', label: 'CPH', isTime: false, isEditableForTeam: true, step: 0.1, category: 'Assumption' }
// Remove: { key: 'aht', label: 'AHT', ...}

// Replace Average AHT with Average CPH in aggregated metrics  
{ key: 'lobAverageCPH', label: 'Average CPH', isTime: false, isEditableForLob: true, step: 0.1 }
// Remove: { key: 'lobAverageAHT', label: 'Average AHT', ...}

// Formula conversion in calculateTeamMetricsForPeriod
const ahtFromCPH = cphValue > 0 ? 60 / cphValue : null;
const baseTeamRequiredMinutes = (lobVolumeForecast * ahtFromCPH * volumeMixPercentage) / 100;
// All other calculations remain identical to Volume & Backlog Hybrid
```

**UI Requirements**:

- All input fields, validation, and productivity factors identical to Volume \& Backlog
- Change "AHT" labels to "CPH" throughout interface
- Input validation: CPH must be 0.5-3.0 contacts per hour
- Formula tooltips updated to reference CPH instead of AHT
- **Same complexity level as Volume \& Backlog Hybrid**


### 2. Fix FTE Model

**Status**: Simplified methodology with alternative calculation approach
**Week 1 Required FTE**: 541.15 (25% lower than Volume \& Backlog)

**Exact Changes Required**:

```typescript
// Simplified team metrics (remove complex productivity factors)
export const FIX_FTE_TEAM_METRICS: TeamMetricDefinitions = [
  { key: 'requiredFTE', label: 'Required FTE', isDisplayOnly: true, category: 'PrimaryHC' },
  { key: 'actualHC', label: 'Actual/Starting HC', isHC: true, isEditableForTeam: true, category: 'PrimaryHC' },
  { key: 'overUnderFTE', label: 'Over/Under FTE', isDisplayOnly: true, category: 'PrimaryHC' },
  // REMOVE: occupancyPercentage, backlogPercentage (key difference)
  { key: 'inOfficeShrinkagePercentage', label: 'In Office Shrinkage %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  { key: 'outOfOfficeShrinkagePercentage', label: 'Out of Office Shrinkage %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  { key: 'attritionPercentage', label: 'Attrition %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  { key: 'volumeMixPercentage', label: 'Volume Mix %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
  // Standard HC flow metrics remain
];

// Simplified calculation function (exact method not documented - reverse engineer from Excel data)
const calculateFixFTEForPeriod = (teamInput, lobTotalBaseMinutes) => {
  // Based on Excel analysis: produces ~75% of Volume & Backlog requirements
  // Simplified approach without Occupancy % and Backlog % factors
  const simplifiedRequiredMinutes = (lobTotalBaseMinutes * volumeMixPercentage / 100);
  const productiveMinutesPerFTE = 2400 * (1 - inOfficeShrinkage/100) * (1 - outOfOfficeShrinkage/100);
  // Note: Missing Occupancy % multiplication (key difference)
  return { requiredFTE: simplifiedRequiredMinutes / productiveMinutesPerFTE };
};
```

**UI Requirements**:

- **Medium complexity level** - fewer input fields than Volume \& Backlog
- Remove Occupancy % and Backlog % input fields entirely
- Change "Required HC" to "Required FTE" throughout interface
- FTE-specific formatting: decimal precision appropriate for FTE calculations
- Simplified assumptions section reflecting fewer variables
- All HC flow calculations remain identical (attrition, moves, new hires)


### 3. Fix HC Model

**Status**: Identical to Fix FTE Model but outputs HC instead of FTE
**Week 1 Required HC**: 541.15 (same value as Fix FTE)

**Implementation**:

```typescript
// Identical metric structure to Fix FTE
export const FIX_HC_TEAM_METRICS = FIX_FTE_TEAM_METRICS.map(metric => 
  metric.key === 'requiredFTE' 
    ? { ...metric, key: 'requiredHC', label: 'Required HC', isHC: true }
    : metric.key === 'overUnderFTE'
    ? { ...metric, key: 'overUnderHC', label: 'Over/Under HC' }  
    : metric
);

// Identical calculation to Fix FTE, different output labeling
const calculateFixHCForPeriod = (teamInput, lobTotalBaseMinutes) => {
  const fteResult = calculateFixFTEForPeriod(teamInput, lobTotalBaseMinutes);
  return { requiredHC: fteResult.requiredFTE }; // Same calculation, HC label
};
```

**UI Requirements**:

- **Identical interface layout to Fix FTE Model**
- Change all "FTE" labels to "HC"
- HC-specific formatting: whole numbers, no decimal places
- Same simplified metric structure as Fix FTE (no Occupancy %, no Backlog %)
- **Medium complexity level** matching Fix FTE


### 4. Billable Hours Model

**Status**: Strategic long-term planning model with distinct methodology
**Week 1 Required HC**: 460.58 (lowest of all models)

**Exact Changes Required**:

```typescript
// Strategic-focused aggregated metrics
export const BILLABLE_HOURS_AGGREGATED_METRICS: AggregatedMetricDefinitions = [
  { key: 'billableHoursRequire', label: 'Billable Hours/Require Hours', isEditableForLob: true, isTime: true, step: 100 },
  { key: 'averageAHT', label: 'Average AHT', isTime: true, isEditableForLob: true },
  { key: 'handlingCapacity', label: 'Handling Capacity', isCount: true, isDisplayOnly: true },
  { key: 'requiredHC', label: 'Required HC', isHC: true, isDisplayOnly: true }
];

// Strategic team metrics (minimal complexity)
export const BILLABLE_HOURS_TEAM_METRICS: TeamMetricDefinitions = [
  { key: 'requiredHC', label: 'Required HC', isHC: true, isDisplayOnly: true, category: 'PrimaryHC' },
  { key: 'actualHC', label: 'Actual/Starting HC', isHC: true, isEditableForTeam: true, category: 'PrimaryHC' },
  { key: 'overUnderHC', label: 'Over/Under HC', isHC: true, isDisplayOnly: true, category: 'PrimaryHC' },
  // Minimal productivity variables for strategic planning
  { key: 'attritionPercentage', label: 'Attrition %', isPercentage: true, isEditableForTeam: true, category: 'Assumption' },
];

// Strategic calculation methodology  
const calculateBillableHoursModel = (billableHours, averageAHT) => {
  const requiredMinutes = billableHours * averageAHT;
  const standardWeeklyHours = 2400; // Same base as other models
  return {
    requiredHC: requiredMinutes / standardWeeklyHours,
    handlingCapacity: billableHours / averageAHT
  };
};
```

**UI Requirements**:

- **Low complexity level** - minimal input variables
- Replace "Volume Forecast" with "Billable Hours/Require Hours" input field
- **Linear trend visualization** instead of volatile demand-driven patterns
- Strategic planning language: "contractual hours", "budget planning"
- Longer time horizon display (months/quarters instead of weeks)
- Simplified team structure with fewer detailed operational metrics


## Shared UI Framework Requirements

### Model Selector Integration

```typescript
interface ModelConfiguration {
  id: 'volume-backlog' | 'cph' | 'fix-fte' | 'fix-hc' | 'billable-hours';
  name: string;
  complexity: 'HIGH' | 'MEDIUM' | 'LOW';
  primaryMetric: 'requiredHC' | 'requiredFTE';
  weekOneValue: number; // For validation/testing
}

const MODEL_CONFIGS: ModelConfiguration[] = [
  { id: 'volume-backlog', name: 'Volume & Backlog Hybrid', complexity: 'HIGH', primaryMetric: 'requiredHC', weekOneValue: 723.88 },
  { id: 'cph', name: 'CPH Model', complexity: 'HIGH', primaryMetric: 'requiredHC', weekOneValue: 723.88 },
  { id: 'fix-fte', name: 'Fix FTE Model', complexity: 'MEDIUM', primaryMetric: 'requiredFTE', weekOneValue: 541.15 },
  { id: 'fix-hc', name: 'Fix HC Model', complexity: 'MEDIUM', primaryMetric: 'requiredHC', weekOneValue: 541.15 },
  { id: 'billable-hours', name: 'Billable Hours Model', complexity: 'LOW', primaryMetric: 'requiredHC', weekOneValue: 460.58 }
];
```


### Shared Data Structure Extensions

```typescript  
// Extend existing interfaces for model-specific metrics
interface ModelSpecificMetrics extends TeamPeriodicMetrics {
  // CPH Model
  cph?: number | null;
  lobAverageCPH?: number | null;
  
  // Fix Models
  requiredFTE?: number | null;
  overUnderFTE?: number | null;
  
  // Billable Hours Model  
  billableHoursRequire?: number | null;
}

// Model-specific validation contexts
interface ModelValidationRules {
  cph?: { min: 0.5, max: 3.0 };
  billableHoursRequire?: { min: 100, max: 100000 };
  requiredFTE?: { decimalPlaces: 2 };
  requiredHC?: { decimalPlaces: 0 };
}
```


## Hierarchical Data Structure (Identical Across All Models)

**Business Unit**: POS
**Lines of Business**: Case Type 1, Case Type 2
**Teams**: Inhouse, BPO 1, BPO 2

**Team-specific Parameters (From Excel Analysis)**:

- **Case Type 1 Inhouse**: AHT=50min, CPH=1.2, Volume Mix=30%, OOO Shrinkage=20%, IO Shrinkage=10%
- **Case Type 1 BPO 1**: AHT=35min, CPH=1.71, Volume Mix=40%, OOO Shrinkage=0%, IO Shrinkage=9%
- **Case Type 1 BPO 2**: AHT=40min, CPH=1.5, Volume Mix=30%, OOO Shrinkage=0%, IO Shrinkage=5%
- **Case Type 2 Teams**: Similar structure with AHT=50-70min, different volume mixes


## Implementation Priority \& Testing

### Phase 1: CPH Model (2 hours)

- Simplest - mathematical equivalence with Volume \& Backlog
- Test: Week 1 Required HC = 723.88 (exactly matching Volume \& Backlog)


### Phase 2: Fix Models (1 day each)

- Implement simplified metric structure
- Test: Week 1 output = 541.15 for both Fix FTE and Fix HC models


### Phase 3: Billable Hours Model (2 days)

- Strategic planning interface
- Test: Week 1 Required HC = 460.58


### Phase 4: Integration (1 day)

- Model selector dropdown
- Unified state management
- Cross-model data persistence


## Exact Validation Criteria

**Success Metrics**:

1. **CPH Model**: Week 1 POS Required HC = 723.88 (±0.01)
2. **Fix FTE Model**: Week 1 POS Required FTE = 541.15 (±0.01)
3. **Fix HC Model**: Week 1 POS Required HC = 541.15 (±0.01)
4. **Billable Hours Model**: Week 1 POS Required HC = 460.58 (±0.01)
5. **Mathematical Relationship**: CPH = 60/AHT for all CPH calculations
6. **Identical Pairs**: Volume \& Backlog ≡ CPH Model, Fix FTE ≡ Fix HC Model
