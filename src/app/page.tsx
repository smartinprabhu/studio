
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
  DYNAMIC_SUM_COLUMN_KEY,
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS, 
  GroupByOption,
  TeamName,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
  RawTeamDataEntry,
} from "@/components/capacity-insights/types";
import type { MetricDefinition } from "@/components/capacity-insights/types";


const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60; // 40 hours * 60 minutes
const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60; // Average minutes per month


// Helper to calculate team-specific metrics for a single period
const calculateTeamMetricsForPeriod = (
  teamInputData: RawTeamDataEntry['periodicInputData'][string], 
  lobBaseRequiredAgentMinutes: number | null,
  standardWorkMinutesForPeriod: number
): TeamPeriodicMetrics => {
  const defaults: Omit<TeamPeriodicMetrics, keyof RawTeamDataEntry['periodicInputData'][string]> & RawTeamDataEntry['periodicInputData'][string] = {
    ...teamInputData, // Spread input data first
    _calculatedRequiredAgentMinutes: null, 
    _calculatedActualAgentMinutes: null,
    requiredHC: null, 
    overUnderHC: null,
  };

  if (lobBaseRequiredAgentMinutes === null || lobBaseRequiredAgentMinutes === undefined) {
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
  } else if (calculatedRequiredAgentMinutes === 0) {
    requiredHC = 0;
  }


  const actualHC = teamInputData.actualHC ?? null;
  const overUnderHC = (actualHC !== null && requiredHC !== null) ? actualHC - requiredHC : null;

  let calculatedActualAgentMinutes = null;
  if (calculatedRequiredAgentMinutes !== null && requiredHC !== null && requiredHC > 0 && actualHC !== null) {
    // If we have requiredHC and actualHC, actual minutes can be scaled from required minutes
    calculatedActualAgentMinutes = calculatedRequiredAgentMinutes * (actualHC / requiredHC);
  } else if (requiredHC === 0 && actualHC !== null && actualHC > 0) { 
     // If no required HC (implying 0 required minutes for this team), but actual HC exists, actual minutes are effectively 0 from a "work done against requirement" perspective.
     // Or, if we wanted to show potential capacity: actualHC * effectiveMinutesPerHC (but this isn't "actual work done on required volume")
     calculatedActualAgentMinutes = 0; 
  } else if (requiredHC === null && actualHC !== null && actualHC > 0) {
    // If requiredHC couldn't be calculated (e.g. missing shrinkage/occ), but actualHC exists, we can't accurately determine actual agent minutes without more assumptions.
    // For now, let's assume if requiredHC is null due to missing inputs, actual agent minutes derived from it are also null.
    calculatedActualAgentMinutes = null;
  }


  return {
    ...teamInputData,
    _calculatedRequiredAgentMinutes: calculatedRequiredAgentMinutes,
    _calculatedActualAgentMinutes: calculatedActualAgentMinutes,
    requiredHC: requiredHC,
    actualHC: actualHC, // already in teamInputData
    overUnderHC: overUnderHC,
  };
};


