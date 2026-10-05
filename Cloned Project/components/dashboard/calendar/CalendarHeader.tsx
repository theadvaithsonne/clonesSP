"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { getMonthYear } from "@/lib/calendarUtils";
import type { ViewMode } from "@/lib/calendarUtils";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: ViewMode;
  onDateChange: (date: Date) => void;
  onViewChange: (mode: ViewMode) => void;
  onToday: () => void;
  onCreateEvent?: () => void;
}

export function CalendarHeader({
  currentDate,
  viewMode,
  onDateChange,
  onViewChange,
  onToday,
  onCreateEvent,
}: CalendarHeaderProps) {
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() - 7);
    } else if (viewMode === 'day') {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() - 1);
    }
    onDateChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + 7);
    } else if (viewMode === 'day') {
      newDate.setDate(currentDate.getDate() + 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111116]">
      {/* Left side: Month/Year and Navigation */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-white">
          {getMonthYear(currentDate)}
        </h2>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToday}
            className="h-8 px-3 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Today
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right side: Create Event Button + View Mode Selector */}
      <div className="flex items-center gap-3">
        {onCreateEvent && (
          <Button
            onClick={onCreateEvent}
            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Event
          </Button>
        )}

        <Select value={viewMode} onValueChange={(value) => onViewChange(value as ViewMode)}>
          <SelectTrigger className="w-[120px] h-8 bg-[#1a1a20] border-[#2a2a35] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a20] border-[#2a2a35]">
            <SelectItem value="day" className="text-white hover:bg-[#2a2a35]">
              Day
            </SelectItem>
            <SelectItem value="week" className="text-white hover:bg-[#2a2a35]">
              Week
            </SelectItem>
            <SelectItem value="month" className="text-white hover:bg-[#2a2a35]">
              Month
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
