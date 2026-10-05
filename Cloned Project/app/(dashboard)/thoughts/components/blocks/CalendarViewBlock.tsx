"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, FileDown } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

interface CalendarEvent {
  id: string;
  label: string;
}

let eventIdCounter = 1;

function generateId() {
  return `cal-event-${eventIdCounter++}`;
}

const DAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getWeekDates(monday: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function CalendarBlock({ block, editor }: { block: any; editor: any }) {
  const loadedEvents = block.props?.events ? JSON.parse(block.props.events) : {};
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>(loadedEvents);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const [openDayIndex, setOpenDayIndex] = useState<number | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventLabel, setEditingEventLabel] = useState("");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(monday);
  const month = MONTHS[monday.getMonth()];
  const year = monday.getFullYear();

  // Focus edit input when editing
  useEffect(() => {
    if (editingEventId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingEventId]);

  // Close popover on outside click
  useEffect(() => {
    if (openDayIndex === null) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenDayIndex(null);
        setEditingEventId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDayIndex]);

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const persistEvents = useCallback((newEvents: Record<string, CalendarEvent[]>) => {
    setEvents(newEvents);
    editor.updateBlock(block, { props: { events: JSON.stringify(newEvents) } });
  }, [editor, block]);

  const addEvent = useCallback((di: number) => {
    const d = weekDates[di];
    const key = dateKey(d);
    const newEvent: CalendarEvent = { id: generateId(), label: "" };
    const next = {
      ...eventsRef.current,
      [key]: [...(eventsRef.current[key] || []), newEvent],
    };
    persistEvents(next);
    setEditingEventId(newEvent.id);
    setEditingEventLabel("");
  }, [weekDates, persistEvents]);

  const commitEventLabel = useCallback(() => {
    if (!editingEventId) return;
    const label = editingEventLabel.trim() || "New event";
    const next: Record<string, CalendarEvent[]> = {};
    Object.keys(eventsRef.current).forEach((k) => {
      next[k] = eventsRef.current[k].map((e) =>
        e.id === editingEventId ? { ...e, label } : e
      );
    });
    persistEvents(next);
    setEditingEventId(null);
  }, [editingEventId, editingEventLabel, persistEvents]);

  const removeEvent = useCallback((di: number, eventId: string) => {
    const d = weekDates[di];
    const key = dateKey(d);
    const next = {
      ...eventsRef.current,
      [key]: (eventsRef.current[key] || []).filter((e) => e.id !== eventId),
    };
    persistEvents(next);
  }, [weekDates, persistEvents]);

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
        <button
          onClick={() => setWeekOffset((p) => p - 1)}
          className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-[13px] text-zinc-200 font-semibold">
          {month} {year}
        </span>
        <button
          onClick={() => setWeekOffset((p) => p + 1)}
          className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex px-3 py-2.5 gap-1">
        {DAYS_SHORT.map((dayLabel, di) => {
          const d = weekDates[di];
          const isToday = isSameDay(d, today);
          const key = dateKey(d);
          const dayEvents = events[key] || [];

          return (
            <div key={dayLabel} className="flex-1 flex flex-col items-center gap-0.5 relative">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
                {dayLabel}
              </span>
              <div className="relative overflow-visible">
                <span
                  onClick={() => setOpenDayIndex(openDayIndex === di ? null : di)}
                  className={`text-xs w-7 h-7 flex items-center justify-center font-semibold rounded-full transition-colors cursor-pointer ${
                    isToday
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                      : "text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  {d.getDate()}
                </span>

                {/* Popover */}
                {openDayIndex === di && (
                  <div
                    ref={popoverRef}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 min-w-[180px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 p-1.5"
                  >
                    <div className="text-[10px] text-zinc-400 font-medium px-1.5 pb-1 border-b border-zinc-700/60 mb-1">
                      {dayLabel}, {d.getMonth() + 1}/{d.getDate()}
                    </div>

                    {/* Existing events */}
                    {dayEvents.length > 0 && (
                      <div className="mb-1 max-h-32 overflow-y-auto space-y-0.5">
                        {dayEvents.map((ev) => (
                          <div key={ev.id} className="flex items-center gap-1.5 px-1.5 py-1">
                            {editingEventId === ev.id ? (
                              <input
                                ref={editInputRef}
                                value={editingEventLabel}
                                onChange={(e) => setEditingEventLabel(e.target.value)}
                                onBlur={commitEventLabel}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); commitEventLabel(); }
                                  if (e.key === "Escape") { setEditingEventId(null); }
                                }}
                                placeholder="Event name..."
                                className="flex-1 bg-zinc-900 text-[11px] text-zinc-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-500"
                                autoFocus
                              />
                            ) : (
                              <>
                                <div
                                  onClick={() => removeEvent(di, ev.id)}
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 cursor-pointer hover:bg-red-400 transition-colors shrink-0"
                                  title="Remove"
                                />
                                <span
                                  onClick={() => {
                                    setEditingEventId(ev.id);
                                    setEditingEventLabel(ev.label);
                                  }}
                                  className="text-[10px] text-zinc-300 truncate flex-1 cursor-text hover:text-white transition-colors"
                                >
                                  {ev.label}
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addEvent(di);
                      }}
                      className="w-full flex items-center gap-2 px-1.5 py-1.5 text-[11px] text-zinc-300 hover:text-emerald-300 hover:bg-zinc-700/50 rounded transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add Page
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDayIndex(null);
                      }}
                      className="w-full flex items-center gap-2 px-1.5 py-1.5 text-[11px] text-zinc-300 hover:text-sky-300 hover:bg-zinc-700/50 rounded transition-colors"
                    >
                      <FileDown className="h-3 w-3" />
                      Import
                    </button>
                  </div>
                )}
              </div>

              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center mt-0.5 max-w-full">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      onClick={() => removeEvent(di, ev.id)}
                      title={ev.label}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400 cursor-pointer hover:bg-red-400 transition-colors"
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[7px] text-zinc-500">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const calendarViewBlock = createReactBlockSpec(
  {
    type: "calendarView" as const,
    propSchema: {
      events: { default: "{}", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => <CalendarBlock block={block} editor={editor} />,
  }
);
