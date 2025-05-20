
import type { CapacityDataRow, FilterOptions } from "./types";
import { WEEKS_HEADERS } from "./types";

const generateWeeklyData = (): Record<string, { required: number | null; actual: number | null }> => {
  const data: Record<string, { required: number | null; actual: number | null }> = {};
  WEEKS_HEADERS.forEach(week => {
    data[week] = {
      required: Math.floor(Math.random() * 200) + 50,
      actual: Math.floor(Math.random() * 220) + 40,
    };
  });
  return data;
};

export const mockCapacityData: CapacityDataRow[] = [
  {
    id: "lobTotal",
    name: "Selected LoB's Total",
    level: 0,
    weeklyData: generateWeeklyData(),
  },
  {
    id: "inventoryManagement",
    name: "INVENTORY MANAGEMENT",
    level: 0,
    weeklyData: {}, // Aggregated or placeholder
    children: [
      {
        id: "inhouseBpo",
        name: "Inhouse BPO",
        level: 1,
        weeklyData: generateWeeklyData(),
        children: [
            // Could have sub- BPOs or teams here if needed
        ]
      },
      {
        id: "bpo1",
        name: "BPO #1",
        level: 1,
        weeklyData: generateWeeklyData(),
      },
      {
        id: "bpo2",
        name: "BPO #2 (Example with no data)",
        level: 1,
        weeklyData: WEEKS_HEADERS.reduce((acc, week) => {
          acc[week] = { required: null, actual: null };
          return acc;
        }, {} as Record<string, { required: number | null; actual: number | null }>),
      }
    ],
  },
];

export const mockFilterOptions: FilterOptions = {
  businessUnits: ["BU Alpha", "BU Beta", "BU Gamma"],
  linesOfBusiness: ["LoB X", "LoB Y", "LoB Z"],
  groupByOptions: ["Agent", "Team", "Skill"],
};
