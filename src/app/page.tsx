
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { mockRawCapacityData as initialMockRawCapacityData, mockFilterOptions } from "@/components/capacity-insights/data";
import { 
  ALL_WEEKS_HEADERS, 
  ALL_MONTH_HEADERS, 
  TimeInterval, 
  CapacityDataRow, 
  BusinessUnitName,
  RawLoBCapacityEntry,
  AggregatedPeriodicMetrics,
  TeamPeriodicMetrics,
  NUM_PERIODS_DISPLAYED,
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS, 
  TeamName,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
  RawTeamDataEntry,
  LineOfBusinessName,
} from "@/components/capacity-insights/types";
import type { MetricDefinition } from "@/components/capacity-insights/types";
import { getWeek, getMonth, getYear, parse as dateParse, format as formatDateFn, startOfWeek, endOfWeek, isWithinInterval as isWithinIntervalFns } from 'date-fns';


const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60; // 40 hours * 60 minutes
const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60; // Average minutes per month


// Helper to calculate team-specific metrics for a single period
const calculateTeamMetricsForPeriod = (
  teamInputData: Partial<RawTeamDataEntry['periodicInputData'][string]>, 
  lobBaseRequiredAgentMinutes: number | null,
  standardWorkMinutesForPeriod: number
): TeamPeriodicMetrics => {
  const defaults: TeamPeriodicMetrics = {
    aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
    attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null,
    moveOut: null, newHireBatch: null, newHireProduction: null, _productivity: null,
    _calculatedRequiredAgentMinutes: null, 
    _calculatedActualAgentMinutes: null,
    requiredHC: null, 
    overUnderHC: null,
    ...teamInputData, // Spread input data to override defaults
  };

  if (lobBaseRequiredAgentMinutes === null || lobBaseRequiredAgentMinutes === undefined) {
    return defaults;
  }

  const calculatedRequiredAgentMinutes = lobBaseRequiredAgentMinutes * ((defaults.volumeMixPercentage ?? 0) / 100);
  
  let requiredHC = null;
  if (calculatedRequiredAgentMinutes > 0 && standardWorkMinutesForPeriod > 0 && defaults.shrinkagePercentage !== null && defaults.occupancyPercentage !== null) {
    const effectiveMinutesPerHC = standardWorkMinutesForPeriod * 
                                 (1 - (defaults.shrinkagePercentage / 100)) * 
                                 (defaults.occupancyPercentage / 100);
    if (effectiveMinutesPerHC > 0) {
      requiredHC = calculatedRequiredAgentMinutes / effectiveMinutesPerHC;
    }
  } else if (calculatedRequiredAgentMinutes === 0) {
    requiredHC = 0;
  }

  const actualHC = defaults.actualHC ?? null;
  const overUnderHC = (actualHC !== null && requiredHC !== null) ? actualHC - requiredHC : null;

  let calculatedActualAgentMinutes = null;
  if (calculatedRequiredAgentMinutes !== null && requiredHC !== null && requiredHC > 0 && actualHC !== null) {
    calculatedActualAgentMinutes = calculatedRequiredAgentMinutes * (actualHC / requiredHC);
  } else if (requiredHC === 0 && actualHC !== null && actualHC > 0) { 
     calculatedActualAgentMinutes = 0; 
  } else if (requiredHC === null && actualHC !== null && actualHC > 0) {
    calculatedActualAgentMinutes = null;
  }


  return {
    ...defaults,
    _calculatedRequiredAgentMinutes: calculatedRequiredAgentMinutes,
    _calculatedActualAgentMinutes: calculatedActualAgentMinutes,
    requiredHC: requiredHC,
    overUnderHC: overUnderHC,
  };
};

