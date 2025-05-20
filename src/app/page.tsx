
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
  GroupByOption,
  TeamName,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
  RawTeamDataEntry,
} from "@/components/capacity-insights/types";
import type { MetricDefinition } from "@/components/capacity-insights/types";
import { parse, isWithinInterval, getWeek, getMonth, getYear, format as formatDate } from 'date-fns';


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

// This function is for determining the current period's index, not for default view.
const getIndexOfCurrentPeriod = (interval: TimeInterval, headers: string[]): number => {
  const now = new Date();
  if (interval === "Week") {
    // ALL_WEEKS_HEADERS are like "Wk1:...", "Wk2:..."
    // getWeek returns 1 for the first week, etc. Array index is 0-based.
    const currentWeekNumberOfYear = getWeek(now, { weekStartsOn: 1 }); // ISO week
    const calculatedIndex = currentWeekNumberOfYear - 1;
    if (calculatedIndex >= 0 && calculatedIndex < headers.length) {
      return calculatedIndex;
    }
  } else if (interval === "Month") {
    // ALL_MONTH_HEADERS are "January 2024", "February 2024", ...
    // getMonth(now) returns 0 for January, 1 for February, etc. This directly matches the index.
    const currentMonthIndex = getMonth(now);
    if (currentMonthIndex >= 0 && currentMonthIndex < headers.length) {
      return currentMonthIndex;
    }
  }
  return 0; // Fallback to the first period if current not found or out of range
};


