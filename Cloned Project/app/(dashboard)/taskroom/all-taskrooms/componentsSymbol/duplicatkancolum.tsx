"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import type { Column, Task, DragEvent, Employee } from "../types/kanban"
import { TaskCard } from "./task-card"
import { useRef, useEffect, useState, useCallback } from "react"

interface KanbanColumnProps {
    column: Column
    activeDrags: DragEvent[]
    onAddTask: (columnId: string) => void
    onTaskClick?: (task: Task) => void
    employees: Employee[]
    stageList: Column[]
    fetchTasksForStage: (stageId: string) => Promise<void>
    stageExhausted: Record<string, boolean>
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
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: column._id });

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const isFetchingRef = useRef(false);
    console.log("123123123column", column)
    // ──────────────────────────────────────────────────────────────
    // 1. Auto-fetch if tasks don't fill the column
    // ──────────────────────────────────────────────────────────────
    const checkAndAutoFetch = useCallback(async () => {
        if (stageExhausted[column._id] || isFetchingRef.current) return;

        const container = scrollContainerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const visibleHeight = container.clientHeight;
        const contentHeight = content.scrollHeight;

        // If content is shorter than 80% of visible area → fetch more
        const MIN_FILL_RATIO = 0.8;
        const needsMore = contentHeight < visibleHeight * MIN_FILL_RATIO;

        if (needsMore) {
            isFetchingRef.current = true;
            setIsLoading(true);
            try {
                await fetchTasksForStage(column._id);
            } catch (err) {
                console.error("[auto-fetch] Failed:", err);
            } finally {
                setIsLoading(false);
                isFetchingRef.current = false;
            }
        }
    }, [column._id, fetchTasksForStage, stageExhausted]);

    // Run after render
    useEffect(() => {
        checkAndAutoFetch();
    }, [checkAndAutoFetch, column.tasks.length]);

    // ──────────────────────────────────────────────────────────────
    // 2. Scroll-to-load (only if overflow exists)
    // ──────────────────────────────────────────────────────────────
    const handleScroll = useCallback(
        (e: Event) => {
            const target = e.target as HTMLDivElement;
            if (!target || stageExhausted[column._id] || isFetchingRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = target;
            const isNearBottom = scrollTop + clientHeight >= scrollHeight - 120;

            if (isNearBottom) {
                isFetchingRef.current = true;
                setIsLoading(true);
                fetchTasksForStage(column._id)
                    .catch((err) => console.error("[scroll-fetch] Failed:", err))
                    .finally(() => {
                        setIsLoading(false);
                        isFetchingRef.current = false;
                    });
            }
        },
        [column._id, fetchTasksForStage, stageExhausted]
    );

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let ticking = false;
        const throttledScroll = (e: Event) => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    handleScroll(e);
                    ticking = false;
                });
                ticking = true;
            }
        };

        container.addEventListener("scroll", throttledScroll, { passive: true });
        return () => container.removeEventListener("scroll", throttledScroll);
    }, [handleScroll]);

    // ──────────────────────────────────────────────────────────────
    // 3. Manual Load More
    // ──────────────────────────────────────────────────────────────
    const handleLoadMore = () => {
        if (!stageExhausted[column._id] && !isFetchingRef.current) {
            isFetchingRef.current = true;
            setIsLoading(true);
            fetchTasksForStage(column._id)
                .finally(() => {
                    setIsLoading(false);
                    isFetchingRef.current = false;
                });
        }
    };

    return (
        <div className="flex-shrink-0 w-80">
            <Card ref={setNodeRef} className="h-full bg-[#0e0e12] border-0 shadow-none">
                {/* Header */}
                <div
                    className="p-4 rounded-xl sticky top-0 z-10"
                    style={{ background: column?.color }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="font-medium text-sm text-white">{column.name}</h3>
                            <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white border border-white/20">
                                {column.taskCount}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 hover:bg-white/40"
                            onClick={() => onAddTask(column._id)}
                        >
                            <Plus className="h-4 w-4 text-white" />
                        </Button>
                    </div>
                </div>

                {/* Scrollable Area */}
                <div
                    ref={scrollContainerRef}
                    className="h-[calc(100%-80px)] overflow-y-auto scrollbar-hidden px-1"
                    style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
                >
                    <div ref={contentRef} className="space-y-3 py-2">
                        {column.tasks.map((task, idx) => {
                            const activeDrag = activeDrags.find(d => d.taskId === task._id);
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
                            <div className="text-center py-3 text-xs text-muted-foreground">
                                {/* All tasks loaded */}
                            </div>
                        )}

                        {/* Empty */}
                        {column.tasks.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                {isOver ? "Drop here" : "No tasks yet"}
                            </div>
                        )}

                        {/* Load More Button */}
                        {/* {!stageExhausted[column._id] && !isLoading && (
                            <div className="text-center py-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadMore}
                                    className="text-xs"
                                >
                                    Load more
                                </Button>
                            </div>
                        )} */}
                    </div>
                </div>
            </Card>
        </div>
    );
}