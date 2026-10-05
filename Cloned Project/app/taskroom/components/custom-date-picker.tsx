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
}

export function CustomDatePicker({ startDate, dueDate, onSelect, children, defaultTab = "due" }: CustomDatePickerProps) {
    const [internalStart, setInternalStart] = React.useState<Date | undefined>(startDate);
    const [internalDue, setInternalDue] = React.useState<Date | undefined>(dueDate);
    const [activeTab, setActiveTab] = React.useState<"start" | "due">(defaultTab);
    const [open, setOpen] = React.useState(false);

    // Reset state when opening or when props change explicitly
    React.useEffect(() => {
        setInternalStart(startDate);
        setInternalDue(dueDate);

        if (open) {
            // If defaultTab is provided, usually honor it (e.g. clicked Start column -> Start tab)
            // Exception: If we just have a start date and no due date, and we clicked generic 'set date', maybe hint due?
            // But if specific defaultTab is passed, it should generally win.
            if (startDate && !dueDate && defaultTab === "due") {
                setActiveTab("due");
            } else {
                setActiveTab(defaultTab);
            }
        }
    }, [startDate, dueDate, open, defaultTab]);

    const handleSelect = (date: Date | undefined) => {
        if (!date) return;

        // Logic for setting dates
        if (activeTab === "start") {
            setInternalStart(date);

            // If new start is after existing due, clear due or move it? 
            // ClickUp allows start > due technically but visually acts as range. 
            // Let's just set start.

            // Auto-switch to due tab
            setActiveTab("due");

            // Notify parent immediately? usually partial updates are saved
            onSelect({ start: date, due: internalDue });
        } else {
            // Setting due date

            // If due is before start, that's invalid for a range usually. 
            // We can swap them or just set due. Let's just set due for flexibility.
            setInternalDue(date);

            onSelect({ start: internalStart, due: date });
            // Close on due date selection? User flow implies finishing.
            setOpen(false);
        }
    };

    const handleClear = (type: "start" | "due", e: React.MouseEvent) => {
        e.stopPropagation();
        if (type === "start") {
            setInternalStart(null);
            onSelect({ start: null, due: internalDue });
            setActiveTab("start");
        } else {
            setInternalDue(null);
            onSelect({ start: internalStart, due: null });
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

    const formatLabel = (date?: Date) => {
        if (!date || !isValid(date)) return "Set date";
        return format(date, "M/d/yy");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-[600px] p-0" align="start">
                <div className="flex flex-col sm:flex-row h-[420px]">
                    {/* Left Sidebar */}
                    <div className="w-full sm:w-[180px] border-r border-[#e5e7eb29] bg-[#111116]/50 flex flex-col">
                        <div className="p-2 space-y-1 flex-1 overflow-y-auto">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                {activeTab === "start" ? "Start Date" : "Due Date"}
                            </div>

                            <button
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-[#20202b] text-sm flex items-center justify-between group"
                            >
                                <span className="text-slate-300">Later</span>
                                <span className="text-xs text-slate-400">12:00 pm</span>
                            </button>

                            {shortcuts.map((s) => (
                                <button
                                    key={s.label}
                                    onClick={() => handleSelect(s.date)}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#20202b] text-sm flex items-center justify-between group transition-colors"
                                >
                                    <span>{s.label}</span>
                                    <span className="text-xs text-slate-400 group-hover:text-slate-400">
                                        {format(s.date, "E")}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="p-2 border-t border-[#e5e7eb29]">
                            <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-[#20202b] rounded-md">
                                <span>Set Recurring</span>
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Right Calendar Area */}
                    <div className="flex-1 flex flex-col bg-[#111116]">
                        {/* Top Bar Tabs */}
                        <div className="flex items-center gap-2 border-b border-[#e5e7eb29] px-4 py-3">
                            {/* Start Tab */}
                            <div
                                onClick={() => setActiveTab("start")}
                                className={cn(
                                    "flex-1 flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-all border",
                                    activeTab === "start"
                                        ? "bg-[#1a1a24] border-purple-300 ring-1 ring-purple-100"
                                        : "hover:bg-[#1a1a24] border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                                    <span className={cn("text-sm", !internalStart && "text-slate-400")}>
                                        {formatLabel(internalStart)}
                                    </span>
                                </div>
                                {internalStart && (
                                    <button onClick={(e) => handleClear("start", e)} className="text-slate-400 hover:text-slate-300">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Due Tab */}
                            <div
                                onClick={() => setActiveTab("due")}
                                className={cn(
                                    "flex-1 flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-all border",
                                    activeTab === "due"
                                        ? "bg-[#1a1a24] border-purple-300 ring-1 ring-purple-100"
                                        : "hover:bg-[#1a1a24] border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                                    <span className={cn("text-sm", !internalDue && "text-slate-400")}>
                                        {formatLabel(internalDue)}
                                    </span>
                                </div>
                                {internalDue && (
                                    <button onClick={(e) => handleClear("due", e)} className="text-slate-400 hover:text-slate-300">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-2 flex justify-center items-start h-full overflow-hidden">
                            <Calendar
                                mode="default"
                                month={activeTab === 'due' && internalDue ? internalDue : (internalStart || new Date())}
                                modifiers={modifiers}
                                modifiersClassNames={{
                                    range_start: "bg-purple-600 text-white hover:bg-purple-600 hover:text-white rounded-l-md rounded-r-none",
                                    range_end: "bg-purple-600 text-white hover:bg-purple-600 hover:text-white rounded-r-md rounded-l-none",
                                    range_middle: "bg-purple-100 text-purple-900 rounded-none hover:bg-purple-200"
                                }}
                                onDayClick={handleSelect}
                                className="rounded-md border-0"
                            />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
