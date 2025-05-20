
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
  // MetricValues, // No longer directly used here as CalculatedMetricValues covers it
  CalculatedMetricValues,
  NUM_PERIODS_DISPLAYED,
  DYNAMIC_SUM_COLUMN_KEY,
  BUSINESS_UNIT_CONFIG,
  ALL_BUSINESS_UNITS, 
  GroupByOption,
  TeamName,
  AggregatedPeriodicMetrics, // For BU/LOB summaries
  TeamPeriodicMetrics, // For Team details
  ALL_TEAM_NAMES,
  TEAM_METRIC_ROW_DEFINITIONS,
  AGGREGATED_METRIC_ROW_DEFINITIONS,
} from "@/components/capacity-insights/types";
// Removed unused date-fns imports for now, will add back if specific date logic is re-implemented
// import { parse, differenceInCalendarWeeks, startOfWeek, endOfWeek, format, addWeeks, getMonth, getYear, startOfMonth, endOfMonth, addMonths } from 'date-fns';


// Helper to calculate derived metrics for LOB/BU (agent-minutes based)
const calculateSummaryMetrics = (required: number | null, actual: number | null): CalculatedMetricValues => {
  if (required === null || actual === null || required === undefined || actual === undefined) {
    return { required: null, actual: null, overUnder: null, adherence: null };
  }
  const overUnder = actual - required;
  const adherence = required !== 0 ? (actual / required) * 100 : null;
  return { required, actual, overUnder, adherence };
};

// Helper to sum metric values (CalculatedMetricValues), handling nulls
const sumSummaryMetrics = (m1: CalculatedMetricValues, m2: CalculatedMetricValues): CalculatedMetricValues => {
  const древний_required = (m1.required ?? 0) + (m2.required ?? 0);
  const древний_actual = (m1.actual ?? 0) + (m2.actual ?? 0);
  // Recalculate for the sum
  return calculateSummaryMetrics(древний_required, древний_actual);
};

