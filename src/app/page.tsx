
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { mockRawCapacityData as initialMockRawCapacityData } from "@/components/capacity-insights/data";
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
  ALL_TEAM_NAMES,
} from "@/components/capacity-insights/types";
import type { MetricDefinition, FilterOptions } from "@/components/capacity-insights/types";
import { getWeek, getMonth, getYear, parse as dateParse, format as formatDateFn, startOfWeek, endOfWeek, isWithinInterval as isWithinIntervalFns, setDate } from 'date-fns';


const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60; 
const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60; 


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
    ...teamInputData, 
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

const parseDateFromHeaderString = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;
  // Adjust for JavaScript's 0-indexed months
  const parsedDate = new Date(parseInt(year), month - 1, day);
  // Basic validation: if the parsed date's month/day doesn't match, it was invalid (e.g., 02/30)
  if (parsedDate.getFullYear() !== parseInt(year) || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null;
  }
  return parsedDate;
};


const getIndexOfCurrentPeriod = (interval: TimeInterval, headers: string[]): number => {
  const now = new Date();
  if (interval === "Week") {
    const currentYear = getYear(now);
    const currentWeekOfYear = getWeek(now, { weekStartsOn: 1 }); // ISO week

    for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const yearMatch = header.match(/\((\d{4})\)/);
        const dateRangeMatch = header.match(/(\d{2}\/\d{2})-(\d{2}\/\d{2})/);

        if (yearMatch && dateRangeMatch) {
            const headerYear = parseInt(yearMatch[1]);
            if (headerYear !== currentYear) continue;

            const [startDateStr, endDateStr] = dateRangeMatch.slice(1);
            
            const headerWeekStartDate = parseDateFromHeaderString(startDateStr, String(headerYear));
            // For end date, we need to be careful with parsing if it spans across years or months.
            // However, for weekly ranges within the same year, this should be fine.
            const headerWeekEndDate = parseDateFromHeaderString(endDateStr, String(headerYear));
            
            if(headerWeekStartDate && headerWeekEndDate) {
                const adjustedHeaderWeekEndDate = endOfWeek(headerWeekEndDate, { weekStartsOn: 1 });
                if (isWithinIntervalFns(now, { start: headerWeekStartDate, end: adjustedHeaderWeekEndDate })) {
                    return i;
                }
            }
        } else { // Fallback for "WkX:" format
            const weekNumMatch = header.match(/Wk(\d+):/);
            if (weekNumMatch) {
                const headerWeekNum = parseInt(weekNumMatch[1]);
                 if (headerWeekNum === currentWeekOfYear && header.includes(`(${currentYear})`)) {
                    return i;
                }
            }
        }
    }
  } else if (interval === "Month") {
    const currentMonthStr = formatDateFn(now, "MMMM yyyy"); 
    const foundIndex = headers.findIndex(h => h === currentMonthStr);
    if (foundIndex !== -1) return foundIndex;
  }
  return 0; 
};


