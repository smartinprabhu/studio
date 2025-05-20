
"use client";

import React, { useState, useEffect } from "react";
import { HeaderSection } from "@/components/capacity-insights/header-section";
import { CapacityTable } from "@/components/capacity-insights/capacity-table";
import { mockCapacityData, mockFilterOptions } from "@/components/capacity-insights/data";
import { WEEKS_HEADERS, TimeInterval, CapacityDataRow } from "@/components/capacity-insights/types";

export default function CapacityInsightsPage() {
  const [filterOptions, setFilterOptions] = useState(mockFilterOptions);
  const [capacityData, setCapacityData] = useState<CapacityDataRow[]>(mockCapacityData);
  
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState(filterOptions.businessUnits[0] || "");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState(filterOptions.linesOfBusiness[0] || "");
  const [selectedGroupBy, setSelectedGroupBy] = useState(filterOptions.groupByOptions[0] || "");
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0); // For week navigation
  const [currentDateDisplay, setCurrentDateDisplay] = useState("");

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Initialize expanded state for items that have children
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    function setInitialExpanded(items: CapacityDataRow[]) {
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          initialExpanded[item.id] = true; // Default to expanded
          setInitialExpanded(item.children);
        }
      });
    }
    setInitialExpanded(mockCapacityData);
    setExpandedItems(initialExpanded);
  }, []);


  useEffect(() => {
    // Update date display based on time interval and current index
    if (selectedTimeInterval === "Week") {
      setCurrentDateDisplay(WEEKS_HEADERS[currentWeekIndex] || "N/A");
    } else {
      // Basic month display, can be improved
      const date = new Date();
      date.setMonth(date.getMonth() + currentWeekIndex); // currentWeekIndex doubles as month offset
      setCurrentDateDisplay(date.toLocaleString('default', { month: 'long', year: 'numeric' }));
    }
  }, [selectedTimeInterval, currentWeekIndex]);

  const handleNavigateTime = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? currentWeekIndex - 1 : currentWeekIndex + 1;
    const maxIndex = selectedTimeInterval === "Week" ? WEEKS_HEADERS.length - 1 : 11; // Arbitrary month limit
    if (newIndex >= 0 && newIndex <= maxIndex) {
      setCurrentWeekIndex(newIndex);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // TODO: Implement actual filtering and data fetching logic
  // For now, mock data is used directly

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={setSelectedBusinessUnit}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={setSelectedLineOfBusiness}
        selectedGroupBy={selectedGroupBy}
        onSelectGroupBy={setSelectedGroupBy}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={setSelectedTimeInterval}
        currentDateDisplay={currentDateDisplay}
        onNavigateTime={handleNavigateTime}
      />
      <main className="flex-grow overflow-auto p-4">
        <CapacityTable 
          data={capacityData} 
          weekHeaders={WEEKS_HEADERS} 
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
        />
      </main>
    </div>
  );
}
