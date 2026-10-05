"use client";

import React, { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

/** Store as yyyy-mm-dd for reliable parse; display as "Month D, YYYY". */
function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseStoredDate(value: string): Date | null {
  if (!value?.trim()) return null;

  // Preferred: ISO yyyy-mm-dd
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  // Legacy: "July 10, 2026"
  const legacy = new Date(value);
  if (!isNaN(legacy.getTime())) {
    return new Date(legacy.getFullYear(), legacy.getMonth(), legacy.getDate());
  }
  return null;
}

function formatDisplay(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShort(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DatePickerRenderer({ block, editor }: { block: any; editor: any }) {
  const stored = block.props?.date || "";
  const parsed = parseStoredDate(stored);
  const today = startOfDay(new Date());
  const selectedDate = parsed ?? today;
  const display = formatDisplay(selectedDate);
  const [open, setOpen] = useState(!stored);
  const [month, setMonth] = useState<Date>(selectedDate);

  const tomorrow = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const nextWeek = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const applyDate = (date: Date) => {
    const normalized = startOfDay(date);
    editor.updateBlock(block, { props: { date: toISODate(normalized) } });
    setMonth(normalized);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setMonth(selectedDate);
  };

  const quickOptions = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: tomorrow },
    { label: "Next week", date: nextWeek },
  ];

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#2f3437]/80 hover:bg-[#3a4044] border border-white/[0.06] px-2 py-[3px] text-[13px] text-[#ebebea] transition-colors cursor-pointer"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-[#9b9a97] shrink-0" />
            <span className="font-medium leading-none">{display}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-0 bg-[#202020] border border-white/[0.08] shadow-2xl rounded-lg z-[99999] overflow-hidden"
          align="start"
          sideOffset={6}
        >
          {/* Quick picks — Notion-style rows */}
          <div className="py-1.5 px-1.5 border-b border-white/[0.06]">
            {quickOptions.map((opt) => {
              const active = sameDay(opt.date, selectedDate);
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => applyDate(opt.date)}
                  className={`w-full flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-[#ebebea] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[12px] text-[#9b9a97] tabular-nums">
                    {formatShort(opt.date)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Calendar */}
          <div className="p-2 notes-date-calendar">
            <CalendarUI
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={selectedDate}
              onSelect={(date) => {
                if (date) applyDate(date);
              }}
              className="p-0 bg-transparent"
              classNames={{
                months: "flex flex-col",
                month: "space-y-2",
                month_caption: "flex justify-center items-center h-8 relative",
                caption_label: "text-[13px] font-medium text-[#ebebea]",
                nav: "flex items-center",
                button_previous:
                  "absolute left-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-[#9b9a97] hover:bg-white/[0.06] hover:text-white border-0 bg-transparent p-0 opacity-100",
                button_next:
                  "absolute right-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-[#9b9a97] hover:bg-white/[0.06] hover:text-white border-0 bg-transparent p-0 opacity-100",
                month_grid: "w-full border-collapse",
                weekdays: "flex w-full",
                weekday:
                  "text-[#6f6e6b] rounded-md w-9 font-normal text-[11px] text-center",
                week: "flex w-full mt-0.5",
                day: "h-9 w-9 text-center text-sm p-0 relative",
                day_button:
                  "h-9 w-9 p-0 font-normal text-[13px] text-[#ebebea] rounded-md hover:bg-white/[0.08] inline-flex items-center justify-center",
                selected:
                  "bg-[#2383e2] text-white hover:bg-[#2383e2] hover:text-white focus:bg-[#2383e2] focus:text-white rounded-md",
                today: "bg-white/[0.06] text-white rounded-md",
                outside: "text-[#6f6e6b] opacity-50",
                disabled: "text-[#6f6e6b] opacity-40",
                hidden: "invisible",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const datePickerBlock = createReactBlockSpec(
  {
    type: "datePicker" as const,
    propSchema: {
      date: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <DatePickerRenderer block={block} editor={editor} />;
    },
  }
);
