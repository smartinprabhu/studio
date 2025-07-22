export type TimeInterval = "Week" | "Month";
export type TeamName = "Inhouse" | "BPO1" | "BPO2";

export interface BaseHCValues {
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null;
}
export interface TeamPeriodicMetrics extends BaseHCValues {
  aht?: number | null;
  cph?: number | null;
  requiredFTE?: number | null;
  inOfficeShrinkagePercentage: number | null;
  outOfOfficeShrinkagePercentage: number | null;
  occupancyPercentage: number | null;
  backlogPercentage: number | null;
  attritionPercentage: number | null;
  volumeMixPercentage: number | null;
  actualHC: number | null;
  moveIn: number | null;
  moveOut: number | null;
  newHireBatch: number | null;
  newHireProduction: number | null;
  handlingCapacity: number | null;
  _productivity: number | null;
  _calculatedRequiredAgentMinutes?: number | null;
  _calculatedActualProductiveAgentMinutes?: number | null;
  attritionLossHC?: number | null;
  hcAfterAttrition?: number | null;
  endingHC?: number | null;
  _lobTotalBaseReqMinutesForCalc?: number | null;
}


export interface AggregatedPeriodicMetrics extends BaseHCValues {
  lobVolumeForecast?: number | null;
  lobAverageAHT?: number | null;
  lobAverageCPH?: number | null;
  lobTotalBaseRequiredMinutes?: number | null;
  lobCalculatedAverageAHT?: number | null;
  handlingCapacity?: number | null;
  billableHoursRequire?: number | null;
}

export interface MetricDefinition {
  key: keyof TeamPeriodicMetrics | keyof AggregatedPeriodicMetrics;
  label: string;
  isPercentage?: boolean;
  isHC?: boolean;
  isTime?: boolean;
  isEditableForTeam?: boolean;
  isDisplayOnly?: boolean;
  step?: string | number;
  category?: 'PrimaryHC' | 'Assumption' | 'HCAdjustment' | 'Internal';
  description?: string;
  isEditableForLob?: boolean; // Added for LOB specific editable metrics
  isCount?: boolean; // Added for LOB specific count metrics
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];

export interface CapacityDataRow {
  id: string;
  name: string;
  level: number;
  itemType: 'BU' | 'LOB' | 'Team';
  periodicData: Record<string, AggregatedPeriodicMetrics | TeamPeriodicMetrics>;
  children?: CapacityDataRow[];
  lobId?: string;
}

export const BUSINESS_UNIT_CONFIG_V2 = {
  "POS": {
    name: "POS",
    lonsOfBusiness: [
      "Phone", "Chat", "Case Type 1", "Case Type 2", "Case Type 3",
      "Case Type 4", "Case Type 5", "Case Type 6"
    ]
  },
  "MOS": {
    name: "MOS",
    lonsOfBusiness: [
      "Case", "Chat", "Phone", "Feud Case", "International English Case",
      "International Spanish Case", "International English Chat", "International Spanish Chat"
    ]
  }
} as const;

export type BusinessUnitNameV2 = keyof typeof BUSINESS_UNIT_CONFIG_V2;
export const ALL_BUSINESS_UNITS_V2 = Object.keys(BUSINESS_UNIT_CONFIG_V2) as BusinessUnitNameV2[];
