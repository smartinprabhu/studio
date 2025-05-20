
export interface MetricValues { // Represents base values for agent-minutes
  required: number | null;
  actual: number | null;
}

export interface CalculatedMetricValues extends MetricValues { // For LOB/BU agent-minute summary rows
  overUnder: number | null;
  // adherence: number | null; // Removed Adherence
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
  const weekStartDate = new Date(baseDate.getTime());
  weekStartDate.setDate(baseDate.getDate() + i * 7);
  
  const dayOfWeek = weekStartDate.getDay(); 
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startDate = new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + diffToMonday));
  
  const endDate = new Date(new Date(startDate).setDate(startDate.getDate() + 6));
  const formatDatePart = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  return `Wk${i + 1}: ${formatDatePart(startDate)}-${formatDatePart(endDate)} (${startDate.getFullYear()})`;
});


export const ALL_MONTH_HEADERS = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(2024, i, 1); 
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

export interface BaseAgentMinuteValues { 
  required: number | null; 
  actual: number | null;   
  overUnder: number | null; 
  // adherence: number | null; // Removed Adherence
}

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

  _productivity: number | null; 
  
  _calculatedRequiredAgentMinutes?: number | null; 
  _calculatedActualAgentMinutes?: number | null; 
}

export interface AggregatedPeriodicMetrics extends BaseAgentMinuteValues, BaseHCValues {}

export interface RawTeamDataEntry {
  teamName: TeamName;
  periodicInputData: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>>;
}

export interface RawLoBCapacityEntry {
  id: string; 
  bu: BusinessUnitName;
  lob: string;
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
  lobId?: string; 
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


export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1 },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1 }, 
  { key: "requiredHC", label: "Required HC", isHC: true }, 
  { key: "actualHC", label: "Actual HC", isHC: true, isEditableForTeam: true, step: 0.1 },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true }, 
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true },
];

export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  // { key: "adherence", label: "Adherence (%)", isPercentage: true }, // Removed Adherence
  { key: "requiredHC", label: "Required HC", isHC: true }, 
  { key: "actualHC", label: "Actual HC", isHC: true },    
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
];
