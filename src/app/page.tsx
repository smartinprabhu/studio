"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { 
  ALL_BUSINESS_UNITS,
  BUSINESS_UNIT_CONFIG,
  ALL_TEAM_NAMES,
  STANDARD_WEEKLY_WORK_MINUTES,
  STANDARD_MONTHLY_WORK_MINUTES,
  type BusinessUnitName,
  type LineOfBusinessName,
  type TeamName,
  type TimeInterval,
  type CapacityDataRow,
  type TeamPeriodicMetrics,
  type AggregatedPeriodicMetrics,
  type RawLoBCapacityEntry,
  type RawTeamDataEntry,
  getHeaderDateRange,
  findFiscalWeekHeaderForDate,
  ALL_WEEKS_HEADERS,
  ALL_MONTH_HEADERS,
} from "@/components/capacity-insights/types";
import { initialMockRawCapacityData } from "@/components/capacity-insights/data";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { ThemeProvider } from "../components/ThemeContext";
import { ModelSelector } from "@/components/model-selector/model-selector";
import { getModelDefinitions, calculateModelMetrics } from "@/models/shared";
import type { ModelType, ExtendedTeamPeriodicMetrics, ExtendedAggregatedPeriodicMetrics } from "@/models/shared/interfaces";

export default function CapacityInsightsPage() {
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<ModelType>('volume-backlog');
  
  // Existing state variables
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>([]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; period: string; metricKey: string } | null>(null);
  const [activeHierarchyContext, setActiveHierarchyContext] = useState<string>("");
  const [rawCapacityData, setRawCapacityData] = useState<RawLoBCapacityEntry[]>(initialMockRawCapacityData);

  // Refs for scroll synchronization
  const tableBodyScrollRef = useRef<HTMLDivElement>(null);
  const headerPeriodScrollerRef = useRef<HTMLDivElement>(null);

  // Get model-specific definitions
  const modelDefinitions = useMemo(() => getModelDefinitions(selectedModel), [selectedModel]);

  // Derived state calculations
  const actualLobsForCurrentBu = useMemo(() => {
    const config = BUSINESS_UNIT_CONFIG[selectedBusinessUnit];
    return config ? config.lonsOfBusiness as string[] : [];
  }, [selectedBusinessUnit]);

  const allAvailablePeriods = useMemo(() => {
    return selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
  }, [selectedTimeInterval]);

  const displayedPeriodHeaders = useMemo(() => {
    if (!selectedDateRange?.from || !selectedDateRange?.to) {
      return allAvailablePeriods.slice(0, 13);
    }

    const filteredHeaders: string[] = [];
    for (const header of allAvailablePeriods) {
      const { startDate, endDate } = getHeaderDateRange(header, selectedTimeInterval);
      if (startDate && endDate) {
        const headerStart = new Date(startDate);
        const headerEnd = new Date(endDate);
        const rangeStart = new Date(selectedDateRange.from);
        const rangeEnd = new Date(selectedDateRange.to);

        if (headerStart <= rangeEnd && headerEnd >= rangeStart) {
          filteredHeaders.push(header);
        }
      }
    }
    return filteredHeaders;
  }, [selectedDateRange, allAvailablePeriods, selectedTimeInterval]);

  // Enhanced calculation function with model support
  const calculateTeamMetricsForPeriod = useCallback((
    teamInput: Partial<ExtendedTeamPeriodicMetrics>,
    lobTotalBaseRequiredMinutes: number | null,
    standardWorkMinutesForPeriod: number,
    modelType: ModelType
  ): ExtendedTeamPeriodicMetrics => {
    const context = {
      modelType,
      useSimplifiedMetrics: ['fix-fte', 'fix-hc', 'billable-hours'].includes(modelType),
      primaryMetricKey: modelType === 'fix-fte' ? 'requiredFTE' as const : 'requiredHC' as const,
      standardWorkMinutesForPeriod
    };

    // Base calculations (common to all models)
    const attritionLossHC = (teamInput.actualHC && teamInput.attritionPercentage) 
      ? teamInput.actualHC * (teamInput.attritionPercentage / 100) 
      : null;

    const hcAfterAttrition = (teamInput.actualHC !== null && attritionLossHC !== null) 
      ? teamInput.actualHC - attritionLossHC 
      : null;

    const endingHC = (hcAfterAttrition !== null && 
                     teamInput.newHireProduction !== null && 
                     teamInput.moveIn !== null && 
                     teamInput.moveOut !== null) 
      ? hcAfterAttrition + teamInput.newHireProduction + teamInput.moveIn - teamInput.moveOut 
      : null;

    // Model-specific calculations
    let modelSpecificMetrics: Partial<ExtendedTeamPeriodicMetrics> = {};
    
    if (modelType === 'volume-backlog') {
      // Original Volume & Backlog calculation
      const teamEffectiveRequiredMinutes = lobTotalBaseRequiredMinutes && teamInput.volumeMixPercentage
        ? lobTotalBaseRequiredMinutes * (teamInput.volumeMixPercentage / 100) * (1 + ((teamInput.backlogPercentage || 0) / 100))
        : null;

      const shrinkageFactor = 1 - ((teamInput.shrinkagePercentage || 0) / 100);
      const occupancyFactor = (teamInput.occupancyPercentage || 85) / 100;
      const effectiveProductiveMinutes = standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor;

      const requiredHC = (teamEffectiveRequiredMinutes && effectiveProductiveMinutes > 0) 
        ? teamEffectiveRequiredMinutes / effectiveProductiveMinutes 
        : null;

      const actualProductiveMinutes = (teamInput.actualHC && shrinkageFactor && occupancyFactor) 
        ? teamInput.actualHC * standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor 
        : null;

      modelSpecificMetrics = {
        _calculatedRequiredAgentMinutes: teamEffectiveRequiredMinutes,
        requiredHC,
        _calculatedActualProductiveAgentMinutes: actualProductiveMinutes,
        overUnderHC: (teamInput.actualHC && requiredHC) ? teamInput.actualHC - requiredHC : null
      };
    } else {
      // Use model-specific calculation functions
      // Import the calculation functions directly to avoid circular dependency
      if (modelType === 'cph') {
        const cph = teamInput.cph || 1;
        const teamBaseMinutes = lobTotalBaseRequiredMinutes && teamInput.volumeMixPercentage
          ? lobTotalBaseRequiredMinutes * (teamInput.volumeMixPercentage / 100)
          : null;
        const backlogAdjustment = 1 + ((teamInput.backlogPercentage || 0) / 100);
        const effectiveRequiredMinutes = teamBaseMinutes ? teamBaseMinutes * backlogAdjustment : null;

        const shrinkageFactor = 1 - ((teamInput.shrinkagePercentage || 0) / 100);
        const occupancyFactor = (teamInput.occupancyPercentage || 85) / 100;
        const effectiveProductiveMinutes = standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor;

        const requiredHC = effectiveProductiveMinutes > 0 && effectiveRequiredMinutes ? effectiveRequiredMinutes / effectiveProductiveMinutes : null;

        modelSpecificMetrics = {
          _calculatedRequiredAgentMinutes: effectiveRequiredMinutes,
          requiredHC: requiredHC,
          overUnderHC: (teamInput.actualHC && requiredHC) ? teamInput.actualHC - requiredHC : null
        };
      } else if (modelType === 'fix-fte') {
        const teamBaseMinutes = lobTotalBaseRequiredMinutes && teamInput.volumeMixPercentage
          ? lobTotalBaseRequiredMinutes * (teamInput.volumeMixPercentage / 100)
          : null;
        const simplifiedFTE = teamBaseMinutes ? teamBaseMinutes / (standardWorkMinutesForPeriod * 1.33) : null;

        modelSpecificMetrics = {
          _calculatedRequiredAgentMinutes: teamBaseMinutes,
          requiredFTE: simplifiedFTE,
          overUnderHC: (teamInput.actualHC && simplifiedFTE) ? teamInput.actualHC - simplifiedFTE : null
        };
      } else if (modelType === 'fix-hc') {
        const teamBaseMinutes = lobTotalBaseRequiredMinutes && teamInput.volumeMixPercentage
          ? lobTotalBaseRequiredMinutes * (teamInput.volumeMixPercentage / 100)
          : null;
        const simplifiedHC = teamBaseMinutes ? teamBaseMinutes / (standardWorkMinutesForPeriod * 1.33) : null;

        modelSpecificMetrics = {
          _calculatedRequiredAgentMinutes: teamBaseMinutes,
          requiredHC: simplifiedHC,
          overUnderHC: (teamInput.actualHC && simplifiedHC) ? teamInput.actualHC - simplifiedHC : null
        };
      } else if (modelType === 'billable-hours') {
        const teamBillableHours = lobTotalBaseRequiredMinutes && teamInput.volumeMixPercentage
          ? (lobTotalBaseRequiredMinutes / 60) * (teamInput.volumeMixPercentage / 100)
          : null;
        const standardHoursPerPeriod = standardWorkMinutesForPeriod / 60;
        const requiredHC = teamBillableHours ? teamBillableHours / standardHoursPerPeriod : null;

        modelSpecificMetrics = {
          requiredHC: requiredHC,
          overUnderHC: (teamInput.actualHC && requiredHC) ? teamInput.actualHC - requiredHC : null
        };
      }
    }

    return {
      ...teamInput,
      ...modelSpecificMetrics,
      attritionLossHC,
      hcAfterAttrition,
      endingHC,
    } as ExtendedTeamPeriodicMetrics;
  }, []);

  // Process raw data into hierarchical structure with model-aware calculations
  const processedCapacityData = useMemo(() => {
    const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" 
      ? STANDARD_WEEKLY_WORK_MINUTES 
      : STANDARD_MONTHLY_WORK_MINUTES;

    const filteredRawData = rawCapacityData.filter(entry => 
      entry.bu === selectedBusinessUnit && 
      (selectedLineOfBusiness.length === 0 || selectedLineOfBusiness.includes(entry.lob))
    );

    const buData: CapacityDataRow[] = [];
    const buMap = new Map<string, CapacityDataRow>();

    filteredRawData.forEach(lobEntry => {
      if (!buMap.has(lobEntry.bu)) {
        buMap.set(lobEntry.bu, {
          id: `bu_${lobEntry.bu.toLowerCase().replace(/\s+/g, '-')}`,
          name: lobEntry.bu,
          level: 0,
          itemType: 'BU',
          periodicData: {},
          children: []
        });
      }

      const buItem = buMap.get(lobEntry.bu)!;
      const lobPeriodicData: Record<string, ExtendedAggregatedPeriodicMetrics> = {};

      displayedPeriodHeaders.forEach(periodHeader => {
        const lobVolume = lobEntry.lobVolumeForecast[periodHeader];
        const lobAHT = lobEntry.lobAverageAHT[periodHeader];
        const lobBaseMinutes = lobEntry.lobTotalBaseRequiredMinutes[periodHeader];

        // Model-specific LOB calculations
        let calculatedBaseMinutes = lobBaseMinutes;
        let lobMetrics: Partial<ExtendedAggregatedPeriodicMetrics> = {};

        if (selectedModel === 'cph' && lobVolume && lobEntry.lobAverageAHT[periodHeader]) {
          // For CPH model, convert AHT to CPH for display but use AHT for calculation
          const averageCPH = 60 / lobEntry.lobAverageAHT[periodHeader]!;
          calculatedBaseMinutes = lobVolume * lobEntry.lobAverageAHT[periodHeader]!;
          lobMetrics = {
            lobVolumeForecast: lobVolume,
            lobAverageAHT: lobEntry.lobAverageAHT[periodHeader],
            lobTotalBaseRequiredMinutes: calculatedBaseMinutes
          };
        } else if (selectedModel === 'billable-hours') {
          lobMetrics = {
            lobTotalBaseRequiredMinutes: lobBaseMinutes,
            lobVolumeForecast: lobVolume
          };
        } else {
          lobMetrics = {
            lobVolumeForecast: lobVolume,
            lobAverageAHT: lobAHT,
            lobTotalBaseRequiredMinutes: calculatedBaseMinutes
          };
        }

        // Calculate team metrics and aggregate
        let aggregatedRequiredHC = 0;
        let aggregatedActualHC = 0;
        let hasValidData = false;

        lobEntry.teams.forEach(teamEntry => {
          const teamInputData = teamEntry.periodicInputData[periodHeader] || {};
          const calculatedTeamMetrics = calculateTeamMetricsForPeriod(
            teamInputData,
            calculatedBaseMinutes,
            standardWorkMinutesForPeriod,
            selectedModel
          );

          const primaryMetric = selectedModel === 'fix-fte' ? calculatedTeamMetrics.requiredFTE : calculatedTeamMetrics.requiredHC;
          if (primaryMetric !== null && primaryMetric !== undefined) {
            aggregatedRequiredHC += primaryMetric;
            hasValidData = true;
          }
          if (calculatedTeamMetrics.actualHC !== null && calculatedTeamMetrics.actualHC !== undefined) {
            aggregatedActualHC += calculatedTeamMetrics.actualHC;
          }
        });

        const finalRequiredMetric = hasValidData ? aggregatedRequiredHC : null;
        const finalActualMetric = aggregatedActualHC > 0 ? aggregatedActualHC : null;

        lobPeriodicData[periodHeader] = {
          ...lobMetrics,
          [selectedModel === 'fix-fte' ? 'requiredFTE' : 'requiredHC']: finalRequiredMetric,
          actualHC: finalActualMetric,
          overUnderHC: (finalActualMetric && finalRequiredMetric) ? finalActualMetric - finalRequiredMetric : null,
        } as ExtendedAggregatedPeriodicMetrics;
      });

      // Create LOB item with teams
      const lobItem: CapacityDataRow = {
        id: lobEntry.id,
        name: lobEntry.lob,
        level: 1,
        itemType: 'LOB',
        periodicData: lobPeriodicData,
        children: lobEntry.teams.map(teamEntry => {
          const teamPeriodicData: Record<string, ExtendedTeamPeriodicMetrics> = {};

          displayedPeriodHeaders.forEach(periodHeader => {
            const teamInputData = teamEntry.periodicInputData[periodHeader] || {};
            const lobBaseMinutes = lobEntry.lobTotalBaseRequiredMinutes[periodHeader];
            
            teamPeriodicData[periodHeader] = calculateTeamMetricsForPeriod(
              teamInputData,
              lobBaseMinutes,
              standardWorkMinutesForPeriod,
              selectedModel
            );
          });

          return {
            id: `${lobEntry.id}_${teamEntry.teamName.replace(/\s+/g, '-')}`,
            name: teamEntry.teamName,
            level: 2,
            itemType: 'Team' as const,
            periodicData: teamPeriodicData,
            lobId: lobEntry.id
          };
        })
      };

      buItem.children!.push(lobItem);
    });

    // Calculate BU aggregations
    buMap.forEach(buItem => {
      const buPeriodicData: Record<string, ExtendedAggregatedPeriodicMetrics> = {};

      displayedPeriodHeaders.forEach(periodHeader => {
        let buRequiredHC = 0;
        let buActualHC = 0;
        let hasValidData = false;

        buItem.children?.forEach(lobItem => {
          const lobMetrics = lobItem.periodicData[periodHeader] as ExtendedAggregatedPeriodicMetrics;
          const primaryMetric = selectedModel === 'fix-fte' ? lobMetrics.requiredFTE : lobMetrics.requiredHC;
          
          if (primaryMetric !== null && primaryMetric !== undefined) {
            buRequiredHC += primaryMetric;
            hasValidData = true;
          }
          if (lobMetrics.actualHC !== null && lobMetrics.actualHC !== undefined) {
            buActualHC += lobMetrics.actualHC;
          }
        });

        const finalRequiredMetric = hasValidData ? buRequiredHC : null;
        const finalActualMetric = buActualHC > 0 ? buActualHC : null;

        buPeriodicData[periodHeader] = {
          [selectedModel === 'fix-fte' ? 'requiredFTE' : 'requiredHC']: finalRequiredMetric,
          actualHC: finalActualMetric,
          overUnderHC: (finalActualMetric && finalRequiredMetric) ? finalActualMetric - finalRequiredMetric : null,
        } as ExtendedAggregatedPeriodicMetrics;
      });

      buItem.periodicData = buPeriodicData;
    });

    return Array.from(buMap.values());
  }, [rawCapacityData, selectedBusinessUnit, selectedLineOfBusiness, displayedPeriodHeaders, selectedTimeInterval, selectedModel, calculateTeamMetricsForPeriod]);

  // Event handlers
  const handleTeamMetricChange = useCallback((
    lobId: string, 
    teamName: TeamName, 
    periodHeader: string, 
    metricKey: keyof TeamPeriodicMetrics, 
    newValue: string
  ) => {
    setRawCapacityData(prevData => {
      return prevData.map(lobEntry => {
        if (lobEntry.id !== lobId) return lobEntry;

        return {
          ...lobEntry,
          teams: lobEntry.teams.map(teamEntry => {
            if (teamEntry.teamName !== teamName) return teamEntry;

            const numericValue = newValue.trim() === "" ? null : parseFloat(newValue);
            return {
              ...teamEntry,
              periodicInputData: {
                ...teamEntry.periodicInputData,
                [periodHeader]: {
                  ...teamEntry.periodicInputData[periodHeader],
                  [metricKey]: numericValue
                }
              }
            };
          })
        };
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
        if (lobEntry.id !== lobId) return lobEntry;

        const numericValue = newValue.trim() === "" ? null : parseFloat(newValue);
        
        // Standard metric updates
        const targetField = metricKey as keyof RawLoBCapacityEntry;
        if (targetField in lobEntry && typeof lobEntry[targetField] === 'object') {
          return {
            ...lobEntry,
            [targetField]: {
              ...lobEntry[targetField],
              [periodHeader]: numericValue
            }
          };
        }

        return lobEntry;
      });
    });
  }, [selectedModel]);

  // Initialize LOBs when BU changes
  useEffect(() => {
    if (actualLobsForCurrentBu.length > 0) {
      setSelectedLineOfBusiness(actualLobsForCurrentBu.slice(0, 2));
    } else {
      setSelectedLineOfBusiness([]);
    }
  }, [actualLobsForCurrentBu]);

  // Scroll synchronization
  useEffect(() => {
    const tableBody = tableBodyScrollRef.current;
    const headerScroller = headerPeriodScrollerRef.current;

    if (!tableBody || !headerScroller) return;

    const handleTableScroll = () => {
      headerScroller.scrollLeft = tableBody.scrollLeft;
    };

    const handleHeaderScroll = () => {
      tableBody.scrollLeft = headerScroller.scrollLeft;
    };

    tableBody.addEventListener('scroll', handleTableScroll);
    headerScroller.addEventListener('scroll', handleHeaderScroll);

    return () => {
      tableBody.removeEventListener('scroll', handleTableScroll);
      headerScroller.removeEventListener('scroll', handleHeaderScroll);
    };
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
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
          onModelChange={setSelectedModel}
        />

        <main className="flex-1">
          <CapacityTable
            data={processedCapacityData}
            periodHeaders={displayedPeriodHeaders}
            expandedItems={expandedItems}
            toggleExpand={(id: string) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))}
            teamMetricDefinitions={modelDefinitions.teamMetrics}
            aggregatedMetricDefinitions={modelDefinitions.aggregatedMetrics}
            onTeamMetricChange={handleTeamMetricChange}
            onLobMetricChange={handleLobMetricChange}
            editingCell={editingCell}
            onSetEditingCell={(id, period, metricKey) => 
              setEditingCell(id && period && metricKey ? { id, period, metricKey } : null)
            }
            selectedTimeInterval={selectedTimeInterval}
            onActiveHierarchyChange={setActiveHierarchyContext}
            tableBodyScrollRef={tableBodyScrollRef}
            selectedModel={selectedModel}
          />
        </main>
      </div>
    </ThemeProvider>
  );
}