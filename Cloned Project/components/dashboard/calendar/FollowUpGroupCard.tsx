"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { formatTime, eventColors } from "@/lib/calendarUtils";
import type { CalendarEvent } from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FollowUpGroupCardProps {
  events: CalendarEvent[];
  style: React.CSSProperties;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function FollowUpGroupCard({
  events,
  style,
  onSelectEvent,
}: FollowUpGroupCardProps) {
  const colors = eventColors.deal;
  const n = events.length;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            ...style,
            backgroundColor: colors.bg,
            borderLeft: `4px solid ${colors.border}`,
          }}
          className={cn(
            "absolute left-1 right-1 rounded-md overflow-hidden cursor-pointer text-left",
            "hover:z-50 hover:scale-[1.02] transition-all duration-200",
            "shadow-lg hover:shadow-xl backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
          )}
        >
          <div className="px-2 py-1 h-full flex flex-col justify-start">
            <div
              className="text-xs font-semibold truncate"
              style={{ color: colors.text }}
            >
              {n} follow-ups
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Click to view
            </div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border border-white/10 bg-[#1a1a1f] p-0"
        align="start"
        side="right"
        sideOffset={8}
      >
        <div className="px-3 py-2 border-b border-white/10">
          <p className="text-xs font-medium text-white">Follow-ups</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Select one to open details
          </p>
        </div>
        <ul className="max-h-64 overflow-y-auto py-1">
          {events.map((event) => {
            const startTime = new Date(event.startTime);
            const endTime = new Date(event.endTime);
            const other =
              event.contactName || event.entityName || "Deal follow-up";

            return (
              <li key={event._id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectEvent(event);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs",
                    "hover:bg-white/5 transition-colors",
                    "border-b border-white/5 last:border-b-0 flex flex-col gap-0.5"
                  )}
                >
                  <span
                    className="font-medium truncate text-purple-200"
                    title={event.title}
                  >
                    {event.title}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {formatTime(startTime)} – {formatTime(endTime)}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate">
                    {other}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
