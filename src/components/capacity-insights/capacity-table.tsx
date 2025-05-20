
"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, Minus, ChevronDown } from "lucide-react";
import type { 
    CapacityDataRow, 
    TeamPeriodicMetrics, 
    AggregatedPeriodicMetrics,
    MetricDefinition,
    TeamMetricDefinitions,
    AggregatedMetricDefinitions
} from "./types";
import { DYNAMIC_SUM_COLUMN_KEY } from "./types";

interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[]; 
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  dynamicSumKey: string;
  teamMetricDefinitions: TeamMetricDefinitions;
  aggregatedMetricDefinitions: AggregatedMetricDefinitions;
}

interface MetricCellContentProps {
  metricData: TeamPeriodicMetrics | AggregatedPeriodicMetrics | undefined;
  metricDef: MetricDefinition;
  itemName: string;
  periodName: string;
}

const MetricCellContent: React.FC<MetricCellContentProps> = ({
  metricData,
  metricDef,
  itemName,
  periodName,
}) => {
  if (!metricData) {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  }

  // Cast metricData to 'any' for dynamic key access, or ensure metricKey is valid for the type.
  const rawValue = (metricData as any)[metricDef.key];


  if (rawValue === null || rawValue === undefined) {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  }

  let displayValue: React.ReactNode = "";
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let tooltipText = `${itemName} - ${periodName}\n${metricDef.label}: `;

  const numValue = Number(rawValue);

  if (metricDef.isPercentage) {
    displayValue = `${numValue.toFixed(1)}%`;
  } else if (metricDef.isTime) {
    displayValue = `${numValue.toFixed(1)} min`;
  } else if (metricDef.isHC) {
    displayValue = numValue.toFixed(2);
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
     // For non-percentage, non-time, non-HC numbers (like required, actual, over/under agent minutes, moveIn, moveOut)
    displayValue = numValue.toLocaleString(undefined, {maximumFractionDigits: metricDef.key === "overUnder" || metricDef.key === "required" || metricDef.key === "actual" ? 0 : 1});
  } else {
    displayValue = String(rawValue); // Fallback for other types
  }
  
  tooltipText += displayValue;


  if (metricDef.key === "overUnder" || metricDef.key === "overUnderHC") {
    if (numValue < 0) {
      textColor = "text-destructive";
      icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
    } else if (numValue > 0) {
      textColor = "text-primary";
      icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
    }
    if (metricDef.key === "overUnder" && 'actual' in metricData && 'required' in metricData ) {
      const md = metricData as AggregatedPeriodicMetrics;
      tooltipText = `${itemName} - ${periodName}\nOver/Under = Actual - Required\n${md.actual?.toLocaleString()} - ${md.required?.toLocaleString()} = ${numValue.toLocaleString()}`;
    } else if (metricDef.key === "overUnderHC" && 'actualHC' in metricData && 'requiredHC' in metricData) {
      const md = metricData as TeamPeriodicMetrics; // or AggregatedPeriodicMetrics if it has HC
      tooltipText = `${itemName} - ${periodName}\nOver/Under HC = Actual HC - Required HC\n${md.actualHC?.toFixed(2)} - ${md.requiredHC?.toFixed(2)} = ${numValue.toFixed(2)}`;
    }
  } else if (metricDef.key === "adherence" && 'actual' in metricData && 'required' in metricData) {
    const md = metricData as AggregatedPeriodicMetrics;
    tooltipText = `${itemName} - ${periodName}\nAdherence = (Actual / Required) * 100%\n(${md.actual?.toLocaleString()} / ${md.required?.toLocaleString()}) * 100 = ${numValue.toFixed(1)}%`;
  }

  const cellContent = <span className={`flex items-center justify-end ${textColor}`}>{displayValue} {icon}</span>;

  if (tooltipText && (rawValue !== null && rawValue !== undefined)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {cellContent}
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-wrap text-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return cellContent;
};

interface MetricRowProps {
  metricDef: MetricDefinition;
  level: number;
  periodicData: Record<string, TeamPeriodicMetrics | AggregatedPeriodicMetrics>;
  periodHeaders: string[];
  itemName: string;
  isSumColumn: (periodHeader: string) => boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ metricDef, level, periodicData, periodHeaders, itemName, isSumColumn }) => {
  return (
    <TableRow className="hover:bg-card-foreground/5">
      <TableCell
        className="sticky left-0 z-10 bg-card font-normal text-foreground whitespace-nowrap"
        style={{ paddingLeft: `${level * 1.5 + 1}rem` }}
      >
        {metricDef.label}
      </TableCell>
      {periodHeaders.map((periodHeader) => {
        const metricForPeriod = periodicData[periodHeader];
        let cellTextColor = "text-foreground";
        if ((metricDef.key === "overUnder" || metricDef.key === "overUnderHC") && metricForPeriod && (metricForPeriod as any)[metricDef.key] !== null && (metricForPeriod as any)[metricDef.key] !== undefined) {
            const value = Number((metricForPeriod as any)[metricDef.key]);
            if (value < 0) cellTextColor = "text-destructive";
            else if (value > 0) cellTextColor = "text-primary";
        }
        
        return (
          <TableCell 
            key={`${itemName}-${metricDef.key}-${periodHeader}`} 
            className={`text-right tabular-nums ${cellTextColor} ${isSumColumn(periodHeader) ? 'font-semibold bg-muted/30' : ''}`}
          >
            <MetricCellContent 
                metricData={metricForPeriod} 
                metricDef={metricDef} 
                itemName={itemName} 
                periodName={periodHeader} 
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
};

const renderCapacityItemContent = (
  item: CapacityDataRow,
  periodHeaders: string[],
  isSumColumn: (ph: string) => boolean,
  teamMetricDefs: TeamMetricDefinitions,
  aggregatedMetricDefs: AggregatedMetricDefinitions
): React.ReactNode[] => {
  const rows: React.ReactNode[] = [];
  
  let metricDefinitionsToUse: MetricDefinition[];

  if (item.itemType === 'Team') {
    metricDefinitionsToUse = teamMetricDefs;
  } else { // BU or LOB
    metricDefinitionsToUse = aggregatedMetricDefs;
  }

  metricDefinitionsToUse.forEach(metricDef => {
    rows.push(
      <MetricRow
        key={`${item.id}-${metricDef.key}`}
        metricDef={metricDef}
        level={item.level + 1} 
        periodicData={item.periodicData}
        periodHeaders={periodHeaders}
        itemName={item.name}
        isSumColumn={isSumColumn}
      />
    );
  });
  return rows;
};


export function CapacityTable({ 
    data, 
    periodHeaders, 
    expandedItems, 
    toggleExpand, 
    dynamicSumKey,
    teamMetricDefinitions,
    aggregatedMetricDefinitions 
}: CapacityTableProps) {
  
  const isSumColumn = (periodHeader: string) => periodHeader === dynamicSumKey || periodHeader.includes("Total");

  const renderTableItem = (item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;

    rows.push(
      <TableRow 
        key={`${item.id}-name`} 
        className={`${(item.children && item.children.length > 0) ? 'bg-card-foreground/5 hover:bg-card-foreground/10' : 'hover:bg-card-foreground/5'}`}
      >
        {(item.children && item.children.length > 0) ? (
          <TableCell 
            colSpan={1} 
            className="p-0 sticky left-0 z-20 bg-card whitespace-nowrap"
          >
            <button
              onClick={() => toggleExpand(item.id)}
              className="py-3 px-4 font-semibold text-foreground hover:no-underline w-full text-left flex items-center justify-between"
              style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
              aria-expanded={isExpanded}
            >
              {item.name}
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            </button>
          </TableCell>
        ) : (
          <TableCell 
            className="sticky left-0 z-10 bg-card font-semibold text-foreground whitespace-nowrap"
            style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
          >
            {item.name}
          </TableCell>
        )}
        {periodHeaders.map((ph, index) => {
           if (item.children && item.children.length > 0 && index === 0) { 
             return null;
           }
            const isHeaderSumCol = isSumColumn(ph);
             return (
                <TableCell key={`${item.id}-${ph}-headerplaceholder`} className={`${isHeaderSumCol ? 'font-semibold bg-muted/30' : ''} ${ (item.children && item.children.length > 0) ? 'py-3' : ''}`}></TableCell>
             );
        })}
      </TableRow>
    );

    if (isExpanded || !item.children || item.children.length === 0) {
        const itemMetricRows = renderCapacityItemContent(item, periodHeaders, isSumColumn, teamMetricDefinitions, aggregatedMetricDefinitions);
        rows.push(...itemMetricRows);
    }

    if (item.children && item.children.length > 0 && isExpanded) {
      item.children.forEach(child => {
        rows.push(...renderTableItem(child)); 
      });
    }
    
    return rows;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="overflow-x-auto relative border border-border rounded-md shadow-md">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-40 bg-card"> 
            <TableRow>
              <TableHead className="sticky left-0 z-50 bg-card min-w-[280px] whitespace-nowrap shadow-sm">
                {data.length > 0 && data[0].itemType === 'LOB' && data[0].level === 0 ? 'LoB / Metric' : 'Category / Metric'}
              </TableHead>
              {periodHeaders.map((period) => (
                <TableHead 
                  key={period} 
                  className={`text-right min-w-[150px] whitespace-nowrap ${isSumColumn(period) ? 'font-bold bg-muted/50 sticky right-0 z-30 shadow-sm' : ''}`}
                  style={isSumColumn(period) ? { right: 0 } : {}} 
                >
                  {period.replace(DYNAMIC_SUM_COLUMN_KEY, "Summary")}
                </TableHead>
              ))}
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
}

    