"use client";

import { Video, MapPin } from "lucide-react";
import { formatTime, categorizeEvent, eventColors } from "@/lib/calendarUtils";
import type { CalendarEvent } from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  onClick: () => void;
  meId: string;
}

export function EventCard({ event, style, onClick, meId }: EventCardProps) {
  const category = event.isDealActivity ? "deal" : categorizeEvent(event.title);
  const colors = eventColors[category as keyof typeof eventColors] || eventColors.default;

  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  const otherPerson = event.isDealActivity
    ? event.contactName || event.entityName || "Deals follow-up"
    : event.bookerId._id === meId
      ? event.bookedWithId.name || event.bookedWithId.email
      : event.bookerId.name || event.bookerId.email;

  // Determine if it's likely a video call
  const isVideoCall =
    event.title.toLowerCase().includes('virtual') ||
    event.title.toLowerCase().includes('telehealth') ||
    event.title.toLowerCase().includes('online');

  return (
    <div
      onClick={onClick}
      style={{
        ...style,
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
      }}
      className={cn(
        "absolute left-1 right-1 rounded-md overflow-hidden cursor-pointer",
        "hover:z-50 hover:scale-[1.02] transition-all duration-200",
        "shadow-lg hover:shadow-xl backdrop-blur-sm"
      )}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-start">
        {/* Title */}
        <div
          className="text-xs font-semibold truncate"
          style={{ color: colors.text }}
        >
          {event.title}
        </div>

        {/* Time and Icon */}
        <div className="flex items-center gap-1 text-[10px] text-gray-300 mt-0.5">
          {event.isDealActivity ? (
            <MapPin className="h-3 w-3" />
          ) : isVideoCall ? (
            <Video className="h-3 w-3" />
          ) : (
            <MapPin className="h-3 w-3" />
          )}
          <span>
            {formatTime(startTime)} - {formatTime(endTime)}
          </span>
        </div>

        {/* Participant (if there's space) */}
        {style.height && Number(style.height) > 60 && (
          <div className="text-[10px] text-gray-400 truncate mt-1">
            {event.isDealActivity ? otherPerson : `with ${otherPerson}`}
          </div>
        )}
      </div>
    </div>
  );
}
