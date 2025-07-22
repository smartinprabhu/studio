interface CapacityTableProps {
  data: CapacityData[];
  periodHeaders: PeriodHeader[];
  expandedItems: Set<string>;
  toggleExpand: (id: string) => void;
  teamMetricDefinitions: MetricRowDefinition[];
  aggregatedMetricDefinitions: MetricRowDefinition[];
  onTeamMetricChange: (
    teamId: string,
    metricId: string,
    periodIndex: number,
    value: number
  ) => void;
  onLobMetricChange: (
    lobId: string,
    metricId: string,
    periodIndex: number,
    value: number
  ) => void;
  editingCell: { id: string; metricId: string; periodIndex: number } | null;
  onSetEditingCell: (
    cell: { id: string; metricId: string; periodIndex: number } | null
  ) => void;
  selectedTimeInterval: TimeInterval;
  onActiveHierarchyChange: (hierarchy: Hierarchy) => void;
  tableBodyScrollRef: React.RefObject<HTMLDivElement>;
  headerPeriodScrollerRef: React.RefObject<HTMLDivElement>;
}

export function CapacityTable({
  data,
  periodHeaders,
  expandedItems,
  toggleExpand,
  teamMetricDefinitions,
  aggregatedMetricDefinitions,
  onTeamMetricChange,
  onLobMetricChange,
  editingCell,
  onSetEditingCell,
  selectedTimeInterval,
  onActiveHierarchyChange,
  tableBodyScrollRef,
  headerPeriodScrollerRef,
}: CapacityTableProps) {
  // ... rest of the component
}