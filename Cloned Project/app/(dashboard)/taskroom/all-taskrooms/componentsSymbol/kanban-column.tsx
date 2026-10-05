"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column, Task, DragEvent, Employee } from "../types/kanban";
import { TaskCard } from "./task-card";
import { useRef, useEffect, useState, useCallback } from "react";

interface KanbanColumnProps {
    column: Column;
    activeDrags: DragEvent[];
    onAddTask: (columnId: string) => void;
    onTaskClick?: (task: Task) => void;
    employees: Employee[];
    stageList: Column[];
    fetchTasksForStage: (stageId: string) => Promise<void>;
    stageExhausted: Record<string, boolean>;
    isSortable?: boolean;
    isLastColumn?: boolean;
    isDragOver?: boolean;
    isDragging?: boolean;
}

export function KanbanColumn({
    column,
    activeDrags,
    onAddTask,
    onTaskClick,
    fetchTasksForStage,
    employees,
    stageList,
    stageExhausted,
    isSortable = false,
    isLastColumn = false,
    isDragOver = false,
    isDragging = false,
}: KanbanColumnProps) {
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column._id });

    // Make column sortable if enabled and not the last column
    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging: isColumnDragging,
    } = useSortable({
        id: column._id,
        disabled: !isSortable || isLastColumn,
        data: {
            type: "column",
            column,
        },
    });

    // Combine refs for both sortable and droppable
    const setNodeRef = useCallback((node: HTMLDivElement | null) => {
        setSortableRef(node);
        setDroppableRef(node);
    }, [setSortableRef, setDroppableRef]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isColumnDragging || isDragging ? 0.5 : 1,
    };

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const isFetchingRef = useRef(false);

    const totalTaskCountui = column.taskCount ?? 0;
    const totalTaskCount = column?.tasks?.length ?? 0;
    // ──────────────────────────────────────────────────────────────
    // Can we fetch more?
    // ──────────────────────────────────────────────────────────────
    const canFetchMore = useCallback(() => {
        return (
            !stageExhausted[column._id] &&
            !isFetchingRef.current &&
            totalTaskCount >= 30
        );
    }, [column._id, totalTaskCount, stageExhausted]);

    // ──────────────────────────────────────────────────────────────
    // Trigger fetch (shared, safe)
    // ──────────────────────────────────────────────────────────────
    const triggerFetch = useCallback(async () => {
        if (!canFetchMore()) return;

        isFetchingRef.current = true;
        setIsLoading(true);

        try {
            await fetchTasksForStage(column._id);
        } catch (err) {
            console.error(`[fetch] Failed for ${column.name}:`, err);
        } finally {
            setIsLoading(false);
            isFetchingRef.current = false;
        }
    }, [column._id, column.name, fetchTasksForStage, canFetchMore]);

    // ──────────────────────────────────────────────────────────────
    // Auto-fetch on mount ONLY if column is empty/short
    // ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (column.tasks.length === 0 && canFetchMore()) {
            triggerFetch();
        }
    }, []); // Run only once on mount

    // ──────────────────────────────────────────────────────────────
    // SCROLL-TO-LOAD: Only when near bottom + debounce
    // ──────────────────────────────────────────────────────────────
    const handleScroll = useCallback(
        (e: Event) => {
            if (!canFetchMore()) return;

            const target = e.target as HTMLDivElement;
            const { scrollTop, scrollHeight, clientHeight } = target;

            const threshold = 150; // px from bottom
            const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;

            if (isNearBottom) {
                triggerFetch();
            }
        },
        [canFetchMore, triggerFetch]
    );

    // Throttled scroll with debounce
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedScroll = (e: Event) => {
            if (timeoutId) return; // Block multiple calls

            timeoutId = setTimeout(() => {
                handleScroll(e);
                timeoutId = null;
            }, 300); // 300ms debounce
        };

        container.addEventListener("scroll", debouncedScroll, { passive: true });

        return () => {
            container.removeEventListener("scroll", debouncedScroll);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [handleScroll]);

    // Optional: Re-check if content height changes (e.g. after drag/drop)
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (column.tasks.length > 0 && canFetchMore()) {
                const container = scrollContainerRef.current;
                const content = contentRef.current;
                if (!container || !content) return;

                const visibleHeight = container.clientHeight;
                const contentHeight = content.scrollHeight;

                if (contentHeight < visibleHeight * 0.8) {
                    triggerFetch();
                }
            }
        });

        if (contentRef.current) {
            observer.observe(contentRef.current);
        }

        return () => observer.disconnect();
    }, [canFetchMore, triggerFetch, column.tasks.length]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex-shrink-0 w-80 h-full transition-all duration-200`}
        >
            <Card className={`h-full p-0 bg-[#0e0e12] flex flex-col transition-all duration-200 ${isDragOver
                ? 'shadow-2xl border-2 border-white/20 border-dashed'
                : isDragging
                    ? 'opacity-50'
                    : 'border-0 shadow-none'
                }`}>
                {/* Header */}
                <div
                    className={`p-4 rounded-xl flex-shrink-0 sticky top-0 z-10 transition-all duration-200 ${isDragOver ? 'ring-2 ring-white/20' : ''
                        }`}
                    style={{
                        background: column?.color,
                        cursor: isSortable && !isLastColumn ? (isDragging ? 'grabbing' : 'grab') : 'default'
                    }}
                    {...(isSortable && !isLastColumn ? { ...attributes, ...listeners } : {})}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="font-medium text-sm text-black">{column.name}</h3>
                            <span className="text-xs px-2 py-1 rounded-full bg-black/20 text-white/90">
                                {totalTaskCountui}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 hover:bg-white/40"
                            onClick={() => onAddTask(column._id)}
                        >
                            <Plus className="h-4 w-4 text-black" />
                        </Button>
                    </div>
                </div>

                {/* Scrollable Area */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 box-border overflow-y-auto scrollbar-hidden px-1"
                    style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
                >
                    <div ref={contentRef} className="space-y-3 py-2">
                        {column.tasks.map((task, idx) => {
                            const activeDrag = activeDrags.find((d) => d.taskId === task._id);
                            return (
                                <TaskCard
                                    key={task._id}
                                    task={task}
                                    index={idx}
                                    activeDrag={activeDrag}
                                    onClick={() => onTaskClick?.(task)}
                                    employees={employees}
                                    stageList={stageList}
                                />
                            );
                        })}

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
                            </div>
                        )}

                        {/* All Loaded */}
                        {stageExhausted[column._id] && column.tasks.length > 0 && (
                            <div className="text-center py-3 text-xs text-gray-500">
                                All tasks loaded
                            </div>
                        )}

                        {/* Empty */}
                        {column.tasks.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                {isOver ? "Drop here" : "No tasks yet"}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}