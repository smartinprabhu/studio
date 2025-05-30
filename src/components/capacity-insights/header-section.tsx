
"use client";

import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, Briefcase, ChevronDown, Users, Download, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeaderSectionProps, BusinessUnitName, LineOfBusinessName, TimeInterval } from "./types";
import { DateRangePicker } from "./date-range-picker";
import { AiGroupingDialog } from "./ai-grouping-dialog"; // Ensure this is correctly imported

export function HeaderSection({
  allBusinessUnits,
  actualLobsForCurrentBu,
  selectedBusinessUnit,
  onSelectBusinessUnit,
  selectedLineOfBusiness,
  onSelectLineOfBusiness,
  selectedTimeInterval,
  onSelectTimeInterval,
  selectedDateRange,
  onSelectDateRange,
  allAvailablePeriods,
  // For merged header
  displayedPeriodHeaders,
  activeHierarchyContext,
  headerPeriodScrollerRef,
}: HeaderSectionProps) {
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const handleLobSelectionChange = (lob: string, checked: boolean) => {
    const newSelectedLOBs = checked
      ? [...selectedLineOfBusiness, lob]
      : selectedLineOfBusiness.filter((item) => item !== lob);
    onSelectLineOfBusiness(newSelectedLOBs);
  };

  let lobDropdownLabel = "Select LOBs";
  if (selectedLineOfBusiness.length === 1) {
    lobDropdownLabel = selectedLineOfBusiness[0];
  } else if (actualLobsForCurrentBu.length > 0 && selectedLineOfBusiness.length === actualLobsForCurrentBu.length) {
    lobDropdownLabel = `All ${actualLobsForCurrentBu.length} LOBs`;
  } else if (selectedLineOfBusiness.length > 1) {
    lobDropdownLabel = `${selectedLineOfBusiness.length} LOBs Selected`;
  } else if (actualLobsForCurrentBu.length === 0) {
    lobDropdownLabel = "No LOBs for " + selectedBusinessUnit;
  }

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 bg-background p-4 border-b border-border">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground">Capacity Insights</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export current view as CSV (not implemented)</p></TooltipContent>
            </Tooltip>
            <Button variant="default" size="sm" onClick={() => setIsAiDialogOpen(true)}>
              <Zap className="mr-2 h-4 w-4" /> Assumptions Assister
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Business Unit</Label>
            <Select value={selectedBusinessUnit} onValueChange={onSelectBusinessUnit}>
              <SelectTrigger className="w-full lg:w-[180px] text-sm h-9">
                <Building2 className="mr-2 h-4 w-4 opacity-70" />
                <SelectValue placeholder="Business Unit" />
              </SelectTrigger>
              <SelectContent>
                {allBusinessUnits.map((bu) => (
                  <SelectItem key={bu} value={bu}>
                    {bu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Line of Business</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[240px] text-sm h-9 justify-between">
                  <div className="flex items-center truncate">
                    <Briefcase className="mr-2 h-4 w-4 opacity-70 flex-shrink-0" />
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
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Interval</Label>
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted h-9">
              <Button
                variant={selectedTimeInterval === "Week" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSelectTimeInterval("Week")}
                className="h-full px-3 flex-1 text-xs"
              >
                Week
              </Button>
              <Button
                variant={selectedTimeInterval === "Month" ? "default" : "ghost"}
                size="sm"
                onClick={() => onSelectTimeInterval("Month")}
                className="h-full px-3 flex-1 text-xs"
              >
                Month
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Date Range</Label>
            <DateRangePicker date={selectedDateRange} onDateChange={onSelectDateRange} allAvailablePeriods={allAvailablePeriods} />
          </div>
        </div>

        {/* Merged Table Header Row */}
        <div className="mt-4 flex items-stretch border-b border-border bg-card">
          <div className="sticky left-0 z-55 bg-card min-w-[320px] px-4 py-2 flex items-center border-r border-border/50 h-12">
            <span className="text-sm font-medium text-muted-foreground truncate">{activeHierarchyContext}</span>
          </div>
          <div 
            ref={headerPeriodScrollerRef} 
            className="flex-grow overflow-x-auto scrollbar-hide whitespace-nowrap flex items-stretch h-12"
          >
            {displayedPeriodHeaders.map((period) => {
              const parts = period.split(': ');
              const weekLabelPart = parts[0].replace("FWk", "W");
              let dateRangePart = "";
              if (parts.length > 1) {
                const dateAndYearPart = parts[1];
                // Regex to match DD/MM-DD/MM, ignoring the year part for display here
                const dateMatch = dateAndYearPart.match(/^(\d{2}\/\d{2}-\d{2}\/\d{2})/); 
                if (dateMatch) {
                  dateRangePart = dateMatch[1];
                }
              }
              return (
                <div
                  key={period}
                  className="min-w-[100px] px-2 py-2 flex flex-col items-end justify-center text-right border-l border-border/50 h-full"
                >
                  <span className="text-sm font-medium">{weekLabelPart}</span>
                  {dateRangePart && (
                    <span className="text-xs text-muted-foreground">
                      ({dateRangePart})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
      </header>
    </TooltipProvider>
  );
}

    