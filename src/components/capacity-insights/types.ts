import type { DateRange } from "react-day-picker";
import {
  startOfWeek as dateFnsStartOfWeek, // Aliasing to avoid conflict if startOfWeek is defined locally
  endOfWeek as dateFnsEndOfWeek,
  isAfter,
  addDays,
  isBefore,
  startOfMonth as dateFnsStartOfMonth,
  endOfMonth as dateFnsEndOfMonth,
} from 'date-fns';


// --- BEGIN CONSOLIDATED TYPES from original page.tsx ---

export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

export const formatDatePartUTCFromDate = (date: Date): string =>
  `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCDate().toString().padStart(2, '0')}`;


export const generateFiscalWeekHeaders = (startFiscalYear: number, numTotalWeeks: number): string[] => {
  const headers: string[] = [];
  let currentFiscalWeekNumber = 1;

  for (let yearOffset = 0; currentFiscalWeekNumber <= numTotalWeeks; yearOffset++) {
    const currentCalendarYear = startFiscalYear + yearOffset;
    const isCurrentYearLeap = isLeapYear(currentCalendarYear);

    let fiscalYearActualStartDate: Date;
    if (isCurrentYearLeap) {
      const feb1st = new Date(Date.UTC(currentCalendarYear, 1, 1)); // February is month 1
      let dayOfWeek = feb1st.getUTCDay(); // 0 (Sun) - 6 (Sat)
      dayOfWeek = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Adjust so Monday is 0, Sunday is 6
      fiscalYearActualStartDate = new Date(Date.UTC(currentCalendarYear, 1, 1 - dayOfWeek));
    } else {
      const jan22nd = new Date(Date.UTC(currentCalendarYear, 0, 22)); // January is month 0
      let dayOfWeek = jan22nd.getUTCDay();
      dayOfWeek = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
      fiscalYearActualStartDate = new Date(Date.UTC(currentCalendarYear, 0, 22 - dayOfWeek));
    }

    const weeksInThisFiscalYear = isCurrentYearLeap ? 53 : 52;
    for (let i = 0; i < weeksInThisFiscalYear && currentFiscalWeekNumber <= numTotalWeeks; i++) {
      const weekStartDate = new Date(fiscalYearActualStartDate);
      weekStartDate.setUTCDate(fiscalYearActualStartDate.getUTCDate() + i * 7);

      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

      const displayYearForHeader = weekStartDate.getUTCFullYear();

      headers.push(
        `FWk${currentFiscalWeekNumber}: ${formatDatePartUTCFromDate(weekStartDate)}-${formatDatePartUTCFromDate(weekEndDate)} (${displayYearForHeader})`
      );
      currentFiscalWeekNumber++;
    }
  }
  return headers;
};


export const ALL_WEEKS_HEADERS = generateFiscalWeekHeaders(2024, 104); // Approx 2 years
export const ALL_MONTH_HEADERS = Array.from({ length: 24 }, (_, i) => {
  const year = 2024 + Math.floor(i / 12);
  const month = i % 12;
  const date = new Date(Date.UTC(year, month, 1)); // Use UTC for month headers too
  return `${date.toLocaleString('default', { month: 'long', timeZone: 'UTC' })} ${date.getUTCFullYear()}`;
});


export const BUSINESS_UNIT_CONFIG = {
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

export type BusinessUnitName = keyof typeof BUSINESS_UNIT_CONFIG;
export type LineOfBusinessName<BU extends BusinessUnitName = BusinessUnitName> = typeof BUSINESS_UNIT_CONFIG[BU]["lonsOfBusiness"][number];

export const ALL_BUSINESS_UNITS = Object.keys(BUSINESS_UNIT_CONFIG) as BusinessUnitName[];
export const ALL_TEAM_NAMES: TeamName[] = ["Inhouse", "BPO1", "BPO2"];


export type TimeInterval = "Week" | "Month";
export type TeamName = "Inhouse" | "BPO1" | "BPO2";

export interface BaseHCValues {
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null;
}

export interface TeamPeriodicMetrics extends BaseHCValues {
  // Inputs / Assumptions (Editable for Teams)
  aht: number | null;
  shrinkagePercentage: number | null;
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
  bu: BusinessUnitName;
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

export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'PrimaryHC', description: "Team Effective Required Agent Minutes:\n(LOB Total Base Req Mins * (Team Vol Mix % / 100)) * (1 + (Team Backlog % / 100))" },
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated number of agents needed." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "Actual headcount at the start of the period." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference: Actual/Starting HC - Required HC." },

  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Average Handle Time: The average time taken to handle one interaction." },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Shrinkage: Percentage of paid time that agents are not available for handling interactions (e.g., breaks, training, meetings)." },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Occupancy: Percentage of time agents are busy with interaction-related work during their available time." },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Backlog: Percentage of additional work (e.g., deferred tasks) that needs to be handled on top of forecasted volume." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },

  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring into this team." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring out of this team." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents starting training (not yet productive)." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents completing training and becoming productive." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost to attrition (Actual/Starting HC * Attrition %)." },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount after attrition, before other movements (Actual/Starting HC - Attrition Loss HC)." },
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period (HC After Attrition + New Hire Production + Move In - Move Out)." },
  
  { key: "_calculatedActualProductiveAgentMinutes", label: "Actual Prod. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal', description: "Team Actual Productive Agent Minutes: Actual HC * Std Work Mins * (1-Shrink%) * Occupancy %" },
];

