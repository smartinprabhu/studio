import type { MetricDefinition } from "@/components/capacity-insights/types";
import type { ModelMetricDefinitions } from "../shared/interfaces";

export const VOLUME_BACKLOG_TEAM_METRIC_DEFINITIONS: MetricDefinition[] = [
  // Primary HC Section
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated number of headcount required based on demand and productivity assumptions." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "The actual or starting headcount for the period before adjustments." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference between Actual/Starting HC and Required HC.\nFormula: Actual HC - Required HC" },

  // Assumptions Section
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Average Handle Time: The average time taken to handle one interaction." },
  { key: "inOfficeShrinkagePercentage", label: "In Office Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "In Office Shrinkage: Percentage of paid time that agents are not available for handling interactions while in office." },
  { key: "outOfOfficeShrinkagePercentage", label: "Out of Office Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Out of Office Shrinkage: Percentage of paid time that agents are not available for handling interactions while out of office." },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Occupancy: Percentage of time agents are busy with interaction-related work during their available time." },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Backlog: Percentage of additional work (e.g., deferred tasks) that needs to be handled on top of forecasted volume." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },

  // HC Adjustments Section
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Headcount moving into this team from other teams or roles." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Headcount moving out of this team to other teams or roles." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Number of new hires starting in a batch during this period (typically in training)." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Number of new hires becoming productive and joining the floor during this period." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost due to attrition.\nFormula: Actual HC * Attrition %" },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount remaining after attrition loss.\nFormula: Actual HC - Attrition Loss HC" },
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period after all adjustments.\nFormula: HC After Attrition + New Hire Prod. + Move In - Move Out" },
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'HCAdjustment', description: "Team's share of LOB demand minutes, adjusted for the team's backlog percentage.\nFormula: (Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)" },
  { key: "_calculatedActualProductiveAgentMinutes", label: "Actual Prod. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal', description: "Total productive agent minutes available from the team's actual headcount, considering shrinkage and occupancy.\nFormula: Actual HC * Std Mins * (1 - In Office Shrink%) * (1 - Out of Office Shrink%) * Occupancy%" },
];

export const VOLUME_BACKLOG_AGGREGATED_METRIC_DEFINITIONS: MetricDefinition[] = [
  // LOB Volume & Demand Inputs
  { key: "lobVolumeForecast", label: "Volume Forecast", isEditableForLob: true, step: 1, isCount: true, description: "Total number of interactions forecasted for this LOB." },
  { key: "lobAverageAHT", label: "Average AHT", isEditableForLob: true, step: 0.1, isTime: true, description: "Average handle time assumed for LOB interactions." },
  { key: "lobTotalBaseRequiredMinutes", label: "Total Base Req Mins", isEditableForLob: true, isTime: true, step: 1, description: "Total agent minutes required for LOB volume, calculated as Volume * AHT or input directly." },
  { key: "lobCalculatedAverageAHT", label: "Calculated Average AHT", isEditableForLob: false, step: 0.1, isTime: true, description: "Calculated average AHT from team inputs, weighted by volume." },
  { key: "handlingCapacity", label: "Handling Capacity", isEditableForLob: false, isCount: true, description: "Handling Capacity: The capacity to handle interactions, calculated as Volume Forecast divided by Average AHT.\nFormula: Volume Forecast / Average AHT" },

  // Aggregated HC Metrics
  { key: "requiredHC", label: "Required HC", isHC: true, description: "Aggregated required headcount from child entities." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, description: "Aggregated actual/starting headcount from child entities." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, description: "Difference between aggregated Actual/Starting HC and Required HC." },
];

export const VOLUME_BACKLOG_MODEL_DEFINITIONS: ModelMetricDefinitions = {
  teamMetrics: VOLUME_BACKLOG_TEAM_METRIC_DEFINITIONS,
  aggregatedMetrics: VOLUME_BACKLOG_AGGREGATED_METRIC_DEFINITIONS
};
