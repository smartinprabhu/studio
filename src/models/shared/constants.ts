import {
  generateFiscalWeekHeaders,
  isLeapYear,
  formatDatePartUTCFromDate,
} from '@/components/capacity-insights/types';

export const STANDARD_WEEKLY_WORK_MINUTES = 40 * 60;
export const STANDARD_MONTHLY_WORK_MINUTES = (40 * 52 / 12) * 60;

export const ALL_WEEKS_HEADERS = generateFiscalWeekHeaders(2024, 104);
export const ALL_MONTH_HEADERS = Array.from({ length: 24 }, (_, i) => {
  const year = 2024 + Math.floor(i / 12);
  const month = i % 12;
  const date = new Date(Date.UTC(year, month, 1)); // Use UTC for month headers too
  return `${date.toLocaleString('default', { month: 'long', timeZone: 'UTC' })} ${date.getUTCFullYear()}`;
});

export const BUSINESS_UNIT_CONFIG = {
  "WFS": {
    name: "WFS",
    lonsOfBusiness: [
      "US Chat", "US Phone", "Core Support", "Customer Returns", "Inventory Management",
      "Dispute Management", "IBE Management", "FC Liaison", "Flex Team", "Help Desk", "MCS",
      "China Mandarin Chat", "China Mandarin Email", "China English Chat", "China English Email",
      "Strike Through", "Walmart Import"
    ]
  },
  "SFF": {
    name: "SFF",
    lonsOfBusiness: ["SFF LoB Alpha", "SFF LoB Bravo", "SFF LoB Charlie", "SFF LoB Delta"]
  },
  "RSO": {
    name: "RSO",
    lonsOfBusiness: ["RSO LoB Xray", "RSO LoB Yankee", "RSO LoB Zulu"]
  },
  "Go Local": {
    name: "Go Local",
    lonsOfBusiness: ["GoLocal Partner Support", "GoLocal Customer Care", "GoLocal Dispatch"]
  }
} as const;

export const ALL_BUSINESS_UNITS = Object.keys(BUSINESS_UNIT_CONFIG);
export const ALL_TEAM_NAMES: string[] = ["Inhouse", "BPO1", "BPO2"];
