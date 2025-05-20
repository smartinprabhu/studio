
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
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
  itemName: string; // For tooltip context, e.g. "US Chat"
  periodName: string; // For tooltip context, e.g. "Wk23: 06/04-06/10"
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
          textColor = "text-destructive";
          icon = <ArrowDown className="h-3 w-3 inline-block ml-1" />;
        } else if (value > 0) {
          textColor = "text-primary";
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

  const cellContent = <span className="flex items-center justify-end">{displayValue} {icon}</span>;

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
  periodicData: Record<string, CalculatedMetricValues>; // Keyed by periodHeader
  periodHeaders: string[];
  itemName: string; // For tooltip context, e.g. "US Chat"
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
        let textColor = "text-foreground";
        if (metricType === "overUnder" && metricForPeriod?.overUnder !== null) {
            if (metricForPeriod.overUnder! < 0) textColor = "text-destructive";
            else if (metricForPeriod.overUnder! > 0) textColor = "text-primary";
        }
        
        return (
          <TableCell 
            key={`${itemName}-${label}-${periodHeader}`} 
            className={`text-right tabular-nums ${textColor} ${isSumColumn(periodHeader) ? 'font-semibold bg-muted/30' : ''}`}
          >
            <MetricCellContent metricData={metricForPeriod} metricType={metricType} itemName={itemName} periodName={periodHeader} />
          </TableCell>
        );
      })}
    </TableRow>
  );
};

// Main function to render rows for a CapacityDataRow item
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

  // Add item's own metrics
  metricDefinitions.forEach(metricDef => {
    rows.push(
      <MetricRow
        key={`${item.id}-${metricDef.key}`}
        label={metricDef.label}
        metricType={metricDef.key}
        level={item.level + 1} // Metrics are indented under the item name
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
  
  const isSumColumn = (periodHeader: string) => periodHeader.includes("Total"); // Or use dynamicSumKey

  const renderTableItem = (item: CapacityDataRow): React.ReactNode => {
    const itemMetricRows = renderCapacityItemContent(item, periodHeaders, isSumColumn);

    if (item.children && item.children.length > 0) {
      // This item is an expandable category
      return (
        <AccordionItem value={item.id} key={item.id} className="border-b-0">
           <TableRow className="bg-card-foreground/5 hover:bg-card-foreground/10 ">
            <TableCell 
              colSpan={periodHeaders.length + 1} 
              className="p-0 sticky left-0 z-20 bg-card" // Increased z-index
            >
              <AccordionTrigger 
                className="py-3 px-4 font-semibold text-foreground hover:no-underline w-full text-left data-[state=open]:bg-primary/10"
                style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
                onClick={() => toggleExpand(item.id)}
              >
                {item.name}
              </AccordionTrigger>
            </TableCell>
          </TableRow>
          {expandedItems[item.id] && (
            <AccordionContent className="p-0">
              {/* Render children's metric rows directly if they are leaf nodes, or recursively call renderTableItem */}
              {item.children.map(child => 
                (child.children && child.children.length > 0) 
                  ? renderTableItem(child) // Child is also an accordion
                  : ( // Child is a leaf node, render its name and metrics
                    <React.Fragment key={child.id}>
                      <TableRow className="hover:bg-card-foreground/5">
                        <TableCell 
                          className="sticky left-0 z-10 bg-card font-medium text-foreground whitespace-nowrap"
                          style={{ paddingLeft: `${child.level * 1.5 + 1}rem` }}
                        >
                          {child.name}
                        </TableCell>
                         {/* Placeholder cells for alignment under period headers */}
                        {periodHeaders.map(ph => <TableCell key={`${child.id}-${ph}-ph`} className={isSumColumn(ph) ? 'bg-muted/30' : ''}></TableCell>)}
                      </TableRow>
                      {renderCapacityItemContent(child, periodHeaders, isSumColumn)}
                    </React.Fragment>
                  )
              )}
            </AccordionContent>
          )}
        </AccordionItem>
      );
    } else {
      // This item is a leaf node (not expandable itself)
      return (
        <React.Fragment key={item.id}>
          <TableRow className="bg-card-foreground/5 hover:bg-card-foreground/10">
            <TableCell 
              className="sticky left-0 z-10 bg-card font-semibold text-foreground whitespace-nowrap"
              style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
            >
              {item.name}
            </TableCell>
            {/* Placeholder cells for alignment under period headers */}
            {periodHeaders.map(ph => <TableCell key={`${item.id}-${ph}-ph`} className={isSumColumn(ph) ? 'bg-muted/30' : ''}></TableCell>)}
          </TableRow>
          {itemMetricRows}
        </React.Fragment>
      );
    }
  };

  const tableWrapperRef = React.useRef<HTMLDivElement>(null);

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={tableWrapperRef} className="overflow-x-auto relative border border-border rounded-md shadow-md">
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
                  style={isSumColumn(period) ? { right: 0 } : {}} // Ensure sum column is sticky if it's the last
                >
                  {period.replace(DYNAMIC_SUM_COLUMN_KEY, "Summary")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              <Accordion 
                type="multiple" 
                className="w-full" 
                value={Object.keys(expandedItems).filter(key => expandedItems[key])}
                // onValueChange={(values) => { /* Optionally handle accordion changes here if needed */ }}
              >
                {data.map(item => renderTableItem(item))}
              </Accordion>
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
