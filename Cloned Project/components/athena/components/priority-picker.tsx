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
    activeColor?: string;
    bgColor?: string;
    borderColor?: string;
    contentClassName?: string;
}

export function PriorityPicker({ priority, onSelect, children, activeColor, bgColor, borderColor, contentClassName = "bg-[#0a0a0d]" }: PriorityPickerProps) {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (p: PriorityLevel) => {
        onSelect(p);
        setOpen(false);
    };

    const options: { label: string; value: PriorityLevel; color: string; iconColor: string }[] = [
        { label: "Urgent", value: "urgent", color: "text-red-600", iconColor: "fill-red-600 text-red-600" },
        { label: "High", value: "high", color: "text-amber-500", iconColor: "fill-amber-500 text-amber-500" },
        { label: "Normal", value: "normal", color: "text-blue-500", iconColor: "fill-blue-500 text-blue-500" },
        { label: "Low", value: "low", color: "text-white/50", iconColor: "fill-slate-500 text-white/50" },
        { label: "Clear", value: null, color: "text-white/50", iconColor: "text-white/50" },
    ];

    const uniqueId = React.useId().replace(/:/g, "");
    const styleId = `priority-picker-style-${uniqueId}`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                className={cn("w-56 p-0 border", contentClassName)}
                style={{ borderColor: borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)' }}
                align="start"
            >
                <style>{`
                    .${styleId}-item:hover {
                        background-color: ${bgColor || 'color-mix(in srgb, var(--brand) 8%, transparent)'} !important;
                    }
                `}</style>
                <div className="flex flex-col py-2">
                    <div className="px-3 pb-2 text-xs font-medium text-white/50">
                        Task Priority
                    </div>

                    {options.map((option) => (
                        <button
                            key={option.label}
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors text-left",
                                `${styleId}-item`
                            )}
                        >
                            {option.label === "Clear" ? (
                                <Ban className="h-4 w-4 text-white/50" />
                            ) : (
                                <Flag className={cn("h-4 w-4", option.iconColor)} />
                            )}
                            <span className={cn(option.value === priority && "font-medium text-white/50")}>
                                {option.label}
                            </span>
                        </button>
                    ))}

                    <div className="mx-3 my-1 border-t" style={{ borderColor: borderColor || 'color-mix(in srgb, var(--brand) 8%, transparent)' }} />
                </div>
            </PopoverContent>
        </Popover>
    );
}
