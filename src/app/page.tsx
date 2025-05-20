
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  format as formatDateFn, 
  getWeek, 
  getMonth, 
  getYear, 
  parse as dateParse, 
  startOfWeek,
  endOfWeek,
  isWithinInterval as isWithinIntervalFns, 
  setDate, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  isBefore, 
  isAfter 
} from 'date-fns';
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Loader2, Zap, Download, Upload, Building2, Briefcase, Users, ChevronDown, Edit3, ArrowDown, ArrowUp, Minus, Calendar as CalendarIcon } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { suggestLoBGroupings, SuggestLoBGroupingsOutput } from "@/ai/flows/suggest-lob-groupings";

// --- BEGIN TYPES (from src/components/capacity-insights/types.ts) ---
export const BUSINESS_UNIT_CONFIG = {
  "WFS": {
    name: "WFS",
    lonsOfBusiness: [
      "US Chat", "US Phone", "Core Support", "Customer Returns", "Inventory Management",
      "Dispute Management", "IBE Management", "FC Liaison", "Flex Team", "Help Desk", "MCS",
      "China Mandarin Chat", "China Mandarin Email", "China English Chat", "China English Email",
      "Strike Through", "Walmart Import"
    ]
  },
  "SFF": {
    name: "SFF",
    lonsOfBusiness: ["SFF LoB Alpha", "SFF LoB Bravo", "SFF LoB Charlie", "SFF LoB Delta"]
  },
  "RSO": {
    name: "RSO",
    lonsOfBusiness: ["RSO LoB Xray", "RSO LoB Yankee", "RSO LoB Zulu"]
  },
  "Go Local": {
    name: "Go Local",
    lonsOfBusiness: ["GoLocal Partner Support", "GoLocal Customer Care", "GoLocal Dispatch"]
  }
} as const;

export type BusinessUnitName = keyof typeof BUSINESS_UNIT_CONFIG;
export type LineOfBusinessName<BU extends BusinessUnitName = BusinessUnitName> = typeof BUSINESS_UNIT_CONFIG[BU]["lonsOfBusiness"][number];

export const ALL_BUSINESS_UNITS = Object.keys(BUSINESS_UNIT_CONFIG) as BusinessUnitName[];
export const ALL_TEAM_NAMES: TeamName[] = ["Inhouse", "BPO1", "BPO2"];


export interface FilterOptions {
  businessUnits: BusinessUnitName[];
  linesOfBusiness: string[]; 
  teams: TeamName[];
}

