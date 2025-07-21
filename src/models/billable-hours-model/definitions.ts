import type { MetricDefinition } from "@/components/capacity-insights/types";
import type { ModelMetricDefinitions } from "../shared/interfaces";

export const BILLABLE_HOURS_TEAM_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated HC needed for billable hours target." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "Actual headcount at the start of the period." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference: Actual/Starting HC - Required HC." },

  // Strategic planning assumptions - minimal variables
  { key: "volumeMixPercentage", label: "Allocation %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Percentage of billable hours allocated to this team." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },

  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring into this team." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring out of this team." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents starting training (not yet productive)." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents completing training and becoming productive." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost to attrition (Actual/Starting HC * Attrition %)." },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount after attrition, before other movements (Actual/Starting HC - Attrition Loss HC)." },
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period (HC After Attrition + New Hire Production + Move In - Move Out)." },
];

export const BILLABLE_HOURS_AGGREGATED_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "billableHoursRequire", label: "Billable Hours/Require Hours", isEditableForLob: true, step: 1, isTime: true, description: "Total billable hours required for this LOB." },
  { key: "handlingCapacity", label: "Handling Capacity", isEditableForLob: true, step: 1, isCount: true, description: "Strategic handling capacity target." },
  
  { key: "requiredHC", label: "Required HC", isHC: true, description: "Aggregated required headcount from child entities." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, description: "Aggregated actual/starting headcount from child entities." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, description: "Difference between aggregated Actual/Starting HC and Required HC." },
];

export const BILLABLE_HOURS_MODEL_DEFINITIONS: ModelMetricDefinitions = {
  teamMetrics: BILLABLE_HOURS_TEAM_METRIC_DEFINITIONS,
  aggregatedMetrics: BILLABLE_HOURS_AGGREGATED_METRIC_DEFINITIONS
};