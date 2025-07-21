import {
  format as formatDateFn,
  getWeek,
  getMonth,
  getYear,
  parse as dateParseFns,
  startOfWeek,
  endOfWeek,
  isWithinInterval as isWithinIntervalFns,
  setDate,
  addDays,
  startOfMonth,
  endOfMonth,
  isBefore,
  isAfter,
  eachWeekOfInterval,
  differenceInCalendarWeeks,
  addWeeks,
  isSameDay,
  addMonths,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

// --- Date Utility Functions (Moved from PlanningTab.tsx) ---

export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

export const formatDatePartUTC = (date: Date): string =>
  `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.getUTCDate().toString().padStart(2, '0')}`;

export const generateFiscalWeekHeaders = (startFiscalYear: number, numTotalWeeks: number): string[] => {
  const headers: string[] = [];
  let currentYear = startFiscalYear;
  let fiscalYearActualStartDate: Date;

  const targetDateForStart = isLeapYear(currentYear)
    ? new Date(Date.UTC(currentYear, 1, 1)) // February 1st
    : new Date(Date.UTC(currentYear, 0, 22)); // January 22nd

  fiscalYearActualStartDate = startOfWeek(targetDateForStart, { weekStartsOn: 1 });

  for (let i = 0; i < numTotalWeeks; i++) {
    const weekStartDate = new Date(fiscalYearActualStartDate);
    weekStartDate.setUTCDate(fiscalYearActualStartDate.getUTCDate() + i * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

    const displayYearForHeader = weekStartDate.getUTCFullYear();

    headers.push(
      `FWk${i + 1}: ${formatDatePartUTC(weekStartDate)}-${formatDatePartUTC(weekEndDate)} (${displayYearForHeader})`
    );
  }
  return headers;
};

export const ALL_WEEKS_HEADERS = generateFiscalWeekHeaders(2024, 104);

export const ALL_MONTH_HEADERS = (() => {
  const months = Array.from({ length: 24 }, (_, i) => {
    const year = 2024 + Math.floor(i / 12);
    const month = i % 12;
    return formatDateFn(new Date(Date.UTC(year, month, 1)), 'MMM yyyy', { locale: enUS });
  });
  console.log('Generated month headers:', months);
  return months;
})();

export const parseDateFromHeaderStringMMDD = (dateMMDD: string, year: string): Date | null => {
  if (!dateMMDD || !year) return null;
  const [month, day] = dateMMDD.split('/').map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(parseInt(year))) return null;

  const parsedDate = new Date(Date.UTC(parseInt(year), month - 1, day));

  if (parsedDate.getUTCFullYear() !== parseInt(year) || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    return null;
  }
  return parsedDate;
};

export type TimeInterval = "Week" | "Month";
export const getHeaderDateRange = (header: string, interval: TimeInterval): { startDate: Date | null, endDate: Date | null } => {
  if (interval === "Week") {
    // Existing week parsing logic
  } else if (interval === "Month") {
    try {
      const referenceDate = new Date(Date.UTC(2024, 0, 1));
      const date = dateParseFns(header, "MMM yyyy", referenceDate);
      console.log(`Parsed date for header "${header}":`, date); // Debugging line
      if (!isNaN(date.getTime())) {
        const yearVal = date.getUTCFullYear();
        const monthVal = date.getUTCMonth();
        const firstDay = startOfMonth(new Date(Date.UTC(yearVal, monthVal, 1)));
        const lastDay = endOfMonth(new Date(Date.UTC(yearVal, monthVal, 1)));
        console.log(`Start and end dates for header "${header}":`, firstDay, lastDay); // Debugging line
        return { startDate: firstDay, endDate: lastDay };
      }
    } catch (e) {
      console.warn(`Could not parse month header: ${header}`, e);
    }
  }
  return { startDate: null, endDate: null };
};

export const findFiscalWeekHeaderForDate = (targetDate: Date, allFiscalHeaders: string[]): string | null => {
  if (!targetDate) return null;
  for (const header of allFiscalHeaders) {
    const { startDate, endDate } = getHeaderDateRange(header, "Week");
    if (startDate && endDate) {
      const targetDayOnly = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
      const sDateOnly = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
      const eDateOnly = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

      if (targetDayOnly >= sDateOnly && targetDayOnly <= eDateOnly) {
        return header;
      }
    }
  }
  return null;
};

export const getDefaultDateRange = (interval: TimeInterval, numPeriodsToDefault: number): DateRange => {
  const headers = interval === "Week" ? ALL_WEEKS_HEADERS : ALL_MONTH_HEADERS;

  if (headers.length === 0) return { from: undefined, to: undefined };

  const fromHeaderDetails = getHeaderDateRange(headers[0], interval);
  const toHeaderIndex = Math.min(numPeriodsToDefault - 1, headers.length - 1);
  const toHeaderDetails = getHeaderDateRange(headers[toHeaderIndex], interval);

  let fromDate = fromHeaderDetails.startDate;
  let toDate = toHeaderDetails.endDate;
  
  if (!fromDate) fromDate = new Date(); // Default to today
  if (!toDate) {
    toDate = interval === "Week" 
      ? endOfWeek(addWeeks(startOfWeek(fromDate, { weekStartsOn: 1 }), numPeriodsToDefault - 1), { weekStartsOn: 1 }) 
      : endOfMonth(addMonths(startOfMonth(fromDate), numPeriodsToDefault - 1));
  }

  return { from: fromDate ?? undefined, to: toDate ?? undefined };
};
