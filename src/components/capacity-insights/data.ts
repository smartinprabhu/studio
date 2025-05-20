import type { FilterOptions, RawLoBCapacityEntry, BusinessUnitName, TeamName, RawTeamDataEntry, TeamPeriodicMetrics } from "./types";
import { ALL_BUSINESS_UNITS, BUSINESS_UNIT_CONFIG, ALL_WEEKS_HEADERS, ALL_TEAM_NAMES } from "./types";

// Use a consistent set of periods for mock data generation
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS; // Generate data for all defined weeks (now 104)

// Helper to generate team-specific periodic input data
const generateTeamPeriodicInputData = (periods: string[]): Record<string, Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>> => {
  const metrics: Record<string, Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualAgentMinutes'>> = {};
  periods.forEach(period => {
    metrics[period] = {
      aht: Math.floor(Math.random() * 10) + 5, // 5-14 minutes
      shrinkagePercentage: Math.floor(Math.random() * 15) + 5, // 5-19 %
      occupancyPercentage: Math.floor(Math.random() * 20) + 70, // 70-89 %
      backlogPercentage: Math.floor(Math.random() * 10), // 0-9 %
      attritionPercentage: parseFloat((Math.random() * 2).toFixed(1)), // 0-2.0 %
      volumeMixPercentage: 33.3, // Initial even distribution, will be normalized during interaction
      actualHC: Math.floor(Math.random() * 50) + 10, // 10-59 HC
      moveIn: Math.floor(Math.random() * 5), // 0-4
      moveOut: Math.floor(Math.random() * 3), // 0-2
      newHireBatch: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 5 : 0, // Occasionally new hires
      newHireProduction: Math.random() > 0.5 ? Math.floor(Math.random() * 8) : 0,
      _productivity: Math.floor(Math.random() * 5) + 5, // e.g. 5-9 tasks/hr, placeholder
    };
  });
  return metrics;
};

// Helper to generate LOB total base required minutes
const generateLobTotalBaseRequiredMinutes = (periods: string[]): Record<string, number | null> => {
  const metrics: Record<string, number | null> = {};
  periods.forEach(period => {
    // LOBs have larger aggregate required minutes
    metrics[period] = Math.floor(Math.random() * 200000) + 50000; // 50,000 - 249,999 agent-minutes
  });
  return metrics;
};


export const mockRawCapacityData: RawLoBCapacityEntry[] = [];

ALL_BUSINESS_UNITS.forEach(bu => {
  BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness.forEach(lob => {
    const teamsForLob: RawTeamDataEntry[] = [];
    
    // Assign initial volume mix, ensuring sum is close to 100 for mock purposes
    const initialMixes = [34, 33, 33]; // For 3 teams

    ALL_TEAM_NAMES.forEach((teamName, index) => {
      const teamPeriodicData = generateTeamPeriodicInputData(MOCK_DATA_PERIODS);
      // Set a slightly varied initial volume mix for each team for each period
      Object.keys(teamPeriodicData).forEach(period => {
          teamPeriodicData[period].volumeMixPercentage = initialMixes[index] || (100 / ALL_TEAM_NAMES.length);
      });

      teamsForLob.push({
        teamName: teamName,
        periodicInputData: teamPeriodicData,
      });
    });

    mockRawCapacityData.push({
      id: `${bu.toLowerCase().replace(/\s+/g, '-')}_${lob.toLowerCase().replace(/\s+/g, '-')}`,
      bu: bu,
      lob: lob,
      lobTotalBaseRequiredMinutes: generateLobTotalBaseRequiredMinutes(MOCK_DATA_PERIODS),
      teams: teamsForLob,
    });
  });
});


export const mockFilterOptions: FilterOptions = {
  businessUnits: ["All", ...ALL_BUSINESS_UNITS],
  linesOfBusiness: [], // Will be populated dynamically based on selected BU
  groupByOptions: ["Business Unit", "Line of Business"],
};