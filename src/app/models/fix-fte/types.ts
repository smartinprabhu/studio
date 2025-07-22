import { CapacityDataRow, TeamPeriodicMetrics } from '../shared/interfaces';

export interface FixFteTeamPeriodicMetrics extends TeamPeriodicMetrics {
  requiredFTE?: number | null;
}

export interface FixFteCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, FixFteTeamPeriodicMetrics>;
}
