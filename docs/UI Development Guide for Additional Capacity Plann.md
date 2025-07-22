<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# UI Development Guide for Additional Capacity Planning Models

This guide provides a **detailed, markdown-based blueprint** for building the UIs of the **CPH Model**, **Fix FTE Model**, **Fix HC Model**, and **Billable Hours Model**, following the exact theme, structure, and component patterns of the existing **Volume \& Backlog Hybrid Model**. Each section outlines:

- File structure and naming conventions
- Metric definitions (inclusions/exclusions)
- TypeScript interfaces
- Calculation function signature and core logic
- Reusable UI components and styling
- Validation rules and initial data


## Shared Repository Structure

```
/models/
  ├── volume-backlog/      # Existing reference implementation
  ├── cph-model/           # New CPH Model
  │   ├── constants.ts
  │   ├── calculations.ts
  │   ├── index.tsx
  │   └── types.ts
  ├── fix-fte-model/       # New Fix FTE Model
  │   ├── constants.ts
  │   ├── calculations.ts
  │   ├── index.tsx
  │   └── types.ts
  ├── fix-hc-model/        # New Fix HC Model
  │   ├── constants.ts
  │   ├── calculations.ts
  │   ├── index.tsx
  │   └── types.ts
  ├── billable-hours-model/# New Billable Hours Model
  │   ├── constants.ts
  │   ├── calculations.ts
  │   ├── index.tsx
  │   └── types.ts
  └── shared/
      ├── components/      # CapacityTable, HeaderSection, MetricRow, etc.
      └── interfaces.ts    # Base types: CapacityDataRow, TeamPeriodicMetrics, AggregatedPeriodicMetrics
```

