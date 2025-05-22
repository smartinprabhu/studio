
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  isSameDay
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

const formatDatePartUTC = (date: Date): string => 
  `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCDate().toString().padStart(2, '0')}`;

const generateFiscalWeekHeaders = (startFiscalYear: number, numTotalWeeks: number): string[] => {
  const headers: string[] = [];
  
  let currentYear = startFiscalYear;
  let fiscalYearActualStartDate: Date;

  // Determine the start date of the fiscal year
  if (isLeapYear(currentYear)) {
    const feb1st = new Date(Date.UTC(currentYear, 1, 1)); // February is month 1
    let dayOfWeek = feb1st.getUTCDay(); // Sunday is 0, Monday is 1
    // Adjust so Monday is the target: if Feb 1st is Sunday (0), move to Feb 2nd. If Saturday (6), move to Feb 3rd.
    // We want the Monday of the week containing Feb 1st.
    // startOfWeek(date, {weekStartsOn: 1})
    fiscalYearActualStartDate = startOfWeek(feb1st, { weekStartsOn: 1 });
  } else {
    const jan22nd = new Date(Date.UTC(currentYear, 0, 22)); // January is month 0
    fiscalYearActualStartDate = startOfWeek(jan22nd, { weekStartsOn: 1 });
  }

  for (let i = 0; i < numTotalWeeks; i++) {
    const weekStartDate = new Date(fiscalYearActualStartDate);
    weekStartDate.setUTCDate(fiscalYearActualStartDate.getUTCDate() + i * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
    
    const displayYearForHeader = weekStartDate.getUTCFullYear();

    headers.push(
      `FWk${i + 1}: ${formatDatePartUTC(weekStartDate)}-${formatDatePartUTC(weekEndDate)} (${displayYearForHeader})`
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
  
  _productivity: number | null; 

  _calculatedRequiredAgentMinutes?: number | null; 
  _calculatedActualProductiveAgentMinutes?: number | null; 
  attritionLossHC?: number | null; 
  hcAfterAttrition?: number | null; 
  endingHC?: number | null; 
}

export interface AggregatedPeriodicMetrics extends BaseHCValues {
  lobTotalBaseRequiredMinutes?: number | null;
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
    category?: 'PrimaryHC' | 'CalculatedHC' | 'Assumption' | 'HCAdjustment' | 'Internal';
    description?: string;
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];

export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  // Primary HC - Top Level under Team
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC' },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC' }, 
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC' },
  
  // Assumptions - Under "Assumptions" expander
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Average Handle Time: The average time taken to handle one interaction." },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Shrinkage: Percentage of paid time that agents are not available for handling interactions (e.g., breaks, training, meetings)." },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Occupancy: Percentage of time agents are busy with interaction-related work during their available time." },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Backlog: Percentage of additional work (e.g., deferred tasks) that needs to be handled on top of forecasted volume." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },
  
  // HC Adjustments - Under "HC Adjustments" expander
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment' },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment' },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment' },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment' },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment' }, 
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment' }, 
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment' }, 

  // Internal Calculations - (Typically not displayed directly as rows in this structure, but useful for tooltips)
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal' }, 
  { key: "_calculatedActualProductiveAgentMinutes", label: "Actual Prod. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal' }, 
];


export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: "requiredHC", label: "Required HC", isHC: true },
  { key: "actualHC", label: "Actual HC", isHC: true }, 
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
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
}


export interface RawTeamDataEntry {
  teamName: TeamName;
  periodicInputData: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>>;
}

export interface RawLoBCapacityEntry {
  id: string; 
  bu: BusinessUnitName;
  lob: LineOfBusinessName<BusinessUnitName>;
  lobVolumeForecast: Record<string, number | null>; 
  lobAverageAHT: Record<string, number | null>;  
  lobTotalBaseRequiredMinutes?: Record<string, number | null>; // Will be calculated if forecast & AHT are present
  teams: RawTeamDataEntry[];
}

export interface CapacityDataRow {
  id: string;
  name: string;
  level: number; 
  itemType: 'BU' | 'LOB' | 'Team';
  periodicData: Record<string, AggregatedPeriodicMetrics | TeamPeriodicMetrics>;
  children?: CapacityDataRow[];
  lobId?: string; // For teams, to link back to LOB for editing context
}
// --- END CONSOLIDATED TYPES ---

// --- BEGIN CONSOLIDATED DATA ---
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS; 

