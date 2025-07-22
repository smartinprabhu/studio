
"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from 'axios';
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
  isSameMonth,
} from 'date-fns';
import "./globals.css";
import {
  addYears,
  subYears,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  DropdownMenuSeparator, // Corrected import
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Zap, Download, Plus, Building2, Briefcase, ChevronDown, Edit3, ArrowDown, ArrowUp, Minus, Calendar as CalendarIcon, Users, ChevronsUpDown, ArrowLeft, ArrowRight, BarChart2, Table as TableIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { suggestLoBGroupings, SuggestLoBGroupingsOutput } from "@/ai/flows/suggest-lob-groupings";
import ThemeSelector from "./ThemeSelector";
import {
  format,
  parse,
  addMonths,
  subMonths,
} from "date-fns";
import {
  isWithinInterval,
  startOfDay,
  endOfDay,
}
 from "date-fns";
import type { DayPickerProps } from "react-day-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { MonthRangePicker } from "./MonthRangePicker"; // Import the new picker

const throttle = (func: (...args: any[]) => void, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (!timeout) {
      timeout = setTimeout(() => {
        func(...args);
        timeout = null;
      }, wait);
    }
  };
};

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

  const targetDateForStart = isLeapYear(currentYear)
    ? new Date(Date.UTC(currentYear, 1, 1)) // February 1st
    : new Date(Date.UTC(currentYear, 0, 22)); // January 22nd

  fiscalYearActualStartDate = startOfWeek(targetDateForStart, { weekStartsOn: 1 });

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
  return date.toLocaleString('default', { month: 'short', year: 'numeric' });
});

// V2 Configuration: POS and MOS
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

// Update types to use the new config
export type BusinessUnitNameV2 = keyof typeof BUSINESS_UNIT_CONFIG_V2;
export type LineOfBusinessNameV2<BU extends BusinessUnitNameV2 = BusinessUnitNameV2> = typeof BUSINESS_UNIT_CONFIG_V2[BU]["lonsOfBusiness"][number];

export const ALL_BUSINESS_UNITS_V2 = Object.keys(BUSINESS_UNIT_CONFIG_V2) as BusinessUnitNameV2[];
export const ALL_TEAM_NAMES: readonly TeamName[] = ["Inhouse", "BPO1", "BPO2"] as const; // Remains the same

// Ensure original types are still available if needed by shared functions, though they should be updated or made generic
export const BUSINESS_UNIT_CONFIG = BUSINESS_UNIT_CONFIG_V2;
export type BusinessUnitName = BusinessUnitNameV2;
export type LineOfBusinessName<BU extends BusinessUnitName = BusinessUnitName> = LineOfBusinessNameV2<BU>;
export const ALL_BUSINESS_UNITS = ALL_BUSINESS_UNITS_V2;


export type TimeInterval = "Week" | "Month";
export type TeamName = "Inhouse" | "BPO1" | "BPO2";

export interface BaseHCValues {
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null;
}
export interface TeamPeriodicMetrics extends BaseHCValues {
  aht: number | null;
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
  lobTotalBaseRequiredMinutes?: number | null;
  lobCalculatedAverageAHT?: number | null;
  handlingCapacity?: number | null;
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

export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: "requiredHC", label: "Required HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Calculated number of headcount required based on demand and productivity assumptions." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, isEditableForTeam: true, step: 0.01, category: 'PrimaryHC', description: "The actual or starting headcount for the period before adjustments." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, isDisplayOnly: true, category: 'PrimaryHC', description: "Difference between Actual/Starting HC and Required HC.\nFormula: Actual HC - Required HC" },
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Average Handle Time: The average time taken to handle one interaction." },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Occupancy: Percentage of time agents are busy with interaction-related work during their available time." },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Backlog: Percentage of additional work (e.g., deferred tasks) that needs to be handled on top of forecasted volume." },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Attrition: Percentage of agents expected to leave during the period." },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Volume Mix: Percentage of the LOB's total volume handled by this team." },
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Headcount moving into this team from other teams or roles." },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Headcount moving out of this team to other teams or roles." },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Number of new hires starting in a batch during this period (typically in training)." },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true, category: 'HCAdjustment', description: "Number of new hires becoming productive and joining the floor during this period." },
  { key: "attritionLossHC", label: "Attrition Loss HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Calculated headcount lost due to attrition.\nFormula: Actual HC * Attrition %" },
  { key: "hcAfterAttrition", label: "HC After Attrition", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Headcount remaining after attrition loss.\nFormula: Actual HC - Attrition Loss HC" },
  { key: "endingHC", label: "Ending HC", isHC: true, isDisplayOnly: true, category: 'HCAdjustment', description: "Projected headcount at the end of the period after all adjustments.\nFormula: HC After Attrition + New Hire Prod. + Move In - Move Out" },
  { key: "_calculatedRequiredAgentMinutes", label: "Eff. Req. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'HCAdjustment', description: "Team's share of LOB demand minutes, adjusted for the team's backlog percentage.\nFormula: (Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)" },
  { key: "_calculatedActualProductiveAgentMinutes", label: "Actual Prod. Mins (Team)", isDisplayOnly: true, isTime: true, category: 'Internal', description: "Total productive agent minutes available from the team's actual headcount, considering shrinkage and occupancy.\nFormula: Actual HC * Std Mins * (1 - In Office Shrink%) * (1 - Out of Office Shrink%) * Occupancy%" },
  { key: "inOfficeShrinkagePercentage", label: "In Office Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "In Office Shrinkage: Percentage of paid time that agents are not available for handling interactions while in office." },
  { key: "outOfOfficeShrinkagePercentage", label: "Out of Office Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1, category: 'Assumption', description: "Out of Office Shrinkage: Percentage of paid time that agents are not available for handling interactions while out of office." },


];


export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: "lobVolumeForecast", label: "Volume Forecast", isEditableForLob: true, step: 1, isCount: true, description: "Total number of interactions forecasted for this LOB." },
  { key: "lobAverageAHT", label: "Average AHT", isEditableForLob: true, step: 0.1, isTime: true, description: "Average handle time assumed for LOB interactions." },
  { key: "lobTotalBaseRequiredMinutes", label: "Total Base Req Mins", isEditableForLob: true, isTime: true, step: 1, description: "Total agent minutes required for LOB volume, calculated as Volume * AHT or input directly." },
  { key: "handlingCapacity", label: "Handling Capacity", isEditableForLob: false, isCount: true, description: "Handling Capacity: The capacity to handle interactions, calculated as Volume Forecast divided by Average AHT.\nFormula: Volume Forecast / Average AHT", isLobOnly: true },
  { key: "requiredHC", label: "Required HC", isHC: true, description: "Aggregated required headcount from child entities." },
  { key: "actualHC", label: "Actual/Starting HC", isHC: true, description: "Aggregated actual/starting headcount from child entities." },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true, description: "Difference between aggregated Actual/Starting HC and Required HC." },
];

export interface FilterOptions {
  businessUnits: BusinessUnitName[];
  linesOfBusiness: string[];
}

export interface HeaderSectionProps {
  planFilterOptions: FilterOptions;
  selectedPlanBusinessUnit: BusinessUnitName;
  onSelectPlanBusinessUnit: (value: BusinessUnitName) => void;
  selectedPlanLineOfBusiness: string[];
  onSelectPlanLineOfBusiness: (value: string[]) => void;
  selectedPlanTimeInterval: TimeInterval;
  onSelectPlanTimeInterval: (value: TimeInterval) => void;
  selectedPlanDateRange: DateRange | undefined;
  onSelectPlanDateRange: (value: DateRange | undefined) => void;

  
  businessId: number;
  navigateSimulator: (value: number) => void;

  chartFilterOptions: FilterOptions;
  selectedChartBusinessUnit: BusinessUnitName;
  onSelectChartBusinessUnit: (value: BusinessUnitName) => void;
  selectedChartLineOfBusiness: string[];
  onSelectChartLineOfBusiness: (value: string[]) => void;
  selectedChartTimeInterval: TimeInterval;
  onSelectChartTimeInterval: (value: TimeInterval) => void;
  selectedChartDateRange: DateRange | undefined;
  onSelectChartDateRange: (value: DateRange | undefined) => void;

  allAvailablePeriods: string[];
  displayedPeriodHeaders: string[];
  activeHierarchyContext: string;
  headerPeriodScrollerRef: React.RefObject<HTMLDivElement>;
  onExportCsv: () => void;
  viewMode: 'plan' | 'chart';
  onSetViewMode: (mode: 'plan' | 'chart') => void;
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
  lobTotalBaseRequiredMinutes?: Record<string, number | null>;
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

// --- END CONSOLIDATED TYPES ---

// --- BEGIN CONSOLIDATED DATA ---
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS;

  // const finalSumCheck = mixes.reduce((acc, curr) => acc + curr, 0);
  // if (Math.abs(finalSumCheck - 100) > 0.01 && totalTeams > 0 && mixes.length > 0) {
  //   const diff = 100 - finalSumCheck;
  //   mixes[mixes.length - 1] = parseFloat((mixes[mixes.length - 1] + diff).toFixed(1));
  //   if (mixes[mixes.length - 1] < 0 && mixes.length > 1) {
  //     let diffToRedistribute = mixes[mixes.length - 1];
  //     mixes[mixes.length - 1] = 0;
  //     for (let k = 0; k < mixes.length - 1; k++) {
  //       if (diffToRedistribute >= 0) break;
  //       let take = Math.min(mixes[k], Math.abs(diffToRedistribute));
  //       mixes[k] = parseFloat((mixes[k] - take).toFixed(1));
  //       diffToRedistribute += take;
  //     }
  //   }
  // }
  const generateTeamPeriodicInputData = (
  periods: string[],
  teamIndex: number,
  totalTeams: number
): Record<string, Partial<TeamPeriodicMetrics>> => {
  const metrics: Record<string, Partial<TeamPeriodicMetrics>> = {};
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

  // Adjust the final sum of the mixes
  const finalSumCheck = mixes.reduce((acc, curr) => acc + curr, 0);
  if (Math.abs(finalSumCheck - 100) > 0.01 && totalTeams > 0 && mixes.length > 0) {
    const diff = 100 - finalSumCheck;
    mixes[mixes.length - 1] = parseFloat((mixes[mixes.length - 1] + diff).toFixed(1));
    if (mixes[mixes.length - 1] < 0 && mixes.length > 1) {
      let diffToRedistribute = mixes[mixes.length - 1];
      mixes[mixes.length - 1] = 0;
      for (let k = 0; k < mixes.length - 1; k++) {
        if (diffToRedistribute >= 0) break;
        let take = Math.min(mixes[k], Math.abs(diffToRedistribute));
        mixes[k] = parseFloat((mixes[k] - take).toFixed(1));
        diffToRedistribute += take;
      }
    }
  }

  periods.forEach(period => {
    const volumeForecast = Math.floor(Math.random() * 10000) + 2000;
    const averageAHT = Math.floor(Math.random() * 10) + 5;


    metrics[period] = {
      aht: averageAHT,
      inOfficeShrinkagePercentage: Math.floor(Math.random() * 10) + 5,
      outOfOfficeShrinkagePercentage: Math.floor(Math.random() * 10) + 5,
      occupancyPercentage: Math.floor(Math.random() * 20) + 70,
      backlogPercentage: Math.floor(Math.random() * 10),
      attritionPercentage: parseFloat((Math.random() * 2).toFixed(1)),
      volumeMixPercentage: mixes[teamIndex] || 0,
      actualHC: Math.floor(Math.random() * 50) + 10,
      moveIn: Math.floor(Math.random() * 5),
      moveOut: Math.floor(Math.random() * 3),
      newHireBatch: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 5 : 0,
      newHireProduction: Math.random() > 0.5 ? Math.floor(Math.random() * 8) : 0,

      _productivity: 1.0,
    };
  });

  return metrics;
};
const generateLobInputs = (periods: string[], isMonthly: boolean = false) => {
  const volume: Record<string, number | null> = {};
  const aht: Record<string, number | null> = {};
  const handlingCapacity: Record<string, number | null> = {}; // Handling capacity at LOB level

  periods.forEach(period => {
    const volumeForecast = Math.floor(Math.random() * 10000) + 2000;
    const averageAHT = Math.floor(Math.random() * 10) + 5;

    volume[period] = isMonthly ? 0 : volumeForecast;
    aht[period] = isMonthly ? 0 : averageAHT;
    handlingCapacity[period] = isMonthly ? 0 : volumeForecast / averageAHT; // Calculate handling capacity
  });

  return { volume, aht, handlingCapacity };
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
    // Generate weekly inputs only (monthly will be 0)
    const weeklyInputs = generateLobInputs(MOCK_DATA_PERIODS);
    const monthlyInputs = generateLobInputs(ALL_MONTH_HEADERS, true);

    initialMockRawCapacityData.push({
      id: `${bu.toLowerCase().replace(/\s+/g, '-')}_${lob.toLowerCase().replace(/\s+/g, '-')}`,
      bu: bu,
      lob: lob,
      lobVolumeForecast: weeklyInputs.volume, // Only use weekly data
      lobAverageAHT: weeklyInputs.aht, // Only use weekly data
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
    aht: null,
    inOfficeShrinkagePercentage: null,
    outOfOfficeShrinkagePercentage: null,
    occupancyPercentage: null,
    backlogPercentage: null,
    attritionPercentage: null,
    volumeMixPercentage: null,
    actualHC: null,
    moveIn: null,
    moveOut: null,
    newHireBatch: null,
    newHireProduction: null,
    handlingCapacity: null,
    _productivity: null,
    _calculatedRequiredAgentMinutes: null,
    _calculatedActualProductiveAgentMinutes: null,
    requiredHC: null,
    overUnderHC: null,
    attritionLossHC: null,
    hcAfterAttrition: null,
    endingHC: null,
    _lobTotalBaseReqMinutesForCalc: null,
    ...teamInputDataCurrentPeriod,
  };

  const baseTeamRequiredMinutes = (lobTotalBaseRequiredMinutesForPeriod ?? 0) * ((defaults.volumeMixPercentage ?? 0) / 100);
  const effectiveTeamRequiredMinutes = baseTeamRequiredMinutes * (1 + ((defaults.backlogPercentage ?? 0) / 100));
  defaults._calculatedRequiredAgentMinutes = effectiveTeamRequiredMinutes;

  let requiredHC = null;
  const effectiveMinutesPerHC = standardWorkMinutesForPeriod *
    (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100)) *
    (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100)) *
    ((defaults.occupancyPercentage ?? 0) / 100);

