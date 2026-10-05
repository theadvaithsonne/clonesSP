"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { AlarmClock, ChevronDown, Check } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { toast } from "sonner";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  getActiveNoteIdFromDom,
  getActiveNoteTitleFromDom,
  upsertNoteReminder,
} from "../../lib/notesReminders";

const REMINDER_TIMES = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
];

const QUICK_OPTIONS = [
  { date: "Today", time: "9:00 AM", label: "Today at 9:00 AM" },
  { date: "Tomorrow", time: "9:00 AM", label: "Tomorrow at 9:00 AM" },
  { date: "Tomorrow", time: "2:00 PM", label: "Tomorrow at 2:00 PM" },
  { date: "Next week", time: "9:00 AM", label: "Next week at 9:00 AM" },
];

function parseReminderDateTime(date: string, time: string, customDate = ""): Date | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let targetDate: Date;

  if (date === "Today") {
    targetDate = new Date(today);
  } else if (date === "Tomorrow") {
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (date === "Next week") {
    targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (date === "Custom" && customDate) {
    const parsed = new Date(customDate);
    if (isNaN(parsed.getTime())) return null;
    targetDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  } else {
    return null;
  }

  const [timeStr, period] = time.split(" ");
  let [hours, minutes] = timeStr.split(":").map(Number);

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
}

function formatCustomLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Custom date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scheduleReminder(
  blockId: string,
  date: string,
  time: string,
  customDate = ""
) {
  const fireAtDate = parseReminderDateTime(date, time, customDate);
  if (!fireAtDate) {
    toast.error("Could not schedule that reminder time");
    return false;
  }

  const noteTitle = getActiveNoteTitleFromDom();
  const noteId = getActiveNoteIdFromDom();

  upsertNoteReminder({
    blockId,
    noteId,
    noteTitle,
    date,
    time,
    customDate,
    fireAt: fireAtDate.toISOString(),
    triggered: false,
  });

  const whenLabel =
    date === "Custom" && customDate ? formatCustomLabel(customDate) : date;

  toast.success("Reminder set", {
    description: `We'll ring you for “${noteTitle}” — ${whenLabel} at ${time}`,
    duration: 4000,
  });
  return true;
}

function ReminderRenderer({ block, editor }: { block: any; editor: any }) {
  const reminderDate = block.props?.reminderDate || "";
  const reminderTime = block.props?.reminderTime || "9:00 AM";
  const customDate = block.props?.customDate || "";
  const isConfigured = Boolean(reminderDate);

  const [showPopup, setShowPopup] = useState(!isConfigured);
  const [selectedDate, setSelectedDate] = useState(reminderDate || "Tomorrow");
  const [selectedTime, setSelectedTime] = useState(reminderTime || "9:00 AM");
  const [selectedCustom, setSelectedCustom] = useState<Date | undefined>(
    customDate ? new Date(customDate) : undefined
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [isFired, setIsFired] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedDate(reminderDate || "Tomorrow");
    setSelectedTime(reminderTime || "9:00 AM");
    setSelectedCustom(customDate ? new Date(customDate) : undefined);
  }, [reminderDate, reminderTime, customDate]);

  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopup(false);
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopup]);

  // Reflect global fire event on this block's pill
  useEffect(() => {
    const onFired = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.blockId === block.id) setIsFired(true);
    };
    window.addEventListener("notes:reminder-fired", onFired as EventListener);
    return () => window.removeEventListener("notes:reminder-fired", onFired as EventListener);
  }, [block.id]);

  const persist = useCallback(
    (date: string, time: string, customIso = "") => {
      const ok = scheduleReminder(block.id, date, time, customIso);
      if (!ok) return;
      editor.updateBlock(block, {
        props: {
          reminderDate: date,
          reminderTime: time,
          customDate: customIso,
        },
      });
      setIsFired(false);
      setShowPopup(false);
      setShowCalendar(false);
    },
    [editor, block]
  );

  const saveReminder = useCallback(() => {
    if (selectedDate === "Custom") {
      if (!selectedCustom) {
        toast.error("Pick a custom date");
        return;
      }
      persist("Custom", selectedTime, selectedCustom.toISOString());
      return;
    }
    persist(selectedDate, selectedTime, "");
  }, [selectedDate, selectedTime, selectedCustom, persist]);

  const labelDate =
    reminderDate === "Custom" && customDate
      ? formatCustomLabel(customDate)
      : reminderDate || "Set reminder";

  return (
    <div className="w-full">
      <div className="relative inline-flex" ref={containerRef}>
        <span
          onClick={() => setShowPopup(!showPopup)}
          className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 cursor-pointer transition-colors ${
            isFired
              ? "bg-emerald-900/30 border-emerald-800/30 hover:bg-emerald-900/50"
              : "bg-amber-900/30 border-amber-800/30 hover:bg-amber-900/50"
          }`}
        >
          {isFired ? (
            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlarmClock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
          <span className={`text-[11px] font-medium ${isFired ? "text-emerald-300" : "text-amber-300"}`}>
            {isFired
              ? "Reminder fired!"
              : isConfigured
                ? `Remind me: ${labelDate} at ${reminderTime}`
                : "Set a reminder"}
          </span>
          <ChevronDown className="h-3 w-3 text-amber-400/50 ml-0.5" />
        </span>

        {showPopup && (
          <div className="absolute top-full left-0 mt-1 z-[99999] w-72 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden">
            <div className="p-2 border-b border-zinc-700/60">
              <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider px-1 mb-1.5">
                Quick
              </div>
              <div className="space-y-0.5">
                {QUICK_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => persist(opt.date, opt.time)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-300 hover:text-amber-300 hover:bg-zinc-700/50 rounded transition-colors"
                  >
                    <AlarmClock className="h-3 w-3 text-zinc-500" />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 space-y-2">
              <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider px-1">
                Custom
              </div>

              <div className="flex gap-1 flex-wrap">
                {["Today", "Tomorrow", "Next week", "Custom"].map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date);
                      setShowCalendar(date === "Custom");
                    }}
                    className={`text-[9px] px-2 py-1 rounded-full border transition-colors ${
                      selectedDate === date
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                    }`}
                  >
                    {date === "Custom" && selectedCustom
                      ? formatCustomLabel(selectedCustom.toISOString())
                      : date}
                  </button>
                ))}
              </div>

              {showCalendar && (
                <div className="rounded-md border border-zinc-700 overflow-hidden">
                  <CalendarUI
                    mode="single"
                    selected={selectedCustom}
                    onSelect={(d) => {
                      if (d) {
                        setSelectedCustom(d);
                        setSelectedDate("Custom");
                      }
                    }}
                    initialFocus
                  />
                </div>
              )}

              <div className="flex gap-1 flex-wrap">
                {REMINDER_TIMES.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                      selectedTime === time
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-1 border-t border-zinc-700/40">
                <button
                  type="button"
                  onClick={saveReminder}
                  className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1 rounded transition-colors font-medium"
                >
                  Set Reminder
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const reminderBlock = createReactBlockSpec(
  {
    type: "reminder" as const,
    propSchema: {
      reminderDate: { default: "", type: "string" },
      reminderTime: { default: "9:00 AM", type: "string" },
      customDate: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <ReminderRenderer block={block} editor={editor} />;
    },
  }
);
