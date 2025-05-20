
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { mockRawCapacityData, mockFilterOptions } from "@/components/capacity-insights/data";
import { 
  ALL_WEEKS_HEADERS, 
  ALL_MONTH_HEADERS, 
  TimeInterval, 
  CapacityDataRow, 
  BusinessUnitName,
  LineOfBusinessName,
  RawLoBCapacityEntry,
  AggregatedPeriodicMetrics,
  TeamPeriodicMetrics,
  NUM_PERIODS_DISPLAYED,
  DYNAMIC_SUM_COLUMN_KEY,
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS, 
  GroupByOption,
  TeamName,
  RawTeamDataEntry,
  TEAM_METRIC_ROW_DEFINITIONS, // Will be used by table component later
  AGGREGATED_METRIC_ROW_DEFINITIONS, // Will be used by table component later
} from "@/components/capacity-insights/types";

const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60; // 40 hours * 60 minutes
const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60; // Average minutes per month


// Helper to calculate team-specific metrics for a single period
const calculateTeamMetricsForPeriod = (
  teamInputData: ReturnType<() => RawTeamDataEntry['periodicInputData'][string]>, // Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>
  lobBaseRequiredAgentMinutes: number | null,
  standardWorkMinutesForPeriod: number
): TeamPeriodicMetrics => {
  const defaults: TeamPeriodicMetrics = {
    aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
    attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null, moveOut: null,
    newHireBatch: null, newHireProduction: null, _productivity: null,
    _calculatedRequiredAgentMinutes: null, _calculatedActualAgentMinutes: null,
    requiredHC: null, overUnderHC: null,
    // BaseAgentMinuteValues - these are specific to LOB/BU summaries, not directly on TeamPeriodicMetrics like this
    // but we need a placeholder for _calculatedActualAgentMinutes for the sum.
    required: null, actual: null, overUnder: null, adherence: null, 
  };

  if (!teamInputData || lobBaseRequiredAgentMinutes === null) {
    return defaults;
  }

  const calculatedRequiredAgentMinutes = lobBaseRequiredAgentMinutes * ((teamInputData.volumeMixPercentage ?? 0) / 100);
  
  let requiredHC = null;
  if (calculatedRequiredAgentMinutes > 0 && standardWorkMinutesForPeriod > 0 && teamInputData.shrinkagePercentage !== null && teamInputData.occupancyPercentage !== null) {
    const effectiveMinutesPerHC = standardWorkMinutesForPeriod * 
                                 (1 - (teamInputData.shrinkagePercentage / 100)) * 
                                 (teamInputData.occupancyPercentage / 100);
    if (effectiveMinutesPerHC > 0) {
      requiredHC = calculatedRequiredAgentMinutes / effectiveMinutesPerHC;
    }
  }

  const actualHC = teamInputData.actualHC ?? null;
  const overUnderHC = (actualHC !== null && requiredHC !== null) ? actualHC - requiredHC : null;

  let calculatedActualAgentMinutes = null;
  if (calculatedRequiredAgentMinutes !== null && requiredHC !== null && requiredHC > 0 && actualHC !== null) {
    calculatedActualAgentMinutes = calculatedRequiredAgentMinutes * (actualHC / requiredHC);
  } else if (requiredHC === 0 && actualHC !== null && actualHC > 0) { // If no required, but actual HC exists, implies overstaffing for 0 demand
     calculatedActualAgentMinutes = 0; // Or could be some nominal minutes based on actualHC if needed
  }


  return {
    ...teamInputData,
    _calculatedRequiredAgentMinutes: calculatedRequiredAgentMinutes,
    _calculatedActualAgentMinutes: calculatedActualAgentMinutes,
    requiredHC: requiredHC,
    actualHC: actualHC,
    overUnderHC: overUnderHC,
    // Fields from BaseAgentMinuteValues are not directly part of TeamPeriodicMetrics for individual period display
    // but their underlying calculated minutes are used for aggregation.
    // For a Team row summary, these might be calculated (e.g. team's own adherence)
    required: null, // Not directly used by team rows in this way
    actual: null, // Not directly used by team rows in this way
    overUnder: null, // Not directly used by team rows in this way
    adherence: null, // Not directly used by team rows in this way
  };
};