  if (effectiveTeamRequiredMinutes > 0 && effectiveMinutesPerHC > 0) {
    requiredHC = effectiveTeamRequiredMinutes / effectiveMinutesPerHC;
  } else if (effectiveTeamRequiredMinutes === 0) {
    requiredHC = 0;
  }

  defaults.requiredHC = requiredHC;
  const currentActualHC = defaults.actualHC ?? 0;
  defaults.overUnderHC = (currentActualHC !== null && requiredHC !== null) ? currentActualHC - requiredHC : null;

  if (currentActualHC !== null && standardWorkMinutesForPeriod > 0) {
    defaults._calculatedActualProductiveAgentMinutes = currentActualHC * standardWorkMinutesForPeriod *
      (1 - ((defaults.inOfficeShrinkagePercentage ?? 0) / 100)) *
      (1 - ((defaults.outOfOfficeShrinkagePercentage ?? 0) / 100)) *
      ((defaults.occupancyPercentage ?? 0) / 100);
  } else {
    defaults._calculatedActualProductiveAgentMinutes = 0;
  }

  const attritionLossHC = currentActualHC * ((defaults.attritionPercentage ?? 0) / 100);
  defaults.attritionLossHC = attritionLossHC;
  const hcAfterAttrition = currentActualHC - attritionLossHC;
  defaults.hcAfterAttrition = hcAfterAttrition;
  defaults.endingHC = hcAfterAttrition + (defaults.newHireProduction ?? 0) + (defaults.moveIn ?? 0) - (defaults.moveOut ?? 0);
  defaults._lobTotalBaseReqMinutesForCalc = lobTotalBaseRequiredMinutesForPeriod;

  return defaults;
};

const parseDateFromHeaderStringMMDD = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;

  const parsedDate = new Date(Date.UTC(parseInt(year), month - 1, day));

  if (parsedDate.getUTCFullYear() !== parseInt(year) || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    return null;
  }
  return parsedDate;
};

export const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (interval === "Week") {
    const match = header.match(/FWk\d+:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
    if (match) {
      const [, startDateStr, endDateStr, yearStr] = match;

      let parsedStartDate = parseDateFromHeaderStringMMDD(startDateStr, yearStr);
      let parsedEndDate = parseDateFromHeaderStringMMDD(endDateStr, yearStr);

      if (parsedStartDate && parsedEndDate && isBefore(parsedEndDate, parsedStartDate)) {
        const startMonth = parseInt(startDateStr.split('/')[0]);
        const endMonth = parseInt(endDateStr.split('/')[0]);
        if (endMonth < startMonth) {
          parsedEndDate = parseDateFromHeaderStringMMDD(endDateStr, (parseInt(yearStr) + 1).toString());
        }
      }
      return { startDate: parsedStartDate, endDate: parsedEndDate };
    }
  } else if (interval === "Month") {
            try {
              // Example header: "Jan 2024"
              const date = dateParseFns(header, "MMM yyyy", new Date()); // Use "MMM yyyy" for abbreviated month
      if (!isNaN(date.getTime())) {
        const yearVal = date.getFullYear(); // getFullYear() is fine as date-fns parse would have handled it
        const monthVal = date.getMonth();   // getMonth() is 0-indexed
        
        // Use UTC dates for consistency with fiscal week calculations
        const firstDay = startOfMonth(new Date(Date.UTC(yearVal, monthVal, 1)));
        const lastDay = endOfMonth(new Date(Date.UTC(yearVal, monthVal, 1))); // endOfMonth will find the correct last day
        return { startDate: firstDay, endDate: lastDay };
      }
    } catch (e) {
      console.warn(`Could not parse month header: ${header}`, e);
    }
  }
  return { startDate: null, endDate: null };
};

const getDefaultDateRange = (interval: TimeInterval, numPeriodsToDefault: number): DateRange => {
  const headers = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;

  if (headers.length === 0) return { from: undefined, to: undefined };

  const fromHeaderDetails = getHeaderDateRange(headers[0], interval);
  const toHeaderIndex = Math.min(numPeriodsToDefault - 1, headers.length - 1);
  const toHeaderDetails = getHeaderDateRange(headers[toHeaderIndex], interval);

  let fromDate = fromHeaderDetails.startDate;
  let toDate = toHeaderDetails.endDate;

  if (!fromDate) fromDate = new Date();
  if (!toDate) toDate = interval === "Week" ? endOfWeek(addWeeks(fromDate, 11)) : endOfMonth(addDays(startOfMonth(fromDate), 60));

  return { from: fromDate ?? undefined, to: toDate ?? undefined };
};

