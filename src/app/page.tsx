
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
  MetricValues,
  CalculatedMetricValues,
  NUM_PERIODS_DISPLAYED,
  DYNAMIC_SUM_COLUMN_KEY,
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS, // Added import
  GroupByOption
} from "@/components/capacity-insights/types";
import { parse, differenceInCalendarWeeks, startOfWeek, endOfWeek, format, addWeeks, getMonth, getYear, startOfMonth, endOfMonth, addMonths } from 'date-fns';


// Helper to calculate derived metrics
const calculateMetrics = (required: number | null, actual: number | null): CalculatedMetricValues => {
  if (required === null || actual === null || required === undefined || actual === undefined) {
    return { required: null, actual: null, overUnder: null, adherence: null };
  }
  const overUnder = actual - required;
  const adherence = required !== 0 ? (actual / required) * 100 : null;
  return { required, actual, overUnder, adherence };
};

// Helper to sum metric values, handling nulls
const sumMetrics = (m1: CalculatedMetricValues, m2: CalculatedMetricValues): CalculatedMetricValues => {
  const древний_required = (m1.required ?? 0) + (m2.required ?? 0);
  const древний_actual = (m1.actual ?? 0) + (m2.actual ?? 0);
  // Recalculate for the sum
  return calculateMetrics(древний_required, древний_actual);
};

const aggregatePeriodicData = (entries: RawLoBCapacityEntry[], periodsToDisplay: string[]): Record<string, CalculatedMetricValues> => {
  const aggregated: Record<string, CalculatedMetricValues> = {};
  
  periodsToDisplay.forEach(period => {
    let periodRequiredSum: number | null = 0;
    let periodActualSum: number | null = 0;
    let hasData = false;

    entries.forEach(entry => {
      const metrics = entry.periodicMetrics[period];
      if (metrics && metrics.required !== null && metrics.actual !== null) {
        periodRequiredSum = (periodRequiredSum ?? 0) + metrics.required;
        periodActualSum = (periodActualSum ?? 0) + metrics.actual;
        hasData = true;
      }
    });
     if (hasData && periodRequiredSum !== null && periodActualSum !== null) {
       aggregated[period] = calculateMetrics(periodRequiredSum, periodActualSum);
     } else {
       aggregated[period] = calculateMetrics(null,null);
     }
  });

  // Calculate sum over the displayed periods
  let totalSumMetrics = calculateMetrics(0,0);
  periodsToDisplay.forEach(period => {
    if (aggregated[period]) {
      totalSumMetrics = sumMetrics(totalSumMetrics, aggregated[period]);
    }
  });
  aggregated[DYNAMIC_SUM_COLUMN_KEY] = totalSumMetrics;
  
  return aggregated;
};


