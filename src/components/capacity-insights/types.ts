
import type { DateRange } from "react-day-picker";

export interface MetricValues { // Represents base values for agent-minutes
  required: number | null;
  actual: number | null;
}

export interface CalculatedMetricValues extends MetricValues { // For LOB/BU agent-minute summary rows
  overUnder: number | null;
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
  businessUnits: BusinessUnitName[];
  linesOfBusiness: string[]; 
  teams: TeamName[];
}


export const ALL_WEEKS_HEADERS = Array.from({ length: 104 }, (_, i) => { 
  const baseDate = new Date(2024, 0, 1); 
  
  // Find the Monday of the first week of 2024
  const firstDayOfYear = new Date(baseDate.getFullYear(), 0, 1);
  const dayOfWeek = firstDayOfYear.getDay(); // 0 for Sunday, 1 for Monday, ...
  const diffToMondayOfFirstWeek = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayOfFirstWeek = new Date(firstDayOfYear);
  mondayOfFirstWeek.setDate(firstDayOfYear.getDate() + diffToMondayOfFirstWeek);

  // Calculate the start date for week i+1
  const startDate = new Date(mondayOfFirstWeek);
  startDate.setDate(mondayOfFirstWeek.getDate() + i * 7);
  
  const endDate = new Date(new Date(startDate).setDate(startDate.getDate() + 6));
  const formatDatePart = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  return `Wk${i + 1}: ${formatDatePart(startDate)}-${formatDatePart(endDate)} (${startDate.getFullYear()})`;
});


export const ALL_MONTH_HEADERS = Array.from({ length: 24 }, (_, i) => { // Extended to 24 months (2 years)
  const year = 2024 + Math.floor(i / 12);
  const month = i % 12;
  const date = new Date(year, month, 1); 
  return date.toLocaleString('default', { month: 'long', year: 'numeric' }); 
});

export const NUM_PERIODS_DISPLAYED = 60; 
export type TimeInterval = "Week" | "Month";


export type TeamName = "Inhouse" | "BPO1" | "BPO2";
export const ALL_TEAM_NAMES: TeamName[] = ["Inhouse", "BPO1", "BPO2"];

export interface BaseHCValues { 
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null; 
}

// BaseAgentMinuteValues is not directly used for display anymore, but concepts might be relevant for calculations
// export interface BaseAgentMinuteValues { 
//   required: number | null; 
//   actual: number | null;   
//   overUnder: number | null; 
// }

export interface TeamPeriodicMetrics extends BaseHCValues {
  aht: number | null; 
  shrinkagePercentage: number | null; 
  occupancyPercentage: number | null; 
  backlogPercentage: number | null; 
  attritionPercentage: number | null; 
  volumeMixPercentage: number | null; 
  
  actualHC: number | null; 
  moveIn: number | null; 
  moveOut: number | null; 
  newHireBatch: number | null; 
  newHireProduction: number | null; 

  _productivity: number | null; // Input: e.g. contacts/agent-hour.
  
  // Calculated fields, not directly input by user in these assumption rows
  _calculatedRequiredAgentMinutes?: number | null; // Calculated based on LOB total and Volume Mix
  _calculatedActualAgentMinutes?: number | null; // Could be derived from Actual HC & productivity factors
}

export interface AggregatedPeriodicMetrics extends BaseHCValues {
  // required: number | null; // Removed
  // actual: number | null; // Removed
  // overUnder: number | null; // Removed
}

export interface RawTeamDataEntry {
  teamName: TeamName;
  // Stores direct inputs for each period
  periodicInputData: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>>;
}

export interface RawLoBCapacityEntry {
  id: string; 
  bu: BusinessUnitName;
  lob: string;
  // Represents the total forecasted demand for the LOB in agent-minutes for each period
  lobTotalBaseRequiredMinutes: Record<string, number | null>; 
  teams: RawTeamDataEntry[];
}

export interface CapacityDataRow {
  id: string; 
  name: string; 
  level: number; 
  itemType: 'BU' | 'LOB' | 'Team'; 
  periodicData: Record<string, AggregatedPeriodicMetrics | TeamPeriodicMetrics>; 
  children?: CapacityDataRow[];
  lobId?: string; // Used to link team back to LOB for editing
}

export interface MetricDefinition {
    key: keyof TeamPeriodicMetrics | keyof AggregatedPeriodicMetrics;
    label: string;
    isPercentage?: boolean;
    isHC?: boolean;
    isTime?: boolean; 
    isEditableForTeam?: boolean; 
    step?: string | number; 
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];

// Defines which metrics appear under each Team row and if they are editable
export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1 },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1 }, 
  { key: "requiredHC", label: "Required HC", isHC: true }, 
  { key: "actualHC", label: "Actual HC", isHC: true, isEditableForTeam: true, step: 0.01 }, // step allows decimals
  { key: "overUnderHC", label: "Over/Under HC", isHC: true }, 
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true },
];

// Defines which metrics appear under each BU and LOB summary row
export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  // { key: "required", label: "Required (Agent Mins)" }, // Removed
  // { key: "actual", label: "Actual (Agent Mins)" }, // Removed
  // { key: "overUnder", label: "Over/Under (Agent Mins)" }, // Removed
  { key: "requiredHC", label: "Required HC", isHC: true }, 
  { key: "actualHC", label: "Actual HC", isHC: true },    
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
];


export interface HeaderSectionProps {
  filterOptions: FilterOptions;
  selectedBusinessUnit: BusinessUnitName;
  onSelectBusinessUnit: (value: BusinessUnitName) => void;
  selectedLineOfBusiness: string[]; 
  onSelectLineOfBusiness: (value: string[]) => void;
  selectedTeams: TeamName[];
  onSelectTeams: (value: TeamName[]) => void;
  selectedTimeInterval: TimeInterval;
  onSelectTimeInterval: (value: TimeInterval) => void;
  
  selectedDateRange: DateRange | undefined;
  onSelectDateRange: (value: DateRange | undefined) => void;
}
