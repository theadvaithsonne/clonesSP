"use client";

import React, { useEffect, useState, useRef } from "react";
import { EventCard } from "./EventCard";
import {
  getWeekDays,
  getMonthDays,
  calculateEventPosition,
  getCurrentTimePosition,
  isTimeInView,
  generateTimeSlots,
  getEventsForDay,
  isToday,
  eventsOverlap,
} from "@/lib/calendarUtils";
import type { CalendarEvent, ViewMode } from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";
import { FollowUpGroupCard } from "./FollowUpGroupCard";

interface CalendarGridProps {
  events: CalendarEvent[];
  currentDate: Date;
  viewMode: ViewMode;
  startHour?: number;
  endHour?: number;
  onEventClick: (event: CalendarEvent) => void;
  meId: string;
}

const SLOT_HEIGHT = 48; // Height of 30-minute slot in pixelss

type DayLayoutItem =
  | { kind: "single"; event: CalendarEvent }
  | { kind: "followupGroup"; events: CalendarEvent[]; key: string };

function isDealFollowUp(e: CalendarEvent): boolean {
  return Boolean(e.isDealActivity && e.activityType === "follow-up");
}

/** Overlap-connected clusters of deal follow-ups only. */
function clusterFollowUpsByOverlap(followUps: CalendarEvent[]): CalendarEvent[][] {
  if (followUps.length === 0) return [];
  const n = followUps.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (eventsOverlap(followUps[i], followUps[j])) union(i, j);
    }
  }

  const buckets = new Map<number, CalendarEvent[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!buckets.has(r)) buckets.set(r, []);
    buckets.get(r)!.push(followUps[i]);
  }
  return Array.from(buckets.values());
}

/** Merges overlapping deal follow-ups into one grouped item (day/week only). */
function buildDayLayoutItems(dayEvents: CalendarEvent[]): DayLayoutItem[] {
  const followUps = dayEvents.filter(isDealFollowUp);
  const others = dayEvents.filter((e) => !isDealFollowUp(e));
  const clusters = clusterFollowUpsByOverlap(followUps);
  const items: DayLayoutItem[] = [];

  for (const e of others) {
    items.push({ kind: "single", event: e });
  }
  for (const cluster of clusters) {
    if (cluster.length <= 1) {
      items.push({ kind: "single", event: cluster[0] });
    } else {
      items.push({
        kind: "followupGroup",
        events: cluster,
        key: cluster
          .map((e) => e._id)
          .sort()
          .join("|"),
      });
    }
  }

  items.sort((a, b) => {
    const sa =
      a.kind === "single"
        ? new Date(a.event.startTime).getTime()
        : Math.min(
            ...a.events.map((e) => new Date(e.startTime).getTime())
          );
    const sb =
      b.kind === "single"
        ? new Date(b.event.startTime).getTime()
        : Math.min(
            ...b.events.map((e) => new Date(e.startTime).getTime())
          );
    return sa - sb;
  });

  return items;
}

function eventForGroupBounds(events: CalendarEvent[]): CalendarEvent {
  const starts = events.map((e) => new Date(e.startTime).getTime());
  const ends = events.map((e) => new Date(e.endTime).getTime());
  const minT = Math.min(...starts);
  let maxT = Math.max(...ends);
  if (maxT <= minT) maxT = minT + 30 * 60 * 1000;
  return {
    ...events[0],
    _id: `followup-group-${minT}`,
    startTime: new Date(minT).toISOString(),
    endTime: new Date(maxT).toISOString(),
  };
}

