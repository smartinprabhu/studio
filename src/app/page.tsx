
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
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS, 
  TeamName,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
  RawTeamDataEntry,
  LineOfBusinessName,
  ALL_TEAM_NAMES,
  NUM_PERIODS_DISPLAYED
} from "@/components/capacity-insights/types";
import type { MetricDefinition, FilterOptions } from "@/components/capacity-insights/types";
import { getWeek, getMonth, getYear, parse as dateParse, format as formatDateFn, startOfWeek, endOfWeek, isWithinInterval as isWithinIntervalFns, setDate, addDays, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns';
import type { DateRange } from "react-day-picker";

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
    // This case means we have actual HC but cannot determine required HC to derive actual minutes.
    // Actual agent minutes might be better derived from actualHC * standardWorkMinutes * productivity factors
    // For now, let's keep it null if requiredHC is null.
    calculatedActualAgentMinutes = null;
  } else if (actualHC === 0) {
    calculatedActualAgentMinutes = 0;
  }


  return {
    ...defaults,
    _calculatedRequiredAgentMinutes: calculatedRequiredAgentMinutes,
    _calculatedActualAgentMinutes: calculatedActualAgentMinutes,
    requiredHC: requiredHC,
    overUnderHC: overUnderHC,
  };
};

const parseDateFromHeaderStringMMDDYYYY = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;
  const parsedDate = new Date(parseInt(year), month - 1, day); 
  if (parsedDate.getFullYear() !== parseInt(year) || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null; 
  }
  return parsedDate;
};

const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (interval === "Week") {
    const match = header.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
    if (match) {
      const [, startDateStr, endDateStr, yearStr] = match;
      return {
        startDate: parseDateFromHeaderStringMMDDYYYY(startDateStr, yearStr),
        endDate: parseDateFromHeaderStringMMDDYYYY(endDateStr, yearStr),
      };
    }
  } else if (interval === "Month") {
    const date = dateParse(header, "MMMM yyyy", new Date());
    if (!isNaN(date.getTime())) {
      const year = getYear(date);
      const month = getMonth(date);
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return { startDate: firstDay, endDate: lastDay };
    }
  }
  return { startDate: null, endDate: null };
};

