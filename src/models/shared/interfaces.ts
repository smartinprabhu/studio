import type { DateRange } from "react-day-picker";

export type TimeInterval = "Week" | "Month";
export type TeamName = "Inhouse" | "BPO1" | "BPO2";

export type ModelId = 'volume-backlog' | 'cph' | 'fix-fte' | 'fix-hc' | 'billable-hours';

export interface ModelSpecificMetrics {
  // CPH Model
  cph?: number | null;

  // Fix Models
  requiredFTE?: number | null;

  // Billable Hours Model
  billableHoursRequire?: number | null;
}

export interface BaseHCValues {
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null;
}

export interface TeamPeriodicMetrics extends BaseHCValues, ModelSpecificMetrics {
  // Inputs / Assumptions (Editable for Teams)
  aht: number | null;
  inOfficeShrinkagePercentage: number | null;
  outOfOfficeShrinkagePercentage: number | null;
  occupancyPercentage: number | null;
  backlogPercentage: number | null;
  attritionPercentage: number | null;
  volumeMixPercentage: number | null;
  actualHC: number | null; // This is the Start HC / Planned HC for the period

  // HC Adjustments (Inputs for Teams)
  moveIn: number | null;
  moveOut: number | null;
  newHireBatch: number | null;
  newHireProduction: number | null;

  // Calculated HC Flow (Display Only for Teams)
  attritionLossHC: number | null;
  hcAfterAttrition: number | null;
  endingHC: number | null;

  // Calculated Agent Minutes / Workload (Display Only for Teams)
  _calculatedRequiredAgentMinutes: number | null;
  _calculatedActualProductiveAgentMinutes: number | null;
}

export interface AggregatedPeriodicMetrics extends BaseHCValues {
  // LOB-specific Inputs / Calculated (Editable for LOBs)
  lobVolumeForecast?: number | null;
  lobAverageAHT?: number | null;
  lobTotalBaseRequiredMinutes?: number | null;
}

export interface RawTeamDataEntry {
  teamName: TeamName;
  periodicInputData: Record<string, Partial<Omit<TeamPeriodicMetrics,
    'requiredHC' |
    'overUnderHC' |
    '_calculatedRequiredAgentMinutes' |
    '_calculatedActualProductiveAgentMinutes' |
    'attritionLossHC' |
    'hcAfterAttrition' |
    'endingHC'
  >>>;
}

export interface RawLoBCapacityEntry {
  id: string;
  bu: string;
  lob: string;
  lobVolumeForecast: Record<string, number | null>;
  lobAverageAHT: Record<string, number | null>;
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
    isCount?: boolean;
    isEditableForTeam?: boolean;
    isEditableForLob?: boolean;
    isDisplayOnly?: boolean;
    step?: string | number;
    category?: 'PrimaryHC' | 'Assumption' | 'HCAdjustment' | 'Internal';
    description?: string;
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];

export interface FilterOptions {
  businessUnits: string[];
  linesOfBusiness: string[];
}

export interface HeaderSectionProps {
  allBusinessUnits: string[];
  actualLobsForCurrentBu: string[];
  selectedBusinessUnit: string;
  onSelectBusinessUnit: (value: string) => void;
  selectedLineOfBusiness: string[];
  onSelectLineOfBusiness: (value: string[]) => void;
  selectedTimeInterval: TimeInterval;
  onSelectTimeInterval: (value: TimeInterval) => void;

  selectedDateRange: DateRange | undefined;
  onSelectDateRange: (value: DateRange | undefined) => void;
  allAvailablePeriods: string[];

  displayedPeriodHeaders: string[];
  activeHierarchyContext: string;
  headerPeriodScrollerRef: React.RefObject<HTMLDivElement>;
}
