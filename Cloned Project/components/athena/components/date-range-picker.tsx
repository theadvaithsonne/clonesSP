"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { DateRange } from "react-day-picker"

interface CalendarDateRangePickerProps {
  onSelect: (range: { start: number | null, end: number | null }) => void;
  selectedRange?: { start: number | null, end: number | null };
  children: React.ReactNode;
}

export function CalendarDateRangePicker({ onSelect, selectedRange, children }: CalendarDateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    if (selectedRange?.start) {
      return {
        from: new Date(selectedRange.start),
        to: selectedRange.end ? new Date(selectedRange.end) : undefined
      };
    }
    return undefined;
  });

  const handleSelect = (newRange: DateRange | undefined) => {
    setDate(newRange);
    if (newRange?.from) {
      onSelect({
        start: newRange.from.getTime(),
        end: newRange.to ? newRange.to.getTime() : null
      });
    } else {
      onSelect({ start: null, end: null });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-[#111116] border-[#e5e7eb29]" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={handleSelect}
          className="bg-[#111116] text-white"
        />
      </PopoverContent>
    </Popover>
  )
}
