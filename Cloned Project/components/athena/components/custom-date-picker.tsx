"use client";

import * as React from "react";
import { format, addDays, nextMonday, nextSaturday, addWeeks, startOfDay, isSameDay, isValid, isBefore, isAfter, isWithinInterval } from "date-fns";
import { Calendar as CalendarIcon, Clock, X, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface CustomDatePickerProps {
    startDate?: Date;
    dueDate?: Date;
    onSelect: (dates: { start?: Date; due?: Date }) => void;
    children: React.ReactNode;
    defaultTab?: "start" | "due";
    activeColor?: string;
    bgColor?: string;
    borderColor?: string;
    contentClassName?: string;
}

export function CustomDatePicker({ startDate, dueDate, onSelect, children, defaultTab = "due", activeColor, bgColor, borderColor, contentClassName = "bg-[#0a0a0d]" }: CustomDatePickerProps) {
    const [internalStart, setInternalStart] = React.useState<Date | undefined>(startDate);
    const [internalDue, setInternalDue] = React.useState<Date | undefined>(dueDate);
    const [activeTab, setActiveTab] = React.useState<"start" | "due">(defaultTab);
    const [displayedMonth, setDisplayedMonth] = React.useState<Date>(new Date());
    const [open, setOpen] = React.useState(false);

    // Reset state when opening or when props change explicitly
    React.useEffect(() => {
        // Sync internal state with props only when the popover is not open
        // this prevents overwriting local changes (like clearing) during parent re-renders
        if (!open) {
            setInternalStart(startDate);
            setInternalDue(dueDate);
        }

        if (open) {
            // If defaultTab is provided, usually honor it (e.g. clicked Start column -> Start tab)
            // Exception: If we just have a start date and no due date, and we clicked generic 'set date', maybe hint due?
            // But if specific defaultTab is passed, it should generally win.
            if (startDate && !dueDate && defaultTab === "due") {
                setActiveTab("due");
            } else {
                setActiveTab(defaultTab);
            }

            // Set displayed month to the current date or selected date
            const initialDate = (defaultTab === 'due' && dueDate) ? dueDate : (startDate || new Date());
            if (isValid(initialDate)) {
                setDisplayedMonth(initialDate);
            }
        }
    }, [startDate, dueDate, open, defaultTab]);

    const handleSelect = (date: Date | undefined) => {
        if (!date) return;

        // Prevent selecting previous days
        const today = startOfDay(new Date());
        if (isBefore(date, today)) return;

        if (activeTab === "start") {
            // If clicking the same date that is already the start date, 
            // set it as both and close (quick single day selection)
            if (internalStart && isSameDay(date, internalStart)) {
                setInternalDue(date);
                onSelect({ start: date, due: date });
                setOpen(false);
                return;
            }

            setInternalStart(date);
            // Move to due tab automatically only if due date isn't set or is before the new start date
            if (!internalDue || isBefore(internalDue, date)) {
                setActiveTab("due");
            }
            onSelect({ start: date, due: internalDue });
        } else {
            // Setting due date
            // If picking a due date before the start date, swap or handle gracefully
            if (internalStart && isBefore(date, internalStart)) {
                // If it's earlier than start, we treat it as shifting the range or just a new single point
                setInternalDue(date);
                onSelect({ start: internalStart, due: date });
            } else {
                setInternalDue(date);
                onSelect({ start: internalStart, due: date });
            }
            setOpen(false);
        }
    };

    const handleClear = (type: "start" | "due", e: React.MouseEvent) => {
        e.stopPropagation();
        if (type === "start") {
            setInternalStart(undefined);
            onSelect({ start: undefined, due: internalDue });
            setActiveTab("start");
        } else {
            setInternalDue(undefined);
            onSelect({ start: internalStart, due: undefined });
            setActiveTab("due");
        }
    };

    // Shortcuts apply to ACTIVE tab
    const shortcuts = [
        { label: "Today", date: startOfDay(new Date()) },
        { label: "Tomorrow", date: addDays(startOfDay(new Date()), 1) },
        { label: "Next week", date: nextMonday(startOfDay(new Date())) },
        { label: "Next weekend", date: nextSaturday(startOfDay(new Date())) },
        { label: "2 weeks", date: addWeeks(startOfDay(new Date()), 2) },
        { label: "4 weeks", date: addWeeks(startOfDay(new Date()), 4) },
        { label: "8 weeks", date: addWeeks(startOfDay(new Date()), 8) },
    ];

    // Modifiers for range styling
    const modifiers = {
        range_start: internalStart,
        range_end: internalDue,
        range_middle: (date: Date) => {
            if (!internalStart || !internalDue) return false;
            return isWithinInterval(date, {
                start: internalStart < internalDue ? internalStart : internalDue,
                end: internalDue > internalStart ? internalDue : internalStart
            });
        }
    };

    const formatLabel = (date?: Date | null) => {
        if (!date || !isValid(date)) return "Set date";
        return format(date, "M/d/yy");
    };

    const uniqueId = React.useId().replace(/:/g, "");
    const styleId = `date-picker-style-${uniqueId}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                className={cn("w-[calc(100vw-16px)] max-w-[555px] p-0 border max-h-[min(90dvh,640px)] overflow-hidden", contentClassName)}
                style={{ borderColor: borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)' }}
                align="center"
                side="bottom"
                sideOffset={8}
                collisionPadding={12}
            >
                <style>{`
                    .${styleId}-shortcut:hover {
                        background-color: ${bgColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                    }
                    /* Calendar overrides */
                    .${styleId}-calendar .rdp-day_selected {
                        background-color: ${activeColor || 'var(--brand)'} !important;
                        color: ${activeColor ? '#ffffff' : 'var(--brand-foreground)'} !important;
                    }
                    .${styleId}-calendar .rdp-day_range_start {
                        background-color: ${activeColor || 'var(--brand)'} !important;
                        color: ${activeColor ? '#ffffff' : 'var(--brand-foreground)'} !important;
                        border-top-left-radius: 6px !important;
                        border-bottom-left-radius: 6px !important;
                    }
                    .${styleId}-calendar .rdp-day_range_end {
                        background-color: ${activeColor || 'var(--brand)'} !important;
                        color: ${activeColor ? '#ffffff' : 'var(--brand-foreground)'} !important;
                        border-top-right-radius: 6px !important;
                        border-bottom-right-radius: 6px !important;
                    }
                    .${styleId}-calendar .rdp-day_selected:hover {
                        background-color: ${activeColor || 'var(--brand)'} !important;
                        color: ${activeColor ? '#ffffff' : 'var(--brand-foreground)'} !important;
                    }
                    .${styleId}-calendar .rdp-day:hover:not(.rdp-day_selected) {
                        background-color: ${bgColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                        color: #ffffff !important;
                    }
                    .${styleId}-calendar .rdp-day_today {
                        border: 1px solid ${activeColor || 'var(--brand)'} !important;
                    }
                    .${styleId}-calendar .rdp-day_range_middle {
                        background-color: ${bgColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                        color: #ffffff !important;
                    }
                `}</style>
                <div className="flex flex-col sm:flex-row h-auto sm:h-[330px] min-h-0 max-h-[min(90dvh,640px)]">
                    {/* Calendar Area — shown first on mobile */}
                    <div className={cn("order-1 sm:order-2 flex min-h-0 flex-1 flex-col", contentClassName)}>
                        {/* Start / Due tabs */}
                        <div
                            className="flex items-center gap-1.5 sm:gap-2 border-b px-2 sm:px-4 py-2 flex-shrink-0"
                            style={{ borderColor: borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)' }}
                        >
                            <button
                                type="button"
                                onClick={() => setActiveTab("start")}
                                className={cn(
                                    "flex flex-1 min-w-0 items-center justify-between rounded-md px-2 py-2 sm:py-1.5 cursor-pointer transition-all border touch-manipulation",
                                    activeTab === "start" ? cn(contentClassName, "ring-0") : "border-transparent"
                                )}
                                style={{
                                    borderColor: activeTab === "start" ? (activeColor || "var(--brand)") : "transparent"
                                }}
                            >
                                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50 flex-shrink-0" />
                                    <span className={cn("text-xs sm:text-sm truncate", !internalStart && "text-white/50")}>
                                        {formatLabel(internalStart)}
                                    </span>
                                </div>
                                {internalStart && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleClear("start", e)}
                                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-white/50 hover:text-white/80 touch-manipulation"
                                        aria-label="Clear start date"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("due")}
                                className={cn(
                                    "flex flex-1 min-w-0 items-center justify-between rounded-md px-2 py-2 sm:py-1.5 cursor-pointer transition-all border touch-manipulation",
                                    activeTab === "due" ? cn(contentClassName, "ring-0") : "border-transparent"
                                )}
                                style={{
                                    borderColor: activeTab === "due" ? (activeColor || "var(--brand)") : "transparent"
                                }}
                            >
                                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50 flex-shrink-0" />
                                    <span className={cn("text-xs sm:text-sm truncate", !internalDue && "text-white/50")}>
                                        {formatLabel(internalDue)}
                                    </span>
                                </div>
                                {internalDue && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleClear("due", e)}
                                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-white/50 hover:text-white/80 touch-manipulation"
                                        aria-label="Clear due date"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </button>
                        </div>

                        <div className="flex justify-center items-start overflow-x-auto overflow-y-hidden px-1 sm:px-0 py-1 sm:py-0 min-h-0 flex-1">
                            <Calendar
                                mode="range"
                                month={displayedMonth}
                                onMonthChange={setDisplayedMonth}
                                modifiers={modifiers}
                                modifiersClassNames={{
                                    range_start: "bg-purple-600 text-white/50 hover:text-white/50 rounded-l-md rounded-r-none",
                                    range_end: "bg-purple-600 text-white/50 hover:text-white/50 rounded-r-md rounded-l-none",
                                    range_middle: "bg-[#e5e7eb29] text-purple-900 rounded-none "
                                }}
                                onDayClick={handleSelect}
                                disabled={{ before: startOfDay(new Date()) }}
                                className={cn(
                                    "rounded-md border-0 p-1 sm:p-0 scale-[0.92] sm:scale-100 origin-top",
                                    `${styleId}-calendar`
                                )}
                            />
                        </div>
                    </div>

                    {/* Shortcuts — horizontal scroll on mobile, sidebar on desktop */}
                    <div
                        className={cn("order-2 sm:order-1 w-full sm:w-[235px] flex-shrink-0 border-t sm:border-t-0 sm:border-r text-white/50 flex flex-col", contentClassName)}
                        style={{ borderColor: borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)' }}
                    >
                        <div className="px-3 py-2 text-[11px] sm:text-sm font-semibold text-white/50 uppercase tracking-wider sm:px-3 sm:pl-8 sm:mb-0">
                            {activeTab === "start" ? "Start Date" : "Due Date"}
                        </div>

                        {/* Mobile shortcuts */}
                        <div
                            className="sm:hidden flex gap-1.5 overflow-x-auto overscroll-x-contain px-2 pb-2 scrollbar-hide"
                            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        >
                            {shortcuts.map((s) => (
                                <button
                                    key={s.label}
                                    type="button"
                                    onClick={() => handleSelect(s.date)}
                                    className={cn(
                                        "flex-shrink-0 rounded-md border border-white/[0.06] px-3 py-2 text-left text-xs transition-colors touch-manipulation min-h-[40px]",
                                        `${styleId}-shortcut`
                                    )}
                                >
                                    <span className="block text-white/70 whitespace-nowrap">{s.label}</span>
                                    <span className="block text-[10px] text-white/40">{format(s.date, "E")}</span>
                                </button>
                            ))}
                        </div>

                        {/* Desktop shortcuts */}
                        <div className="hidden sm:block p-2 space-y-1 pl-8 flex-1 overflow-y-auto">
                            {shortcuts.map((s) => (
                                <button
                                    key={s.label}
                                    type="button"
                                    onClick={() => handleSelect(s.date)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between group transition-colors touch-manipulation",
                                        `${styleId}-shortcut`
                                    )}
                                >
                                    <span className="text-white/50">{s.label}</span>
                                    <span className="text-sm text-white/50 group-hover:text-white/50">
                                        {format(s.date, "E")}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