export function CalendarGrid({
  events,
  currentDate,
  viewMode,
  startHour = 6,
  endHour = 24,
  onEventClick,
  meId,
}: CalendarGridProps) {
  const [currentTimeTop, setCurrentTimeTop] = useState<number>(
    getCurrentTimePosition(startHour, SLOT_HEIGHT)
  );
  const [expandedMonthDayKey, setExpandedMonthDayKey] = useState<string | null>(
    null
  );
  const gridRef = useRef<HTMLDivElement>(null);

  // Update current time position every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeTop(getCurrentTimePosition(startHour, SLOT_HEIGHT));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [startHour]);

  // Scroll to current time on mount (only for day/week view)
  useEffect(() => {
    if (
      viewMode !== "month" &&
      gridRef.current &&
      isTimeInView(startHour, endHour)
    ) {
      const scrollTo = Math.max(0, currentTimeTop - 200);
      gridRef.current.scrollTop = scrollTo;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when switching views only; omit time/hour deps to avoid jumping every minute
  }, [viewMode]);

  const weekDays =
    viewMode === "week"
      ? getWeekDays(currentDate)
      : viewMode === "month"
        ? getMonthDays(currentDate)
        : [currentDate];
  const timeSlots = generateTimeSlots(startHour, endHour);
  const showCurrentTime =
    isTimeInView(startHour, endHour) && viewMode !== "month";

  const computeDayEventLayoutsFromItems = (layoutItems: DayLayoutItem[]) => {
    type Item = { idx: number; start: number; end: number };
    const items: Item[] = layoutItems
      .map((layoutItem, idx) => {
        let start: number;
        let end: number;
        if (layoutItem.kind === "single") {
          start = new Date(layoutItem.event.startTime).getTime();
          end = new Date(layoutItem.event.endTime).getTime();
        } else {
          const evs = layoutItem.events;
          start = Math.min(...evs.map((e) => new Date(e.startTime).getTime()));
          end = Math.max(...evs.map((e) => new Date(e.endTime).getTime()));
        }
        if (end <= start) end = start + 30 * 60 * 1000;
        return { idx, start, end };
      })
      .sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

    const layouts = new Map<number, { column: number; columns: number }>();
    const active: Array<{ end: number; column: number; idx: number }> = [];
    let clusterIndices: number[] = [];
    let clusterMaxColumns = 0;

    const flushCluster = () => {
      if (!clusterIndices.length) return;
      const safeColumns = Math.max(clusterMaxColumns, 1);
      clusterIndices.forEach((eventIdx) => {
        const existing = layouts.get(eventIdx);
        if (!existing) return;
        layouts.set(eventIdx, { ...existing, columns: safeColumns });
      });
      clusterIndices = [];
      clusterMaxColumns = 0;
    };

    for (const item of items) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].end <= item.start) {
          active.splice(i, 1);
        }
      }

      if (active.length === 0) {
        flushCluster();
      }

      const usedColumns = new Set(active.map((entry) => entry.column));
      let column = 0;
      while (usedColumns.has(column)) column += 1;

      active.push({ end: item.end, column, idx: item.idx });
      layouts.set(item.idx, { column, columns: 1 });
      clusterIndices.push(item.idx);
      clusterMaxColumns = Math.max(clusterMaxColumns, active.length);
    }

    flushCluster();
    return layouts;
  };

  // Month view -  calendar grid
  if (viewMode === "month") {
    const monthDays = getMonthDays(currentDate);
    const currentMonth = currentDate.getMonth();

    return (
      <div className="flex-1 overflow-hidden bg-[#111116]">
        <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-px">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-white/5">
              {monthDays.map((day, index) => {
                const dayEvents = getEventsForDay(events, day);
                const isCurrentMonth = day.getMonth() === currentMonth;
                const isTodayDate = isToday(day);
                const dayKey = day.toISOString().split("T")[0];
                const isExpanded = expandedMonthDayKey === dayKey;
                const visibleEvents = isExpanded
                  ? dayEvents
                  : dayEvents.slice(0, 3);

                return (
                  <div
                    key={index}
                    className={cn(
                      "bg-[#111116] min-h-[120px] p-2 border border-white/10",
                      !isCurrentMonth && "opacity-40",
                      isTodayDate && "bg-yellow-500/5 border-yellow-500/30"
                    )}
                  >
                    {/* Date number */}
                    <div className="flex justify-between items-start mb-2">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isTodayDate
                            ? "w-7 h-7 rounded-full bg-yellow-500 text-black flex items-center justify-center"
                            : isCurrentMonth
                              ? "text-white"
                              : "text-gray-500"
                        )}
                      >
                        {day.getDate()}
                      </div>
                    </div>

                    {/* Events */}
                    <div
                      className={cn(
                        "space-y-1",
                        isExpanded && "max-h-[170px] overflow-y-auto pr-1"
                      )}
                    >
                      {visibleEvents.map((event) => (
                        <button
                          key={event._id}
                          onClick={() => onEventClick(event)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded text-xs truncate transition-colors",
                            event.isDealActivity
                              ? "bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30"
                              : "bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30"
                          )}
                        >
                          {new Date(event.startTime).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            }
                          )}{" "}
                          {event.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && !isExpanded && (
                        <button
                          type="button"
                          onClick={() => setExpandedMonthDayKey(dayKey)}
                          className="text-xs text-gray-400 hover:text-gray-200 pl-2"
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                      {dayEvents.length > 3 && isExpanded && (
                        <button
                          type="button"
                          onClick={() => setExpandedMonthDayKey(null)}
                          className="text-xs text-gray-400 hover:text-gray-200 pl-2"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Day/Week view - time slot grid
  return (
    <div className="flex-1 overflow-hidden bg-[#111116]">
      <div
        ref={gridRef}
        className="h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
      >
        <div className="relative">
          {/* Header with day names */}
          <div className="sticky top-0 z-20 bg-[#111116] border-b border-white/10">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)`,
              }}
            >
              {/* Empty corner cell */}
              <div className="border-r border-white/10 h-16" />

              {/* Day headers */}
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 border-r border-white/10",
                    isToday(day) && "bg-yellow-500/10"
                  )}
                >
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div
                    className={cn(
                      "text-2xl font-semibold mt-1",
                      isToday(day)
                        ? "w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center"
                        : "text-white"
                    )}
                  >
                    {day.getDate().toString().padStart(2, "0")}
                  </div>
                  {isToday(day) && (
                    <div className="text-[10px] text-yellow-400 font-medium mt-1">
                      TODAY
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Time grid */}
          <div className="relative">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `60px repeat(${weekDays.length}, 1fr)`,
                gridAutoRows: `${SLOT_HEIGHT}px`,
              }}
            >
              {/* Time slots */}
              {timeSlots.map((time, timeIndex) => {
                const isHour = time.endsWith(":00");

                return (
                  <React.Fragment key={`timeslot-${timeIndex}`}>
                    {/* Time label */}
                    <div
                      className={cn(
                        "border-r border-white/10 px-2 text-right",
                        isHour
                          ? "border-t border-white/10"
                          : "border-t border-white/5"
                      )}
                      style={{ gridColumn: 1 }}
                    >
                      {isHour && (
                        <span className="text-xs text-gray-400 -mt-2 inline-block">
                          {time}
                        </span>
                      )}
                    </div>

                    {/* Day cells */}
                    {weekDays.map((day, dayIndex) => (
                      <div
                        key={`cell-${timeIndex}-${dayIndex}`}
                        className={cn(
                          "border-r border-white/10 relative",
                          isHour
                            ? "border-t border-white/10"
                            : "border-t border-white/5",
                          isToday(day) && "bg-yellow-500/5"
                        )}
                        style={{ gridColumn: dayIndex + 2 }}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Events overlay */}
            <div
              className="absolute top-0 left-[60px] right-0 pointer-events-none"
              style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
            >
              <div
                className="relative h-full"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${weekDays.length}, 1fr)`,
                }}
              >
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = getEventsForDay(events, day);
                  const layoutItems = buildDayLayoutItems(dayEvents);
                  const dayLayouts =
                    computeDayEventLayoutsFromItems(layoutItems);

                  return (
                    <div
                      key={dayIndex}
                      className="relative pointer-events-auto"
                    >
                      {layoutItems.map((item, itemIndex) => {
                        const layout = dayLayouts.get(itemIndex) || {
                          column: 0,
                          columns: 1,
                        };
                        const widthPercent = 100 / layout.columns;
                        const leftPercent = layout.column * widthPercent;
                        const baseStyle = {
                          top: "0px",
                          height: "0px",
                          left: `calc(${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                          right: "auto" as const,
                          zIndex: layout.column + 1,
                        };

                        if (item.kind === "followupGroup") {
                          const boundsEvent = eventForGroupBounds(item.events);
                          const { top, height } = calculateEventPosition(
                            boundsEvent,
                            day,
                            startHour,
                            SLOT_HEIGHT
                          );
                          return (
                            <FollowUpGroupCard
                              key={item.key}
                              events={item.events}
                              style={{
                                ...baseStyle,
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                              onSelectEvent={onEventClick}
                            />
                          );
                        }

                        const event = item.event;
                        const { top, height } = calculateEventPosition(
                          event,
                          day,
                          startHour,
                          SLOT_HEIGHT
                        );
                        return (
                          <EventCard
                            key={`${event._id}-${itemIndex}`}
                            event={event}
                            meId={meId}
                            style={{
                              ...baseStyle,
                              top: `${top}px`,
                              height: `${height}px`,
                            }}
                            onClick={() => onEventClick(event)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current time indicator */}
            {showCurrentTime && (
              <div
                className="absolute left-0 right-0 z-30 pointer-events-none"
                style={{ top: `${currentTimeTop}px` }}
              >
                <div className="flex items-center">
                  <div className="w-[60px] flex justify-end pr-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                  </div>
                  <div className="flex-1 h-[2px] bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