const getDefaultDateRange = (interval: TimeInterval): DateRange => {
  const headers = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
  const numPeriods = interval === "Week" ? Math.min(11, headers.length -1) : Math.min(2, headers.length-1); // Show 12 weeks or 3 months

  const fromDate = getHeaderDateRange(headers[0], interval).startDate;
  const toDate = getHeaderDateRange(headers[numPeriods], interval).endDate;
  
  return { from: fromDate || undefined, to: toDate || undefined };
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
  
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week"));

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

  const handleBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedBusinessUnit(bu);
    const newLobsForBu = BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness;
    setSelectedLineOfBusiness([...newLobsForBu]); 
  }, []);
  
  const handleLOBChange = useCallback((lobs: string[]) => {
      setSelectedLineOfBusiness(lobs);
  }, []);

  const handleTeamSelectionChange = useCallback((teams: TeamName[]) => {
    setSelectedTeams(teams);
  }, []);

  const handleTimeIntervalChange = useCallback((interval: TimeInterval) => {
    setSelectedTimeInterval(interval);
    setSelectedDateRange(getDefaultDateRange(interval));
  }, []);
  
  useEffect(() => {
    // Logic to update LOB filter options when BU changes
    const newLobsForBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;

    // Only update selectedLineOfBusiness if it's not already set to all LOBs for the new BU
    // or if the current selection is invalid for the new BU.
    const currentSelectionIsValidForNewBu = selectedLineOfBusiness.every(lob => newLobsForBu.includes(lob as any));
    const currentSelectionIsAllLobsForNewBu = 
        selectedLineOfBusiness.length === newLobsForBu.length &&
        selectedLineOfBusiness.every(lob => newLobsForBu.includes(lob as any));

    if (!currentSelectionIsValidForNewBu || !currentSelectionIsAllLobsForNewBu) {
        setSelectedLineOfBusiness([...newLobsForBu]);
    }
    
    setFilterOptions(prevFilterOptions => {
        const updatedLobs = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;
        // Check if options actually changed to avoid re-render loops
        if (JSON.stringify(prevFilterOptions.linesOfBusiness.sort()) !== JSON.stringify([...updatedLobs].sort())) {
            return {
                ...prevFilterOptions,
                linesOfBusiness: [...updatedLobs],
            };
        }
        return prevFilterOptions; // Return previous state if no change
    });
  }, [selectedBusinessUnit, selectedLineOfBusiness]); // Removed filterOptions from dependencies


  
  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    
    let periodsToDisplay: string[] = [];

    if (selectedDateRange?.from && selectedDateRange?.to) {
      const userRangeStart = selectedDateRange.from;
      const userRangeEnd = selectedDateRange.to;

      periodsToDisplay = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        
        return periodStartDate <= userRangeEnd && periodEndDate >= userRangeStart;
      });
    } else if (selectedDateRange?.from) { 
      const userRangeStart = selectedDateRange.from;
       periodsToDisplay = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        return periodEndDate >= userRangeStart; 
      });
      if (periodsToDisplay.length > NUM_PERIODS_DISPLAYED) {
        periodsToDisplay = periodsToDisplay.slice(0, NUM_PERIODS_DISPLAYED);
      }
    } else {
      periodsToDisplay = sourcePeriods.slice(0, NUM_PERIODS_DISPLAYED);
    }

    setDisplayedPeriodHeaders(periodsToDisplay);

    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;
    
    const newDisplayData: CapacityDataRow[] = [];
    const buName = selectedBusinessUnit; // Only one BU selected at a time now
    
    const relevantRawLobEntriesForSelectedBu = rawCapacityDataSource.filter(d => d.bu === buName);

    if (relevantRawLobEntriesForSelectedBu.length === 0) { 
        setDisplayableCapacityData([]);
        return;
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    
    // Filter LOBs based on multi-select OR show all if 'All LOBs for BU' effectively selected
    const lobsForCurrentBu = BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness;
    const lobsToDisplay = selectedLineOfBusiness.length === lobsForCurrentBu.length && selectedLineOfBusiness.every(lob => lobsForCurrentBu.includes(lob as any))
      ? lobsForCurrentBu 
      : selectedLineOfBusiness;

    lobsToDisplay.forEach(lobName => {
        const lobRawEntry = relevantRawLobEntriesForSelectedBu.find(entry => entry.lob === lobName);
        if (!lobRawEntry) return;
          
        const childrenTeamsDataRows: CapacityDataRow[] = [];
        const filteredTeamsForLob = (lobRawEntry.teams || [])
            .filter(teamRawEntry => selectedTeams.includes(teamRawEntry.teamName));


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
            let reqHcSum = 0;
            let actHcSum = 0;
            // let reqAgentMinutesSum = 0;
            // let actAgentMinutesSum = 0;

            childrenTeamsDataRows.forEach(teamRow => {
                const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                if (teamPeriodMetric) {
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0;
                    // reqAgentMinutesSum += teamPeriodMetric._calculatedRequiredAgentMinutes ?? 0;
                    // actAgentMinutesSum += teamPeriodMetric._calculatedActualAgentMinutes ?? 0;
                }
            });
            
            const overUnderHCSum = (actHcSum > 0 || reqHcSum > 0 || (actHcSum === 0 && reqHcSum === 0)) ? actHcSum - reqHcSum : null;
            // const overUnderAgentMinutesSum = (actAgentMinutesSum > 0 || reqAgentMinutesSum > 0 || (actAgentMinutesSum === 0 && reqAgentMinutesSum === 0)) ? actAgentMinutesSum - reqAgentMinutesSum : null;
            // const adherenceValue = (reqAgentMinutesSum > 0 && actAgentMinutesSum !== null) ? (actAgentMinutesSum / reqAgentMinutesSum) * 100 : null;
            
            lobPeriodicData[period] = {
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: overUnderHCSum,
                // required: reqAgentMinutesSum,
                // actual: actAgentMinutesSum,
                // overUnder: overUnderAgentMinutesSum,
                // adherence: adherenceValue,
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

    if (childrenLobsDataRows.length > 0 ) {
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplay.forEach(period => {
        let reqHcSum = 0;
        let actHcSum = 0;
        // let reqAgentMinutesSum = 0;
        // let actAgentMinutesSum = 0;

        childrenLobsDataRows.forEach(lobRow => {
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
                // reqAgentMinutesSum += lobPeriodMetric.required ?? 0;
                // actAgentMinutesSum += lobPeriodMetric.actual ?? 0;
              }
        });
        
        const overUnderHCSum = (actHcSum > 0 || reqHcSum > 0 || (actHcSum === 0 && reqHcSum === 0)) ? actHcSum - reqHcSum : null;
        // const overUnderAgentMinutesSum = (actAgentMinutesSum > 0 || reqAgentMinutesSum > 0 || (actAgentMinutesSum === 0 && reqAgentMinutesSum === 0)) ? actAgentMinutesSum - reqAgentMinutesSum : null;
        // const adherenceValue = (reqAgentMinutesSum > 0 && actAgentMinutesSum !== null) ? (actAgentMinutesSum / reqAgentMinutesSum) * 100 : null;

        buPeriodicData[period] = {
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: overUnderHCSum,
            // required: reqAgentMinutesSum,
            // actual: actAgentMinutesSum,
            // overUnder: overUnderAgentMinutesSum,
            // adherence: adherenceValue,
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
  // }, [
  //     selectedBusinessUnit, 
  //     selectedLineOfBusiness, 
  //     selectedTeams,
  //     selectedTimeInterval, 
  //     selectedDateRange,
  //     rawCapacityDataSource,
  //     expandedItems, // Added expandedItems as it's used in setExpandedItems
  //   ]);
  }, [
      selectedBusinessUnit, 
      selectedLineOfBusiness, 
      selectedTeams,
      selectedTimeInterval, 
      selectedDateRange,
      rawCapacityDataSource, 
      // No longer directly depending on expandedItems to set new expansions
    ]);


  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={handleBusinessUnitChange}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={handleLOBChange}
        selectedTeams={selectedTeams}
        onSelectTeams={handleTeamSelectionChange}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={handleTimeIntervalChange}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
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

