"use client";

import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import type { Column, Task, User, Employee } from "../types/kanban";

interface ListViewProps {
    columns: Column[];
    users: User[];
    stagecolumns: Task[];
    setStagecolumns: React.Dispatch<React.SetStateAction<Task[]>>;
    employees: Employee[];
    onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
    onTaskMove: (taskId: string, newColumnId: string, newIndex: number) => void;
    fetchListView: (page: number) => Promise<void>;
    hasMore: boolean;
    isFetching: boolean;
    nextPageToFetch: number;
}

export function ListView({
    columns,
    users,
    onTaskUpdate,
    fetchListView,
    employees,
    stagecolumns,
    setStagecolumns,
    onTaskMove,
    hasMore,
    isFetching,
    nextPageToFetch,
}: ListViewProps) {
    const [sortBy, setSortBy] = useState<string>("dueDate");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        const sentinel = sentinelRef.current;

        if (!scrollContainer || !sentinel || !hasMore) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isFetching && hasMore) {
                    fetchListView(nextPageToFetch);
                }
            },
            {
                root: scrollContainer,
                rootMargin: "200px",
                threshold: 0,
            }
        );

        observerRef.current.observe(sentinel);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [fetchListView, isFetching, hasMore, nextPageToFetch]);

    // Helper: Get employee name
    const getEmployeeName = (id: string): string => {
        const employee = employees?.find((emp) => emp.id === id);
        return employee ? employee.name : "Unassigned";
    };

    // Helper: Get stage color
    const getStageColor = (id: string): string => {
        const column = columns?.find((col) => col._id === id);
        return column?.color || "transparent";
    };

    // Helper: Status color
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "backlog": return "bg-gray-800 text-gray-400";
            case "in progress": return "bg-blue-500/20 text-blue-400";
            case "review": return "bg-yellow-500/20 text-yellow-400";
            case "done": return "bg-green-500/20 text-green-400";
            default: return "bg-gray-800 text-gray-400";
        }
    };

    // Helper: Priority color
    const getPriorityColor = (priority?: string): string => {
        const p = priority?.toLowerCase() || "";
        switch (p) {
            case "high":
                return "bg-red-500/20 text-red-400";
            case "medium":
                return "bg-yellow-500/20 text-yellow-400";
            case "low":
                return "bg-green-500/20 text-green-400";
            default:
                return "bg-gray-800 text-gray-400";
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0e0e12]">
            <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
                <table className="w-full table-auto">
                    <thead className="bg-[#1e1e2d] border-b border-[#e5e7eb29] sticky top-0" style={{ zIndex: 9 }}>
                        <tr>
                            <th className="text-left p-4 font-semibold text-xs text-gray-400 uppercase tracking-wider pl-7">Task Name</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-400 uppercase tracking-wider">Owner</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-400 uppercase tracking-wider">Priority</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-400 uppercase tracking-wider">Due Date</th>
                            <th className="text-left p-4 font-semibold text-xs text-gray-400 uppercase tracking-wider">Tags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stagecolumns.length > 0 ? (
                            stagecolumns.map((task,i) => (
                                <tr key={i} className="border-b border-[#e5e7eb29] hover:bg-[#1e1e2d] transition-colors">
                                    <td className="p-4 pl-8">
                                        <div>
                                            <div className="font-medium text-sm text-white">{task.title}</div>
                                            <div className="text-xs text-gray-400 mt-1">{task.description}</div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-xs bg-[#1e1e2d] text-gray-400 border border-[#e5e7eb29]">
                                                    {task.assignedToId && getEmployeeName(task.assignedToId)[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm text-gray-300">
                                                {task.assignedToId ? getEmployeeName(task.assignedToId) : "Unassigned"}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Select
                                            value={task.stageId || undefined}   // ← this is the key
                                            onValueChange={(value) =>
                                                onTaskMove(task._id ?? task.id ?? "", value, 0)
                                            }
                                        >
                                            <SelectTrigger
                                                className="text-black"
                                                style={{
                                                    backgroundColor: task.stageId
                                                        ? getStageColor(task.stageId)
                                                        : "rgb(148 163 184)" // slate-400 as fallback
                                                }}
                                            >
                                                <SelectValue placeholder="..." />   {/* or "No stage", "Choose…" */}
                                            </SelectTrigger>

                                            <SelectContent>
                                                {columns.map((column) => (
                                                    <SelectItem key={column._id} value={column._id}>
                                                        {column.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="p-4">
                                        <Badge className={`${getPriorityColor(task?.priority)} border-0 `}>
                                            {task.priority || "None"}
                                        </Badge>
                                    </td>
                                    <td className="p-4">
                                        {task.dueDate && (
                                            <div className="flex items-center gap-1 text-sm text-gray-400">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(task.dueDate).toLocaleDateString()}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {task.tags?.slice(0, 2).map((tag, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs bg-[#1e1e2d] text-gray-300 border border-[#e5e7eb29]">
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {task.tags && task.tags.length > 2 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{task.tags.length - 2}
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="p-4 text-center text-gray-500">
                                    <div className="py-8">No tasks available</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Sentinel for infinite scroll */}
                <div ref={sentinelRef} style={{ height: "1px", visibility: "hidden" }} />

                {/* Loading spinner */}
                {isFetching && (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    </div>
                )}
            </div>
        </div>
    );
}