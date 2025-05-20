
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
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { CapacityDataRow, MetricValues } from "./types";

interface CapacityTableProps {
  data: CapacityDataRow[];
  weekHeaders: string[];
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}

const MetricRow: React.FC<{
  label: string;
  level: number;
  weeklyData: Record<string, number | null>;
  weekHeaders: string[];
  isDifference?: boolean; // For Over/Under
  isPercentage?: boolean; // For Adherence
}> = ({ label, level, weeklyData, weekHeaders, isDifference, isPercentage }) => {
  return (
    <TableRow className="hover:bg-card-foreground/5">
      <TableCell
        className="sticky left-0 z-10 bg-card font-medium text-foreground whitespace-nowrap"
        style={{ paddingLeft: `${level * 1.5 + 1}rem` }}
      >
        {label}
      </TableCell>
      {weekHeaders.map((week) => {
        const value = weeklyData[week];
        let displayValue: React.ReactNode = <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
        let textColor = "text-foreground";
        let icon: React.ReactNode = null;

        if (value !== null && value !== undefined) {
          displayValue = isPercentage ? `${value.toFixed(1)}%` : value.toLocaleString();
          if (isDifference) {
            if (value < 0) {
              textColor = "text-destructive"; // Orange
              icon = <ArrowDown className="h-4 w-4 inline-block ml-1" />;
            } else if (value > 0) {
              textColor = "text-primary"; // Blue
              icon = <ArrowUp className="h-4 w-4 inline-block ml-1" />;
            }
          }
        }
        
        return (
          <TableCell key={week} className={`text-right ${textColor}`}>
            {displayValue} {icon}
          </TableCell>
        );
      })}
    </TableRow>
  );
};


const renderTableRows = (
  item: CapacityDataRow,
  weekHeaders: string[],
  expandedItems: Record<string, boolean>,
  toggleExpand: (id: string) => void
): React.ReactNode[] => {
  const rows: React.ReactNode[] = [];

  const metrics: Array<{key: keyof MetricValues, label: string}> = [
    { key: "required", label: "Required" },
    { key: "actual", label: "Actual" },
  ];

  // Add top-level item's own metrics (if it's not just a container)
  if (Object.keys(item.weeklyData).length > 0) {
     metrics.forEach(metric => {
        const metricData = Object.fromEntries(
            weekHeaders.map(week => [week, item.weeklyData[week]?.[metric.key] ?? null])
        );
        rows.push(
            <MetricRow
            key={`${item.id}-${metric.key}`}
            label={metric.label}
            level={item.level + 1} // Metrics are indented under the item name
            weeklyData={metricData}
            weekHeaders={weekHeaders}
            />
        );
    });
    
    // Calculated Metrics: Over/Under and Adherence
    const overUnderData: Record<string, number | null> = {};
    const adherenceData: Record<string, number | null> = {};

    weekHeaders.forEach(week => {
        const required = item.weeklyData[week]?.required;
        const actual = item.weeklyData[week]?.actual;
        if (required !== null && actual !== null && required !== undefined && actual !== undefined) {
            overUnderData[week] = actual - required;
            adherenceData[week] = required !== 0 ? (actual / required) * 100 : null;
        } else {
            overUnderData[week] = null;
            adherenceData[week] = null;
        }
    });

    rows.push(
        <MetricRow
            key={`${item.id}-overUnder`}
            label="Over/Under"
            level={item.level + 1}
            weeklyData={overUnderData}
            weekHeaders={weekHeaders}
            isDifference
        />
    );
    rows.push(
        <MetricRow
            key={`${item.id}-adherence`}
            label="Adherence"
            level={item.level + 1}
            weeklyData={adherenceData}
            weekHeaders={weekHeaders}
            isPercentage
        />
    );
  }


  // If item has children, they are rendered within an AccordionContent
  if (item.children && item.children.length > 0) {
    const childRows = item.children.flatMap(child => 
        renderTableRows(child, weekHeaders, expandedItems, toggleExpand)
    );
    // These child rows are already full TableRow elements, so they go directly into the body
    // The AccordionItem wraps the group.
    rows.push(...childRows);
  }

  return rows;
};


export function CapacityTable({ data, weekHeaders, expandedItems, toggleExpand }: CapacityTableProps) {
  
  const renderAccordionItem = (item: CapacityDataRow): React.ReactNode => {
    const itemMetricsRows = renderTableRows(item, weekHeaders, expandedItems, toggleExpand);

    if (item.children && item.children.length > 0) {
      // This item is an expandable category (like INVENTORY MANAGEMENT or Inhouse BPO)
      return (
        <AccordionItem value={item.id} key={item.id} className="border-b-0">
           <TableRow className="bg-card-foreground/5 hover:bg-card-foreground/10">
            <TableCell 
              colSpan={weekHeaders.length + 1} 
              className="p-0 sticky left-0 z-10 bg-card"
            >
              <AccordionTrigger 
                className="py-3 px-4 font-semibold text-foreground hover:no-underline w-full text-left"
                style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
                onClick={() => toggleExpand(item.id)}
              >
                {item.name}
              </AccordionTrigger>
            </TableCell>
          </TableRow>
          {expandedItems[item.id] && ( // Conditionally render content based on expanded state
            <AccordionContent className="p-0">
              {item.children.map(child => renderAccordionItem(child))}
            </AccordionContent>
          )}
        </AccordionItem>
      );
    } else {
      // This item is a leaf node or a top-level item without children to expand (like "Selected LoB's Total")
      // Or it's a child under an accordion that's not itself an accordion trigger
      return (
        <React.Fragment key={item.id}>
          <TableRow className="bg-card-foreground/5 hover:bg-card-foreground/10">
            <TableCell 
              className="sticky left-0 z-10 bg-card font-semibold text-foreground whitespace-nowrap"
              style={{ paddingLeft: `${item.level * 1.5 + 1}rem` }}
            >
              {item.name}
            </TableCell>
            {/* Placeholder cells for non-metric headers if needed, or leave empty */}
            {weekHeaders.map(week => <TableCell key={`${item.id}-${week}-ph`}></TableCell>)}
          </TableRow>
          {itemMetricsRows}
        </React.Fragment>
      );
    }
  };


  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader className="sticky top-0 z-20 bg-card">
          <TableRow>
            <TableHead className="sticky left-0 z-30 bg-card min-w-[250px] whitespace-nowrap">
              Category / Metric
            </TableHead>
            {weekHeaders.map((week) => (
              <TableHead key={week} className="text-right min-w-[150px] whitespace-nowrap">
                {week}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <Accordion type="multiple" className="w-full" value={Object.keys(expandedItems).filter(key => expandedItems[key])}>
            {data.map(item => renderAccordionItem(item))}
          </Accordion>
        </TableBody>
      </Table>
    </div>
  );
}
