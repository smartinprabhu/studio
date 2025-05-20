
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
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
  Download,
  History,
  Upload,
  CalendarDays,
  Zap,
  Building2, 
  Briefcase, 
  Users,
  ChevronDown,
} from "lucide-react";
import { AiGroupingDialog } from "./ai-grouping-dialog";
import type { FilterOptions, TimeInterval, BusinessUnitName, TeamName } from "./types";

interface HeaderSectionProps {
  filterOptions: FilterOptions;
  selectedBusinessUnit: BusinessUnitName;
  onSelectBusinessUnit: (value: BusinessUnitName) => void;
  selectedLineOfBusiness: string[]; 
  onSelectLineOfBusiness: (value: string[]) => void;
  selectedTeams: TeamName[];
  onSelectTeams: (value: TeamName[]) => void;
  selectedTimeInterval: TimeInterval;
  onSelectTimeInterval: (value: TimeInterval) => void;
  
  allAvailablePeriods: string[];
  selectedStartPeriod: string;
  onSelectStartPeriod: (value: string) => void;
  selectedEndPeriod: string;
  onSelectEndPeriod: (value: string) => void;
  selectedRangeHeaderDisplay: string;
}

export function HeaderSection({
  filterOptions,
  selectedBusinessUnit,
  onSelectBusinessUnit,
  selectedLineOfBusiness,
  onSelectLineOfBusiness,
  selectedTeams,
  onSelectTeams,
  selectedTimeInterval,
  onSelectTimeInterval,
  allAvailablePeriods,
  selectedStartPeriod,
  onSelectStartPeriod,
  selectedEndPeriod,
  onSelectEndPeriod,
  selectedRangeHeaderDisplay,
}: HeaderSectionProps) {
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const handleLobSelectionChange = (lob: string, checked: boolean) => {
    const newSelectedLOBs = checked
      ? [...selectedLineOfBusiness, lob]
      : selectedLineOfBusiness.filter((item) => item !== lob);
    onSelectLineOfBusiness(newSelectedLOBs);
  };

  const handleTeamSelectionChangeInternal = (team: TeamName, checked: boolean) => {
    const newSelectedTeams = checked
      ? [...selectedTeams, team]
      : selectedTeams.filter((item) => item !== team);
    onSelectTeams(newSelectedTeams);
  };

  const actualLobsForCurrentBu = filterOptions.linesOfBusiness;
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

  const actualTeams = filterOptions.teams;
  let teamDropdownLabel = "Select Teams";
  if (selectedTeams.length === 1) {
    teamDropdownLabel = selectedTeams[0];
  } else if (actualTeams.length > 0 && selectedTeams.length === actualTeams.length) {
    teamDropdownLabel = `All ${actualTeams.length} Teams`;
  } else if (selectedTeams.length > 1) {
    teamDropdownLabel = `${selectedTeams.length} Teams Selected`;
  }

  // Filter options for End Period dropdown
  const startPeriodIndex = allAvailablePeriods.indexOf(selectedStartPeriod);
  const endPeriodOptions = allAvailablePeriods.slice(startPeriodIndex);

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

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-x-4 gap-y-2">
          {/* Business Unit Filter */}
          <Select value={selectedBusinessUnit} onValueChange={onSelectBusinessUnit}>
            <SelectTrigger className="w-full lg:w-[180px] text-sm h-9">
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
              <Button variant="outline" className="w-full lg:w-[240px] text-sm h-9 justify-between">
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
                    onSelect={(e) => e.preventDefault()} 
                  >
                    {lob}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No LOBs available for {selectedBusinessUnit}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Team Filter (Multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full lg:w-[200px] text-sm h-9 justify-between">
                <div className="flex items-center truncate">
                  <Users className="mr-2 opacity-70 flex-shrink-0" />
                  <span className="truncate" title={teamDropdownLabel}>{teamDropdownLabel}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full md:w-[200px]">
              <DropdownMenuLabel>Select Teams</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {actualTeams.map((team) => (
                <DropdownMenuCheckboxItem
                  key={team}
                  checked={selectedTeams.includes(team)}
                  onCheckedChange={(checked) => handleTeamSelectionChangeInternal(team, Boolean(checked))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {team}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Time Interval and Date Range Selection */}
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

          <Select value={selectedStartPeriod} onValueChange={onSelectStartPeriod}>
            <SelectTrigger className="w-full lg:w-[220px] text-sm h-9">
              <SelectValue placeholder={`Start ${selectedTimeInterval}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Start {selectedTimeInterval}</SelectLabel>
                {allAvailablePeriods.map(period => (
                  <SelectItem key={`start-${period}`} value={period}>{period}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={selectedEndPeriod} onValueChange={onSelectEndPeriod}>
            <SelectTrigger className="w-full lg:w-[220px] text-sm h-9">
              <SelectValue placeholder={`End ${selectedTimeInterval}`} />
            </SelectTrigger>
            <SelectContent>
               <SelectGroup>
                <SelectLabel>End {selectedTimeInterval}</SelectLabel>
                {endPeriodOptions.map(period => (
                  <SelectItem key={`end-${period}`} value={period}>{period}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 lg:ml-auto">
            <span className="text-sm font-medium text-muted-foreground min-w-[150px] text-center flex items-center justify-center gap-1 px-2">
              <CalendarDays className="h-4 w-4" /> {selectedRangeHeaderDisplay}
            </span>
          </div>
        </div>
        <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
      </header>
    </TooltipProvider>
  );
}

    