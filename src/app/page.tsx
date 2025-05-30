
"use client";

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  format as formatDateFn,
  getWeek,
  getMonth, // Standard getMonth (0-indexed, local timezone)
  getYear,  // Standard getYear (local timezone)
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
  // TableHeader, // No longer used directly in CapacityTable component
  // TableHead, // No longer used directly in CapacityTable component
  TableRow,
} from "@/components/ui/table";

import { Loader2, Zap, Download, Building2, Briefcase, ChevronDown, Edit3, ArrowDown, ArrowUp, Minus, Calendar as CalendarIcon, Users, ChevronsUpDown, ArrowLeft, ArrowRight } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { suggestLoBGroupings, type SuggestLoBGroupingsOutput } from "@/ai/flows/suggest-lob-groupings";

// --- Import from re-created files ---
import {
  ALL_WEEKS_HEADERS,
  ALL_MONTH_HEADERS,
  TimeInterval,
  CapacityDataRow,
  BusinessUnitName,
  RawLoBCapacityEntry,
  AggregatedPeriodicMetrics,
  TeamPeriodicMetrics,
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS,
  TeamName,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
  RawTeamDataEntry,
  FilterOptions,
  HeaderSectionProps,
  MetricDefinition,
  STANDARD_WEEKLY_WORK_MINUTES,
  STANDARD_MONTHLY_WORK_MINUTES,
  isLeapYear,
  formatDatePartUTCFromDate,
  generateFiscalWeekHeaders,
  getHeaderDateRange,
  findFiscalWeekHeaderForDate,
  ALL_TEAM_NAMES,
  LineOfBusinessName
} from "@/components/capacity-insights/types";

import { initialMockRawCapacityData } from "@/components/capacity-insights/data";
import { AiGroupingDialog } from "@/components/capacity-insights/ai-grouping-dialog";
import { DateRangePicker } from "@/components/capacity-insights/date-range-picker";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";


// --- Helper Functions (already present in types.ts, but if needed locally) ---
// const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60;
// const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60;

const calculateTeamMetricsForPeriod = (
  teamInputDataCurrentPeriod: Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>,
  lobTotalBaseRequiredMinutesForPeriod: number | null,
  standardWorkMinutesForPeriod: number
): TeamPeriodicMetrics => {
  
  const defaultsFull: TeamPeriodicMetrics = {
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
    ...(teamInputDataCurrentPeriod as TeamPeriodicMetrics), // Cast to allow spread
  };

  // 1. Calculate Team Effective Required Agent Minutes
  const baseTeamRequiredMinutes = (lobTotalBaseRequiredMinutesForPeriod ?? 0) * ((defaultsFull.volumeMixPercentage ?? 0) / 100);
  const effectiveTeamRequiredMinutes = baseTeamRequiredMinutes * (1 + ((defaultsFull.backlogPercentage ?? 0) / 100));
  defaultsFull._calculatedRequiredAgentMinutes = effectiveTeamRequiredMinutes;

  // 2. Calculate Team Required HC
  let requiredHCVal = null;
  if (effectiveTeamRequiredMinutes > 0 && standardWorkMinutesForPeriod > 0 && defaultsFull.shrinkagePercentage !== null && defaultsFull.occupancyPercentage !== null && defaultsFull.occupancyPercentage > 0) {
    const effectiveMinutesPerHC = standardWorkMinutesForPeriod *
                                 (1 - (defaultsFull.shrinkagePercentage / 100)) *
                                 (defaultsFull.occupancyPercentage / 100);
    if (effectiveMinutesPerHC > 0) {
      requiredHCVal = effectiveTeamRequiredMinutes / effectiveMinutesPerHC;
    }
  } else if (effectiveTeamRequiredMinutes === 0) {
    requiredHCVal = 0;
  }
  defaultsFull.requiredHC = requiredHCVal;

  // 3. Calculate Team Over/Under HC
  const currentActualHC = defaultsFull.actualHC ?? 0;
  defaultsFull.overUnderHC = (currentActualHC !== null && requiredHCVal !== null) ? currentActualHC - requiredHCVal : null;

  // 4. Calculate Team Actual Productive Agent Minutes
  if (currentActualHC !== null && standardWorkMinutesForPeriod > 0 && defaultsFull.shrinkagePercentage !== null && defaultsFull.occupancyPercentage !== null) {
    defaultsFull._calculatedActualProductiveAgentMinutes = currentActualHC * standardWorkMinutesForPeriod *
                                                  (1 - (defaultsFull.shrinkagePercentage / 100)) *
                                                  (defaultsFull.occupancyPercentage / 100);
  } else {
    defaultsFull._calculatedActualProductiveAgentMinutes = 0;
  }

  // 5. Calculate Attrition and Ending HC
  const attritionLossHCVal = currentActualHC * ((defaultsFull.attritionPercentage ?? 0) / 100);
  defaultsFull.attritionLossHC = attritionLossHCVal;

  const hcAfterAttritionVal = currentActualHC - attritionLossHCVal;
  defaultsFull.hcAfterAttrition = hcAfterAttritionVal;

  defaultsFull.endingHC = hcAfterAttritionVal + (defaultsFull.newHireProduction ?? 0) + (defaultsFull.moveIn ?? 0) - (defaultsFull.moveOut ?? 0);

  return defaultsFull;
};


