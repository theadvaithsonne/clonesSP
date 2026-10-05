"use client";

import * as React from "react";
import { Search, UserPlus, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface User {
    id: string;
    name: string;
    email?: string;
    initials: string;
    color: string; // Tailwind bg color class
    image?: string;
}

const MOCK_USERS: User[] = [
    { id: "1", name: "Sakshi Mohta", initials: "SM", color: "bg-[#2E2E3A]" }, // Dark
    { id: "me", name: "Me", initials: "KS", color: "bg-emerald-500" },
    { id: "2", name: "Abhishek Sawant", initials: "AS", color: "bg-[#1C1C1E]" },
    { id: "3", name: "RoopKumar", initials: "R", color: "bg-blue-600" },
];

interface AssigneePickerProps {
    assignee?: string;
    onSelect: (assignee: string | undefined) => void;
    children: React.ReactNode;
}

export function AssigneePicker({ assignee, onSelect, children }: AssigneePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const filteredUsers = MOCK_USERS.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (user: User) => {
        if (assignee === user.name) {
            onSelect(undefined); // Unassign
        } else {
            onSelect(user.name);
        }
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <div className="flex flex-col p-2 gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            className="h-9 w-full rounded-md border border-[#e5e7eb29] bg-[#111116] pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-shadow"
                            placeholder="Search or enter email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="text-[11px] font-semibold text-slate-400 px-1 mt-1">
                        Assignees
                    </div>

                    <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
                        {filteredUsers.map(user => {
                            const isAssigned = assignee === user.name;
                            return (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelect(user)}
                                    className={cn(
                                        "group flex items-center justify-between w-full p-1.5 rounded-md hover:bg-[#20202b] transition-colors text-left",
                                        isAssigned && "bg-[#1a1a24]"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            {user.image ? (
                                                <img 
                                                    src={user.image} 
                                                    alt={user.name} 
                                                    className="h-6 w-6 rounded-full object-cover shadow-sm"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div 
                                                className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white", user.color)}
                                                style={{ display: user.image ? 'none' : 'flex' }}
                                            >
                                                {user.initials}
                                            </div>
                                            {/* X Badge on assign (mimics screenshot red x circle) */}
                                            {isAssigned && (
                                                <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-[#111116] rounded-full flex items-center justify-center shadow-sm z-10">
                                                    <div className="h-3 w-3 bg-red-500 rounded-full flex items-center justify-center">
                                                        <X className="h-2 w-2 text-white" strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-sm text-slate-300 font-medium">
                                            {user.name}
                                        </span>
                                    </div>

                                    {/* Right side actions - visually mimicking the screenshot */}
                                    {isAssigned && (
                                        <div className="flex items-center gap-1 animate-in fade-in duration-200">
                                            <span className="text-[10px] border border-[#e5e7eb29] rounded px-1.5 py-0.5 text-slate-400 bg-[#111116] shadow-sm hover:bg-[#1a1a24]">Profile</span>
                                            <div className="h-5 w-5 border border-[#e5e7eb29] rounded flex items-center justify-center bg-[#111116] shadow-sm text-slate-400 hover:text-purple-600 hover:border-purple-200">
                                                <RefreshCw className="h-3 w-3" />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}

                        <button className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-[#20202b] transition-colors text-left mt-1 text-slate-300">
                            <div className="h-6 w-6 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                                <UserPlus className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">Invite people via email</span>
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
