"use client";
import React, { useState, useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
import {
  format as formatDateFn,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getYear,
  isSameMonth,
  isBefore,
  isAfter,
  parse as dateParseFns, // Added for potential use if needed by date utils, though getHeaderDateRange uses it internally
} from 'date-fns';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_MONTH_HEADERS, getHeaderDateRange, TimeInterval } from "@/utils/dateUtils"; // Updated import

interface CustomCaptionPropsMonth {
  displayMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  onYearChange: (newYear: Date) => void;
}

const CustomMonthCaption: React.FC<CustomCaptionPropsMonth> = ({ displayMonth, onMonthChange, onYearChange }) => {
  const monthName = displayMonth.toLocaleString("default", { month: "long" });
  const year = displayMonth.getFullYear();

  return (
    <div className="flex items-center justify-between px-2 py-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onMonthChange(subMonths(displayMonth, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthName}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onMonthChange(addMonths(displayMonth, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onYearChange(subMonths(displayMonth, 12))}
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{year}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onYearChange(addMonths(displayMonth, 12))}
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface MonthRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function MonthRangePicker({ date, onDateChange, className, minDate, maxDate }: MonthRangePickerProps) {
  const [fromDisplayMonth, setFromDisplayMonth] = useState<Date>(date?.from || new Date());
  const [toDisplayMonth, setToDisplayMonth] = useState<Date>(date?.to || addMonths(new Date(), 1));
  const [popoverOpen, setPopoverOpen] = useState(false);

  const yearsInHeaders = useMemo(() => {
    const years = new Set<number>();
    ALL_MONTH_HEADERS.forEach(header => {
      const d = getHeaderDateRange(header, "Month" as TimeInterval)?.startDate; // Cast "Month" to TimeInterval
      if (d) years.add(getYear(d));
    });
    return Array.from(years).sort((a, b) => a - b);
  }, []);

  const effectiveMinYear = minDate ? getYear(minDate) : (yearsInHeaders.length > 0 ? yearsInHeaders[0] : getYear(new Date()) - 5);
  const effectiveMaxYear = maxDate ? getYear(maxDate) : (yearsInHeaders.length > 0 ? yearsInHeaders[yearsInHeaders.length - 1] : getYear(new Date()) + 5);

  useEffect(() => {
    if (date?.from) {
      setFromDisplayMonth(date.from);
    }
    if (date?.to) {
      setToDisplayMonth(date.to);
    }
  }, [date?.from, date?.to]);

  const handleFromSelect = (selectedMonth: Date) => {
    const from = startOfMonth(selectedMonth);
    let to = date?.to ? startOfMonth(date.to) : startOfMonth(selectedMonth);
    
    if (isBefore(to, from)) {
      to = startOfMonth(from);
    }
    
    onDateChange({ from, to });
  };

  const handleToSelect = (selectedMonth: Date) => {
    const to = startOfMonth(selectedMonth);
    const from = date?.from ? startOfMonth(date.from) : startOfMonth(selectedMonth);
    
    if (isBefore(to, from)) {
      onDateChange({ from: startOfMonth(selectedMonth), to });
    } else {
      onDateChange({ from, to });
    }
  };

  const formatButtonLabel = () => {
    if (!date?.from) {
      return "Pick a month range";
    }
    const fromMonthStr = formatDateFn(date.from, "MMM yyyy");
    if (!date.to || isSameMonth(date.from, date.to)) {
      return fromMonthStr;
    }
    const toMonthStr = formatDateFn(date.to, "MMM yyyy");
    return `${fromMonthStr} - ${toMonthStr}`;
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            id="month-date"
            variant={"outline"}
            className={cn(
              "w-full lg:w-[280px] justify-start text-left font-normal h-9",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{formatButtonLabel()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col gap-4 p-4">
            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setFromDisplayMonth(subMonths(fromDisplayMonth, 12));
                  setToDisplayMonth(subMonths(toDisplayMonth, 12));
                }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous Year
              </Button>
              <div className="font-medium">
                {getYear(fromDisplayMonth)} - {getYear(toDisplayMonth)}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setFromDisplayMonth(addMonths(fromDisplayMonth, 12));
                  setToDisplayMonth(addMonths(toDisplayMonth, 12));
                }}
              >
                Next Year
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col">
              <div className="grid grid-cols-2 gap-6 sticky top-0 bg-background z-10 pb-2">
                <div className="text-sm font-medium text-center">From</div>
                <div className="text-sm font-medium text-center">To</div>
              </div>
              <div className="flex gap-6 overflow-x-auto">
                {/* From Calendar */}
                <div className="grid grid-cols-3 gap-2 w-full">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const month = new Date(getYear(fromDisplayMonth), i, 1);
                    const isSelected = date?.from && isSameMonth(month, date.from);
                    
                    return (
                      <Button
                        key={`from-${i}`}
                        variant={isSelected ? "default" : "outline"}
                        className="h-16"
                        onClick={() => handleFromSelect(month)}
                      >
                        {formatDateFn(month, 'MMM')}
                      </Button>
                    );
                  })}
                </div>

                {/* To Calendar */}
                <div className="grid grid-cols-3 gap-2 w-full">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const month = new Date(getYear(toDisplayMonth), i, 1);
                    const isSelected = date?.to && isSameMonth(month, date.to);
                    const isInRange = date?.from && date?.to && 
                      isAfter(month, date.from) && isBefore(month, date.to);
                    
                    return (
                      <Button
                        key={`to-${i}`}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "h-16",
                          isInRange && "bg-primary/10"
                        )}
                        onClick={() => handleToSelect(month)}
                      >
                        {formatDateFn(month, 'MMM yyyy')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
