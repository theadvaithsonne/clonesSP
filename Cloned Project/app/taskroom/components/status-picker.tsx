"use client";

import * as React from "react";
import { Search, Square, PlayCircle, FlaskConical, CheckCircle2, MoreHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export type StatusValue = string;

interface StatusPickerProps {
    status?: string;
    onSelect: (status: StatusValue) => void;
    children: React.ReactNode;
    initialTasks?: any[];
}

export function StatusPicker({ status, onSelect, children, initialTasks }: StatusPickerProps) {
    const [open, setOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<"status" | "taskType">("status");
    const [search, setSearch] = React.useState("");

    const handleSelect = (s: StatusValue) => {
        onSelect(s);
        setOpen(false);
    };

    // Normalize input status for comparison (e.g. "To Do" vs "TO DO")
    const currentStatus = status || "To Do";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex flex-col">
                    {/* Tabs */}
                    <div className="flex items-center p-2 gap-1 bg-[#111116]/50">
                        <button
                            onClick={() => setActiveTab("status")}
                            className={cn(
                                "flex-1 rounded-md py-1.5 text-sm font-medium transition-all shadow-sm border",
                                activeTab === "status"
                                    ? "bg-[#111116] text-slate-200 border-[#e5e7eb29]"
                                    : "bg-transparent text-slate-400 border-transparent hover:bg-[#20202b]"
                            )}
                        >
                            Status
                        </button>
                        <button
                            onClick={() => setActiveTab("taskType")}
                            className={cn(
                                "flex-1 rounded-md py-1.5 text-sm font-medium transition-all border",
                                activeTab === "taskType"
                                    ? "bg-[#111116] text-slate-200 border-[#e5e7eb29] shadow-sm"
                                    : "bg-transparent text-slate-400 border-transparent hover:bg-[#20202b]"
                            )}
                        >
                            Task Type
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-2 pt-1 pb-2">
                        <div className="relative">
                            <input
                                className="h-8 w-full rounded-md border border-purple-200 bg-[#111116] px-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Status List */}
                    <div className="max-h-[300px] overflow-y-auto px-2 pb-2 space-y-3">
                        {initialTasks && initialTasks.length > 0 ? (
                            (Object.entries(
                                initialTasks.reduce((acc: Record<string, any[]>, taskGroup) => {
                                    const type = taskGroup.type || "unknown";
                                    if (!acc[type]) acc[type] = [];
                                    if (!acc[type].find(t => t.status === taskGroup.status)) {
                                        acc[type].push(taskGroup);
                                    }
                                    return acc;
                                }, {} as Record<string, any[]>)
                            ) as [string, any[]][]).map(([type, statusGroups]) => (
                                <div key={type}>
                                    <div className="px-2 py-1">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{type}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        {statusGroups.map((g: any) => (
                                            <button
                                                key={g.id || g.status}
                                                onClick={() => handleSelect(g.status)}
                                                className={cn(
                                                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-[#20202b] transition-colors",
                                                    currentStatus === g.status && "bg-[#1a1a24]"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Square className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="font-medium text-slate-300 uppercase text-[11px]">{g.status}</span>
                                                </div>
                                                {currentStatus === g.status && <Check className="h-3.5 w-3.5 text-slate-300" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="px-2 py-2 text-center text-xs text-slate-500">
                                No statuses available
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
