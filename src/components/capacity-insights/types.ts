
export interface MetricValues { // Represents base values for agent-minutes
  required: number | null;
  actual: number | null;
}

export interface CalculatedMetricValues extends MetricValues { // For LOB/BU agent-minute summary rows
  overUnder: number | null;
  adherence: number | null;
}

export const BUSINESS_UNIT_CONFIG = {
  "WFS": {
    name: "WFS",
    lonsOfBusiness: [
      "US Chat", "US Phone", "Core Support", "Customer Returns", "Inventory Management",
      "Dispute Management", "IBE Management", "FC Liaison", "Flex Team", "Help Desk", "MCS",
      "China Mandarin Chat", "China Mandarin Email", "China English Chat", "China English Email",
      "Strike Through", "Walmart Import"
    ]
  },
  "SFF": {
    name: "SFF",
    lonsOfBusiness: ["SFF LoB Alpha", "SFF LoB Bravo", "SFF LoB Charlie"]
  },
  "RSO": {
    name: "RSO",
    lonsOfBusiness: ["RSO LoB Xray", "RSO LoB Yankee"]
  },
  "Go Local": {
    name: "Go Local",
    lonsOfBusiness: ["GoLocal Partner Support", "GoLocal Customer Care"]
  }
} as const;

export type BusinessUnitName = keyof typeof BUSINESS_UNIT_CONFIG;
export type LineOfBusinessName<BU extends BusinessUnitName = BusinessUnitName> = typeof BUSINESS_UNIT_CONFIG[BU]["lonsOfBusiness"][number];

export const ALL_BUSINESS_UNITS = Object.keys(BUSINESS_UNIT_CONFIG) as BusinessUnitName[];

export interface FilterOptions {
  businessUnits: (BusinessUnitName | "All")[];
  linesOfBusiness: string[]; // Can be LOB name or "All"
  groupByOptions: GroupByOption[];
}

export type GroupByOption = "Business Unit" | "Line of Business";

export const ALL_WEEKS_HEADERS = Array.from({ length: 104 }, (_, i) => { // Extended to 104 weeks
  const baseDate = new Date(2024, 0, 1); // Start from Jan 1, 2024
  const startDate = new Date(baseDate.setDate(baseDate.getDate() + i * 7 - (baseDate.getDay() === 0 ? 6 : baseDate.getDay() -1 ) )); // Adjust to start of week (Monday)
  const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  return `Wk${i + 1}: ${formatDate(startDate)}-${formatDate(endDate)} (${startDate.getFullYear()})`;
});


export const ALL_MONTH_HEADERS = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(2024, i, 1); // Ensure year is fixed
  return date.toLocaleString('default', { month: 'long', year: 'numeric' }); // e.g. "January 2024"
});

export const NUM_PERIODS_DISPLAYED = 8;
export type TimeInterval = "Week" | "Month";


// New Types for Team Hierarchy and Detailed Metrics

export type TeamName = "Inhouse" | "BPO1" | "BPO2";
export const ALL_TEAM_NAMES: TeamName[] = ["Inhouse", "BPO1", "BPO2"];

export interface BaseHCValues { // Headcount values
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null; // Calculated: actualHC - requiredHC
}

export interface BaseAgentMinuteValues { // Agent minute values
  required: number | null; // Agent-minutes
  actual: number | null;   // Agent-minutes
  overUnder: number | null; // Calculated: actual - required (agent-minutes)
  adherence: number | null; // Calculated: (actual / required) * 100
}

// Metrics for a Team per period
// Note: Most fields are inputs from mock data or will be editable. Calculated fields are marked.
export interface TeamPeriodicMetrics extends BaseHCValues {
  aht: number | null; // minutes - INPUT / EDITABLE
  shrinkagePercentage: number | null; // 0-100 - INPUT / EDITABLE
  occupancyPercentage: number | null; // 0-100 - INPUT / EDITABLE
  backlogPercentage: number | null; // 0-100 - INPUT / EDITABLE
  attritionPercentage: number | null; // 0-100 - INPUT / EDITABLE
  volumeMixPercentage: number | null; // 0-100, team's share of LOB volume/required minutes - INPUT / EDITABLE (with special handling)
  
  actualHC: number | null; // INPUT / EDITABLE
  moveIn: number | null; // INPUT / EDITABLE
  moveOut: number | null; // INPUT / EDITABLE
  newHireBatch: number | null; // INPUT / EDITABLE
  newHireProduction: number | null; // INPUT / EDITABLE

  _productivity: number | null; // e.g. contacts per agent-hour or similar work rate metric - INPUT (maybe editable later)
  
  // Calculated fields:
  _calculatedRequiredAgentMinutes?: number | null; // CALCULATED
  _calculatedActualAgentMinutes?: number | null; // CALCULATED
  // requiredHC, overUnderHC are in BaseHCValues, also calculated for teams
}

// Aggregated metrics for LOB/BU per period (combines agent minutes and HC summaries)
export interface AggregatedPeriodicMetrics extends BaseAgentMinuteValues, BaseHCValues {}

// Raw entry for a team's input data for all periods
export interface RawTeamDataEntry {
  teamName: TeamName;
  // Key is period header (e.g., "Wk1: 01/01-01/07 (2024)")
  // These are input metrics. HC related metrics will be calculated/aggregated in processing.
  periodicInputData: Record<string, Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>;
}

// Raw entry for an LOB, containing its teams and LOB-level base demand forecast
export interface RawLoBCapacityEntry {
  id: string; // Unique ID for the LOB entry, e.g., "wfs_us_chat"
  bu: BusinessUnitName;
  lob: string;
  lobTotalBaseRequiredMinutes: Record<string, number | null>; // e.g. { "Wk1: 01/01-01/07 (2024)": 500000 }
  teams: RawTeamDataEntry[];
}

// Defines the structure for rows in the display table
export interface CapacityDataRow {
  id: string; // For BU: buName, For LOB: lobId (e.g. wfs_us_chat), For Team: lobId_teamName
  name: string; // BU name, LOB name, or Team name
  level: number; // Indentation level
  itemType: 'BU' | 'LOB' | 'Team'; // To help in rendering and data access
  periodicData: Record<string, AggregatedPeriodicMetrics | TeamPeriodicMetrics>; // Key is period header
  children?: CapacityDataRow[];
  lobId?: string; // Only for itemType 'Team', to help identify its parent LOB
}

export interface MetricDefinition {
    key: keyof TeamPeriodicMetrics | keyof AggregatedPeriodicMetrics;
    label: string;
    isPercentage?: boolean;
    isHC?: boolean;
    isTime?: boolean; /* for AHT in minutes */
    isEditableForTeam?: boolean; 
    step?: string | number; // For number inputs, allow "any" for decimals
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];


// Definitions for rendering metric rows
export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1 },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1 }, // Special handling needed
  { key: "requiredHC", label: "Required HC", isHC: true }, // Calculated
  { key: "actualHC", label: "Actual HC", isHC: true, isEditableForTeam: true, step: 0.1 },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true }, // Calculated
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1 },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1 },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1 },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1 },
  // { key: "_productivity", label: "Productivity", isEditableForTeam: true }, // Example if productivity becomes directly editable
];

// For LOB/BU summary rows
export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: "adherence", label: "Adherence (%)", isPercentage: true },
  { key: "requiredHC", label: "Required HC", isHC: true }, 
  { key: "actualHC", label: "Actual HC", isHC: true },    
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
];