export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: "lobVolumeForecast", label: "LOB Volume Forecast", isEditableForLob: true, step: 1, isCount: true, description: "Total number of interactions forecasted for this LOB." },
  { key: "lobAverageAHT", label: "LOB Average AHT", isEditableForLob: true, step: 0.1, isTime: true, description: "Average handle time assumed for LOB interactions." },
  { key: "lobTotalBaseRequiredMinutes", label: "LOB Total Base Req Mins", isEditableForLob: true, isTime: true, step: 1, description: "Total agent minutes required for LOB volume, calculated as Volume * AHT or input directly." },
  
  { key: "requiredHC", label: "Required HC", isHC: true, description: "Aggregated required headcount from child entities." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, description: "Aggregated actual/starting headcount from child entities." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, description: "Difference between aggregated Actual/Starting HC and Required HC." },
];

export interface FilterOptions {
  businessUnits: BusinessUnitName[];
  linesOfBusiness: string[];
}

export interface HeaderSectionProps {
  allBusinessUnits: BusinessUnitName[];
  actualLobsForCurrentBu: string[];
  selectedBusinessUnit: BusinessUnitName;
  onSelectBusinessUnit: (value: BusinessUnitName) => void;
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

export const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60;
export const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60;


export const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (!header) return { startDate: null, endDate: null };

  if (interval === "Week") {
    // Format: "FWkX: MM/DD-MM/DD (YYYY)"
    const match = header.match(/(\d{2})\/(\d{2})-(\d{2})\/(\d{2})\s\((\d{4})\)/);
    if (match) {
      const [, startMonth, startDay, endMonth, endDay, yearStr] = match;
      const year = parseInt(yearStr, 10);
      // Date.UTC months are 0-indexed
      const startDate = new Date(Date.UTC(year, parseInt(startMonth, 10) - 1, parseInt(startDay, 10)));
      // Determine end year (could be next year if week spans year boundary, e.g. Dec to Jan)
      let endYear = year;
      if (parseInt(startMonth, 10) > parseInt(endMonth, 10)) { // e.g. 12/29 - 01/04
         endYear = year + 1;
      }
      const endDate = new Date(Date.UTC(endYear, parseInt(endMonth, 10) - 1, parseInt(endDay, 10)));
      return { startDate, endDate };
    }
  } else if (interval === "Month") {
    // Format: "MonthName YYYY" e.g. "January 2024"
    const parts = header.split(" ");
    if (parts.length === 2) {
      const monthName = parts[0];
      const year = parseInt(parts[1], 10);
      const monthIndex = new Date(Date.parse(monthName +" 1, 2012")).getMonth(); // Get month index from name
      if (!isNaN(year) && monthIndex >= 0) {
        const startDate = dateFnsStartOfMonth(new Date(Date.UTC(year, monthIndex, 1)));
        const endDate = dateFnsEndOfMonth(new Date(Date.UTC(year, monthIndex, 1)));
        return { startDate, endDate };
      }
    }
  }
  return { startDate: null, endDate: null };
};

export const findFiscalWeekHeaderForDate = (targetDate: Date, allFiscalHeaders: string[]): string | null => {
  if (!targetDate || !allFiscalHeaders || allFiscalHeaders.length === 0) return null;

  for (const header of allFiscalHeaders) {
    const { startDate, endDate } = getHeaderDateRange(header, "Week");
    if (startDate && endDate) {
      // Ensure targetDate is also treated as UTC for comparison by creating a new Date object from its UTC components
      const targetUTCOnlyDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
      
      if (targetUTCOnlyDate >= startDate && targetUTCOnlyDate <= endDate) {
        return header;
      }
    }
  }
  return null;
};

// --- END CONSOLIDATED TYPES ---
