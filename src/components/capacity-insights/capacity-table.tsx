
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
import { ArrowDown, ArrowUp, Minus, ChevronDown } from "lucide-react"; // Added ChevronDown
import type { CapacityDataRow, CalculatedMetricValues } from "./types";
import { DYNAMIC_SUM_COLUMN_KEY } from "./types";

interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[]; // e.g., ["Wk23: 06/04-06/10", ..., "Month Sum"]
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  dynamicSumKey: string;
}

const MetricCellContent: React.FC<{
  metricData: CalculatedMetricValues | undefined;
  metricType: keyof CalculatedMetricValues;
  itemName: string; 
  periodName: string;
}> = ({ metricData, metricType, itemName, periodName }) => {
  if (!metricData) {
    return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  }

  let value: number | null = null;
  let displayValue: React.ReactNode = <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  let textColor = "text-foreground";
  let icon: React.ReactNode = null;
  let tooltipText = "";

  const { required, actual, overUnder, adherence } = metricData;

  switch (metricType) {
    case "required":
      value = required;
      if (value !== null) {
        displayValue = value.toLocaleString();
        tooltipText = `${itemName} - ${periodName}\nRequired: ${value.toLocaleString()} agent-minutes`;
      }
      break;
    case "actual":
      value = actual;
      if (value !== null) {
        displayValue = value.toLocaleString();
        tooltipText = `${itemName} - ${periodName}\nActual: ${value.toLocaleString()} agent-minutes`;
      }
      break;
    case "overUnder":
      value = overUnder;
      if (value !== null) {
        displayValue = value.toLocaleString();
        if (value < 0) {
          textColor = "text-destructive"; // This will be overridden by MetricRow's direct class
          icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
        } else if (value > 0) {
          textColor = "text-primary"; // This will be overridden by MetricRow's direct class
          icon = <ArrowUp className="h-3 w-3 inline-block ml-1" />;
        }
        tooltipText = `${itemName} - ${periodName}\nOver/Under = Actual - Required\n${actual?.toLocaleString()} - ${required?.toLocaleString()} = ${value.toLocaleString()}`;
      }
      break;
    case "adherence":
      value = adherence;
      if (value !== null) {
        displayValue = `${value.toFixed(1)}%`;
        tooltipText = `${itemName} - ${periodName}\nAdherence = (Actual / Required) * 100%\n(${actual?.toLocaleString()} / ${required?.toLocaleString()}) * 100 = ${value.toFixed(1)}%`;
      }
      break;
  }

  const cellContent = <span className={`flex items-center justify-end ${textColor}`}>{displayValue} {icon}</span>;

  if (tooltipText && value !== null) {
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


const MetricRow: React.FC<{
  label: string;
  metricType: keyof CalculatedMetricValues;
  level: number;
  periodicData: Record<string, CalculatedMetricValues>;
  periodHeaders: string[];
  itemName: string;
  isSumColumn: (periodHeader: string) => boolean;
}> = ({ label, metricType, level, periodicData, periodHeaders, itemName, isSumColumn }) => {
  return (
    <TableRow className="hover:bg-card-foreground/5">
      <TableCell
        className="sticky left-0 z-10 bg-card font-normal text-foreground whitespace-nowrap"
        style={{ paddingLeft: `${level * 1.5 + 1}rem` }}
      >
        {label}
      </TableCell>
      {periodHeaders.map((periodHeader) => {
        const metricForPeriod = periodicData[periodHeader];
        let cellTextColor = "text-foreground";
        if (metricType === "overUnder" && metricForPeriod?.overUnder !== null && metricForPeriod?.overUnder !== undefined) {
            if (metricForPeriod.overUnder < 0) cellTextColor = "text-destructive";
            else if (metricForPeriod.overUnder > 0) cellTextColor = "text-primary";
        }
        
        return (
          <TableCell 
            key={`${itemName}-${label}-${periodHeader}`} 
            className={`text-right tabular-nums ${cellTextColor} ${isSumColumn(periodHeader) ? 'font-semibold bg-muted/30' : ''}`}
          >
            <MetricCellContent metricData={metricForPeriod} metricType={metricType} itemName={itemName} periodName={periodHeader} />
          </TableCell>
        );
      })}
    </TableRow>
  );
};

const renderCapacityItemContent = (
  item: CapacityDataRow,
  periodHeaders: string[],
  isSumColumn: (ph: string) => boolean
): React.ReactNode[] => {
  const rows: React.ReactNode[] = [];
  const metricDefinitions: Array<{ key: keyof CalculatedMetricValues; label: string }> = [
    { key: "required", label: "Required" },
    { key: "actual", label: "Actual" },
    { key: "overUnder", label: "Over/Under" },
    { key: "adherence", label: "Adherence (%)" },
  ];

  metricDefinitions.forEach(metricDef => {
    rows.push(
      <MetricRow
        key={`${item.id}-${metricDef.key}`}
        label={metricDef.label}
        metricType={metricDef.key}
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


export function CapacityTable({ data, periodHeaders, expandedItems, toggleExpand, dynamicSumKey }: CapacityTableProps) {
  
  const isSumColumn = (periodHeader: string) => periodHeader === dynamicSumKey || periodHeader.includes("Total");

  const renderTableItem = (item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;

    // Row for the item itself (category name or leaf node name)
    rows.push(
      <TableRow 
        key={`${item.id}-name`} 
        className={`${(item.children && item.children.length > 0) ? 'bg-card-foreground/5 hover:bg-card-foreground/10' : 'hover:bg-card-foreground/5'}`}
      >
        {item.children && item.children.length > 0 ? (
          // Expandable Category Header Row
          <TableCell 
            colSpan={1} // Only spans the first cell for the trigger
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
          // Leaf Node Name Cell
          <TableCell 
            className="sticky left-0 z-10 bg-card font-semibold text-foreground whitespace-nowrap"
            style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
          >
            {item.name}
          </TableCell>
        )}
        {/* Placeholder/Data cells for the rest of the header row columns */}
        {periodHeaders.map((ph, index) => {
          // For expandable category headers, cells after the first should be empty or styled as part of the header
          // For leaf nodes, these would be the data cells if metrics were on the same line, but they are on separate MetricRows. So, empty.
           if (item.children && item.children.length > 0 && index === 0) { // Already handled by colSpan logic for the first cell
             return null;
           }
            const isHeaderSumCol = isSumColumn(ph);
            // For category header rows, render empty cells.
            // For leaf name rows, also render empty cells as metrics are on sub-rows.
             return (
                <TableCell key={`${item.id}-${ph}-headerplaceholder`} className={`${isHeaderSumCol ? 'font-semibold bg-muted/30' : ''} ${ (item.children && item.children.length > 0) ? 'py-3' : ''}`}></TableCell>
             );
        })}
      </TableRow>
    );

    // If it's a leaf node OR an expanded category, render its metric rows
    if (!item.children || item.children.length === 0 || isExpanded) {
      const itemMetricRows = renderCapacityItemContent(item, periodHeaders, isSumColumn);
      rows.push(...itemMetricRows);
    }

    // If it's an expanded category, recursively render its children
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
                Category / Metric
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