const aggregateAndSummarizeMetrics = (
  m1: AggregatedPeriodicMetrics | TeamPeriodicMetrics, 
  m2: AggregatedPeriodicMetrics | TeamPeriodicMetrics
): AggregatedPeriodicMetrics | TeamPeriodicMetrics => {
  
  const result = { ...m1 }; 

  // Sum agent-minute related fields (present in AggregatedPeriodicMetrics)
  if ('required' in result && 'required' in m2) {
    result.required = (m1.required ?? 0) + (m2.required ?? 0);
  }
  if ('actual' in result && 'actual' in m2) {
    result.actual = (m1.actual ?? 0) + (m2.actual ?? 0);
  }
  if (result.required !== null && result.required !== 0 && result.actual !== null) {
    result.overUnder = result.actual - result.required;
    result.adherence = (result.actual / result.required) * 100;
  } else if (result.required === 0 && result.actual !== null && result.actual > 0) { // Infinite adherence if actual > 0 and required is 0
    result.overUnder = result.actual;
    result.adherence = null; // Or some indicator of 100%+ overstaffing
  } else {
    result.overUnder = (result.actual ?? 0) - (result.required ?? 0);
    result.adherence = null;
  }

  // Sum HC related fields
  result.requiredHC = (m1.requiredHC ?? 0) + (m2.requiredHC ?? 0);
  result.actualHC = (m1.actualHC ?? 0) + (m2.actualHC ?? 0); // actualHC is summed up
  if (result.requiredHC !== null && result.actualHC !== null) {
    result.overUnderHC = result.actualHC - result.requiredHC;
  } else {
    result.overUnderHC = null;
  }
  
  // For team summary (summing TeamPeriodicMetrics for the DYNAMIC_SUM_COLUMN_KEY of a team row)
  if ('aht' in m1 && 'aht' in m2) { // Indicates these are TeamPeriodicMetrics
      // For team summary: AHT, Shrinkage, Occupancy, etc. are typically weighted averages or taken from the latest period, not direct sums.
      // For the dynamic sum column, we'll represent these as averages or latest values rather than sums.
      // Let's assume m2 is the current period being added to the sum.
      // A proper weighted average would need total volume/minutes for weighting.
      // For sum column, these averages are less meaningful. Let's make them null in sum for now or take from m2.
      result.aht = m2.aht; 
      result.shrinkagePercentage = m2.shrinkagePercentage;
      result.occupancyPercentage = m2.occupancyPercentage;
      result.backlogPercentage = m2.backlogPercentage;
      result.attritionPercentage = m2.attritionPercentage;
      
      // Volume mix percentage sum can be misleading for a team's own summary row.
      // It sums to 100% across teams FOR A PERIOD, not for a team ACROSS periods.
      // Let's set it to the value from m2 for the summary column of a team.
      result.volumeMixPercentage = m2.volumeMixPercentage; 
      
      result.moveIn = (m1.moveIn ?? 0) + (m2.moveIn ?? 0);
      result.moveOut = (m1.moveOut ?? 0) + (m2.moveOut ?? 0);
      result.newHireBatch = (m1.newHireBatch ?? 0) + (m2.newHireBatch ?? 0);
      result.newHireProduction = (m1.newHireProduction ?? 0) + (m2.newHireProduction ?? 0);
      result._productivity = m2._productivity;
  }

  // Sum underlying calculated agent minutes for consistency in totals, if present
  if ('_calculatedRequiredAgentMinutes' in result && '_calculatedRequiredAgentMinutes' in m2 && m2._calculatedRequiredAgentMinutes !== null) {
    result._calculatedRequiredAgentMinutes = (result._calculatedRequiredAgentMinutes ?? 0) + (m2._calculatedRequiredAgentMinutes ?? 0);
  }
  if ('_calculatedActualAgentMinutes' in result && '_calculatedActualAgentMinutes' in m2 && m2._calculatedActualAgentMinutes !== null) {
    result._calculatedActualAgentMinutes = (result._calculatedActualAgentMinutes ?? 0) + (m2._calculatedActualAgentMinutes ?? 0);
  }

  return result;
};

const initialAggregatedMetrics: AggregatedPeriodicMetrics = {
  required: 0, actual: 0, overUnder: 0, adherence: null,
  requiredHC: 0, actualHC: 0, overUnderHC: 0,
};

const initialTeamPeriodMetricsForSum: TeamPeriodicMetrics = {
  aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
  attritionPercentage: null, volumeMixPercentage: 0, // Summing this for a team across periods might not be meaningful.
  actualHC: 0, moveIn: 0, moveOut: 0,
  newHireBatch: 0, newHireProduction: 0, _productivity: null,
  _calculatedRequiredAgentMinutes: 0, _calculatedActualAgentMinutes: 0,
  requiredHC: 0, overUnderHC: 0,
  // required, actual, overUnder, adherence are not directly on TeamPeriodicMetrics for display, but used in sum for LOB/BU
};


