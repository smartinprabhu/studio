
"use client";

import React, { useState } from "react"; // Ensure useState is imported
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  History,
  Upload,
  CalendarDays,
  Zap,
  Building2, 
  Briefcase, 
  ChevronDown,
} from "lucide-react";
import { AiGroupingDialog } from "./ai-grouping-dialog";
import type { FilterOptions, TimeInterval, BusinessUnitName, LineOfBusinessName } from "./types";

interface HeaderSectionProps {
  filterOptions: FilterOptions;
  selectedBusinessUnit: BusinessUnitName;
  onSelectBusinessUnit: (value: BusinessUnitName) => void;
  selectedLineOfBusiness: string[]; 
  onSelectLineOfBusiness: (value: string[]) => void;
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
  selectedTimeInterval,
  onSelectTimeInterval,
  currentDateDisplay,
  onNavigateTime,
}: HeaderSectionProps) {
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const handleLobSelectionChange = (lob: string, checked: boolean) => {
    const newSelectedLOBs = checked
      ? [...selectedLineOfBusiness, lob]
      : selectedLineOfBusiness.filter((item) => item !== lob);
    onSelectLineOfBusiness(newSelectedLOBs);
  };

  const actualLobsForCurrentBu = filterOptions.linesOfBusiness.filter(lob => lob !== "All"); // "All" is not part of LOB list
  let lobDropdownLabel = "Select LOBs";
  if (selectedLineOfBusiness.length === 1) {
    lobDropdownLabel = selectedLineOfBusiness[0];
  } else if (actualLobsForCurrentBu.length > 0 && selectedLineOfBusiness.length === actualLobsForCurrentBu.length) {
    lobDropdownLabel = `All ${actualLobsForCurrentBu.length} LOBs`;
  } else if (selectedLineOfBusiness.length > 1) {
    lobDropdownLabel = `${selectedLineOfBusiness.length} LOBs Selected`;
  } else if (actualLobsForCurrentBu.length === 0) {
    lobDropdownLabel = "No LOBs";
  }


  return (
    <TooltipProvider>
      <header className="p-4 border-b border-border sticky top-0 bg-background z-50">
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

          {/* Line of Business Filter (Multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-[240px] text-sm h-9 justify-between">
                <div className="flex items-center truncate">
                  <Briefcase className="mr-2 opacity-70 flex-shrink-0" />
                  <span className="truncate" title={lobDropdownLabel}>{lobDropdownLabel}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full md:w-[240px]">
              <DropdownMenuLabel>Select Lines of Business</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {actualLobsForCurrentBu.length > 0 ? (
                actualLobsForCurrentBu.map((lob) => (
                  <DropdownMenuCheckboxItem
                    key={lob}
                    checked={selectedLineOfBusiness.includes(lob)}
                    onCheckedChange={(checked) => handleLobSelectionChange(lob, Boolean(checked))}
                    onSelect={(e) => e.preventDefault()} // Keep menu open after selection
                  >
                    {lob}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No LOBs available for {selectedBusinessUnit}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
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