const generateTeamPeriodicInputData = (periods: string[], teamIndex: number, totalTeams: number): Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>> => {
  const metrics: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>> = {};
  
  let initialMix = totalTeams > 0 ? parseFloat((100 / totalTeams).toFixed(1)) : 0;
  if (totalTeams === 3) { 
      initialMix = 33.3;
  }
  let sumOfMix = 0;
  const mixes = Array(totalTeams).fill(0).map((_, idx) => {
      if (idx === totalTeams - 1) { 
          return Math.max(0, parseFloat((100 - sumOfMix).toFixed(1)));
      }
      const currentMix = initialMix;
      sumOfMix += currentMix;
      return currentMix;
  });

   const finalSumCheck = mixes.reduce((acc, curr) => acc + curr, 0);
   if (Math.abs(finalSumCheck - 100) > 0.01 && totalTeams > 0 && mixes.length > 0) {
       const diff = 100 - finalSumCheck;
       mixes[mixes.length - 1] = parseFloat((mixes[mixes.length-1] + diff).toFixed(1));
       if (mixes[mixes.length - 1] < 0 && mixes.length > 1) {
          let diffToRedistribute = mixes[mixes.length - 1];
          mixes[mixes.length - 1] = 0;
          for(let i = 0; i < mixes.length -1; i++) {
            if (diffToRedistribute >=0) break;
            let take = Math.min(mixes[i], Math.abs(diffToRedistribute));
            mixes[i] = parseFloat((mixes[i] - take).toFixed(1));
            diffToRedistribute += take;
          }
       }
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
      _productivity: Math.floor(Math.random() * 5) + 5, 
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
  const aht: Record<string, number | null> = {};
  const baseReqMins: Record<string, number | null> = {};
  periods.forEach(period => {
    const currentVolume = Math.floor(Math.random() * 10000) + 2000; 
    const currentAHT = Math.floor(Math.random() * 10) + 5; 
    volume[period] = currentVolume;
    aht[period] = currentAHT;
    baseReqMins[period] = currentVolume * currentAHT; // This will be recalculated if volume/aht are present
  });
  return { volume, aht, baseReqMins };
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
      lobTotalBaseRequiredMinutes: lobInputs.baseReqMins, // Store generated, but prefer calc from vol*aht
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
    moveOut: null, newHireBatch: null, newHireProduction: null, _productivity: null, 
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


const parseDateFromHeaderStringMMDD = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;
  
  // Create date in UTC to avoid timezone issues with parsing
  const parsedDate = new Date(Date.UTC(parseInt(year), month - 1, day)); 
  
  // Validate the parsed date components (month is 0-indexed in Date object)
  if (parsedDate.getUTCFullYear() !== parseInt(year) || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    // console.warn(`Date parsing mismatch for ${dateMMDD}/${year}. Expected ${month-1}/${day}/${year}, got ${parsedDate.getUTCMonth()}/${parsedDate.getUTCDate()}/${parsedDate.getUTCFullYear()}`);
    return null; // Invalid date components after parsing (e.g., Feb 30)
  }
  return parsedDate;
};


const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (interval === "Week") {
    const match = header.match(/FWk\d+:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
    if (match) {
      const [, startDateStr, endDateStr, yearStr] = match;
      
      let parsedStartDate = parseDateFromHeaderStringMMDD(startDateStr, yearStr);
      let parsedEndDate = parseDateFromHeaderStringMMDD(endDateStr, yearStr);

      // Handle year crossover for the end date
      if (parsedStartDate && parsedEndDate && isBefore(parsedEndDate, parsedStartDate)) {
         // This means the end date is likely in the next year
         const nextYearStr = (parseInt(yearStr) + 1).toString();
         const potentialEndDateNextYear = parseDateFromHeaderStringMMDD(endDateStr, nextYearStr);
         if (potentialEndDateNextYear && isAfter(potentialEndDateNextYear, parsedStartDate)) {
            parsedEndDate = potentialEndDateNextYear;
         } else { 
            // This case is less likely with fiscal weeks but could happen with odd date formats
            // console.warn(`End date ${endDateStr}/${yearStr} seems to be before start date ${startDateStr}/${yearStr} and next year adjustment failed.`);
            // Fallback: try previous year for start date if end date year is current, start date month is december and end date month is january
            const startMonth = parseInt(startDateStr.split('/')[0]);
            const endMonth = parseInt(endDateStr.split('/')[0]);
            if (startMonth === 12 && endMonth === 1) {
                const prevYearStr = (parseInt(yearStr) -1).toString();
                const potentialStartDatePrevYear = parseDateFromHeaderStringMMDD(startDateStr, prevYearStr);
                if(potentialStartDatePrevYear && isBefore(potentialStartDatePrevYear, parsedEndDate)) {
                    parsedStartDate = potentialStartDatePrevYear;
                }
            }
         }
      }
      return { startDate: parsedStartDate, endDate: parsedEndDate };
    }
  } else if (interval === "Month") {
    try {
      // For "Month YYYY" format, we can parse it more directly
      // Note: date-fns parse might be locale-sensitive. Using specific new Date for robustness.
      const date = dateParseFns(header, "MMMM yyyy", new Date()); 
      if (!isNaN(date.getTime())) { // Check if date is valid
        const yearVal = getYear(date); // From date-fns
        const monthVal = getMonth(date); // From date-fns (0-indexed)
        const firstDay = startOfMonth(new Date(yearVal, monthVal));
        const lastDay = endOfMonth(new Date(yearVal, monthVal));
        return { startDate: firstDay, endDate: lastDay };
      }
    } catch (e) {
        // console.warn(`Could not parse month header: ${header}`, e);
    }
  }
  // console.warn(`Could not parse header: ${header} for interval ${interval}`);
  return { startDate: null, endDate: null };
};

const getDefaultDateRange = (interval: TimeInterval): DateRange => {
  const headers = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
  // Default to showing a smaller number of periods initially, e.g., 12 weeks or 3 months
  const numPeriodsToDefault = interval === "Week" ? 11 : 2; // 0-indexed, so 11 means 12 weeks, 2 means 3 months

  if (headers.length === 0) return { from: undefined, to: undefined };

  const fromHeaderDetails = getHeaderDateRange(headers[0], interval);
  // Ensure toHeaderIndex doesn't go out of bounds
  const toHeaderIndex = Math.min(numPeriodsToDefault, headers.length - 1);
  const toHeaderDetails = getHeaderDateRange(headers[toHeaderIndex], interval);
  
  let fromDate = fromHeaderDetails.startDate;
  let toDate = toHeaderDetails.endDate;
  
  // If for some reason parsing failed, default to current day or a safe fallback
  if (!fromDate) fromDate = new Date();
  if (!toDate) toDate = interval === "Week" ? endOfWeek(addWeeks(fromDate, 11)) : endOfMonth(addDays(startOfMonth(fromDate), 60)); // Roughly 12 weeks or 2-3 months

  return { from: fromDate ?? undefined, to: toDate ?? undefined };
};

const findFiscalWeekHeaderForDate = (targetDate: Date, allFiscalHeaders: string[]): string | null => {
  if (!targetDate) return null;
  for (const header of allFiscalHeaders) {
    const { startDate, endDate } = getHeaderDateRange(header, "Week");
    if (startDate && endDate) {
      // Compare only date parts, ignoring time, using UTC to be safe
      const targetDayOnly = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
      const sDateOnly = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      const eDateOnly = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
      
      if (targetDayOnly >= sDateOnly && targetDayOnly <= eDateOnly) {
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
      historicalCapacityData: "LoB,Date,CapacityUsed,RequiredCapacity\nSales,FWk1: 01/22-01/28 (2024),100,120\nSupport,FWk1: 01/22-01/28 (2024),80,90\nMarketing,FWk1: 01/22-01/28 (2024),50,55",
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
}

function DateRangePicker({ date, onDateChange, className }: DateRangePickerProps) {
  const yearsInHeaders = useMemo(() => 
    [...new Set(ALL_WEEKS_HEADERS.map(h => {
      const match = h.match(/\((\d{4})\)$/);
      return match ? parseInt(match[1]) : 0;
    }).filter(y => y > 0))]
  , []);
  
  const minYear = yearsInHeaders.length > 0 ? Math.min(...yearsInHeaders) : new Date().getFullYear();
  const maxYear = yearsInHeaders.length > 0 ? Math.max(...yearsInHeaders) : new Date().getFullYear() + 1;
  
  const defaultCalendarMonth = date?.from || new Date(minYear, 0, 1);


  let buttonText = "Pick a date range";
  if (date?.from) {
    const fromHeader = findFiscalWeekHeaderForDate(date.from, ALL_WEEKS_HEADERS);
    const fromWeekLabel = fromHeader ? fromHeader.split(':')[0].replace("FWk", "W") : `W${getWeek(date.from, { weekStartsOn: 1 })}`; 
    buttonText = `${fromWeekLabel} (${formatDateFn(date.from, "dd/MM/yyyy")})`;
    if (date.to) {
      const toHeader = findFiscalWeekHeaderForDate(date.to, ALL_WEEKS_HEADERS);
      const toWeekLabel = toHeader ? toHeader.split(':')[0].replace("FWk", "W") : `W${getWeek(date.to, { weekStartsOn: 1 })}`;
      
      if (!isSameDay(date.from, date.to) && fromWeekLabel !== toWeekLabel) { 
           buttonText += ` - ${toWeekLabel} (${formatDateFn(date.to, "dd/MM/yyyy")})`;
      }
    }
  }


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
            <span>{buttonText}</span>
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
      <header className="p-4 border-b border-border bg-background"> 
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

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-x-4 gap-y-2">
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
                    onCheckedChange={(checkedValue) => handleLobSelectionChange(lob, Boolean(checkedValue))}
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

          <div className="flex items-center gap-2 border rounded-md p-1 bg-muted">
            <Button
              variant={selectedTimeInterval === "Week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSelectTimeInterval("Week")}
              className="h-7 px-3"
            >
              Week
            </Button>
            <Button
              variant={selectedTimeInterval === "Month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSelectTimeInterval("Month")}
              className="h-7 px-3"
            >
              Month
            </Button>
          </div>
          <DateRangePicker date={selectedDateRange} onDateChange={onSelectDateRange} />
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
  onLobMetricChange: (lobId: string, periodHeader: string, metricKey: 'lobTotalBaseRequiredMinutes', newValue: string) => void;
  editingCell: { id: string; period: string; metricKey: string } | null;
  onSetEditingCell: (id: string | null, period: string | null, metricKey: string | null) => void;
  selectedTimeInterval: TimeInterval;
  activeHierarchyContext: string;
  onActiveHierarchyChange: (newContext: string | null) => void;
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

  const canEditCell = (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && 
                      (metricDef.category === 'Assumption' || metricDef.category === 'PrimaryHC' || metricDef.category === 'HCAdjustment')) ||
                      (item.itemType === 'LOB' && metricDef.key === 'lobTotalBaseRequiredMinutes' && !metricDef.isDisplayOnly);
  
  useEffect(() => {
    if (isEditing) {
      setTempValue(rawValue === null || rawValue === undefined ? "" : String(rawValue));
      if (inputRef.current) {
        inputRef.current.focus();
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
    const currentVal = tempValue; 
    setTempValue(null); 
    onSetEditingCell(null, null, null); 

    if (currentVal === null || currentVal.trim() === "") { 
        if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && item.lobId && 
            (metricDef.category === 'Assumption' || metricDef.category === 'PrimaryHC' || metricDef.category === 'HCAdjustment')) {
            onTeamMetricChange(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, ""); 
        } else if (item.itemType === 'LOB' && metricDef.key === 'lobTotalBaseRequiredMinutes' && !metricDef.isDisplayOnly) {
            onLobMetricChange(item.id, periodName, metricDef.key as 'lobTotalBaseRequiredMinutes', "");
        }
        return;
    }
    
    const numVal = parseFloat(currentVal);
    if (isNaN(numVal) && metricDef.key !== 'someStringFieldIfAny') { // Allow empty strings to clear, but not invalid numbers for number fields
      return; 
    }

    if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && item.lobId &&
        (metricDef.category === 'Assumption' || metricDef.category === 'PrimaryHC' || metricDef.category === 'HCAdjustment')) {
      onTeamMetricChange(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, currentVal);
    } else if (item.itemType === 'LOB' && metricDef.key === 'lobTotalBaseRequiredMinutes' && !metricDef.isDisplayOnly) {
      onLobMetricChange(item.id, periodName, metricDef.key as 'lobTotalBaseRequiredMinutes', currentVal);
    }
  };

  const handleCancel = () => {
    setTempValue(null);
    onSetEditingCell(null, null, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
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
        className="h-8 w-full max-w-[100px] text-right tabular-nums px-1 py-0.5 text-xs bg-background border-input focus:border-primary focus:ring-1 focus:ring-primary group-hover:border-primary"
        step={metricDef.step || "any"}
        ref={inputRef}
      />
    );
  }

  const isRelevantMetricForAggregated = AGGREGATED_METRIC_ROW_DEFINITIONS.some(def => def.key === metricDef.key);
  const isRelevantMetricForTeam = TEAM_METRIC_ROW_DEFINITIONS.some(def => def.key === metricDef.key && def.category !== 'Internal');
  
  const shouldDisplayMetric = 
      (item.itemType === 'Team' && isRelevantMetricForTeam) ||
      ((item.itemType === 'BU' || item.itemType === 'LOB') && isRelevantMetricForAggregated);

  
  if (item.itemType === 'LOB' && metricDef.key === 'lobTotalBaseRequiredMinutes') {
    return <div className="w-full h-full flex items-center justify-end pr-1"><Minus className="h-4 w-4 text-muted-foreground mx-auto" /></div>;
  }

  if (!shouldDisplayMetric || rawValue === null || rawValue === undefined) {
    const isEditableEmptyCell = canEditCell;
    return <div onClick={isEditableEmptyCell ? handleEditClick : undefined} className={`${isEditableEmptyCell ? 'cursor-pointer group relative' : 'relative'} w-full h-full flex items-center justify-end pr-1`}>
      <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
      {isEditableEmptyCell && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
      </div>;
  }


  let displayValue: React.ReactNode = "";
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let formulaText = "";
  let descriptionText = "";

  const numValue = Number(rawValue);
  const teamMetrics = metricData as TeamPeriodicMetrics;
  const aggMetrics = metricData as AggregatedPeriodicMetrics;
  const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;

  if (metricDef.isPercentage) {
    displayValue = `${numValue.toFixed(1)}%`;
  } else if (metricDef.isTime && metricDef.key === 'aht') { 
    displayValue = `${numValue.toFixed(1)} min`;
  } else if (metricDef.isTime) { 
    displayValue = `${numValue.toFixed(0)} min`;
  } else if (metricDef.isHC || ['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction', 'attritionLossHC', 'endingHC', 'hcAfterAttrition'].includes(metricDef.key as string)) {
    const digits = (['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction'].includes(metricDef.key as string)) ? 0 : 2;
    displayValue = isNaN(numValue) ? '-' : numValue.toFixed(digits);
  } else if (metricDef.key === 'lobTotalBaseRequiredMinutes') { 
     displayValue = `${numValue.toFixed(0)} min`;
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
    const fractionDigits = (['overUnderHC', 'requiredHC', 'actualHC'].includes(metricDef.key as string)) ? 2 : 1;
    displayValue = numValue.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  } else {
    displayValue = String(rawValue);
  }

  let baseTooltipText = `${item.name} - ${periodName}\n${metricDef.label}: ${displayValue}`;

  if (metricDef.description) {
    descriptionText = `Description: ${metricDef.description}`;
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
              const lobEntry = rawCapacityDataSource.find(lob => lob.id === item.lobId); 
              if (lobEntry) {
                const lobVol = lobEntry.lobVolumeForecast?.[periodName];
                const lobAHT = lobEntry.lobAverageAHT?.[periodName];
                let lobTotalBase = 0;
                if (lobVol !== null && lobVol !== undefined && lobAHT !== null && lobAHT !== undefined) {
                  lobTotalBase = lobVol * lobAHT;
                } else if (lobEntry.lobTotalBaseRequiredMinutes?.[periodName] !== null && lobEntry.lobTotalBaseRequiredMinutes?.[periodName] !== undefined) {
                  lobTotalBase = lobEntry.lobTotalBaseRequiredMinutes[periodName]!;
                }

                 formulaText = `Formula: (LOB Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)\n` +
                               `Calc: (${lobTotalBase.toFixed(0)} * ${(metricData.volumeMixPercentage / 100).toFixed(2)}) * (1 + ${(metricData.backlogPercentage / 100).toFixed(2)}) = ${numValue.toFixed(0)}\n`+
                               `Represents team's share of LOB demand, adjusted for team's backlog.`;
              } else {
                 formulaText = `Formula: (LOB Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)\n` +
                                `Represents team's share of LOB demand, adjusted for team's backlog. (LOB data not found for tooltip)`;
              }
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
  } else if (item.itemType === 'LOB' || item.itemType === 'BU') { 
    switch (metricDef.key) {
      case 'overUnderHC':
        if (aggMetrics?.actualHC !== null && aggMetrics?.actualHC !== undefined &&
            aggMetrics?.requiredHC !== null && aggMetrics?.requiredHC !== undefined) {
          formulaText = `Formula: Aggregated Actual HC - Aggregated Required HC\nCalc: ${aggMetrics.actualHC.toFixed(2)} - ${aggMetrics.requiredHC.toFixed(2)} = ${numValue.toFixed(2)}`;
        }
        break;
      case 'requiredHC':
      case 'actualHC':
        if (item.children && item.children.length > 0) {
            const childType = item.itemType === 'BU' ? 'LOBs' : 'Teams';
            const childNames = item.children.map(child => child.name).join(', ');
            if (childNames) {
                formulaText = `Formula: Sum of ${metricDef.label} from child ${childType} (${childNames})`;
            } else {
                 formulaText = `Formula: Sum of ${metricDef.label} from child ${childType}. (No children to sum from).`;
            }
        } else {
            formulaText = `Formula: Sum of ${metricDef.label} from child ${item.itemType === 'BU' ? 'LOBs' : 'Teams'}. (No children found).`;
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
  
  let tooltipContent = baseTooltipText;
  if (descriptionText) {
    tooltipContent += `\n\n${descriptionText}`;
  }
  if (formulaText) {
    tooltipContent += `\n\n${formulaText}`;
  }

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
          onClick={canEditCell && !isEditing ? handleEditClick : undefined} 
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
        className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
      >
        <span className="flex items-center gap-2">
          {metricDef.label}
          {item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && 
           (metricDef.category === 'Assumption' || metricDef.category === 'PrimaryHC' || metricDef.category === 'HCAdjustment') && 
           <Edit3 className="h-3 w-3 text-muted-foreground opacity-50" />}
        </span>
      </TableCell>
      {periodHeaders.map((periodHeader) => {
        const metricForPeriod = item.periodicData[periodHeader];
        let cellTextColor = "text-foreground";
        if (metricDef.key === "overUnderHC" && metricForPeriod && (metricForPeriod as any)[metricDef.key] !== null && (metricForPeriod as any)[metricDef.key] !== undefined) {
            const value = Number((metricForPeriod as any)[metricDef.key]);
            if (value < -0.001) cellTextColor = "text-destructive";
            else if (value > 0.001) cellTextColor = "text-primary"; 
        }
        
        const currentEditId = item.itemType === 'Team' && item.lobId ? `${item.lobId}_${item.name.replace(/\s+/g, '-')}` : item.id;
        const isCurrentlyEditing = 
          editingCell?.id === currentEditId &&
          editingCell?.period === periodHeader &&
          editingCell?.metricKey === metricDef.key;
        
        return (
          <TableCell
            key={`${item.id}-${metricDef.key}-${periodHeader}`}
            className={`text-right tabular-nums ${cellTextColor} py-2 px-2`}
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
  activeHierarchyContext,
  onActiveHierarchyChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableWeekHeaderRef = useRef<HTMLTableSectionElement | null>(null);
  const itemNameRowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());

  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      const visibleEntries = entries.filter(entry => entry.isIntersecting);
      if (visibleEntries.length === 0) {
        onActiveHierarchyChange(null);
        return;
      }

      let topMostVisibleEntry: IntersectionObserverEntry | null = null;
      let minTopValue = Infinity;

      visibleEntries.forEach(entry => {
        const top = entry.boundingClientRect.top;
        if (top < minTopValue) {
          minTopValue = top;
          topMostVisibleEntry = entry;
        }
      });
      
      if (topMostVisibleEntry) {
        const targetElement = topMostVisibleEntry.target as HTMLTableRowElement;
        const itemName = targetElement.dataset.itemName || "Unknown";
        const itemType = targetElement.dataset.itemType || "";
        // Basic context, can be expanded to show full path later
        let contextString = "";
        if (itemType === "BU") contextString = `BU: ${itemName}`;
        else if (itemType === "LOB") contextString = `LOB: ${itemName}`;
        else if (itemType === "Team") contextString = `Team: ${itemName}`;
        else contextString = itemName;
        onActiveHierarchyChange(contextString);
      } else {
        onActiveHierarchyChange(null);
      }
    };

    let observer: IntersectionObserver | null = null;
    const currentScrollContainer = scrollContainerRef.current;
    const currentTableWeekHeader = tableWeekHeaderRef.current;

    if (currentScrollContainer && currentTableWeekHeader) {
      const tableWeekHeaderHeight = currentTableWeekHeader.offsetHeight;
      const options: IntersectionObserverInit = {
        root: currentScrollContainer,
        rootMargin: `-${tableWeekHeaderHeight + 5}px 0px -85% 0px`, // Adjust top margin for sticky header
        threshold: 0.01, // Trigger if even a small part is visible in the "detection zone"
      };
      observer = new IntersectionObserver(observerCallback, options);
      itemNameRowRefs.current.forEach(rowElement => {
        if (rowElement) observer?.observe(rowElement);
      });
    }
    return () => {
      observer?.disconnect();
      itemNameRowRefs.current.forEach(rowElement => {
        if (rowElement) observer?.unobserve(rowElement);
      });
    };
  }, [periodHeaders, data, onActiveHierarchyChange]); // Re-run if data changes, as refs might update


  const renderTeamMetrics = useCallback((item: CapacityDataRow, category: MetricDefinition['category'], baseLevel: number) => {
    return TEAM_METRIC_ROW_DEFINITIONS
      .filter(def => def.category === category)
      .map(metricDef => (
        <MetricRow
          key={`${item.id}-${metricDef.key}`}
          item={item}
          metricDef={metricDef}
          level={baseLevel}
          periodHeaders={periodHeaders}
          onTeamMetricChange={onTeamMetricChange}
          onLobMetricChange={onLobMetricChange}
          editingCell={editingCell}
          onSetEditingCell={onSetEditingCell}
          selectedTimeInterval={selectedTimeInterval}
        />
      ));
  }, [periodHeaders, onTeamMetricChange, onLobMetricChange, editingCell, onSetEditingCell, selectedTimeInterval]);


  const renderCapacityItemContent = useCallback((item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    
    if (item.itemType === 'Team') {
      // Render PrimaryHC and CalculatedHC metrics directly under the Team, not in expanders
      rows.push(...renderTeamMetrics(item, 'PrimaryHC', item.level + 1));
      // Note: CalculatedHC category metrics are moved to HCAdjustment for display purposes based on new req.
      
      const assumptionsKey = `${item.id}_Assumptions`;
      const areAssumptionsExpanded = expandedItems[assumptionsKey] || false;
      rows.push(
        <TableRow key={assumptionsKey + "-header"} className="hover:bg-muted/60">
          <TableCell 
            className="sticky left-0 z-20 bg-card font-semibold text-foreground whitespace-nowrap py-2 cursor-pointer"
            style={{ paddingLeft: `${(item.level + 1) * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
            onClick={() => toggleExpand(assumptionsKey)}
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${areAssumptionsExpanded ? "rotate-180" : ""}`} />
              Assumptions
            </div>
          </TableCell>
          {periodHeaders.map(ph => <TableCell key={`${assumptionsKey}-${ph}-placeholder`} className="py-2"></TableCell>)}
        </TableRow>
      );
      if (areAssumptionsExpanded) {
        rows.push(...renderTeamMetrics(item, 'Assumption', item.level + 2));
      }

      const hcAdjustmentsKey = `${item.id}_HCAdjustments`;
      const areHcAdjustmentsExpanded = expandedItems[hcAdjustmentsKey] || false;
      rows.push(
        <TableRow key={hcAdjustmentsKey + "-header"} className="hover:bg-muted/60">
          <TableCell 
            className="sticky left-0 z-20 bg-card font-semibold text-foreground whitespace-nowrap py-2 cursor-pointer"
            style={{ paddingLeft: `${(item.level + 1) * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
            onClick={() => toggleExpand(hcAdjustmentsKey)}
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${areHcAdjustmentsExpanded ? "rotate-180" : ""}`} />
              HC Adjustments
            </div>
          </TableCell>
          {periodHeaders.map(ph => <TableCell key={`${hcAdjustmentsKey}-${ph}-placeholder`} className="py-2"></TableCell>)}
        </TableRow>
      );
      if (areHcAdjustmentsExpanded) {
        rows.push(...renderTeamMetrics(item, 'HCAdjustment', item.level + 2));
      }

    } else { 
      AGGREGATED_METRIC_ROW_DEFINITIONS.forEach(metricDef => {
        if (item.itemType === 'LOB' && metricDef.key === 'lobTotalBaseRequiredMinutes') { 
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
  }, [periodHeaders, expandedItems, toggleExpand, onTeamMetricChange, onLobMetricChange, editingCell, onSetEditingCell, selectedTimeInterval, renderTeamMetrics]);

  const renderTableItem = useCallback((item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;

    let isItemExpandable = (item.children && item.children.length > 0) || item.itemType === 'Team';

    let rowSpecificBgClass = '';
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

    const hoverClass = item.itemType !== 'BU' ? 'hover:bg-muted/70' : 'hover:bg-secondary/80';

    rows.push(
      <TableRow
        key={`${item.id}-name`}
        className={cn(rowSpecificBgClass, hoverClass)}
        ref={el => { if (el) itemNameRowRefs.current.set(item.id, el); else itemNameRowRefs.current.delete(item.id); }}
        data-item-id={item.id}
        data-item-name={item.name}
        data-item-type={item.itemType}
        data-item-level={item.level}
      >
        <TableCell
          className={cn(
            "p-0 sticky left-0 whitespace-nowrap",
            rowSpecificBgClass || 'bg-card' 
          )}
          style={{
            zIndex: itemZIndex, 
          }}
        >
          <button
            onClick={isItemExpandable ? () => toggleExpand(item.id) : undefined}
            disabled={!isItemExpandable}
            className={cn(
              "py-3 px-2 font-semibold hover:no-underline w-full text-left flex items-center gap-2", 
              buttonTextClass
            )}
            aria-expanded={isItemExpandable ? isExpanded : undefined}
            style={{ paddingLeft: `${item.level * 1.5 + (isItemExpandable ? 0.5 : 1.5)}rem` }} 
          >
            {isItemExpandable && ( 
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            )}
            {item.name}
          </button>
        </TableCell>
        {periodHeaders.map((ph, idx) => (
          <TableCell
            key={`${item.id}-${ph}-nameplaceholder`}
            className={cn(rowSpecificBgClass, 'py-3')} 
          ></TableCell>
        ))}
      </TableRow>
    );

    if (isExpanded) {
      if (item.itemType === 'BU' || item.itemType === 'LOB') {
        const aggregatedMetricRows = renderCapacityItemContent(item);
        rows.push(...aggregatedMetricRows);
      }
      if (item.children && item.children.length > 0) { 
        item.children.forEach(child => {
          rows.push(...renderTableItem(child)); 
        });
      } else if (item.itemType === 'Team') { 
        const teamMetricStructure = renderCapacityItemContent(item);
        rows.push(...teamMetricStructure);
      }
    } else if (!isItemExpandable && (item.itemType === 'BU' || item.itemType === 'LOB')) { 
      // If an item is not expandable (e.g., LOB with no teams filtered), but is BU/LOB, show its aggregated metrics
      const itemMetricRows = renderCapacityItemContent(item);
      rows.push(...itemMetricRows);
    }


    return rows;
  }, [expandedItems, periodHeaders, toggleExpand, renderCapacityItemContent]);


  return (
    <TooltipProvider delayDuration={300}>
      <div ref={scrollContainerRef} className="overflow-x-auto relative border border-border rounded-md shadow-md">
        <Table className="min-w-full">
          <TableHeader ref={tableWeekHeaderRef} className="sticky top-0 z-[45] bg-card">
            <TableRow>
              <TableHead className="sticky left-0 z-50 bg-card min-w-[320px] whitespace-nowrap px-4 py-2 align-middle">
                {activeHierarchyContext}
              </TableHead>
              {periodHeaders.map((period, index) => {
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
                  <TableHead
                    key={period}
                    // ref={el => { if (el) weekHeaderRefs.current[index] = el; }} // weekHeaderRefs no longer used for date range display
                    className="text-right min-w-[100px] px-2 py-2 align-middle"
                  >
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium">{weekLabelPart}</span>
                      {dateRangePart && (
                        <span className="text-xs text-muted-foreground">
                          ({dateRangePart})
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
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
let rawCapacityDataSource: RawLoBCapacityEntry[] = JSON.parse(JSON.stringify(initialMockRawCapacityData));

export default function CapacityInsightsPage() {
  const [localRawCapacityDataSource, setLocalRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => {
    // Deep copy initial mock data to state
    return JSON.parse(JSON.stringify(initialMockRawCapacityData));
  });

  // Update global ref when local state changes
  useEffect(() => {
    rawCapacityDataSource = localRawCapacityDataSource;
  }, [localRawCapacityDataSource]);

  
  const defaultWFSLoBs = useMemo(() => ["Inventory Management", "Customer Returns", "Help Desk"], []);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS");
  
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>(() => {
    const initialBuLobs = BUSINESS_UNIT_CONFIG["WFS"].lonsOfBusiness;
    return defaultWFSLoBs.filter(lob => initialBuLobs.includes(lob as LineOfBusinessName<"WFS">));
  });

  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week"));
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(() => {
    const buConfig = BUSINESS_UNIT_CONFIG["WFS"];
    const lobsForWFS = [...buConfig.lonsOfBusiness];
    return {
      businessUnits: [...ALL_BUSINESS_UNITS],
      linesOfBusiness: lobsForWFS,
    };
  });
  
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  const [editingCell, setEditingCell] = useState<{ id: string; period: string; metricKey: string } | null>(null);

  const [activeHierarchyContext, setActiveHierarchyContext] = useState<string>("BU / LoB / Team / Metric");

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
     if (rawValue !== "" && rawValue !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null && metricKey !== 'someStringFieldIfAny') {
        // console.warn("Invalid number for metric change:", rawValue, "for metric", metricKey);
        return; 
    }
    const newValue = newValueParsed;

    setLocalRawCapacityDataSource(prevRawData => {
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
        teamEntry.periodicInputData[periodHeader] = { };
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
                               lobEntry.teams.find(t => (t.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0) > 0) || // find a team with some mix
                               lobEntry.teams[0]; // fallback to the first team
            
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
    metricKey: 'lobTotalBaseRequiredMinutes',
    rawValue: string 
  ) => {
    const newValueParsed = rawValue === "" || rawValue === "-" ? null : parseFloat(rawValue);
     if (rawValue !== "" && rawValue !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null) {
        // console.warn("Invalid number for LOB metric change:", rawValue);
        return; 
    }
    const newValue = newValueParsed;

    setLocalRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntryIndex = newData.findIndex(lob => lob.id === lobId);
      if (lobEntryIndex === -1) return prevRawData;

      const lobEntry = newData[lobEntryIndex];
      
      if (!lobEntry.lobTotalBaseRequiredMinutes) {
        lobEntry.lobTotalBaseRequiredMinutes = {};
      }
      lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = newValue;
      
      // If base minutes are changed, volume and AHT should ideally be nulled or marked as derived
      if (!lobEntry.lobVolumeForecast) lobEntry.lobVolumeForecast = {};
      if (!lobEntry.lobAverageAHT) lobEntry.lobAverageAHT = {};
      lobEntry.lobVolumeForecast[periodHeader] = null; // Indicate that these are no longer primary drivers for this period
      lobEntry.lobAverageAHT[periodHeader] = null;

      return newData;
    });
  }, []);

  const handleBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedBusinessUnit(bu);
    // Reset LOBs when BU changes
    const newBuConfig = BUSINESS_UNIT_CONFIG[bu];
    const allLobsForNewBu = [...newBuConfig.lonsOfBusiness];
    let newDefaultSelectedLobs: string[];

    if (bu === "WFS") {
        newDefaultSelectedLobs = defaultWFSLoBs.filter(lob => 
            allLobsForNewBu.includes(lob as LineOfBusinessName<"WFS">)
        );
    } else {
        newDefaultSelectedLobs = [...allLobsForNewBu];
    }
    setSelectedLineOfBusiness(newDefaultSelectedLobs);

  }, [defaultWFSLoBs]); 

  const handleLOBChange = useCallback((lobs: string[]) => {
      setSelectedLineOfBusiness(lobs);
  }, []);
  
  const handleTimeIntervalChange = useCallback((interval: TimeInterval) => {
    setSelectedTimeInterval(interval);
    setSelectedDateRange(getDefaultDateRange(interval)); 
  }, []);

  useEffect(() => {
    const newBuConfig = BUSINESS_UNIT_CONFIG[selectedBusinessUnit];
    const allLobsForNewBu = [...newBuConfig.lonsOfBusiness];
    
    // Update filterOptions.linesOfBusiness for the LOB dropdown
    setFilterOptions(prev => {
        const lobsForFilterAreEqual = prev.linesOfBusiness.length === allLobsForNewBu.length && 
                                  prev.linesOfBusiness.every(lob => allLobsForNewBu.includes(lob));
        
        const newLinesOfBusinessForFilter = [...allLobsForNewBu];
        const newBusinessUnitsForFilter = [...ALL_BUSINESS_UNITS];

        if (!lobsForFilterAreEqual || prev.businessUnits.join(',') !== newBusinessUnitsForFilter.join(',')) {
            return { 
                businessUnits: newBusinessUnitsForFilter, 
                linesOfBusiness: newLinesOfBusinessForFilter 
            };
        }
        return prev; 
    });
  }, [selectedBusinessUnit, defaultWFSLoBs]);


  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    let periodsToDisplay: string[] = [];

    if (selectedDateRange?.from) {
      const userRangeStart = selectedDateRange.from;
      const userRangeEnd = selectedDateRange.to || userRangeStart; 

      periodsToDisplay = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        
        // Check if the period [periodStartDate, periodEndDate] overlaps with [userRangeStart, userRangeEnd]
        return isAfter(periodEndDate, addDays(userRangeStart, -1)) && isBefore(periodStartDate, addDays(userRangeEnd, 1));
      });
    } else { 
      // Fallback if no date range is selected (should not happen with default)
      periodsToDisplay = sourcePeriods.slice(0, NUM_PERIODS_DISPLAYED);
    }
    
    setDisplayedPeriodHeaders(periodsToDisplay);

    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;
    const newDisplayData: CapacityDataRow[] = [];
    
    const buName = selectedBusinessUnit; // Only one BU selected at a time now
    const relevantRawLobEntriesForSelectedBu = localRawCapacityDataSource.filter(d => d.bu === buName);
    
    if (relevantRawLobEntriesForSelectedBu.length === 0) {
      setDisplayableCapacityData([]); 
      return; 
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    
    const lobsConfigForThisBu = BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness;
    
    // Filter LOBs based on multi-select dropdown
    const lobsToProcessForThisBu = selectedLineOfBusiness.length === 0 || 
                                   (selectedLineOfBusiness.length === lobsConfigForThisBu.length && selectedLineOfBusiness.every(lob => lobsConfigForThisBu.includes(lob as any))) // If "All LOBs" equivalent
      ? relevantRawLobEntriesForSelectedBu 
      : relevantRawLobEntriesForSelectedBu.filter(lobEntry => selectedLineOfBusiness.includes(lobEntry.lob));


    lobsToProcessForThisBu.forEach(lobRawEntry => {
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        const teamsToProcess = lobRawEntry.teams || []; 

        const lobCalculatedBaseRequiredMinutes: Record<string, number | null> = {};
        periodsToDisplay.forEach(period => {
            const volume = lobRawEntry.lobVolumeForecast?.[period];
            const avgAHT = lobRawEntry.lobAverageAHT?.[period];
            if (volume !== null && volume !== undefined && avgAHT !== null && avgAHT !== undefined && avgAHT > 0) {
                lobCalculatedBaseRequiredMinutes[period] = volume * avgAHT;
            } else { 
                 // Use pre-set lobTotalBaseRequiredMinutes if forecast/AHT is not available or not applicable
                lobCalculatedBaseRequiredMinutes[period] = lobRawEntry.lobTotalBaseRequiredMinutes?.[period] ?? 0; 
            }
        });
        
        teamsToProcess.forEach(teamRawEntry => {
            const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
            periodsToDisplay.forEach(period => {
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
        periodsToDisplay.forEach(period => {
            let reqHcSum = 0;
            let actHcSum = 0; 
            let lobBaseMinutes = lobCalculatedBaseRequiredMinutes[period] ?? 0;
            
            childrenTeamsDataRows.forEach(teamRow => { 
                const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                if (teamPeriodMetric) {
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0; 
                }
            });
            const overUnderHCSum = (actHcSum !== null && reqHcSum !== null) ? actHcSum - reqHcSum : null;
            
            lobPeriodicData[period] = {
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: overUnderHCSum,
                lobTotalBaseRequiredMinutes: lobBaseMinutes, 
            };
        });

        // Only add LOB if it has teams to display or if it's explicitly selected and we want to show it even if empty
        // For now, assume we only show LOBs that have (or would have) teams.
        if (childrenTeamsDataRows.length > 0 || teamsToProcess.length > 0) { // Ensure LOB row is added if it has teams configured, even if filtered out
          childrenLobsDataRows.push({
            id: lobRawEntry.id,
            name: lobRawEntry.lob,
            level: 1, 
            itemType: 'LOB',
            periodicData: lobPeriodicData,
            children: childrenTeamsDataRows, // These are the teams that passed the team filter (if any)
          });
        }
    });

    if (childrenLobsDataRows.length > 0 ) { 
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplay.forEach(period => {
        let reqHcSum = 0;
        let actHcSum = 0;
        let lobTotalBaseReqMinsForBu = 0;
        childrenLobsDataRows.forEach(lobRow => { 
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
                lobTotalBaseReqMinsForBu += lobPeriodMetric.lobTotalBaseRequiredMinutes ?? 0; // Summing LOB base minutes for BU total
              }
        });
        const overUnderHCSum = (actHcSum !== null && reqHcSum !== null) ? actHcSum - reqHcSum : null;

        buPeriodicData[period] = {
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: overUnderHCSum,
            lobTotalBaseRequiredMinutes: lobTotalBaseReqMinsForBu,
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
      localRawCapacityDataSource, 
    ]);

  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
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
      />
      <main className="flex-grow p-4"> 
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
          activeHierarchyContext={activeHierarchyContext}
          onActiveHierarchyChange={handleActiveHierarchyChange}
        />
      </main>
    </div>
  );
}

