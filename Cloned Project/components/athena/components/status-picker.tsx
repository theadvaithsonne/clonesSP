"use client";

import * as React from "react";
import { Search, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import Cookies from "js-cookie";
import { useParams } from "next/navigation";

const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";

export type StatusValue = string;

export interface Stage {
    _id: string;
    roomId: string;
    name: string;
    color: string;
    stageType: string;
    orderId: number;
    taskCount: number;
    status: string;
}

interface StatusPickerProps {
    status?: string;
    onSelect: (status: StatusValue, stage?: Stage) => void;
    children: React.ReactNode;
    initialTasks?: any[]; // kept for strict component compatibility
    roomId?: string; // Optional if you pass it directly
}

export function StatusPicker({ status, onSelect, children, roomId: propRoomId, initialTasks }: StatusPickerProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    // pagination state
    const [stages, setStages] = React.useState<Stage[]>([]);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);

    const isFetchingRef = React.useRef(false);
    const stateRef = React.useRef({ search, currentPage, hasMore });

    React.useEffect(() => {
        stateRef.current = { search, currentPage, hasMore };
    }, [search, currentPage, hasMore]);

    const params = useParams();
    // Fallback to various known URL params if no prop is provided
    const roomId = propRoomId || (params?.space as string) || (params?.id as string) || (params?.symbol as string) || "";

    const observerRef = React.useRef<HTMLDivElement | null>(null);

    const fetchStages = React.useCallback(async (page: number, searchQuery: string, isLoadMore = false) => {
        if (!roomId || isFetchingRef.current) return;

        isFetchingRef.current = true;
        setIsLoading(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const url = `${TASKROOM_API_URL}rooms/detail/${roomId}?page=${page}&size=20${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const json = await response.json();

            if (response.ok && json.status && json.data) {
                const fetchedStages = json.data as Stage[];

                // Sort by default stageType
                const order: Record<string, number> = { tostart: 0, active: 1, done: 2, closed: 3 };
                const sortedStages = [...fetchedStages].sort((a, b) => {
                    const orderA = order[a?.stageType] ?? 99;
                    const orderB = order[b?.stageType] ?? 99;
                    return orderA - orderB;
                });

                if (isLoadMore) {
                    setStages(prev => {
                        const newStages = sortedStages.filter(s => !prev.some(p => p._id === s._id));
                        return [...prev, ...newStages].sort((a, b) => {
                            const orderA = order[a?.stageType] ?? 99;
                            const orderB = order[b?.stageType] ?? 99;
                            return orderA - orderB;
                        });
                    });
                } else {
                    setStages(sortedStages);
                }

                if (json.metadata) {
                    setTotalPages(json.metadata.totalPages || 1);
                    setHasMore(page < (json.metadata.totalPages || 1));
                } else {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.error("Failed to fetch stages", error);
            setHasMore(false);
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [roomId]);

    // Reset and fetch when popover opens or search changes
    React.useEffect(() => {
        if (open) {
            const timeoutId = setTimeout(() => {
                setCurrentPage(1);
                fetchStages(1, search, false);
            }, 300);
            return () => clearTimeout(timeoutId);
        }
    }, [open, search, fetchStages]);

    // Handle Infinite scroll using IntersectionObserver native API
    React.useEffect(() => {
        if (!observerRef.current || !open) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const { search, currentPage, hasMore } = stateRef.current;
                if (!hasMore || isFetchingRef.current) return;

                const nextPage = currentPage + 1;
                setCurrentPage(nextPage);
                fetchStages(nextPage, search, true);
            }
        }, { threshold: 0.1 });

        observer.observe(observerRef.current);
        return () => observer.disconnect();
    }, [open, fetchStages]);

    const handleSelect = (stageId: string) => {
        onSelect(stageId, stages.find(s => s._id === stageId));
        setOpen(false);
        setSearch("");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 border border-[#2e2e38] bg-[#0a0a0d] shadow-xl" align="start">
                <div className="flex flex-col">
                    {/* Header */}
                    <div className="px-3 py-2.5 border-b border-[#2e2e38] bg-white/[0.02] rounded-t-md">
                        <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Select Status</span>
                    </div>

                    {/* Search Input */}
                    <div className="p-2 border-b border-[#2e2e38]">
                        <div className="relative flex items-center">
                            <Search className="absolute left-2 w-3 h-3 text-white/50" />
                            <input
                                className="h-8 w-full rounded bg-[#0a0a0d] border-none pl-8 pr-2.5 placeholder:text-[12px] text-[12px] placeholder:text-white/50 text-white/50 focus:outline-none focus:ring-1 focus:ring-[#e5e7eb29] transition-all"
                                placeholder="Search stages..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Status List */}
                    <div className="max-h-[250px] overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-[#333] hover:scrollbar-thumb-[#444] scrollbar-track-transparent">
                        {stages.length > 0 ? (
                            stages.map((stage) => {
                                const isSelected = status === stage._id || status === stage.name;

                                return (
                                    <button
                                        key={stage._id}
                                        onClick={() => handleSelect(stage._id)}
                                        className={cn(
                                            "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-sm hover:bg-white/[0.05] transition-colors group",
                                            isSelected && "bg-white/[0.05]"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                                                style={{ backgroundColor: stage.color || '#3b82f6' }}
                                            />
                                            <span className="font-medium text-white/50 text-[12px] group-hover:text-white transition-colors">{stage.name}</span>
                                        </div>
                                        {isSelected && <Check className="h-3.5 w-3.5 text-[#e5e7eb29]" />}
                                    </button>
                                );
                            })
                        ) : (
                            !isLoading && (
                                <div className="py-4 text-center text-sm text-white/50">
                                    No stages found
                                </div>
                            )
                        )}

                        {/* Loading / Observer Element */}
                        {isLoading && (
                            <div className="flex justify-center py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                            </div>
                        )}
                        {hasMore && !isLoading && (
                            <div ref={observerRef} className="h-2 w-full" />
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
