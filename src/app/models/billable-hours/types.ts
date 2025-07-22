import { CapacityDataRow, TeamPeriodicMetrics, AggregatedPeriodicMetrics } from '../shared/interfaces';

export interface BillableHoursTeamPeriodicMetrics extends TeamPeriodicMetrics {
  // uses default AHT and attrition only
}

export interface BillableHoursAggregatedPeriodicMetrics extends AggregatedPeriodicMetrics {
  billableHoursRequire?: number | null;
}

export interface BillableHoursCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, BillableHoursTeamPeriodicMetrics | BillableHoursAggregatedPeriodicMetrics>;
}
