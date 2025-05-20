
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

export const ALL_WEEKS_HEADERS = Array.from({ length: 52 }, (_, i) => {
  const startDate = new Date(2024, 0, 1 + i * 7);
  const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  return `Wk${i + 1}: ${formatDate(startDate)}-${formatDate(endDate)}`;
});

export const ALL_MONTH_HEADERS = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(2024, i, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' }); // e.g. "January 2024"
});

export const NUM_PERIODS_DISPLAYED = 4;
export const DYNAMIC_SUM_COLUMN_KEY = "summary";
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
export interface TeamPeriodicMetrics extends BaseHCValues {
  aht: number | null; // minutes
  shrinkagePercentage: number | null; // 0-100
  occupancyPercentage: number | null; // 0-100
  backlogPercentage: number | null; // 0-100
  attritionPercentage: number | null; // 0-100
  volumeMixPercentage: number | null; // 0-100, team's share of LOB volume/required minutes
  
  moveIn: number | null;
  moveOut: number | null;
  newHireBatch: number | null;
  newHireProduction: number | null;

  // For internal calculation and roll-up. These might be calculated in page.tsx.
  // `_productivity` would be an input for team to calculate its `requiredHC` if not directly provided.
  // `_teamRequiredAgentMinutes` derived from LOB total * volumeMix.
  // `_teamActualAgentMinutes` derived from team's actualHC, schedule, productivity.
  _productivity: number | null; // e.g. contacts per agent-hour or similar work rate metric
  _calculatedRequiredAgentMinutes?: number | null;
  _calculatedActualAgentMinutes?: number | null;
}

// Aggregated metrics for LOB/BU per period (combines agent minutes and HC summaries)
export interface AggregatedPeriodicMetrics extends BaseAgentMinuteValues, BaseHCValues {}

// Raw entry for a team's input data for all periods
export interface RawTeamDataEntry {
  teamName: TeamName;
  // Key is period header (e.g., "Wk1: 01/01-01/07")
  // These are mostly input metrics; HC related metrics will be calculated/aggregated in processing.
  // `requiredHC` and `overUnderHC` are typically calculated, so not direct inputs here.
  periodicInputData: Record<string, Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>;
}

// Raw entry for an LOB, containing its teams and LOB-level base demand forecast
export interface RawLoBCapacityEntry {
  id: string; // Unique ID for the LOB entry, e.g., "wfs_us_chat"
  bu: BusinessUnitName;
  lob: string;
  // LOB-level *total base required agent minutes* for each period.
  // This is the basis for distributing "required agent minutes" to teams based on their volumeMixPercentage.
  lobTotalBaseRequiredMinutes: Record<string, number | null>; // e.g. { "Wk1": 500000 }
  teams: RawTeamDataEntry[];
}

// Defines the structure for rows in the display table
export interface CapacityDataRow {
  id: string;
  name: string; // BU name, LOB name, or Team name
  level: number; // Indentation level
  itemType: 'BU' | 'LOB' | 'Team'; // To help in rendering and data access
  // For BU/LOB: AggregatedPeriodicMetrics (agent-minutes and HC summaries)
  // For Team: TeamPeriodicMetrics (detailed metrics for that team)
  periodicData: Record<string, AggregatedPeriodicMetrics | TeamPeriodicMetrics>; // Key is period header or DYNAMIC_SUM_COLUMN_KEY
  children?: CapacityDataRow[];
}

// Definitions for rendering metric rows
export const TEAM_METRIC_ROW_DEFINITIONS: Array<{ key: keyof TeamPeriodicMetrics; label: string; isPercentage?: boolean; isHC?: boolean; isTime?: boolean /* for AHT in minutes */ }> = [
  { key: "aht", label: "AHT", isTime: true },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true },
  { key: "volumeMixPercentage", label: "Volume Mix", isPercentage: true },
  { key: "requiredHC", label: "Require HC", isHC: true },
  { key: "actualHC", label: "Actual HC", isHC: true },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
  { key: "moveIn", label: "Move In (+)" },
  { key: "moveOut", label: "Move Out (-)" },
  { key: "newHireBatch", label: "New Hire Batch" },
  { key: "newHireProduction", label: "New Hire Production" },
];

// For LOB/BU summary rows
export const AGGREGATED_METRIC_ROW_DEFINITIONS: Array<{ key: keyof AggregatedPeriodicMetrics; label: string; isPercentage?: boolean; isHC?: boolean }> = [
  { key: "required", label: "Required" }, // agent-minutes
  { key: "actual", label: "Actual" },     // agent-minutes
  { key: "overUnder", label: "Over/Under" }, // agent-minutes
  { key: "adherence", label: "Adherence (%)", isPercentage: true },
  { key: "requiredHC", label: "Required HC", isHC: true }, // Aggregated HC
  { key: "actualHC", label: "Actual HC", isHC: true },     // Aggregated HC
  { key: "overUnderHC", label: "Over/Under HC", isHC: true }, // Aggregated HC
];
