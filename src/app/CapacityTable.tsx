typescriptreact
import React, { useMemo, useState, useEffect } from "react";
import { format, addDays, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { Minus, ChevronRight, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils"; // Assuming cn is a utility for classnames
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as types from "./types"; // Assuming types were extracted to types.ts
import * as utils from "./utils"; // Assuming utils were extracted to utils.ts


interface CapacityTableComponentProps {
  data: types.CapacityDataRow[];
  periodHeaders: string[];
  metrics: types.MetricDefinition[];
  startDate: Date | undefined;
  endDate: Date | undefined;
  rawCapacityDataSource: types.CapacityDataSource[];
}

export const CapacityTableComponent: React.FC<CapacityTableComponentProps> = ({
  data,
  periodHeaders,
  metrics,
  startDate,
  endDate,
  rawCapacityDataSource,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  };

  const getVisibleData = (
    items: types.CapacityDataRow[],
    expanded: Set<string>
  ): types.CapacityDataRow[] => {
    const visible: types.CapacityDataRow[] = [];
    const processItem = (item: types.CapacityDataRow) => {
      visible.push(item);
      if (expanded.has(item.id) && item.children) {
        item.children.forEach(processItem);
      }
    };

    items.forEach(processItem);
    return visible;
  };

  const visibleData = useMemo(() => getVisibleData(data, expandedItems), [
    data,
    expandedItems,
  ]);

  const renderMetricValue = (
    item: types.CapacityDataRow,
    metricDef: types.MetricDefinition,
    periodHeader: string
  ) => {
    const periodicData = item.periodicData?.[periodHeader];
    const value = periodicData?.[metricDef.key] as types.MetricValue | undefined;

    if (value === undefined || value === null) {
       if (item.itemType === 'BU' && metricDef.key === 'lobTotalBaseRequiredMinutes') {
         const totalLobMinutes = rawCapacityDataSource
           .filter(sourceItem => sourceItem.parent_id === item.id && sourceItem.itemType === 'LOB')
           .reduce((sum, lob) => {
             const lobPeriodicData = lob.periodicData?.[periodHeader];
             const lobValue = lobPeriodicData?.[metricDef.key] as number | undefined;
             return sum + (lobValue || 0);
           }, 0);

            let displayValue: string | number = totalLobMinutes;
             let tooltipContent = `${totalLobMinutes.toFixed(2)} mins`; // Default tooltip

             if (totalLobMinutes >= 60) {
                 const hours = totalLobMinutes / 60;
                 displayValue = `${hours.toFixed(1)} hrs`;
                  tooltipContent = `${totalLobMinutes.toFixed(2)} mins (${hours.toFixed(1)} hrs)`;

                 if (hours >= 24) {
                     const days = hours / 24;
                     displayValue = `${days.toFixed(1)} days`;
                      tooltipContent = `${totalLobMinutes.toFixed(2)} mins (${hours.toFixed(1)} hrs, ${days.toFixed(1)} days)`;
                 }
             } else {
                 displayValue = `${totalLobMinutes.toFixed(1)} mins`;
             }


           return (
                 <TooltipProvider>
                     <Tooltip>
                         <TooltipTrigger asChild>
                              <div className="w-full h-full flex items-center justify-end pr-1">
                                 {displayValue}
                              </div>
                         </TooltipTrigger>
                          <TooltipContent>
                             <p>{tooltipContent}</p>
                         </TooltipContent>
                     </Tooltip>
                 </TooltipProvider>
            );


       }


       const canEdit = item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly;

      return <div onClick={canEdit ? handleEditClick : undefined} className={`${canEdit ? 'cursor-pointer' : ''} w-full h-full flex items-center justify-end pr-1`}><Minus className="h-4 w-4 text-muted-foreground mx-auto" /></div>;
    }

    const rawValue = value.value;
    const displayValue = value.displayValue;
    const baseTooltipText = value.tooltip;
    const formulaText = value.formula;
    const textColor = value.textColor; // Assuming textColor is a string like 'blue' or 'coral'

     let tooltipContent = baseTooltipText;


    const canEdit = (item.itemType === 'Team' && metricDef.isEditableForTeam && !metricDef.isDisplayOnly) ||
                    (item.itemType === 'LOB' && metricDef.key === 'lobTotalBaseRequiredMinutes' && (item.parent_id && rawCapacityDataSource.find(bu => bu.id === item.parent_id)?.itemType === 'BU')) ||
                     ((item.itemType === 'BU' || item.itemType === 'LOB') && metricDef.isEditableForAggregated) ||
                     ((item.itemType === 'BU' || item.itemType === 'LOB') && utils.isAggregatedMetric(metricDef, metrics));


     const handleEditClick = () => {
         // Handle edit click logic
     };


    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        onClick={canEdit ? handleEditClick : undefined}
                        className={cn(
                            "w-full h-full flex items-center justify-end pr-1",
                            canEdit ? "cursor-pointer" : ""
                        )}
                         style={{ color: metricDef.key === 'overUnderHC' ? textColor : undefined }}
                    >
                        {displayValue}
                    </div>
                </TooltipTrigger>
                 <TooltipContent>
                    <p>{tooltipContent}</p>
                 </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
  };

  const renderRow = (item: types.CapacityDataRow, level: number) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

     let rowClass = 'bg-team-row'; // Default

      if (item.itemType === 'BU') {
          rowClass = 'bg-bu-row';
      } else if (item.itemType === 'LOB') {
          rowClass = 'bg-lob-row';
      } else if (item.itemType === 'Assumption') {
           rowClass = 'bg-assumption-row';
      } else if (item.itemType === 'HC Adjustment') {
           rowClass = 'bg-hc-adjustment-row';
      }


    return (
      <TableRow key={item.id} className={cn("group", rowClass)}>
        <TableCell
            className="sticky left-0 z-20 bg-card font-normal text-foreground whitespace-nowrap py-2 w-[200px]"
             style={{ paddingRight: '1rem' }}
        >
             <div style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }} className="w-full max-w-full overflow-hidden flex items-center">
                {hasChildren && (
                    <button
                        onClick={() => toggleExpand(item.id)}
                        className="mr-1 p-0.5 rounded hover:bg-muted"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                )}
                 <TooltipProvider>
                     <Tooltip>
                         <TooltipTrigger asChild>
                              <span>{item.name}</span>
                         </TooltipTrigger>
                          <TooltipContent>
                             <p>{item.description}</p>
                         </TooltipContent>
                     </Tooltip>
                 </TooltipProvider>

             </div>
        </TableCell>
        {metrics.map((metricDef) => (
          <TableCell key={metricDef.key} className="text-right pr-1">
            {renderMetricValue(item, metricDef, "Total")}
          </TableCell>
        ))}
        {periodHeaders.map((periodHeader) => (
          <TableCell key={periodHeader} className="text-right pr-1">
            {renderMetricValue(item, metricDef, periodHeader)}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 z-30 bg-card shadow-sm">
          <TableRow>
            <TableHead className="w-[200px] sticky left-0 z-30 bg-card">Item</TableHead>
            {metrics.map((metricDef) => (
              <TableHead key={metricDef.key} className="text-right pr-1 w-[100px]">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <div>{metricDef.name}</div>
                        </TooltipTrigger>
                         <TooltipContent>
                            <p>{metricDef.description}</p>
                         </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

              </TableHead>
            ))}
            {periodHeaders.map((header) => (
              <TableHead key={header} className="text-right pr-1 w-[100px]">
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                              <div>{header}</div>
                        </TooltipTrigger>
                         <TooltipContent>
                            <p>Data for the period ending {header}</p> {/* Example tooltip for period */}
                         </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleData.map((item) => renderRow(item, item.level))}
        </TableBody>
      </Table>
    </div>
  );
};