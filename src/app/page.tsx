
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
  // Dates are 1-indexed for month, 0-indexed in JS Date
  const parsedDate = new Date(parseInt(year), month - 1, day); 
  if (parsedDate.getFullYear() !== parseInt(year) || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null; // Invalid date, e.g. 02/30
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
  
  const getDefaultDateRange = (interval: TimeInterval): DateRange => {
    const headers = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const fromDate = getHeaderDateRange(headers[0], interval).startDate;
    let toDate;
    if (interval === "Week") {
      toDate = getHeaderDateRange(headers[Math.min(11, headers.length - 1)], interval).endDate;
    } else { // Month
      toDate = getHeaderDateRange(headers[Math.min(2, headers.length - 1)], interval).endDate;
    }
    return { from: fromDate || undefined, to: toDate || undefined };
  };

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
    const newLobsForBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;

    const lobsForCurrentBuAreDifferent = 
        JSON.stringify(selectedLineOfBusiness.sort()) !== JSON.stringify([...newLobsForBu].sort()) ||
        !selectedLineOfBusiness.every(lob => newLobsForBu.includes(lob as LineOfBusinessName<typeof selectedBusinessUnit>));

    if (lobsForCurrentBuAreDifferent) {
        setSelectedLineOfBusiness([...newLobsForBu]);
    }

    setFilterOptions(prevFilterOptions => {
        const currentLobsForFilter = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;
        const buOptionsUnchanged = JSON.stringify(prevFilterOptions.businessUnits.sort()) === JSON.stringify([...ALL_BUSINESS_UNITS].sort());
        const lobsForFilterUnchanged = JSON.stringify(prevFilterOptions.linesOfBusiness.sort()) === JSON.stringify([...currentLobsForFilter].sort());
        const teamsForFilterUnchanged = JSON.stringify(prevFilterOptions.teams.sort()) === JSON.stringify([...ALL_TEAM_NAMES].sort());

        if (!buOptionsUnchanged || !lobsForFilterUnchanged || !teamsForFilterUnchanged) {
            return {
                businessUnits: [...ALL_BUSINESS_UNITS], 
                linesOfBusiness: [...currentLobsForFilter],
                teams: [...ALL_TEAM_NAMES],
            };
        }
        return prevFilterOptions;
    });
  }, [selectedBusinessUnit, selectedLineOfBusiness]); 
  
  
  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    
    let periodsToDisplay: string[] = [];

    if (selectedDateRange?.from && selectedDateRange?.to) {
      const userRangeStart = selectedDateRange.from;
      const userRangeEnd = selectedDateRange.to;

      periodsToDisplay = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        
        // Check for intersection: (StartA <= EndB) and (EndA >= StartB)
        return periodStartDate <= userRangeEnd && periodEndDate >= userRangeStart;
      });
    } else if (selectedDateRange?.from) { // Only "from" date is selected
      const userRangeStart = selectedDateRange.from;
       periodsToDisplay = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        return periodEndDate >= userRangeStart; // Include if period ends on or after the selected start
      });
      // Optionally limit to a certain number if only 'from' is picked, e.g., next N periods
      // periodsToDisplay = periodsToDisplay.slice(0, NUM_PERIODS_DISPLAYED); 
    } else {
      // Default to a certain number of periods if no range selected
      // This case should be less common with the new date picker defaulting a range
      periodsToDisplay = sourcePeriods.slice(0, selectedTimeInterval === "Week" ? 12 : 3);
    }

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
    const lobsForCurrentBu = BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness;
    
    // Filter LOBs based on multi-select OR show all if 'All LOBs for BU' effectively selected
    const lobsToDisplay = selectedLineOfBusiness.length === lobsForCurrentBu.length && selectedLineOfBusiness.every(lob => lobsForCurrentBu.includes(lob as any))
      ? lobsForCurrentBu // effectively "All" LOBs for this BU
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

            childrenTeamsDataRows.forEach(teamRow => {
                const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                if (teamPeriodMetric) {
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0;
                }
            });
            
            lobPeriodicData[period] = {
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: (actHcSum > 0 || reqHcSum > 0 || (actHcSum === 0 && reqHcSum === 0)) ? actHcSum - reqHcSum : null,
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
        childrenLobsDataRows.forEach(lobRow => {
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
              }
        });
        
        buPeriodicData[period] = {
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: (actHcSum > 0 || reqHcSum > 0 || (actHcSum === 0 && reqHcSum === 0)) ? actHcSum - reqHcSum : null,
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
      selectedDateRange,
      rawCapacityDataSource,
    ]);


  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  

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
