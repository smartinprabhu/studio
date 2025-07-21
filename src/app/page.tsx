"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { 
  ALL_BUSINESS_UNITS, 
  BUSINESS_UNIT_CONFIG, 
  ALL_WEEKS_HEADERS, 
  ALL_MONTH_HEADERS,
  getHeaderDateRange,
  findFiscalWeekHeaderForDate,
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
  type TeamMetricDefinitions,
  type AggregatedMetricDefinitions,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
} from "@/components/capacity-insights/types";
import { initialMockRawCapacityData } from "@/components/capacity-insights/data";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { ThemeProvider } from "@/components/ThemeContext";
import { getDefaultDateRange } from "@/utils/dateUtils";
import type { ModelType } from "@/models/shared/interfaces";
import { getModelDefinitions } from "@/models/shared/model-factory";

export default function CapacityInsightsPage() {
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<ModelType>('volume-backlog');
  
  // Filter states
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>([]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(
    getDefaultDateRange("Week", 13)
  );

  // UI states
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; period: string; metricKey: string } | null>(null);
  const [activeHierarchyContext, setActiveHierarchyContext] = useState<string>("");

  // Data state
  const [rawCapacityData, setRawCapacityData] = useState<RawLoBCapacityEntry[]>(initialMockRawCapacityData);

  // Refs for scroll synchronization
  const tableBodyScrollRef = useRef<HTMLDivElement>(null);
  const headerPeriodScrollerRef = useRef<HTMLDivElement>(null);

  // Get model-specific metric definitions
  const modelDefinitions = useMemo(() => getModelDefinitions(selectedModel), [selectedModel]);

  // Derived data
  const actualLobsForCurrentBu = useMemo(() => {
    const config = BUSINESS_UNIT_CONFIG[selectedBusinessUnit];
    return config ? config.lonsOfBusiness as string[] : [];
  }, [selectedBusinessUnit]);

  const allAvailablePeriods = useMemo(() => {
    return selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
  }, [selectedTimeInterval]);

  const displayedPeriodHeaders = useMemo(() => {
    if (!selectedDateRange?.from || !selectedDateRange?.to) return [];

    return allAvailablePeriods.filter(header => {
      const { startDate, endDate } = getHeaderDateRange(header, selectedTimeInterval);
      if (!startDate || !endDate) return false;

      const rangeStart = selectedDateRange.from!;
      const rangeEnd = selectedDateRange.to!;

      return (startDate >= rangeStart && startDate <= rangeEnd) ||
             (endDate >= rangeStart && endDate <= rangeEnd) ||
             (startDate <= rangeStart && endDate >= rangeEnd);
    });
  }, [allAvailablePeriods, selectedDateRange, selectedTimeInterval]);

  // Calculate team metrics based on selected model
  const calculateTeamMetricsForPeriod = useCallback((
    teamInputData: Partial<TeamPeriodicMetrics>,
    lobTotalBaseRequiredMinutes: number | null,
    periodHeader: string,
    selectedModel: ModelType
  ): TeamPeriodicMetrics => {
    const standardWorkMinutesForPeriod = selectedTimeInterval === "Week" 
      ? STANDARD_WEEKLY_WORK_MINUTES 
      : STANDARD_MONTHLY_WORK_MINUTES;

    // Base metrics from input
    const baseMetrics: TeamPeriodicMetrics = {
      aht: teamInputData.aht || null,
      cph: (teamInputData as any).cph || null,
      shrinkagePercentage: teamInputData.shrinkagePercentage || null,
      occupancyPercentage: teamInputData.occupancyPercentage || null,
      backlogPercentage: teamInputData.backlogPercentage || null,
      attritionPercentage: teamInputData.attritionPercentage || null,
      volumeMixPercentage: teamInputData.volumeMixPercentage || null,
      actualHC: teamInputData.actualHC || null,
      moveIn: teamInputData.moveIn || null,
      moveOut: teamInputData.moveOut || null,
      newHireBatch: teamInputData.newHireBatch || null,
      newHireProduction: teamInputData.newHireProduction || null,
      requiredHC: null,
      overUnderHC: null,
      attritionLossHC: null,
      hcAfterAttrition: null,
      endingHC: null,
      _calculatedRequiredAgentMinutes: null,
      _calculatedActualProductiveAgentMinutes: null,
    };

    // Model-specific calculations
    let calculatedMetrics: Partial<TeamPeriodicMetrics> = {};

    switch (selectedModel) {
      case 'cph': {
        // CPH Model: Convert CPH to AHT equivalent, then use Volume & Backlog logic
        const cphValue = baseMetrics.cph;
        const ahtFromCPH = cphValue && cphValue > 0 ? 60 / cphValue : null;
        
        if (ahtFromCPH && baseMetrics.volumeMixPercentage && lobTotalBaseRequiredMinutes) {
          const teamBaseRequiredMinutes = lobTotalBaseRequiredMinutes * (baseMetrics.volumeMixPercentage / 100);
          const backlogAdjustment = 1 + ((baseMetrics.backlogPercentage || 0) / 100);
          const effectiveRequiredMinutes = teamBaseRequiredMinutes * backlogAdjustment;

          const shrinkageFactor = 1 - ((baseMetrics.shrinkagePercentage || 0) / 100);
          const occupancyFactor = (baseMetrics.occupancyPercentage || 85) / 100;
          const effectiveProductiveMinutesPerHC = standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor;

          calculatedMetrics._calculatedRequiredAgentMinutes = effectiveRequiredMinutes;
          calculatedMetrics.requiredHC = effectiveProductiveMinutesPerHC > 0 ? effectiveRequiredMinutes / effectiveProductiveMinutesPerHC : null;
        }
        break;
      }

      case 'fix-fte': {
        // Fix FTE Model: Simplified calculation without occupancy and backlog
        if (baseMetrics.volumeMixPercentage && lobTotalBaseRequiredMinutes) {
          const teamBaseRequiredMinutes = lobTotalBaseRequiredMinutes * (baseMetrics.volumeMixPercentage / 100);
          
          // Simplified: only shrinkage factor, no occupancy or backlog
          const shrinkageFactor = 1 - ((baseMetrics.shrinkagePercentage || 10) / 100);
          const simplifiedProductiveMinutesPerFTE = standardWorkMinutesForPeriod * shrinkageFactor * 0.75; // 25% reduction factor
          
          calculatedMetrics._calculatedRequiredAgentMinutes = teamBaseRequiredMinutes;
          calculatedMetrics.requiredHC = simplifiedProductiveMinutesPerFTE > 0 ? teamBaseRequiredMinutes / simplifiedProductiveMinutesPerFTE : null;
          (calculatedMetrics as any).requiredFTE = calculatedMetrics.requiredHC;
        }
        break;
      }

      case 'fix-hc': {
        // Fix HC Model: Same as Fix FTE but outputs HC
        if (baseMetrics.volumeMixPercentage && lobTotalBaseRequiredMinutes) {
          const teamBaseRequiredMinutes = lobTotalBaseRequiredMinutes * (baseMetrics.volumeMixPercentage / 100);
          
          const shrinkageFactor = 1 - ((baseMetrics.shrinkagePercentage || 10) / 100);
          const simplifiedProductiveMinutesPerHC = standardWorkMinutesForPeriod * shrinkageFactor * 0.75; // 25% reduction factor
          
          calculatedMetrics._calculatedRequiredAgentMinutes = teamBaseRequiredMinutes;
          calculatedMetrics.requiredHC = simplifiedProductiveMinutesPerHC > 0 ? teamBaseRequiredMinutes / simplifiedProductiveMinutesPerHC : null;
        }
        break;
      }

      case 'billable-hours': {
        // Billable Hours Model: Linear calculation
        if (baseMetrics.volumeMixPercentage && lobTotalBaseRequiredMinutes) {
          const teamBillableHours = (lobTotalBaseRequiredMinutes / 60) * (baseMetrics.volumeMixPercentage / 100); // Convert to hours
          const standardHoursPerPeriod = standardWorkMinutesForPeriod / 60;
          
          calculatedMetrics.requiredHC = teamBillableHours / standardHoursPerPeriod;
        }
        break;
      }

      default: {
        // Volume & Backlog Hybrid Model (original logic)
        if (baseMetrics.volumeMixPercentage && lobTotalBaseRequiredMinutes) {
          const teamBaseRequiredMinutes = lobTotalBaseRequiredMinutes * (baseMetrics.volumeMixPercentage / 100);
          const backlogAdjustment = 1 + ((baseMetrics.backlogPercentage || 0) / 100);
          const effectiveRequiredMinutes = teamBaseRequiredMinutes * backlogAdjustment;

          const shrinkageFactor = 1 - ((baseMetrics.shrinkagePercentage || 0) / 100);
          const occupancyFactor = (baseMetrics.occupancyPercentage || 85) / 100;
          const effectiveProductiveMinutesPerHC = standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor;

          calculatedMetrics._calculatedRequiredAgentMinutes = effectiveRequiredMinutes;
          calculatedMetrics.requiredHC = effectiveProductiveMinutesPerHC > 0 ? effectiveRequiredMinutes / effectiveProductiveMinutesPerHC : null;
        }
        break;
      }
    }

    // Common calculations for all models
    if (baseMetrics.actualHC && calculatedMetrics.requiredHC) {
      calculatedMetrics.overUnderHC = baseMetrics.actualHC - calculatedMetrics.requiredHC;
    }

    // Attrition calculations
    if (baseMetrics.actualHC && baseMetrics.attritionPercentage) {
      calculatedMetrics.attritionLossHC = baseMetrics.actualHC * (baseMetrics.attritionPercentage / 100);
      calculatedMetrics.hcAfterAttrition = baseMetrics.actualHC - calculatedMetrics.attritionLossHC;
    }

    // Ending HC calculation
    if (calculatedMetrics.hcAfterAttrition !== undefined) {
      calculatedMetrics.endingHC = calculatedMetrics.hcAfterAttrition + 
        (baseMetrics.newHireProduction || 0) + 
        (baseMetrics.moveIn || 0) - 
        (baseMetrics.moveOut || 0);
    }

    // Actual productive minutes
    if (baseMetrics.actualHC && baseMetrics.shrinkagePercentage !== null && baseMetrics.occupancyPercentage !== null) {
      const shrinkageFactor = 1 - (baseMetrics.shrinkagePercentage / 100);
      const occupancyFactor = baseMetrics.occupancyPercentage / 100;
      calculatedMetrics._calculatedActualProductiveAgentMinutes = 
        baseMetrics.actualHC * standardWorkMinutesForPeriod * shrinkageFactor * occupancyFactor;
    }

    return { ...baseMetrics, ...calculatedMetrics };
  }, [selectedTimeInterval]);

  // Calculate LOB total base required minutes based on model
  const calculateLOBTotalBaseRequiredMinutes = useCallback((
    volume: number | null,
    ahtOrCph: number | null,
    directInput: number | null,
    selectedModel: ModelType
  ): number | null => {
    if (directInput !== null && directInput !== undefined) {
      return directInput;
    }

    if (!volume || !ahtOrCph) return null;

    switch (selectedModel) {
      case 'cph':
        // CPH: (Volume / CPH) * 60
        return ahtOrCph > 0 ? (volume / ahtOrCph) * 60 : null;
      case 'billable-hours':
        // Billable Hours: Direct hours input
        return ahtOrCph * 60; // Convert hours to minutes
      default:
        // Volume & Backlog, Fix FTE, Fix HC: Volume * AHT
        return volume * ahtOrCph;
    }
  }, []);

  // Transform raw data to display format
  const transformedData = useMemo((): CapacityDataRow[] => {
    const filteredData = rawCapacityData.filter(entry => {
      const matchesBU = entry.bu === selectedBusinessUnit;
      const matchesLOB = selectedLineOfBusiness.length === 0 || selectedLineOfBusiness.includes(entry.lob);
      return matchesBU && matchesLOB;
    });

    const buGroups = filteredData.reduce((acc, entry) => {
      if (!acc[entry.bu]) acc[entry.bu] = [];
      acc[entry.bu].push(entry);
      return acc;
    }, {} as Record<string, RawLoBCapacityEntry[]>);

    return Object.entries(buGroups).map(([buName, lobEntries]) => {
      const lobChildren = lobEntries.map(lobEntry => {
        const lobPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};

        displayedPeriodHeaders.forEach(periodHeader => {
          const volume = lobEntry.lobVolumeForecast[periodHeader];
          const ahtOrCph = selectedModel === 'cph' 
            ? (lobEntry as any).lobAverageCPH?.[periodHeader] || lobEntry.lobAverageAHT[periodHeader]
            : lobEntry.lobAverageAHT[periodHeader];
          const directInput = lobEntry.lobTotalBaseRequiredMinutes[periodHeader];

          const lobTotalBaseRequiredMinutes = calculateLOBTotalBaseRequiredMinutes(
            volume, ahtOrCph, directInput, selectedModel
          );

          // Calculate team metrics for this period
          const teamMetricsForPeriod = lobEntry.teams.map(teamEntry => {
            const teamInputForPeriod = teamEntry.periodicInputData[periodHeader] || {};
            return calculateTeamMetricsForPeriod(
              teamInputForPeriod, 
              lobTotalBaseRequiredMinutes, 
              periodHeader,
              selectedModel
            );
          });

          // Aggregate team metrics to LOB level
          const aggregatedMetrics: AggregatedPeriodicMetrics = {
            lobVolumeForecast: volume,
            lobAverageAHT: selectedModel === 'cph' ? null : ahtOrCph,
            lobTotalBaseRequiredMinutes: lobTotalBaseRequiredMinutes,
            requiredHC: teamMetricsForPeriod.reduce((sum, tm) => {
              const value = selectedModel === 'fix-fte' ? (tm as any).requiredFTE : tm.requiredHC;
              return sum + (value || 0);
            }, 0),
            actualHC: teamMetricsForPeriod.reduce((sum, tm) => sum + (tm.actualHC || 0), 0),
            overUnderHC: null,
          };

          // Add model-specific fields
          if (selectedModel === 'cph') {
            (aggregatedMetrics as any).lobAverageCPH = ahtOrCph;
          } else if (selectedModel === 'billable-hours') {
            (aggregatedMetrics as any).billableHoursRequire = directInput ? directInput / 60 : null; // Convert to hours
            (aggregatedMetrics as any).handlingCapacity = volume && ahtOrCph ? volume / ahtOrCph : null;
          } else if (selectedModel === 'fix-fte') {
            (aggregatedMetrics as any).requiredFTE = aggregatedMetrics.requiredHC;
            aggregatedMetrics.requiredHC = null; // Don't show HC for FTE model
          }

          aggregatedMetrics.overUnderHC = aggregatedMetrics.actualHC - (aggregatedMetrics.requiredHC || 0);

          lobPeriodicData[periodHeader] = aggregatedMetrics;
        });

        // Create team children
        const teamChildren = lobEntry.teams.map(teamEntry => {
          const teamPeriodicData: Record<string, TeamPeriodicMetrics> = {};

          displayedPeriodHeaders.forEach(periodHeader => {
            const lobMetrics = lobPeriodicData[periodHeader];
            const teamInputForPeriod = teamEntry.periodicInputData[periodHeader] || {};
            
            const teamMetrics = calculateTeamMetricsForPeriod(
              teamInputForPeriod,
              lobMetrics.lobTotalBaseRequiredMinutes,
              periodHeader,
              selectedModel
            );

            // Add intermediate LOB data for tooltip calculations
            (teamMetrics as any)._lobTotalBaseRequiredMinutes_intermediate = lobMetrics.lobTotalBaseRequiredMinutes;

            teamPeriodicData[periodHeader] = teamMetrics;
          });

          return {
            id: `${lobEntry.id}_${teamEntry.teamName.replace(/\s+/g, '-')}`,
            name: teamEntry.teamName,
            level: 2,
            itemType: 'Team' as const,
            periodicData: teamPeriodicData,
            lobId: lobEntry.id,
          };
        });

        return {
          id: lobEntry.id,
          name: lobEntry.lob,
          level: 1,
          itemType: 'LOB' as const,
          periodicData: lobPeriodicData,
          children: teamChildren,
        };
      });

      // Calculate BU aggregated metrics
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      displayedPeriodHeaders.forEach(periodHeader => {
        const buMetrics: AggregatedPeriodicMetrics = {
          requiredHC: lobChildren.reduce((sum, lob) => {
            const lobMetric = lob.periodicData[periodHeader];
            const value = selectedModel === 'fix-fte' ? (lobMetric as any).requiredFTE : lobMetric.requiredHC;
            return sum + (value || 0);
          }, 0),
          actualHC: lobChildren.reduce((sum, lob) => sum + (lob.periodicData[periodHeader].actualHC || 0), 0),
          overUnderHC: null,
        };

        if (selectedModel === 'fix-fte') {
          (buMetrics as any).requiredFTE = buMetrics.requiredHC;
          buMetrics.requiredHC = null;
        }

        buMetrics.overUnderHC = buMetrics.actualHC - (buMetrics.requiredHC || (buMetrics as any).requiredFTE || 0);
        buPeriodicData[periodHeader] = buMetrics;
      });

      return {
        id: buName,
        name: buName,
        level: 0,
        itemType: 'BU' as const,
        periodicData: buPeriodicData,
        children: lobChildren,
      };
    });
  }, [
    rawCapacityData,
    selectedBusinessUnit,
    selectedLineOfBusiness,
    displayedPeriodHeaders,
    calculateTeamMetricsForPeriod,
    calculateLOBTotalBaseRequiredMinutes,
    selectedModel
  ]);

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
                  [metricKey]: numericValue,
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
        
        // Handle model-specific metric mapping
        let actualMetricKey = metricKey;
        if (selectedModel === 'cph' && metricKey === 'lobAverageAHT') {
          actualMetricKey = 'lobAverageCPH' as any;
        } else if (selectedModel === 'billable-hours' && metricKey === 'lobTotalBaseRequiredMinutes') {
          actualMetricKey = 'billableHoursRequire' as any;
        }

        return {
          ...lobEntry,
          [actualMetricKey]: {
            ...lobEntry[actualMetricKey as keyof RawLoBCapacityEntry],
            [periodHeader]: numericValue,
          }
        };
      });
    });
  }, [selectedModel]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSetEditingCell = useCallback((
    id: string | null,
    period: string | null,
    metricKey: string | null
  ) => {
    setEditingCell(id && period && metricKey ? { id, period, metricKey } : null);
  }, []);

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
      <div className="min-h-screen bg-background">
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
            data={transformedData}
            periodHeaders={displayedPeriodHeaders}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
            teamMetricDefinitions={modelDefinitions.teamMetrics}
            aggregatedMetricDefinitions={modelDefinitions.aggregatedMetrics}
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
    </ThemeProvider>
  );
}