// Aggregates data for LOBs/BUs. Input `lobEntries` are RawLoBCapacityEntry[]
const aggregatePeriodicDataForLobOrBu = (
  lobEntries: RawLoBCapacityEntry[], 
  periodsToDisplay: string[]
): Record<string, CalculatedMetricValues> => {
  const aggregated: Record<string, CalculatedMetricValues> = {};
  
  periodsToDisplay.forEach(period => {
    let periodRequiredSum: number | null = 0;
    let periodActualSum: number | null = 0; 
    let hasDataForPeriod = false;

    lobEntries.forEach(lobEntry => {
      const requiredForLob = lobEntry.lobTotalBaseRequiredMinutes[period];
      if (requiredForLob !== null && requiredForLob !== undefined) {
        periodRequiredSum = (periodRequiredSum ?? 0) + requiredForLob;
        hasDataForPeriod = true;

        // MOCK ACTUAL FOR LOB AGGREGATION: Placeholder based on its own required.
        // This should eventually be a sum of its teams' actual agent minutes.
        const actualForLob = requiredForLob * (0.9 + Math.random() * 0.2); // 90% to 110% of required
        periodActualSum = (periodActualSum ?? 0) + actualForLob;
      }
    });

     if (hasDataForPeriod && periodRequiredSum !== null && periodActualSum !== null) {
       aggregated[period] = calculateSummaryMetrics(periodRequiredSum, periodActualSum);
     } else {
       aggregated[period] = calculateSummaryMetrics(null,null);
     }
  });

  // Calculate sum over the displayed periods
  let totalSumMetrics = calculateSummaryMetrics(0,0);
  periodsToDisplay.forEach(period => {
    if (aggregated[period] && aggregated[period].required !== null) {
      totalSumMetrics = sumSummaryMetrics(totalSumMetrics, aggregated[period]);
    }
  });
  aggregated[DYNAMIC_SUM_COLUMN_KEY] = totalSumMetrics;
  
  return aggregated;
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

    let filteredRawData = mockRawCapacityData;
    if (selectedBusinessUnit !== "All") {
      filteredRawData = filteredRawData.filter(d => d.bu === selectedBusinessUnit);
    }
    if (selectedLineOfBusiness !== "All") {
      // This LOB filtering needs to be aware of the hierarchy. 
      // If BU is selected, this filters LOBs within that BU.
      // If BU is "All", this filters LOBs across all BUs.
      filteredRawData = filteredRawData.filter(d => d.lob === selectedLineOfBusiness);
    }

    const newDisplayData: CapacityDataRow[] = [];
    const newExpandedItems: Record<string, boolean> = {};

    if (selectedGroupBy === "Business Unit") {
      const busToDisplay = selectedBusinessUnit === "All" 
        ? ALL_BUSINESS_UNITS 
        : [selectedBusinessUnit];

      busToDisplay.forEach(buName => {
        const buLobsConfig = BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness;
        // Get all RawLoBCapacityEntry for the current BU
        const buRawEntries = mockRawCapacityData.filter(d => d.bu === buName); 
        
        if (buRawEntries.length === 0 && selectedBusinessUnit !== "All") return;

        const childrenLobs: CapacityDataRow[] = [];
        buLobsConfig.forEach(lobName => {
          // Filter LOB entries for the current LOB within the current BU's entries
          const lobRawEntriesForCurrentLob = buRawEntries.filter(d => d.lob === lobName);
          
          // Apply LOB filter: only include if "All" LOBs selected OR current LOB matches selectedLOB
          if (selectedLineOfBusiness !== "All" && selectedLineOfBusiness !== lobName) {
            return; 
          }
          
          if (lobRawEntriesForCurrentLob.length > 0) {
            // TODO: Implement Team Level Data Processing here
            // For now, LOB children will be empty, or we skip team display until ready.
            // const childrenTeams: CapacityDataRow[] = []; 
            // lobRawEntriesForCurrentLob[0].teams.forEach(team => {/* process team */})

            childrenLobs.push({
              id: `${buName}_${lobName.replace(/\s+/g, '-')}`,
              name: lobName,
              level: 1,
              itemType: 'LOB',
              periodicData: aggregatePeriodicDataForLobOrBu(lobRawEntriesForCurrentLob, periodsToDisplay), // Aggregates for this single LOB
              // children: childrenTeams, // Will be added later
            });
          }
        });
        
        if (childrenLobs.length > 0 || selectedBusinessUnit === buName) {
          newDisplayData.push({
            id: buName,
            name: buName,
            level: 0,
            itemType: 'BU',
            periodicData: aggregatePeriodicDataForLobOrBu(buRawEntries, periodsToDisplay), // Aggregates all LOBs in this BU
            children: childrenLobs,
          });
          newExpandedItems[buName] = true; 
        }
      });
    } else { // GroupBy "Line of Business"
      const lobsToConsider = selectedLineOfBusiness === "All"
        ? (selectedBusinessUnit === "All" 
            ? Array.from(new Set(mockRawCapacityData.map(d => d.lob)))
            : BUSINESS_UNIT_CONFIG[selectedBusinessUnit as BusinessUnitName].lonsOfBusiness)
        : [selectedLineOfBusiness];
      
      lobsToConsider.forEach(lobName => {
        // Get RawLoBCapacityEntry for the current LOB (can be from multiple BUs if selectedBU is "All")
        const lobRawEntries = filteredRawData.filter(d => d.lob === lobName); 
        
        if (lobRawEntries.length > 0) {
          // TODO: Implement Team Level Data processing here as well
          // const childrenTeams: CapacityDataRow[] = [];
          // lobRawEntries.forEach(lobEntry => lobEntry.teams.forEach(team => {/* process team */} ));
          
          newDisplayData.push({
            id: lobName.replace(/\s+/g, '-'),
            name: lobName,
            level: 0,
            itemType: 'LOB',
            periodicData: aggregatePeriodicDataForLobOrBu(lobRawEntries, periodsToDisplay), // Aggregates across BUs if needed
            // children: childrenTeams, // Will be added later
          });
          newExpandedItems[lobName.replace(/\s+/g, '-')] = true;
        }
      });
    }
    
    setDisplayableCapacityData(newDisplayData);
    setExpandedItems(prev => ({...prev, ...newExpandedItems}));
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
          // Ensure the summary key is passed to the table header text replacement logic
          periodHeaders={[...displayedPeriodHeaders, DYNAMIC_SUM_COLUMN_KEY]} 
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          dynamicSumKey={DYNAMIC_SUM_COLUMN_KEY}
        />
      </main>
    </div>
  );
}

