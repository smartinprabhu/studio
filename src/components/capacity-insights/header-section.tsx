
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  Upload,
  CalendarDays,
  Zap,
  Layers,
} from "lucide-react";
import { AiGroupingDialog } from "./ai-grouping-dialog";
import type { FilterOptions, TimeInterval } from "./types";

interface HeaderSectionProps {
  filterOptions: FilterOptions;
  selectedBusinessUnit: string;
  onSelectBusinessUnit: (value: string) => void;
  selectedLineOfBusiness: string;
  onSelectLineOfBusiness: (value: string) => void;
  selectedGroupBy: string;
  onSelectGroupBy: (value: string) => void;
  selectedTimeInterval: TimeInterval;
  onSelectTimeInterval: (value: TimeInterval) => void;
  currentDateDisplay: string; // e.g. "June 2024" or "Week 23 (06/04 - 06/10)"
  onNavigateTime: (direction: "prev" | "next") => void;
}

export function HeaderSection({
  filterOptions,
  selectedBusinessUnit,
  onSelectBusinessUnit,
  selectedLineOfBusiness,
  onSelectLineOfBusiness,
  selectedGroupBy,
  onSelectGroupBy,
  selectedTimeInterval,
  onSelectTimeInterval,
  currentDateDisplay,
  onNavigateTime,
}: HeaderSectionProps) {
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  return (
    <header className="p-4 border-b border-border sticky top-0 bg-background z-20">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Capacity Insights</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            <History className="mr-2" /> View history
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2" /> Upload allocation
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2" /> Export CSV
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsAiDialogOpen(true)}>
            <Zap className="mr-2" /> Suggest LoB Groupings
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Filters */}
        <Select value={selectedBusinessUnit} onValueChange={onSelectBusinessUnit}>
          <SelectTrigger className="w-full md:w-[180px] text-sm h-9">
            <Filter className="mr-2 opacity-70" />
            <SelectValue placeholder="Business Unit" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.businessUnits.map((bu) => (
              <SelectItem key={bu} value={bu}>
                {bu}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedLineOfBusiness} onValueChange={onSelectLineOfBusiness}>
          <SelectTrigger className="w-full md:w-[180px] text-sm h-9">
            <Layers className="mr-2 opacity-70" />
            <SelectValue placeholder="Line of Business" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.linesOfBusiness.map((lob) => (
              <SelectItem key={lob} value={lob}>
                {lob}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedGroupBy} onValueChange={onSelectGroupBy}>
          <SelectTrigger className="w-full md:w-[160px] text-sm h-9">
            <Layers className="mr-2 opacity-70" /> {/* Re-using Layers icon, consider specific icon if available */}
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.groupByOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Time Interval and Navigation */}
        <div className="flex items-center gap-2 border rounded-md p-1 bg-muted">
          <Button 
            variant={selectedTimeInterval === "Week" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => onSelectTimeInterval("Week")}
            className="h-7 px-3"
          >
            Week
          </Button>
          <Button 
            variant={selectedTimeInterval === "Month" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => onSelectTimeInterval("Month")}
            className="h-7 px-3"
          >
            Month
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigateTime("prev")}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium text-muted-foreground min-w-[120px] text-center flex items-center gap-1">
            <CalendarDays className="h-4 w-4" /> {currentDateDisplay}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigateTime("next")}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
    </header>
  );
}
