
"use client";

import React, { useState, useEffect, useCallback, useRef }
from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  format as formatDateFn, 
  getWeek, 
  getMonth, 
  getYear, 
  parse as dateParseFns,
  startOfWeek,
  endOfWeek,
  isWithinInterval as isWithinIntervalFns, 
  setDate, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  isBefore, 
  isAfter,
  eachWeekOfInterval,
  differenceInCalendarWeeks,
  addWeeks,
  isSameDay,
  // getUTCDate, // Removed: will use date.getUTCDate()
  // getUTCMonth, // Removed: will use date.getUTCMonth()
  // getUTCFullYear as getUTCFullYearFns, // Removed: will use date.getUTCFullYear()
} from 'date-fns';
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Loader2, Zap, Download, Building2, Briefcase, ChevronDown, Edit3, ArrowDown, ArrowUp, Minus, Calendar as CalendarIcon, Users, ChevronsUpDown, ArrowLeft, ArrowRight } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { suggestLoBGroupings, SuggestLoBGroupingsOutput } from "@/ai/flows/suggest-lob-groupings";

// --- BEGIN CONSOLIDATED TYPES ---

const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const formatDatePartUTCFromDate = (date: Date): string => 
  `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCDate().toString().padStart(2, '0')}`;

const generateFiscalWeekHeaders = (startFiscalYear: number, numTotalWeeks: number): string[] => {
  const headers: string[] = [];
  
  let fiscalYearActualStartDate: Date;
  const currentYearIsLeap = isLeapYear(startFiscalYear);

  if (currentYearIsLeap) {
    const feb1st = new Date(Date.UTC(startFiscalYear, 1, 1)); 
    let dayOfWeek = feb1st.getUTCDay(); 
    dayOfWeek = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
    fiscalYearActualStartDate = new Date(Date.UTC(startFiscalYear, 1, 1 - dayOfWeek));
  } else {
    const jan22nd = new Date(Date.UTC(startFiscalYear, 0, 22)); 
    let dayOfWeek = jan22nd.getUTCDay();
    dayOfWeek = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
    fiscalYearActualStartDate = new Date(Date.UTC(startFiscalYear, 0, 22 - dayOfWeek));
  }

  for (let i = 0; i < numTotalWeeks; i++) {
    const weekStartDate = new Date(fiscalYearActualStartDate);
    weekStartDate.setUTCDate(fiscalYearActualStartDate.getUTCDate() + i * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

    const displayYear = weekStartDate.getUTCFullYear(); 

    headers.push(
      `FWk${i + 1}: ${formatDatePartUTCFromDate(weekStartDate)}-${formatDatePartUTCFromDate(weekEndDate)} (${displayYear})`
    );
  }
  return headers;
};


export const ALL_WEEKS_HEADERS = generateFiscalWeekHeaders(2024, 104); 

export const ALL_MONTH_HEADERS = Array.from({ length: 24 }, (_, i) => { 
  const year = 2024 + Math.floor(i / 12);
  const month = i % 12;
  const date = new Date(year, month, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

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
    lonsOfBusiness: ["SFF LoB Alpha", "SFF LoB Bravo", "SFF LoB Charlie", "SFF LoB Delta"]
  },
  "RSO": {
    name: "RSO",
    lonsOfBusiness: ["RSO LoB Xray", "RSO LoB Yankee", "RSO LoB Zulu"]
  },
  "Go Local": {
    name: "Go Local",
    lonsOfBusiness: ["GoLocal Partner Support", "GoLocal Customer Care", "GoLocal Dispatch"]
  }
} as const;

export type BusinessUnitName = keyof typeof BUSINESS_UNIT_CONFIG;
export type LineOfBusinessName<BU extends BusinessUnitName = BusinessUnitName> = typeof BUSINESS_UNIT_CONFIG[BU]["lonsOfBusiness"][number];

export const ALL_BUSINESS_UNITS = Object.keys(BUSINESS_UNIT_CONFIG) as BusinessUnitName[];
export const ALL_TEAM_NAMES: TeamName[] = ["Inhouse", "BPO1", "BPO2"];

export const NUM_PERIODS_DISPLAYED = 60; 
export type TimeInterval = "Week" | "Month";
export type TeamName = "Inhouse" | "BPO1" | "BPO2";

export interface BaseHCValues {
  requiredHC: number | null;
  actualHC: number | null; 
  overUnderHC: number | null;
}

export interface TeamPeriodicMetrics extends BaseHCValues {
  aht: number | null; 
  shrinkagePercentage: number | null; 
  occupancyPercentage: number | null; 
  backlogPercentage: number | null; 
  attritionPercentage: number | null; 
  volumeMixPercentage: number | null; 
  
  moveIn: number | null; 
  moveOut: number | null; 
  newHireBatch: number | null; 
  newHireProduction: number | null; 
  
  attritionLossHC?: number | null; // Calculated
  hcAfterAttrition?: number | null; // Calculated
  endingHC?: number | null; // Calculated

  _calculatedRequiredAgentMinutes?: number | null; 
  _calculatedActualProductiveAgentMinutes?: number | null; 
}

export interface AggregatedPeriodicMetrics extends BaseHCValues {
  lobVolumeForecast?: number | null; // Input for LOB
  lobAverageAHT?: number | null; // Input for LOB
  lobTotalBaseRequiredMinutes?: number | null; // Calculated or Input for LOB
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
    isCount?: boolean; // For raw numbers like volume
    isEditableForTeam?: boolean; 
    isEditableForLob?: boolean;
    isDisplayOnly?: boolean; 
    step?: string | number; 
    category?: 'PrimaryHC' | 'CalculatedHC' | 'Assumption' | 'HCAdjustment' | 'Internal';
    description?: string;
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];

export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  // Primary HC Metrics (displayed directly under Team name)
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated number of agents needed." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "Actual headcount at the start of the period." }, 
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference between Actual/Starting HC and Required HC." },
  
  // Assumptions (under "Assumptions" expandable section)
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Average Handle Time: The average time taken to handle one interaction." },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Shrinkage: Percentage of paid time that agents are not available for handling interactions (e.g., breaks, training, meetings)." },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Occupancy: Percentage of time agents are busy with interaction-related work during their available time." },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Backlog: Percentage of additional work (e.g., deferred tasks) that needs to be handled on top of forecasted volume." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },

  // HC Adjustments (under "HC Adjustments" expandable section)
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring into this team." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Agents transferring out of this team." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents starting training." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "New agents completing training and becoming productive." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost to attrition." },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount after attrition, before other movements." }, 
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period." },
  
  // Internal/Detailed Calculations (not directly displayed as rows, but used in tooltips or other calcs)
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal' }, 
  { key: "_calculatedActualProductiveAgentMinutes", label: "Actual Prod. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal' }, 
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
  filterOptions: FilterOptions;
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
// --- END CONSOLIDATED TYPES ---

// --- BEGIN CONSOLIDATED DATA ---
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS; 

const generateTeamPeriodicInputData = (periods: string[], teamIndex: number, totalTeams: number): Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>> => {
  const metrics: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>> = {};
  
  const baseMix = totalTeams > 0 ? 100 / totalTeams : 0;
  const mixes = Array(totalTeams).fill(0).map((_, idx) => {
    if (idx === totalTeams - 1) {
      return parseFloat((100 - (totalTeams - 1) * Math.floor(baseMix)).toFixed(1));
    }
    return parseFloat(Math.floor(baseMix).toFixed(1));
  });
  // Ensure sum is 100, adjust last element if needed
  let sumOfMixes = mixes.reduce((acc, curr) => acc + curr, 0);
  if (Math.abs(sumOfMixes - 100) > 0.01 && mixes.length > 0) {
      mixes[mixes.length - 1] += (100 - sumOfMixes);
      mixes[mixes.length - 1] = parseFloat(mixes[mixes.length - 1].toFixed(1));
  }


  periods.forEach(period => {
    metrics[period] = {
      aht: Math.floor(Math.random() * 10) + 5, 
      shrinkagePercentage: Math.floor(Math.random() * 15) + 5, 
      occupancyPercentage: Math.floor(Math.random() * 20) + 70, 
      backlogPercentage: Math.floor(Math.random() * 10), 
      attritionPercentage: parseFloat((Math.random() * 2).toFixed(1)), 
      volumeMixPercentage: mixes[teamIndex] !== undefined ? mixes[teamIndex] : (totalTeams > 0 ? parseFloat((100/totalTeams).toFixed(1)) : 0),
      actualHC: Math.floor(Math.random() * 50) + 10, 
      moveIn: Math.floor(Math.random() * 5),
      moveOut: Math.floor(Math.random() * 3),
      newHireBatch: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 5 : 0,
      newHireProduction: Math.random() > 0.5 ? Math.floor(Math.random() * 8) : 0,
    };
  });
  return metrics;
};

const generateLobInputs = (periods: string[]): { 
  volume: Record<string, number | null>, 
  aht: Record<string, number | null>, 
  baseReqMins: Record<string, number | null>
} => {
  const volume: Record<string, number | null> = {};
  const avgAht: Record<string, number | null> = {}; // Renamed for clarity
  const baseReqMins: Record<string, number | null> = {};
  periods.forEach(period => {
    const currentVolume = Math.floor(Math.random() * 10000) + 2000; 
    const currentAHT = Math.floor(Math.random() * 10) + 5; 
    volume[period] = currentVolume;
    avgAht[period] = currentAHT;
    baseReqMins[period] = currentVolume * currentAHT; 
  });
  return { volume, aht: avgAht, baseReqMins };
};

const initialMockRawCapacityData: RawLoBCapacityEntry[] = [];
ALL_BUSINESS_UNITS.forEach(bu => {
  BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness.forEach(lob => {
    const teamsForLob: RawTeamDataEntry[] = [];
    const numTeams = ALL_TEAM_NAMES.length;
    
    ALL_TEAM_NAMES.forEach((teamName, index) => {
      teamsForLob.push({
        teamName: teamName,
        periodicInputData: generateTeamPeriodicInputData(MOCK_DATA_PERIODS, index, numTeams),
      });
    });
    const lobInputs = generateLobInputs(MOCK_DATA_PERIODS);

    initialMockRawCapacityData.push({
      id: `${bu.toLowerCase().replace(/\s+/g, '-')}_${lob.toLowerCase().replace(/\s+/g, '-')}`,
      bu: bu,
      lob: lob,
      lobVolumeForecast: lobInputs.volume, 
      lobAverageAHT: lobInputs.aht,       
      lobTotalBaseRequiredMinutes: lobInputs.baseReqMins, 
      teams: teamsForLob,
    });
  });
});
// --- END CONSOLIDATED DATA ---

// --- BEGIN HELPER FUNCTIONS ---
export const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60; 
export const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60; 

const calculateTeamMetricsForPeriod = (
  teamInputDataCurrentPeriod: Partial<TeamPeriodicMetrics>, 
  lobTotalBaseRequiredMinutesForPeriod: number | null, 
  standardWorkMinutesForPeriod: number 
): TeamPeriodicMetrics => {
  const defaults: TeamPeriodicMetrics = {
    aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
    attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null,
    moveOut: null, newHireBatch: null, newHireProduction: null, 
    _calculatedRequiredAgentMinutes: null,
    _calculatedActualProductiveAgentMinutes: null,
    requiredHC: null,
    overUnderHC: null,
    attritionLossHC: null,
    hcAfterAttrition: null,
    endingHC: null,
    ...teamInputDataCurrentPeriod, 
  };

  const baseTeamRequiredMinutes = (lobTotalBaseRequiredMinutesForPeriod ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const effectiveTeamRequiredMinutes = baseTeamRequiredMinutes * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  defaults._calculatedRequiredAgentMinutes = effectiveTeamRequiredMinutes;

  let requiredHC = null;
  if (effectiveTeamRequiredMinutes > 0 && standardWorkMinutesForPeriod > 0 && defaults.shrinkagePercentage !== null && defaults.occupancyPercentage !== null && defaults.occupancyPercentage > 0) {
    const effectiveMinutesPerHC = standardWorkMinutesForPeriod * 
                                 (1 - (defaults.shrinkagePercentage / 100)) * 
                                 (defaults.occupancyPercentage / 100);
    if (effectiveMinutesPerHC > 0) {
      requiredHC = effectiveTeamRequiredMinutes / effectiveMinutesPerHC;
    }
  } else if (effectiveTeamRequiredMinutes === 0) {
    requiredHC = 0; 
  }
  defaults.requiredHC = requiredHC;

  const currentActualHC = defaults.actualHC ?? 0;
  defaults.overUnderHC = (currentActualHC !== null && requiredHC !== null) ? currentActualHC - requiredHC : null;

  if (currentActualHC !== null && standardWorkMinutesForPeriod > 0 && defaults.shrinkagePercentage !== null && defaults.occupancyPercentage !== null) {
    defaults._calculatedActualProductiveAgentMinutes = currentActualHC * standardWorkMinutesForPeriod *
                                                  (1 - (defaults.shrinkagePercentage / 100)) *
                                                  (defaults.occupancyPercentage / 100);
  } else {
    defaults._calculatedActualProductiveAgentMinutes = 0;
  }
  
  const attritionLossHC = currentActualHC * ((defaults.attritionPercentage ?? 0) / 100);
  defaults.attritionLossHC = attritionLossHC;

  const hcAfterAttrition = currentActualHC - attritionLossHC;
  defaults.hcAfterAttrition = hcAfterAttrition; 

  defaults.endingHC = hcAfterAttrition + (defaults.newHireProduction ?? 0) + (defaults.moveIn ?? 0) - (defaults.moveOut ?? 0);
  
  return defaults;
};


const parseDateFromHeaderStringMMDDYYYY = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;
  const parsedDate = new Date(Date.UTC(parseInt(year), month - 1, day)); 
  if (parsedDate.getUTCFullYear() !== parseInt(year) || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    return null; 
  }
  return parsedDate;
};


const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (interval === "Week") {
    const match = header.match(/FWk\d+:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
    if (match) {
      const [, startDateStr, endDateStr, yearStr] = match;
      let parsedStartDate = parseDateFromHeaderStringMMDDYYYY(startDateStr, yearStr);
      let parsedEndDate = parseDateFromHeaderStringMMDDYYYY(endDateStr, yearStr);

      if (parsedStartDate && parsedEndDate && isBefore(parsedEndDate, parsedStartDate)) {
         const nextYearStr = (parseInt(yearStr) + 1).toString();
         const potentialEndDateNextYear = parseDateFromHeaderStringMMDDYYYY(endDateStr, nextYearStr);
         if (potentialEndDateNextYear && isAfter(potentialEndDateNextYear, parsedStartDate)) {
            parsedEndDate = potentialEndDateNextYear;
         }
      }
      return { startDate: parsedStartDate, endDate: parsedEndDate };
    }
  } else if (interval === "Month") {
    try {
      const date = dateParseFns(header, "MMMM yyyy", new Date()); 
      if (!isNaN(date.getTime())) { 
        const yearVal = getYear(date); 
        const monthVal = getMonth(date); 
        const firstDay = startOfMonth(new Date(yearVal, monthVal));
        const lastDay = endOfMonth(new Date(yearVal, monthVal));
        return { startDate: firstDay, endDate: lastDay };
      }
    } catch (e) {
      // console.warn(`Could not parse month header: ${header}`, e);
    }
  }
  return { startDate: null, endDate: null };
};

const getDefaultDateRange = (interval: TimeInterval, allHeaders: string[]): DateRange => {
  if (allHeaders.length === 0) return { from: undefined, to: undefined };

  const numPeriodsToDefault = interval === "Week" ? 11 : 2; // Default to 12 weeks (0-11) or 3 months (0-2)

  const fromHeaderDetails = getHeaderDateRange(allHeaders[0], interval);
  const toHeaderDetails = getHeaderDateRange(allHeaders[Math.min(numPeriodsToDefault, allHeaders.length - 1)], interval);
  
  let fromDate = fromHeaderDetails.startDate;
  let toDate = toHeaderDetails.endDate;

  if (interval === "Week") {
    if (fromDate) fromDate = startOfWeek(fromDate, { weekStartsOn: 1 }); 
    if (toDate) toDate = endOfWeek(toDate, { weekStartsOn: 1 });
  }
  
  return { from: fromDate ?? undefined, to: toDate ?? undefined };
};

const findFiscalWeekHeaderForDate = (targetDate: Date, allFiscalHeaders: string[]): string | null => {
  if (!targetDate) return null;
  for (const header of allFiscalHeaders) {
    const { startDate, endDate } = getHeaderDateRange(header, "Week");
    if (startDate && endDate) {
      // Ensure targetDate is also treated as UTC for comparison
      const targetUTC = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
      
      if (targetUTC >= startDate && targetUTC <= endDate) {
        return header;
      }
    }
  }
  return null;
};
// --- END HELPER FUNCTIONS ---

// --- BEGIN AiGroupingDialog COMPONENT ---
const aiGroupingDialogFormSchema = z.object({
  historicalCapacityData: z.string().min(1, "Historical data (CSV format) is required."),
  currentBusinessUnits: z.string().min(1, "Current business units (comma-separated) are required."),
});
type AiGroupingDialogFormData = z.infer<typeof aiGroupingDialogFormSchema>;

interface AiGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AiGroupingDialog({ open, onOpenChange }: AiGroupingDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestLoBGroupingsOutput | null>(null);

  const form = useForm<AiGroupingDialogFormData>({
    resolver: zodResolver(aiGroupingDialogFormSchema),
    defaultValues: {
      historicalCapacityData: "LoB,Week1,Week2,Week3\nSales,100,120,110\nSupport,80,90,85\nMarketing,50,60,55",
      currentBusinessUnits: "BU Alpha, BU Beta",
    },
  });

  const onSubmit = async (data: AiGroupingDialogFormData) => {
    setIsLoading(true);
    setSuggestions(null);
    try {
      const businessUnitsArray = data.currentBusinessUnits.split(",").map(bu => bu.trim()).filter(bu => bu.length > 0);
      const result = await suggestLoBGroupings({
        historicalCapacityData: data.historicalCapacityData,
        currentBusinessUnits: businessUnitsArray,
      });
      setSuggestions(result);
      toast({
        title: "Suggestions Generated",
        description: "AI has provided LoB grouping suggestions.",
      });
    } catch (error) {
      console.error("Error generating LoB groupings:", error);
      toast({
        title: "Error",
        description: "Failed to generate LoB grouping suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Assumptions Assister
          </DialogTitle>
          <DialogDescription>
            Provide historical data and current business units to get AI-driven suggestions for optimal LoB groupings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="historicalCapacityData">Historical Capacity Data (CSV Format)</Label>
            <Textarea
              id="historicalCapacityData"
              placeholder="LoB,Date,CapacityUsed,RequiredCapacity..."
              {...form.register("historicalCapacityData")}
              className="mt-1 min-h-[120px]"
            />
            {form.formState.errors.historicalCapacityData && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.historicalCapacityData.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="currentBusinessUnits">Current Business Units (comma-separated)</Label>
            <Input
              id="currentBusinessUnits"
              placeholder="e.g., Sales Division, Product Team, Regional Office"
              {...form.register("currentBusinessUnits")}
              className="mt-1"
            />
            {form.formState.errors.currentBusinessUnits && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.currentBusinessUnits.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Get Suggestions
            </Button>
          </DialogFooter>
        </form>

        {suggestions && (
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suggested Groupings</CardTitle>
              </CardHeader>
              <CardContent>
                {suggestions.suggestedGroupings.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {suggestions.suggestedGroupings.map((group, index) => (
                      <li key={index} className="text-sm">
                        <strong>Group {index + 1}:</strong> {group.join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific groupings suggested based on the data.</p>
                )}
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Reasoning</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{suggestions.reasoning}</p>
                </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
// --- END AiGroupingDialog COMPONENT ---

// --- BEGIN DateRangePicker COMPONENT ---
interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  onDateChange: (date: DateRange | undefined) => void
  className?: string
  allAvailablePeriods: string[];
}

function DateRangePicker({ date, onDateChange, className, allAvailablePeriods }: DateRangePickerProps) {
  const [clientButtonText, setClientButtonText] = useState<string>("Pick a date range");

  const yearsInHeaders = allAvailablePeriods.map(h => {
    const match = h.match(/\((\d{4})\)$/);
    return match ? parseInt(match[1]) : 0;
  }).filter(y => y > 0);
  
  const minYear = yearsInHeaders.length > 0 ? Math.min(...yearsInHeaders) : new Date().getUTCFullYear();
  const maxYear = yearsInHeaders.length > 0 ? Math.max(...yearsInHeaders) : new Date().getUTCFullYear() + 1;
  
  const defaultCalendarMonth = date?.from || new Date(Date.UTC(minYear, 0, 1));

  useEffect(() => {
    if (typeof window !== 'undefined') { // Ensure this runs only on client
      let newButtonText = "Pick a date range";
      if (date?.from) {
        const fromFiscalHeader = findFiscalWeekHeaderForDate(date.from, allAvailablePeriods);
        const fromWeekLabel = fromFiscalHeader ? fromFiscalHeader.split(':')[0].replace("FWk","W") : `W${getWeek(date.from, { weekStartsOn: 1 })}`;
        const fromDateStr = `${date.from.getUTCDate().toString().padStart(2, '0')}/${(date.from.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.from.getUTCFullYear()}`;
        newButtonText = `${fromWeekLabel} (${fromDateStr})`;

        if (date.to) {
          const toFiscalHeader = findFiscalWeekHeaderForDate(date.to, allAvailablePeriods);
          const toWeekLabel = toFiscalHeader ? toFiscalHeader.split(':')[0].replace("FWk","W") : `W${getWeek(date.to, { weekStartsOn: 1 })}`;
          const toDateStr = `${date.to.getUTCDate().toString().padStart(2, '0')}/${(date.to.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.to.getUTCFullYear()}`;
          
          // Check if 'to' date is in a different week than 'from' date
          const fromWeekStartForCompare = startOfWeek(date.from, { weekStartsOn: 1 });
          const toWeekStartForCompare = startOfWeek(date.to, { weekStartsOn: 1 });

          if (!isSameDay(fromWeekStartForCompare, toWeekStartForCompare)) { 
               newButtonText += ` - ${toWeekLabel} (${toDateStr})`;
          }
        }
      }
      setClientButtonText(newButtonText);
    }
  }, [date, allAvailablePeriods]);


  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full lg:w-[380px] justify-start text-left font-normal h-9", 
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{clientButtonText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            weekStartsOn={1} 
            captionLayout="dropdown-buttons"
            fromYear={minYear}
            toYear={maxYear} 
            defaultMonth={defaultCalendarMonth}
            selected={date}
            onSelect={(range: DateRange | undefined) => {
              let newFrom = range?.from;
              let newTo = range?.to;

              if (newFrom) {
                newFrom = startOfWeek(newFrom, { weekStartsOn: 1 });
              }
              if (newTo) {
                newTo = endOfWeek(newTo, { weekStartsOn: 1 });
              }
              
              if (newFrom && newTo && isBefore(newTo, newFrom)) {
                newTo = endOfWeek(newFrom, {weekStartsOn: 1}); 
              }

              const processedRange: DateRange | undefined = newFrom
                ? { from: newFrom, to: newTo || newFrom } 
                : undefined;
              onDateChange(processedRange);
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
// --- END DateRangePicker COMPONENT ---

// --- BEGIN HeaderSection COMPONENT ---
function HeaderSection({
  filterOptions,
  selectedBusinessUnit,
  onSelectBusinessUnit,
  selectedLineOfBusiness,
  onSelectLineOfBusiness,
  selectedTimeInterval,
  onSelectTimeInterval,
  selectedDateRange,
  onSelectDateRange,
  allAvailablePeriods,
  displayedPeriodHeaders,
  activeHierarchyContext,
  headerPeriodScrollerRef,
}: HeaderSectionProps) { 
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const handleLobSelectionChange = (lob: string, checked: boolean) => {
    const newSelectedLOBs = checked
      ? [...selectedLineOfBusiness, lob]
      : selectedLineOfBusiness.filter((item) => item !== lob);
    onSelectLineOfBusiness(newSelectedLOBs);
  };

  const actualLobsForCurrentBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit]?.lonsOfBusiness || [];
  let lobDropdownLabel = "Select LOBs";
  if (selectedLineOfBusiness.length === 1) {
    lobDropdownLabel = selectedLineOfBusiness[0];
  } else if (actualLobsForCurrentBu.length > 0 && selectedLineOfBusiness.length === actualLobsForCurrentBu.length) {
    lobDropdownLabel = `All ${actualLobsForCurrentBu.length} LOBs`;
  } else if (selectedLineOfBusiness.length > 1) {
    lobDropdownLabel = `${selectedLineOfBusiness.length} LOBs Selected`;
  } else if (actualLobsForCurrentBu.length === 0) {
    lobDropdownLabel = "No LOBs";
  }


  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 bg-background p-4 border-b border-border"> 
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground">Capacity Insights</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2" /> Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export current view as CSV (not implemented)</p></TooltipContent>
            </Tooltip>
            <Button variant="default" size="sm" onClick={() => setIsAiDialogOpen(true)}>
              <Zap className="mr-2" /> Assumptions Assister
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1.5">
             <Label className="text-xs text-muted-foreground">Business Unit</Label>
            <Select value={selectedBusinessUnit} onValueChange={onSelectBusinessUnit}>
              <SelectTrigger className="w-full lg:w-[180px] text-sm h-9">
                <Building2 className="mr-2 opacity-70" />
                <SelectValue placeholder="Business Unit" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.businessUnits.map((bu) => (
                  <SelectItem key={bu} value={bu}>
                    {bu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Line of Business</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[240px] text-sm h-9 justify-between">
                  <div className="flex items-center truncate">
                    <Briefcase className="mr-2 opacity-70 flex-shrink-0" />
                    <span className="truncate" title={lobDropdownLabel}>{lobDropdownLabel}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full md:w-[240px]">
                <DropdownMenuLabel>Select Lines of Business</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {actualLobsForCurrentBu.length > 0 ? (
                  actualLobsForCurrentBu.map((lob) => (
                    <DropdownMenuCheckboxItem
                      key={lob}
                      checked={selectedLineOfBusiness.includes(lob)}
                      onCheckedChange={(checked) => handleLobSelectionChange(lob, Boolean(checked))}
                      onSelect={(e) => e.preventDefault()} 
                    >
                      {lob}
                    </DropdownMenuCheckboxItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No LOBs available for {selectedBusinessUnit}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Interval</Label>
            <div className="flex items-center gap-2 border rounded-md p-1 bg-muted">
              <Button
                variant={selectedTimeInterval === "Week" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSelectTimeInterval("Week")}
                className="h-7 px-3"
              >
                Week
              </Button>
              <Button
                variant={selectedTimeInterval === "Month" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSelectTimeInterval("Month")}
                className="h-7 px-3"
              >
                Month
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
             <Label className="text-xs text-muted-foreground">Date Range</Label>
            <DateRangePicker date={selectedDateRange} onDateChange={onSelectDateRange} allAvailablePeriods={allAvailablePeriods} />
          </div>
        </div>
        
        {/* Combined Table Header Row */}
        <div className="mt-4 flex items-stretch border-b border-border bg-card h-12">
          <div className="sticky left-0 z-55 bg-card min-w-[320px] px-4 py-2 flex items-center border-r border-border/50">
            <span className="text-sm font-medium text-muted-foreground truncate">{activeHierarchyContext}</span>
          </div>
          <div ref={headerPeriodScrollerRef} className="flex-grow overflow-x-auto scrollbar-hide whitespace-nowrap flex items-stretch">
            {displayedPeriodHeaders.map((period) => {
              const parts = period.split(': ');
              const weekLabelPart = parts[0].replace("FWk", "W"); 
              let dateRangePart = "";
              if (parts.length > 1) {
                const dateAndYearPart = parts[1];
                const dateMatch = dateAndYearPart.match(/^(\d{2}\/\d{2}-\d{2}\/\d{2})/);
                if (dateMatch) {
                  dateRangePart = dateMatch[1];
                }
              }
              return (
                <div
                  key={period}
                  className="min-w-[100px] px-2 py-2 flex flex-col items-end justify-center text-right border-l border-border/50 h-full"
                >
                  <span className="text-sm font-medium">{weekLabelPart}</span>
                  {dateRangePart && (
                    <span className="text-xs text-muted-foreground">
                      ({dateRangePart})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
      </header>
    </TooltipProvider>
  );
}
// --- END HeaderSection COMPONENT ---

// --- BEGIN CapacityTable COMPONENT ---
interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[];
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  teamMetricDefinitions: TeamMetricDefinitions; 
  aggregatedMetricDefinitions: AggregatedMetricDefinitions;
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
  onLobMetricChange: (lobId: string, periodHeader: string, metricKey: 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes', newValue: string) => void;
  editingCell: { id: string; period: string; metricKey: string } | null;
  onSetEditingCell: (id: string | null, period: string | null, metricKey: string | null) => void;
  selectedTimeInterval: TimeInterval;
  onActiveHierarchyChange: (hierarchy: string | null) => void;
  tableBodyScrollRef: React.RefObject<HTMLDivElement>;
}

interface MetricCellContentProps {
  item: CapacityDataRow;
  metricData: TeamPeriodicMetrics | AggregatedPeriodicMetrics | undefined;
  metricDef: MetricDefinition;
  periodName: string;
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange'];
  onLobMetricChange: CapacityTableProps['onLobMetricChange'];
  isEditing: boolean;
  onSetEditingCell: CapacityTableProps['onSetEditingCell'];
  selectedTimeInterval: TimeInterval; 
}

const MetricCellContent: React.FC<MetricCellContentProps> = React.memo(({
  item,
  metricData,
  metricDef,
  periodName,
  onTeamMetricChange,
  onLobMetricChange,
  isEditing,
  onSetEditingCell,
  selectedTimeInterval,
}) => {
  const [tempValue, setTempValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawValue = metricData ? (metricData as any)[metricDef.key] : null;

  let canEditCell = false;
  if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly) {
    canEditCell = true;
  } else if (item.itemType === 'LOB' && metricDef.isEditableForLob && !metricDef.isDisplayOnly) {
    canEditCell = true;
  }


  useEffect(() => {
    if (isEditing) {
      setTempValue(rawValue === null || rawValue === undefined ? "" : String(rawValue));
      if (inputRef.current) {
        inputRef.current.focus();
        // Select all text in input on focus
        inputRef.current.select();
      }
    } else {
      setTempValue(null);
    }
  }, [isEditing, rawValue]);

  const handleEditClick = () => {
    if (!canEditCell) return;

    let editId: string | null = null;
    if (item.itemType === 'Team' && item.lobId) {
      editId = `${item.lobId}_${item.name.replace(/\s+/g, '-')}`;
    } else if (item.itemType === 'LOB') {
      editId = item.id;
    }
    
    if (editId) {
        onSetEditingCell(editId, periodName, metricDef.key as string);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempValue(e.target.value);
  };

  const handleSave = () => {
    if (tempValue === null) { // If no change, or cleared
      onSetEditingCell(null, null, null);
      return;
    }

    if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && item.lobId) {
      onTeamMetricChange(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, tempValue);
    } else if (item.itemType === 'LOB' && metricDef.isEditableForLob && !metricDef.isDisplayOnly) {
      onLobMetricChange(item.id, periodName, metricDef.key as 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes', tempValue);
    }
    setTempValue(null);
    onSetEditingCell(null, null, null);
  };

  const handleCancel = () => {
    setTempValue(null);
    onSetEditingCell(null, null, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if any
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <Input
        type="number"
        value={tempValue === null ? "" : tempValue}
        onChange={handleInputChange}
        onBlur={handleSave} 
        onKeyDown={handleKeyDown}
        className="h-7 w-full max-w-[100px] text-right tabular-nums px-1 py-0.5 text-xs bg-background border-input focus:border-primary focus:ring-1 focus:ring-primary group-hover:border-primary"
        step={metricDef.step || "any"}
        autoFocus
        ref={inputRef}
      />
    );
  }

  let shouldDisplayMetric = false;
  if (item.itemType === 'Team' && TEAM_METRIC_ROW_DEFINITIONS.some(def => def.key === metricDef.key && def.category !== 'Internal')) {
    shouldDisplayMetric = true;
  } else if ((item.itemType === 'BU' || item.itemType === 'LOB') && AGGREGATED_METRIC_ROW_DEFINITIONS.some(def => def.key === metricDef.key)) {
    if (item.itemType === 'BU' && metricDef.key === 'lobTotalBaseRequiredMinutes') { // Don't show LOB base req for BU
       shouldDisplayMetric = false;
    } else if (item.itemType === 'BU' && metricDef.key === 'lobVolumeForecast') {
       shouldDisplayMetric = false;
    } else if (item.itemType === 'BU' && metricDef.key === 'lobAverageAHT') {
       shouldDisplayMetric = false;
    }
    else {
       shouldDisplayMetric = true;
    }
  }


  if (!shouldDisplayMetric || rawValue === null || rawValue === undefined) {
    const isEditableEmptyCell = canEditCell;
    return <div 
              onClick={isEditableEmptyCell ? handleEditClick : undefined} 
              className={`${isEditableEmptyCell ? 'cursor-pointer group relative' : ''} w-full h-full flex items-center justify-end pr-1`} // Added relative for icon
           >
      <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
      {isEditableEmptyCell && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
      </div>;
  }


  let displayValue: React.ReactNode = "";
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let formulaText = "";

  const numValue = Number(rawValue);
  const teamMetrics = metricData as TeamPeriodicMetrics;
  const aggMetrics = metricData as AggregatedPeriodicMetrics;
  const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;

  if (metricDef.isPercentage) {
    displayValue = `${numValue.toFixed(1)}%`;
  } else if (metricDef.isTime && (metricDef.key === 'aht' || metricDef.key === 'lobAverageAHT')) { 
    displayValue = `${numValue.toFixed(1)} min`;
  } else if (metricDef.isTime && (metricDef.key === '_calculatedRequiredAgentMinutes' || metricDef.key === '_calculatedActualProductiveAgentMinutes' || metricDef.key === 'lobTotalBaseRequiredMinutes')) {
    displayValue = `${numValue.toFixed(0)} min`;
  } else if (metricDef.isHC || ['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction', 'attritionLossHC', 'endingHC', 'hcAfterAttrition'].includes(metricDef.key as string)) {
    const digits = (['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction'].includes(metricDef.key as string)) ? 0 : 2;
    displayValue = isNaN(numValue) ? '-' : numValue.toFixed(digits);
  } else if (metricDef.isCount) { // For LOB Volume Forecast
     displayValue = isNaN(numValue) ? '-' : numValue.toFixed(0);
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
    const fractionDigits = (['overUnderHC', 'requiredHC', 'actualHC'].includes(metricDef.key as string)) ? 2 : 0; // Default to 0 for other numbers
    displayValue = numValue.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  } else {
    displayValue = String(rawValue);
  }

  let baseTooltipText = `${item.name} - ${periodName}\n${metricDef.label}: ${displayValue}`;
  if (metricDef.description && item.itemType === 'Team') { // Only add general description for team assumptions
    baseTooltipText += `\n${metricDef.description}`;
  }


  if (item.itemType === 'Team') {
    switch (metricDef.key) {
      case 'requiredHC':
        if (teamMetrics?._calculatedRequiredAgentMinutes !== null && teamMetrics?._calculatedRequiredAgentMinutes !== undefined &&
            teamMetrics?.shrinkagePercentage !== null && teamMetrics?.occupancyPercentage !== null && teamMetrics?.occupancyPercentage > 0 && standardWorkMinutesForPeriod > 0) {
          const effMinsPerHC = standardWorkMinutesForPeriod * (1 - (teamMetrics.shrinkagePercentage / 100)) * (teamMetrics.occupancyPercentage / 100);
          if (effMinsPerHC > 0) {
            formulaText = `Formula: Eff. Req. Mins / (Std Mins * (1-Shrink%) * Occupancy%)\n` +
                          `Calc: ${teamMetrics._calculatedRequiredAgentMinutes.toFixed(0)} / (${standardWorkMinutesForPeriod.toFixed(0)} * (1 - ${(teamMetrics.shrinkagePercentage / 100).toFixed(2)}) * ${(teamMetrics.occupancyPercentage / 100).toFixed(2)}) = ${numValue.toFixed(2)}\n` +
                          `(Effective Mins per HC: ${effMinsPerHC.toFixed(0)})`;
          } else {
            formulaText = `Formula: Eff. Req. Mins / (Std Mins * (1-Shrink%) * Occupancy%)\n(Cannot calculate due to zero denominator component)`;
          }
        } else if (teamMetrics?._calculatedRequiredAgentMinutes === 0) {
          formulaText = `Formula: Eff. Req. Mins / (Std Mins * (1-Shrink%) * Occupancy%)\nCalculation: 0 / (...) = 0`;
        }
        break;
      case 'overUnderHC':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined && 
            teamMetrics?.requiredHC !== null && teamMetrics?.requiredHC !== undefined) {
          formulaText = `Formula: Actual HC - Required HC\nCalc: ${teamMetrics.actualHC.toFixed(2)} - ${teamMetrics.requiredHC.toFixed(2)} = ${numValue.toFixed(2)}`;
        }
        break;
      case 'attritionLossHC':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
            teamMetrics?.attritionPercentage !== null && teamMetrics?.attritionPercentage !== undefined) {
          formulaText = `Formula: Actual HC * Attrition %\nCalc: ${teamMetrics.actualHC.toFixed(2)} * ${(teamMetrics.attritionPercentage / 100).toFixed(3)} = ${numValue.toFixed(2)}`;
        }
        break;
      case 'hcAfterAttrition':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
            teamMetrics?.attritionLossHC !== null && teamMetrics?.attritionLossHC !== undefined) {
          formulaText = `Formula: Actual HC - Attrition Loss HC\nCalc: ${teamMetrics.actualHC.toFixed(2)} - ${teamMetrics.attritionLossHC.toFixed(2)} = ${numValue.toFixed(2)}`;
        }
        break;
      case 'endingHC':
        if (teamMetrics?.hcAfterAttrition !== null && teamMetrics?.hcAfterAttrition !== undefined &&
            teamMetrics?.newHireProduction !== null && teamMetrics?.newHireProduction !== undefined &&
            teamMetrics?.moveIn !== null && teamMetrics?.moveIn !== undefined &&
            teamMetrics?.moveOut !== null && teamMetrics?.moveOut !== undefined) {
          formulaText = `Formula: HC After Attrition + New Hire Prod. + Move In - Move Out\n` +
                          `Calc: ${teamMetrics.hcAfterAttrition.toFixed(2)} + ${teamMetrics.newHireProduction.toFixed(0)} + ${teamMetrics.moveIn.toFixed(0)} - ${teamMetrics.moveOut.toFixed(0)} = ${numValue.toFixed(2)}`;
        }
        break;
      case '_calculatedRequiredAgentMinutes':
         if (metricData && 'volumeMixPercentage' in metricData && typeof metricData.volumeMixPercentage === 'number' &&
             'backlogPercentage' in metricData && typeof metricData.backlogPercentage === 'number' &&
             typeof item.lobId === 'string') {
              formulaText = `Formula: (LOB Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)\n` +
                            `Represents team's share of LOB demand, adjusted for team's backlog.`;
         }
        break;
      case '_calculatedActualProductiveAgentMinutes':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
            teamMetrics?.shrinkagePercentage !== null && teamMetrics?.occupancyPercentage !== null && standardWorkMinutesForPeriod > 0) {
          const prodMins = teamMetrics.actualHC * standardWorkMinutesForPeriod * (1 - (teamMetrics.shrinkagePercentage / 100)) * (teamMetrics.occupancyPercentage / 100);
          formulaText = `Formula: Actual HC * Std Mins * (1-Shrink%) * Occupancy%\n` +
                          `Calc: ${teamMetrics.actualHC.toFixed(2)} * ${standardWorkMinutesForPeriod.toFixed(0)} * (1 - ${(teamMetrics.shrinkagePercentage / 100).toFixed(2)}) * ${(teamMetrics.occupancyPercentage / 100).toFixed(2)}) = ${prodMins.toFixed(0)}`;
        }
        break;
    }
  } else { // BU or LOB
    switch (metricDef.key) {
      case 'overUnderHC':
        if (aggMetrics?.actualHC !== null && aggMetrics?.actualHC !== undefined &&
            aggMetrics?.requiredHC !== null && aggMetrics?.requiredHC !== undefined) {
          formulaText = `Formula: Aggregated Actual HC - Aggregated Required HC\nCalc: ${aggMetrics.actualHC.toFixed(2)} - ${aggMetrics.requiredHC.toFixed(2)} = ${numValue.toFixed(2)}`;
        }
        break;
      case 'requiredHC':
      case 'actualHC':
        const childType = item.itemType === 'BU' ? 'LOBs' : 'Teams';
        const childNames = item.children?.map(child => child.name).join(', ') || 'N/A';
        formulaText = `Formula: SUM(${metricDef.label} from child ${childType})\nContributing: ${childNames}`;
        break;
      case 'lobTotalBaseRequiredMinutes':
        if (item.itemType === 'LOB' && aggMetrics && 'lobVolumeForecast' in aggMetrics && 'lobAverageAHT' in aggMetrics) {
            const volume = aggMetrics.lobVolumeForecast;
            const aht = aggMetrics.lobAverageAHT;
            const calculatedMins = (typeof volume === 'number' && typeof aht === 'number' && volume > 0 && aht > 0) ? volume * aht : numValue; // Use numValue if direct input
             formulaText = `Formula: LOB Volume Forecast * LOB Avg AHT\n` +
                           `Calc: ${volume?.toFixed(0) ?? 'N/A'} * ${aht?.toFixed(1) ?? 'N/A'} = ${calculatedMins.toFixed(0)}\n` +
                           `(Current value may be a direct input or calculated)`;
        }
        break;
    }
  }


  if (metricDef.key === "overUnderHC") {
    if (numValue < -0.001) { 
      textColor = "text-destructive";
      icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
    } else if (numValue > 0.001) {
      textColor = "text-primary"; 
      icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
    }
  }
  
  const tooltipContent = formulaText ? `${baseTooltipText}\n\n${formulaText}` : baseTooltipText;

  const cellDivContent = (
    <>
      {displayValue} {icon}
      {canEditCell && !isEditing && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          onClick={canEditCell ? handleEditClick : undefined} 
          className={`relative flex items-center justify-end gap-1 ${textColor} ${canEditCell ? 'cursor-pointer group' : ''} w-full h-full pr-1`}
        >
          {cellDivContent}
        </div>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-wrap text-xs max-w-xs">
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
});
MetricCellContent.displayName = 'MetricCellContent';


interface MetricRowProps {
  item: CapacityDataRow;
  metricDef: MetricDefinition;
  level: number;
  periodHeaders: string[];
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange'];
  onLobMetricChange: CapacityTableProps['onLobMetricChange'];
  editingCell: { id: string; period: string; metricKey: string } | null; 
  onSetEditingCell: CapacityTableProps['onSetEditingCell'];
  selectedTimeInterval: TimeInterval;
}

const MetricRow: React.FC<MetricRowProps> = React.memo(({ item, metricDef, level, periodHeaders, onTeamMetricChange, onLobMetricChange, editingCell, onSetEditingCell, selectedTimeInterval }) => {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell
        className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2 border-r border-border/50"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <span>{metricDef.label}</span>
              {(item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly) && <Edit3 className="h-3 w-3 text-muted-foreground opacity-50" />}
              {(item.itemType === 'LOB' && metricDef.isEditableForLob && !metricDef.isDisplayOnly) && <Edit3 className="h-3 w-3 text-muted-foreground opacity-50" />}
            </div>
          </TooltipTrigger>
           <TooltipContent className="whitespace-pre-wrap text-xs max-w-xs">
            <p>{metricDef.label}</p>
            {metricDef.description && (<p className="text-muted-foreground mt-1">{metricDef.description}</p>)}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      {periodHeaders.map((periodHeader) => {
        const metricForPeriod = item.periodicData[periodHeader];
        let cellTextColor = "text-foreground";
        if (metricDef.key === "overUnderHC" && metricForPeriod && (metricForPeriod as any)[metricDef.key] !== null && (metricForPeriod as any)[metricDef.key] !== undefined) {
            const value = Number((metricForPeriod as any)[metricDef.key]);
            if (value < -0.001) cellTextColor = "text-destructive";
            else if (value > 0.001) cellTextColor = "text-primary"; 
        }
        
        let currentEditId = item.id; // Default for BU/LOB
        if (item.itemType === 'Team' && item.lobId) { // Construct specific ID for team to allow editing
            currentEditId = `${item.lobId}_${item.name.replace(/\s+/g, '-')}`;
        }
        
        const isCurrentlyEditing = 
          editingCell?.id === currentEditId &&
          editingCell?.period === periodHeader &&
          editingCell?.metricKey === metricDef.key;
        
        return (
          <TableCell
            key={`${item.id}-${metricDef.key}-${periodHeader}`}
            className={`text-right tabular-nums ${cellTextColor} py-2 px-2 min-w-[100px] border-l border-border/50`}
          >
            <MetricCellContent
                item={item}
                metricData={metricForPeriod}
                metricDef={metricDef}
                periodName={periodHeader}
                onTeamMetricChange={onTeamMetricChange}
                onLobMetricChange={onLobMetricChange}
                isEditing={isCurrentlyEditing}
                onSetEditingCell={onSetEditingCell}
                selectedTimeInterval={selectedTimeInterval}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
});
MetricRow.displayName = 'MetricRow';

const CapacityTableComponent: React.FC<CapacityTableProps> = ({
  data,
  periodHeaders,
  expandedItems,
  toggleExpand,
  teamMetricDefinitions,
  aggregatedMetricDefinitions,
  onLobMetricChange,
  onTeamMetricChange,
  editingCell,
  onSetEditingCell,
  selectedTimeInterval,
  onActiveHierarchyChange,
  tableBodyScrollRef,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null); 
  const itemNameRowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const headerHeight = 48; // Approximate height of the sticky header row in HeaderSection

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const intersectingItem = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => ({
            id: (entry.target as HTMLElement).dataset.itemId || '',
            name: (entry.target as HTMLElement).dataset.itemName || '',
            type: (entry.target as HTMLElement).dataset.itemType || '',
            top: entry.target.getBoundingClientRect().top,
          }))
          .sort((a, b) => a.top - b.top) // Find the one closest to the top
          .find(item => item.top >= headerHeight -5 && item.top < headerHeight + 150); // Check if it's just below the sticky header

        if (intersectingItem) {
          onActiveHierarchyChange(`${intersectingItem.type}: ${intersectingItem.name}`);
        } else {
          onActiveHierarchyChange(null); // Reset if no relevant item is at the top
        }
      },
      { 
        root: scrollContainerRef.current, // Observe within the table's scroll container
        rootMargin: `-${headerHeight -1}px 0px -80% 0px`, // Item must be just below header
        threshold: [0, 0.1, 0.9, 1.0] // Trigger at various visibility points
      }
    );

    itemNameRowRefs.current.forEach(rowElement => {
      if (rowElement) observer.observe(rowElement);
    });

    return () => {
      itemNameRowRefs.current.forEach(rowElement => {
        if (rowElement) observer.unobserve(rowElement);
      });
      observer.disconnect();
    };
  }, [data, periodHeaders, expandedItems, onActiveHierarchyChange, headerHeight]); // Re-observe if data/structure changes
  
  
  const renderSubSection = (
    parentId: string, 
    subSectionTitle: string, 
    metrics: MetricDefinition[], 
    item: CapacityDataRow, 
    level: number
  ) => {
    const subSectionId = `${parentId}_${subSectionTitle.replace(/\s+/g, '')}`;
    const isSubSectionExpanded = expandedItems[subSectionId] || false;
    const rows: React.ReactNode[] = [];

    rows.push(
      <TableRow key={subSectionId + "_header"} className="hover:bg-muted/30 bg-muted/20">
        <TableCell 
          className="sticky left-0 z-25 bg-muted/20 font-medium text-foreground whitespace-nowrap py-2 border-r border-border/50"
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
        >
          <button
            onClick={() => toggleExpand(subSectionId)}
            className="w-full text-left flex items-center gap-2 text-sm"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isSubSectionExpanded ? "rotate-180" : ""}`} />
            {subSectionTitle}
          </button>
        </TableCell>
        {periodHeaders.map(ph => <TableCell key={`${subSectionId}_${ph}_placeholder`} className="py-2 px-2 min-w-[100px] border-l border-border/50"></TableCell>)}
      </TableRow>
    );

    if (isSubSectionExpanded) {
      metrics.forEach(metricDef => {
        rows.push(
          <MetricRow
            key={`${parentId}-${metricDef.key}`}
            item={item}
            metricDef={metricDef}
            level={level + 1} 
            periodHeaders={periodHeaders}
            onTeamMetricChange={onTeamMetricChange}
            onLobMetricChange={onLobMetricChange}
            editingCell={editingCell}
            onSetEditingCell={onSetEditingCell}
            selectedTimeInterval={selectedTimeInterval}
          />
        );
      });
    }
    return rows;
  };
  
  const renderCapacityItemContent = useCallback((item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    
    if (item.itemType === 'Team') {
      const primaryHcMetrics = teamMetricDefinitions.filter(def => def.category === 'PrimaryHC');
      primaryHcMetrics.forEach(metricDef => {
        rows.push(
          <MetricRow
            key={`${item.id}-${metricDef.key}`}
            item={item}
            metricDef={metricDef}
            level={item.level + 1}
            periodHeaders={periodHeaders}
            onTeamMetricChange={onTeamMetricChange}
            onLobMetricChange={onLobMetricChange}
            editingCell={editingCell}
            onSetEditingCell={onSetEditingCell}
            selectedTimeInterval={selectedTimeInterval}
          />
        );
      });

      const assumptionMetrics = teamMetricDefinitions.filter(def => def.category === 'Assumption');
      rows.push(...renderSubSection(item.id, "Assumptions", assumptionMetrics, item, item.level + 1));
      
      const adjustmentMetrics = teamMetricDefinitions.filter(def => def.category === 'HCAdjustment');
      rows.push(...renderSubSection(item.id, "HC Adjustments", adjustmentMetrics, item, item.level + 1));

    } else { // BU or LOB
      aggregatedMetricDefinitions.forEach(metricDef => {
        if (item.itemType === 'BU' && (metricDef.key === 'lobTotalBaseRequiredMinutes' || metricDef.key === 'lobVolumeForecast' || metricDef.key === 'lobAverageAHT')) {
           return; 
        }
        rows.push(
          <MetricRow
            key={`${item.id}-${metricDef.key}`}
            item={item}
            metricDef={metricDef}
            level={item.level + 1} 
            periodHeaders={periodHeaders}
            onTeamMetricChange={onTeamMetricChange}
            onLobMetricChange={onLobMetricChange}
            editingCell={editingCell}
            onSetEditingCell={onSetEditingCell}
            selectedTimeInterval={selectedTimeInterval}
          />
        );
      });
    }
    return rows;
  }, [periodHeaders, teamMetricDefinitions, aggregatedMetricDefinitions, onTeamMetricChange, onLobMetricChange, editingCell, onSetEditingCell, selectedTimeInterval, expandedItems, toggleExpand]);

  const renderTableItem = useCallback((item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;

    let isExpandable = (item.children && item.children.length > 0) || item.itemType === 'Team';

    let rowSpecificBgClass = 'bg-card'; // Default for team metric rows (no special bg for them)
    let buttonTextClass = 'text-foreground';
    let itemZIndex = 20; 

    if (item.itemType === 'BU') {
      rowSpecificBgClass = 'bg-secondary';
      buttonTextClass = 'text-secondary-foreground';
      itemZIndex = 35;
    } else if (item.itemType === 'LOB') {
      rowSpecificBgClass = 'bg-muted';
      buttonTextClass = 'text-muted-foreground';
      itemZIndex = 30;
    } else if (item.itemType === 'Team') { 
      rowSpecificBgClass = 'bg-muted/50';
      buttonTextClass = 'text-foreground';
      itemZIndex = 25;
    }

    const hoverClass = item.itemType === 'BU' ? 'hover:bg-secondary/90' 
                      : item.itemType === 'LOB' ? 'hover:bg-muted/80'
                      : 'hover:bg-muted/60'; // Team header row

    rows.push(
      <TableRow
        key={`${item.id}-name`}
        className={cn(rowSpecificBgClass, hoverClass)}
        ref={el => { if (el) itemNameRowRefs.current.set(item.id, el); else itemNameRowRefs.current.delete(item.id); }}
        data-item-id={item.id}
        data-item-name={item.name}
        data-item-type={item.itemType}
      >
        <TableCell
          className={cn(
            "p-0 sticky left-0 whitespace-nowrap border-r border-border/50",
            rowSpecificBgClass 
          )}
          style={{ zIndex: itemZIndex }}
        >
          <button
            onClick={isExpandable ? () => toggleExpand(item.id) : undefined}
            disabled={!isExpandable}
            className={cn(
              "py-3 px-2 font-semibold hover:no-underline w-full text-left flex items-center gap-2", 
              buttonTextClass
            )}
            aria-expanded={isExpandable ? isExpanded : undefined}
            style={{ paddingLeft: `${item.level * 1.5 + (isExpandable ? 0.5 : 1.5)}rem` }} 
          >
            {isExpandable && ( 
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            )}
            {item.name}
          </button>
        </TableCell>
        {periodHeaders.map((ph) => (
          <TableCell
            key={`${item.id}-${ph}-nameplaceholder`}
            className={cn(rowSpecificBgClass, 'py-3 px-2 min-w-[100px] border-l border-border/50')} 
          ></TableCell>
        ))}
      </TableRow>
    );

    if (isExpanded) {
      if (item.itemType === 'Team') { 
        const teamMetricRows = renderCapacityItemContent(item);
        rows.push(...teamMetricRows);
      } else if (item.children && item.children.length > 0) { 
        const aggregatedMetricRows = renderCapacityItemContent(item);
        rows.push(...aggregatedMetricRows);
        item.children.forEach(child => {
          rows.push(...renderTableItem(child)); 
        });
      } else if (item.itemType !== 'Team') { 
        const itemMetricRows = renderCapacityItemContent(item);
        rows.push(...itemMetricRows);
      }
    } else if (!isExpandable && (item.itemType === 'BU' || item.itemType === 'LOB')) { 
      const itemMetricRows = renderCapacityItemContent(item);
      rows.push(...itemMetricRows);
    }
    return rows;
  }, [expandedItems, periodHeaders, toggleExpand, renderCapacityItemContent, teamMetricDefinitions, aggregatedMetricDefinitions]);


  return (
    <TooltipProvider delayDuration={300}>
      <div ref={tableBodyScrollRef} className="overflow-x-auto relative">
        <Table className="min-w-full">
          {/* TableHeader is removed as it's now part of HeaderSection */}
          <TableBody>
            {data.length > 0 ? (
              data.flatMap(item => renderTableItem(item))
            ) : (
              <TableRow>
                <TableCell colSpan={periodHeaders.length + 1} className="text-center text-muted-foreground h-24">
                  No data available for the current selection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
CapacityTableComponent.displayName = 'CapacityTableComponent';
const CapacityTable = React.memo(CapacityTableComponent);
// --- END CapacityTable COMPONENT ---

// --- MAIN PAGE COMPONENT ---
export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
  
  const defaultWFSLoBs = ["Inventory Management", "Customer Returns", "Help Desk"];
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>(() => {
    const initialBuLobs = BUSINESS_UNIT_CONFIG["WFS"].lonsOfBusiness;
    return defaultWFSLoBs.filter(lob => initialBuLobs.includes(lob as LineOfBusinessName<"WFS">));
  });

  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week", ALL_WEEKS_HEADERS));
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(() => ({
      businessUnits: [...ALL_BUSINESS_UNITS],
      linesOfBusiness: [...BUSINESS_UNIT_CONFIG["WFS"].lonsOfBusiness],
  }));
  
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  const [editingCell, setEditingCell] = useState<{ id: string; period: string; metricKey: string } | null>(null);

  const [activeHierarchyContext, setActiveHierarchyContext] = useState<string>("BU / LoB / Team / Metric");
  const headerPeriodScrollerRef = useRef<HTMLDivElement>(null);
  const tableBodyScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleActiveHierarchyChange = useCallback((newContext: string | null) => { 
    setActiveHierarchyContext(newContext || "BU / LoB / Team / Metric"); 
  }, []);


  const handleSetEditingCell = useCallback((id: string | null, period: string | null, metricKey: string | null) => {
    if (id && period && metricKey) {
      setEditingCell({ id, period, metricKey });
    } else {
      setEditingCell(null);
    }
  }, []);

  const handleTeamMetricChange = useCallback((
    lobId: string,
    teamNameToUpdate: TeamName,
    periodHeader: string,
    metricKey: keyof TeamPeriodicMetrics,
    rawValue: string 
  ) => {
    const newValueParsed = rawValue === "" || rawValue === "-" ? null : parseFloat(rawValue);
     if (rawValue !== "" && rawValue !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null) {
        console.warn("Invalid number for metric change:", rawValue);
        return; 
    }
    const newValue = newValueParsed;

    setRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntryIndex = newData.findIndex(lob => lob.id === lobId);
      if (lobEntryIndex === -1) return prevRawData;

      const lobEntry = newData[lobEntryIndex];
      const teamEntryIndex = lobEntry.teams.findIndex(team => team.teamName === teamNameToUpdate);
      if (teamEntryIndex === -1) return prevRawData;
      
      const teamEntry = lobEntry.teams[teamEntryIndex];

      if (!teamEntry.periodicInputData) {
        teamEntry.periodicInputData = {};
      }
      if (!teamEntry.periodicInputData[periodHeader]) {
        teamEntry.periodicInputData[periodHeader] = { /* Initialize with all nulls if needed */ };
      }
      
      (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = newValue;

      if (metricKey === 'volumeMixPercentage') {
        const updatedTeamMix = Math.max(0, Math.min(100, newValue === null ? 0 : newValue as number));
        (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = updatedTeamMix; 

        const otherTeams = lobEntry.teams.filter(t => t.teamName !== teamNameToUpdate);
        const currentTotalMixOfOtherTeams = otherTeams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        }, 0);

        const remainingMixPercentage = 100 - updatedTeamMix;

        if (otherTeams.length > 0) {
          if (Math.abs(currentTotalMixOfOtherTeams) > 0.001) { 
            let distributedSum = 0;
            for (let i = 0; i < otherTeams.length; i++) {
              const team = otherTeams[i];
              const teamPeriodData = team.periodicInputData[periodHeader];
              if (!teamPeriodData) team.periodicInputData[periodHeader] = {};

              const originalShareOfOthers = (teamPeriodData?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShareOfOthers;
              
              if (i === otherTeams.length - 1 ) { 
                newShare = remainingMixPercentage - distributedSum; 
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1)) ) );
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
          } else { 
            const mixPerOtherTeam = otherTeams.length > 0 ? parseFloat((remainingMixPercentage / otherTeams.length).toFixed(1)) : 0;
            let distributedSum = 0;
            otherTeams.forEach((team, i) => {
              if (!team.periodicInputData[periodHeader]) team.periodicInputData[periodHeader] = {};
              let currentMix = mixPerOtherTeam;
              if (i === otherTeams.length -1) { 
                  currentMix = remainingMixPercentage - distributedSum;
              }
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(currentMix.toFixed(1)) ));
              distributedSum += parseFloat(currentMix.toFixed(1));
            });
          }
        }
        let finalSum = lobEntry.teams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        },0);

        if (Math.abs(finalSum - 100) > 0.01 && lobEntry.teams.length > 0) { 
            const diff = 100 - finalSum;
            let teamToAdjust = lobEntry.teams.find(t => t.teamName === teamNameToUpdate) || 
                               lobEntry.teams.reduce((prev, curr) => 
                                ( (prev.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0) > (curr.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0) ? prev : curr), lobEntry.teams[0]);
             if (!teamToAdjust.periodicInputData[periodHeader]) { 
                teamToAdjust.periodicInputData[periodHeader] = {};
              }
            const currentMixToAdjust = (teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage ?? 0;
            (teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage =
                Math.max(0, Math.min(100, parseFloat( (currentMixToAdjust + diff).toFixed(1) ) ));
        }
      }
      return newData;
    });
  }, []);
  
  const handleLobMetricChange = useCallback((
    lobId: string,
    periodHeader: string,
    metricKey: 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes',
    rawValue: string 
  ) => {
    const newValueParsed = rawValue === "" || rawValue === "-" ? null : parseFloat(rawValue);
     if (rawValue !== "" && rawValue !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null) {
        console.warn("Invalid number for LOB metric change:", rawValue);
        return; 
    }
    const newValue = newValueParsed;

    setRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntry = newData.find(lob => lob.id === lobId);
      if (!lobEntry) return prevRawData;

      if (metricKey === 'lobVolumeForecast' || metricKey === 'lobAverageAHT') {
        if (!lobEntry[metricKey]) { // Initialize if undefined
          (lobEntry as any)[metricKey] = {};
        }
        (lobEntry[metricKey] as any)[periodHeader] = newValue;
        
        // Recalculate lobTotalBaseRequiredMinutes
        const volume = lobEntry.lobVolumeForecast?.[periodHeader];
        const aht = lobEntry.lobAverageAHT?.[periodHeader];
        if (typeof volume === 'number' && volume > 0 && typeof aht === 'number' && aht > 0) {
          if (!lobEntry.lobTotalBaseRequiredMinutes) lobEntry.lobTotalBaseRequiredMinutes = {};
          lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = volume * aht;
        } else if (volume === null || aht === null || volume === 0 || aht === 0) { // If inputs are cleared or zero, clear calculated total
            if (!lobEntry.lobTotalBaseRequiredMinutes) lobEntry.lobTotalBaseRequiredMinutes = {};
            lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = null; // Or 0, depending on desired behavior
        }
         // If one is valid and other is not, lobTotalBaseRequiredMinutes remains unchanged from direct input or previous calc
      } else if (metricKey === 'lobTotalBaseRequiredMinutes') {
        if (!lobEntry.lobTotalBaseRequiredMinutes) {
          lobEntry.lobTotalBaseRequiredMinutes = {};
        }
        lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = newValue;
      }
      
      return newData;
    });
  }, []);

  const handleBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedBusinessUnit(bu);
    // Default LOB selection logic is handled in the useEffect below
  }, []); 

  const handleLOBChange = useCallback((lobs: string[]) => {
      setSelectedLineOfBusiness(lobs);
  }, []);
  
  const handleTimeIntervalChange = useCallback((interval: TimeInterval) => {
    setSelectedTimeInterval(interval);
    const newHeaders = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    setSelectedDateRange(getDefaultDateRange(interval, newHeaders)); 
  }, []);

  useEffect(() => {
    const newBuConfig = BUSINESS_UNIT_CONFIG[selectedBusinessUnit];
    const allLobsForNewBu = [...newBuConfig.lonsOfBusiness];
    let newDefaultSelectedLobs: string[];

    if (selectedBusinessUnit === "WFS") {
        newDefaultSelectedLobs = defaultWFSLoBs.filter(lob => 
            allLobsForNewBu.includes(lob as LineOfBusinessName<"WFS">)
        );
    } else {
        newDefaultSelectedLobs = [...allLobsForNewBu];
    }
    
    setSelectedLineOfBusiness(currentSelectedLobs => {
      // Only update if the BU change *actually* changes the default LOB set.
      // This preserves user's specific LOB selections if they switch BU then switch back,
      // unless the new BU has a different default set.
      const currentSorted = [...currentSelectedLobs].sort().join(',');
      const newDefaultSorted = [...newDefaultSelectedLobs].sort().join(',');
      
      const isDifferentBuWithDifferentDefaults = 
        !currentSelectedLobs.every(lob => allLobsForNewBu.includes(lob)) || // some current lobs not in new BU
        currentSelectedLobs.length !== newDefaultSelectedLobs.length || // different number of default lobs
        currentSorted !== newDefaultSorted; // content of default lobs is different


      if (isDifferentBuWithDifferentDefaults) {
        return newDefaultSelectedLobs;
      }
      return currentSelectedLobs;
    });

    setFilterOptions(prev => {
        const updatedFO = { ...prev, businessUnits: [...ALL_BUSINESS_UNITS], linesOfBusiness: [...newBuConfig.lonsOfBusiness] };
        const prevLobsSorted = [...(prev.linesOfBusiness || [])].sort();
        const updatedLobsSorted = [...updatedFO.linesOfBusiness].sort();
        if (JSON.stringify(prevLobsSorted) !== JSON.stringify(updatedLobsSorted)) {
            return updatedFO;
        }
        return prev;
    });
  }, [selectedBusinessUnit, defaultWFSLoBs]); 


  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    let periodsToUse: string[] = [];

    if (selectedTimeInterval === "Week" && selectedDateRange?.from) {
      const userRangeStart = selectedDateRange.from;
      const userRangeEnd = selectedDateRange.to || userRangeStart; 

      periodsToUse = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        
        return isAfter(periodEndDate, addDays(userRangeStart, -1)) && isBefore(periodStartDate, addDays(userRangeEnd, 1));
      });
    } else if (selectedTimeInterval === "Month" && selectedDateRange?.from) {
        const userRangeStart = startOfMonth(selectedDateRange.from);
        const userRangeEnd = selectedDateRange.to ? endOfMonth(selectedDateRange.to) : endOfMonth(userRangeStart);

        periodsToUse = sourcePeriods.filter(periodHeaderStr => {
            const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
            if (!periodStartDate || !periodEndDate) return false;
            return isAfter(periodEndDate, addDays(userRangeStart, -1)) && isBefore(periodStartDate, addDays(userRangeEnd, 1));
        });
    } else { // Fallback if no date range selected, though UI should enforce selection
      periodsToUse = sourcePeriods.slice(0, NUM_PERIODS_DISPLAYED);
    }
    
    setDisplayedPeriodHeaders(periodsToUse);

    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;
    const newDisplayData: CapacityDataRow[] = [];
    const buName = selectedBusinessUnit; 

    const relevantRawLobEntriesForSelectedBu = rawCapacityDataSource.filter(d => d.bu === buName);
    if (relevantRawLobEntriesForSelectedBu.length === 0) {
        setDisplayableCapacityData([]);
        return;
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    
    const lobsToProcess = selectedLineOfBusiness.length > 0 
        ? relevantRawLobEntriesForSelectedBu.filter(lobEntry => selectedLineOfBusiness.includes(lobEntry.lob))
        : relevantRawLobEntriesForSelectedBu;


    lobsToProcess.forEach(lobRawEntry => {
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        const teamsToProcess = lobRawEntry.teams || []; // No team filter from header anymore

        const lobCalculatedBaseRequiredMinutes: Record<string, number | null> = {};
        periodsToUse.forEach(period => {
            const volume = lobRawEntry.lobVolumeForecast?.[period];
            const avgAHT = lobRawEntry.lobAverageAHT?.[period];
            if (typeof volume === 'number' && volume > 0 && typeof avgAHT === 'number' && avgAHT > 0) {
                lobCalculatedBaseRequiredMinutes[period] = volume * avgAHT;
            } else {
                lobCalculatedBaseRequiredMinutes[period] = lobRawEntry.lobTotalBaseRequiredMinutes?.[period] ?? 0; 
            }
        });
        
        teamsToProcess.forEach(teamRawEntry => {
            const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
            periodsToUse.forEach(period => {
              periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
                teamRawEntry.periodicInputData[period] || {},
                lobCalculatedBaseRequiredMinutes[period], 
                standardWorkMinutes
              );
            });
            childrenTeamsDataRows.push({
              id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`,
              name: teamRawEntry.teamName,
              level: 2, 
              itemType: 'Team',
              periodicData: periodicTeamMetrics,
              lobId: lobRawEntry.id, 
            });
        });
        
        const lobPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
        periodsToUse.forEach(period => {
            let reqHcSum = 0;
            let actHcSum = 0; 

            childrenTeamsDataRows.forEach(teamRow => { 
                const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                if (teamPeriodMetric) {
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0; 
                }
            });
            const overUnderHCSum = (actHcSum !== null && reqHcSum !== null) ? actHcSum - reqHcSum : null;

            lobPeriodicData[period] = {
                lobVolumeForecast: lobRawEntry.lobVolumeForecast?.[period] ?? null,
                lobAverageAHT: lobRawEntry.lobAverageAHT?.[period] ?? null,
                lobTotalBaseRequiredMinutes: lobCalculatedBaseRequiredMinutes[period] ?? null, 
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: overUnderHCSum,
            };
        });
        childrenLobsDataRows.push({
          id: lobRawEntry.id,
          name: lobRawEntry.lob,
          level: 1, 
          itemType: 'LOB',
          periodicData: lobPeriodicData,
          children: childrenTeamsDataRows,
        });
    });

    if (childrenLobsDataRows.length > 0 ) { 
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToUse.forEach(period => {
        let reqHcSum = 0;
        let actHcSum = 0;
        // Note: LOB Total Base Required Minutes are not summed at BU level, each LOB has its own.
        childrenLobsDataRows.forEach(lobRow => { 
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
              }
        });
        const overUnderHCSum = (actHcSum !== null && reqHcSum !== null) ? actHcSum - reqHcSum : null;

        buPeriodicData[period] = {
            // lobTotalBaseRequiredMinutes: null, // Not applicable at BU level as sum
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: overUnderHCSum,
        };
      });
      newDisplayData.push({
        id: buName, 
        name: buName,
        level: 0, 
        itemType: 'BU',
        periodicData: buPeriodicData,
        children: childrenLobsDataRows,
      });
    }
    setDisplayableCapacityData(newDisplayData);

  }, [
      selectedBusinessUnit, 
      selectedLineOfBusiness, 
      selectedTimeInterval, 
      selectedDateRange,
      rawCapacityDataSource, 
    ]);

  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    const headerScroller = headerPeriodScrollerRef.current;
    const bodyScroller = tableBodyScrollRef.current;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      target.scrollLeft = source.scrollLeft;
      // Reset after a short delay to allow the other scroller to react
      setTimeout(() => { isSyncingScroll.current = false; }, 50);
    };

    const handleHeaderScroll = () => {
      if (headerScroller && bodyScroller) syncScroll(headerScroller, bodyScroller);
    };
    const handleBodyScroll = () => {
      if (bodyScroller && headerScroller) syncScroll(bodyScroller, headerScroller);
    };

    headerScroller?.addEventListener('scroll', handleHeaderScroll);
    bodyScroller?.addEventListener('scroll', handleBodyScroll);

    return () => {
      headerScroller?.removeEventListener('scroll', handleHeaderScroll);
      bodyScroller?.removeEventListener('scroll', handleBodyScroll);
    };
  }, []); // Empty dependency array: refs should be stable after initial render

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={handleBusinessUnitChange}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={handleLOBChange}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={handleTimeIntervalChange}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
        allAvailablePeriods={selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS}
        displayedPeriodHeaders={displayedPeriodHeaders}
        activeHierarchyContext={activeHierarchyContext}
        headerPeriodScrollerRef={headerPeriodScrollerRef}
      />
      <main className="flex-grow overflow-auto p-4 pt-0"> 
        <CapacityTable
          data={displayableCapacityData}
          periodHeaders={displayedPeriodHeaders}
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          teamMetricDefinitions={TEAM_METRIC_ROW_DEFINITIONS}
          aggregatedMetricDefinitions={AGGREGATED_METRIC_ROW_DEFINITIONS} 
          onTeamMetricChange={handleTeamMetricChange}
          onLobMetricChange={handleLobMetricChange}
          editingCell={editingCell}
          onSetEditingCell={handleSetEditingCell}
          selectedTimeInterval={selectedTimeInterval}
          onActiveHierarchyChange={handleActiveHierarchyChange}
          tableBodyScrollRef={tableBodyScrollRef}
        />
      </main>
    </div>
  );
}