// Helper to sum AggregatedPeriodicMetrics or TeamPeriodicMetrics, handling nulls
// Used for calculating the DYNAMIC_SUM_COLUMN_KEY
const aggregateAndSummarizeMetrics = (
  m1: AggregatedPeriodicMetrics | TeamPeriodicMetrics, 
  m2: AggregatedPeriodicMetrics | TeamPeriodicMetrics
): AggregatedPeriodicMetrics | TeamPeriodicMetrics => {
  
  const result = { ...m1 }; // Start with m1 as base, potentially add all unique keys from m2 later if needed

  // Sum agent-minute related fields (present in AggregatedPeriodicMetrics)
  result.required = (m1.required ?? 0) + (m2.required ?? 0);
  result.actual = (m1.actual ?? 0) + (m2.actual ?? 0);
  if (result.required !== null && result.required !== 0 && result.actual !== null) {
    result.overUnder = result.actual - result.required;
    result.adherence = (result.actual / result.required) * 100;
  } else {
    result.overUnder = (result.actual ?? 0) - (result.required ?? 0);
    result.adherence = null;
  }

  // Sum HC related fields (present in AggregatedPeriodicMetrics and TeamPeriodicMetrics)
  result.requiredHC = (m1.requiredHC ?? 0) + (m2.requiredHC ?? 0);
  result.actualHC = (m1.actualHC ?? 0) + (m2.actualHC ?? 0);
  if (result.requiredHC !== null && result.actualHC !== null) {
    result.overUnderHC = result.actualHC - result.requiredHC;
  } else {
    result.overUnderHC = null;
  }
  
  // Sum team-specific raw inputs for summary (if they are part of the structure, e.g. for a team's own sum row)
  // These are not typically summed for LOB/BU summaries, but for a team's summary column
  if ('aht' in m1 && 'aht' in m2) { // Check if these are TeamPeriodicMetrics
      // For team summary: AHT, Shrinkage, Occupancy, etc. are often weighted averages or taken from the latest period, not direct sums.
      // For simplicity in this generic summer, we'll take the value from m2 (the one being added).
      // A more sophisticated summary would handle these appropriately (e.g. weighted average for AHT).
      result.aht = m2.aht;
      result.shrinkagePercentage = m2.shrinkagePercentage;
      result.occupancyPercentage = m2.occupancyPercentage;
      result.backlogPercentage = m2.backlogPercentage;
      result.attritionPercentage = m2.attritionPercentage;
      result.volumeMixPercentage = (m1.volumeMixPercentage ?? 0) + (m2.volumeMixPercentage ?? 0); // Volume mix can be summed if it's about total contribution
      
      result.moveIn = (m1.moveIn ?? 0) + (m2.moveIn ?? 0);
      result.moveOut = (m1.moveOut ?? 0) + (m2.moveOut ?? 0);
      result.newHireBatch = (m1.newHireBatch ?? 0) + (m2.newHireBatch ?? 0);
      result.newHireProduction = (m1.newHireProduction ?? 0) + (m2.newHireProduction ?? 0);
      result._productivity = m2._productivity; // Take latest for productivity like metrics
  }

  // Sum underlying calculated agent minutes for consistency in totals, if present
  if ('_calculatedRequiredAgentMinutes' in result && '_calculatedRequiredAgentMinutes' in m2) {
    result._calculatedRequiredAgentMinutes = (m1._calculatedRequiredAgentMinutes ?? 0) + (m2._calculatedRequiredAgentMinutes ?? 0);
  }
  if ('_calculatedActualAgentMinutes' in result && '_calculatedActualAgentMinutes' in m2) {
    result._calculatedActualAgentMinutes = (m1._calculatedActualAgentMinutes ?? 0) + (m2._calculatedActualAgentMinutes ?? 0);
  }

  return result;
};

const initialAggregatedMetrics: AggregatedPeriodicMetrics = {
  required: 0, actual: 0, overUnder: 0, adherence: 0,
  requiredHC: 0, actualHC: 0, overUnderHC: 0,
};

const initialTeamPeriodMetricsForSum: TeamPeriodicMetrics = {
  aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
  attritionPercentage: null, volumeMixPercentage: 0, actualHC: 0, moveIn: 0, moveOut: 0,
  newHireBatch: 0, newHireProduction: 0, _productivity: null,
  _calculatedRequiredAgentMinutes: 0, _calculatedActualAgentMinutes: 0,
  requiredHC: 0, overUnderHC: 0,
  required: 0, actual: 0, overUnder: 0, adherence: null, 
};