export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(() => {
    const initialBu = ALL_BUSINESS_UNITS[0] as BusinessUnitName; 
    const initialLobsForBu = BUSINESS_UNIT_CONFIG[initialBu].lonsOfBusiness;
    return {
      businessUnits: [...ALL_BUSINESS_UNITS],
      linesOfBusiness: [...initialLobsForBu],
      teams: [...ALL_TEAM_NAMES],
    };
  });
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS"); 
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>(() => [...BUSINESS_UNIT_CONFIG["WFS"].lonsOfBusiness]);
  const [selectedTeams, setSelectedTeams] = useState<TeamName[]>([...ALL_TEAM_NAMES]);
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
          if (currentTotalMixOfOtherTeams > 0) { 
            let distributedSum = 0;
            for (let i = 0; i < otherTeams.length; i++) {
              const team = otherTeams[i];
              const teamPeriodData = team.periodicInputData[periodHeader];
              const originalShare = (teamPeriodData?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShare;

              if (!team.periodicInputData[periodHeader]) {
                team.periodicInputData[periodHeader] = {};
              }

              if (i === otherTeams.length - 1 && otherTeams.length > 1) { 
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
        
        let finalSum = lobEntry.teams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        },0);
        
        if (finalSum !== 100 && lobEntry.teams.length > 0) {
            const diff = 100 - finalSum;
            const teamToAdjust = lobEntry.teams.find(t => t.teamName === teamNameToUpdate) || lobEntry.teams[0]; 
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
      setDynamicDateDisplay(null); 
      return;
    }

    if (firstVisibleHeader && lastVisibleHeader) {
      const firstDateFullMatch = firstVisibleHeader.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
      const lastDateFullMatch = lastVisibleHeader.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);

      const startDateStr = firstDateFullMatch ? firstDateFullMatch[1] : ''; 
      const startYearStr = firstDateFullMatch ? firstDateFullMatch[3] : '';
      const endDateStr = lastDateFullMatch ? lastDateFullMatch[2] : '';    
      const endYearStr = lastDateFullMatch ? lastDateFullMatch[3] : '';

      const startDate = parseDateFromHeaderString(startDateStr, startYearStr);
      const endDate = parseDateFromHeaderString(endDateStr, endYearStr);
      
      if (startDate && endDate) {
         setDynamicDateDisplay(`${formatDateFn(startDate, "dd/MM")} - ${formatDateFn(endDate, "dd/MM")}`);
      } else {
        setDynamicDateDisplay(null); 
      }
    } else if (firstVisibleHeader) { 
       const firstDateFullMatch = firstVisibleHeader.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
       if (firstDateFullMatch) {
           const startDateStr = firstDateFullMatch[1];
           const endDateStr = firstDateFullMatch[2];
           const yearStr = firstDateFullMatch[3];
           const startDate = parseDateFromHeaderString(startDateStr, yearStr);
           const endDate = parseDateFromHeaderString(endDateStr, yearStr);
           if (startDate && endDate) {
               setDynamicDateDisplay(`${formatDateFn(startDate, "dd/MM")} - ${formatDateFn(endDate, "dd/MM")}`);
           } else {
               setDynamicDateDisplay(null);
           }
       } else {
         setDynamicDateDisplay(null);
       }
    } else {
      setDynamicDateDisplay(null);
    }
  }, [selectedTimeInterval]);

  const handleBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedBusinessUnit(bu);
    const newLobsForBu = BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness;
    setSelectedLineOfBusiness([...newLobsForBu]); // Select all LOBs for the new BU by default
    // No need to update filterOptions.linesOfBusiness here, it's derived in the useEffect below
  }, []);
  
  const handleLOBChange = useCallback((lobs: string[]) => {
      setSelectedLineOfBusiness(lobs);
  }, []);

  const handleTeamSelectionChange = useCallback((teams: TeamName[]) => {
    setSelectedTeams(teams);
  }, []);


  useEffect(() => {
    const newLobsForBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;

    setSelectedLineOfBusiness(prevSelectedLOBs => {
      const sortedPrev = [...prevSelectedLOBs].sort().join(',');
      const sortedNew = [...newLobsForBu].sort().join(',');
      // Only update if the LOB list for the BU is actually different,
      // or if the selected LOBs are not a subset of the new BU's LOBs (e.g. BU changed)
      if (sortedPrev !== sortedNew || !prevSelectedLOBs.every(lob => newLobsForBu.includes(lob as LineOfBusinessName<typeof selectedBusinessUnit>)) ) {
        return [...newLobsForBu];
      }
      return prevSelectedLOBs;
    });

    setFilterOptions(prevFilterOptions => {
        const lobsForCurrentBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;
        const buOptionsUnchanged = JSON.stringify(prevFilterOptions.businessUnits.sort()) === JSON.stringify([...ALL_BUSINESS_UNITS].sort());
        const lobsForFilterUnchanged = JSON.stringify(prevFilterOptions.linesOfBusiness.sort()) === JSON.stringify([...lobsForCurrentBu].sort());
        const teamsForFilterUnchanged = JSON.stringify(prevFilterOptions.teams.sort()) === JSON.stringify([...ALL_TEAM_NAMES].sort());

        if (!buOptionsUnchanged || !lobsForFilterUnchanged || !teamsForFilterUnchanged) {
            return {
                businessUnits: [...ALL_BUSINESS_UNITS], 
                linesOfBusiness: [...lobsForCurrentBu],
                teams: [...ALL_TEAM_NAMES],
            };
        }
        return prevFilterOptions;
    });
  }, [selectedBusinessUnit]); 
  
  
  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const periodsToDisplay = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    setDisplayedPeriodHeaders(periodsToDisplay);
    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;

    const relevantRawLobEntriesForSelectedBu = rawCapacityDataSource.filter(d => d.bu === selectedBusinessUnit);
    
    const newDisplayData: CapacityDataRow[] = [];
    
    const buName = selectedBusinessUnit;
    
    if (relevantRawLobEntriesForSelectedBu.length === 0 && selectedLineOfBusiness.length === 0) { 
        setDisplayableCapacityData([]);
        return;
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness.forEach(lobName => {
        if (!selectedLineOfBusiness.includes(lobName)) {
            return; 
        }

        const lobRawEntry = relevantRawLobEntriesForSelectedBu.find(entry => entry.lob === lobName);
        if (!lobRawEntry) return;
          
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        const filteredTeamsForLob = (lobRawEntry.teams || []).filter(team => selectedTeams.includes(team.teamName));

        filteredTeamsForLob.forEach(teamRawEntry => {
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
            
            lobPeriodicData[period] = {
                required: reqAgentMinutesSum, 
                actual: actAgentMinutesSum,   
                overUnder: actAgentMinutesSum - reqAgentMinutesSum,
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: (actHcSum > 0 || reqHcSum > 0) ? actHcSum - reqHcSum : null,
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
        
        buPeriodicData[period] = {
            required: reqAgentMinutesSum,
            actual: actAgentMinutesSum,
            overUnder: actAgentMinutesSum - reqAgentMinutesSum,
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: (actHcSum > 0 || reqHcSum > 0) ? actHcSum - reqHcSum : null,
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
      selectedTeams,
      selectedTimeInterval, 
      currentPeriodIndex,
      rawCapacityDataSource,
    ]);


  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);


  useEffect(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const currentBlock = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    if (currentBlock.length > 0) {
      const firstPeriodFull = currentBlock[0];
      const lastPeriodFull = currentBlock[currentBlock.length - 1];

      if (selectedTimeInterval === "Week") {
        const firstWeekDataMatch = firstPeriodFull.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
        const lastWeekDataMatch = lastPeriodFull.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);

        if (firstWeekDataMatch && lastWeekDataMatch) {
            const displayStartDateStr = firstWeekDataMatch[1]; 
            const displayStartYearStr = firstWeekDataMatch[3];
            const displayEndDateStr = lastWeekDataMatch[2];   
            const displayEndYearStr = lastWeekDataMatch[3]; 

            const startDate = parseDateFromHeaderString(displayStartDateStr, displayStartYearStr);
            const endDate = parseDateFromHeaderString(displayEndDateStr, displayEndYearStr);

            if (startDate && endDate) {
                setCurrentDateDisplay(`${formatDateFn(startDate, "dd/MM")} - ${formatDateFn(endDate, "dd/MM")}`);
            } else {
                setCurrentDateDisplay("N/A");
            }
        } else {
           setCurrentDateDisplay("N/A");
        }
      } else { 
        setCurrentDateDisplay(currentBlock.length === 1 ? firstPeriodFull : `${firstPeriodFull} - ${lastPeriodFull}`);
      }
    } else {
      setCurrentDateDisplay("N/A");
    }
  }, [selectedTimeInterval, currentPeriodIndex, displayedPeriodHeaders]); 

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
    setDynamicDateDisplay(null); 
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  
  useEffect(() => {
    setCurrentPeriodIndex(0); 
    setDynamicDateDisplay(null); 
  }, [selectedTimeInterval]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={handleBusinessUnitChange}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={handleLOBChange}
        selectedTeams={selectedTeams}
        onSelectTeams={handleTeamSelectionChange}
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
