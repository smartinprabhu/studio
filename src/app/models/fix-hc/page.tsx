"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { initialMockRawCapacityData } from "@/components/capacity-insights/data";
import { calculateFixHCTeamMetricsForPeriod } from "@/models/fix-hc-model/calculations";
import { FIX_HC_MODEL_DEFINITIONS } from "@/models/fix-hc-model/definitions";
import type {
  CapacityDataRow,
  TeamPeriodicMetrics,
  AggregatedPeriodicMetrics,
  BusinessUnitName,
  TimeInterval,
  TeamName,
  RawLoBCapacityEntry,
} from "@/components/capacity-insights/types";
import {
  ALL_BUSINESS_UNITS,
  BUSINESS_UNIT_CONFIG,
  STANDARD_WEEKLY_WORK_MINUTES,
  STANDARD_MONTHLY_WORK_MINUTES,
} from "@/components/capacity-insights/types";
import type { ModelType } from "@/models/shared/interfaces";
import { getDefaultDateRange } from "@/utils/dateUtils";

export default function FixHCModelPage() {
  const [selectedModel] = useState<ModelType>('fix-hc');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("POS");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>(["Phone"]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(
    getDefaultDateRange("Week", 12)
  );
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; period: string; metricKey: string } | null>(null);
  const [activeHierarchyContext, setActiveHierarchyContext] = useState<string>("");
  const [rawCapacityData, setRawCapacityData] = useState<RawLoBCapacityEntry[]>(initialMockRawCapacityData);

  const headerPeriodScrollerRef = useRef<HTMLDivElement>(null);
  const tableBodyScrollRef = useRef<HTMLDivElement>(null);

  const actualLobsForCurrentBu = useMemo(() => {
    return BUSINESS_UNIT_CONFIG[selectedBusinessUnit]?.lonsOfBusiness || [];
  }, [selectedBusinessUnit]);

  const allAvailablePeriods = useMemo(() => {
    if (rawCapacityData.length === 0) return [];
    const firstEntry = rawCapacityData[0];
    return Object.keys(firstEntry.lobVolumeForecast || {});
  }, [rawCapacityData]);

  const displayedPeriodHeaders = useMemo(() => {
    if (!selectedDateRange?.from || !selectedDateRange?.to || allAvailablePeriods.length === 0) {
      return allAvailablePeriods.slice(0, 12);
    }
    return allAvailablePeriods.slice(0, 12);
  }, [selectedDateRange, allAvailablePeriods]);

  const processedCapacityData = useMemo(() => {
    const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" 
      ? STANDARD_WEEKLY_WORK_MINUTES 
      : STANDARD_MONTHLY_WORK_MINUTES;

    const filteredData = rawCapacityData.filter(entry => 
      entry.bu === selectedBusinessUnit && 
      selectedLineOfBusiness.includes(entry.lob)
    );

    const processedData: CapacityDataRow[] = [];

    // Group by Business Unit
    const buGroups = filteredData.reduce((acc, entry) => {
      if (!acc[entry.bu]) acc[entry.bu] = [];
      acc[entry.bu].push(entry);
      return acc;
    }, {} as Record<string, RawLoBCapacityEntry[]>);

    Object.entries(buGroups).forEach(([buName, buEntries]) => {
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};

      displayedPeriodHeaders.forEach(period => {
        let buRequiredHC = 0;
        let buActualHC = 0;

        buEntries.forEach(lobEntry => {
          const lobTotalBaseMinutes = lobEntry.lobTotalBaseRequiredMinutes[period] || 0;
          
          lobEntry.teams.forEach(teamEntry => {
            const teamInputData = teamEntry.periodicInputData[period] || {};
            const calculatedTeamMetrics = calculateFixHCTeamMetricsForPeriod(
              teamInputData,
              lobTotalBaseMinutes,
              standardWorkMinutesForPeriod
            );

            buRequiredHC += calculatedTeamMetrics.requiredHC || 0;
            buActualHC += calculatedTeamMetrics.actualHC || 0;
          });
        });

        buPeriodicData[period] = {
          requiredHC: buRequiredHC,
          actualHC: buActualHC,
          overUnderHC: buActualHC - buRequiredHC,
        };
      });

      const buRow: CapacityDataRow = {
        id: `bu-${buName.toLowerCase().replace(/\s+/g, '-')}`,
        name: buName,
        level: 0,
        itemType: 'BU',
        periodicData: buPeriodicData,
        children: [],
      };

      // Process LOBs under this BU
      buEntries.forEach(lobEntry => {
        const lobPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};

        displayedPeriodHeaders.forEach(period => {
          const lobVolume = lobEntry.lobVolumeForecast[period] || 0;
          const lobAHT = lobEntry.lobAverageAHT[period] || 0;
          const lobTotalBaseMinutes = lobEntry.lobTotalBaseRequiredMinutes[period] || (lobVolume * lobAHT);

          let lobRequiredHC = 0;
          let lobActualHC = 0;

          lobEntry.teams.forEach(teamEntry => {
            const teamInputData = teamEntry.periodicInputData[period] || {};
            const calculatedTeamMetrics = calculateFixHCTeamMetricsForPeriod(
              teamInputData,
              lobTotalBaseMinutes,
              standardWorkMinutesForPeriod
            );

            lobRequiredHC += calculatedTeamMetrics.requiredHC || 0;
            lobActualHC += calculatedTeamMetrics.actualHC || 0;
          });

          lobPeriodicData[period] = {
            lobVolumeForecast: lobVolume,
            lobAverageAHT: lobAHT,
            lobTotalBaseRequiredMinutes: lobTotalBaseMinutes,
            requiredHC: lobRequiredHC,
            actualHC: lobActualHC,
            overUnderHC: lobActualHC - lobRequiredHC,
          };
        });

        const lobRow: CapacityDataRow = {
          id: lobEntry.id,
          name: lobEntry.lob,
          level: 1,
          itemType: 'LOB',
          periodicData: lobPeriodicData,
          children: [],
        };

        // Process Teams under this LOB
        lobEntry.teams.forEach(teamEntry => {
          const teamPeriodicData: Record<string, TeamPeriodicMetrics> = {};

          displayedPeriodHeaders.forEach(period => {
            const teamInputData = teamEntry.periodicInputData[period] || {};
            const lobTotalBaseMinutes = lobEntry.lobTotalBaseRequiredMinutes[period] || 0;
            
            const calculatedTeamMetrics = calculateFixHCTeamMetricsForPeriod(
              teamInputData,
              lobTotalBaseMinutes,
              standardWorkMinutesForPeriod
            );

            teamPeriodicData[period] = calculatedTeamMetrics;
          });

          const teamRow: CapacityDataRow = {
            id: `${lobEntry.id}_${teamEntry.teamName.replace(/\s+/g, '-')}`,
            name: teamEntry.teamName,
            level: 2,
            itemType: 'Team',
            periodicData: teamPeriodicData,
            lobId: lobEntry.id,
          };

          lobRow.children!.push(teamRow);
        });

        buRow.children!.push(lobRow);
      });

      processedData.push(buRow);
    });

    return processedData;
  }, [rawCapacityData, selectedBusinessUnit, selectedLineOfBusiness, displayedPeriodHeaders, selectedTimeInterval]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleTeamMetricChange = useCallback((
    lobId: string,
    teamName: TeamName,
    periodHeader: string,
    metricKey: keyof TeamPeriodicMetrics,
    newValue: string
  ) => {
    setRawCapacityData(prevData => {
      return prevData.map(lobEntry => {
        if (lobEntry.id === lobId) {
          return {
            ...lobEntry,
            teams: lobEntry.teams.map(teamEntry => {
              if (teamEntry.teamName === teamName) {
                const numericValue = newValue === "" || newValue === "-" ? null : parseFloat(newValue);
                return {
                  ...teamEntry,
                  periodicInputData: {
                    ...teamEntry.periodicInputData,
                    [periodHeader]: {
                      ...teamEntry.periodicInputData[periodHeader],
                      [metricKey]: numericValue,
                    },
                  },
                };
              }
              return teamEntry;
            }),
          };
        }
        return lobEntry;
      });
    });
  }, []);

  const handleLobMetricChange = useCallback((
    lobId: string,
    periodHeader: string,
    metricKey: 'lobVolumeForecast' | 'lobAverageAHT' | 'lobTotalBaseRequiredMinutes',
    newValue: string
  ) => {
    setRawCapacityData(prevData => {
      return prevData.map(lobEntry => {
        if (lobEntry.id === lobId) {
          const numericValue = newValue === "" || newValue === "-" ? null : parseFloat(newValue);
          
          return {
            ...lobEntry,
            [metricKey]: {
              ...lobEntry[metricKey],
              [periodHeader]: numericValue,
            },
          };
        }
        return lobEntry;
      });
    });
  }, []);

  const handleSetEditingCell = useCallback((id: string | null, period: string | null, metricKey: string | null) => {
    if (id && period && metricKey) {
      setEditingCell({ id, period, metricKey });
    } else {
      setEditingCell(null);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (headerPeriodScrollerRef.current && tableBodyScrollRef.current) {
        headerPeriodScrollerRef.current.scrollLeft = tableBodyScrollRef.current.scrollLeft;
      }
    };

    const tableBodyElement = tableBodyScrollRef.current;
    if (tableBodyElement) {
      tableBodyElement.addEventListener('scroll', handleScroll);
      return () => tableBodyElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <HeaderSection
        allBusinessUnits={ALL_BUSINESS_UNITS}
        actualLobsForCurrentBu={actualLobsForCurrentBu}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={setSelectedBusinessUnit}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={setSelectedLineOfBusiness}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={setSelectedTimeInterval}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
        allAvailablePeriods={allAvailablePeriods}
        displayedPeriodHeaders={displayedPeriodHeaders}
        activeHierarchyContext={activeHierarchyContext}
        headerPeriodScrollerRef={headerPeriodScrollerRef}
        selectedModel={selectedModel}
        onModelChange={() => {}} // Not used in individual pages
      />
      <main className="flex-grow overflow-hidden">
        <CapacityTable
          data={processedCapacityData}
          periodHeaders={displayedPeriodHeaders}
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          teamMetricDefinitions={FIX_HC_MODEL_DEFINITIONS.teamMetrics}
          aggregatedMetricDefinitions={FIX_HC_MODEL_DEFINITIONS.aggregatedMetrics}
          onTeamMetricChange={handleTeamMetricChange}
          onLobMetricChange={handleLobMetricChange}
          editingCell={editingCell}
          onSetEditingCell={handleSetEditingCell}
          selectedTimeInterval={selectedTimeInterval}
          onActiveHierarchyChange={setActiveHierarchyContext}
          tableBodyScrollRef={tableBodyScrollRef}
          selectedModel={selectedModel}
        />
      </main>
    </div>
  );
}