export default function CapacityInsightsPage() {
  const [filterOptions, setFilterOptions] = useState(mockFilterOptions);
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName | "All">("All");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string>("All");
  const [selectedGroupBy, setSelectedGroupBy] = useState<GroupByOption>(filterOptions.groupByOptions[0]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0);
  const [currentDateDisplay, setCurrentDateDisplay] = useState("");
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

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

    let relevantRawLobEntries = mockRawCapacityData;
    if (selectedBusinessUnit !== "All") {
      relevantRawLobEntries = relevantRawLobEntries.filter(d => d.bu === selectedBusinessUnit);
    }
    if (selectedLineOfBusiness !== "All") {
      relevantRawLobEntries = relevantRawLobEntries.filter(d => d.lob === selectedLineOfBusiness);
    }

    const newDisplayData: CapacityDataRow[] = [];
    const newExpandedItems: Record<string, boolean> = {};

    if (selectedGroupBy === "Business Unit") {
      const busToProcess = selectedBusinessUnit === "All" ? ALL_BUSINESS_UNITS : [selectedBusinessUnit];

      busToProcess.forEach(buName => {
        const buRawLobEntries = relevantRawLobEntries.filter(entry => entry.bu === buName);
        if (buRawLobEntries.length === 0) return;

        const childrenLobsDataRows: CapacityDataRow[] = [];
        BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness.forEach(lobName => {
          const lobRawEntry = buRawLobEntries.find(entry => entry.lob === lobName);
          if (!lobRawEntry) return;
          
          // Apply LOB filter again if a specific LOB was selected at the top
          if (selectedLineOfBusiness !== "All" && selectedLineOfBusiness !== lobName) {
            return;
          }

          const childrenTeamsDataRows: CapacityDataRow[] = [];
          (lobRawEntry.teams || []).forEach(teamRawEntry => {
            const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
            periodsToDisplay.forEach(period => {
              periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
                teamRawEntry.periodicInputData[period],
                lobRawEntry.lobTotalBaseRequiredMinutes[period],
                standardWorkMinutes
              );
            });
            // Calculate Team Summary Column
            let teamSummaryMetrics = {...initialTeamPeriodMetricsForSum};
             periodsToDisplay.forEach(period => {
                teamSummaryMetrics = aggregateAndSummarizeMetrics(teamSummaryMetrics, periodicTeamMetrics[period]) as TeamPeriodicMetrics;
             });
            periodicTeamMetrics[DYNAMIC_SUM_COLUMN_KEY] = teamSummaryMetrics;
            
            childrenTeamsDataRows.push({
              id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`,
              name: teamRawEntry.teamName,
              level: 2, // BU -> LOB -> Team
              itemType: 'Team',
              periodicData: periodicTeamMetrics,
            });
          }); // End of teams for LOB

          if (childrenTeamsDataRows.length > 0 || (selectedLineOfBusiness === "All" || selectedLineOfBusiness === lobName)) {
             const lobPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
             periodsToDisplay.forEach(period => {
                let reqAgentMinutesSum = 0;
                let actAgentMinutesSum = 0;
                let reqHcSum = 0;
                let actHcSum = 0;
                childrenTeamsDataRows.forEach(teamRow => {
                    const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                    reqAgentMinutesSum += teamPeriodMetric._calculatedRequiredAgentMinutes ?? 0;
                    actAgentMinutesSum += teamPeriodMetric._calculatedActualAgentMinutes ?? 0;
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0;
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
             // Calculate LOB Summary Column
             let lobSummaryMetrics = {...initialAggregatedMetrics};
             periodsToDisplay.forEach(period => {
                lobSummaryMetrics = aggregateAndSummarizeMetrics(lobSummaryMetrics, lobPeriodicData[period]) as AggregatedPeriodicMetrics;
             });
             lobPeriodicData[DYNAMIC_SUM_COLUMN_KEY] = lobSummaryMetrics;

            childrenLobsDataRows.push({
              id: lobRawEntry.id,
              name: lobName,
              level: 1, // BU -> LOB
              itemType: 'LOB',
              periodicData: lobPeriodicData,
              children: childrenTeamsDataRows,
            });
            newExpandedItems[lobRawEntry.id] = true; // Expand LOB by default
          }
        }); // End of LOBs for BU

        if (childrenLobsDataRows.length > 0) {
          const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
          periodsToDisplay.forEach(period => {
            let reqAgentMinutesSum = 0;
            let actAgentMinutesSum = 0;
            let reqHcSum = 0;
            let actHcSum = 0;
            childrenLobsDataRows.forEach(lobRow => {
                const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
                reqAgentMinutesSum += lobPeriodMetric.required ?? 0;
                actAgentMinutesSum += lobPeriodMetric.actual ?? 0;
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
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
          // Calculate BU Summary Column
          let buSummaryMetrics = {...initialAggregatedMetrics};
          periodsToDisplay.forEach(period => {
             buSummaryMetrics = aggregateAndSummarizeMetrics(buSummaryMetrics, buPeriodicData[period]) as AggregatedPeriodicMetrics;
          });
          buPeriodicData[DYNAMIC_SUM_COLUMN_KEY] = buSummaryMetrics;

          newDisplayData.push({
            id: buName,
            name: buName,
            level: 0,
            itemType: 'BU',
            periodicData: buPeriodicData,
            children: childrenLobsDataRows,
          });
          newExpandedItems[buName] = true; // Expand BU by default
        }
      }); // End of BUs
    } else { // GroupBy "Line of Business"
      // Filter LOBs to consider based on selected BU (if any) and selected LOB
      const lobsToDisplay = Array.from(new Set(relevantRawLobEntries.map(d => d.lob)));

      lobsToDisplay.forEach(lobName => {
        const lobRawEntriesForCurrentLob = relevantRawLobEntries.filter(d => d.lob === lobName);
        if (lobRawEntriesForCurrentLob.length === 0) return;
        
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        // Aggregate teams from all BUs that have this LOB (if selectedBU is "All")
        lobRawEntriesForCurrentLob.forEach(lobRawEntry => {
            (lobRawEntry.teams || []).forEach(teamRawEntry => {
                const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
                periodsToDisplay.forEach(period => {
                periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
                    teamRawEntry.periodicInputData[period],
                    lobRawEntry.lobTotalBaseRequiredMinutes[period],
                    standardWorkMinutes
                );
                });
                // Calculate Team Summary Column
                let teamSummaryMetrics = {...initialTeamPeriodMetricsForSum};
                periodsToDisplay.forEach(period => {
                    teamSummaryMetrics = aggregateAndSummarizeMetrics(teamSummaryMetrics, periodicTeamMetrics[period]) as TeamPeriodicMetrics;
                });
                periodicTeamMetrics[DYNAMIC_SUM_COLUMN_KEY] = teamSummaryMetrics;

                childrenTeamsDataRows.push({
                id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`, // Ensure unique ID
                name: teamRawEntry.teamName,
                level: 1, // LOB -> Team
                itemType: 'Team',
                periodicData: periodicTeamMetrics,
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
                    reqAgentMinutesSum += teamPeriodMetric._calculatedRequiredAgentMinutes ?? 0;
                    actAgentMinutesSum += teamPeriodMetric._calculatedActualAgentMinutes ?? 0;
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0;
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
            // Calculate LOB Summary Column (when grouped by LOB)
            let lobSummaryMetrics = {...initialAggregatedMetrics};
            periodsToDisplay.forEach(period => {
                lobSummaryMetrics = aggregateAndSummarizeMetrics(lobSummaryMetrics, lobPeriodicData[period]) as AggregatedPeriodicMetrics;
            });
            lobPeriodicData[DYNAMIC_SUM_COLUMN_KEY] = lobSummaryMetrics;

            const lobId = lobName.replace(/\s+/g, '-');
            newDisplayData.push({
                id: lobId,
                name: lobName,
                level: 0,
                itemType: 'LOB',
                periodicData: lobPeriodicData,
                children: childrenTeamsDataRows,
            });
            newExpandedItems[lobId] = true; // Expand LOB by default
        }
      }); // End of LOBs when GroupBy LOB
    }
    
    setDisplayableCapacityData(newDisplayData);
    setExpandedItems(prev => ({...prev, ...newExpandedItems})); // Retain existing expanded state if possible, and add new default expansions
  }, [selectedBusinessUnit, selectedLineOfBusiness, selectedGroupBy, selectedTimeInterval, currentPeriodIndex]);


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
        const firstDateStr = firstPeriod.split(': ')[1]?.split('-')[0] ?? firstPeriod;
        const lastDateStr = lastPeriod.split(': ')[1]?.split('-')[1] ?? lastPeriod;
        setCurrentDateDisplay(`${firstDateStr} - ${lastDateStr} (2024)`);
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
    setCurrentPeriodIndex(0); // Reset to first page of periods when time interval changes
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
          periodHeaders={[...displayedPeriodHeaders, DYNAMIC_SUM_COLUMN_KEY]} 
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          dynamicSumKey={DYNAMIC_SUM_COLUMN_KEY}
          // Pass metric definitions for the table to use
          teamMetricDefinitions={TEAM_METRIC_ROW_DEFINITIONS}
          aggregatedMetricDefinitions={AGGREGATED_METRIC_ROW_DEFINITIONS}
        />
      </main>
    </div>
  );
}