const getDefaultDateRange = (interval: TimeInterval, allHeaders: string[]): DateRange => {
  if (allHeaders.length === 0) return { from: undefined, to: undefined };

  const numPeriodsToDefault = interval === "Week" ? 11 : 2; // Default to 12 weeks or 3 months (0-indexed means 11 for 12)

  const fromHeaderDetails = getHeaderDateRange(allHeaders[0], interval);
  let toIndex = Math.min(numPeriodsToDefault, allHeaders.length - 1);
  if (toIndex < 0) toIndex = 0; // Handle case where allHeaders is very short
  const toHeaderDetails = getHeaderDateRange(allHeaders[toIndex], interval);
  

  let fromDate = fromHeaderDetails.startDate;
  let toDate = toHeaderDetails.endDate;

  // Ensure dates are snapped to week boundaries if interval is Week
  if (interval === "Week") {
    if (fromDate) fromDate = startOfWeek(fromDate, { weekStartsOn: 1 }); // Monday
    if (toDate) toDate = endOfWeek(toDate, { weekStartsOn: 1 }); // Sunday
  } else if (interval === "Month") {
    if (fromDate) fromDate = startOfMonth(fromDate);
    if (toDate) toDate = endOfMonth(toDate);
  }

  return { from: fromDate ?? undefined, to: toDate ?? undefined };
};


