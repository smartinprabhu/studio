
"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, Minus, ChevronDown, Edit3 } from "lucide-react";
import type {
    CapacityDataRow,
    TeamPeriodicMetrics,
    AggregatedPeriodicMetrics,
    MetricDefinition,
    TeamMetricDefinitions,
    AggregatedMetricDefinitions,
    TeamName
} from "./types";
import { cn } from "@/lib/utils";

interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[];
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  teamMetricDefinitions: TeamMetricDefinitions;
  aggregatedMetricDefinitions: AggregatedMetricDefinitions;
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
}

interface MetricCellContentProps {
  item: CapacityDataRow;
  metricData: TeamPeriodicMetrics | AggregatedPeriodicMetrics | undefined;
  metricDef: MetricDefinition;
  periodName: string;
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange'];
}

const MetricCellContent: React.FC<MetricCellContentProps> = React.memo(({
  item,
  metricData,
  metricDef,
  periodName,
  onTeamMetricChange,
}) => {
  if (!metricData) {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  }

  const rawValue = (metricData as any)[metricDef.key];

  if (item.itemType === 'Team' && metricDef.isEditableForTeam) {
    const teamName = item.name as TeamName;
    const lobId = item.lobId;

    if (!lobId) {
      console.error("Error in MetricCellContent: Missing LOB ID for team item:", item);
      return <span className="text-xs text-destructive">Error: Missing LOB ID</span>;
    }

    return (
      <Input
        type="number"
        value={rawValue === null || rawValue === undefined ? "" : String(rawValue)}
        onChange={(e) =>
            onTeamMetricChange(lobId, teamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, e.target.value)
        }
        onBlur={(e) => {
            const val = parseFloat(e.target.value);
            if (isNaN(val) && e.target.value !== "" && e.target.value !== "-") {
                 onTeamMetricChange(lobId, teamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, ""); 
            } else if (!isNaN(val)) {
                 onTeamMetricChange(lobId, teamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, String(val));
            } else if (e.target.value === "" && rawValue !== null && rawValue !== undefined) { 
                 onTeamMetricChange(lobId, teamName, periodName, metricDef.key as keyof TeamPeriodicMetrics, "");
            }
        }}
        className="h-8 w-full max-w-[100px] text-right tabular-nums px-1 py-0.5 text-xs bg-background border-input focus:border-primary focus:ring-1 focus:ring-primary"
        step={metricDef.step || "any"}
      />
    );
  }

  if (rawValue === null || rawValue === undefined) {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
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
      textColor = "text-primary"; // Using primary for surplus as per previous request
      icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
    }
    if (metricData && 'actualHC' in metricData && 'requiredHC' in metricData && typeof (metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).actualHC === 'number' && typeof (metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).requiredHC === 'number') {
      tooltipText = `${item.name} - ${periodName}\nOver/Under HC = Actual HC - Required HC\n${(metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).actualHC!.toFixed(2)} - ${(metricData as AggregatedPeriodicMetrics | TeamPeriodicMetrics).requiredHC!.toFixed(2)} = ${numValue.toFixed(2)}`;
    }
  }
  
  const cellContent = <span className={`flex items-center justify-end ${textColor}`}>{displayValue} {icon}</span>;

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
}

const MetricRow: React.FC<MetricRowProps> = React.memo(({ item, metricDef, level, periodHeaders, onTeamMetricChange }) => {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell
        className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2"
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem`, paddingRight: '1rem' }} 
      >
        <span>
          {metricDef.label}
          {item.itemType === 'Team' && metricDef.isEditableForTeam && <Edit3 className="h-3 w-3 inline-block ml-2 text-muted-foreground opacity-50" />}
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
        />
      );
    });
    return rows;
  }, [periodHeaders, teamMetricDefinitions, aggregatedMetricDefinitions, onTeamMetricChange]);


  const renderTableItem = useCallback((item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;
    const isExpandable = (item.children && item.children.length > 0) || item.itemType === 'Team';

    let rowSpecificBgClass = '';
    let buttonTextClass = 'text-foreground';

    if (item.itemType === 'BU') {
      rowSpecificBgClass = 'bg-secondary';
      buttonTextClass = 'text-secondary-foreground';
    } else if (item.itemType === 'LOB') {
      rowSpecificBgClass = 'bg-muted';
      buttonTextClass = 'text-muted-foreground';
    } else if (item.itemType === 'Team') { // For the Team header row itself
      rowSpecificBgClass = 'bg-muted/50';
      // buttonTextClass remains text-foreground or could be muted-foreground if preferred
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
            rowSpecificBgClass || 'bg-card' // Match row bg or default card bg for sticky cell
          )}
          style={{ 
            zIndex: item.itemType === 'Team' ? 25 : (item.itemType === 'LOB' ? 30 : 35),
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
            {!isExpandable && item.level === 0 && <span className="w-4 shrink-0"></span>} {/* Spacer for non-expandable top-level items */}
            {item.name}
          </button>
        </TableCell>
        {/* Placeholder cells for period headers in the name row */}
        {periodHeaders.map((ph) => (
             <TableCell 
                key={`${item.id}-${ph}-nameplaceholder`} 
                className={cn(
                    rowSpecificBgClass, // Also apply the bg to these cells for consistency
                    isExpandable ? 'py-3' : '' // Maintain py-3 if it was an expandable header row
                )}></TableCell>
        ))}
      </TableRow>
    );

    if (isExpanded) {
        if (item.itemType === 'Team') {
            const teamMetricRows = renderCapacityItemContent(item);
            rows.push(...teamMetricRows);
        } else if (item.children && item.children.length > 0) {
            const aggregatedMetricRows = renderCapacityItemContent(item);
            rows.push(...aggregatedMetricRows);
            item.children.forEach(child => {
                rows.push(...renderTableItem(child));
            });
        } else { 
            const itemMetricRows = renderCapacityItemContent(item);
            rows.push(...itemMetricRows);
        }
    } else if (!isExpandable && item.itemType !== 'Team') { 
        const itemMetricRows = renderCapacityItemContent(item);
        rows.push(...itemMetricRows);
    }
    return rows;
  }, [expandedItems, periodHeaders, toggleExpand, renderCapacityItemContent]);

  const getCategoryHeader = () => {
    if (data.length === 0) return 'Category / Metric';
    const firstItemType = data[0]?.itemType;
    if (firstItemType === 'BU') return 'BU / LoB / Team / Metric';
    if (firstItemType === 'LOB') return 'LoB / Team / Metric';
    if (firstItemType === 'Team') return 'Team / Metric';
    return 'Category / Metric';
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={scrollContainerRef} className="overflow-x-auto relative border border-border rounded-md shadow-md">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-40 bg-card">
            <TableRow>
              <TableHead className="sticky left-0 z-50 bg-card min-w-[320px] whitespace-nowrap shadow-sm px-4 py-2 align-middle">
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
export const CapacityTable = React.memo(CapacityTableComponent);