All new model folders mirror **volume-backlog/** exactly, differing only in `constants.ts`, `calculations.ts`, and `types.ts`.

## 1. CPH Model

### 1.1 constants.ts

```typescript
import { TeamMetricDefinitions, AggregatedMetricDefinitions } from '../shared/interfaces';

export const CPH_TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: 'cph', label: 'CPH', isTime: false, isEditableForTeam: true, step: 0.1, category: 'Assumption' },
  // All other metrics copy exactly from volume-backlog TEAM_METRIC_ROW_DEFINITIONS
];

export const CPH_AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: 'lobAverageCPH', label: 'Average CPH', isEditableForLob: true, step: 0.1, isTime: false },
  // All other metrics copy exactly from volume-backlog AGGREGATED_METRIC_ROW_DEFINITIONS
];
```


### 1.2 types.ts

```typescript
import { CapacityDataRow, TeamPeriodicMetrics, AggregatedPeriodicMetrics } from '../shared/interfaces';

export interface CPHTeamPeriodicMetrics extends TeamPeriodicMetrics {
  cph?: number | null;
}

export interface CPHAggregatedPeriodicMetrics extends AggregatedPeriodicMetrics {
  lobAverageCPH?: number | null;
}

export interface CPHCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, CPHTeamPeriodicMetrics | CPHAggregatedPeriodicMetrics>;
}
```


### 1.3 calculations.ts

```typescript
import { CPHTeamPeriodicMetrics } from './types';

export function calculateCPHTeamMetricsForPeriod(
  teamInput: Partial<CPHTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number
): CPHTeamPeriodicMetrics {
  const defaults: CPHTeamPeriodicMetrics = { ...teamInput };

  // 1. Convert CPH → AHT
  const cph = defaults.cph ?? 0;
  const convertedAHT = cph > 0 ? 60 / cph : null;
  defaults.aht = convertedAHT;

  // 2. Copy Volume & Backlog logic using convertedAHT internally
  const baseMins = (lobTotalBaseMinutes ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const effMins = baseMins * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  const prodMinsPerHC = standardWorkMinutes
    * (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100))
    * (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100))
    * ((defaults.occupancyPercentage ?? 0) / 100);

  defaults.requiredHC = (effMins > 0 && prodMinsPerHC > 0)
    ? effMins / prodMinsPerHC
    : null;

  // HC flow logic unchanged
  return defaults;
}
```


### 1.4 index.tsx

```tsx
import React from 'react';
import { CapacityTable, HeaderSection } from '../shared/components';
import { CPH_TEAM_METRIC_ROW_DEFINITIONS, CPH_AGGREGATED_METRIC_ROW_DEFINITIONS } from './constants';
import { calculateCPHTeamMetricsForPeriod } from './calculations';

export default function CPHModelView(props) {
  // identical to volume-backlog view, swapping in CPH constants & calc
  return (
    <div className="model-container">
      <HeaderSection {...props} modelName="CPH Model" />
      <CapacityTable
        {...props}
        teamMetricDefinitions={CPH_TEAM_METRIC_ROW_DEFINITIONS}
        aggregatedMetricDefinitions={CPH_AGGREGATED_METRIC_ROW_DEFINITIONS}
        calculateTeamMetricsForPeriod={calculateCPHTeamMetricsForPeriod}
      />
    </div>
  );
}
```


## 2. Fix FTE Model

### 2.1 constants.ts

```typescript
import { TeamMetricDefinitions } from '../shared/interfaces';

export const FIX_FTE_TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: 'requiredFTE', label: 'Required FTE', isDisplayOnly: true, category: 'PrimaryHC' },
  // Include: actualHC, overUnderHC, volumeMixPercentage, inOfficeShrink%, outOfOfficeShrink%, attritionPercentage
  // Exclude: occupancyPercentage, backlogPercentage, aht, cph
];
```


### 2.2 types.ts

```typescript
import { CapacityDataRow, TeamPeriodicMetrics } from '../shared/interfaces';

export interface FixFteTeamPeriodicMetrics extends TeamPeriodicMetrics {
  requiredFTE?: number | null;
}

export interface FixFteCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, FixFteTeamPeriodicMetrics>;
}
```


### 2.3 calculations.ts

```typescript
import { FixFteTeamPeriodicMetrics } from './types';

export function calculateFixFteForPeriod(
  teamInput: Partial<FixFteTeamPeriodicMetrics>,
  lobTotalBaseMinutes: number | null,
  standardWorkMinutes: number
): FixFteTeamPeriodicMetrics {
  const defaults: FixFteTeamPeriodicMetrics = { ...teamInput };

  const baseMins = (lobTotalBaseMinutes ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const prodMinsPerFTE = standardWorkMinutes
    * (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100))
    * (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100));

  defaults.requiredFTE = (prodMinsPerFTE > 0)
    ? baseMins / prodMinsPerFTE
    : null;

  // HC flow logic (attrition, moves) unchanged
  return defaults;
}
```


### 2.4 index.tsx

```tsx
import React from 'react';
import { CapacityTable, HeaderSection } from '../shared/components';
import { FIX_FTE_TEAM_METRIC_ROW_DEFINITIONS } from './constants';
import { calculateFixFteForPeriod } from './calculations';

export default function FixFteModelView(props) {
  return (
    <div className="model-container">
      <HeaderSection {...props} modelName="Fix FTE Model" />
      <CapacityTable
        {...props}
        teamMetricDefinitions={FIX_FTE_TEAM_METRIC_ROW_DEFINITIONS}
        calculateTeamMetricsForPeriod={calculateFixFteForPeriod}
      />
    </div>
  );
}
```


## 3. Fix HC Model

> **Note:** Identical to Fix FTE Model but renames “Required FTE” → “Required HC” and formats output as whole numbers.

- **constants.ts**: Copy `FIX_FTE_TEAM_METRIC_ROW_DEFINITIONS`, rename keys/labels (`requiredHC`, `overUnderHC`).
- **types.ts**: Extend `TeamPeriodicMetrics` with `requiredHC?: number`.
- **calculations.ts**: Call `calculateFixFteForPeriod` internally, map its `requiredFTE` result to `requiredHC`.
- **index.tsx**: Update modelName to “Fix HC Model” and use HC constants/calculation.


## 4. Billable Hours Model

### 4.1 constants.ts

```typescript
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
```


### 4.2 types.ts

```typescript
import { CapacityDataRow, TeamPeriodicMetrics, AggregatedPeriodicMetrics } from '../shared/interfaces';

export interface BillableHoursTeamPeriodicMetrics extends TeamPeriodicMetrics {
  // uses default AHT and attrition only
}

export interface BillableHoursAggregatedPeriodicMetrics extends AggregatedPeriodicMetrics {
  billableHoursRequire?: number | null;
}

export interface BillableHoursCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, BillableHoursTeamPeriodicMetrics | BillableHoursAggregatedPeriodicMetrics>;
}
```


### 4.3 calculations.ts

```typescript
import { BillableHoursTeamPeriodicMetrics } from './types';

export function calculateBillableHoursForPeriod(
  teamInput: Partial<BillableHoursTeamPeriodicMetrics>,
  aggregatedInput: Partial<BillableHoursAggregatedPeriodicMetrics>
): BillableHoursTeamPeriodicMetrics {
  const defaults: BillableHoursTeamPeriodicMetrics = { ...teamInput };
  const billable = aggregatedInput.billableHoursRequire ?? 0;
  const aht = aggregatedInput.averageAHT ?? 0;

  const reqMins = billable * aht;
  defaults.requiredHC = reqMins / 2400;
  // HC flow logic unchanged
  return defaults;
}
```


### 4.4 index.tsx

```tsx
import React from 'react';
import { CapacityTable, HeaderSection } from '../shared/components';
import {
  BILLABLE_HOURS_AGGREGATED_METRIC_ROW_DEFINITIONS,
  BILLABLE_HOURS_TEAM_METRIC_ROW_DEFINITIONS
} from './constants';
import { calculateBillableHoursForPeriod } from './calculations';

export default function BillableHoursModelView(props) {
  return (
    <div className="model-container">
      <HeaderSection {...props} modelName="Billable Hours Model" />
      <CapacityTable
        {...props}
        aggregatedMetricDefinitions={BILLABLE_HOURS_AGGREGATED_METRIC_ROW_DEFINITIONS}
        teamMetricDefinitions={BILLABLE_HOURS_TEAM_METRIC_ROW_DEFINITIONS}
        calculateTeamMetricsForPeriod={calculateBillableHoursForPeriod}
      />
    </div>
  );
}
```


## Validation \& Styling

- **Input Validation:**
    - **CPH Model:** 0.1 ≤ CPH ≤ 5.0
    - **Fix Models:** Required FTE/HC ≥ 0
    - **Billable Hours:** Billable Hours ≥ 0
- **Styling:** Reuse all CSS classes, theme variables, and component layouts from **volume-backlog/**.
- **Tooltips \& Help Text:** Copy existing formula tooltips, modifying only parameter names.

This markdown acts as a **step-by-step UI specification** ensuring consistency, accuracy, and fidelity to the original Volume \& Backlog Hybrid implementation while honoring each model’s unique formula set and parameter inclusion/exclusion.