const findFiscalWeekHeaderForDate = (targetDate: Date, allFiscalHeaders: string[]): string | null => {
  if (!targetDate) return null;
  for (const header of allFiscalHeaders) {
    const { startDate, endDate } = getHeaderDateRange(header, "Week");
    if (startDate && endDate) {
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

// Custom Caption Component for Calendar Header
interface CustomCaptionProps {
  displayMonth: Date;
  onMonthChange: (newMonth: Date) => void;
}

const CustomCaption: React.FC<CustomCaptionProps> = ({ displayMonth, onMonthChange }) => {
  const monthName = displayMonth.toLocaleString("default", { month: "long" });
  const year = displayMonth.getFullYear();

  return (
    <div className="flex items-center justify-between px-2 py-1">
      {/* Month Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onMonthChange(subMonths(displayMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthName}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onMonthChange(addMonths(displayMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Year Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onMonthChange(subYears(displayMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{year}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onMonthChange(addYears(displayMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}

function DateRangePicker({ date, onDateChange, className }: DateRangePickerProps) {
  const [clientButtonText, setClientButtonText] = useState("Loading...");
  const [displayMonths, setDisplayMonths] = useState<Date[]>([]);

  useEffect(() => {
    let newButtonText = "Pick a date range";
    if (typeof window !== "undefined" && date?.from) {
      const fromDateObj = date.from;
      const fromFiscalWeekInfo = findFiscalWeekHeaderForDate(fromDateObj, ALL_WEEKS_HEADERS);
      const fromFiscalWeekLabel = fromFiscalWeekInfo
        ? fromFiscalWeekInfo.split(":")[0].replace("FWk", "WK")
        : `W${getWeek(fromDateObj, { weekStartsOn: 1 })}`;

      const formattedFromDate = `${String(fromDateObj.getUTCDate()).padStart(2, "0")}/${String(fromDateObj.getUTCMonth() + 1).padStart(2, "0")}/${fromDateObj.getUTCFullYear()}`;

      newButtonText = `${fromFiscalWeekLabel} (${formattedFromDate})`;

      if (date.to) {
        const toDateObj = date.to;
        const toFiscalWeekInfo = findFiscalWeekHeaderForDate(toDateObj, ALL_WEEKS_HEADERS);
        const toFiscalWeekLabel = toFiscalWeekInfo
          ? toFiscalWeekInfo.split(":")[0].replace("FWk", "WK")
          : `W${getWeek(toDateObj, { weekStartsOn: 1 })}`;
        const formattedToDate = `${String(toDateObj.getUTCDate()).padStart(2, "0")}/${String(toDateObj.getUTCMonth() + 1).padStart(2, "0")}/${toDateObj.getUTCFullYear()}`;

        const fromWeekStartForLabel = startOfWeek(fromDateObj, { weekStartsOn: 1 });
        const toWeekStartForLabel = startOfWeek(toDateObj, { weekStartsOn: 1 });

        if (!isSameDay(fromWeekStartForLabel, toWeekStartForLabel)) {
          newButtonText += ` - ${toFiscalWeekLabel} (${formattedToDate})`;
        }
      }
    }
    setClientButtonText(newButtonText);
  }, [date]);

  const yearsInHeaders = useMemo(
    () =>
      [
        ...new Set(
          ALL_WEEKS_HEADERS.map((h) => {
            const match = h.match(/\((\d{4})\)$/);
            return match ? parseInt(match[1]) : 0;
          }).filter((y) => y > 0)
        ),
      ],
    []
  );

  const minYear = yearsInHeaders.length > 0 ? Math.min(...yearsInHeaders) : new Date().getUTCFullYear();
  const maxYear = yearsInHeaders.length > 0 ? Math.max(...yearsInHeaders) : new Date().getUTCFullYear() + 1;

  const defaultCalendarMonth = date?.from instanceof Date ? date.from : new Date(Date.UTC(minYear, 0, 1));

  // Initialize display months for two calendars
  useEffect(() => {
    const firstMonth = defaultCalendarMonth;
    const secondMonth = addMonths(firstMonth, 1);
    setDisplayMonths([firstMonth, secondMonth]);
  }, [defaultCalendarMonth]);

  const handleMonthChange = (index: number) => (newMonth: Date) => {
    const newDisplayMonths = [...displayMonths];
    newDisplayMonths[index] = newMonth;

    // Ensure the second month is always after the first
    if (index === 0 && newDisplayMonths[1] <= newMonth) {
      newDisplayMonths[1] = addMonths(newMonth, 1);
    } else if (index === 1 && newDisplayMonths[0] >= newMonth) {
      newDisplayMonths[0] = subMonths(newMonth, 1);
    }

    setDisplayMonths(newDisplayMonths);
  };

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
          <div className="flex">
            {displayMonths.map((month, index) => (
              <Calendar
                key={index}
                initialFocus={index === 0}
                mode="range"
                weekStartsOn={1}
                month={month}
                onMonthChange={handleMonthChange(index)}
                components={{
                  Caption: (props) => (
                    <CustomCaption
                      displayMonth={props.displayMonth}
                      onMonthChange={handleMonthChange(index)}
                    />
                  ),
                }}
                
                fromYear={minYear}
                toYear={maxYear}
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

                  if (newFrom && newTo && newTo < newFrom) {
                    newTo = endOfWeek(newFrom, { weekStartsOn: 1 });
                  }

                  const processedRange: DateRange | undefined = newFrom
                    ? { from: newFrom, to: newTo || endOfWeek(newFrom, { weekStartsOn: 1 }) }
                    : undefined;
                  onDateChange(processedRange);
                }}
                numberOfMonths={1}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}


function HeaderSection({
  planFilterOptions,
  selectedPlanBusinessUnit,
  onSelectPlanBusinessUnit,
  selectedPlanLineOfBusiness,
  onSelectPlanLineOfBusiness,
  selectedPlanTimeInterval,
  onSelectPlanTimeInterval,
  selectedPlanDateRange,
  onSelectPlanDateRange,

    businessId,
    navigateSimulator,

  chartFilterOptions,
  selectedChartBusinessUnit,
  onSelectChartBusinessUnit,
  selectedChartLineOfBusiness,
  onSelectChartLineOfBusiness,
  selectedChartTimeInterval,
  onSelectChartTimeInterval,
  selectedChartDateRange,
  onSelectChartDateRange,

  allAvailablePeriods,
  displayedPeriodHeaders,
  activeHierarchyContext,
  headerPeriodScrollerRef,
  onExportCsv,
  viewMode,
  onSetViewMode,
}: HeaderSectionProps) {
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [isWhatIfNavigate, setWhatIfNavigate] = useState(false);

      const { toast } = useToast();
    
      const WEBAPPAPIURL =  `/api/v2/`;
    
    const [formData, setFormData] = useState<Record<string, any>>({ name: "", description: "", end_date: "", start_date: "" });

  const currentSelectedBusinessUnit = viewMode === 'plan' ? selectedPlanBusinessUnit : selectedChartBusinessUnit;
  const currentSelectedLineOfBusiness = viewMode === 'plan' ? selectedPlanLineOfBusiness : selectedChartLineOfBusiness;
  const currentSelectedTimeInterval = viewMode === 'plan' ? selectedPlanTimeInterval : selectedChartTimeInterval;
  const currentSelectedDateRange = viewMode === 'plan' ? selectedPlanDateRange : selectedChartDateRange;
  const currentFilterOptions = viewMode === 'plan' ? planFilterOptions : chartFilterOptions;

    useEffect(() => {
          const runFetch = async () => {
            if (currentSelectedDateRange?.from && currentSelectedDateRange?.to) {
              try {
                const formattedFrom = currentSelectedDateRange.from ? format(currentSelectedDateRange.from, 'yyyy-MM-dd') : '';
                const formattedTo = currentSelectedDateRange.to ? format(currentSelectedDateRange.to, 'yyyy-MM-dd') : '';
                setFormData(prev => ({ ...prev, start_date: formattedFrom, end_date: formattedTo }));
              } catch (err) {
             
                console.error("Failed to fetch:", err);
              }
            }
          };
    
          runFetch();
        }, [currentSelectedDateRange]);

  const handleSelectBusinessUnit = viewMode === 'plan' ? onSelectPlanBusinessUnit : onSelectChartBusinessUnit;
  const handleSelectLineOfBusiness = viewMode === 'plan' ? onSelectPlanLineOfBusiness : onSelectChartLineOfBusiness;
  const handleSelectTimeInterval = viewMode === 'plan' ? onSelectPlanTimeInterval : onSelectChartTimeInterval;
  const handleSelectDateRange = viewMode === 'plan' ? onSelectPlanDateRange : onSelectChartDateRange;


  const handleLobSelectionChange = (lob: string, checked: boolean) => {
    const newSelectedLOBs = checked
      ? [...currentSelectedLineOfBusiness, lob]
      : currentSelectedLineOfBusiness.filter((item) => item !== lob);
    handleSelectLineOfBusiness(newSelectedLOBs);
  };

  const actualLobsForCurrentBu = BUSINESS_UNIT_CONFIG[currentSelectedBusinessUnit]?.lonsOfBusiness || [];
  let lobDropdownLabel = "Select LOBs";
  if (currentSelectedLineOfBusiness.length === 1) {
    lobDropdownLabel = currentSelectedLineOfBusiness[0];
  } else if (actualLobsForCurrentBu.length > 0 && currentSelectedLineOfBusiness.length === actualLobsForCurrentBu.length) {
    lobDropdownLabel = `All ${actualLobsForCurrentBu.length} LOBs`;
  } else if (currentSelectedLineOfBusiness.length > 1) {
    lobDropdownLabel = `${currentSelectedLineOfBusiness.length} LOBs Selected`;
  } else if (actualLobsForCurrentBu.length === 0) {
    lobDropdownLabel = "No LOBs";
  }

   const handleFormInputChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const fields = [
        { name: "name", label: "Name", placeholder: "Name your what-if scenario..", type: "text", required: true },
        { name: "start_date", label: "Start Date", type: "date", required: true },
        { name: "end_date", label: "End Date", type: "date", required: false },
        { name: "description", placeholder: "Enter the description", label: "Description", type: "textarea", required: false },
      ];

      
 type ForecastFormData = {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  business_unit: number;
};


      async function submitForecastForm(model: string, values: ForecastFormData) {
        const formData = new FormData();
      
        formData.append("model", model);
        formData.append("values", JSON.stringify(values)); // nested object as JSON string
      
        const url = `${WEBAPPAPIURL}create`;
      
        const response = await axios.post(url, formData, {
          headers: {
            "Content-Type": "multipart/form-data"
          },
        });
      
        return response.data;
      }

      const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setFormLoading(true);
          console.log('isWhatIfNavigate', isWhatIfNavigate)
          try {
            const response = await submitForecastForm("what_if_simulator",{
              name: formData.name,
              description: formData.description,
              start_date: formData.start_date,
              end_date: formData.end_date,
              business_unit: businessId
            });
            toast({
              title: "Record Created",
              description: `What-if Simulator has been created successfully.`,
            });
            setFormLoading(false);
            setAddOpen(false);
            if(isWhatIfNavigate && navigateSimulator){
               setTimeout(() => {
                navigateSimulator(response?.[0] || '');
              }, 2000); 
            }
          } catch (err) {
            setFormLoading(false);
            console.error("API Error:", err);
          }
          
        };
		

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 bg-background p-4 border-b border-border rounded-tl-lg rounded-tr-lg">
        <div className="flex flex-col md:flex-row justify-between mt-[-15px] ml-[-5px] md:items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Tactical Capacity Insights</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onExportCsv}>
                  <Download className="mr-2" /> Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export current view as CSV</p></TooltipContent>
            </Tooltip>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2" /> What-If Simulate
                </Button>
            <div className="flex items-center gap-2 border rounded-md p-1 ">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "plan" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onSetViewMode("plan")}
                    className="h-7 px-3"
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Plan View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "chart" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onSetViewMode("chart")}
                    className="h-7 px-3"
                  >
                    <BarChart2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Chart View</TooltipContent>
              </Tooltip>
            </div>

            <Button variant="outline" size="sm" onClick={() => setIsAiDialogOpen(true)}>
              <Zap className="mr-2" /> Assumptions Assister
            </Button>
          </div>
        </div>

         <Sheet open={isAddOpen} onOpenChange={setAddOpen}>
                            <SheetContent
                              side="right"
                              className="w-[1000px] h-screen bg-card text-card-foreground shadow-lg border border-border overflow-y-auto fixed top-0 right-0 z-[1000]"
                            >
                              <SheetHeader>
                                <SheetTitle>Create What-if Simulator</SheetTitle>
                              </SheetHeader>
                              <form onSubmit={handleSubmit} className="space-y-4">
                              <div className="space-y-4 mt-3">
                                {/* Forecast Period */}
                                 <div className="p-2">
                                          
                                              <div className="">
                                                {fields.map((field) => (
                                                  <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2 mb-2' : 'mb-3'}>
                                                    <Label
                                                      htmlFor={field.name}
                                                      className="text-gray-800 dark:text-slate-300"
                                                    >
                                                      {field.label}
                                                    </Label>

                                                    {field.type === 'select' ? (
                                                      <Select
                                                        value={formData[field.name] || ''}
                                                        onValueChange={(value) => handleFormInputChange(field.name, value)}
                                                      >
                                                        <SelectTrigger className="bg-white border-gray-300 text-black placeholder:text-gray-500
                                                                                  dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400">
                                                          <SelectValue placeholder={`Select ${field.label}`} />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-white border-gray-300 text-black
                                                                                dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                                          {field.options?.map((option) => (
                                                            <SelectItem
                                                              key={option}
                                                              value={option}
                                                              className="text-black hover:bg-gray-100
                                                                        dark:text-white dark:hover:bg-slate-600"
                                                            >
                                                              {option}
                                                            </SelectItem>
                                                          ))}
                                                        </SelectContent>
                                                      </Select>
                                                    ) : field.type === 'textarea' ? (
                                                      <Textarea
                                                        id={field.name}
                                                        value={formData[field.name] || ''}
                                                        onChange={(e) => handleFormInputChange(field.name, e.target.value)}
                                                        className="w-full bg-white border-gray-300 text-black placeholder:text-gray-500
                                                                  dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400"
                                                        rows={3}
                                                        placeholder={field.placeholder}
                                                      />
                                                    ) : (
                                                      <Input
                                                        id={field.name}
                                                        type={field.type}
                                                        value={formData[field.name] || ''}
                                                        required={field.required}
                                                        placeholder={field.placeholder}
                                                        onChange={(e) => handleFormInputChange(field.name, e.target.value)}
                                                        className="w-full bg-white border-gray-300 text-black placeholder:text-gray-500
                                                                  dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400"
                                                      />
                                                    )}
                                                  </div>
                                                ))}
                                              </div> 
                                         </div>
                                {/* Apply Changes Button */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <Button
                                    size="sm"
                                    className="w-full mb-2"
                                    type="submit"
                                    disabled={formLoading}
                                  >
                                    {formLoading ? 'Saving' : 'Save'}
                                  </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="w-full"
                                      type="submit"
                                      onClick={() => setWhatIfNavigate(true)}
                                      disabled={formLoading}
                                    >
                                      {formLoading ? 'Saving' : 'Save and show Simulator'}
                                    </Button>
                                </div>
                              </div>
                              </form>  
                            </SheetContent>
                          </Sheet>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-x-4 gap-y-2">
          <Select value={currentSelectedBusinessUnit} onValueChange={handleSelectBusinessUnit}>
            <SelectTrigger className="w-full lg:w-[180px] text-sm h-9">
              <Building2 className="mr-2 opacity-70" />
              <SelectValue placeholder="Business Unit" />
            </SelectTrigger>
            <SelectContent>
              {currentFilterOptions.businessUnits.map((bu) => (
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
                        <DropdownMenuCheckboxItem
                          checked={currentSelectedLineOfBusiness.length === actualLobsForCurrentBu.length && actualLobsForCurrentBu.length > 0}
                          onCheckedChange={(checkedValue) => {
                            if (checkedValue) {
                              handleSelectLineOfBusiness(actualLobsForCurrentBu);
                            } else {
                              handleSelectLineOfBusiness([]);
                            }
                          }}
                          onSelect={(e) => e.preventDefault()}
                        >
                          Select All
                        </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {actualLobsForCurrentBu.length > 0 ? (
                actualLobsForCurrentBu.map((lob) => (
                  <DropdownMenuCheckboxItem
                    key={lob}
                    checked={currentSelectedLineOfBusiness.includes(lob)}
                    onCheckedChange={(checkedValue) => handleLobSelectionChange(lob, Boolean(checkedValue))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {lob}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No LOBs available for {currentSelectedBusinessUnit}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2 border rounded-md p-1 ">
            <Button
              variant={currentSelectedTimeInterval === "Week" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleSelectTimeInterval("Week")}
              className="h-7 px-3"
            >
              Week
            </Button>
            <Button
              variant={currentSelectedTimeInterval === "Month" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleSelectTimeInterval("Month")}
              className="h-7 px-3"
            >
              Month
            </Button>
          </div>
        {currentSelectedTimeInterval === "Month" ? (
          <MonthRangePicker date={currentSelectedDateRange} onDateChange={handleSelectDateRange} />
        ) : (
          <DateRangePicker date={currentSelectedDateRange} onDateChange={handleSelectDateRange} />
        )}
        </div>

        {/* Integrated Table Header Row */}
        {viewMode === 'plan' && (
            <div className="flex items-center border-b border-border bg-card px-4 h-12 mt-4 sticky top-0 z-40">
              <div className="sticky left-0 z-55 bg-card min-w-[320px] whitespace-nowrap px-4 py-2 text-sm font-semibold text-foreground h-full flex items-center">
                {activeHierarchyContext}
              </div>
              <div ref={headerPeriodScrollerRef} className="flex-grow overflow-x-auto scrollbar-thin whitespace-nowrap h-full">
                <div className="flex h-full min-w-max">
                  {displayedPeriodHeaders.map((period) => {
                    const parts = period.split(': ');
                    const weekLabelPart = parts.length > 0 ? parts[0].replace("FWk", "WK") : period;
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
                        className="text-right px-2 py-2 border-l border-border/50 h-full flex flex-col justify-center items-end min-w-[100px] max-w-[120px] flex-shrink-0"
                      >
                        <span className="text-sm font-medium text-foreground truncate w-full">{weekLabelPart}</span>
                        {dateRangePart && (
                          <span className="text-xs text-muted-foreground truncate w-full">
                            ({dateRangePart})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
        )}
        <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
      </header>
    </TooltipProvider>
  );
}

interface MetricRowProps {
  item: CapacityDataRow;
  metricDef: MetricDefinition;
  level: number;
  periodHeaders: string[];
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange'];
  onLobMetricChange: CapacityTableProps['onLobMetricChange'];
  editingCell: CapacityTableProps['editingCell'];
  onSetEditingCell: CapacityTableProps['onSetEditingCell'];
  selectedTimeInterval: TimeInterval;
}

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
  onActiveHierarchyChange: (newContext: string | null) => void;
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

  const rawValue = metricData ? metricData[metricDef.key as keyof typeof metricData] : null;

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
    if (tempValue === null) {
      onSetEditingCell(null, null, null);
      return;
    }

    if (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly && item.lobId) {
      onTeamMetricChange(item.lobId, item.name, periodName, metricDef.key as keyof TeamPeriodicMetrics, tempValue);
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
    // Hide LOB-specific metrics for BU level (either by key or isLobOnly flag)
    if (item.itemType === 'BU' && (
      metricDef.key === 'lobTotalBaseRequiredMinutes' || 
      metricDef.key === 'lobVolumeForecast' || 
      metricDef.key === 'lobAverageAHT' ||
      metricDef.key === 'handlingCapacity' ||
      (metricDef as any).isLobOnly
    )) {
      shouldDisplayMetric = false;
    } else {
      shouldDisplayMetric = true;
    }
  }

  if (!shouldDisplayMetric) {
    return (
      <div className="w-full h-full flex items-center justify-end pr-1">
        <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
      </div>
    );
  }

  // If rawValue is null or undefined, or NaN, display Minus icon, unless it's an editable empty cell
  if (rawValue === null || rawValue === undefined || (typeof rawValue === 'number' && isNaN(rawValue))) {
    const isEditableEmptyCell = canEditCell;
    return (
      <div
        onClick={isEditableEmptyCell ? handleEditClick : undefined}
        className={`${isEditableEmptyCell ? 'cursor-pointer group relative' : ''} w-full h-full flex items-center justify-end pr-1`}
      >
        <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
        {isEditableEmptyCell && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
      </div>
    );
  }

  // If rawValue is 0 and it's a number, display 0 explicitly
  if (typeof rawValue === 'number' && rawValue === 0) {
    const isEditableEmptyCell = canEditCell;
    return (
      <div
        onClick={isEditableEmptyCell ? handleEditClick : undefined}
        className={`relative flex items-center justify-end gap-1 ${canEditCell ? 'cursor-pointer group' : ''} w-full h-full pr-1`}
      >
        0
        {isEditableEmptyCell && <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1/2 -translate-y-1/2" />}
      </div>
    );
  }

  let displayValue: React.ReactNode = "";
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let formulaText = "";

  const numValue = Number(rawValue);
  const teamMetrics = metricData as TeamPeriodicMetrics;
  const aggMetrics = metricData as AggregatedPeriodicMetrics;
  const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES; // Example values, adjust as needed

  if (metricDef.isPercentage) {
    displayValue = `${numValue.toFixed(1)}%`;
  } else if (metricDef.isTime && (metricDef.key === 'aht' || metricDef.key === 'lobAverageAHT')) {
    displayValue = `${numValue.toFixed(1)} min`;
  } else if (metricDef.isTime && (metricDef.key === '_calculatedRequiredAgentMinutes' || metricDef.key === '_calculatedActualProductiveAgentMinutes' || metricDef.key === 'lobTotalBaseRequiredMinutes')) {
    displayValue = `${numValue.toFixed(0)} min`;
  } else if (metricDef.isHC) { // All HC metrics will be rounded to 0 decimal places
    displayValue = isNaN(numValue) ? '-' : numValue.toFixed(0);
  } else if (metricDef.isCount) {
    displayValue = isNaN(numValue) ? '-' : numValue.toFixed(0);
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
    // Default for other numeric values not explicitly handled above
    const fractionDigits = 2;
    displayValue = numValue.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  } else {
    displayValue = String(rawValue);
  }

  // Replace "FWk" with "Wk" in the periodName for the tooltip
  const formattedPeriodNameForTooltip = periodName.replace("FWk", "Wk");
  let baseTooltipText = `${item.name} - ${formattedPeriodNameForTooltip}\n${metricDef.label}: ${displayValue}`;
  if (metricDef.description) { // Show description for all item types if available
    baseTooltipText += `\n${metricDef.description}`;
  }


  if (item.itemType === 'Team') {
    switch (metricDef.key) {
      case 'requiredHC':
        if (teamMetrics && typeof teamMetrics._calculatedRequiredAgentMinutes === 'number' &&
            typeof teamMetrics.inOfficeShrinkagePercentage === 'number' &&
            typeof teamMetrics.outOfOfficeShrinkagePercentage === 'number' &&
            typeof teamMetrics.occupancyPercentage === 'number' &&
            standardWorkMinutesForPeriod > 0 &&
            teamMetrics.occupancyPercentage > 0) {
            const effectiveMinutesPerHC = standardWorkMinutesForPeriod *
                                          (1 - (teamMetrics.inOfficeShrinkagePercentage / 100)) *
                                          (1 - (teamMetrics.outOfOfficeShrinkagePercentage / 100)) *
                                          (teamMetrics.occupancyPercentage / 100);
            if (effectiveMinutesPerHC > 0) {
              formulaText = `Formula: (Eff. Req. Mins) / (Std Mins * (1 - In Office Shrink%) * (1 - Out of Office Shrink%) * Occupancy%)\n` +
                            `Calc: ${teamMetrics._calculatedRequiredAgentMinutes.toFixed(0)} / (${standardWorkMinutesForPeriod.toFixed(0)} * (1 - ${(teamMetrics.inOfficeShrinkagePercentage / 100).toFixed(2)}) * (1 - ${(teamMetrics.outOfOfficeShrinkagePercentage / 100).toFixed(2)}) * ${(teamMetrics.occupancyPercentage / 100).toFixed(2)}) = ${numValue.toFixed(2)}\n` +
                            `(Effective Mins per HC: ${effectiveMinutesPerHC.toFixed(0)})`;
            } else {
              formulaText = `Formula: (Eff. Req. Mins) / (Std Mins * (1 - In Office Shrink%) * (1 - Out of Office Shrink%) * Occupancy%)\n` +
                            `Calculation inputs result in division by zero or invalid effective minutes per HC (check shrinkage & occupancy).`;
            }
        } else {
            formulaText = `Formula: (Eff. Req. Mins) / (Std Mins * (1 - In Office Shrink%) * (1 - Out of Office Shrink%) * Occupancy%)\n` +
                          `Calculation inputs missing or invalid (check inputs for Eff. Req. Mins, Shrinkages, Occupancy).`;
        }
        break;
      case '_calculatedRequiredAgentMinutes':
        if (teamMetrics && typeof teamMetrics.volumeMixPercentage === 'number' &&
            typeof teamMetrics.backlogPercentage === 'number' &&
            typeof teamMetrics._lobTotalBaseReqMinutesForCalc === 'number') {
            const lobTotalBase = teamMetrics._lobTotalBaseReqMinutesForCalc;
            const baseTeamRequiredMinutes = lobTotalBase * (teamMetrics.volumeMixPercentage / 100);
            const effectiveTeamRequiredMinutes = baseTeamRequiredMinutes * (1 + (teamMetrics.backlogPercentage / 100));
            formulaText = `Formula: (Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)\n` +
                          `Calc: ${lobTotalBase.toFixed(0)} * (${teamMetrics.volumeMixPercentage.toFixed(1)}%) * (1 + ${teamMetrics.backlogPercentage.toFixed(1)}%) = ${effectiveTeamRequiredMinutes.toFixed(0)} min\n` +
                          `Represents team's share of LOB demand, adjusted for team's backlog.`;
        } else {
            formulaText = `Formula: (Total Base Req Mins * Team Vol Mix %) * (1 + Team Backlog %)\n` +
                          `Calculation inputs missing or invalid.`;
        }
        break;
      case 'overUnderHC':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
          teamMetrics?.requiredHC !== null && teamMetrics?.requiredHC !== undefined) {
          formulaText = `Formula: Actual HC - Required HC\nCalc: ${teamMetrics.actualHC.toFixed(0)} - ${teamMetrics.requiredHC.toFixed(0)} = ${numValue.toFixed(0)}`;
        }
        break;
      case 'attritionLossHC':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
          teamMetrics?.attritionPercentage !== null && teamMetrics?.attritionPercentage !== undefined) {
          formulaText = `Formula: Actual HC * Attrition %\nCalc: ${teamMetrics.actualHC.toFixed(0)} * ${(teamMetrics.attritionPercentage / 100).toFixed(3)} = ${numValue.toFixed(0)}`;
        }
        break;
      case 'hcAfterAttrition':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
          teamMetrics?.attritionLossHC !== null && teamMetrics?.attritionLossHC !== undefined) {
          formulaText = `Formula: Actual HC - Attrition Loss HC\nCalc: ${teamMetrics.actualHC.toFixed(0)} - ${teamMetrics.attritionLossHC.toFixed(0)} = ${numValue.toFixed(0)}`;
        }
        break;
      case 'endingHC':
        if (teamMetrics?.hcAfterAttrition !== null && teamMetrics?.hcAfterAttrition !== undefined &&
          teamMetrics?.newHireProduction !== null && teamMetrics?.newHireProduction !== undefined &&
          teamMetrics?.moveIn !== null && teamMetrics?.moveIn !== undefined &&
          teamMetrics?.moveOut !== null && teamMetrics?.moveOut !== undefined) {
          formulaText = `Formula: HC After Attrition + New Hire Prod. + Move In - Move Out\n` +
            `Calc: ${teamMetrics.hcAfterAttrition.toFixed(0)} + ${teamMetrics.newHireProduction.toFixed(0)} + ${teamMetrics.moveIn.toFixed(0)} - ${teamMetrics.moveOut.toFixed(0)} = ${numValue.toFixed(0)}`;
        }
        break;
      case '_calculatedActualProductiveAgentMinutes':
        if (teamMetrics?.actualHC !== null && teamMetrics?.actualHC !== undefined &&
          teamMetrics?.inOfficeShrinkagePercentage !== null && teamMetrics.outOfOfficeShrinkagePercentage !== null &&
          teamMetrics?.occupancyPercentage !== null && standardWorkMinutesForPeriod > 0) {
          const prodMins = teamMetrics.actualHC * standardWorkMinutesForPeriod *
            (1 - (teamMetrics.inOfficeShrinkagePercentage / 100)) *
            (1 - (teamMetrics.outOfOfficeShrinkagePercentage / 100)) *
            (teamMetrics.occupancyPercentage / 100);
          // The formula is in the description, so formulaText should just be the calculation.
          formulaText = `Calc: ${teamMetrics.actualHC.toFixed(0)} * ${standardWorkMinutesForPeriod.toFixed(0)} * ` +
                        `(1 - ${(teamMetrics.inOfficeShrinkagePercentage / 100).toFixed(2)}) * ` +
                        `(1 - ${(teamMetrics.outOfOfficeShrinkagePercentage / 100).toFixed(2)}) * ` +
                        `${(teamMetrics.occupancyPercentage / 100).toFixed(2)} = ${prodMins.toFixed(0)}`;
        } else {
          formulaText = `Calculation inputs missing or invalid (Actual HC, Shrinkages, Occupancy).`;
        }
        break;
    }
  } else {
    switch (metricDef.key) {
      case 'overUnderHC':
        if (aggMetrics?.actualHC !== null && aggMetrics?.actualHC !== undefined &&
          aggMetrics?.requiredHC !== null && aggMetrics?.requiredHC !== undefined) {
          formulaText = `Formula: Aggregated Actual HC - Aggregated Required HC\nCalc: ${aggMetrics.actualHC.toFixed(0)} - ${aggMetrics.requiredHC.toFixed(0)} = ${numValue.toFixed(0)}`;
        }
        break;
      case 'requiredHC':
      case 'actualHC': {
        const childType = item.itemType === 'BU' ? 'LOBs' : 'Teams';
        let formulaStr = `Formula: SUM(${metricDef.label} from child ${childType})`;
        let calcStr = "\nCalculation:\n";
        let sum = 0;
        let childrenAvailable = false;

        if (item.children && item.children.length > 0) {
          childrenAvailable = true;
          item.children.forEach((child, index) => {
            const childMetricValue = child.periodicData[periodName]?.[metricDef.key as keyof (TeamPeriodicMetrics | AggregatedPeriodicMetrics)];
            const value = typeof childMetricValue === 'number' ? childMetricValue : 0;
            sum += value;
            calcStr += `  ${child.name}: ${value.toFixed(metricDef.isHC ? 0 : 2)}${index < item.children!.length - 1 ? ' +' : ''}\n`;
          });
          calcStr += `  --------------------\n`;
          calcStr += `  Total = ${sum.toFixed(metricDef.isHC ? 0 : 2)}`;
        } else {
          calcStr += "  No child data available for detailed sum.";
        }
        formulaText = `${formulaStr}\n${calcStr}`;
        break;
      }
      case 'lobTotalBaseRequiredMinutes':
        if (item.itemType === 'LOB' && aggMetrics && 'lobVolumeForecast' in aggMetrics && 'lobAverageAHT' in aggMetrics) {
          const volume = aggMetrics.lobVolumeForecast;
          const aht = aggMetrics.lobAverageAHT;
          const calculatedMins = (typeof volume === 'number' && typeof aht === 'number' && volume > 0 && aht > 0) ? volume * aht : numValue;
          formulaText = `Formula: Volume Forecast * Avg AHT\n` +
            `Calc: ${volume?.toFixed(0) ?? 'N/A'} * ${aht?.toFixed(1) ?? 'N/A'} = ${calculatedMins.toFixed(0)}\n` +
            `(Current value may be a direct input or calculated)`;
        } else if (item.itemType === 'BU') {
          let formulaStr = `Formula: SUM(${metricDef.label} from child LOBs)`;
          let calcStr = "\nCalculation:\n";
          let sum = 0;
          if (item.children && item.children.length > 0) {
            item.children.forEach((child, index) => {
              const childMetricValue = child.periodicData[periodName]?.[metricDef.key as keyof AggregatedPeriodicMetrics];
              const value = typeof childMetricValue === 'number' ? childMetricValue : 0;
              sum += value;
              calcStr += `  ${child.name}: ${value.toFixed(0)}${index < item.children!.length - 1 ? ' +' : ''}\n`;
            });
            calcStr += `  --------------------\n`;
            calcStr += `  Total = ${sum.toFixed(0)}`;
          } else {
            calcStr += "  No child LOB data available for detailed sum.";
          }
          formulaText = `${formulaStr}\n${calcStr}`;
        }
        break;
      case 'lobVolumeForecast': // Add similar BU level sum for lobVolumeForecast
        if (item.itemType === 'BU') {
          let formulaStr = `Formula: SUM(${metricDef.label} from child LOBs)`;
          let calcStr = "\nCalculation:\n";
          let sum = 0;
          if (item.children && item.children.length > 0) {
            item.children.forEach((child, index) => {
              const childMetricValue = child.periodicData[periodName]?.[metricDef.key as keyof AggregatedPeriodicMetrics];
              const value = typeof childMetricValue === 'number' ? childMetricValue : 0;
              sum += value;
              calcStr += `  ${child.name}: ${value.toFixed(0)}${index < item.children!.length - 1 ? ' +' : ''}\n`;
            });
            calcStr += `  --------------------\n`;
            calcStr += `  Total = ${sum.toFixed(0)}`;
          } else {
            calcStr += "  No child LOB data available for detailed sum.";
          }
          formulaText = `${formulaStr}\n${calcStr}`;
        }
        // Note: LOB level lobVolumeForecast doesn't need specific formulaText here, 
        // as it's an input or covered by description.
        break;
      case 'handlingCapacity':
        if (item.itemType === 'LOB' && aggMetrics && 
            aggMetrics.lobVolumeForecast !== null && aggMetrics.lobVolumeForecast !== undefined &&
            aggMetrics.lobAverageAHT !== null && aggMetrics.lobAverageAHT !== undefined) {
          if (aggMetrics.lobAverageAHT > 0) {
            const calculatedCapacity = aggMetrics.lobVolumeForecast / aggMetrics.lobAverageAHT;
            // Description already contains "Formula: ...", so formulaText should just be the calculation.
            formulaText = `Calc: ${aggMetrics.lobVolumeForecast.toFixed(0)} / ${aggMetrics.lobAverageAHT.toFixed(1)} = ${calculatedCapacity.toFixed(0)}`;
          } else {
            // Description contains "Formula: ...", so note why calc is not possible.
            formulaText = `LOB Average AHT is zero or not available, cannot calculate.`;
          }
        } else {
          // Description contains "Formula: ...", so note why calc is not possible.
          formulaText = `LOB Volume Forecast or LOB Average AHT not available for calculation.`;
        }
        break;
    }
  }

  if (metricDef.key === "overUnderHC") {
    if (numValue >= 0) {
      textColor = "text-primary"; // Green for >= 0
      if (numValue > 0.001) { // Only show arrow up if actually over
        icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
      }
    } else { // numValue < 0 (under HC)
      const requiredHC = (metricData as BaseHCValues)?.requiredHC;
      if (requiredHC === null || requiredHC === 0) {
        // If requiredHC is 0 or null, any negative overUnderHC is critical
        textColor = "text-destructive"; // Red
        icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
      } else {
        const percentageUnder = (Math.abs(numValue) / requiredHC) * 100;
        if (percentageUnder >= 5) { // 5% or more under is Red
          textColor = "text-destructive"; // Red
          icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
        } else { // Less than 5% under is Amber
          textColor = "text-orange-500"; // Amber
          icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
        }
      }
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

const MetricRow: React.FC<MetricRowProps> = React.memo(({ item, metricDef, level, periodHeaders, onTeamMetricChange, onLobMetricChange, editingCell, onSetEditingCell, selectedTimeInterval }) => {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell
        className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2 pr-4 w-[200px]"
      >
        <div
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
          className="flex items-center gap-2 cursor-default w-full max-w-full overflow-hidden"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-default" title={metricDef.description}>
                <span>{metricDef.label}</span>
                {item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly &&
                  (metricDef.category === 'Assumption' || metricDef.category === 'PrimaryHC' || metricDef.category === 'HCAdjustment') &&
                  <Edit3 className="h-3 w-3 text-muted-foreground opacity-50" />}
              </div>
            </TooltipTrigger>
            {metricDef.description && (
              <TooltipContent className="whitespace-pre-wrap text-xs max-w-xs">
                <p>{metricDef.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </TableCell>
      {periodHeaders.map(ph => {
        const metricForPeriod = item.periodicData[ph];
        let cellTextColor = "text-foreground";
        if (metricDef.key === "overUnderHC" && metricForPeriod && (metricForPeriod as any)[metricDef.key] !== null && (metricForPeriod as any)[metricDef.key] !== undefined) {
          const value = Number((metricForPeriod as any)[metricDef.key]);
          if (value < -0.001) cellTextColor = "text-destructive";
          else if (value > 0.001) cellTextColor = "text-primary";
        }

        const currentEditId = item.itemType === 'Team' && item.lobId ? `${item.lobId}_${item.name.replace(/\s+/g, '-')}` : item.id;
        const isCurrentlyEditing =
          editingCell?.id === currentEditId &&
          editingCell?.period === ph &&
          editingCell?.metricKey === metricDef.key;

        return (
          <TableCell
            key={`${item.id}-${metricDef.key}-${ph}`}
            className={`text-right tabular-nums ${cellTextColor} py-2 px-2 min-w-[100px] border-l border-border/50`}
          >
            <MetricCellContent
              item={item}
              metricData={metricForPeriod}
              metricDef={metricDef}
              periodName={ph}
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

const CapacityTableComponent: React.FC<CapacityTableProps> = ({
  data,
  periodHeaders,
  expandedItems,
  toggleExpand,
  teamMetricDefinitions,
  aggregatedMetricDefinitions,
  onTeamMetricChange,
  onLobMetricChange,
  editingCell,
  onSetEditingCell,
  selectedTimeInterval,
  onActiveHierarchyChange,
  tableBodyScrollRef,
}) => {
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
    const currentScrollContainer = tableBodyScrollRef.current;

    if (currentScrollContainer) {
      const options: IntersectionObserverInit = {
        root: currentScrollContainer,
        rootMargin: `5px 0px -90% 0px`,
        threshold: 0.01,
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
  }, [periodHeaders, data, onActiveHierarchyChange, tableBodyScrollRef]);

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
      rows.push(...renderTeamMetrics(item, 'PrimaryHC', item.level + 1));

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
          {periodHeaders.map(ph => <TableCell key={`${assumptionsKey}-${ph}-placeholder`} className="py-2 border-l border-border/50"></TableCell>)}
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
          {periodHeaders.map(ph => <TableCell key={`${hcAdjustmentsKey}-${ph}-placeholder`} className="py-2 border-l border-border/50"></TableCell>)}
        </TableRow>
      );
      if (areHcAdjustmentsExpanded) {
        rows.push(...renderTeamMetrics(item, 'HCAdjustment', item.level + 2));
      }
    } else {
      AGGREGATED_METRIC_ROW_DEFINITIONS.forEach(metricDef => {
        // Skip LOB-specific metrics for BU level as per user request (already handled in MetricCellContent)
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
            rowSpecificBgClass
          )}
          style={{
            zIndex: itemZIndex,
            width: '400px',
            minWidth: '335px',
            paddingLeft: `${Math.min(item.level, 5) * 1.5 + 0.5}rem`,
            paddingRight: '1rem'
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
            className={cn(rowSpecificBgClass, 'py-3 min-w-[100px] border-l border-border/50')}
          ></TableCell>
        ))}
      </TableRow>
    );

    if (isExpanded) {
      if (item.itemType === 'BU' || item.itemType === 'LOB') {
        const aggregatedMetricRows = renderCapacityItemContent(item);
        rows.push(...aggregatedMetricRows);
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            rows.push(...renderTableItem(child));
          });
        }
      } else if (item.itemType === 'Team') {
        const teamMetricStructure = renderCapacityItemContent(item);
        rows.push(...teamMetricStructure);
      }
    } else if (!isItemExpandable && (item.itemType === 'BU' || item.itemType === 'LOB')) {
      // This block is for non-expandable BUs/LOBs, but BUs/LOBs are always expandable if they have children.
      // This condition might be redundant if all BUs/LOBs with children are always expandable.
      const itemMetricRows = renderCapacityItemContent(item);
      rows.push(...itemMetricRows);
    }

    return rows;
  }, [expandedItems, periodHeaders, toggleExpand, renderCapacityItemContent]);

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={tableBodyScrollRef} className="overflow-x-auto">
        <Table className="min-w-full">
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

const CapacityTable = React.memo(CapacityTableComponent);

// --- MAIN PAGE COMPONENT ---
let rawCapacityDataSource: RawLoBCapacityEntry[] = JSON.parse(JSON.stringify(initialMockRawCapacityData));

// Base HSL colors for charts - these are chosen to be distinct enough
const BASE_CHART_HSL_COLORS = [
  '222.2 47.4% 40%', // A shade of primary blue
  '142.1 76.2% 36.3%', // A shade of green
  '346.8 77.2% 49.8%', // A shade of red/pink
  '48.5 95.3% 50.8%', // A shade of yellow/orange
  '262.1 83.3% 57.8%', // A shade of purple
  '174.9 70.9% 49.4%', // A shade of cyan
  '39.2 95.3% 60.8%', // A golden yellow
  '290 60% 50%', // A magenta
];

// Helper to generate lighter shades from a base HSL string
const getShade = (hsl: string, lightnessOffset: number) => {
  const parts = hsl.split(' ');
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1].replace('%', ''));
  const l = parseFloat(parts[2].replace('%', ''));
  const newL = Math.min(100, l + lightnessOffset); // Ensure lightness doesn't exceed 100
  return `hsl(${h} ${s}% ${newL}%)`;
};

export default function CapacityInsightsPageV2({
  navigateSimulator,
  businessId,
  teamMetricDefinitions = TEAM_METRIC_ROW_DEFINITIONS,
  aggregatedMetricDefinitions = AGGREGATED_METRIC_ROW_DEFINITIONS,
  calculateTeamMetricsForPeriod: calculateTeamMetricsForPeriodProp = calculateTeamMetricsForPeriod,
  modelName = "Volume & Backlog Hybrid Model",
}) {
  const [localRawCapacityDataSource, setLocalRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => {
    // Adjust initialMockRawCapacityData if its generation depends on specific BU names not present in V2
    // For now, assuming initialMockRawCapacityData generation logic is compatible or will be reviewed in the next step
    return JSON.parse(JSON.stringify(initialMockRawCapacityData));
  });

  useEffect(() => {
    rawCapacityDataSource = localRawCapacityDataSource;
  }, [localRawCapacityDataSource]);

  // --- Plan View States (V2) ---
  const defaultPOSLoBs = useMemo(() => ["Phone", "Chat", "Case Type 1"], []); // Example default LOBs for POS
  const [selectedPlanBusinessUnit, setSelectedPlanBusinessUnit] = useState<BusinessUnitNameV2>("POS");
  const [selectedPlanLineOfBusiness, setSelectedPlanLineOfBusiness] = useState<string[]>(() => {
    const initialBuLobs = BUSINESS_UNIT_CONFIG_V2["POS"].lonsOfBusiness;
    return defaultPOSLoBs.filter(lob => initialBuLobs.includes(lob as LineOfBusinessNameV2<"POS">));
  });
  const [selectedPlanTimeInterval, setSelectedPlanTimeInterval] = useState<TimeInterval>("Week");
  const [selectedPlanDateRange, setSelectedPlanDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week", 51));

  // --- Chart View States (V2) ---
  const defaultChartBusinessUnitV2: BusinessUnitNameV2 = "POS";
  const defaultChartLobsV2 = useMemo(() => BUSINESS_UNIT_CONFIG_V2[defaultChartBusinessUnitV2].lonsOfBusiness.slice(0, 2), []);
  const [selectedChartBusinessUnit, setSelectedChartBusinessUnit] = useState<BusinessUnitNameV2>(defaultChartBusinessUnitV2);
  const [selectedChartLineOfBusiness, setSelectedChartLineOfBusiness] = useState<string[]>(defaultChartLobsV2);
  const [selectedChartTimeInterval, setSelectedChartTimeInterval] = useState<TimeInterval>("Week");
  const [selectedChartDateRange, setSelectedChartDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week", 10));

  const [planFilterOptions, setPlanFilterOptions] = useState<FilterOptions>(() => ({
    businessUnits: [...ALL_BUSINESS_UNITS_V2],
    linesOfBusiness: [...BUSINESS_UNIT_CONFIG_V2["POS"].lonsOfBusiness],
  }));

  const [chartFilterOptions, setChartFilterOptions] = useState<FilterOptions>(() => ({
    businessUnits: [...ALL_BUSINESS_UNITS_V2],
    linesOfBusiness: [...BUSINESS_UNIT_CONFIG_V2[defaultChartBusinessUnitV2].lonsOfBusiness],
  }));


  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);

  // Initialize expandedItems to expand only the initially selected business unit
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    const initialExpanded: Record<string, boolean> = {};
    initialExpanded[selectedPlanBusinessUnit] = true; // Expand the default selected BU for plan view
    return initialExpanded;
  });

  // Effect to expand the selected business unit whenever it changes
  useEffect(() => {
    setExpandedItems(prev => ({
      ...prev,
      [selectedPlanBusinessUnit]: true
    }));
  }, [selectedPlanBusinessUnit]);


  const [editingCell, setEditingCell] = useState<{ id: string; period: string; metricKey: string } | null>(null);
  const [viewMode, setViewMode] = useState<'plan' | 'chart'>('plan'); // 'plan' or 'chart'

  const [activeHierarchyContext, setActiveHierarchyContext] = useState<string>("BU / LoB / Team / Metric");

  const headerPeriodScrollerRef = useRef<HTMLDivElement>(null);
  const tableBodyScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleActiveHierarchyContextChange = useCallback((newContext: string | null) => {
    setActiveHierarchyContext(newContext || "BU / LoB / Team / Metric");
  }, []);

  const handleSetEditingCell = useCallback((id: string | null, period: string | null, metricKey: string | null) => {
    if (id && period && metricKey) {
      setEditingCell({ id, period, metricKey });
    } else {
      setEditingCell(null);
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    if (displayableCapacityData.length === 0 || displayedPeriodHeaders.length === 0) {
      alert("No data to export.");
      return;
    }

    let csvContent = "Hierarchy,Metric," + displayedPeriodHeaders.map(header => header.replace(/FWk/g, 'WK')).join(",") + "\n";

    const processRow = (row: CapacityDataRow, level: number) => {
      const indent = "  ".repeat(level);
      const metricsToInclude = row.itemType === 'Team' ? TEAM_METRIC_ROW_DEFINITIONS : AGGREGATED_METRIC_ROW_DEFINITIONS;

      metricsToInclude.forEach(metricDef => {
        // Skip internal metrics for export
        if (metricDef.category === 'Internal') return;

        // Skip LOB-specific metrics for BU level in export
        if (row.itemType === 'BU' && (metricDef.key === 'lobTotalBaseRequiredMinutes' || metricDef.key === 'lobVolumeForecast' || metricDef.key === 'lobAverageAHT')) {
          return;
        }

        let rowData = `${indent}${row.name},${metricDef.label}`;
        displayedPeriodHeaders.forEach(period => {
          const metricValue = row.periodicData[period]?.[metricDef.key as keyof (TeamPeriodicMetrics | AggregatedPeriodicMetrics)];
          let formattedValue = '';
          if (metricValue !== null && metricValue !== undefined) {
            const numValue = Number(metricValue);
            if (!isNaN(numValue)) {
              if (metricDef.isPercentage) {
                formattedValue = numValue.toFixed(1) + "%";
              } else if (metricDef.isTime) {
                formattedValue = numValue.toFixed(0); // Minutes rounded to whole number
              } else if (metricDef.isHC || metricDef.isCount) {
                formattedValue = numValue.toFixed(0); // HC and Count rounded to whole number
              } else {
                formattedValue = numValue.toFixed(2); // Default to 2 decimal places for other numbers
              }
            } else {
              formattedValue = ''; // Handle NaN or non-numeric values
            }
          }
          rowData += `,${formattedValue}`;
        });
        csvContent += rowData + "\n";
      });

      if (row.children) {
        row.children.forEach(child => processRow(child, level + 1));
      }
    };

    displayableCapacityData.forEach(bu => processRow(bu, 0));

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // feature detection
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'capacity_insights.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback for older browsers
      alert("Your browser does not support downloading files directly. Please copy the data manually.");
    }
  }, [displayableCapacityData, displayedPeriodHeaders]);


  const handleTeamMetricChange = useCallback((
    lobId: string,
    teamNameToUpdate: TeamName,
    periodHeader: string,
    metricKey: keyof TeamPeriodicMetrics,
    rawValue: string
  ) => {
    const newValueParsed = rawValue === "" || rawValue === "-" ? null : parseFloat(rawValue);
    if (rawValue !== "" && rawValue !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null && metricKey !== 'someStringFieldIfAny') {
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
        teamEntry.periodicInputData[periodHeader] = {};
      }

      (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = newValue;

      if (metricKey === 'aht') {
        // Recalculate average AHT for the LOB when team AHT changes
        let ahtSum = 0;
        let teamCount = 0;
        lobEntry.teams.forEach(team => {
          const teamPeriodData = team.periodicInputData[periodHeader];
          if (teamPeriodData?.aht !== null && teamPeriodData?.aht !== undefined) {
            ahtSum += teamPeriodData.aht;
            teamCount++;
          }
        });
        const calculatedAvgAHT = teamCount > 0 ? ahtSum / teamCount : null;
        
        if (!lobEntry.lobAverageAHT) lobEntry.lobAverageAHT = {};
        lobEntry.lobAverageAHT[periodHeader] = calculatedAvgAHT;
      } else if (metricKey === 'volumeMixPercentage') {
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
              if (!team.periodicInputData[periodHeader]) team.periodicInputData[periodHeader] = {};
              const teamPeriodData = team.periodicInputData[periodHeader];

              const originalShareOfOthers = (teamPeriodData?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShareOfOthers;

              if (i === otherTeams.length - 1) {
                let currentMix = remainingMixPercentage - distributedSum;
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1))));
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
          } else {
            const mixPerOtherTeam = otherTeams.length > 0 ? parseFloat((remainingMixPercentage / otherTeams.length).toFixed(1)) : 0;
            let distributedSum = 0;
            otherTeams.forEach((team, i) => {
              if (!team.periodicInputData[periodHeader]) team.periodicInputData[periodHeader] = {};
              let currentMix = mixPerOtherTeam;
              if (i === otherTeams.length - 1) {
                currentMix = remainingMixPercentage - distributedSum;
              }
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(currentMix.toFixed(1))));
              distributedSum += parseFloat(currentMix.toFixed(1));
            });
          }
        }
        let finalSum = lobEntry.teams.reduce((sum, t) => {
          const teamPeriodData = t.periodicInputData[periodHeader];
          return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        }, 0);

        if (Math.abs(finalSum - 100) > 0.01 && lobEntry.teams.length > 0) {
          const diff = 100 - finalSum;
          let teamToAdjust = lobEntry.teams.find(t => t.teamName === teamNameToUpdate) ||
            lobEntry.teams.find(t => (t.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0) > 0) ||
            lobEntry.teams[0];
          if (!teamToAdjust.periodicInputData[periodHeader]) {
            teamToAdjust.periodicInputData[periodHeader] = {};
          }
          const currentMixToAdjust = (teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage ?? 0;
          (teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage =
            Math.max(0, Math.min(100, parseFloat((currentMixToAdjust + diff).toFixed(1))));
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
      return;
    }
    const newValue = newValueParsed;

    setLocalRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntryIndex = newData.findIndex(lob => lob.id === lobId);
      if (lobEntryIndex === -1) return prevRawData;

      const lobEntry = newData[lobEntryIndex];

      if (metricKey === 'lobVolumeForecast' || metricKey === 'lobAverageAHT') {
        if (!lobEntry[metricKey]) {
          (lobEntry as any)[metricKey] = {};
        }
        (lobEntry[metricKey] as any)[periodHeader] = newValue;

        const volume = lobEntry.lobVolumeForecast?.[periodHeader];
        const aht = lobEntry.lobAverageAHT?.[period];
        if (typeof volume === 'number' && volume > 0 && typeof aht === 'number' && aht > 0) {
          if (!lobEntry.lobTotalBaseRequiredMinutes) lobEntry.lobTotalBaseRequiredMinutes = {};
          lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = volume * aht;
        } else if (volume === null || aht === null || volume === 0 || aht === 0) {
          if (!lobEntry.lobTotalBaseRequiredMinutes) lobEntry.lobTotalBaseRequiredMinutes = {};
          lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = null;
        }
      } else if (metricKey === 'lobTotalBaseRequiredMinutes') {
        if (!lobEntry.lobTotalBaseRequiredMinutes) {
          lobEntry.lobTotalBaseRequiredMinutes = {};
        }
        lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = newValue;
      }

      return newData;
    });
  }, []);

  const handlePlanBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedPlanBusinessUnit(bu);
    const newBuConfig = BUSINESS_UNIT_CONFIG[bu];
    const allLobsForNewBu = [...newBuConfig.lonsOfBusiness];
    let newDefaultSelectedLobs: string[];

    if (bu === "POS") { // Updated to POS
      newDefaultSelectedLobs = defaultPOSLoBs.filter(lob =>
        allLobsForNewBu.includes(lob as LineOfBusinessNameV2<"POS">) // Use V2 types
      );
    } else {
      // For other BUs (e.g., MOS), select all its LOBs by default
      newDefaultSelectedLobs = [...allLobsForNewBu];
    }
    setSelectedPlanLineOfBusiness(newDefaultSelectedLobs);
    setPlanFilterOptions(prev => ({
      ...prev,
      linesOfBusiness: allLobsForNewBu
    }));
  }, [defaultPOSLoBs]); // Updated dependency

  const handlePlanLOBChange = useCallback((lobs: readonly string[] | string[]) => {
    setSelectedPlanLineOfBusiness([...lobs]);
  }, []);

  const handlePlanTimeIntervalChange = useCallback((interval: TimeInterval) => {
    setSelectedPlanTimeInterval(interval);
    setSelectedPlanDateRange(getDefaultDateRange(interval, 51));
  }, []);

  const handleChartBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedChartBusinessUnit(bu);
    const newBuConfig = BUSINESS_UNIT_CONFIG[bu];
    const allLobsForNewBu = [...newBuConfig.lonsOfBusiness];
    setSelectedChartLineOfBusiness(allLobsForNewBu.slice(0, 2)); // Default to first 2 LOBs
    setChartFilterOptions(prev => ({
      ...prev,
      linesOfBusiness: allLobsForNewBu
    }));
  }, []);

  const handleChartLOBChange = useCallback((lobs: string[]) => {
    setSelectedChartLineOfBusiness(lobs);
  }, []);

  const handleChartTimeIntervalChange = useCallback((interval: TimeInterval) => {
    setSelectedChartTimeInterval(interval);
    setSelectedChartDateRange(getDefaultDateRange(interval, 10)); // Default to first 10 weeks
  }, []);


  const processDataForTable = useCallback(() => {
    const currentSelectedBusinessUnit = viewMode === 'plan' ? selectedPlanBusinessUnit : selectedChartBusinessUnit;
    const currentSelectedLineOfBusiness = viewMode === 'plan' ? selectedPlanLineOfBusiness : selectedChartLineOfBusiness;
    const currentSelectedTimeInterval = viewMode === 'plan' ? selectedPlanTimeInterval : selectedChartTimeInterval;
    const currentSelectedDateRange = viewMode === 'plan' ? selectedPlanDateRange : selectedChartDateRange;

    const sourcePeriods = currentSelectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    let periodsToDisplayCurrently: string[] = [];

    if (currentSelectedDateRange?.from) {
      const userRangeStart = startOfMonth(currentSelectedDateRange.from);
      const userRangeEnd = currentSelectedDateRange.to ? endOfMonth(currentSelectedDateRange.to) : endOfMonth(userRangeStart);
        periodsToDisplayCurrently = sourcePeriods.filter(periodHeaderStr => {
          const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, currentSelectedTimeInterval);
          if (!periodStartDate || !periodEndDate) return false;
          return (
            (isAfter(periodEndDate, userRangeStart) || isSameMonth(periodEndDate, userRangeStart)) &&
            (isBefore(periodStartDate, userRangeEnd) || isSameMonth(periodStartDate, userRangeEnd))
          );
        });
    } else {
      const numPeriodsToDefault = viewMode === 'plan' ? 51 : (currentSelectedTimeInterval === "Month" ? 12 : 10);
      periodsToDisplayCurrently = sourcePeriods.slice(0, numPeriodsToDefault);
    }

    if (headerPeriodScrollerRef.current) headerPeriodScrollerRef.current.scrollLeft = 0;
    if (tableBodyScrollRef.current) tableBodyScrollRef.current.scrollLeft = 0;

    setDisplayedPeriodHeaders(periodsToDisplayCurrently);

    const standardWorkMinutes = currentSelectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;
    const newDisplayData: CapacityDataRow[] = [];

    const buName = currentSelectedBusinessUnit;
    const relevantRawLobEntriesForSelectedBu = localRawCapacityDataSource.filter(d => d.bu === buName);

    if (relevantRawLobEntriesForSelectedBu.length === 0) {
      setDisplayableCapacityData([]);
      return;
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    const lobsToProcessForThisBu = currentSelectedLineOfBusiness.length === 0
      ? []
      : relevantRawLobEntriesForSelectedBu.filter(lobEntry => currentSelectedLineOfBusiness.includes(lobEntry.lob));

    lobsToProcessForThisBu.forEach(lobRawEntry => {
      const childrenTeamsDataRows: CapacityDataRow[] = [];
      const teamsToProcess = lobRawEntry.teams || [];
      const lobCalculatedBaseRequiredMinutes: Record<string, number | null> = {}; // For LOB display

      // Aggregate LOB inputs first if it's Month view
      const monthlyAggregatedLobInputs: {
        lobVolumeForecast: Record<string, number | null>;
        lobAverageAHT: Record<string, number | null>;
        lobTotalBaseRequiredMinutes?: Record<string, number | null>;
      } = { lobVolumeForecast: {}, lobAverageAHT: {}, lobTotalBaseRequiredMinutes: {} };

      if (currentSelectedTimeInterval === "Month") {
        periodsToDisplayCurrently.forEach(monthPeriod => {
          const { startDate: monthStartDate, endDate: monthEndDate } = getHeaderDateRange(monthPeriod, "Month");
          if (!monthStartDate || !monthEndDate) return;

          let totalVolumeForMonth = 0;
          let weightedAhtSum = 0;
          let totalMinutesForMonth = 0;
          let weeksInMonthCount = 0;
          let hasAnyWeeklyData = false;

          ALL_WEEKS_HEADERS.forEach(weekHeader => {
            const { startDate: weekStartDate, endDate: weekEndDate } = getHeaderDateRange(weekHeader, "Week");
            if (weekStartDate && weekEndDate && isWithinIntervalFns(weekStartDate, { start: monthStartDate, end: monthEndDate })) {
              const weeklyVolume = lobRawEntry.lobVolumeForecast?.[weekHeader];
              const weeklyAHT = lobRawEntry.lobAverageAHT?.[weekHeader];
              const weeklyTotalMinutes = lobRawEntry.lobTotalBaseRequiredMinutes?.[weekHeader];

              if (weeklyVolume !== null && weeklyVolume !== undefined) {
                totalVolumeForMonth += weeklyVolume;
                if (weeklyAHT !== null && weeklyAHT !== undefined) {
                  weightedAhtSum += weeklyVolume * weeklyAHT;
                }
                hasAnyWeeklyData = true;
              }
              if (weeklyTotalMinutes !== null && weeklyTotalMinutes !== undefined) {
                totalMinutesForMonth += weeklyTotalMinutes;
                hasAnyWeeklyData = true;
              }
              weeksInMonthCount++;
            }
          });

          if (hasAnyWeeklyData) {
            // For volume, sum all weeks in the month
            monthlyAggregatedLobInputs.lobVolumeForecast[monthPeriod] = totalVolumeForMonth > 0 ? totalVolumeForMonth : null;
            
            // For AHT, calculate weighted average based on weekly volumes
            monthlyAggregatedLobInputs.lobAverageAHT[monthPeriod] = 
              totalVolumeForMonth > 0 && weightedAhtSum > 0 
                ? weightedAhtSum / totalVolumeForMonth 
                : null;
            
            // Always calculate required minutes from monthly volume * AHT for consistency
            if (!monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes) {
              monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes = {};
            }
            
            if (monthlyAggregatedLobInputs.lobVolumeForecast[monthPeriod] !== null && 
                monthlyAggregatedLobInputs.lobAverageAHT[monthPeriod] !== null) {
              monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes[monthPeriod] = 
                (monthlyAggregatedLobInputs.lobVolumeForecast[monthPeriod] as number) * 
                (monthlyAggregatedLobInputs.lobAverageAHT[monthPeriod] as number);
            } else {
              monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes[monthPeriod] = null;
            }
          } else { // If no weekly data, try to use existing monthly data if any
            monthlyAggregatedLobInputs.lobVolumeForecast[monthPeriod] = lobRawEntry.lobVolumeForecast?.[monthPeriod] ?? null;
            monthlyAggregatedLobInputs.lobAverageAHT[monthPeriod] = lobRawEntry.lobAverageAHT?.[monthPeriod] ?? null;
            if (!monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes) monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes = {};
            monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes[monthPeriod] = lobRawEntry.lobTotalBaseRequiredMinutes?.[monthPeriod] ?? null;
          }
          // This is for the LOB display, not for team calculation input yet
          lobCalculatedBaseRequiredMinutes[monthPeriod] = monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes?.[monthPeriod] ?? null;
        });
      } else { // Week interval
        periodsToDisplayCurrently.forEach(period => {
          const volume = lobRawEntry.lobVolumeForecast?.[period];
          const avgAHT = lobRawEntry.lobAverageAHT?.[period];
          if (volume !== null && volume !== undefined && avgAHT !== null && avgAHT !== undefined && avgAHT > 0) {
            lobCalculatedBaseRequiredMinutes[period] = volume * avgAHT;
          } else {
            lobCalculatedBaseRequiredMinutes[period] = lobRawEntry.lobTotalBaseRequiredMinutes?.[period] ?? 0;
          }
        });
      }


      teamsToProcess.forEach(teamRawEntry => {
        const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
        periodsToDisplayCurrently.forEach(monthPeriodOrWeekPeriod => {
          let teamInputForPeriod: Partial<TeamPeriodicMetrics> = {};
          let lobTotalBaseRequiredMinutesForCalcContext: number | null = null;

            if (currentSelectedTimeInterval === "Month") {
              const monthPeriod = monthPeriodOrWeekPeriod;
              const { startDate: monthStartDate, endDate: monthEndDate } = getHeaderDateRange(monthPeriod, "Month");
              if (!monthStartDate || !monthEndDate) {
                periodicTeamMetrics[monthPeriod] = calculateTeamMetricsForPeriod({}, null, standardWorkMinutes);
                return;
              }

              const weeklyInputs: Partial<TeamPeriodicMetrics>[] = [];
              const relevantWeekHeaders: string[] = [];
              ALL_WEEKS_HEADERS.forEach(weekHeader => {
                const { startDate: weekStartDate, endDate: weekEndDate } = getHeaderDateRange(weekHeader, "Week");
                if (weekStartDate && weekEndDate && isWithinIntervalFns(weekStartDate, { start: monthStartDate, end: monthEndDate })) {
                  if (teamRawEntry.periodicInputData[weekHeader]) {
                    weeklyInputs.push(teamRawEntry.periodicInputData[weekHeader]!);
                    relevantWeekHeaders.push(weekHeader);
                  }
                }
              });

              if (weeklyInputs.length > 0) {
                const summedInputs: Partial<TeamPeriodicMetrics> & { 
                  counts: Partial<Record<keyof TeamPeriodicMetrics, number>>,
                  volumeMixWeightedSum: Partial<Record<keyof TeamPeriodicMetrics, number>>,
                  volumeMixTotalWeight: number
                } = { 
                  counts: {},
                  volumeMixWeightedSum: {},
                  volumeMixTotalWeight: 0
                };
                
                // Define how each metric should be aggregated for the month
                const avgMetricsKeys: (keyof TeamPeriodicMetrics)[] = ["aht", "inOfficeShrinkagePercentage", "outOfOfficeShrinkagePercentage", "occupancyPercentage", "backlogPercentage"];
                const sumMetricsKeys: (keyof TeamPeriodicMetrics)[] = ["moveIn", "moveOut", "newHireBatch", "newHireProduction", "attritionPercentage"];
                const weightedAvgMetricsKeys: (keyof TeamPeriodicMetrics)[] = ["volumeMixPercentage"];
                const endOfPeriodMetricsKeys: (keyof TeamPeriodicMetrics)[] = ["actualHC"];

                weeklyInputs.forEach(input => {
                  // Process averages and sums that need counting
                  [...avgMetricsKeys, ...sumMetricsKeys].forEach(key => {
                    if (input[key] !== null && input[key] !== undefined) {
                      summedInputs[key] = (summedInputs[key] || 0) + (input[key] as number);
                      if (avgMetricsKeys.includes(key as any)) {
                        summedInputs.counts[key] = (summedInputs.counts[key] || 0) + 1;
                      }
                    }
                  });

                  // Process weighted averages (like volume mix)
                  weightedAvgMetricsKeys.forEach(key => {
                    if (input[key] !== null && input[key] !== undefined) {
                      const weight = input.actualHC || 0;
                      summedInputs.volumeMixWeightedSum[key] = (summedInputs.volumeMixWeightedSum[key] || 0) + (input[key] as number) * weight;
                      summedInputs.volumeMixTotalWeight += weight;
                    }
                  });
                });

                // Calculate simple averages
                avgMetricsKeys.forEach(key => {
                  if (summedInputs.counts[key] && summedInputs.counts[key]! > 0) {
                    teamInputForPeriod[key] = (summedInputs[key] as number) / summedInputs.counts[key]!;
                  } else {
                    teamInputForPeriod[key] = null;
                  }
                });

                // Calculate sums
                sumMetricsKeys.forEach(key => {
                  teamInputForPeriod[key] = summedInputs[key];
                });

                // Calculate weighted averages
                weightedAvgMetricsKeys.forEach(key => {
                  if (summedInputs.volumeMixTotalWeight > 0) {
                    teamInputForPeriod[key] = (summedInputs.volumeMixWeightedSum[key] || 0) / summedInputs.volumeMixTotalWeight;
                  } else {
                    // Fallback to simple average if no weights
                    let sum = 0;
                    let count = 0;
                    weeklyInputs.forEach(wi => {
                      if (wi[key] !== null && wi[key] !== undefined) {
                        sum += (wi[key] as number);
                        count++;
                      }
                    });
                    teamInputForPeriod[key] = count > 0 ? sum / count : null;
                  }
                });

                // Use last week's value for end-of-period metrics
                const lastWeekInput = weeklyInputs[weeklyInputs.length - 1];
                endOfPeriodMetricsKeys.forEach(key => {
                  if (lastWeekInput && lastWeekInput[key] !== null && lastWeekInput[key] !== undefined) {
                    teamInputForPeriod[key] = lastWeekInput[key];
                  } else {
                    // Fallback to average if last week is missing
                    let sum = 0;
                    let count = 0;
                    weeklyInputs.forEach(wi => {
                      if (wi[key] !== null && wi[key] !== undefined) {
                        sum += (wi[key] as number);
                        count++;
                      }
                    });
                    teamInputForPeriod[key] = count > 0 ? sum / count : null;
                  }
                });

              } else { // No weekly data for this team in this month, use any direct monthly input if available
                  teamInputForPeriod = teamRawEntry.periodicInputData[monthPeriod] || {};
              }
              // Use the LOB's monthly aggregated total base required minutes for team calculations
              lobTotalBaseRequiredMinutesForCalcContext = monthlyAggregatedLobInputs.lobTotalBaseRequiredMinutes?.[monthPeriod] ?? null;

          } else { // Week Interval
            const weekPeriod = monthPeriodOrWeekPeriod;
            teamInputForPeriod = teamRawEntry.periodicInputData[weekPeriod] || {};
            // Determine LOB total base required minutes for this specific week for team calculation
            const weeklyVolume = lobRawEntry.lobVolumeForecast?.[weekPeriod];
            const weeklyAHT = lobRawEntry.lobAverageAHT?.[weekPeriod];
            if (weeklyVolume !== null && weeklyVolume !== undefined && weeklyAHT !== null && weeklyAHT !== undefined && weeklyAHT > 0) {
                lobTotalBaseRequiredMinutesForCalcContext = weeklyVolume * weeklyAHT;
            } else {
                lobTotalBaseRequiredMinutesForCalcContext = lobRawEntry.lobTotalBaseRequiredMinutes?.[weekPeriod] ?? null;
            }
          }

          const aggregatedDataForPeriod = lobRawEntry.periodicData?.[monthPeriodOrWeekPeriod] || {};
          periodicTeamMetrics[monthPeriodOrWeekPeriod] = calculateTeamMetricsForPeriodProp(
            teamInputForPeriod,
            lobTotalBaseRequiredMinutesForCalcContext,
            standardWorkMinutes,
            aggregatedDataForPeriod
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
      periodsToDisplayCurrently.forEach(period => {
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

        let ahtSum = 0;
        let cphSum = 0;
        let teamCountWithAHT = 0;
        let teamCountWithCPH = 0;

        childrenTeamsDataRows.forEach(teamRow => {
          const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
          if (teamPeriodMetric?.aht !== null && teamPeriodMetric?.aht !== undefined) {
            ahtSum += teamPeriodMetric.aht;
            teamCountWithAHT++;
          }
          if (teamPeriodMetric?.cph !== null && teamPeriodMetric?.cph !== undefined) {
            cphSum += teamPeriodMetric.cph;
            teamCountWithCPH++;
          }
        });
        const calculatedAvgAHTFromTeams = teamCountWithAHT > 0 ? ahtSum / teamCountWithAHT : null;
        const calculatedAvgCPHFromTeams = teamCountWithCPH > 0 ? cphSum / teamCountWithCPH : null;

        lobPeriodicData[period] = {
          lobVolumeForecast: currentSelectedTimeInterval === "Month" ? monthlyAggregatedLobInputs.lobVolumeForecast?.[period] : lobRawEntry.lobVolumeForecast?.[period] ?? null,
          lobAverageAHT: currentSelectedTimeInterval === "Month" ? monthlyAggregatedLobInputs.lobAverageAHT?.[period] : lobRawEntry.lobAverageAHT?.[period] ?? null,
          lobAverageCPH: calculatedAvgCPHFromTeams,
          lobTotalBaseRequiredMinutes: lobCalculatedBaseRequiredMinutes[period] ?? null, // This was pre-calculated based on interval
          requiredHC: reqHcSum,
          actualHC: actHcSum,
          overUnderHC: overUnderHCSum,
          lobCalculatedAverageAHT: calculatedAvgAHTFromTeams,
          handlingCapacity: currentSelectedTimeInterval === "Month"
            ? (monthlyAggregatedLobInputs.lobVolumeForecast?.[period] && monthlyAggregatedLobInputs.lobAverageAHT?.[period]
                ? monthlyAggregatedLobInputs.lobVolumeForecast[period] / monthlyAggregatedLobInputs.lobAverageAHT[period]
                : null)
            : (lobRawEntry.lobVolumeForecast?.[period] && lobRawEntry.lobAverageAHT?.[period]
                ? lobRawEntry.lobVolumeForecast[period] / lobRawEntry.lobAverageAHT[period]
                : null),
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

    if (childrenLobsDataRows.length > 0) {
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplayCurrently.forEach(period => {
        let reqHcSum = 0;
        let actHcSum = 0;
        let lobTotalBaseReqMinsForBu = 0;
        let buVolumeForecastSum = 0;

        childrenLobsDataRows.forEach(lobRow => {
          const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
          if (lobPeriodMetric) {
            reqHcSum += lobPeriodMetric.requiredHC ?? 0;
            actHcSum += lobPeriodMetric.actualHC ?? 0;
            lobTotalBaseReqMinsForBu += lobPeriodMetric.lobTotalBaseRequiredMinutes ?? 0;
            buVolumeForecastSum += lobPeriodMetric.lobVolumeForecast ?? 0;
          }
        });
        const overUnderHCSum = (actHcSum !== null && reqHcSum !== null) ? actHcSum - reqHcSum : null;

        buPeriodicData[period] = {
          requiredHC: reqHcSum,
          actualHC: actHcSum,
          overUnderHC: overUnderHCSum,
          lobTotalBaseRequiredMinutes: lobTotalBaseReqMinsForBu,
          lobVolumeForecast: buVolumeForecastSum,
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
  }, [viewMode, selectedPlanBusinessUnit, selectedPlanLineOfBusiness, selectedPlanTimeInterval, selectedPlanDateRange,
      selectedChartBusinessUnit, selectedChartLineOfBusiness, selectedChartTimeInterval, selectedChartDateRange,
      localRawCapacityDataSource]);

  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    // Only apply scroll synchronization logic if in 'plan' view
    if (viewMode !== 'plan') {
      return;
    }

    const headerScroller = headerPeriodScrollerRef.current;
    const bodyScroller = tableBodyScrollRef.current;

    if (!headerScroller || !bodyScroller) {
      return;
    }

    // Reset scroll positions
    headerScroller.scrollLeft = 0;
    bodyScroller.scrollLeft = 0;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      requestAnimationFrame(() => {
        target.scrollLeft = source.scrollLeft;
        isSyncingScroll.current = false;
      });
    };

    const handleHeaderScroll = () => syncScroll(headerScroller, bodyScroller);
    const handleBodyScroll = () => syncScroll(bodyScroller, headerScroller);

    headerScroller.addEventListener('scroll', handleHeaderScroll, { passive: true });
    bodyScroller.addEventListener('scroll', handleBodyScroll, { passive: true });

    // Cleanup function
    return () => {
      headerScroller.removeEventListener('scroll', handleHeaderScroll);
      bodyScroller.removeEventListener('scroll', handleBodyScroll);
    };
  }, [displayedPeriodHeaders, displayableCapacityData, viewMode]);


  // Map LOB names to their color shades
  const lobColorMap = useMemo(() => {
    const map: { [lobName: string]: { required: string, actual: string, overUnder: string } } = {};
    const lobsToColor = viewMode === 'plan' ? selectedPlanLineOfBusiness : selectedChartLineOfBusiness;
    lobsToColor.forEach((lobName, index) => {
      const baseHsl = BASE_CHART_HSL_COLORS[index % BASE_CHART_HSL_COLORS.length];
      map[lobName] = {
        required: getShade(baseHsl, 0),    // Base color for Required HC
        actual: getShade(baseHsl, 15),     // Lighter shade for Actual HC
        overUnder: getShade(baseHsl, 30),  // Even lighter shade for Over/Under HC
      };
    });
    return map;
  }, [selectedPlanLineOfBusiness, selectedChartLineOfBusiness, viewMode]);


  // Prepare data for charts
  const chartDataForMetrics = useMemo(() => {
    const processedData: any[] = [];
    const buNode = displayableCapacityData.find(item => item.itemType === 'BU' && item.name === selectedChartBusinessUnit);

    if (!buNode || !buNode.children) return [];

    const selectedLobs = buNode.children.filter(lob => selectedChartLineOfBusiness.includes(lob.name));

    // Use displayedPeriodHeaders which are already filtered by chart view's date range
    displayedPeriodHeaders.forEach(period => {
      const periodData: { [key: string]: any } = { name: period.replace("FWk", "WK").split(':')[0] };

      selectedLobs.forEach(lob => {
        const lobPeriodMetric = lob.periodicData[period] as AggregatedPeriodicMetrics;
        if (lobPeriodMetric) {
          periodData[`${lob.name}_RequiredHC`] = lobPeriodMetric.requiredHC ?? 0;
          periodData[`${lob.name}_ActualHC`] = lobPeriodMetric.actualHC ?? 0;
          periodData[`${lob.name}_OverUnderHC`] = lobPeriodMetric.overUnderHC ?? 0;
        }
      });
      processedData.push(periodData);
    });
    return processedData;
  }, [displayableCapacityData, selectedChartBusinessUnit, selectedChartLineOfBusiness, displayedPeriodHeaders]);

  const allChartDataKeys = useMemo(() => {
    const keys: string[] = [];
    selectedChartLineOfBusiness.forEach(lobName => {
      keys.push(`${lobName}_RequiredHC`);
      keys.push(`${lobName}_ActualHC`);
      keys.push(`${lobName}_OverUnderHC`);
    });
    return keys;
  }, [selectedChartLineOfBusiness]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground rounded-lg min-h-0">
      <HeaderSection
        planFilterOptions={planFilterOptions}
        selectedPlanBusinessUnit={selectedPlanBusinessUnit}
        onSelectPlanBusinessUnit={handlePlanBusinessUnitChange}
        selectedPlanLineOfBusiness={selectedPlanLineOfBusiness}
        onSelectPlanLineOfBusiness={handlePlanLOBChange}
        selectedPlanTimeInterval={selectedPlanTimeInterval}
        onSelectPlanTimeInterval={handlePlanTimeIntervalChange}
        selectedPlanDateRange={selectedPlanDateRange}
        onSelectPlanDateRange={setSelectedPlanDateRange}
        businessId={businessId}
        navigateSimulator={navigateSimulator}
        chartFilterOptions={chartFilterOptions}
        selectedChartBusinessUnit={selectedChartBusinessUnit}
        onSelectChartBusinessUnit={handleChartBusinessUnitChange}
        selectedChartLineOfBusiness={selectedChartLineOfBusiness}
        onSelectChartLineOfBusiness={handleChartLOBChange}
        selectedChartTimeInterval={selectedChartTimeInterval}
        onSelectChartTimeInterval={handleChartTimeIntervalChange}
        selectedChartDateRange={selectedChartDateRange}
        onSelectChartDateRange={setSelectedChartDateRange}

        allAvailablePeriods={selectedPlanTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS}
        displayedPeriodHeaders={displayedPeriodHeaders}
        activeHierarchyContext={activeHierarchyContext}
        headerPeriodScrollerRef={headerPeriodScrollerRef}
        onExportCsv={handleExportCsv}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
      />
      <div className="flex-grow overflow-hidden flex flex-col">
        <main className="px-4 pb-4 flex-grow overflow-y-auto">
          {viewMode === 'plan' ? (
            <CapacityTable
              data={displayableCapacityData}
              periodHeaders={displayedPeriodHeaders}
              expandedItems={expandedItems}
              toggleExpand={toggleExpand}
              teamMetricDefinitions={teamMetricDefinitions}
              aggregatedMetricDefinitions={aggregatedMetricDefinitions}
              onTeamMetricChange={handleTeamMetricChange}
              onLobMetricChange={handleLobMetricChange}
              editingCell={editingCell}
              onSetEditingCell={handleSetEditingCell}
              selectedTimeInterval={selectedPlanTimeInterval} // Use plan's time interval
              onActiveHierarchyChange={handleActiveHierarchyContextChange}
              tableBodyScrollRef={tableBodyScrollRef}
            />
          ) : (
            <div className="w-full h-[600px] mt-4 p-4 border rounded-lg bg-card">
              {chartDataForMetrics.length > 0 && allChartDataKeys.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataForMetrics}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend
                      formatter={(value, entry) => {
                        // The 'name' prop of the Bar component is already set to the full label (e.g., "LOB1 RequiredHC")
                        // So, we can just return the value directly for the legend.
                        return value;
                      }}
                    />
                    {allChartDataKeys.map((key) => {
                      const [lobName, metricType] = key.split('_');
                      const colorShades = lobColorMap[lobName];
                      let fill = '';
                      if (colorShades) {
                        if (metricType === 'RequiredHC') fill = colorShades.required;
                        else if (metricType === 'ActualHC') fill = colorShades.actual;
                        else if (metricType === 'OverUnderHC') fill = colorShades.overUnder;
                      }
                      return (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={`${lobName} ${metricType}`} // Display full name in tooltip and legend
                          fill={fill}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No chart data available for the current selection. Please select Business Unit and Lines of Business.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
