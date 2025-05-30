
"use client";

import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { 
  getWeek, 
  isSameDay, 
  isBefore, 
  startOfWeek, 
  endOfWeek,
  getYear as dateFnsGetYear, // Alias to avoid conflict
  format as formatDateFn,
} from 'date-fns';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ALL_WEEKS_HEADERS, getHeaderDateRange, findFiscalWeekHeaderForDate } from "./types";


interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
  allAvailablePeriods: string[]; 
}

export function DateRangePicker({ date, onDateChange, className, allAvailablePeriods }: DateRangePickerProps) {
  const [clientButtonText, setClientButtonText] = useState<string>("Pick a date range");

  const yearsInHeaders = React.useMemo(() => {
    return allAvailablePeriods
      .map(h => {
        const range = getHeaderDateRange(h, h.startsWith("FWk") ? "Week" : "Month");
        return range.startDate ? range.startDate.getUTCFullYear() : 0;
      })
      .filter(y => y > 0);
  }, [allAvailablePeriods]);
    
  const minYear = yearsInHeaders.length > 0 ? Math.min(...yearsInHeaders) : new Date().getUTCFullYear();
  const maxYear = yearsInHeaders.length > 0 ? Math.max(...yearsInHeaders) : new Date().getUTCFullYear() + 1;

  const defaultCalendarMonth = date?.from || new Date(Date.UTC(minYear, 0, 1));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let newButtonText = "Pick a date range";
      if (date?.from) {
        const fromFiscalHeader = findFiscalWeekHeaderForDate(date.from, ALL_WEEKS_HEADERS);
        // Use date.from.getWeek() if date-fns v3, or getWeek(date.from) if v2. Assuming v2+ here.
        const fromWeekNumLabel = fromFiscalHeader ? fromFiscalHeader.split(':')[0].replace("FWk", "W") : `W${getWeek(date.from, { weekStartsOn: 1 })}`;
        const fromDateStr = `${date.from.getUTCDate().toString().padStart(2, '0')}/${(date.from.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.from.getUTCFullYear()}`;
        newButtonText = `${fromWeekNumLabel} (${fromDateStr})`;

        if (date.to) {
          const toFiscalHeader = findFiscalWeekHeaderForDate(date.to, ALL_WEEKS_HEADERS);
          const toWeekNumLabel = toFiscalHeader ? toFiscalHeader.split(':')[0].replace("FWk", "W") : `W${getWeek(date.to, { weekStartsOn: 1 })}`;
          const toDateStr = `${date.to.getUTCDate().toString().padStart(2, '0')}/${(date.to.getUTCMonth() + 1).toString().padStart(2, '0')}/${date.to.getUTCFullYear()}`;

          const fromWeekStartForCompare = startOfWeek(date.from, { weekStartsOn: 1 });
          const toWeekStartForCompare = startOfWeek(date.to, { weekStartsOn: 1 });

          if (!isSameDay(fromWeekStartForCompare, toWeekStartForCompare)) {
            newButtonText += ` - ${toWeekNumLabel} (${toDateStr})`;
          }
        }
      }
      setClientButtonText(newButtonText);
    }
  }, [date]);


  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full lg:w-[380px] justify-start text-left font-normal h-9",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{clientButtonText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            weekStartsOn={1} // Monday
            captionLayout="dropdown-buttons"
            fromYear={minYear}
            toYear={maxYear}
            defaultMonth={defaultCalendarMonth}
            selected={date}
            onSelect={(range: DateRange | undefined) => {
              let newFrom = range?.from;
              let newTo = range?.to;

              if (newFrom) {
                newFrom = startOfWeek(newFrom, { weekStartsOn: 1 });
              }
              if (newTo) {
                newTo = endOfWeek(newTo, { weekStartsOn: 1 });
              }

              if (newFrom && newTo && isBefore(newTo, newFrom)) {
                newTo = endOfWeek(newFrom, {weekStartsOn: 1});
              }
              
              const processedRange: DateRange | undefined = newFrom
                ? { from: newFrom, to: newTo || endOfWeek(newFrom, {weekStartsOn: 1}) }
                : undefined;
              onDateChange(processedRange);
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

    