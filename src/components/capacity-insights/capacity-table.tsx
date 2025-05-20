
"use client";

import React, { useEffect, useRef } from "react";
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

interface CapacityTableProps {
  data: CapacityDataRow[];
  periodHeaders: string[]; 
  expandedItems: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  teamMetricDefinitions: TeamMetricDefinitions;
  aggregatedMetricDefinitions: AggregatedMetricDefinitions;
  onTeamMetricChange: (lobId: string, teamName: TeamName, periodHeader: string, metricKey: keyof TeamPeriodicMetrics, newValue: string) => void;
  onVisiblePeriodsChange: (firstVisible: string | null, lastVisible: string | null) => void;
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
            } else if (e.target.value === "" && rawValue !== null) { 
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
  } else if (metricDef.isHC || metricDef.key === 'moveIn' || metricDef.key === 'moveOut' || metricDef.key === 'newHireBatch' || metricDef.key === 'newHireProduction') {
    displayValue = numValue.toFixed(metricDef.key === 'moveIn' || metricDef.key === 'moveOut' || metricDef.key === 'newHireBatch' || metricDef.key === 'newHireProduction' ? 0 : 2);
  } else if (typeof numValue === 'number' && !isNaN(numValue)) {
    const fractionDigits = (metricDef.key === "overUnder" || metricDef.key === "required" || metricDef.key === "actual") ? 0 : 1;
    displayValue = numValue.toLocaleString(undefined, {minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits});
  } else {
    displayValue = String(rawValue); 
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
     if (metricDef.key === "overUnder" && metricData && 'actual' in metricData && 'required' in metricData && typeof (metricData as AggregatedPeriodicMetrics).actual === 'number' && typeof (metricData as AggregatedPeriodicMetrics).required === 'number') {
      tooltipText = `${item.name} - ${periodName}\nOver/Under (Mins) = Actual - Required\n${(metricData as AggregatedPeriodicMetrics).actual!.toLocaleString(undefined, {maximumFractionDigits:0})} - ${(metricData as AggregatedPeriodicMetrics).required!.toLocaleString(undefined, {maximumFractionDigits:0})} = ${numValue.toLocaleString(undefined, {maximumFractionDigits:0})}`;
    } else if (metricDef.key === "overUnderHC" && metricData && 'actualHC' in metricData && 'requiredHC' in metricData && typeof (metricData as TeamPeriodicMetrics | AggregatedPeriodicMetrics).actualHC === 'number' && typeof (metricData as TeamPeriodicMetrics | AggregatedPeriodicMetrics).requiredHC === 'number') {
      tooltipText = `${item.name} - ${periodName}\nOver/Under HC = Actual HC - Required HC\n${(metricData as TeamPeriodicMetrics | AggregatedPeriodicMetrics).actualHC!.toFixed(2)} - ${(metricData as TeamPeriodicMetrics | AggregatedPeriodicMetrics).requiredHC!.toFixed(2)} = ${numValue.toFixed(2)}`;
    }
  } else if (metricDef.key === "adherence" && metricData && 'actual' in metricData && 'required' in metricData && typeof (metricData as AggregatedPeriodicMetrics).actual === 'number' && typeof (metricData as AggregatedPeriodicMetrics).required === 'number' && (metricData as AggregatedPeriodicMetrics).required !== 0) {
    tooltipText = `${item.name} - ${periodName}\nAdherence = (Actual Mins / Required Mins) * 100%\n(${(metricData as AggregatedPeriodicMetrics).actual!.toLocaleString(undefined, {maximumFractionDigits:0})} / ${(metricData as AggregatedPeriodicMetrics).required!.toLocaleString(undefined, {maximumFractionDigits:0})}) * 100 = ${numValue.toFixed(1)}%`;
  } else if (metricDef.key === "adherence" && metricData && (metricData as AggregatedPeriodicMetrics).required === 0) {
     tooltipText = `${item.name} - ${periodName}\nAdherence: N/A (Required Mins is 0)`;
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
    <TableRow className="hover:bg-card-foreground/5">
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
        if ((metricDef.key === "overUnder" || metricDef.key === "overUnderHC") && metricForPeriod && (metricForPeriod as any)[metricDef.key] !== null && (metricForPeriod as any)[metricDef.key] !== undefined) {
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

const renderCapacityItemContent = (
  item: CapacityDataRow,
  periodHeaders: string[],
  teamMetricDefs: TeamMetricDefinitions,
  aggregatedMetricDefs: AggregatedMetricDefinitions,
  onTeamMetricChange: CapacityTableProps['onTeamMetricChange']
): React.ReactNode[] => {
  const rows: React.ReactNode[] = [];
  
  let metricDefinitionsToUse: MetricDefinition[];

  if (item.itemType === 'Team') {
    metricDefinitionsToUse = teamMetricDefs;
  } else { 
    metricDefinitionsToUse = aggregatedMetricDefs;
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
};


const CapacityTableComponent: React.FC<CapacityTableProps> = ({ 
    data, 
    periodHeaders, 
    expandedItems, 
    toggleExpand, 
    teamMetricDefinitions,
    aggregatedMetricDefinitions,
    onTeamMetricChange,
    onVisiblePeriodsChange,
}) => {
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const weekHeaderRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  useEffect(() => {
    weekHeaderRefs.current = weekHeaderRefs.current.slice(0, periodHeaders.length);
  }, [periodHeaders]);

  useEffect(() => {
    if (!scrollContainerRef.current || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeaders: string[] = [];
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const headerIndex = weekHeaderRefs.current.findIndex(ref => ref === entry.target);
            if (headerIndex !== -1 && periodHeaders[headerIndex]) {
              visibleHeaders.push(periodHeaders[headerIndex]);
            }
          }
        });

        if (visibleHeaders.length > 0) {
          visibleHeaders.sort((a, b) => periodHeaders.indexOf(a) - periodHeaders.indexOf(b));
          onVisiblePeriodsChange(visibleHeaders[0], visibleHeaders[visibleHeaders.length - 1]);
        } else {
          onVisiblePeriodsChange(null, null);
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "0px", 
        threshold: 0.5, 
      }
    );

    const currentRefs = weekHeaderRefs.current;
    currentRefs.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => {
      currentRefs.forEach(ref => {
        if (ref) observer.unobserve(ref);
      });
      observer.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodHeaders, onVisiblePeriodsChange]); 


  const renderTableItem = (item: CapacityDataRow): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedItems[item.id] || false;

    const isExpandable = (item.itemType !== 'Team' && item.children && item.children.length > 0) || item.itemType === 'Team';

    rows.push(
      <TableRow 
        key={`${item.id}-name`} 
        className={`${isExpandable ? 'bg-card-foreground/5 hover:bg-card-foreground/10' : 'hover:bg-card-foreground/5'} `}
      >
        <TableCell 
          colSpan={1} 
          className="p-0 sticky left-0 z-30 bg-card whitespace-nowrap"
        >
          <button
            onClick={isExpandable ? () => toggleExpand(item.id) : undefined}
            disabled={!isExpandable}
            className="py-3 px-4 font-semibold text-foreground hover:no-underline w-full text-left flex items-center gap-2"
            style={{ paddingLeft: `${item.level * 1.5 + (isExpandable ? 0.5 : 1)}rem` }} 
            aria-expanded={isExpandable ? isExpanded : undefined}
          >
            {isExpandable && (
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            )}
            {!isExpandable && <span className="w-4 shrink-0"></span>} 
            {item.name}
          </button>
        </TableCell>
        {/* Render placeholder cells for each period header in the name row to maintain column alignment */}
        {periodHeaders.map((ph) => (
             <TableCell key={`${item.id}-${ph}-headerplaceholder`} className={`${ isExpandable ? 'py-3' : ''}`}></TableCell>
        ))}
      </TableRow>
    );

    if (item.itemType === 'Team' && isExpanded) {
        const itemMetricRows = renderCapacityItemContent(item, periodHeaders, teamMetricDefinitions, aggregatedMetricDefinitions, onTeamMetricChange);
        rows.push(...itemMetricRows);
    } 
    else if (item.itemType !== 'Team' && (isExpanded || (!item.children || item.children.length === 0))) {
        const itemMetricRows = renderCapacityItemContent(item, periodHeaders, teamMetricDefinitions, aggregatedMetricDefinitions, onTeamMetricChange);
        rows.push(...itemMetricRows);
    }

    if (item.itemType !== 'Team' && item.children && item.children.length > 0 && isExpanded) {
      item.children.forEach(child => {
        rows.push(...renderTableItem(child)); 
      });
    }
    
    return rows;
  };

  const getCategoryHeader = () => {
    if (data.length === 0) return 'Category / Metric';
    return 'BU / LoB / Team / Metric';
  };


  return (
    <TooltipProvider delayDuration={300}>
      <div ref={scrollContainerRef} className="overflow-x-auto relative border border-border rounded-md shadow-md">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-40 bg-card"> 
            <TableRow>
              <TableHead className="sticky left-0 z-50 bg-card min-w-[320px] whitespace-nowrap shadow-sm px-4">
                {getCategoryHeader()}
              </TableHead>
              {periodHeaders.map((period, index) => (
                <TableHead 
                  key={period} 
                  ref={el => { if(el) weekHeaderRefs.current[index] = el;}}
                  className={`text-right min-w-[120px] whitespace-nowrap px-2`}
                >
                  {period}
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
CapacityTableComponent.displayName = 'CapacityTableComponent';
export const CapacityTable = React.memo(CapacityTableComponent);
