
export interface MetricValues {
  required: number | null;
  actual: number | null;
}

export interface CapacityDataRow {
  id: string;
  name: string; // e.g., "INVENTORY MANAGEMENT", "Inhouse BPO"
  level: number; // Indentation level
  // Data for this specific entry. Each key is a week string like "06/04-06/10"
  weeklyData: Record<string, MetricValues>; 
  // children are used for accordion structure
  children?: CapacityDataRow[]; 
}

export interface FilterOptions {
  businessUnits: string[];
  linesOfBusiness: string[];
  groupByOptions: string[];
}

export const WEEKS_HEADERS = [
  "06/04 - 06/10",
  "06/11 - 06/17",
  "06/18 - 06/24",
  "06/25 - 07/01",
];

export type TimeInterval = "Week" | "Month";
