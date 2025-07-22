import { CapacityDataRow, TeamPeriodicMetrics } from '../shared/interfaces';

export interface FixHcTeamPeriodicMetrics extends TeamPeriodicMetrics {
  requiredHC?: number | null;
}

export interface FixHcCapacityDataRow extends CapacityDataRow {
  periodicData: Record<string, FixHcTeamPeriodicMetrics>;
}