const getIndexOfCurrentPeriod = (interval: TimeInterval, headers: string[]): number => {
  const now = new Date();
  if (interval === "Week") {
    const currentYear = getYear(now);
    // Ensure week starts on Monday for ISO-like behavior, adjust if your week starts differently
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); 
    
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const yearMatch = header.match(/\((\d{4})\)/);
        const dateRangeMatch = header.match(/(\d{2}\/\d{2})-(\d{2}\/\d{2})/);

        if (yearMatch && dateRangeMatch) {
            const headerYear = parseInt(yearMatch[1]);
            if (headerYear !== currentYear) continue;

            const [startDateStr, endDateStr] = dateRangeMatch.slice(1);
            
            // Create Date objects for the start and end of the week from the header
            // Assuming MM/DD format and the headerYear
            const [startMonth, startDay] = startDateStr.split('/').map(Number);
            const [endMonth, endDay] = endDateStr.split('/').map(Number);

            // Month is 0-indexed in JavaScript Date
            const headerWeekStartDate = new Date(headerYear, startMonth - 1, startDay);
            const headerWeekEndDate = new Date(headerYear, endMonth - 1, endDay, 23, 59, 59); // Include whole end day

            if (isWithinIntervalFns(now, { start: headerWeekStartDate, end: headerWeekEndDate })) {
                return i;
            }
        } else {
             // Fallback for WkX: prefix if full date parsing fails or isn't needed
            const weekNumMatch = header.match(/Wk(\d+):/);
            if (weekNumMatch) {
                const headerWeekNum = parseInt(weekNumMatch[1]);
                const currentWeekOfYear = getWeek(now, { weekStartsOn: 1 }); // ISO week
                 if (headerWeekNum === currentWeekOfYear && header.includes(`(${currentYear})`)) {
                    return i;
                }
            }
        }
    }
  } else if (interval === "Month") {
    const currentMonthStr = formatDateFn(now, "MMMM yyyy"); // e.g., "July 2024"
    const foundIndex = headers.findIndex(h => h === currentMonthStr);
    if (foundIndex !== -1) return foundIndex;
  }
  return 0; 
};


