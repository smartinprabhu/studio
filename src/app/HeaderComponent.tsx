typescriptreact
'use client';

import React from 'react';
import { DateRangePicker } from './DatePickerComponent'; // Adjust path as necessary
import { TimeInterval } from './types'; // Adjust path as necessary
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeaderComponentProps {
  selectedInterval: TimeInterval;
  onIntervalChange: (interval: TimeInterval) => void;
  selectedDateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
  availableIntervals: TimeInterval[];
}

export const HeaderComponent: React.FC<HeaderComponentProps> = ({
  selectedInterval,
  onIntervalChange,
  selectedDateRange,
  onDateRangeChange,
  availableIntervals,
}) => {
  return (
    <div className="flex items-center space-x-4 p-4 border-b">
      <div>
        <label htmlFor="time-interval" className="mr-2">Time Interval:</label>
        <Select value={selectedInterval} onValueChange={onIntervalChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select interval" />
          </SelectTrigger>
          <SelectContent>
            {availableIntervals.map(interval => (
              <SelectItem key={interval} value={interval}>
                {interval}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label htmlFor="date-range" className="mr-2">Date Range:</label>
        <DateRangePicker
          selectedDateRange={selectedDateRange}
          onDateRangeChange={onDateRangeChange}
        />
      </div>
    </div>
  );
};