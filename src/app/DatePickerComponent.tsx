typescriptreact
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  onSelectDateRange: (dateRange: DateRange | undefined) => void;
  initialDateRange?: DateRange;
  periodHeaders: string[];
}

export function DateRangePicker({ onSelectDateRange, initialDateRange, periodHeaders }: DateRangePickerProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [month, setMonth] = useState<Date | undefined>(dateRange?.from || new Date());
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  useEffect(() => {
    onSelectDateRange(dateRange);
  }, [dateRange, onSelectDateRange]);

  const availableYears = useMemo(() => {
    const years = periodHeaders.map(h => {
      const match = h.match(/(\d{4})$/);
      return match ? parseInt(match[1]) : 0;
    }).filter(y => y > 0);
    return Array.from(new Set(years)).sort((a, b) => a - b);
  }, [periodHeaders]);

  const minYear = availableYears.length > 0 ? Math.min(...availableYears) : new Date().getUTCFullYear();
  const maxYear = availableYears.length > 0 ? Math.max(...availableYears) : new Date().getUTCFullYear();


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant={"outline"}
          className={cn(
            "w-[300px] justify-start text-left font-normal",
            !dateRange && "text-muted-foreground"
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "LLL dd, y")} -{" "}
                {format(dateRange.to, "LLL dd, y")}
              </>
            ) : (
              format(dateRange.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={month}
          selected={dateRange}
          onSelect={setDateRange}
          numberOfMonths={2}
          onMonthChange={setMonth}
          captionLayout="dropdown"
          fromYear={minYear}
          toYear={maxYear}
          components={{
            CaptionLabel: ({ displayMonth }) => {
              const year = displayMonth.getFullYear();
              const monthName = format(displayMonth, "MMMM");
              return (
                <div className="flex justify-center">
                  <button
                    onClick={() => setViewMode("month")}
                    className="px-1 py-0.5 rounded hover:bg-accent"
                  >
                    {monthName}
                  </button>
                  <button
                     onClick={() => setViewMode("year")}
                    className="ml-2 px-1 py-0.5 rounded hover:bg-accent"
                  >
                    {year}
                  </button>
                </div>
              );
            },
          }}
        />
      </PopoverContent>
    </Popover>
  );
}