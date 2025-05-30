
import {
  ALL_WEEKS_HEADERS,
  ALL_MONTH_HEADERS,
  ALL_BUSINESS_UNITS,
  BUSINESS_UNIT_CONFIG,
  ALL_TEAM_NAMES,
  type RawLoBCapacityEntry,
  type RawTeamDataEntry,
  type TeamPeriodicMetrics,
  type BusinessUnitName,
  type LineOfBusinessName,
  type TeamName
} from "./types";

// Use all generated weeks for mock data
const MOCK_DATA_PERIODS = ALL_WEEKS_HEADERS; // Or ALL_MONTH_HEADERS for monthly default

// Generates random input data for a team for all specified periods
const generateTeamPeriodicInputData = (
  periods: string[],
  teamIndex: number,
  totalTeamsInLob: number
): Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>> => {
  const metrics: Record<string, Partial<Omit<TeamPeriodicMetrics, 'requiredHC' | 'overUnderHC' | '_calculatedRequiredAgentMinutes' | '_calculatedActualProductiveAgentMinutes' | 'attritionLossHC' | 'hcAfterAttrition' | 'endingHC'>>> = {};

  // Attempt to distribute volume mix somewhat evenly, ensuring it sums to 100%
  const baseMix = totalTeamsInLob > 0 ? Math.floor(100 / totalTeamsInLob) : 0;
  const mixes = Array(totalTeamsInLob).fill(0).map((_, idx) => {
    if (idx === totalTeamsInLob - 1) { // Last team takes the remainder
      return parseFloat((100 - (totalTeamsInLob - 1) * baseMix).toFixed(1));
    }
    return parseFloat(baseMix.toFixed(1));
  });
  // Ensure sum is 100 due to potential flooring issues
  let sumOfMixes = mixes.reduce((acc, curr) => acc + curr, 0);
  if (Math.abs(sumOfMixes - 100) > 0.01 && mixes.length > 0) {
      mixes[mixes.length - 1] = parseFloat((mixes[mixes.length - 1] + (100 - sumOfMixes)).toFixed(1));
  }


  periods.forEach(period => {
    metrics[period] = {
      aht: Math.floor(Math.random() * 10) + 5, // 5-14 min
      shrinkagePercentage: Math.floor(Math.random() * 15) + 5, // 5-19%
      occupancyPercentage: Math.floor(Math.random() * 15) + 75, // 75-89%
      backlogPercentage: Math.floor(Math.random() * 10), // 0-9%
      attritionPercentage: parseFloat((Math.random() * 2 + 0.5).toFixed(1)), // 0.5-2.4%
      volumeMixPercentage: mixes[teamIndex] !== undefined ? mixes[teamIndex] : (totalTeamsInLob > 0 ? parseFloat((100/totalTeamsInLob).toFixed(1)) : 0),
      actualHC: Math.floor(Math.random() * 30) + 10, // 10-39 HC
      moveIn: Math.floor(Math.random() * 3), // 0-2
      moveOut: Math.floor(Math.random() * 2), // 0-1
      newHireBatch: Math.random() > 0.8 ? Math.floor(Math.random() * 5) + 2 : 0, // Sporadic new hires
      newHireProduction: Math.random() > 0.7 ? Math.floor(Math.random() * 4) + 1 : 0, // Sporadic new prod
    };
  });
  return metrics;
};

// Generates LOB level forecast inputs
const generateLobInputs = (periods: string[]): {
  volume: Record<string, number | null>,
  aht: Record<string, number | null>,
  baseReqMins: Record<string, number | null> // This will be calculated if volume & AHT exist
} => {
  const volume: Record<string, number | null> = {};
  const avgAht: Record<string, number | null> = {};
  const baseReqMins: Record<string, number | null> = {};

  periods.forEach(period => {
    const currentVolume = Math.floor(Math.random() * 8000) + 2000; // 2000-9999
    const currentAHT = Math.floor(Math.random() * 8) + 7; // 7-14 min
    volume[period] = currentVolume;
    avgAht[period] = currentAHT;
    baseReqMins[period] = currentVolume * currentAHT; // Calculate base required minutes
  });
  return { volume, aht: avgAht, baseReqMins };
};


export const initialMockRawCapacityData: RawLoBCapacityEntry[] = [];

ALL_BUSINESS_UNITS.forEach(bu => {
  const lobsForBu = BUSINESS_UNIT_CONFIG[bu].lonsOfBusiness as ReadonlyArray<LineOfBusinessName<typeof bu>>;
  lobsForBu.forEach(lobName => {
    const teamsForLob: RawTeamDataEntry[] = [];
    const numTeamsInLob = ALL_TEAM_NAMES.length;

    ALL_TEAM_NAMES.forEach((teamName, index) => {
      teamsForLob.push({
        teamName: teamName,
        periodicInputData: generateTeamPeriodicInputData(MOCK_DATA_PERIODS, index, numTeamsInLob),
      });
    });
    
    const lobInputs = generateLobInputs(MOCK_DATA_PERIODS);

    initialMockRawCapacityData.push({
      id: `${bu.toLowerCase().replace(/\s+/g, '-')}_${lobName.toLowerCase().replace(/\s+/g, '-')}`,
      bu: bu,
      lob: lobName,
      lobVolumeForecast: lobInputs.volume,
      lobAverageAHT: lobInputs.aht,
      lobTotalBaseRequiredMinutes: lobInputs.baseReqMins, // Populated from calculation
      teams: teamsForLob,
    });
  });
});

    