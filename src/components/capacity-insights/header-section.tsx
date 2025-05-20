
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  Upload,
  CalendarDays,
  Zap,
  Layers3, // Changed from Layers to Layers3 for Group By
  Building2, // Icon for Business Unit
  Briefcase, // Icon for Line of Business
} from "lucide-react";
import { AiGroupingDialog } from "./ai-grouping-dialog";
import type { FilterOptions, TimeInterval, BusinessUnitName, GroupByOption } from "./types";

interface HeaderSectionProps {
  filterOptions: FilterOptions;
  selectedBusinessUnit: BusinessUnitName | "All";
  onSelectBusinessUnit: (value: BusinessUnitName | "All") => void;
  selectedLineOfBusiness: string; // Can be LOB name or "All"
  onSelectLineOfBusiness: (value: string) => void;
  selectedGroupBy: GroupByOption;
  onSelectGroupBy: (value: GroupByOption) => void;
  selectedTimeInterval: TimeInterval;
  onSelectTimeInterval: (value: TimeInterval) => void;
  currentDateDisplay: string; 
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
    <TooltipProvider>
      <header className="p-4 border-b border-border sticky top-0 bg-background z-30">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground">Capacity Insights</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="mr-2" /> View history
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>View historical data (not implemented)</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2" /> Upload allocation
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Upload allocation data (not implemented)</p></TooltipContent>
            </Tooltip>
             <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2" /> Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export current view as CSV (not implemented)</p></TooltipContent>
            </Tooltip>
            <Button variant="default" size="sm" onClick={() => setIsAiDialogOpen(true)}>
              <Zap className="mr-2" /> Suggest LoB Groupings
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-x-4 gap-y-2">
          {/* Group By */}
          <Select value={selectedGroupBy} onValueChange={onSelectGroupBy}>
            <SelectTrigger className="w-full md:w-[180px] text-sm h-9">
              <Layers3 className="mr-2 opacity-70" />
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

          {/* Business Unit Filter */}
          <Select value={selectedBusinessUnit} onValueChange={onSelectBusinessUnit}>
            <SelectTrigger className="w-full md:w-[180px] text-sm h-9">
              <Building2 className="mr-2 opacity-70" />
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

          {/* Line of Business Filter */}
          <Select value={selectedLineOfBusiness} onValueChange={onSelectLineOfBusiness} disabled={filterOptions.linesOfBusiness.length <= 1}>
            <SelectTrigger className="w-full md:w-[200px] text-sm h-9">
              <Briefcase className="mr-2 opacity-70" />
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
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigateTime("prev")}>
                        <ChevronLeft />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Previous Period</p></TooltipContent>
            </Tooltip>
            <span className="text-sm font-medium text-muted-foreground min-w-[150px] text-center flex items-center justify-center gap-1 px-2">
              <CalendarDays className="h-4 w-4" /> {currentDateDisplay}
            </span>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigateTime("next")}>
                        <ChevronRight />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Next Period</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
        <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
      </header>
    </TooltipProvider>
  );
}