export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
  const [filterOptions, setFilterOptions] = useState(mockFilterOptions);
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>(ALL_BUSINESS_UNITS[0]); // Default to WFS
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>([]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState<number>(0); 
  
  const [currentDateDisplay, setCurrentDateDisplay] = useState("");
  const [dynamicDateDisplay, setDynamicDateDisplay] = useState<string | null>(null);
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const handleTeamMetricChange = useCallback((
    lobId: string, 
    teamNameToUpdate: TeamName, 
    periodHeader: string, 
    metricKey: keyof TeamPeriodicMetrics, 
    rawValue: string
  ) => {
    const newValue = parseFloat(rawValue);
    if (isNaN(newValue) && rawValue !== "" && rawValue !== "-") return;

    setRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntryIndex = newData.findIndex(lob => lob.id === lobId);
      if (lobEntryIndex === -1) return prevRawData;

      const lobEntry = newData[lobEntryIndex];
      const teamEntryIndex = lobEntry.teams.findIndex(team => team.teamName === teamNameToUpdate);
      if (teamEntryIndex === -1) return prevRawData;
      
      const teamEntry = lobEntry.teams[teamEntryIndex];

      if (!teamEntry.periodicInputData[periodHeader]) {
        teamEntry.periodicInputData[periodHeader] = { 
          aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null, 
          attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null, 
          moveOut: null, newHireBatch: null, newHireProduction: null, _productivity: null 
        };
      }
      
      (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = isNaN(newValue) ? null : newValue;

      if (metricKey === 'volumeMixPercentage') {
        const updatedTeamMix = Math.max(0, Math.min(100, isNaN(newValue) ? 0 : newValue));
        (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = updatedTeamMix;

        const otherTeams = lobEntry.teams.filter(t => t.teamName !== teamNameToUpdate);
        const currentTotalMixOfOtherTeams = otherTeams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        }, 0);
        
        const remainingMixPercentage = 100 - updatedTeamMix;

        if (otherTeams.length > 0) {
          if (currentTotalMixOfOtherTeams > 0) { // Distribute proportionally
            let distributedSum = 0;
            for (let i = 0; i < otherTeams.length; i++) {
              const team = otherTeams[i];
              const teamPeriodData = team.periodicInputData[periodHeader];
              const originalShare = (teamPeriodData?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShare;

              if (!team.periodicInputData[periodHeader]) {
                team.periodicInputData[periodHeader] = {};
              }

              if (i === otherTeams.length - 1 && otherTeams.length > 1) { // Ensure last team takes up slack for precision
                newShare = remainingMixPercentage - distributedSum;
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1)) ) ); 
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
          } else { // If other teams had 0 mix, distribute remaining equally
            const mixPerOtherTeam = otherTeams.length > 0 ? parseFloat((remainingMixPercentage / otherTeams.length).toFixed(1)) : 0;
            let distributedSum = 0;
            otherTeams.forEach((team, i) => {
              if (!team.periodicInputData[periodHeader]) {
                team.periodicInputData[periodHeader] = {};
              }
              let currentMix = mixPerOtherTeam;
              if (i === otherTeams.length -1 && otherTeams.length > 1) {
                  currentMix = remainingMixPercentage - distributedSum;
              }
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(currentMix.toFixed(1)) ));
              distributedSum += parseFloat(currentMix.toFixed(1));
            });
          }
        }
         // Final adjustment pass to ensure sum is exactly 100% due to floating point issues
        let finalSum = lobEntry.teams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        },0);
        
        if (finalSum !== 100 && lobEntry.teams.length > 0) {
            const diff = 100 - finalSum;
            const teamToAdjust = lobEntry.teams.find(t => t.teamName === teamNameToUpdate) || lobEntry.teams[0]; // Adjust the edited team or first team
             if (!teamToAdjust.periodicInputData[periodHeader]) {
                teamToAdjust.periodicInputData[periodHeader] = {};
              }
            (teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage = 
                Math.max(0, Math.min(100, parseFloat( ((teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage + diff).toFixed(1) ) ));
        }
      }
      return newData;
    });
  }, []);

  const handleVisiblePeriodsChange = useCallback((firstVisibleHeader: string | null, lastVisibleHeader: string | null) => {
    if (selectedTimeInterval === "Month" || (!firstVisibleHeader && !lastVisibleHeader)) {
      setDynamicDateDisplay(null); // For months, or if nothing is visible, fallback to pagination display
      return;
    }

    if (firstVisibleHeader && lastVisibleHeader) {
      // Extract MM/DD from "WkX: MM/DD-MM/DD (YYYY)"
      const firstDateMatch = firstVisibleHeader.match(/:\s*(\d{2}\/\d{2})/);
      const firstYearMatch = firstVisibleHeader.match(/\((\d{4})\)/);
      // Extract end MM/DD from "WkX: MM/DD-MM/DD (YYYY)"
      const lastDateMatch = lastVisibleHeader.match(/-(\d{2}\/\d{2})/);
      const lastYearMatch = lastVisibleHeader.match(/\((\d{4})\)/);

      const firstDateStr = firstDateMatch ? firstDateMatch[1] : '';
      const firstYearStr = firstYearMatch ? firstYearMatch[1] : '';
      const lastDateStr = lastDateMatch ? lastDateMatch[1] : '';
      const lastYearStr = lastYearMatch ? lastYearMatch[1] : '';
      
      if (firstDateStr && lastDateStr && firstYearStr && lastYearStr) {
        if (firstYearStr === lastYearStr) {
          setDynamicDateDisplay(`${firstDateStr} - ${lastDateStr} (${firstYearStr})`);
        } else {
          setDynamicDateDisplay(`${firstDateStr}/${firstYearStr} - ${lastDateStr}/${lastYearStr}`);
        }
      } else if (firstDateStr && firstYearStr) { // Only one week visible
         setDynamicDateDisplay(`${firstDateStr} (${firstYearStr})`);
      } else {
        setDynamicDateDisplay(null); // Fallback
      }
    } else if (firstVisibleHeader) {
      const firstDateMatch = firstVisibleHeader.match(/:\s*(\d{2}\/\d{2})/);
      const firstYearMatch = firstVisibleHeader.match(/\((\d{4})\)/);
      const firstDateStr = firstDateMatch ? firstDateMatch[1] : '';
      const firstYearStr = firstYearMatch ? firstYearMatch[1] : '';
       if (firstDateStr && firstYearStr) {
         setDynamicDateDisplay(`${firstDateStr} (${firstYearStr})`);
       } else {
         setDynamicDateDisplay(null);
       }
    } else {
      setDynamicDateDisplay(null);
    }
  }, [selectedTimeInterval]);

  const handleBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedBusinessUnit(bu);
    // When BU changes, reset LOB filter to "All LOBs" for that BU
    const newLobsForBu = BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness;
    setSelectedLineOfBusiness([...newLobsForBu]); // Select all LOBs by default for the new BU
    setFilterOptions(prev => {
        const currentLobs = ["All", ...newLobsForBu];
        if (JSON.stringify(prev.linesOfBusiness) !== JSON.stringify(currentLobs)) {
            return { ...prev, linesOfBusiness: currentLobs };
        }
        return prev;
    });
  }, []);
  
  const handleLOBChange = useCallback((lobs: string[]) => {
      setSelectedLineOfBusiness(lobs);
  }, []);


  useEffect(() => {
    // Initialize LOB filters when component mounts or selectedBusinessUnit is first set
    const initialLobsForBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;
    setSelectedLineOfBusiness([...initialLobsForBu]);
    setFilterOptions(prev => {
        const currentLobs = [...initialLobsForBu]; // No "All" here for the actual list
         // The DropdownMenu component will handle the "All X LOBs selected" display logic.
        return {
          ...prev,
          businessUnits: [...ALL_BUSINESS_UNITS], // Ensure this is just the names
          linesOfBusiness: currentLobs,
        };
    });
  }, [selectedBusinessUnit]); // Rerun when selectedBusinessUnit changes to set defaults
  
  
  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const periodsToDisplay = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    setDisplayedPeriodHeaders(periodsToDisplay);
    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;

    let relevantRawLobEntries = rawCapacityDataSource.filter(d => d.bu === selectedBusinessUnit);
    
    // Filter by selected LOBs if not all are implicitly selected
    const allLobsForSelectedBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;
    if (selectedLineOfBusiness.length !== allLobsForSelectedBu.length || !allLobsForSelectedBu.every(lob => selectedLineOfBusiness.includes(lob))) {
        relevantRawLobEntries = relevantRawLobEntries.filter(d => selectedLineOfBusiness.includes(d.lob));
    }


    const newDisplayData: CapacityDataRow[] = [];
    const newExpandedItemsSeed: Record<string, boolean> = {}; 

    const buName = selectedBusinessUnit;
    const buRawLobEntries = relevantRawLobEntries; // Already filtered by selected BU
    if (buRawLobEntries.length === 0 && selectedLineOfBusiness.length === 0) { // If no LOBs selected and BU has no matching entries
        setDisplayableCapacityData([]);
        setExpandedItems({});
        return;
    }


    const childrenLobsDataRows: CapacityDataRow[] = [];
    // Iterate over LOBs defined for the selected BU, but only process those in selectedLineOfBusiness
    BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness.forEach(lobName => {
        if (!selectedLineOfBusiness.includes(lobName)) {
            return; // Skip LOB if not in the multi-selected list
        }

        const lobRawEntry = buRawLobEntries.find(entry => entry.lob === lobName);
        if (!lobRawEntry) return;
          
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        (lobRawEntry.teams || []).forEach(teamRawEntry => {
            const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
            periodsToDisplay.forEach(period => {
              periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
                teamRawEntry.periodicInputData[period] || {}, 
                lobRawEntry.lobTotalBaseRequiredMinutes[period],
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
            let reqAgentMinutesSum = 0;
            let actAgentMinutesSum = 0;
            let reqHcSum = 0;
            let actHcSum = 0;

            childrenTeamsDataRows.forEach(teamRow => {
                const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                if (teamPeriodMetric) {
                    reqAgentMinutesSum += teamPeriodMetric._calculatedRequiredAgentMinutes ?? 0;
                    actAgentMinutesSum += teamPeriodMetric._calculatedActualAgentMinutes ?? 0;
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0;
                }
            });
            const adherence = reqAgentMinutesSum > 0 ? (actAgentMinutesSum / reqAgentMinutesSum) * 100 : null;
            lobPeriodicData[period] = {
                required: reqAgentMinutesSum, 
                actual: actAgentMinutesSum,   
                overUnder: actAgentMinutesSum - reqAgentMinutesSum,
                adherence: adherence,
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: actHcSum - reqHcSum,
            };
        });
             
        childrenLobsDataRows.push({
          id: lobRawEntry.id,
          name: lobName,
          level: 1, 
          itemType: 'LOB',
          periodicData: lobPeriodicData,
          children: childrenTeamsDataRows,
        });
        newExpandedItemsSeed[lobRawEntry.id] = expandedItems[lobRawEntry.id] !== undefined ? expandedItems[lobRawEntry.id] : true; 
    }); 

    if (childrenLobsDataRows.length > 0 || selectedLineOfBusiness.length > 0) {
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplay.forEach(period => {
        let reqAgentMinutesSum = 0;
        let actAgentMinutesSum = 0;
        let reqHcSum = 0;
        let actHcSum = 0;
        childrenLobsDataRows.forEach(lobRow => {
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqAgentMinutesSum += lobPeriodMetric.required ?? 0;
                actAgentMinutesSum += lobPeriodMetric.actual ?? 0;
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
              }
        });
        const adherence = reqAgentMinutesSum > 0 ? (actAgentMinutesSum / reqAgentMinutesSum) * 100 : null;
        buPeriodicData[period] = {
            required: reqAgentMinutesSum,
            actual: actAgentMinutesSum,
            overUnder: actAgentMinutesSum - reqAgentMinutesSum,
            adherence: adherence,
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: actHcSum - reqHcSum,
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
      newExpandedItemsSeed[buName] = expandedItems[buName] !== undefined ? expandedItems[buName] : true; 
    }
    
    setDisplayableCapacityData(newDisplayData);
    setExpandedItems(prev => {
        const updatedExpanded = {...prev};
        Object.keys(newExpandedItemsSeed).forEach(key => {
            if (updatedExpanded[key] === undefined) { // Only set if not previously set by user
                updatedExpanded[key] = newExpandedItemsSeed[key];
            }
        });
        return updatedExpanded;
    });
  }, [
      selectedBusinessUnit, 
      selectedLineOfBusiness, 
      selectedTimeInterval, 
      currentPeriodIndex,
      rawCapacityDataSource,
      expandedItems // Add expandedItems here to preserve state on re-renders not caused by explicit toggle
    ]);


  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);


  useEffect(() => {
    // This effect updates the pagination-based date display
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const currentBlock = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    if (currentBlock.length > 0) {
      const firstPeriodFull = currentBlock[0];
      const lastPeriodFull = currentBlock[currentBlock.length - 1];

      if (selectedTimeInterval === "Week") {
        const firstDateMatch = firstPeriodFull.match(/:\s*(\d{2}\/\d{2})/);
        const firstYearMatch = firstPeriodFull.match(/\((\d{4})\)/);
        const lastDateMatch = lastPeriodFull.match(/-(\d{2}\/\d{2})/); // Ensure this matches the end date correctly
        const lastDateFullMatch = lastPeriodFull.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);


        const firstDateStr = firstDateMatch ? firstDateMatch[1] : '';
        const firstYearStr = firstYearMatch ? firstYearMatch[1] : '';
        let lastDateStr = '';
        let lastYearStr = '';

        if (lastDateFullMatch) {
            lastDateStr = lastDateFullMatch[2]; // The second capture group is the end date MM/DD
            lastYearStr = lastDateFullMatch[3]; // The third capture group is the year
        }


        if (firstDateStr && lastDateStr && firstYearStr && lastYearStr) {
          if (firstYearStr === lastYearStr) {
            setCurrentDateDisplay(`${firstDateStr} - ${lastDateStr} (${firstYearStr})`);
          } else {
            setCurrentDateDisplay(`${firstDateStr}/${firstYearStr} - ${lastDateStr}/${lastYearStr}`);
          }
        } else if (firstDateStr && firstYearStr) { // Only one week in block
           setCurrentDateDisplay(`${firstDateStr} (${firstYearStr})`);
        } else {
           setCurrentDateDisplay("N/A");
        }
      } else { 
        setCurrentDateDisplay(currentBlock.length === 1 ? firstPeriodFull : `${firstPeriodFull} - ${lastPeriodFull}`);
      }
    } else {
      setCurrentDateDisplay("N/A");
    }
  }, [selectedTimeInterval, currentPeriodIndex, displayedPeriodHeaders]); // displayedPeriodHeaders might be redundant if others cover it

  const handleNavigateTime = (direction: "prev" | "next") => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const maxIndex = Math.max(0, sourcePeriods.length - NUM_PERIODS_DISPLAYED);
    
    let newIndex = currentPeriodIndex;
    if (direction === "prev") {
      newIndex = Math.max(0, currentPeriodIndex - NUM_PERIODS_DISPLAYED);
    } else {
      newIndex = Math.min(maxIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    }
    setCurrentPeriodIndex(newIndex);
    setDynamicDateDisplay(null); // Reset dynamic display on pagination
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  
  useEffect(() => {
    setCurrentPeriodIndex(0); 
    setDynamicDateDisplay(null); // Reset dynamic display on interval change
  }, [selectedTimeInterval]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={handleBusinessUnitChange}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={handleLOBChange}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={(val) => setSelectedTimeInterval(val as TimeInterval)}
        currentDateDisplay={dynamicDateDisplay || currentDateDisplay}
        onNavigateTime={handleNavigateTime}
      />
      <main className="flex-grow overflow-auto p-4">
        <CapacityTable 
          data={displayableCapacityData} 
          periodHeaders={displayedPeriodHeaders} 
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          teamMetricDefinitions={TEAM_METRIC_ROW_DEFINITIONS}
          aggregatedMetricDefinitions={AGGREGATED_METRIC_ROW_DEFINITIONS}
          onTeamMetricChange={handleTeamMetricChange}
          onVisiblePeriodsChange={handleVisiblePeriodsChange}
        />
      </main>
    </div>
  );
}

    