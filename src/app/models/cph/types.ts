import { CapacityDataRow, TeamPeriodicMetrics, AggregatedPeriodicMetrics } from '../shared/interfaces';

export interface CPHTeamPeriodicMetrics extends TeamPeriodicMetrics {
  cph?: number | null;
}

export interface CPHAggregatedPeriodicMetrics extends AggregatedPeriodicMetrics {
  lobAverageCPH?: number | null;
}

export interface CPHCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, CPHTeamPeriodicMetrics | CPHAggregatedPeriodicMetrics>;
}
