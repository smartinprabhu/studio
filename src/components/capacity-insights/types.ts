
export interface MetricValues {
  required: number | null;
  actual: number | null;
}

export interface CalculatedMetricValues extends MetricValues {
  overUnder: number | null;
  adherence: number | null;
}

export interface CapacityDataRow {
  id: string;
  name: string; // e.g., "WFS", "US Chat"
  level: number; // Indentation level
  // Data for this specific entry. Keys are period headers (e.g., "Wk23: 06/04-06/10")
  // Includes a special key for the sum (e.g., DYNAMIC_SUM_COLUMN_KEY)
  periodicData: Record<string, CalculatedMetricValues>;
  children?: CapacityDataRow[];
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
    lonsOfBusiness: ["SFF LoB A", "SFF LoB B", "SFF LoB C"] // Placeholder
  },
  "RSO": {
    name: "RSO",
    lonsOfBusiness: ["RSO LoB X", "RSO LoB Y"] // Placeholder
  },
  "Go Local": {
    name: "Go Local",
    lonsOfBusiness: ["GoLocal Partner Support", "GoLocal Customer Care"] // Placeholder
  }
} as const;

export type BusinessUnitName = keyof typeof BUSINESS_UNIT_CONFIG;
export type LineOfBusinessName<BU extends BusinessUnitName> = typeof BUSINESS_UNIT_CONFIG[BU]["lonsOfBusiness"][number];

export const ALL_BUSINESS_UNITS = Object.keys(BUSINESS_UNIT_CONFIG) as BusinessUnitName[];

export interface FilterOptions {
  businessUnits: BusinessUnitName[];
  linesOfBusiness: string[]; // Will be populated dynamically
  groupByOptions: GroupByOption[];
}

export type GroupByOption = "Business Unit" | "Line of Business";

// Example: 1 year of weekly headers. In a real app, this might be generated.
export const ALL_WEEKS_HEADERS = Array.from({ length: 52 }, (_, i) => {
  const startDate = new Date(2024, 0, 1 + i * 7); // Start from Jan 1, 2024 for example
  const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  return `Wk${i + 1}: ${formatDate(startDate)}-${formatDate(endDate)}`;
});

// Example: 1 year of monthly headers
export const ALL_MONTH_HEADERS = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(2024, i, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

export const NUM_PERIODS_DISPLAYED = 4; // Number of weeks or months to display at a time
export const DYNAMIC_SUM_COLUMN_KEY = "summary"; // Key for the sum column data

export type TimeInterval = "Week" | "Month";

// Raw data structure for mock data
export interface RawLoBCapacityEntry {
  id: string; // Unique ID for the LOB entry, e.g., "wfs_us_chat"
  bu: BusinessUnitName;
  lob: string; // LineOfBusinessName - keep as string for flexibility with dynamic LOBs
  // Each key is a period string (e.g., ALL_WEEKS_HEADERS[0])
  // For simplicity, mock data will provide values for a subset of ALL_WEEKS_HEADERS/ALL_MONTH_HEADERS
  periodicMetrics: Record<string, MetricValues>;
}