export const ALL_WEEKS_HEADERS = Array.from({ length: 104 }, (_, i) => { 
  const baseDate = new Date(2024, 0, 1); 
  const firstDayOfYear = new Date(baseDate.getFullYear(), 0, 1);
  const dayOfWeek = firstDayOfYear.getDay(); 
  const diffToMondayOfFirstWeek = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; 
  const mondayOfFirstWeek = new Date(firstDayOfYear);
  mondayOfFirstWeek.setDate(firstDayOfYear.getDate() + diffToMondayOfFirstWeek);

  const startDate = new Date(mondayOfFirstWeek);
  startDate.setDate(mondayOfFirstWeek.getDate() + i * 7);
  
  const endDate = new Date(new Date(startDate).setDate(startDate.getDate() + 6));
  const formatDatePart = (date: Date) => `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  return `Wk${i + 1}: ${formatDatePart(startDate)}-${formatDatePart(endDate)} (${getYear(startDate)})`;
});


export const ALL_MONTH_HEADERS = Array.from({ length: 24 }, (_, i) => { 
  const year = 2024 + Math.floor(i / 12);
  const month = i % 12;
  const date = new Date(year, month, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

export const NUM_PERIODS_DISPLAYED = 60; 
export type TimeInterval = "Week" | "Month";

export type TeamName = "Inhouse" | "BPO1" | "BPO2";


export interface BaseHCValues {
  requiredHC: number | null;
  actualHC: number | null;
  overUnderHC: number | null;
}

export interface TeamPeriodicMetrics extends BaseHCValues {
  // Inputs / Editable Assumptions
  aht: number | null; 
  shrinkagePercentage: number | null;
  occupancyPercentage: number | null;
  backlogPercentage: number | null; 
  attritionPercentage: number | null;
  volumeMixPercentage: number | null; 
  actualHC: number | null; // Also an input, can be planned/scheduled
  moveIn: number | null; 
  moveOut: number | null; 
  newHireBatch: number | null; 
  newHireProduction: number | null; 

  // Could be an input or derived from other inputs not yet defined (e.g. contacts/hour)
  _productivity: number | null; 

  // Calculated fields based on inputs
  _calculatedRequiredAgentMinutes?: number | null; 
  _calculatedActualAgentMinutes?: number | null; 
}

// For LOBs and BUs - primarily aggregated HC and derived agent minutes
export interface AggregatedPeriodicMetrics extends BaseHCValues {}

export interface RawTeamDataEntry {
  teamName: TeamName;
  periodicInputData: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>>;
}

export interface RawLoBCapacityEntry {
  id: string; 
  bu: BusinessUnitName;
  lob: string; 
  lobTotalBaseRequiredMinutes: Record<string, number | null>; // LOB's share of demand
  teams: RawTeamDataEntry[];
}

export interface CapacityDataRow {
  id: string;
  name: string;
  level: number; 
  itemType: 'BU' | 'LOB' | 'Team';
  periodicData: Record<string, AggregatedPeriodicMetrics | TeamPeriodicMetrics>; 
  children?: CapacityDataRow[];
  lobId?: string; // Used by Team rows to know their parent LOB for metric editing
}

export interface MetricDefinition {
    key: keyof TeamPeriodicMetrics | keyof AggregatedPeriodicMetrics; 
    label: string;
    isPercentage?: boolean; // For formatting (e.g., adding '%')
    isHC?: boolean; // For formatting (e.g., toFixed(2))
    isTime?: boolean; // For formatting (e.g., adding 'min')
    isEditableForTeam?: boolean; // If true, team metric can be edited
    step?: string | number; // Step for number inputs
}

export type TeamMetricDefinitions = MetricDefinition[];
export type AggregatedMetricDefinitions = MetricDefinition[];


// Definitions for rows displayed under a TEAM
export const TEAM_METRIC_ROW_DEFINITIONS: TeamMetricDefinitions = [
  { key: "aht", label: "AHT", isTime: true, isEditableForTeam: true, step: 0.1 },
  { key: "shrinkagePercentage", label: "Shrinkage %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "occupancyPercentage", label: "Occupancy %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "backlogPercentage", label: "Backlog %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "attritionPercentage", label: "Attrition %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "volumeMixPercentage", label: "Volume Mix %", isPercentage: true, isEditableForTeam: true, step: 0.1 },
  { key: "requiredHC", label: "Required HC", isHC: true },
  { key: "actualHC", label: "Actual HC", isHC: true, isEditableForTeam: true, step: 0.01 },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
  { key: "moveIn", label: "Move In (+)", isEditableForTeam: true, step: 1, isHC: true },
  { key: "moveOut", label: "Move Out (-)", isEditableForTeam: true, step: 1, isHC: true },
  { key: "newHireBatch", label: "New Hire Batch", isEditableForTeam: true, step: 1, isHC: true },
  { key: "newHireProduction", label: "New Hire Production", isEditableForTeam: true, step: 1, isHC: true },
];

// Definitions for rows displayed under a BU or LOB (Aggregated Data)
export const AGGREGATED_METRIC_ROW_DEFINITIONS: AggregatedMetricDefinitions = [
  { key: "requiredHC", label: "Required HC", isHC: true },
  { key: "actualHC", label: "Actual HC", isHC: true },
  { key: "overUnderHC", label: "Over/Under HC", isHC: true },
];

export interface HeaderSectionProps {
  filterOptions: FilterOptions;
  selectedBusinessUnit: BusinessUnitName;
  onSelectBusinessUnit: (value: BusinessUnitName) => void;
  selectedLineOfBusiness: string[];
  onSelectLineOfBusiness: (value: string[]) => void;
  selectedTimeInterval: TimeInterval;
  onSelectTimeInterval: (value: TimeInterval) => void;
  selectedDateRange: DateRange | undefined;
  onSelectDateRange: (value: DateRange | undefined) => void;
}
// --- END TYPES ---

// --- BEGIN DATA (from src/components/capacity-insights/data.ts) ---
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS; 

const generateTeamPeriodicInputData = (periods: string[], teamIndex: number, totalTeams: number): Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>> => {
  const metrics: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>>> = {};
  
  periods.forEach(period => {
    let baseMix = Math.floor(100 / totalTeams);
    let remainder = 100 % totalTeams;
    let initialMix = baseMix + (teamIndex < remainder ? 1 : 0);

    if (teamIndex === totalTeams - 1) {
        let sumOfPreviousMixes = 0;
        for (let i = 0; i < totalTeams - 1; i++) {
            sumOfPreviousMixes += baseMix + (i < remainder ? 1 : 0);
        }
        initialMix = 100 - sumOfPreviousMixes;
    }
    initialMix = Math.max(0, Math.min(100, parseFloat(initialMix.toFixed(1))));


    metrics[period] = {
      aht: Math.floor(Math.random() * 10) + 5, 
      shrinkagePercentage: Math.floor(Math.random() * 15) + 5, 
      occupancyPercentage: Math.floor(Math.random() * 20) + 70, 
      backlogPercentage: Math.floor(Math.random() * 10), 
      attritionPercentage: parseFloat((Math.random() * 2).toFixed(1)), 
      volumeMixPercentage: initialMix,
      actualHC: Math.floor(Math.random() * 50) + 10, 
      moveIn: Math.floor(Math.random() * 5),
      moveOut: Math.floor(Math.random() * 3),
      newHireBatch: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 5 : 0,
      newHireProduction: Math.random() > 0.5 ? Math.floor(Math.random() * 8) : 0,
      _productivity: Math.floor(Math.random() * 5) + 5, 
    };
  });
  return metrics;
};

const generateLobTotalBaseRequiredMinutes = (periods: string[]): Record<string, number | null> => {
  const metrics: Record<string, number | null> = {};
  periods.forEach(period => {
    metrics[period] = Math.floor(Math.random() * 200000) + 50000; 
  });
  return metrics;
};

const initialMockRawCapacityData: RawLoBCapacityEntry[] = [];
ALL_BUSINESS_UNITS.forEach(bu => {
  BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness.forEach(lob => {
    const teamsForLob: RawTeamDataEntry[] = [];
    const numTeams = ALL_TEAM_NAMES.length;
    
    ALL_TEAM_NAMES.forEach((teamName, index) => {
      teamsForLob.push({
        teamName: teamName,
        periodicInputData: generateTeamPeriodicInputData(MOCK_DATA_PERIODS, index, numTeams),
      });
    });

    initialMockRawCapacityData.push({
      id: `${bu.toLowerCase().replace(/\s+/g, '-')}_${lob.toLowerCase().replace(/\s+/g, '-')}`,
      bu: bu,
      lob: lob,
      lobTotalBaseRequiredMinutes: generateLobTotalBaseRequiredMinutes(MOCK_DATA_PERIODS),
      teams: teamsForLob,
    });
  });
});
// --- END DATA ---

// --- BEGIN HELPER FUNCTIONS (from page.tsx) ---
const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60; 
const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60; 

const calculateTeamMetricsForPeriod = (
  teamInputData: Partial<RawTeamDataEntry['periodicInputData'][string]>, 
  lobBaseRequiredAgentMinutes: number | null, 
  standardWorkMinutesForPeriod: number 
): TeamPeriodicMetrics => {
  const defaults: TeamPeriodicMetrics = {
    aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
    attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null,
    moveOut: null, newHireBatch: null, newHireProduction: null, _productivity: null,
    _calculatedRequiredAgentMinutes: null,
    _calculatedActualAgentMinutes: null,
    requiredHC: null,
    overUnderHC: null,
    ...teamInputData, 
  };

  if (lobBaseRequiredAgentMinutes === null || lobBaseRequiredAgentMinutes === undefined) {
    return defaults; 
  }

  const calculatedRequiredAgentMinutes = lobBaseRequiredAgentMinutes * ((defaults.volumeMixPercentage ?? 0) / 100);

  let requiredHC = null;
  if (calculatedRequiredAgentMinutes > 0 && standardWorkMinutesForPeriod > 0 && defaults.shrinkagePercentage !== null && defaults.occupancyPercentage !== null) {
    const effectiveMinutesPerHC = standardWorkMinutesForPeriod * 
                                 (1 - (defaults.shrinkagePercentage / 100)) * 
                                 (defaults.occupancyPercentage / 100);
    if (effectiveMinutesPerHC > 0) {
      requiredHC = calculatedRequiredAgentMinutes / effectiveMinutesPerHC;
    }
  } else if (calculatedRequiredAgentMinutes === 0) {
    requiredHC = 0; 
  }

  const actualHC = defaults.actualHC ?? null; 

  const overUnderHC = (actualHC !== null && requiredHC !== null) ? actualHC - requiredHC : null;

  let calculatedActualAgentMinutes = null;
  if (calculatedRequiredAgentMinutes !== null && requiredHC !== null && requiredHC > 0 && actualHC !== null) {
    calculatedActualAgentMinutes = calculatedRequiredAgentMinutes * (actualHC / requiredHC);
  } else if (requiredHC === 0 && actualHC !== null && actualHC > 0) {
     calculatedActualAgentMinutes = 0; 
  } else if (requiredHC === null && actualHC !== null && actualHC > 0) {
    calculatedActualAgentMinutes = null;
  } else if (actualHC === 0) {
    calculatedActualAgentMinutes = 0;
  }


  return {
    ...defaults,
    _calculatedRequiredAgentMinutes: calculatedRequiredAgentMinutes,
    _calculatedActualAgentMinutes: calculatedActualAgentMinutes,
    requiredHC: requiredHC,
    overUnderHC: overUnderHC,
  };
};

const parseDateFromHeaderStringMMDDYYYY = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;
  const parsedDate = new Date(parseInt(year), month - 1, day);
  if (parsedDate.getFullYear() !== parseInt(year) || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null; 
  }
  return parsedDate;
};

const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (interval === "Week") {
    const match = header.match(/:\s*(\d{2}\/\d{2})-(\d{2}\/\d{2})\s*\((\d{4})\)/);
    if (match) {
      const [, startDateStr, endDateStr, yearStr] = match;
      return {
        startDate: parseDateFromHeaderStringMMDDYYYY(startDateStr, yearStr),
        endDate: parseDateFromHeaderStringMMDDYYYY(endDateStr, yearStr),
      };
    }
  } else if (interval === "Month") {
    try {
      const date = dateParse(header, "MMMM yyyy", new Date());
      if (!isNaN(date.getTime())) { 
        const yearVal = getYear(date);
        const monthVal = getMonth(date); 
        const firstDay = startOfMonth(new Date(yearVal, monthVal));
        const lastDay = endOfMonth(new Date(yearVal, monthVal));
        return { startDate: firstDay, endDate: lastDay };
      }
    } catch (e) {
        // console.warn(`Could not parse month header: ${header}`, e);
    }
  }
  return { startDate: null, endDate: null };
};

const getDefaultDateRange = (interval: TimeInterval): DateRange => {
  const headers = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
  const numPeriods = interval === "Week" ? Math.min(11, headers.length -1) : Math.min(2, headers.length-1); 

  const fromDate = getHeaderDateRange(headers[0], interval).startDate;
  const toDate = getHeaderDateRange(headers[numPeriods], interval).endDate;
  
  return { from: fromDate || undefined, to: toDate || undefined };
};
// --- END HELPER FUNCTIONS ---


// --- BEGIN AiGroupingDialog COMPONENT ---
const aiGroupingDialogFormSchema = z.object({
  historicalCapacityData: z.string().min(1, "Historical data (CSV format) is required."),
  currentBusinessUnits: z.string().min(1, "Current business units (comma-separated) are required."),
});
type AiGroupingDialogFormData = z.infer<typeof aiGroupingDialogFormSchema>;

interface AiGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AiGroupingDialog({ open, onOpenChange }: AiGroupingDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestLoBGroupingsOutput | null>(null);

  const form = useForm<AiGroupingDialogFormData>({
    resolver: zodResolver(aiGroupingDialogFormSchema),
    defaultValues: {
      historicalCapacityData: "LoB,Week1,Week2,Week3\nSales,100,120,110\nSupport,80,90,85\nMarketing,50,60,55",
      currentBusinessUnits: "BU Alpha, BU Beta",
    },
  });

  const onSubmit = async (data: AiGroupingDialogFormData) => {
    setIsLoading(true);
    setSuggestions(null);
    try {
      const businessUnitsArray = data.currentBusinessUnits.split(",").map(bu => bu.trim()).filter(bu => bu.length > 0);
      const result = await suggestLoBGroupings({
        historicalCapacityData: data.historicalCapacityData,
        currentBusinessUnits: businessUnitsArray,
      });
      setSuggestions(result);
      toast({
        title: "Suggestions Generated",
        description: "AI has provided LoB grouping suggestions.",
      });
    } catch (error) {
      console.error("Error generating LoB groupings:", error);
      toast({
        title: "Error",
        description: "Failed to generate LoB grouping suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            AI-Powered LoB Grouping Suggestions
          </DialogTitle>
          <DialogDescription>
            Provide historical data and current business units to get AI-driven suggestions for optimal LoB groupings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="historicalCapacityData">Historical Capacity Data (CSV Format)</Label>
            <Textarea
              id="historicalCapacityData"
              placeholder="LoB,Date,CapacityUsed,RequiredCapacity..."
              {...form.register("historicalCapacityData")}
              className="mt-1 min-h-[120px]"
            />
            {form.formState.errors.historicalCapacityData && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.historicalCapacityData.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="currentBusinessUnits">Current Business Units (comma-separated)</Label>
            <Input
              id="currentBusinessUnits"
              placeholder="e.g., Sales Division, Product Team, Regional Office"
              {...form.register("currentBusinessUnits")}
              className="mt-1"
            />
            {form.formState.errors.currentBusinessUnits && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.currentBusinessUnits.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Get Suggestions
            </Button>
          </DialogFooter>
        </form>

        {suggestions && (
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suggested Groupings</CardTitle>
              </CardHeader>
              <CardContent>
                {suggestions.suggestedGroupings.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {suggestions.suggestedGroupings.map((group, index) => (
                      <li key={index} className="text-sm">
                        <strong>Group {index + 1}:</strong> {group.join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific groupings suggested based on the data.</p>
                )}
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Reasoning</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{suggestions.reasoning}</p>
                </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
// --- END AiGroupingDialog COMPONENT ---

// --- BEGIN DateRangePicker COMPONENT ---
interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  onDateChange: (date: DateRange | undefined) => void
  className?: string
}

function DateRangePicker({ date, onDateChange, className }: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full lg:w-[380px] justify-start text-left font-normal h-9", 
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              <>
                {`W${getWeek(date.from, { weekStartsOn: 1 })} (${formatDateFn(date.from, "dd/MM/yyyy")})`}
                {date.to && !(getWeek(date.from, { weekStartsOn: 1 }) === getWeek(date.to, { weekStartsOn: 1 }) && getYear(date.from) === getYear(date.to)) ? (
                  ` - W${getWeek(date.to, { weekStartsOn: 1 })} (${formatDateFn(date.to, "dd/MM/yyyy")})`
                ) : (
                  (date.from && date.to && getWeek(date.from, { weekStartsOn: 1 }) === getWeek(date.to, { weekStartsOn: 1 }) && getYear(date.from) === getYear(date.to)) ? '' : ''
                )}
              </>
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            weekStartsOn={1} 
            captionLayout="dropdown-buttons"
            fromYear={2024}
            toYear={getYear(addDays(new Date(2024,0,1), 104*7))} 
            defaultMonth={date?.from}
            selected={date}
            onSelect={(range: DateRange | undefined) => {
              let newFrom = range?.from;
              let newTo = range?.to;

              if (newFrom) {
                newFrom = startOfWeek(newFrom, { weekStartsOn: 1 });
              }
              if (newTo) {
                newTo = endOfWeek(newTo, { weekStartsOn: 1 });
              }
              
              if (newFrom && newTo && isBefore(newTo, newFrom)) {
                newTo = endOfWeek(newFrom, {weekStartsOn: 1}); 
              }

              const processedRange: DateRange | undefined = newFrom
                ? { from: newFrom, to: newTo }
                : undefined;
              onDateChange(processedRange);
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
// --- END DateRangePicker COMPONENT ---

// --- BEGIN HeaderSection COMPONENT ---
function HeaderSection({
  filterOptions,
  selectedBusinessUnit,
  onSelectBusinessUnit,
  selectedLineOfBusiness,
  onSelectLineOfBusiness,
  selectedTimeInterval,
  onSelectTimeInterval,
  selectedDateRange,
  onSelectDateRange,
}: HeaderSectionProps) {
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const handleLobSelectionChange = (lob: string, checked: boolean) => {
    const newSelectedLOBs = checked
      ? [...selectedLineOfBusiness, lob]
      : selectedLineOfBusiness.filter((item) => item !== lob);
    onSelectLineOfBusiness(newSelectedLOBs);
  };

  const actualLobsForCurrentBu = BUSINESS_UNIT_CONFIG[selectedBusinessUnit].lonsOfBusiness;
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
      <header className="p-4 border-b border-border bg-background"> {/* Removed sticky classes */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <h1 className="text-2xl font-semibold text-foreground">Capacity Insights</h1>
          <div className="flex flex-wrap items-center gap-2">
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
          <DateRangePicker date={selectedDateRange} onDateChange={onSelectDateRange} />
        </div>
        <AiGroupingDialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen} />
      </header>
    </TooltipProvider>
  );
}
// --- END HeaderSection COMPONENT ---

// --- BEGIN CapacityTable COMPONENT ---
interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[];
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  teamMetricDefinitions: TeamMetricDefinitions;
  aggregatedMetricDefinitions: AggregatedMetricDefinitions;
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
  editingCell: { lobId: string; teamName: TeamName; period: string; metricKey: keyof TeamPeriodicMetrics } | null;
  onSetEditingCell: (lobId: string | null, teamName: TeamName | null, period: string | null, metricKey: keyof TeamPeriodicMetrics | null) => void;
}

interface MetricCellContentProps {
  item: CapacityDataRow;
  metricData: TeamPeriodicMetrics | AggregatedPeriodicMetrics | undefined;
  metricDef: MetricDefinition;
  periodName: string;
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange'];
  isEditing: boolean;
  onSetEditingCell: CapacityTableProps['onSetEditingCell'];
}

const MetricCellContent: React.FC<MetricCellContentProps> = React.memo(({
  item,
  metricData,
  metricDef,
  periodName,
  onTeamMetricChange,
  isEditing,
  onSetEditingCell,
}) => {
  const rawValue = metricData ? (metricData as any)[metricDef.key] : null;

  const handleEditClick = () => {
    if (item.itemType === 'Team' && metricDef.isEditableForTeam && item.lobId) {
      onSetEditingCell(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (item.itemType === 'Team' && metricDef.isEditableForTeam && item.lobId) {
        onTeamMetricChange(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, e.target.value);
     }
  };
  
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (item.itemType === 'Team' && metricDef.isEditableForTeam && item.lobId) {
      onTeamMetricChange(item.lobId, item.name as TeamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, e.target.value);
    }
    onSetEditingCell(null, null, null, null); 
  };


  if (isEditing) {
    return (
      <Input
        type="number"
        value={rawValue === null || rawValue === undefined ? "" : String(rawValue)}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        className="h-8 w-full max-w-[100px] text-right tabular-nums px-1 py-0.5 text-xs bg-background border-input focus:border-primary focus:ring-1 focus:ring-primary"
        step={metricDef.step || "any"}
        autoFocus
      />
    );
  }

  if (rawValue === null || rawValue === undefined) {
    return <div onClick={handleEditClick} className="cursor-pointer w-full h-full flex items-center justify-center"><Minus className="h-4 w-4 text-muted-foreground mx-auto" /></div>;
  }

  let displayValue: React.ReactNode = "";
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let tooltipText = `${item.name} - ${periodName}\n${metricDef.label}: `;

  const numValue = Number(rawValue);

  if (metricDef.isPercentage) {
    displayValue = `${numValue.toFixed(1)}%`;
  } else if (metricDef.isTime) { 
    displayValue = `${numValue.toFixed(1)} min`;
  } else if (metricDef.isHC || ['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction'].includes(metricDef.key as string) ) {
    const digits = (['moveIn', 'moveOut', 'newHireBatch', 'newHireProduction'].includes(metricDef.key as string)) ? 0 : 2;
    displayValue = numValue.toFixed(digits);
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
    const fractionDigits = (metricDef.key === "overUnderHC" || metricDef.key === "requiredHC" || metricDef.key === "actualHC") ? 2 : 1;
    displayValue = numValue.toLocaleString(undefined, {minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits});
  } else {
    displayValue = String(rawValue); 
  }
  
  tooltipText += displayValue;

  if (metricDef.key === "overUnderHC") {
    if (numValue < 0) {
      textColor = "text-destructive"; 
      icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
    } else if (numValue > 0) {
      textColor = "text-primary"; 
      icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
    }
    if (metricData && 'actualHC' in metricData && 'requiredHC' in metricData && typeof (metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).actualHC === 'number' && typeof (metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).requiredHC === 'number') {
      tooltipText = `${item.name} - ${periodName}\nOver/Under HC = Actual HC - Required HC\n${(metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).actualHC!.toFixed(2)} - ${(metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).requiredHC!.toFixed(2)} = ${numValue.toFixed(2)}`;
    }
  }
  
  const cellContent = (
    <div onClick={handleEditClick} className={`flex items-center justify-end ${textColor} cursor-pointer w-full h-full`}>
      {displayValue} {icon}
    </div>
  );

  if (tooltipText && (rawValue !== null && rawValue !== undefined)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cellContent}
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-wrap text-xs max-w-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return cellContent;
});
MetricCellContent.displayName = 'MetricCellContent';


interface MetricRowProps {
  item: CapacityDataRow;
  metricDef: MetricDefinition;
  level: number;
  periodHeaders: string[];
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange'];
  editingCell: CapacityTableProps['editingCell'];
  onSetEditingCell: CapacityTableProps['onSetEditingCell'];
}

const MetricRow: React.FC<MetricRowProps> = React.memo(({ item, metricDef, level, periodHeaders, onTeamMetricChange, editingCell, onSetEditingCell }) => {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell
        className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }}
      >
        <span className="flex items-center gap-2">
          {metricDef.label}
          {item.itemType === 'Team' && metricDef.isEditableForTeam && <Edit3 className="h-3 w-3 text-muted-foreground opacity-50" />}
        </span>
      </TableCell>
      {periodHeaders.map((periodHeader) => {
        const metricForPeriod = item.periodicData[periodHeader];
        let cellTextColor = "text-foreground";
        if (metricDef.key === "overUnderHC" && metricForPeriod && (metricForPeriod as any)[metricDef.key] !== null && (metricForPeriod as any)[metricDef.key] !== undefined) {
            const value = Number((metricForPeriod as any)[metricDef.key]);
            if (value < 0) cellTextColor = "text-destructive";
            else if (value > 0) cellTextColor = "text-primary";
        }

        const isCurrentlyEditing = 
          item.itemType === 'Team' &&
          editingCell?.lobId === item.lobId &&
          editingCell?.teamName === item.name &&
          editingCell?.period === periodHeader &&
          editingCell?.metricKey === metricDef.key;
        
        return (
          <TableCell
            key={`${item.id}-${metricDef.key}-${periodHeader}`}
            className={`text-right tabular-nums ${cellTextColor} py-2 px-2`}
          >
            <MetricCellContent
                item={item}
                metricData={metricForPeriod}
                metricDef={metricDef}
                periodName={periodHeader}
                onTeamMetricChange={onTeamMetricChange}
                isEditing={isCurrentlyEditing}
                onSetEditingCell={onSetEditingCell}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
});
MetricRow.displayName = 'MetricRow';


const CapacityTableComponent: React.FC<CapacityTableProps> = ({
    data,
    periodHeaders,
    expandedItems,
    toggleExpand,
    teamMetricDefinitions,
    aggregatedMetricDefinitions,
    onTeamMetricChange,
    editingCell,
    onSetEditingCell,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const renderCapacityItemContent = useCallback((
    item: CapacityDataRow,
  ): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    let metricDefinitionsToUse: MetricDefinition[];

    if (item.itemType === 'Team') {
      metricDefinitionsToUse = teamMetricDefinitions;
    } else { 
      metricDefinitionsToUse = aggregatedMetricDefinitions;
    }

    metricDefinitionsToUse.forEach(metricDef => {
      rows.push(
        <MetricRow
          key={`${item.id}-${metricDef.key}`}
          item={item}
          metricDef={metricDef}
          level={item.level + 1} 
          periodHeaders={periodHeaders}
          onTeamMetricChange={onTeamMetricChange}
          editingCell={editingCell}
          onSetEditingCell={onSetEditingCell}
        />
      );
    });
    return rows;
  }, [periodHeaders, teamMetricDefinitions, aggregatedMetricDefinitions, onTeamMetricChange, editingCell, onSetEditingCell]);


  const renderTableItem = useCallback((item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;
    const isExpandable = (item.children && item.children.length > 0) || item.itemType === 'Team';

    let rowSpecificBgClass = '';
    let buttonTextClass = 'text-foreground';
    let itemZIndex = 20; 

    if (item.itemType === 'BU') {
      rowSpecificBgClass = 'bg-secondary';
      buttonTextClass = 'text-secondary-foreground';
      itemZIndex = 35; 
    } else if (item.itemType === 'LOB') {
      rowSpecificBgClass = 'bg-muted';
      buttonTextClass = 'text-muted-foreground';
      itemZIndex = 30;
    } else if (item.itemType === 'Team') {
      rowSpecificBgClass = 'bg-muted/50'; 
      buttonTextClass = 'text-foreground';
      itemZIndex = 25;
    }
    
    const hoverClass = item.itemType !== 'BU' ? 'hover:bg-muted/70' : 'hover:bg-secondary/80';

    rows.push(
      <TableRow
        key={`${item.id}-name`}
        className={cn(rowSpecificBgClass, hoverClass)}
      >
        <TableCell
          className={cn(
            "p-0 sticky left-0 whitespace-nowrap",
            rowSpecificBgClass || 'bg-card' 
          )}
          style={{ 
            zIndex: itemZIndex, 
            paddingLeft: `${item.level * 1.5 + (isExpandable ? 0 : 0.5)}rem` 
          }}
        >
          <button
            onClick={isExpandable ? () => toggleExpand(item.id) : undefined}
            disabled={!isExpandable}
            className={cn(
                "py-3 px-2 font-semibold hover:no-underline w-full text-left flex items-center gap-2", 
                buttonTextClass
            )}
            aria-expanded={isExpandable ? isExpanded : undefined}
          >
            {isExpandable && (
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            )}
            {item.name}
          </button>
        </TableCell>
        {periodHeaders.map((ph) => (
             <TableCell 
                key={`${item.id}-${ph}-nameplaceholder`} 
                className={cn(
                    rowSpecificBgClass, 
                    'py-3' 
                )}></TableCell>
        ))}
      </TableRow>
    );

    if (isExpanded) {
        if (item.itemType === 'BU' || item.itemType === 'LOB') {
            const aggregatedMetricRows = renderCapacityItemContent(item);
            rows.push(...aggregatedMetricRows);
            if (item.children && item.children.length > 0) {
                item.children.forEach(child => {
                    rows.push(...renderTableItem(child));
                });
            }
        }
        else if (item.itemType === 'Team') { 
            const teamMetricRows = renderCapacityItemContent(item);
            rows.push(...teamMetricRows);
        }
    } 
    else if (!isExpandable && (item.itemType === 'BU' || item.itemType === 'LOB')) { 
        const itemMetricRows = renderCapacityItemContent(item);
        rows.push(...itemMetricRows);
    }

    return rows;
  }, [expandedItems, periodHeaders, toggleExpand, renderCapacityItemContent]);


  const getCategoryHeader = () => {
    return 'BU / LoB / Team / Metric';
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={scrollContainerRef} className="overflow-x-auto relative border border-border rounded-md shadow-md">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-40 bg-card">
            <TableRow>
              <TableHead className="sticky left-0 z-50 bg-card min-w-[320px] whitespace-nowrap px-4 py-2 align-middle">
                {getCategoryHeader()}
              </TableHead>
              {periodHeaders.map((period, index) => {
                const parts = period.split(': ');
                const weekLabelPart = parts[0].replace("Wk", "W"); 
                let dateRangePart = "";
                if (parts.length > 1) {
                    const dateAndYearPart = parts[1]; 
                    const match = dateAndYearPart.match(/^(\d{2}\/\d{2}-\d{2}\/\d{2})/); 
                    if (match) {
                        dateRangePart = match[1];
                    }
                }
                return (
                  <TableHead
                    key={period}
                    className="text-right min-w-[100px] px-2 py-2 align-middle"
                  >
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-medium">{weekLabelPart}</span>
                        {dateRangePart && (
                            <span className="text-xs text-muted-foreground">
                                ({dateRangePart})
                            </span>
                        )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.flatMap(item => renderTableItem(item))
            ) : (
              <TableRow>
                <TableCell colSpan={periodHeaders.length + 1} className="text-center text-muted-foreground h-24">
                  No data available for the current selection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
CapacityTableComponent.displayName = 'CapacityTableComponent';
const CapacityTable = React.memo(CapacityTableComponent);
// --- END CapacityTable COMPONENT ---

// --- MAIN PAGE COMPONENT ---
export default function CapacityInsightsPage() {
  const [rawCapacityDataSource, setRawCapacityDataSource] = useState<RawLoBCapacityEntry[]>(() => JSON.parse(JSON.stringify(initialMockRawCapacityData)));
  
  const defaultWFSLoBs = ["Inventory Management", "Customer Returns", "Help Desk"];
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<BusinessUnitName>("WFS");
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string[]>(() => {
    const initialBu: BusinessUnitName = "WFS"; 
    const wfsLobsConfig = BUSINESS_UNIT_CONFIG[initialBu].lonsOfBusiness;
    return defaultWFSLoBs.filter(lob => wfsLobsConfig.includes(lob as LineOfBusinessName<"WFS">));
  });

  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval>("Week");
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(() => getDefaultDateRange("Week"));
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(() => {
    const initialBu: BusinessUnitName = "WFS";
     return {
      businessUnits: [...ALL_BUSINESS_UNITS],
      linesOfBusiness: [...BUSINESS_UNIT_CONFIG[initialBu].lonsOfBusiness],
      teams: [...ALL_TEAM_NAMES],
    };
  });
  
  const [displayableCapacityData, setDisplayableCapacityData] = useState<CapacityDataRow[]>([]);
  const [displayedPeriodHeaders, setDisplayedPeriodHeaders] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const [editingCell, setEditingCell] = useState<{ lobId: string; teamName: TeamName; period: string; metricKey: keyof TeamPeriodicMetrics } | null>(null);

  const handleSetEditingCell = useCallback((lobId: string | null, teamName: TeamName | null, period: string | null, metricKey: keyof TeamPeriodicMetrics | null) => {
    if (lobId && teamName && period && metricKey) {
      setEditingCell({ lobId, teamName, period, metricKey });
    } else {
      setEditingCell(null);
    }
  }, []);


  const handleTeamMetricChange = useCallback((
    lobId: string,
    teamNameToUpdate: TeamName,
    periodHeader: string,
    metricKey: keyof TeamPeriodicMetrics,
    rawValue: string 
  ) => {
    const newValue = rawValue === "" ? null : parseFloat(rawValue);
    if (rawValue !== "" && rawValue !== "-" && isNaN(newValue as number) && newValue !== null) {
        return; 
    }

    setRawCapacityDataSource(prevRawData => {
      const newData = JSON.parse(JSON.stringify(prevRawData)) as RawLoBCapacityEntry[];
      const lobEntryIndex = newData.findIndex(lob => lob.id === lobId);
      if (lobEntryIndex === -1) return prevRawData;

      const lobEntry = newData[lobEntryIndex];
      const teamEntryIndex = lobEntry.teams.findIndex(team => team.teamName === teamNameToUpdate);
      if (teamEntryIndex === -1) return prevRawData;
      
      const teamEntry = lobEntry.teams[teamEntryIndex];

      if (!teamEntry.periodicInputData) {
        teamEntry.periodicInputData = {};
      }
      if (!teamEntry.periodicInputData[periodHeader]) {
        teamEntry.periodicInputData[periodHeader] = { 
          aht: null, shrinkagePercentage: null, occupancyPercentage: null, backlogPercentage: null,
          attritionPercentage: null, volumeMixPercentage: null, actualHC: null, moveIn: null,
          moveOut: null, newHireBatch: null, newHireProduction: null, _productivity: null
        };
      }
      
      (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = newValue;

      if (metricKey === 'volumeMixPercentage') {
        const updatedTeamMix = Math.max(0, Math.min(100, newValue === null ? 0 : newValue as number));
        (teamEntry.periodicInputData[periodHeader] as any)[metricKey] = updatedTeamMix; 

        const otherTeams = lobEntry.teams.filter(t => t.teamName !== teamNameToUpdate);
        const currentTotalMixOfOtherTeams = otherTeams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        }, 0);

        const remainingMixPercentage = 100 - updatedTeamMix;

        if (otherTeams.length > 0) {
          if (currentTotalMixOfOtherTeams > 0.01) { 
            let distributedSum = 0;
            for (let i = 0; i < otherTeams.length; i++) {
              const team = otherTeams[i];
              const teamPeriodData = team.periodicInputData[periodHeader];
              if (!teamPeriodData) team.periodicInputData[periodHeader] = {};

              const originalShareOfOthers = (teamPeriodData?.volumeMixPercentage ?? 0) / currentTotalMixOfOtherTeams;
              let newShare = remainingMixPercentage * originalShareOfOthers;
              
              if (i === otherTeams.length - 1 ) { 
                newShare = remainingMixPercentage - distributedSum; 
              }
              newShare = Math.max(0, Math.min(100, parseFloat(newShare.toFixed(1)) ) );
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = newShare;
              distributedSum += newShare;
            }
          } else { 
            const mixPerOtherTeam = otherTeams.length > 0 ? parseFloat((remainingMixPercentage / otherTeams.length).toFixed(1)) : 0;
            let distributedSum = 0;
            otherTeams.forEach((team, i) => {
              if (!team.periodicInputData[periodHeader]) team.periodicInputData[periodHeader] = {};
              let currentMix = mixPerOtherTeam;
              if (i === otherTeams.length -1) { 
                  currentMix = remainingMixPercentage - distributedSum;
              }
              (team.periodicInputData[periodHeader] as any).volumeMixPercentage = Math.max(0, Math.min(100, parseFloat(currentMix.toFixed(1)) ));
              distributedSum += parseFloat(currentMix.toFixed(1));
            });
          }
        }
        let finalSum = lobEntry.teams.reduce((sum, t) => {
            const teamPeriodData = t.periodicInputData[periodHeader];
            return sum + (teamPeriodData?.volumeMixPercentage ?? 0);
        },0);

        if (Math.abs(finalSum - 100) > 0.01 && lobEntry.teams.length > 0) { 
            const diff = 100 - finalSum;
            const teamToAdjust = lobEntry.teams.find(t => t.teamName === teamNameToUpdate) || lobEntry.teams[0];
             if (!teamToAdjust.periodicInputData[periodHeader]) { 
                teamToAdjust.periodicInputData[periodHeader] = {};
              }
            (teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage =
                Math.max(0, Math.min(100, parseFloat( ((teamToAdjust.periodicInputData[periodHeader] as any).volumeMixPercentage + diff).toFixed(1) ) ));
        }
      }
      return newData;
    });
  }, []);

  const handleBusinessUnitChange = useCallback((bu: BusinessUnitName) => {
    setSelectedBusinessUnit(bu);
  }, []);

  const handleLOBChange = useCallback((lobs: string[]) => {
      setSelectedLineOfBusiness(lobs);
  }, []);
  
  const handleTimeIntervalChange = useCallback((interval: TimeInterval) => {
    setSelectedTimeInterval(interval);
    setSelectedDateRange(getDefaultDateRange(interval)); 
  }, []);

  useEffect(() => {
    const currentBuConfig = BUSINESS_UNIT_CONFIG[selectedBusinessUnit];
    const allLobsForCurrentBu = [...currentBuConfig.lonsOfBusiness];
    let newSelectedLobs: string[];

    if (selectedBusinessUnit === "WFS") {
      newSelectedLobs = defaultWFSLoBs.filter(lob => allLobsForCurrentBu.includes(lob as LineOfBusinessName<"WFS">));
    } else {
      newSelectedLobs = [...allLobsForCurrentBu];
    }

    setSelectedLineOfBusiness(prevSelectedLobs => {
      const newLobsStr = JSON.stringify(newSelectedLobs.sort());
      const prevLobsStr = JSON.stringify(prevSelectedLobs.sort());
      return newLobsStr !== prevLobsStr ? newSelectedLobs : prevSelectedLobs;
    });
  
    setFilterOptions(prev => {
      const newFilterOptions = {
        businessUnits: [...ALL_BUSINESS_UNITS],
        linesOfBusiness: [...allLobsForCurrentBu],
        teams: [...ALL_TEAM_NAMES],
      };
      if (JSON.stringify(prev) !== JSON.stringify(newFilterOptions)) {
        return newFilterOptions;
      }
      return prev;
    });
  }, [selectedBusinessUnit]);


  const processDataForTable = useCallback(() => {
    const sourcePeriods = selectedTimeInterval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;
    let periodsToDisplay: string[] = [];

    if (selectedDateRange?.from) {
      const userRangeStart = selectedDateRange.from;
      const userRangeEnd = selectedDateRange.to || userRangeStart; 

      periodsToDisplay = sourcePeriods.filter(periodHeaderStr => {
        const { startDate: periodStartDate, endDate: periodEndDate } = getHeaderDateRange(periodHeaderStr, selectedTimeInterval);
        if (!periodStartDate || !periodEndDate) return false;
        
        return isWithinIntervalFns(userRangeStart, {start: periodStartDate, end: periodEndDate}) ||
               isWithinIntervalFns(userRangeEnd, {start: periodStartDate, end: periodEndDate}) ||
               (isBefore(periodStartDate, userRangeEnd) && isAfter(periodEndDate, userRangeStart));
      });
    } else {
      periodsToDisplay = sourcePeriods.slice(0, NUM_PERIODS_DISPLAYED);
    }
    
    setDisplayedPeriodHeaders(periodsToDisplay);

    const standardWorkMinutes = selectedTimeInterval === "Week" ? STANDARD_WEEKLY_WORK_MINUTES : STANDARD_MONTHLY_WORK_MINUTES;
    const newDisplayData: CapacityDataRow[] = [];
    const buName = selectedBusinessUnit; 

    const relevantRawLobEntriesForSelectedBu = rawCapacityDataSource.filter(d => d.bu === buName);
    if (relevantRawLobEntriesForSelectedBu.length === 0) {
        setDisplayableCapacityData([]);
        return;
    }

    const childrenLobsDataRows: CapacityDataRow[] = [];
    
    const lobsToProcess = selectedLineOfBusiness.length > 0 
      ? selectedLineOfBusiness
      : BUSINESS_UNIT_CONFIG[buName].lonsOfBusiness; 

    lobsToProcess.forEach(lobName => {
        const lobRawEntry = relevantRawLobEntriesForSelectedBu.find(entry => entry.lob === lobName);
        if (!lobRawEntry) return; 

        const childrenTeamsDataRows: CapacityDataRow[] = [];
        const teamsToProcess = lobRawEntry.teams || [];

        teamsToProcess.forEach(teamRawEntry => {
            const periodicTeamMetrics: Record<string, TeamPeriodicMetrics> = {};
            periodsToDisplay.forEach(period => {
              periodicTeamMetrics[period] = calculateTeamMetricsForPeriod(
                teamRawEntry.periodicInputData[period] || {},
                lobRawEntry.lobTotalBaseRequiredMinutes[period],
                standardWorkMinutes
              );
            });
            childrenTeamsDataRows.push({
              id: `${lobRawEntry.id}_${teamRawEntry.teamName.replace(/\s+/g, '-')}`,
              name: teamRawEntry.teamName,
              level: 2, 
              itemType: 'Team',
              periodicData: periodicTeamMetrics,
              lobId: lobRawEntry.id, 
            });
        });
        
        const lobPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
        periodsToDisplay.forEach(period => {
            let reqHcSum = 0;
            let actHcSum = 0;

            childrenTeamsDataRows.forEach(teamRow => { 
                const teamPeriodMetric = teamRow.periodicData[period] as TeamPeriodicMetrics;
                if (teamPeriodMetric) {
                    reqHcSum += teamPeriodMetric.requiredHC ?? 0;
                    actHcSum += teamPeriodMetric.actualHC ?? 0;
                }
            });
            const overUnderHCSum = (actHcSum > 0 || reqHcSum > 0 || (actHcSum === 0 && reqHcSum === 0 && childrenTeamsDataRows.length > 0)) ? actHcSum - reqHcSum : null;

            lobPeriodicData[period] = {
                requiredHC: reqHcSum,
                actualHC: actHcSum,
                overUnderHC: overUnderHCSum,
            };
        });
        childrenLobsDataRows.push({
          id: lobRawEntry.id,
          name: lobName,
          level: 1, 
          itemType: 'LOB',
          periodicData: lobPeriodicData,
          children: childrenTeamsDataRows,
        });
    });

    if (childrenLobsDataRows.length > 0 ) { 
      const buPeriodicData: Record<string, AggregatedPeriodicMetrics> = {};
      periodsToDisplay.forEach(period => {
        let reqHcSum = 0;
        let actHcSum = 0;
        childrenLobsDataRows.forEach(lobRow => { 
            const lobPeriodMetric = lobRow.periodicData[period] as AggregatedPeriodicMetrics;
              if (lobPeriodMetric) {
                reqHcSum += lobPeriodMetric.requiredHC ?? 0;
                actHcSum += lobPeriodMetric.actualHC ?? 0;
              }
        });
        const overUnderHCSum = (actHcSum > 0 || reqHcSum > 0 || (actHcSum === 0 && reqHcSum === 0 && childrenLobsDataRows.length > 0)) ? actHcSum - reqHcSum : null;

        buPeriodicData[period] = {
            requiredHC: reqHcSum,
            actualHC: actHcSum,
            overUnderHC: overUnderHCSum,
        };
      });
      newDisplayData.push({
        id: buName, 
        name: buName,
        level: 0, 
        itemType: 'BU',
        periodicData: buPeriodicData,
        children: childrenLobsDataRows,
      });
    }
    setDisplayableCapacityData(newDisplayData);

  }, [
      selectedBusinessUnit, 
      selectedLineOfBusiness, 
      selectedTimeInterval, 
      selectedDateRange,
      rawCapacityDataSource, 
    ]);

  useEffect(() => {
    processDataForTable();
  }, [processDataForTable]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <HeaderSection
        filterOptions={filterOptions}
        selectedBusinessUnit={selectedBusinessUnit}
        onSelectBusinessUnit={handleBusinessUnitChange}
        selectedLineOfBusiness={selectedLineOfBusiness}
        onSelectLineOfBusiness={handleLOBChange}
        selectedTimeInterval={selectedTimeInterval}
        onSelectTimeInterval={handleTimeIntervalChange}
        selectedDateRange={selectedDateRange}
        onSelectDateRange={setSelectedDateRange}
      />
      <main className="flex-grow overflow-auto p-4">
        <CapacityTable
          data={displayableCapacityData}
          periodHeaders={displayedPeriodHeaders}
          expandedItems={expandedItems}
          toggleExpand={toggleExpand}
          teamMetricDefinitions={TEAM_METRIC_ROW_DEFINITIONS}
          aggregatedMetricDefinitions={AGGREGATED_METRIC_ROW_DEFINITIONS}
          onTeamMetricChange={handleTeamMetricChange}
          editingCell={editingCell}
          onSetEditingCell={handleSetEditingCell}
        />
      </main>
    </div>
  );
}