export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
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

  const handleTeamMetricChange = useCallback((
    lobId: string, 
    teamNameToUpdate: TeamName, 
    periodHeader: string, 
    metricKey: keyof TeamPeriodicMetrics, 
    rawValue: string
  ) => {
    const newValue = parseFloat(rawValue);
    if (isNaN(newValue) && rawValue !== "" && rawValue !== "-") return; // Allow empty or negative sign temporarily

    setRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntryIndex = newData.findIndex(lob => lob.id === lobId);
      if (lobEntryIndex === -1) return prevRawData;

      const lobEntry = newData[lobEntryIndex];
      const teamEntryIndex = lobEntry.teams.findIndex(team => team.teamName === teamNameToUpdate);
      if (teamEntryIndex === -1) return prevRawData;
      
      const teamEntry = lobEntry.teams[teamEntryIndex];

      if (!teamEntry.periodicInputData[periodHeader]) {
        // Initialize period if it doesn't exist, though it should from mock data
        teamEntry.periodicInputData[periodHeader] = { 
          aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null, 
          attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null, 
          moveOut: null, newHireBatch: null, newHireProduction: null, _productivity: null 
        };
      }
      
      // Update the specific metric
      (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = isNaN(newValue) ? null : newValue;


      // Dynamic Volume Mix Adjustment
      if (metricKey === 'volumeMixPercentage') {
        const updatedTeamMix = Math.max(0, Math.min(100, isNaN(newValue) ? 0 : newValue));
        (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = updatedTeamMix;

        const otherTeams = lobEntry.teams.filter(t => t.teamName !== teamNameToUpdate);
        const currentTotalMixOfOtherTeams = otherTeams.reduce((sum, t) => sum + (t.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0), 0);
        const totalMixOfAllTeams = updatedTeamMix + currentTotalMixOfOtherTeams;
        
        const remainingMixPercentage = 100 - updatedTeamMix;

        if (otherTeams.length > 0) {
          if (currentTotalMixOfOtherTeams > 0) {
            // Distribute proportionally
            let distributedSum = 0;
            for (let i = 0; i < otherTeams.length; i++) {
              const team = otherTeams[i];
              const originalShare = (team.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShare;
              if (i === otherTeams.length - 1) { // Last team takes the remainder to ensure sum is 100
                newShare = remainingMixPercentage - distributedSum;
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1)) ) ); // Clamp and fix precision
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
            // Final check to ensure sum is 100 due to rounding
            const finalSum = lobEntry.teams.reduce((sum, t) => sum + (t.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0), 0);
            if (finalSum !== 100 && otherTeams.length > 0) {
                const diff = 100 - finalSum;
                const lastOtherTeam = otherTeams[otherTeams.length -1];
                (lastOtherTeam.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, ((lastOtherTeam.periodicInputData[periodHeader] as any).volumeMixPercentage ?? 0) + diff));
            }

          } else {
            // Distribute equally if other teams had 0 mix
            const mixPerOtherTeam = remainingMixPercentage / otherTeams.length;
            otherTeams.forEach(team => {
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(mixPerOtherTeam.toFixed(1)) ));
            });
             // Adjust last team for rounding
            const finalSum = lobEntry.teams.reduce((sum, t) => sum + (t.periodicInputData[periodHeader]?.volumeMixPercentage ?? 0), 0);
            if (finalSum !== 100 && otherTeams.length > 0) {
                const diff = 100 - finalSum;
                 const lastOtherTeam = otherTeams[otherTeams.length -1];
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

    let relevantRawLobEntries = rawCapacityDataSource; // Use state data source
    if (selectedBusinessUnit !== "All") {
      relevantRawLobEntries = relevantRawLobEntries.filter(d => d.bu === selectedBusinessUnit);
    }
    if (selectedLineOfBusiness !== "All") {
      relevantRawLobEntries = relevantRawLobEntries.filter(d => d.lob === selectedLineOfBusiness);
    }

    const newDisplayData: CapacityDataRow[] = [];
    const newExpandedItemsSeed: Record<string, boolean> = {}; // For default expansion

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
                teamRawEntry.periodicInputData[period] || {}, // Ensure exists
                lobRawEntry.lobTotalBaseRequiredMinutes[period],
                standardWorkMinutes
              );
            });
            
            let teamSummaryMetrics = {...initialTeamPeriodMetricsForSum};
             periodsToDisplay.forEach(period => {
                const currentPeriodMetrics = periodicTeamMetrics[period];
                if (currentPeriodMetrics) {
                   teamSummaryMetrics = aggregateAndSummarizeMetrics(teamSummaryMetrics, currentPeriodMetrics) as TeamPeriodicMetrics;
                }
             });
            periodicTeamMetrics[DYNAMIC_SUM_COLUMN_KEY] = teamSummaryMetrics;
            
            childrenTeamsDataRows.push({
              id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`,
              name: teamRawEntry.teamName,
              level: 2, // BU -> LOB -> Team
              itemType: 'Team',
              periodicData: periodicTeamMetrics,
              lobId: lobRawEntry.id, // Pass LOB ID for edits
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
                    required: reqAgentMinutesSum,
                    actual: actAgentMinutesSum,
                    overUnder: actAgentMinutesSum - reqAgentMinutesSum,
                    adherence: adherence,
                    requiredHC: reqHcSum,
                    actualHC: actHcSum,
                    overUnderHC: actHcSum - reqHcSum,
                };
             });
             
             let lobSummaryMetrics = {...initialAggregatedMetrics};
             periodsToDisplay.forEach(period => {
                lobSummaryMetrics = aggregateAndSummarizeMetrics(lobSummaryMetrics, lobPeriodicData[period]) as AggregatedPeriodicMetrics;
             });
             lobPeriodicData[DYNAMIC_SUM_COLUMN_KEY] = lobSummaryMetrics;

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
          newExpandedItemsSeed[buName] = true; 
        }
      }); 
    } else { // GroupBy "Line of Business"
      const lobsToDisplay = Array.from(new Set(relevantRawLobEntries.map(d => d.lob)));

      lobsToDisplay.forEach(lobName => {
        const lobRawEntriesForCurrentLob = relevantRawLobEntries.filter(d => d.lob === lobName);
        if (lobRawEntriesForCurrentLob.length === 0) return;
        
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        const lobIdForDisplay = lobName.toLowerCase().replace(/\s+/g, '-'); // Consistent ID for top-level LOB
        
        lobRawEntriesForCurrentLob.forEach(lobRawEntry => { // This will usually be one, unless LOB name isn't unique across BUs
            (lobRawEntry.teams || []).forEach(teamRawEntry => {
                const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
                periodsToDisplay.forEach(period => {
                periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
                    teamRawEntry.periodicInputData[period] || {},
                    lobRawEntry.lobTotalBaseRequiredMinutes[period],
                    standardWorkMinutes
                );
                });
                
                let teamSummaryMetrics = {...initialTeamPeriodMetricsForSum};
                periodsToDisplay.forEach(period => {
                    const currentPeriodMetrics = periodicTeamMetrics[period];
                    if (currentPeriodMetrics) {
                        teamSummaryMetrics = aggregateAndSummarizeMetrics(teamSummaryMetrics, currentPeriodMetrics) as TeamPeriodicMetrics;
                    }
                });
                periodicTeamMetrics[DYNAMIC_SUM_COLUMN_KEY] = teamSummaryMetrics;

                childrenTeamsDataRows.push({
                  id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`, 
                  name: teamRawEntry.teamName,
                  level: 1, 
                  itemType: 'Team',
                  periodicData: periodicTeamMetrics,
                  lobId: lobRawEntry.id, // Pass LOB ID for edits
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
            
            let lobSummaryMetrics = {...initialAggregatedMetrics};
            periodsToDisplay.forEach(period => {
                lobSummaryMetrics = aggregateAndSummarizeMetrics(lobSummaryMetrics, lobPeriodicData[period]) as AggregatedPeriodicMetrics;
            });
            lobPeriodicData[DYNAMIC_SUM_COLUMN_KEY] = lobSummaryMetrics;

            newDisplayData.push({
                id: lobIdForDisplay, // Use the consistent LOB ID
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
    // Preserve existing expansions, only set defaults if not already set
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
      rawCapacityDataSource // Add as dependency
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
          periodHeaders={[...displayedPeriodHeaders, DYNAMIC_SUM_COLUMN_KEY]} 
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          dynamicSumKey={DYNAMIC_SUM_COLUMN_KEY}
          teamMetricDefinitions={TEAM_METRIC_ROW_DEFINITIONS}
          aggregatedMetricDefinitions={AGGREGATED_METRIC_ROW_DEFINITIONS}
          onTeamMetricChange={handleTeamMetricChange}
        />
      </main>
    </div>
  );
}
