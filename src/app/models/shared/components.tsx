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
  import { ChevronDown, Edit3, ArrowUp, ArrowDown, Minus } from "lucide-react";
  import React, { useRef, useEffect, useCallback, memo } from "react";
  import { CapacityDataRow, MetricDefinition, TeamPeriodicMetrics, AggregatedPeriodicMetrics, TimeInterval } from "./interfaces";
  import { Input } from "@/components/ui/input";
  import { cn } from "@/lib/utils";

  interface CapacityTableProps {
    data: CapacityDataRow[];
    periodHeaders: string[];
    expandedItems: Record<string, boolean>;
    toggleExpand: (id: string) => void;
    teamMetricDefinitions: MetricDefinition[];
    aggregatedMetricDefinitions: MetricDefinition[];
    onTeamMetricChange: (lobId: string, teamName: any, periodHeader: string, metricKey: any, newValue: string) => void;
    onLobMetricChange: (lobId: string, periodHeader: string, metricKey: any, newValue: string) => void;
    editingCell: { id: string; period: string; metricKey: string } | null;
    onSetEditingCell: (id: string | null, period: string | null, metricKey: string | null) => void;
    selectedTimeInterval: TimeInterval;
    onActiveHierarchyChange: (newContext: string | null) => void;
    tableBodyScrollRef: React.RefObject<HTMLDivElement>;
  }

  const CapacityTableComponent: React.FC<CapacityTableProps> = (props) => {
    // ... implementation from page.tsx
    return <div>Table</div>
  };

  export const CapacityTable = memo(CapacityTableComponent);

  // ... other shared components can be moved here
