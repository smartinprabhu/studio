
import type { FilterOptions, RawLoBCapacityEntry, BusinessUnitName, TeamName, RawTeamDataEntry, TeamPeriodicMetrics } from "./types";
import { ALL_BUSINESS_UNITS, BUSINESS_UNIT_CONFIG, ALL_WEEKS_HEADERS, ALL_TEAM_NAMES } from "./types";

// Use a consistent set of periods for mock data generation
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS.slice(0, 20); // Generate data for first 20 weeks

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
      volumeMixPercentage: Math.floor(Math.random() * 30) + 10, // 10-39 % (will need normalization later)
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
    // Ensure sum of volumeMixPercentage across teams is somewhat reasonable, though not strictly 100% here for mock simplicity.
    // In a real scenario, this would be normalized or validated.
    let remainingVolumeMix = 100;
    
    ALL_TEAM_NAMES.forEach((teamName, index) => {
      // For simplicity, create all team types for each LOB. In reality, this might vary.
      const teamPeriodicData = generateTeamPeriodicInputData(MOCK_DATA_PERIODS);
      
      // Adjust volume mix for mock data to simulate distribution
      if (index < ALL_TEAM_NAMES.length -1) {
        const currentTeamMix = Math.floor(Math.random() * (remainingVolumeMix / 2)) + 10;
        Object.keys(teamPeriodicData).forEach(period => {
            teamPeriodicData[period].volumeMixPercentage = Math.max(10, Math.min(50, currentTeamMix)); // Clamp between 10-50 for this mock
        });
        remainingVolumeMix -= (teamPeriodicData[MOCK_DATA_PERIODS[0]]?.volumeMixPercentage || 25);
      } else {
         Object.keys(teamPeriodicData).forEach(period => {
            teamPeriodicData[period].volumeMixPercentage = Math.max(10, Math.min(50, remainingVolumeMix));
        });
      }

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