export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
  const [filterOptions, setFilterOptions] = useState(mockFilterOptions);
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName | "All">("All");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string>("All");
  const [selectedGroupBy, setSelectedGroupBy] = useState<GroupByOption>(filterOptions.groupByOptions[0]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  
  // Initialize currentPeriodIndex to 0 to always start from the beginning
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState<number>(0);
  
  const [currentDateDisplay, setCurrentDateDisplay] = useState("");
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

              if (i === otherTeams.length - 1) { 
                newShare = remainingMixPercentage - distributedSum;
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1)) ) ); 
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
            // Final adjustment to ensure 100%
            const finalSum = lobEntry.teams.reduce((sum, t) => {
                const teamPeriodData = t.periodicInputData[periodHeader];
                return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
            },0);

            if (finalSum !== 100 && otherTeams.length > 0) {
                const diff = 100 - finalSum;
                const lastOtherTeam = otherTeams[otherTeams.length -1];
                 if (!lastOtherTeam.periodicInputData[periodHeader]) {
                    lastOtherTeam.periodicInputData[periodHeader] = {};
                  }
                (lastOtherTeam.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, ((lastOtherTeam.periodicInputData[periodHeader] as any).volumeMixPercentage ?? 0) + diff));
            }

          } else { // If other teams had 0 mix, distribute remaining equally
            const mixPerOtherTeam = otherTeams.length > 0 ? remainingMixPercentage / otherTeams.length : 0;
            otherTeams.forEach(team => {
              if (!team.periodicInputData[periodHeader]) {
                team.periodicInputData[periodHeader] = {};
              }
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(mixPerOtherTeam.toFixed(1)) ));
            });
             // Final adjustment to ensure 100%
            const finalSum = lobEntry.teams.reduce((sum, t) => {
                const teamPeriodData = t.periodicInputData[periodHeader];
                return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
            },0);
            if (finalSum !== 100 && otherTeams.length > 0) {
                const diff = 100 - finalSum;
                 const lastOtherTeam = otherTeams[otherTeams.length -1];
                 if (!lastOtherTeam.periodicInputData[periodHeader]) {
                    lastOtherTeam.periodicInputData[periodHeader] = {};
                  }
                (lastOtherTeam.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, ((lastOtherTeam.periodicInputData[periodHeader] as any).volumeMixPercentage ?? 0) + diff));
            }
          }
        }
      }
      return newData;
    });
  }, []);


  useEffect(() => {
    if (selectedBusinessUnit === "All") {
      const allLobs = Object.values(BUSINESS_UNIT_CONFIG).flatMap(bu => bu.lonsOfBusiness);
      const uniqueLobs = Array.from(new Set(allLobs));
      setFilterOptions(prev => ({ ...prev, linesOfBusiness: ["All", ...uniqueLobs] }));
    } else {
      setFilterOptions(prev => ({ 
        ...prev, 
        linesOfBusiness: ["All", ...BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness] 
      }));
    }
    setSelectedLineOfBusiness("All");
  }, [selectedBusinessUnit]);
  
  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const periodsToDisplay = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    setDisplayedPeriodHeaders(periodsToDisplay);
    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;

    let relevantRawLobEntries = rawCapacityDataSource; 
    if (selectedBusinessUnit !== "All") {
      relevantRawLobEntries = relevantRawLobEntries.filter(d => d.bu === selectedBusinessUnit);
    }
    if (selectedLineOfBusiness !== "All") {
      relevantRawLobEntries = relevantRawLobEntries.filter(d => d.lob === selectedLineOfBusiness);
    }

    const newDisplayData: CapacityDataRow[] = [];
    const newExpandedItemsSeed: Record<string, boolean> = {}; 

    if (selectedGroupBy === "Business Unit") {
      const busToProcess = selectedBusinessUnit === "All" ? ALL_BUSINESS_UNITS : [selectedBusinessUnit];

      busToProcess.forEach(buName => {
        const buRawLobEntries = relevantRawLobEntries.filter(entry => entry.bu === buName);
        if (buRawLobEntries.length === 0) return;

        const childrenLobsDataRows: CapacityDataRow[] = [];
        BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness.forEach(lobName => {
          const lobRawEntry = buRawLobEntries.find(entry => entry.lob === lobName);
          if (!lobRawEntry) return;
          
          if (selectedLineOfBusiness !== "All" && selectedLineOfBusiness !== lobName) {
            return;
          }

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

          if (childrenTeamsDataRows.length > 0 || (selectedLineOfBusiness === "All" || selectedLineOfBusiness === lobName)) {
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
                    required: reqAgentMinutesSum, // These are aggregated agent minutes
                    actual: actAgentMinutesSum,   // These are aggregated agent minutes
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
            newExpandedItemsSeed[lobRawEntry.id] = true; 
          }
        }); 

        if (childrenLobsDataRows.length > 0) {
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
          newExpandedItemsSeed[buName] = true; 
        }
      }); 
    } else { // GroupBy "Line of Business"
      const lobsToDisplay = Array.from(new Set(relevantRawLobEntries.map(d => d.lob)));

      lobsToDisplay.forEach(lobName => {
        const lobRawEntriesForCurrentLob = relevantRawLobEntries.filter(d => d.lob === lobName);
        if (lobRawEntriesForCurrentLob.length === 0) return;
        
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        // Use a consistent ID for LOB when grouped by LOB.
        // The lobRawEntry.id might vary if multiple BUs have same LOB name and user selected "All" BUs.
        // For top-level LOB grouping, the LOB name itself is a good unique ID.
        const lobIdForDisplay = lobName.toLowerCase().replace(/\s+/g, '-'); 
        
        lobRawEntriesForCurrentLob.forEach(lobRawEntry => { 
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
                  level: 1, 
                  itemType: 'Team',
                  periodicData: periodicTeamMetrics,
                  lobId: lobRawEntry.id, 
                });
            });
        });


        if (childrenTeamsDataRows.length > 0) {
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
            
            newDisplayData.push({
                id: lobIdForDisplay, 
                name: lobName,
                level: 0,
                itemType: 'LOB',
                periodicData: lobPeriodicData,
                children: childrenTeamsDataRows,
            });
            newExpandedItemsSeed[lobIdForDisplay] = true; 
        }
      }); 
    }
    
    setDisplayableCapacityData(newDisplayData);
    setExpandedItems(prev => {
        const updatedExpanded = {...prev};
        Object.keys(newExpandedItemsSeed).forEach(key => {
            if (updatedExpanded[key] === undefined) {
                updatedExpanded[key] = newExpandedItemsSeed[key];
            }
        });
        return updatedExpanded;
    });
  }, [
      selectedBusinessUnit, 
      selectedLineOfBusiness, 
      selectedGroupBy, 
      selectedTimeInterval, 
      currentPeriodIndex,
      rawCapacityDataSource 
    ]);


  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);


  useEffect(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const currentBlock = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    if (currentBlock.length > 0) {
      const firstPeriod = currentBlock[0];
      const lastPeriod = currentBlock[currentBlock.length - 1];
      if (selectedTimeInterval === "Week") {
        const firstDateMatch = firstPeriod.match(/:\s*(\d{2}\/\d{2})/);
        const lastDateMatch = lastPeriod.match(/-(\d{2}\/\d{2})$/); 

        const firstDateStr = firstDateMatch ? firstDateMatch[1] : firstPeriod.split(': ')[1]?.split('-')[0] || firstPeriod;
        const lastDateStr = lastDateMatch ? lastDateMatch[1] : lastPeriod.split('-').pop() || lastPeriod;
        
        setCurrentDateDisplay(`${firstDateStr} - ${lastDateStr} (${getYear(new Date(2024,0,1))})`); // Use 2024 for display consistency
      } else { 
        setCurrentDateDisplay(currentBlock.length === 1 ? firstPeriod : `${firstPeriod} - ${lastPeriod}`);
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
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  useEffect(() => {
    // When time interval changes, reset currentPeriodIndex to 0
    setCurrentPeriodIndex(0); 
  }, [selectedTimeInterval]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={(val) => setSelectedBusinessUnit(val as BusinessUnitName | "All")}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={setSelectedLineOfBusiness}
        selectedGroupBy={selectedGroupBy}
        onSelectGroupBy={(val) => setSelectedGroupBy(val as GroupByOption)}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={(val) => setSelectedTimeInterval(val as TimeInterval)}
        currentDateDisplay={currentDateDisplay}
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
        />
      </main>
    </div>
  );
}
