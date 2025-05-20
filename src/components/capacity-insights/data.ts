
import type { FilterOptions, RawLoBCapacityEntry, BusinessUnitName, MetricValues } from "./types";
import { ALL_BUSINESS_UNITS, BUSINESS_UNIT_CONFIG, ALL_WEEKS_HEADERS, ALL_MONTH_HEADERS } from "./types";

// Helper to generate random metric values for a given set of periods
const generatePeriodicMetrics = (periods: string[]): Record<string, MetricValues> => {
  const metrics: Record<string, MetricValues> = {};
  periods.forEach(period => {
    const required = Math.floor(Math.random() * 20000) + 5000; // Agent-minutes
    const actual = Math.floor(required * (Math.random() * 0.4 + 0.8)); // Actual is 80% to 120% of required
    if (Math.random() < 0.1) { // 10% chance of no data for a period
        metrics[period] = { required: null, actual: null };
    } else {
        metrics[period] = { required, actual };
    }
  });
  return metrics;
};

// We'll generate data for a subset of weeks and months for mock purposes
const mockWeekPeriods = ALL_WEEKS_HEADERS.slice(0, 20); // Use first 20 weeks for mock data
const mockMonthPeriods = ALL_MONTH_HEADERS.slice(0, 6); // Use first 6 months

export const mockRawCapacityData: RawLoBCapacityEntry[] = [];

ALL_BUSINESS_UNITS.forEach(bu => {
  BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness.forEach(lob => {
    mockRawCapacityData.push({
      id: `${bu.toLowerCase().replace(/\s+/g, '-')}_${lob.toLowerCase().replace(/\s+/g, '-')}`,
      bu: bu,
      lob: lob,
      periodicMetrics: generatePeriodicMetrics(mockWeekPeriods), // Generate weekly data
      // Note: In a real app, you'd have separate data sources or transformations for monthly data
      // For this mock, monthly data will be derived or use a separate set if needed.
      // For now, page.tsx will aggregate weekly data if "Month" interval is selected.
    });
  });
});


export const mockFilterOptions: FilterOptions = {
  businessUnits: [...ALL_BUSINESS_UNITS, "All" as any], // "All" is a special case
  linesOfBusiness: [], // Will be populated dynamically based on selected BU
  groupByOptions: ["Business Unit", "Line of Business"],
};
