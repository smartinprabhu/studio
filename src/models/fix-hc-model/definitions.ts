import type { MetricDefinition } from "@/components/capacity-insights/types";
import type { ModelMetricDefinitions } from "../shared/interfaces";

export const FIX_HC_TEAM_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'PrimaryHC', description: "Team Effective Required Agent Minutes (simplified calculation)" },
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated HC needed using simplified methodology." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "Actual headcount at the start of the period." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference: Actual/Starting HC - Required HC." },

  // Simplified assumptions - removed occupancy, backlog, shrinkage
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },

  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring into this team." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring out of this team." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents starting training (not yet productive)." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents completing training and becoming productive." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost to attrition (Actual/Starting HC * Attrition %)." },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount after attrition, before other movements (Actual/Starting HC - Attrition Loss HC)." },
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period (HC After Attrition + New Hire Production + Move In - Move Out)." },
];

export const FIX_HC_AGGREGATED_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "requiredHC", label: "Required HC", isHC: true, description: "Aggregated required headcount from child entities." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, description: "Aggregated actual/starting headcount from child entities." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, description: "Difference between aggregated Actual/Starting HC and Required HC." },
];

export const FIX_HC_MODEL_DEFINITIONS: ModelMetricDefinitions = {
  teamMetrics: FIX_HC_TEAM_METRIC_DEFINITIONS,
  aggregatedMetrics: FIX_HC_AGGREGATED_METRIC_DEFINITIONS
};
