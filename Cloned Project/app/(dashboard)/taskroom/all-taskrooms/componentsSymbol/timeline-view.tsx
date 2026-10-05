"use client"

import { useRef, useEffect, useMemo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, AlertTriangle, Loader2, Calendar } from "lucide-react"
import type { Column, Task, Employee } from "../types/kanban"

interface TimelineTask extends Omit<Task, "startDate" | "dueDate"> {
    startDate: Date | null
    dueDate: Date | null
    isOverdue?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// BEST-IN-CLASS DATE CONVERTER (handles everything)
// ─────────────────────────────────────────────────────────────────────────────
const timestampToLocalDate = (timestamp: any): Date | null => {
    if (!timestamp) return null

    let ms: number

    if (typeof timestamp === "object" && timestamp?.seconds != null) {
        // Firebase Timestamp
        ms = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000
    } else if (typeof timestamp === "string" || typeof timestamp === "number") {
        ms = Number(timestamp)
        if (isNaN(ms)) return null
    } else {
        return null
    }

    const date = new Date(ms)
    if (isNaN(date.getTime())) return null

    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate daily columns
// ─────────────────────────────────────────────────────────────────────────────
const generateTimelineDates = (start: Date, end: Date) => {
    const dates: { date: Date; label: string; isToday: boolean; isWeekend: boolean }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const current = new Date(start)
    while (current <= end) {
        const isToday = current.getTime() === today.getTime()
        const isWeekend = current.getDay() === 0 || current.getDay() === 6
        const label = current.toLocaleDateString("en-US", {
            weekday: "short",
            day: "numeric",
            month: "short"
        })

        dates.push({ date: new Date(current), label, isToday, isWeekend })
        current.setDate(current.getDate() + 1)
    }
    return dates
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculate task bar position
// ─────────────────────────────────────────────────────────────────────────────
const calculateTaskPosition = (
    task: TimelineTask,
    timelineStart: Date,
    cellWidth: number
): { left: number; width: number } => {
    const daysFromStart = (date: Date) =>
        Math.floor((date.getTime() - timelineStart.getTime()) / (86400 * 1000))

    const startOffset = task.startDate ? daysFromStart(task.startDate) : 0
    const endOffset = task.dueDate ? daysFromStart(task.dueDate) : startOffset

    const daysSpan = Math.max(1, endOffset - startOffset + 1)
    const rawWidth = daysSpan * cellWidth
    const minWidth = task.startDate && task.dueDate && task.startDate.toDateString() === task.dueDate.toDateString()
        ? 120  // Increased minimum width for single-day tasks
        : 150  // Increased minimum width for multi-day tasks

    return {
        left: Math.max(0, startOffset * cellWidth),
        width: Math.max(minWidth, rawWidth),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Drag to scroll with momentum and infinite date loading
// ─────────────────────────────────────────────────────────────────────────────
const useDragScroll = (
    ref: React.RefObject<HTMLElement>,
    onReachEdge?: (direction: 'left' | 'right') => void
) => {
    useEffect(() => {
        const el = ref.current
        if (!el) return

        let isDown = false
        let startX = 0
        let scrollLeftStart = 0
        let lastX = 0
        let velocity = 0
        let animationFrame: number
        let lastTime = 0

        const checkEdges = () => {
            const buffer = 100 // pixels from edge to trigger loading
            const scrollLeft = el.scrollLeft
            const scrollWidth = el.scrollWidth
            const clientWidth = el.clientWidth

            // Check if near left edge
            if (scrollLeft <= buffer) {
                onReachEdge?.('left')
            }

            // Check if near right edge
            if (scrollLeft + clientWidth >= scrollWidth - buffer) {
                onReachEdge?.('right')
            }
        }

        const handleStart = (x: number) => {
            if ((event?.target as HTMLElement)?.closest(".task-bar")) return
            isDown = true
            el.style.cursor = "grabbing"
            el.style.scrollSnapType = "none"
            startX = x
            scrollLeftStart = el.scrollLeft
            lastX = x
            velocity = 0
            lastTime = performance.now()

            cancelAnimationFrame(animationFrame)
        }

        const handleMove = (x: number) => {
            if (!isDown) return

            const currentTime = performance.now()
            const deltaTime = currentTime - lastTime

            if (deltaTime > 0) {
                const deltaX = x - lastX
                velocity = deltaX / deltaTime
                lastX = x
                lastTime = currentTime
            }

            const walk = (x - startX) * 2.5
            el.scrollLeft = scrollLeftStart - walk

            // Check edges during drag
            checkEdges()
        }

        const handleMomentum = () => {
            if (Math.abs(velocity) < 0.01) return

            el.scrollLeft -= velocity * 16
            velocity *= 0.95 // friction

            // Check edges during momentum
            checkEdges()

            animationFrame = requestAnimationFrame(handleMomentum)
        }

        const handleEnd = () => {
            isDown = false
            el.style.cursor = "grab"
            el.style.scrollSnapType = "x mandatory"

            if (Math.abs(velocity) > 0.1) {
                animationFrame = requestAnimationFrame(handleMomentum)
            }
        }

        const mouseDown = (e: MouseEvent) => handleStart(e.pageX)
        const mouseMove = (e: MouseEvent) => handleMove(e.pageX)
        const mouseUp = () => handleEnd()
        const mouseLeave = () => {
            if (isDown) handleEnd()
        }

        const touchStart = (e: TouchEvent) => handleStart(e.touches[0].pageX)
        const touchMove = (e: TouchEvent) => {
            e.preventDefault();
            handleMove(e.touches[0].pageX)
        }
        const touchEnd = () => handleEnd()

        // Also check edges on regular scroll
        const handleScroll = () => {
            checkEdges()
        }

        el.style.cursor = "grab"
        el.style.userSelect = "none"
        el.style.scrollSnapType = "x mandatory"

        el.addEventListener("mousedown", mouseDown)
        document.addEventListener("mousemove", mouseMove)
        document.addEventListener("mouseup", mouseUp)
        el.addEventListener("mouseleave", mouseLeave)
        el.addEventListener("touchstart", touchStart, { passive: true })
        el.addEventListener("touchmove", touchMove, { passive: false })
        el.addEventListener("touchend", touchEnd)
        el.addEventListener("scroll", handleScroll, { passive: true })

        return () => {
            el.removeEventListener("mousedown", mouseDown)
            document.removeEventListener("mousemove", mouseMove)
            document.removeEventListener("mouseup", mouseUp)
            el.removeEventListener("mouseleave", mouseLeave)
            el.removeEventListener("touchstart", touchStart)
            el.removeEventListener("touchmove", touchMove)
            el.removeEventListener("touchend", touchEnd)
            el.removeEventListener("scroll", handleScroll)
            cancelAnimationFrame(animationFrame)

            el.style.cursor = ""
            el.style.userSelect = ""
            el.style.scrollSnapType = ""
        }
    }, [ref, onReachEdge])
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if task is overdue
// ─────────────────────────────────────────────────────────────────────────────
const isTaskOverdue = (task: TimelineTask): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!task.dueDate) return false;

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get visible date range from scroll position
// ─────────────────────────────────────────────────────────────────────────────
const getVisibleDateRange = (
    scrollLeft: number,
    containerWidth: number,
    timelineStart: Date,
    cellWidth: number
): { start: Date; end: Date; currentMonth: string; currentYear: string } => {
    const startDayIndex = Math.floor(scrollLeft / cellWidth)
    const endDayIndex = Math.floor((scrollLeft + containerWidth) / cellWidth)

    const startDate = new Date(timelineStart)
    startDate.setDate(startDate.getDate() + startDayIndex)

    const endDate = new Date(timelineStart)
    endDate.setDate(endDate.getDate() + endDayIndex)

    // Find the most centered date
    const centerDayIndex = Math.floor((scrollLeft + containerWidth / 2) / cellWidth)
    const centerDate = new Date(timelineStart)
    centerDate.setDate(centerDate.getDate() + centerDayIndex)

    const currentMonth = centerDate.toLocaleDateString('en-US', { month: 'long' })
    const currentYear = centerDate.getFullYear().toString()

    return {
        start: startDate,
        end: endDate,
        currentMonth,
        currentYear
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT – TRUE INFINITE HORIZONTAL TIMELINE WITH LARGER COLUMNS
// ─────────────────────────────────────────────────────────────────────────────
export function TimelineView({
    columns,
    employees,
    onTaskClick,
    stagecolumns: rawTasks = [],
    hasMore,
    isFetching,
    fetchListView,
    nextPageToFetch
}: {
    columns: Column[]
    employees: Employee[]
    onTaskClick?: (task: Task) => void
    stagecolumns: Task[]
    fetchListView: (page: number) => Promise<void>;
    hasMore: boolean;
    isFetching: boolean;
    nextPageToFetch: number;
}) {
    const headerRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // State for infinite date loading
    const [dateRange, setDateRange] = useState({
        start: new Date(),
        end: new Date(),
    })
    const [isLoadingMoreDates, setIsLoadingMoreDates] = useState(false)
    const [loadDirection, setLoadDirection] = useState<'left' | 'right' | null>(null)
    const [visibleDateInfo, setVisibleDateInfo] = useState<{
        currentMonth: string;
        currentYear: string;
    }>({ currentMonth: '', currentYear: '' })

    // Increased column width
    const cellWidth = 120  // Increased from 80 to 120

    // Initialize date range with a large initial range
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = new Date(today);
        start.setDate(start.getDate() - 180); // Reduced initial range since columns are wider

        const end = new Date(today);
        end.setDate(end.getDate() + 180); // Reduced initial range since columns are wider

        setDateRange({ start, end });

        // Set initial visible date info
        setVisibleDateInfo({
            currentMonth: today.toLocaleDateString('en-US', { month: 'long' }),
            currentYear: today.getFullYear().toString()
        })
    }, []);

    // ───── Task Infinite Scroll ─────
    useEffect(() => {
        const sentinel = sentinelRef.current;

        if (!sentinel || !hasMore) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isFetching && hasMore) {
                    fetchListView(nextPageToFetch);
                }
            },
            {
                rootMargin: "100px",
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

    // ───── Update visible date info on scroll ─────
    useEffect(() => {
        const grid = gridRef.current;
        const header = headerRef.current;

        if (!grid || !header) return;

        const updateVisibleDateInfo = () => {
            const scrollLeft = grid.scrollLeft;
            const containerWidth = grid.clientWidth;

            const visibleRange = getVisibleDateRange(
                scrollLeft,
                containerWidth,
                dateRange.start,
                cellWidth
            );

            setVisibleDateInfo({
                currentMonth: visibleRange.currentMonth,
                currentYear: visibleRange.currentYear
            });
        };

        // Initial update
        updateVisibleDateInfo();

        // Update on scroll
        grid.addEventListener('scroll', updateVisibleDateInfo, { passive: true });
        header.addEventListener('scroll', updateVisibleDateInfo, { passive: true });

        return () => {
            grid.removeEventListener('scroll', updateVisibleDateInfo);
            header.removeEventListener('scroll', updateVisibleDateInfo);
        };
    }, [dateRange.start, cellWidth]);

    // ───── Infinite Date Loading ─────
    const loadMoreDates = useCallback(async (direction: 'left' | 'right') => {
        if (isLoadingMoreDates) return;

        setIsLoadingMoreDates(true);
        setLoadDirection(direction);

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 300));

        setDateRange(prev => {
            const newStart = new Date(prev.start);
            const newEnd = new Date(prev.end);

            if (direction === 'left') {
                // Load 3 more months to the left (reduced since columns are wider)
                newStart.setDate(newStart.getDate() - 90);

                // Maintain scroll position by adjusting scrollLeft
                setTimeout(() => {
                    const grid = gridRef.current;
                    const header = headerRef.current;
                    if (grid && header) {
                        const additionalWidth = 90 * cellWidth; // 90 days * cell width
                        grid.scrollLeft += additionalWidth;
                        header.scrollLeft += additionalWidth;
                    }
                }, 50);
            } else {
                // Load 3 more months to the right (reduced since columns are wider)
                newEnd.setDate(newEnd.getDate() + 90);
            }

            return {
                start: newStart,
                end: newEnd
            };
        });

        setIsLoadingMoreDates(false);
        setLoadDirection(null);
    }, [isLoadingMoreDates, cellWidth]);

    // Edge detection for infinite date loading
    const handleReachEdge = useCallback((direction: 'left' | 'right') => {
        loadMoreDates(direction);
    }, [loadMoreDates]);

    // Use enhanced drag scroll with edge detection
    useDragScroll(headerRef, handleReachEdge);
    useDragScroll(gridRef, handleReachEdge);

    const today = useMemo(() => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
    }, [])

    const dates = useMemo(() =>
        generateTimelineDates(dateRange.start, dateRange.end),
        [dateRange.start, dateRange.end]
    )

    const totalWidth = dates.length * cellWidth
    const todayIndex = dates.findIndex(d => d.isToday)
    const todayCenter = todayIndex * cellWidth + cellWidth / 2

    // ───── Center today on first load ─────
    useEffect(() => {
        const header = headerRef.current
        const grid = gridRef.current
        if (!header || !grid || todayIndex === -1) return

        const viewportWidth = grid.clientWidth
        const target = todayCenter - viewportWidth / 2

        // Only center on initial load
        if (header.scrollLeft === 0 && grid.scrollLeft === 0) {
            header.scrollLeft = target
            grid.scrollLeft = target

            setTimeout(() => {
                header.scrollTo({ left: target, behavior: "smooth" })
                grid.scrollTo({ left: target, behavior: "smooth" })
            }, 50)
        }
    }, [todayCenter, todayIndex])

    // ───── Sync scroll between header & grid ─────
    useEffect(() => {
        const header = headerRef.current
        const grid = gridRef.current
        if (!header || !grid) return

        let syncing = false
        const sync = (src: HTMLElement, dst: HTMLElement) => {
            if (syncing) return
            syncing = true
            dst.scrollLeft = src.scrollLeft
            syncing = false
        }

        const h = () => sync(header, grid)
        const g = () => sync(grid, header)

        header.addEventListener("scroll", h, { passive: true })
        grid.addEventListener("scroll", g, { passive: true })

        return () => {
            header.removeEventListener("scroll", h)
            grid.removeEventListener("scroll", g)
        }
    }, [])

    const getStageColor = (id: string): string => {
        const columnsColor = columns?.find((emp) => emp._id == id)
        if (!columnsColor) {
            return "#64748b" // Default gray color
        }
        return columnsColor.color
    }

    const handlego = (startDate: Date | null) => {
        const header = headerRef.current
        const grid = gridRef.current
        if (!header || !grid || !startDate) return

        // Calculate days from timeline start to task start date
        const daysFromStart = Math.floor((startDate.getTime() - dateRange.start.getTime()) / (86400 * 1000))

        // Calculate target position (center the task in view)
        const targetPosition = daysFromStart * cellWidth
        const viewportWidth = grid.clientWidth
        const targetScroll = Math.max(0, targetPosition - viewportWidth / 2 + cellWidth / 2)

        // Scroll both header and grid to the target position
        header.scrollLeft = targetScroll
        grid.scrollLeft = targetScroll

        // Optional: Add smooth scrolling
        setTimeout(() => {
            header.scrollTo({ left: targetScroll, behavior: "smooth" })
            grid.scrollTo({ left: targetScroll, behavior: "smooth" })
        }, 10)
    }

    const goToToday = () => {
        const header = headerRef.current
        const grid = gridRef.current
        if (!header || !grid || todayIndex === -1) return

        const viewportWidth = grid.clientWidth
        const target = todayCenter - viewportWidth / 2

        header.scrollLeft = target
        grid.scrollLeft = target

        setTimeout(() => {
            header.scrollTo({ left: target, behavior: "smooth" })
            grid.scrollTo({ left: target, behavior: "smooth" })
        }, 50)
    }

    const scrollBy = (px: number) => {
        const left = (gridRef.current?.scrollLeft || 0) + px
        headerRef.current?.scrollTo({ left, behavior: "smooth" })
        gridRef.current?.scrollTo({ left, behavior: "smooth" })
    }

    // ───── PROCESS TASKS SAFELY ─────
    const tasks: TimelineTask[] = rawTasks
        .map(task => {
            const start = timestampToLocalDate(task.startDate)
            const due = timestampToLocalDate(task.dueDate)

            const timelineTask: TimelineTask = {
                ...task,
                startDate: start || today,
                dueDate: due || start || today,
            }

            // Mark overdue tasks
            timelineTask.isOverdue = isTaskOverdue(timelineTask)

            return timelineTask
        })
        .filter(t => t.startDate || t.dueDate)

    const getName = (id?: string) => employees.find(e => e._id === id)?.name || "Unassigned"
    const getInitial = (id?: string) => getName(id)[0]?.toUpperCase() || "?"

    // Count overdue tasks for the badge
    const overdueCount = tasks.filter(task => task.isOverdue).length

    return (
        <div className="h-screen flex flex-col bg-[#0e0e12]">
            {/* Top Bar */}
            <div className="border-b border-[#e5e7eb29] px-6 py-4 flex items-center justify-between bg-[#0e0e12]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => scrollBy(-800)} className="bg-transparent border-[#e5e7eb29] text-gray-400 hover:text-white hover:bg-[#1e1e2d]">
                            <ChevronLeft className="h-4 w-4 text-blue-400" />
                        </Button>
                        <Button className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" size="sm" onClick={goToToday}>
                            Today
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => scrollBy(800)} className="bg-transparent border-[#e5e7eb29] text-gray-400 hover:text-white hover:bg-[#1e1e2d]">
                            <ChevronRight className="h-4 w-4 text-blue-400" />
                        </Button>
                    </div>

                    {/* Date Loading Indicator */}
                    {isLoadingMoreDates && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading {loadDirection === 'left' ? 'past' : 'future'} dates...
                        </div>
                    )}
                </div>

                {/* Info Badges */}
                <div className="flex items-center gap-3">
                    {/* Current Month & Year Badge */}
                    {visibleDateInfo.currentMonth && visibleDateInfo.currentYear && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e2d] text-gray-300 rounded-full text-sm border border-[#e5e7eb29]">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium text-white">
                                {visibleDateInfo.currentMonth} {visibleDateInfo.currentYear}
                            </span>
                        </div>
                    )}

                    {/* Overdue Badge */}

                </div>
            </div>

            {/* Main Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="border-b border-[#e5e7eb29] bg-[#1e1e2d] flex">
                    <div className="w-80 flex-shrink-0 px-6 py-3 text-sm font-medium text-white border-r border-[#e5e7eb29]">Tasks</div>
                    <div
                        ref={headerRef}
                        className="flex-1 overflow-x-auto scrollbar-hide relative"
                        style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}
                    >
                        <div className="relative" style={{ width: `${totalWidth}px` }}>
                            {/* Left Loading Indicator */}
                            {isLoadingMoreDates && loadDirection === 'left' && (
                                <div className="absolute left-0 top-0 w-20 h-full bg-blue-50 border-r border-blue-200 flex items-center justify-center z-10">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                </div>
                            )}

                            {/* Days - Increased column size */}
                            {dates.map((d, i) => (
                                <div
                                    key={i}
                                    style={{
                                        height: "45px"
                                    }}
                                    className={`inline-flex flex-col items-center justify-center w-[120px] border-r border-[#e5e7eb29] ${d.isToday
                                        ? "bg-blue-500/20 font-bold text-blue-400"
                                        : d.isWeekend
                                            ? "bg-[#1e1e2d]/50"
                                            : "bg-[#1e1e2d]"
                                        }`}
                                >
                                    <div className="text-xs text-gray-500">{d.label.split(" ")[0]}</div>
                                    <div className="text-sm font-medium text-white">{d.label.split(" ").slice(1).join(" ")}</div>
                                </div>
                            ))}

                            {/* Right Loading Indicator */}
                            {isLoadingMoreDates && loadDirection === 'right' && (
                                <div className="absolute right-0 top-0 w-20 h-full bg-blue-50 border-l border-blue-200 flex items-center justify-center z-10">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid + Tasks */}
                <div
                    className="flex-1 overflow-y-auto bg-grid-pattern"
                    ref={scrollContainerRef}
                >
                    <div className="flex">
                        {/* Left Task List */}
                        <div className="w-80 flex-shrink-0 border-r border-[#e5e7eb29] bg-[#0e0e12] sticky left-0 z-10">
                            {tasks.map((task,i) => (
                                <div
                                    key={i}
                                    className={`h-20 px-6 border-b border-[#e5e7eb29] flex items-center gap-3 hover:bg-[#1e1e2d] cursor-pointer transition-colors relative 
                                        }`}
                                    onClick={() => handlego(task?.startDate)}
                                >
                                    {/* {task.isOverdue && (
                                        <div className="absolute top-2 left-2">
                                            <AlertTriangle className="h-3 w-3 text-red-500" />
                                        </div>
                                    )} */}

                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-small text-sm truncate text-white`} title={task.title}>
                                            {task.title}
                                        </h4>
                                        <p className={`text-xs text-gray-500`}>
                                            {getName(task.assignedToId)}


                                            {task.isOverdue && (
                                                <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-semibold border border-red-500/20">
                                                    Overdue
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {isFetching && (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                    Loading more tasks...
                                </div>
                            )}
                        </div>

                        {/* Gantt Chart */}
                        <div ref={gridRef} className="flex-1 overflow-x-auto scrollbar-hide relative">
                            <div className="relative" style={{ width: `${totalWidth}px` }}>
                                {tasks.length === 0 ? (
                                    // Empty State
                                    <div className="flex flex-col items-center justify-center h-60 text-center">
                                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4">
                                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-white mb-2">No tasks found</h3>
                                        <p className="text-gray-500 max-w-sm">
                                            There are no tasks to display in the current view.
                                            Create a new task or adjust your filters to see tasks here.
                                        </p>
                                    </div>
                                ) : (
                                    // Tasks Grid
                                    tasks.map((task,i) => {
                                        const pos = calculateTaskPosition(task, dateRange.start, cellWidth)
                                        const color = getStageColor(task.stageId ? task.stageId : "")

                                        const taskColor = task.isOverdue ? '#ef4444' : color
                                        const startStr = task.startDate?.toLocaleDateString() || "—"
                                        const endStr = task.dueDate?.toLocaleDateString() || "—"

                                        return (
                                            <div key={i} className="h-20 border-b border-[#e5e7eb29] relative">
                                                <div
                                                    className={`task-bar absolute top-3 h-14 rounded-lg shadow-md flex items-center px-4  font-medium text-sm text-black cursor-pointer hover:brightness-110 transition-all 
                                                        }`}
                                                    style={{
                                                        left: pos.left + "px",
                                                        width: pos.width + "px",
                                                        backgroundColor: color,
                                                    }}
                                                    title={`${task.title} · ${startStr} → ${endStr}${task.isOverdue ? ' · OVERDUE' : ''}`}
                                                    onClick={() => onTaskClick?.(task as any)}
                                                >
                                                    {/* {task.isOverdue && (
                                                        <AlertTriangle className="h-4 w-4 text-white mr-2 flex-shrink-0" />
                                                    )} */}
                                                    <span className="truncate pr-3">{task.title}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>


                    </div>

                    {/* Sentinel for task infinite scroll */}
                    <div
                        ref={sentinelRef}
                        style={{
                            height: '1px',
                            visibility: 'hidden'
                        }}
                    />
                </div>


            </div>
            <div className="pt-5 pb-5 border-t border-gray-200 bg-gray-50  px-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center justify-between">
                    <span>Legend</span>

                </h4>
                <div className="flex flex-wrap items-center gap-6">
                    {
                        columns?.map((item, i) => {
                            return (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 group cursor-pointer"
                                >
                                    <div
                                        className="w-4 h-3 rounded-sm transition-all duration-200 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-gray-300 text-black"
                                        style={{
                                            background: `${item?.color}`
                                        }}
                                    />
                                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors font-medium">
                                        {item?.name}
                                    </span>
                                </div>
                            )
                        })
                    }
                </div>
            </div>
        </div>
    )
}