export default function CapacityInsightsPage() {
  const [filterOptions, setFilterOptions] = useState(mockFilterOptions);
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName | "All">("All");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string>("All"); // string to include "All"
  const [selectedGroupBy, setSelectedGroupBy] = useState<GroupByOption>(filterOptions.groupByOptions[0]);
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  
  const [currentPeriodIndex, setCurrentPeriodIndex] = useState(0); // Start index for weeks or months
  const [currentDateDisplay, setCurrentDateDisplay] = useState("");
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Update LOB options when BU changes
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
    setSelectedLineOfBusiness("All"); // Reset LOB selection
  }, [selectedBusinessUnit]);
  
  // Process and filter data for the table
  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const periodsToDisplay = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    setDisplayedPeriodHeaders(periodsToDisplay);

    let filteredRawData = mockRawCapacityData;
    if (selectedBusinessUnit !== "All") {
      filteredRawData = filteredRawData.filter(d => d.bu === selectedBusinessUnit);
    }
    if (selectedLineOfBusiness !== "All") {
      filteredRawData = filteredRawData.filter(d => d.lob === selectedLineOfBusiness);
    }

    const newDisplayData: CapacityDataRow[] = [];
    const newExpandedItems: Record<string, boolean> = {};

    if (selectedGroupBy === "Business Unit") {
      const busToDisplay = selectedBusinessUnit === "All" 
        ? ALL_BUSINESS_UNITS 
        : [selectedBusinessUnit];

      busToDisplay.forEach(buName => {
        const buLobs = BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness;
        const buRawEntries = filteredRawData.filter(d => d.bu === buName);

        if (buRawEntries.length === 0 && selectedBusinessUnit !== "All") return; // Skip if BU selected and no data

        const childrenLobs: CapacityDataRow[] = [];
        buLobs.forEach(lobName => {
          const lobRawEntries = buRawEntries.filter(d => d.lob === lobName);
          if (lobRawEntries.length > 0 || (selectedLineOfBusiness === "All" || selectedLineOfBusiness === lobName)) {
             if (selectedLineOfBusiness !== "All" && selectedLineOfBusiness !== lobName) return;

            childrenLobs.push({
              id: `${buName}_${lobName}`,
              name: lobName,
              level: 1,
              periodicData: aggregatePeriodicData(lobRawEntries, periodsToDisplay),
            });
          }
        });
        
        // Only add BU if it has children to show or if it's the specifically selected BU
        if (childrenLobs.length > 0 || selectedBusinessUnit === buName) {
          newDisplayData.push({
            id: buName,
            name: buName,
            level: 0,
            periodicData: aggregatePeriodicData(buRawEntries, periodsToDisplay),
            children: childrenLobs,
          });
          newExpandedItems[buName] = true; // Default to expanded
        }
      });
    } else { // GroupBy "Line of Business"
      const lobsToConsider = selectedLineOfBusiness === "All"
        ? (selectedBusinessUnit === "All" 
            ? Array.from(new Set(mockRawCapacityData.map(d => d.lob)))
            : BUSINESS_UNIT_CONFIG[selectedBusinessUnit as BusinessUnitName].lonsOfBusiness)
        : [selectedLineOfBusiness];
      
      lobsToConsider.forEach(lobName => {
        const lobRawEntries = filteredRawData.filter(d => d.lob === lobName);
        if (lobRawEntries.length > 0) {
          newDisplayData.push({
            id: lobName.replace(/\s+/g, '-'), // Ensure valid ID
            name: lobName,
            level: 0,
            periodicData: aggregatePeriodicData(lobRawEntries, periodsToDisplay),
          });
          newExpandedItems[lobName.replace(/\s+/g, '-')] = true;
        }
      });
    }
    
    setDisplayableCapacityData(newDisplayData);
    setExpandedItems(prev => ({...prev, ...newExpandedItems})); // Merge, don't overwrite all
  }, [selectedBusinessUnit, selectedLineOfBusiness, selectedGroupBy, selectedTimeInterval, currentPeriodIndex]);


  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);


  // Update date display
  useEffect(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const currentBlock = sourcePeriods.slice(currentPeriodIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    if (currentBlock.length > 0) {
      const firstPeriod = currentBlock[0];
      const lastPeriod = currentBlock[currentBlock.length - 1];
      if (selectedTimeInterval === "Week") {
        // Extract start date of first week and end date of last week
        // Example: "Wk23: 06/04-06/10" -> "06/04"
        const firstDateStr = firstPeriod.split(': ')[1].split('-')[0];
        const lastDateStr = lastPeriod.split(': ')[1].split('-')[1];
        setCurrentDateDisplay(`${firstDateStr} - ${lastDateStr} (2024)`); // Assuming 2024 for now
      } else { // Month
        setCurrentDateDisplay(currentBlock.length === 1 ? firstPeriod : `${firstPeriod} - ${lastPeriod}`);
      }
    } else {
      setCurrentDateDisplay("N/A");
    }
  }, [selectedTimeInterval, currentPeriodIndex, displayedPeriodHeaders]);

  const handleNavigateTime = (direction: "prev" | "next") => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    const maxIndex = sourcePeriods.length - NUM_PERIODS_DISPLAYED;
    
    let newIndex = currentPeriodIndex;
    if (direction === "prev") {
      newIndex = Math.max(0, currentPeriodIndex - NUM_PERIODS_DISPLAYED);
    } else {
      newIndex = Math.min(maxIndex, currentPeriodIndex + NUM_PERIODS_DISPLAYED);
    }
    // If newIndex would result in less than NUM_PERIODS_DISPLAYED, adjust if possible
    // This logic might need refinement based on how partial blocks are handled.
    // For now, simple step by NUM_PERIODS_DISPLAYED or to boundaries.
    setCurrentPeriodIndex(newIndex);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // Reset period index when time interval changes
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
          periodHeaders={[...displayedPeriodHeaders, `Total (${selectedTimeInterval === "Week" ? "Month" : "Range"})`]} 
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          dynamicSumKey={DYNAMIC_SUM_COLUMN_KEY}
        />
      </main>
    </div>
  );
}