// --- MAIN PAGE COMPONENT ---
export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
  const defaultWFSLoBs = useMemo(() => ["Inventory Management", "Customer Returns", "Help Desk"], []);

  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>(() => {
     const wfsConfig = BUSINESS_UNIT_CONFIG["WFS"];
     return defaultWFSLoBs.filter(lob => wfsConfig.lonsOfBusiness.includes(lob as LineOfBusinessName<"WFS">));
  });

  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week", ALL_WEEKS_HEADERS));

  const [filterOptions, setFilterOptions] = useState<FilterOptions>(() => {
      const initialBuConfig = BUSINESS_UNIT_CONFIG[selectedBusinessUnit];
      return {
          businessUnits: [...ALL_BUSINESS_UNITS],
          linesOfBusiness: [...initialBuConfig.lonsOfBusiness],
      };
  });

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
    const newValueParsed = rawValue.trim() === "" || rawValue.trim() === "-" ? null : parseFloat(rawValue);
     if (rawValue.trim() !== "" && rawValue.trim() !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null) {
        // console.warn(`Invalid input for ${metricKey}: ${rawValue}. Not updating.`);
        return; // Do not update if invalid number and not an intentional clear
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
        teamEntry.periodicInputData[periodHeader] = { /* Initialize if needed */ };
      }

      (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = newValue;

      // Dynamic Volume Mix Adjustment
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
          if (Math.abs(currentTotalMixOfOtherTeams) > 0.001) { // If other teams had some mix
            let distributedSum = 0;
            for (let i = 0; i < otherTeams.length; i++) {
              const team = otherTeams[i];
              const teamPeriodData = team.periodicInputData[periodHeader];
              if (!teamPeriodData) team.periodicInputData[periodHeader] = {};

              const originalShareOfOthers = (teamPeriodData?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShareOfOthers;

              if (i === otherTeams.length - 1 ) { // Last team gets the remainder to ensure sum is 100
                newShare = remainingMixPercentage - distributedSum;
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1)) ) );
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
          } else { // If other teams were 0, distribute remaining mix equally
            const mixPerOtherTeam = otherTeams.length > 0 ? parseFloat((remainingMixPercentage / otherTeams.length).toFixed(1)) : 0;
            let distributedSum = 0;
            otherTeams.forEach((team, i) => {
              if (!team.periodicInputData[periodHeader]) team.periodicInputData[periodHeader] = {};
              let currentMix = mixPerOtherTeam;
              if (i === otherTeams.length -1) { // Last team gets remainder
                  currentMix = remainingMixPercentage - distributedSum;
              }
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(currentMix.toFixed(1)) ));
              distributedSum += parseFloat(currentMix.toFixed(1));
            });
          }
        }
        // Final check to ensure total is 100% due to potential rounding
        let finalSum = lobEntry.teams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        },0);

        if (Math.abs(finalSum - 100) > 0.01 && lobEntry.teams.length > 0) {
            const diff = 100 - finalSum;
            // Add diff to the team that was just edited, or the largest if not available
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
    const newValueParsed = rawValue.trim() === "" || rawValue.trim() === "-" ? null : parseFloat(rawValue);
     if (rawValue.trim() !== "" && rawValue.trim() !== "-" && isNaN(newValueParsed as number) && newValueParsed !== null) {
        // console.warn(`Invalid input for LOB metric ${metricKey}: ${rawValue}. Not updating.`);
        return; 
    }
    const newValue = newValueParsed;

    setRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntry = newData.find(lob => lob.id === lobId);
      if (!lobEntry) return prevRawData;

      if (metricKey === 'lobVolumeForecast' || metricKey === 'lobAverageAHT') {
        if (!(lobEntry as any)[metricKey]) { // Initialize if object doesn't exist
          (lobEntry as any)[metricKey] = {};
        }
        (lobEntry[metricKey] as any)[periodHeader] = newValue; // Set the new value

        // Re-calculate lobTotalBaseRequiredMinutes
        const volume = lobEntry.lobVolumeForecast?.[periodHeader];
        const aht = lobEntry.lobAverageAHT?.[periodHeader];
        if (typeof volume === 'number' && volume >= 0 && typeof aht === 'number' && aht >= 0) {
          if (!lobEntry.lobTotalBaseRequiredMinutes) lobEntry.lobTotalBaseRequiredMinutes = {};
          lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = volume * aht;
        } else  { // If volume or AHT is null/invalid, set base required minutes to null
            if (!lobEntry.lobTotalBaseRequiredMinutes) lobEntry.lobTotalBaseRequiredMinutes = {};
            lobEntry.lobTotalBaseRequiredMinutes[periodHeader] = null; 
        }
      } else if (metricKey === 'lobTotalBaseRequiredMinutes') {
        // If directly editing base required minutes
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
    // When BU changes, LOB selection defaults and filter options update via useEffect
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
         if (newDefaultSelectedLobs.length === 0 && allLobsForNewBu.length > 0) {
            newDefaultSelectedLobs = [allLobsForNewBu[0]];
        }
    } else {
        newDefaultSelectedLobs = [...allLobsForNewBu];
    }
    
    setSelectedLineOfBusiness(currentSelectedLobs => {
      const currentSorted = [...currentSelectedLobs].sort().join(',');
      const newDefaultSorted = [...newDefaultSelectedLobs].sort().join(',');
      
      const currentLobsStillValidForNewBu = currentSelectedLobs.every(lob => allLobsForNewBu.includes(lob));

      if (!currentLobsStillValidForNewBu || currentSorted !== newDefaultSorted) {
        return newDefaultSelectedLobs;
      }
      return currentSelectedLobs; 
    });


    setFilterOptions(prev => {
        const newLobsForFilter = [...newBuConfig.lonsOfBusiness];
        const prevLobsSorted = [...(prev.linesOfBusiness || [])].sort().join(',');
        const newLobsSorted = [...newLobsForFilter].sort().join(',');

        if (prevLobsSorted !== newLobsSorted) {
            return { ...prev, linesOfBusiness: newLobsForFilter };
        }
        return prev;
    });
  }, [selectedBusinessUnit, defaultWFSLoBs]);


  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    let periodsToDisplayThisIteration: string[] = [];

    if (selectedDateRange?.from) {
      const userRangeStart = selectedDateRange.from;
      const userRangeEnd = selectedDateRange.to || userRangeStart; // Default to start date if no end date

      periodsToDisplayThisIteration = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        
        // Check for intersection: (StartA <= EndB) and (EndA >= StartB)
        return isAfter(periodEndDate, addDays(userRangeStart, -1)) && isBefore(periodStartDate, addDays(userRangeEnd, 1));
      });
    } else {
      // Fallback if no date range is selected (e.g., on initial load before useEffect sets default)
      // This might show a limited number of periods or be empty depending on exact timing
      periodsToDisplayThisIteration = sourcePeriods.slice(0, 12); // Default to first 12 periods
    }
    
    setDisplayedPeriodHeaders(periodsToDisplayThisIteration);
    if(periodsToDisplayThisIteration.length === 0 && selectedDateRange?.from){
        // console.warn("No periods to display for the selected date range.");
    }


    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;
    const newDisplayData: CapacityDataRow[] = [];
    
    // Only process the selected Business Unit
    const buName = selectedBusinessUnit;
    const buConfig = BUSINESS_UNIT_CONFIG[buName];
    if (!buConfig) {
      setDisplayableCapacityData([]);
      return;
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    const lobsToFilterBy = selectedLineOfBusiness.length > 0 ? selectedLineOfBusiness : buConfig.lonsOfBusiness;

    buConfig.lonsOfBusiness.forEach(lobNameString => {
      if (!lobsToFilterBy.includes(lobNameString)) {
        return; // Skip LOB if not in selectedLineOfBusiness (when selection is active)
      }
      
      const lobRawEntry = rawCapacityDataSource.find(d => d.bu === buName && d.lob === lobNameString);
      if (!lobRawEntry) return;

      const childrenTeamsDataRows: CapacityDataRow[] = [];
      const teamsToProcess = lobRawEntry.teams || []; // No team filter from header anymore

      // Calculate LOB Total Base Required Minutes for each period
      const lobCalculatedBaseRequiredMinutes: Record<string, number | null> = {};
      periodsToDisplayThisIteration.forEach(period => {
          const volume = lobRawEntry.lobVolumeForecast?.[period];
          const avgAHT = lobRawEntry.lobAverageAHT?.[period];
          if (typeof volume === 'number' && volume >= 0 && typeof avgAHT === 'number' && avgAHT >= 0) {
              lobCalculatedBaseRequiredMinutes[period] = volume * avgAHT;
          } else {
              // If forecast/AHT not available, use the direct input value for base required minutes
              lobCalculatedBaseRequiredMinutes[period] = lobRawEntry.lobTotalBaseRequiredMinutes?.[period] ?? 0;
          }
      });

      teamsToProcess.forEach(teamRawEntry => {
          const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
          periodsToDisplayThisIteration.forEach(period => {
            const teamInputForPeriod = teamRawEntry.periodicInputData[period] || {};
            // Add intermediate LOB required minutes for tooltip context if needed
            const metricsWithContext = {
                ...teamInputForPeriod,
                _lobTotalBaseRequiredMinutes_intermediate: lobCalculatedBaseRequiredMinutes[period]
            };
            periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
              metricsWithContext,
              lobCalculatedBaseRequiredMinutes[period],
              standardWorkMinutes
            );
          });
          childrenTeamsDataRows.push({
            id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`,
            name: teamRawEntry.teamName,
            level: 2, // Team level
            itemType: 'Team',
            periodicData: periodicTeamMetrics,
            lobId: lobRawEntry.id,
          });
      });

      const lobPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplayThisIteration.forEach(period => {
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
              lobTotalBaseRequiredMinutes: lobCalculatedBaseRequiredMinutes[period] ?? null, // Use the calculated/input value
              requiredHC: reqHcSum,
              actualHC: actHcSum,
              overUnderHC: overUnderHCSum,
          };
      });

      if (childrenTeamsDataRows.length > 0 || selectedLineOfBusiness.includes(lobRawEntry.lob) || selectedLineOfBusiness.length === 0) {
        childrenLobsDataRows.push({
          id: lobRawEntry.id,
          name: lobRawEntry.lob,
          level: 1, // LOB level
          itemType: 'LOB',
          periodicData: lobPeriodicData,
          children: childrenTeamsDataRows,
        });
      }
    });

    if (childrenLobsDataRows.length > 0 ) {
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplayThisIteration.forEach(period => {
        let reqHcSum = 0;
        let actHcSum = 0;

        childrenLobsDataRows.forEach(lobRow => {
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
              }
        });
        const overUnderHCSum = (actHcSum !== null && reqHcSum !== null) ? actHcSum - reqHcSum : null;

        buPeriodicData[period] = {
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: overUnderHCSum,
            // These are not directly applicable/editable at BU level in this structure
            lobVolumeForecast: null, 
            lobAverageAHT: null,
            lobTotalBaseRequiredMinutes: null,
        };
      });
      newDisplayData.push({
        id: buName,
        name: buName,
        level: 0, // BU level
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
      rawCapacityDataSource, // Key dependency for re-calculation
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
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    };

    const handleHeaderScroll = () => {
      if (headerScroller && bodyScroller) syncScroll(headerScroller, bodyScroller);
    };
    const handleBodyScroll = () => {
      if (bodyScroller && headerScroller) syncScroll(bodyScroller, headerScroller);
    };

    headerScroller?.addEventListener('scroll', handleHeaderScroll, { passive: true });
    bodyScroller?.addEventListener('scroll', handleBodyScroll, { passive: true });

    return () => {
      headerScroller?.removeEventListener('scroll', handleHeaderScroll);
      bodyScroller?.removeEventListener('scroll', handleBodyScroll);
    };
  }, []); // Empty dependency array if refs are stable after first render

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <HeaderSection
        allBusinessUnits={ALL_BUSINESS_UNITS}
        actualLobsForCurrentBu={filterOptions.linesOfBusiness}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={handleBusinessUnitChange}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={handleLOBChange}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={handleTimeIntervalChange}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
        allAvailablePeriods={selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS}
        // For merged header
        displayedPeriodHeaders={displayedPeriodHeaders}
        activeHierarchyContext={activeHierarchyContext}
        headerPeriodScrollerRef={headerPeriodScrollerRef}
      />
      <main className="flex-grow overflow-auto px-4 pb-4"> {/* Removed top padding */}
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


    