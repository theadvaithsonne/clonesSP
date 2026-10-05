"use client";

import * as React from "react";
import { Flag, Ban, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export type PriorityLevel = "urgent" | "high" | "normal" | "low" | any;

interface PriorityPickerProps {
    priority?: PriorityLevel;
    onSelect: (priority: PriorityLevel) => void;
    children: React.ReactNode;
}

export function PriorityPicker({ priority, onSelect, children }: PriorityPickerProps) {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (p: PriorityLevel) => {
        onSelect(p);
        setOpen(false);
    };

    const options: { label: string; value: PriorityLevel; color: string; iconColor: string }[] = [
        { label: "Urgent", value: "urgent", color: "text-red-600", iconColor: "fill-red-600 text-red-600" },
        { label: "High", value: "high", color: "text-amber-500", iconColor: "fill-amber-500 text-amber-500" },
        { label: "Normal", value: "normal", color: "text-blue-500", iconColor: "fill-blue-500 text-blue-500" },
        { label: "Low", value: "low", color: "text-slate-400", iconColor: "fill-slate-500 text-slate-400" },
        { label: "Clear", value: null, color: "text-slate-400", iconColor: "text-slate-400" },
    ];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
                <div className="flex flex-col py-2">
                    <div className="px-3 pb-2 text-xs font-medium text-slate-400">
                        Task Priority
                    </div>

                    {options.map((option) => (
                        <button
                            key={option.label}
                            onClick={() => handleSelect(option.value)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-[#20202b] transition-colors"
                        >
                            {option.label === "Clear" ? (
                                <Ban className="h-4 w-4 text-slate-400" />
                            ) : (
                                <Flag className={cn("h-4 w-4", option.iconColor)} />
                            )}
                            <span className={cn(option.value === priority && "font-medium")}>
                                {option.label}
                            </span>
                        </button>
                    ))}

                    <div className="mx-3 my-1 border-t border-[#e5e7eb29]" />

                    <div className="px-2 pt-1">
                        <button className="flex w-full items-center justify-center gap-2 rounded-md border border-[#e5e7eb29] bg-[#111116] py-1.5 text-xs font-medium text-slate-300 hover:bg-[#1a1a24] transition-colors shadow-sm">
                            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                            Set up fill with AI
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
