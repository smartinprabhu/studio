import type { MetricDefinition } from "@/components/capacity-insights/types";
import type { ModelMetricDefinitions } from "../shared/interfaces";

export const CPH_TEAM_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'PrimaryHC', description: "Team Effective Required Agent Minutes:\n(LOB Total Base Req Mins * (Team Vol Mix % / 100)) * (1 + (Team Backlog % / 100))" },
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated number of agents needed." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "Actual headcount at the start of the period." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference: Actual/Starting HC - Required HC." },

  { key: "cph", label: "CPH", isTime: false, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Contacts Per Hour: The average number of interactions handled per hour." },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Shrinkage: Percentage of paid time that agents are not available for handling interactions (e.g., breaks, training, meetings)." },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Occupancy: Percentage of time agents are busy with interaction-related work during their available time." },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Backlog: Percentage of additional work (e.g., deferred tasks) that needs to be handled on top of forecasted volume." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },

  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring into this team." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring out of this team." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents starting training (not yet productive)." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents completing training and becoming productive." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost to attrition (Actual/Starting HC * Attrition %)." },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount after attrition, before other movements (Actual/Starting HC - Attrition Loss HC)." },
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period (HC After Attrition + New Hire Production + Move In - Move Out)." },
  
  { key: "_calculatedActualProductiveAgentMinutes", label: "Actual Prod. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal', description: "Team Actual Productive Agent Minutes: Actual HC * Std Work Mins * (1-Shrink%) * Occupancy %" },
];

export const CPH_AGGREGATED_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "lobVolumeForecast", label: "LOB Volume Forecast", isEditableForLob: true, step: 1, isCount: true, description: "Total number of interactions forecasted for this LOB." },
  { key: "averageCPH", label: "LOB Average CPH", isEditableForLob: true, step: 0.1, isTime: false, description: "Average contacts per hour assumed for LOB interactions." },
  { key: "lobTotalBaseRequiredMinutes", label: "LOB Total Base Req Mins", isEditableForLob: true, isTime: true, step: 1, description: "Total agent minutes required for LOB volume, calculated as (Volume / CPH) * 60 or input directly." },
  
  { key: "requiredHC", label: "Required HC", isHC: true, description: "Aggregated required headcount from child entities." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, description: "Aggregated actual/starting headcount from child entities." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, description: "Difference between aggregated Actual/Starting HC and Required HC." },
];

export const CPH_MODEL_DEFINITIONS: ModelMetricDefinitions = {
  teamMetrics: CPH_TEAM_METRIC_DEFINITIONS,
  aggregatedMetrics: CPH_AGGREGATED_METRIC_DEFINITIONS
};