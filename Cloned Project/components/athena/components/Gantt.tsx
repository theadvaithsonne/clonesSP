"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Flag,
    Circle,
    CheckCircle2,
    CalendarDays,
    GripVertical,
    Tag,
    UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { isRoomObserver, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useCardStore } from "@/store/athena/cardStore";
import { useBoardStore } from "@/store/athena/boardStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AssigneePicker } from "./assignee-picker";
import { CustomDatePicker } from "./custom-date-picker";
import { PriorityPicker } from "./priority-picker";
import type { PriorityLevel } from "./priority-picker";
import { TagPicker } from "./tag-picker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function startOfDayMs(ms: number) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function addDays(ms: number, n: number) {
    return ms + n * DAY_MS;
}

function formatDay(ms: number) {
    return new Date(ms).getDate();
}

function formatMonth(ms: number) {
    return new Date(ms).toLocaleString("en-US", { month: "short" });
}

function formatMonthYear(ms: number) {
    return new Date(ms).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function daysInMonth(ms: number) {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function startOfMonthMs(ms: number) {
    const d = new Date(ms);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function startOfWeekSundayMs(ms: number) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
}

function priorityColor(p: string) {
    if (p === "urgent") return "#ef4444";
    if (p === "high") return "#f59e0b";
    if (p === "normal") return "#3b82f6";
    if (p === "low") return "#94a3b8";
    return "#94a3b8";
}

function priorityLabel(p: string) {
    if (p === "urgent") return "urgent";
    if (p === "high") return "high";
    if (p === "normal") return "normal";
    if (p === "low") return "low";
    return "";
}

function isOverdue(card: any) {
    if (card.isCompleted) return false;
    if (!card.dueDate) return false;
    return card.dueDate < Date.now();
}

function formatQuickDueTimeLabel(ms: number) {
    const d = new Date(ms);
    return format(d, "h:mm a").replace(/\s/g, "").toLowerCase();
}

function transformCardCustom(card: any, stageId: string) {
    return {
        _id: card?._id,
        name: card?.title,
        userId: card?.userId,
        description: card?.description || "",
        tags: card?.tags?.map((item: { _id: string }) => item?._id) || [],
        tagData: card?.tags || [],
        members: card?.assignedToIds ? card.assignedToIds : [],
        dueDate: card?.dueDate,
        priority: card?.priority,
        startDate: card?.startDate,
        checklist: card?.checklist ? card.checklist || [] : [],
        isOverDue: card?.isOverDue,
        isCompleted: card?.isCompleted,
        comments: [],
        commentCount: card?.commentCount,
        stageId,
        assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
        TaskDataCount: {
            totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
            totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0,
        },
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GanttView() {
    type ViewMode = "month" | "week" | "day";

    const ROW_H = 36;
    const LABEL_W = 260;
    const HEADER_H = 56;

    const today = startOfDayMs(Date.now());

    const [viewMode, setViewMode] = useState<ViewMode>("month");
    const [anchorDate, setAnchorDate] = useState(today);
    const colW = viewMode === "day" ? 220 : viewMode === "week" ? 84 : 36;

    const columns = useTaskroomWorkspacetore(state => state.columns);
    const setColumns = useTaskroomWorkspacetore(state => state.setColumns);
    const { createCard, updateCard } = useCardStore();
    const { currentWorkspace } = useWorkspaceStore();
    const { currentRoomDetail, memberData: roomMemberData } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const roomId = (searchParams.get("shareTask") ? searchParams.get("roomId") : currentRoomDetail?._id) || "";
    const workspaceId = (searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id) || "";
    const Idspace = (searchParams.get("shareTask") ? searchParams.get("spaceId") : currentRoomDetail?.spaceId) || "";
    const { memberData } = useBoardStore();
    const isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData);

    const [createOpen, setCreateOpen] = useState(false);
    const [createQuickMode, setCreateQuickMode] = useState(true);
    const [selectedStageId, setSelectedStageId] = useState("");
    const [dueDateMs, setDueDateMs] = useState<number | null>(null);
    const [startDateMs, setStartDateMs] = useState<number | null>(null);
    const [newCardTitle, setNewCardTitle] = useState("");
    const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
    const [priority, setPriority] = useState<PriorityLevel | "">("");
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [description, setDescription] = useState("");
    const [timeEstimate, setTimeEstimate] = useState("");
    const quickTitleRef = useRef<HTMLTextAreaElement | null>(null);
    const lastRowStageIdRef = useRef<string | null>(null);

    // ── View range: only the current month / week / day ──────────────────────

    /**
     * viewStart: first ms of the current period
     * viewDays:  how many columns to render (exact days in month / 7 / 1)
     */
    const viewStart = useMemo(() => {
        if (viewMode === "month") return startOfMonthMs(anchorDate);
        if (viewMode === "week") return startOfWeekSundayMs(anchorDate);
        return startOfDayMs(anchorDate);
    }, [anchorDate, viewMode]);

    const viewDays = useMemo(() => {
        if (viewMode === "month") return daysInMonth(anchorDate);
        if (viewMode === "week") return 7;
        return 1;
    }, [anchorDate, viewMode]);

    // ── Navigation: jump exactly one period at a time ─────────────────────────

    const shiftView = (dir: number) =>
        setAnchorDate(prev => {
            if (viewMode === "month") {
                const next = new Date(prev);
                next.setMonth(next.getMonth() + dir);
                next.setDate(1);
                next.setHours(0, 0, 0, 0);
                return next.getTime();
            }
            if (viewMode === "week") return addDays(startOfWeekSundayMs(prev), dir * 7);
            return addDays(startOfDayMs(prev), dir);
        });

    const goToday = () => setAnchorDate(today);

    // ── Header label for toolbar ──────────────────────────────────────────────

    const toolbarLabel = useMemo(() => {
        if (viewMode === "month") return formatMonthYear(viewStart);
        if (viewMode === "week") {
            const weekEnd = addDays(viewStart, 6);
            const startLabel = new Date(viewStart).toLocaleString("en-US", { month: "short", day: "numeric" });
            const endLabel = new Date(weekEnd).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return `${startLabel} – ${endLabel}`;
        }
        return new Date(viewStart).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }, [viewMode, viewStart]);

    // Collapsed stages
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    // Local card copies so bars move while dragging, before the save lands
    const [localCards, setLocalCards] = useState<Record<string, any>>(() => {
        const map: Record<string, any> = {};
        columns.forEach((col) =>
            col.cards.forEach((c) => {
                map[c._id] = { ...c, stageId: col._id };
            })
        );
        return map;
    });

    useEffect(() => {
        setLocalCards((prev) => {
            const next = { ...prev };
            columns.forEach((col) => {
                col.cards.forEach((c) => {
                    next[c._id] = next[c._id]
                        ? { ...next[c._id], ...c, stageId: col._id }
                        : { ...c, stageId: col._id };
                });
            });
            return next;
        });
    }, [columns]);

    useEffect(() => {
        if (columns.length > 0 && !lastRowStageIdRef.current) {
            lastRowStageIdRef.current = columns[0]._id;
        }
    }, [columns]);

    const days = useMemo(() => {
        return Array.from({ length: viewDays }, (_, i) => addDays(viewStart, i));
    }, [viewStart, viewDays]);

    // Group months for header (for month view this is always one group)
    const monthGroups = useMemo(() => {
        const groups: { key: string; label: string; year: number; startIdx: number; count: number }[] = [];
        let cur: any = null;
        days.forEach((d, i) => {
            const m = new Date(d).getMonth();
            const y = new Date(d).getFullYear();
            const key = `${y}-${m}`;
            if (!cur || cur.key !== key) {
                cur = { key, label: formatMonth(d), year: new Date(d).getFullYear(), startIdx: i, count: 1 };
                groups.push(cur);
            } else {
                cur.count++;
            }
        });
        return groups;
    }, [days]);

    const todayIdx = useMemo(() => {
        return days.findIndex((d) => d === today);
    }, [days, today]);

    const toggleCollapse = (id: string) =>
        setCollapsed((c) => ({ ...c, [id]: !c[id] }));

    const openCreateForDate = useCallback(
        (dateMs: number, stageIdFromRow?: string | null) => {
            if (isReadOnly) return;
            const due = startOfDayMs(dateMs);
            setNewCardTitle("");
            setAssignedToIds([]);
            setPriority("");
            setStartDateMs(null);
            setDueDateMs(due);
            setSelectedTagIds([]);
            setDescription("");
            setTimeEstimate("");

            if (stageIdFromRow) {
                lastRowStageIdRef.current = stageIdFromRow;
                setSelectedStageId(stageIdFromRow);
            } else {
                const fallback = lastRowStageIdRef.current || columns[0]?._id || "";
                setSelectedStageId(fallback);
            }

            setCreateQuickMode(true);
            setCreateOpen(true);
        },
        [columns, isReadOnly]
    );

    useEffect(() => {
        if (createOpen && createQuickMode) {
            const id = requestAnimationFrame(() => quickTitleRef.current?.focus());
            return () => cancelAnimationFrame(id);
        }
    }, [createOpen, createQuickMode]);

    const resetCreateForm = useCallback(() => {
        setNewCardTitle("");
        setAssignedToIds([]);
        setPriority("");
        setStartDateMs(null);
        setDueDateMs(null);
        setSelectedTagIds([]);
        setDescription("");
        setTimeEstimate("");
    }, []);

    const handleSaveCard = useCallback(async () => {
        if (isReadOnly) {
            toast.error("Observers can only view this board");
            return;
        }
        const stageId = selectedStageId;
        if (!stageId) { toast.error("Please select a stage."); return; }
        if (!newCardTitle.trim()) return;
        if (!roomId) { toast.error("Missing roomId for task creation."); return; }
        if (dueDateMs == null) { toast.error("Missing due date."); return; }

        try {
            const created = await createCard({
                stageId,
                title: newCardTitle.trim(),
                roomId,
                startDate: startDateMs,
                dueDate: dueDateMs,
                description: description || "",
                priority: priority || "normal",
                tags: selectedTagIds || [],
                assignedToIds: assignedToIds || [],
                ...(timeEstimate.trim() ? ({ timeEstimate: timeEstimate.trim() } as Record<string, string>) : {}),
            } as Parameters<typeof createCard>[0]);

            if (!created) { toast.error("Failed to create task."); return; }

            setColumns((prev) =>
                prev.map((col) => {
                    if (col._id !== stageId) return col;
                    return {
                        ...col,
                        // Newest first, matching the server's createdAt-desc order
                        cards: [transformCardCustom(created, stageId), ...col.cards],
                        localCardCount: (col.localCardCount || 0) + 1,
                    };
                })
            );
            setCreateOpen(false);
            setCreateQuickMode(false);
            resetCreateForm();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create task.");
        }
    }, [
        assignedToIds, createCard, description, dueDateMs, newCardTitle,
        priority, resetCreateForm, roomId, selectedStageId, selectedTagIds,
        setColumns, startDateMs, timeEstimate, isReadOnly,
    ]);

    // ── Bar interaction ──────────────────────────────────────────────────────

    // Holds the latest computed dates during a drag so onUp can read them
    // synchronously without depending on React state flush timing.
    const dragFinalRef = useRef<{ startDate: number | null; dueDate: number | null } | null>(null);
    // Detaches the window listeners of the drag in progress; also runs on unmount.
    const dragCleanupRef = useRef<(() => void) | null>(null);
    useEffect(() => () => dragCleanupRef.current?.(), []);

    const handleBarMouseDown = useCallback(
        (e: React.MouseEvent, cardId: string, type: string) => {
            if (isReadOnly) return;
            e.preventDefault();
            e.stopPropagation();
            const card = localCards[cardId];
            if (!card) return;
            dragCleanupRef.current?.();

            const startX = e.clientX;
            const savedStart = card.startDate;
            const savedDue = card.dueDate;
            // A bar with one date is drawn one day long; drag from that span.
            const origStart = card.startDate ?? card.dueDate - DAY_MS;
            const origEnd = card.dueDate ?? card.startDate + DAY_MS;

            const datesForDelta = (daysDelta: number) => {
                if (daysDelta === 0) return { startDate: savedStart, dueDate: savedDue };
                if (type === "move") {
                    return { startDate: origStart + daysDelta * DAY_MS, dueDate: origEnd + daysDelta * DAY_MS };
                }
                if (type === "resize-end") {
                    return { startDate: savedStart, dueDate: Math.max(origStart + DAY_MS, origEnd + daysDelta * DAY_MS) };
                }
                return { startDate: Math.min(origEnd - DAY_MS, origStart + daysDelta * DAY_MS), dueDate: savedDue };
            };

            dragFinalRef.current = { startDate: savedStart, dueDate: savedDue };
            let lastDelta = 0;
            let frame: number | null = null;

            const onMove = (me: MouseEvent) => {
                const daysDelta = Math.round((me.clientX - startX) / colW);
                // Re-render only when the bar crosses a day boundary, at most once a frame.
                if (daysDelta === lastDelta) return;
                lastDelta = daysDelta;
                const next = datesForDelta(daysDelta);
                dragFinalRef.current = next;
                if (frame != null) cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => {
                    frame = null;
                    setLocalCards((prev) =>
                        prev[cardId] ? { ...prev, [cardId]: { ...prev[cardId], ...next } } : prev
                    );
                });
            };

            const cleanup = () => {
                if (frame != null) cancelAnimationFrame(frame);
                frame = null;
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
                if (dragCleanupRef.current === cleanup) dragCleanupRef.current = null;
            };

            const onUp = async () => {
                cleanup();

                const final = dragFinalRef.current;
                dragFinalRef.current = null;
                // A click, or a drag dropped back where it started: nothing to save.
                if (!final || (final.startDate === savedStart && final.dueDate === savedDue)) return;

                setLocalCards((prev) =>
                    prev[cardId] ? { ...prev, [cardId]: { ...prev[cardId], ...final } } : prev
                );
                const payload = { startDate: final.startDate ?? null, dueDate: final.dueDate ?? null };

                try {
                    await updateCard(cardId, { ...payload, socketId: undefined } as any);
                    // Sync the dashboard store so other views stay up to date
                    const nextStart = payload.startDate ?? undefined;
                    const nextDue = payload.dueDate ?? undefined;
                    setColumns(prev =>
                        prev.map(col => ({
                            ...col,
                            cards: col.cards.map(c =>
                                c._id === cardId
                                    ? { ...c, startDate: nextStart, dueDate: nextDue }
                                    : c
                            ),
                        }))
                    );
                } catch (err) {
                    console.error("Failed to update card dates:", err);
                    toast.error("Failed to save task dates.");
                    // Roll back local state to the card's saved dates on failure
                    setLocalCards(prev => ({
                        ...prev,
                        [cardId]: { ...prev[cardId], startDate: savedStart, dueDate: savedDue },
                    }));
                }
            };

            dragCleanupRef.current = cleanup;
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [colW, localCards, updateCard, setColumns, isReadOnly]
    );

    // ── Scroll-to-task when clicking a label row ─────────────────────────────
    const gridRef = useRef<HTMLDivElement | null>(null);

    /**
     * Scrolls the grid horizontally so the task bar comes into view.
     * If the task has no dates, navigate to today's column instead.
     */
    const scrollToCard = useCallback(
        (card: any) => {
            const el = gridRef.current;
            if (!el) return;

            const barStart = card.startDate ?? card.dueDate;

            if (!barStart) {
                // No dates – scroll to today column if visible
                if (todayIdx >= 0) {
                    const targetLeft = LABEL_W + todayIdx * colW - el.clientWidth / 2 + colW / 2;
                    el.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
                }
                return;
            }

            const startDay = Math.round((startOfDayMs(barStart) - viewStart) / DAY_MS);

            // If bar is outside current view, navigate to that period first
            if (startDay < 0 || startDay >= viewDays) {
                if (viewMode === "month") {
                    const d = new Date(barStart);
                    d.setDate(1);
                    d.setHours(0, 0, 0, 0);
                    setAnchorDate(d.getTime());
                } else if (viewMode === "week") {
                    setAnchorDate(startOfWeekSundayMs(barStart));
                } else {
                    setAnchorDate(startOfDayMs(barStart));
                }
                pendingScrollCardRef.current = card._id;
                return;
            }

            // LABEL_W is sticky so offset horizontal scroll past it
            const targetLeft = LABEL_W + startDay * colW - el.clientWidth / 3;
            el.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
        },
        [colW, todayIdx, viewDays, viewMode, viewStart]
    );

    // Pending scroll after a view navigation triggered by label click
    const pendingScrollCardRef = useRef<string | null>(null);

    useEffect(() => {
        const cardId = pendingScrollCardRef.current;
        if (!cardId) return;
        pendingScrollCardRef.current = null;

        const card = localCards[cardId];
        if (!card) return;

        const el = gridRef.current;
        if (!el) return;

        const barStart = card.startDate ?? card.dueDate;
        if (!barStart) return;

        const startDay = Math.round((startOfDayMs(barStart) - viewStart) / DAY_MS);
        if (startDay < 0) return;

        requestAnimationFrame(() => {
            const targetLeft = LABEL_W + startDay * colW - el.clientWidth / 3;
            el.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
        });
    }, [viewStart, colW, localCards]);

    // ── Render ──────────────────────────────────────────────────────────────
    const totalGridW = days.length * colW;

    const allRows = useMemo(() => {
        const rows: any[] = [];
        columns.forEach((col) => {
            rows.push({ type: "stage", col });
            if (!collapsed[col._id]) {
                col.cards.forEach((c) => {
                    rows.push({ type: "card", card: localCards[c._id] ?? c, col });
                });
            }
        });
        return rows;
    }, [columns, collapsed, localCards]);

    return (
        <div className="flex flex-col h-full bg-[#111116] text-white overflow-hidden select-none">

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-[#111116] flex-shrink-0">
                <button
                    onClick={goToday}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-white/50 text-xs hover:bg-white/5 hover:text-white transition-colors"
                >
                    <CalendarDays className="w-3.5 h-3.5" />
                    Today
                </button>

                <div className="w-px h-5 bg-white/10" />

                <button
                    onClick={() => shiftView(-1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-white/10 text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="text-xs font-semibold text-white/60 min-w-[200px] text-center">
                    {toolbarLabel}
                </span>

                <button
                    onClick={() => shiftView(1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-white/10 text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-5 bg-white/10" />

                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                    <SelectTrigger className="w-[110px] h-7 bg-[#1a1a20] border-white/10 text-white/60">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a20] border-white/10">
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex-1" />

                {/* Priority legend */}
                {/* <div className="flex items-center gap-3 text-[11px] text-white/30">
                    {["urgent", "high", "normal", "low"].map((p) => (
                        <span key={p} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: priorityColor(p) }} />
                            {priorityLabel(p)}
                        </span>
                    ))}
                </div> */}
            </div>

            {/*
             * ── Main body ──────────────────────────────────────────────────
             * ONE scroll container for both panels.
             * The label column is sticky-left so it pins while scrolling horizontally.
             * Vertical scroll is shared automatically — no JS sync needed.
             */}
            <div
                ref={gridRef}
                className="flex-1 overflow-auto"
                style={{ scrollbarColor: "#333 transparent" }}
            >
                {/*
                 * Inner canvas: wide enough for label column + all day columns.
                 * min-width keeps it from collapsing narrower than the viewport.
                 */}
                <div style={{ width: LABEL_W + totalGridW, minWidth: "100%" }}>

                    {/* ── Sticky header row ── */}
                    <div
                        className="sticky top-0 z-30 flex bg-[#111116] border-b border-white/10"
                        style={{ height: HEADER_H }}
                    >
                        {/* Label column header — sticky-left inside the sticky-top row */}
                        <div
                            className="sticky left-0 z-40 flex-shrink-0 bg-[#111116] border-r border-white/10 flex items-end px-3 pb-1"
                            style={{ width: LABEL_W }}
                        >
                            <span className="text-[11px] uppercase tracking-widest text-white/25 font-semibold">Task</span>
                        </div>

                        {/* Date columns header */}
                        <div className="flex flex-col flex-shrink-0" style={{ width: totalGridW }}>
                            {/* Month / week label row */}
                            <div className="flex" style={{ height: 24 }}>
                                {viewMode === "week" ? (
                                    <div
                                        className="flex items-center px-2 border-r border-white/[0.06] text-[10px] font-semibold text-white/30 uppercase tracking-wider"
                                        style={{ width: totalGridW, flexShrink: 0 }}
                                    >
                                        {toolbarLabel}
                                    </div>
                                ) : viewMode === "day" ? (
                                    <div
                                        className="flex items-center px-2 border-r border-white/[0.06] text-[10px] font-semibold text-white/30 uppercase tracking-wider"
                                        style={{ width: totalGridW, flexShrink: 0 }}
                                    >
                                        {new Date(viewStart).toLocaleString("en-US", { weekday: "long" })}
                                    </div>
                                ) : (
                                    monthGroups.map((mg) => (
                                        <div
                                            key={mg.key}
                                            className="flex items-center px-2 border-r border-white/[0.06] text-[10px] font-semibold text-white/30 uppercase tracking-wider overflow-hidden"
                                            style={{ width: mg.count * colW, flexShrink: 0 }}
                                        >
                                            {mg.label} {mg.year}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Day number row */}
                            <div className="flex" style={{ height: 32 }}>
                                {days.map((d, i) => {
                                    const isToday = d === today;
                                    const dow = new Date(d).getDay();
                                    const isWeekend = dow === 0 || dow === 6;
                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center justify-center border-r border-white/[0.05] flex-shrink-0 font-medium cursor-pointer
                                                ${isToday
                                                    ? "bg-yellow-400/15 text-yellow-400 font-bold"
                                                    : isWeekend
                                                        ? "text-white/20 hover:bg-white/[0.03]"
                                                        : "text-white/35 hover:bg-white/[0.03]"
                                                }`}
                                            style={{ width: colW, fontSize: viewMode === "week" ? 12 : 10 }}
                                            onClick={() => openCreateForDate(d)}
                                        >
                                            {viewMode === "week" ? (
                                                <span className="flex flex-col items-center gap-0.5">
                                                    <span style={{ fontSize: 9 }} className="text-white/30 uppercase">
                                                        {new Date(d).toLocaleString("en-US", { weekday: "short" })}
                                                    </span>
                                                    <span>{formatDay(d)}</span>
                                                </span>
                                            ) : viewMode === "day" ? (
                                                <span className="flex flex-col items-center gap-0.5">
                                                    <span style={{ fontSize: 11 }} className="text-white/40">
                                                        {new Date(d).toLocaleString("en-US", { weekday: "long" })}
                                                    </span>
                                                    <span style={{ fontSize: 18 }}>{formatDay(d)}</span>
                                                </span>
                                            ) : (
                                                formatDay(d)
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Data rows ── */}
                    <div className="relative">
                        {/* Today vertical line — offset by LABEL_W */}
                        {todayIdx >= 0 && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-yellow-400/60 z-10 pointer-events-none"
                                style={{ left: LABEL_W + todayIdx * colW + colW / 2 }}
                            />
                        )}

                        {allRows.map((row) => {
                            /* ── Stage row ── */
                            if (row.type === "stage") {
                                const col = row.col;
                                const isOpen = !collapsed[col._id];
                                return (
                                    <div
                                        key={`row-stage-${col._id}`}
                                        className="flex border-b border-white/[0.06] bg-white/[0.015]"
                                        style={{ height: ROW_H }}
                                    >
                                        {/* Sticky label cell */}
                                        <div
                                            className="sticky left-0 z-20 flex-shrink-0 flex items-center gap-2 px-3 cursor-pointer bg-[#111116] border-r border-white/10 hover:bg-white/[0.03] transition-colors"
                                            style={{ width: LABEL_W }}
                                            onClick={() => {
                                                lastRowStageIdRef.current = col._id;
                                                toggleCollapse(col._id);
                                            }}
                                        >
                                            <ChevronDown
                                                className={`w-3 h-3 text-white/30 transition-transform flex-shrink-0 ${isOpen ? "" : "-rotate-90"}`}
                                            />
                                            <span
                                                className="w-2 h-2 rounded-sm flex-shrink-0"
                                                style={{ backgroundColor: col.color }}
                                            />
                                            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider truncate flex-1">
                                                {col.name}
                                            </span>
                                            <span className="text-[10px] text-white/20 ml-auto">
                                                {col.taskCount ?? col.cards.length}
                                            </span>
                                        </div>

                                        {/* Grid cells */}
                                        <div className="flex flex-shrink-0" style={{ width: totalGridW }}>
                                            {days.map((d, i) => {
                                                const isToday = d === today;
                                                const dow = new Date(d).getDay();
                                                const isWeekend = dow === 0 || dow === 6;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`border-r border-white/[0.04] flex-shrink-0 cursor-pointer
                                                            ${isToday ? "bg-yellow-400/5" : isWeekend ? "bg-white/[0.01]" : ""}`}
                                                        style={{ width: colW, height: ROW_H }}
                                                        onClick={() => openCreateForDate(d, col._id)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }

                            /* ── Card row ── */
                            const card = row.card;
                            const stageColor = row.col.color;
                            const over = isOverdue(card);
                            const barStart = card.startDate ?? card.dueDate;
                            const barEnd = card.dueDate ?? card.startDate;

                            const startDay = barStart
                                ? Math.round((startOfDayMs(barStart) - viewStart) / DAY_MS)
                                : null;
                            const endDay = barEnd
                                ? Math.round((startOfDayMs(barEnd) - viewStart) / DAY_MS)
                                : null;

                            const clampedStart = startDay !== null ? Math.max(0, Math.min(startDay, viewDays)) : null;
                            const clampedEnd = endDay !== null ? Math.max(0, Math.min(endDay, viewDays - 1)) : null;

                            // Hide bars that don't intersect the current view at all
                            const intersectsView =
                                startDay !== null &&
                                endDay !== null &&
                                endDay >= 0 &&
                                startDay < viewDays;

                            const barLeft =
                                intersectsView && clampedStart !== null ? clampedStart * colW : null;
                            const barWidth =
                                intersectsView && clampedStart !== null && clampedEnd !== null
                                    ? Math.max(colW / 2, (clampedEnd - clampedStart + 1) * colW)
                                    : colW;

                            const extendsLeft = startDay !== null && startDay < 0;
                            const extendsRight = endDay !== null && endDay >= viewDays;

                            const progress =
                                card.TaskDataCount?.totalChildCount > 0
                                    ? Math.round(
                                        (card.TaskDataCount.totalCompletedChildCount /
                                            card.TaskDataCount.totalChildCount) *
                                        100
                                    )
                                    : card.isCompleted ? 100 : 0;

                            const hex = (stageColor || "#94a3b8").replace("#", "").slice(0, 6);
                            const r = parseInt(hex.slice(0, 2), 16) || 148;
                            const g = parseInt(hex.slice(2, 4), 16) || 163;
                            const b = parseInt(hex.slice(4, 6), 16) || 184;
                            const barBg = over ? `rgba(239,68,68,0.22)` : `rgba(${r},${g},${b},0.22)`;
                            const barBorder = over ? `rgba(239,68,68,0.8)` : `rgba(${r},${g},${b},0.9)`;
                            const barProgress = over ? `rgba(239,68,68,0.45)` : `rgba(${r},${g},${b},0.45)`;

                            return (
                                <div
                                    key={`row-card-${card._id}`}
                                    className="flex border-b border-white/[0.04]"
                                    style={{ height: ROW_H }}
                                >
                                    {/* Sticky label cell */}
                                    <div
                                        className="sticky left-0 z-20 flex-shrink-0 flex items-center gap-2 px-3 pl-8 bg-[#111116] border-r border-white/[0.06] group hover:bg-white/[0.03] transition-colors cursor-pointer"
                                        style={{ width: LABEL_W }}
                                        onClick={() => scrollToCard(card)}
                                    >
                                        <GripVertical className="w-3 h-3 text-white/10 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                        {card.isCompleted ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400/60 flex-shrink-0" />
                                        ) : (
                                            <Circle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: row.col.color + "bb" }} />
                                        )}
                                        <span className={`text-xs truncate flex-1 ${card.isCompleted ? "line-through text-white/25" : over ? "text-red-400/80" : "text-white/70"}`}>
                                            {card.name}
                                        </span>
                                        <span
                                            className="text-[9px] font-bold px-1 py-0.5 rounded ml-auto flex-shrink-0"
                                            style={{
                                                color: priorityColor(card.priority),
                                                backgroundColor: priorityColor(card.priority) + "22",
                                            }}
                                        >
                                            {priorityLabel(card.priority)}
                                        </span>
                                    </div>

                                    {/* Grid cells + bar */}
                                    <div className="relative flex-shrink-0" style={{ width: totalGridW }}>
                                        {/* Background cells */}
                                        <div className="flex h-full">
                                            {days.map((d, i) => {
                                                const isToday = d === today;
                                                const dow = new Date(d).getDay();
                                                const isWeekend = dow === 0 || dow === 6;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`border-r border-white/[0.04] flex-shrink-0 cursor-pointer
                                                            ${isToday ? "bg-yellow-400/[0.03]" : isWeekend ? "bg-white/[0.01]" : ""}`}
                                                        style={{ width: colW, height: ROW_H }}
                                                        onClick={() => openCreateForDate(d, row.col._id)}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Task bar */}
                                        {barLeft !== null && (
                                            <div
                                                className={`absolute top-[6px] overflow-hidden flex items-center group/bar z-[5] ${isReadOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                                                style={{
                                                    left: barLeft,
                                                    width: barWidth,
                                                    height: ROW_H - 12,
                                                    background: barBg,
                                                    border: `1.5px solid ${barBorder}`,
                                                    borderLeft: extendsLeft ? `1.5px dashed ${barBorder}` : `3px solid ${barBorder}`,
                                                    borderRight: extendsRight ? `1.5px dashed ${barBorder}` : `1.5px solid ${barBorder}`,
                                                    borderTopLeftRadius: extendsLeft ? 0 : 4,
                                                    borderBottomLeftRadius: extendsLeft ? 0 : 4,
                                                    borderTopRightRadius: extendsRight ? 0 : 4,
                                                    borderBottomRightRadius: extendsRight ? 0 : 4,
                                                }}
                                                onMouseDown={(e) => handleBarMouseDown(e, card._id, "move")}
                                                title={card.name}
                                            >
                                                {progress > 0 && (
                                                    <div
                                                        className="absolute left-0 top-0 bottom-0 rounded-l-[3px] pointer-events-none"
                                                        style={{ width: `${progress}%`, background: barProgress }}
                                                    />
                                                )}
                                                {extendsLeft && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center z-10 pointer-events-none">
                                                        <ChevronLeft className="w-3 h-3 opacity-60" style={{ color: barBorder }} />
                                                    </div>
                                                )}
                                                <span
                                                    className="relative z-10 px-2 text-[11px] font-medium truncate pointer-events-none"
                                                    style={{ color: "rgba(255,255,255,0.85)" }}
                                                >
                                                    {barWidth > 60 ? card.name : ""}
                                                </span>
                                                {progress > 0 && barWidth > 60 && (
                                                    <span className="ml-auto mr-6 text-[9px] text-white/40 font-semibold flex-shrink-0 relative z-10">
                                                        {progress}%
                                                    </span>
                                                )}
                                                {extendsRight && (
                                                    <div className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center z-10 pointer-events-none">
                                                        <ChevronRight className="w-3 h-3 opacity-60" style={{ color: barBorder }} />
                                                    </div>
                                                )}
                                                {!extendsRight && !isReadOnly && (
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/20 rounded-r transition-opacity z-20"
                                                        onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, card._id, "resize-end"); }}
                                                    />
                                                )}
                                                {!extendsLeft && !isReadOnly && (
                                                    <div
                                                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/20 rounded-l transition-opacity z-20"
                                                        onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, card._id, "resize-start"); }}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {barStart == null && (
                                            <div className="absolute inset-y-[8px] left-2 flex items-center">
                                                <span className="text-[10px] text-white/15 italic">No dates set</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Bottom padding */}
                        <div style={{ height: 40 }} />
                    </div>
                </div>
            </div>

            {/* ── Quick create modal ── */}
            {createOpen && createQuickMode && !isReadOnly && (
                <>
                    <div
                        className="fixed inset-0 z-[100] bg-black/50"
                        aria-hidden
                        onClick={() => {
                            setCreateOpen(false);
                            setCreateQuickMode(false);
                            resetCreateForm();
                        }}
                    />
                    <div className="fixed bottom-4 left-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-xl border border-[#e5e7eb29] bg-[#343439] p-3 shadow-2xl sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                            <div className="min-w-0 flex-1">
                                <textarea
                                    ref={quickTitleRef}
                                    value={newCardTitle}
                                    onChange={(e) => setNewCardTitle(e.target.value)}
                                    placeholder="Task Name or type '/' for commands"
                                    className="min-h-[44px] w-full resize-none border-0 bg-transparent p-0 text-[15px] text-white/90 placeholder:text-white/35 outline-none focus:ring-0"
                                    rows={1}
                                />
                                {dueDateMs != null && (
                                    <CustomDatePicker
                                        startDate={startDateMs ? new Date(startDateMs) : null}
                                        dueDate={new Date(dueDateMs)}
                                        defaultTab="due"
                                        onSelect={(range) => {
                                            setStartDateMs(range.start ? range.start.getTime() : null);
                                            setDueDateMs(range.due ? range.due.getTime() : null);
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="mt-1 block text-left text-xs text-white/50 hover:text-white"
                                        >
                                            {formatQuickDueTimeLabel(dueDateMs)}
                                        </button>
                                    </CustomDatePicker>
                                )}
                            </div>

                            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                                        <SelectTrigger className="h-9 w-[min(160px,40vw)] rounded-full border border-dashed border-white/25 bg-transparent text-white/60">
                                            <SelectValue placeholder="Stage" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#1e1e26] border-[#3a3a48]">
                                            {columns.map((col) => (
                                                <SelectItem key={col._id} value={col._id}>
                                                    {col.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <TagPicker
                                        boardId={workspaceId}
                                        selectedTagIds={selectedTagIds}
                                        onSelect={(ids) => setSelectedTagIds(ids)}
                                        Idspace={Idspace}
                                    >
                                        <button
                                            type="button"
                                            className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/25 bg-transparent text-white/60 hover:bg-white/5 hover:text-white",
                                                selectedTagIds.length > 0 && "border-white/40 text-white"
                                            )}
                                            aria-label="Tags"
                                        >
                                            <Tag className="h-4 w-4" />
                                        </button>
                                    </TagPicker>

                                    <AssigneePicker
                                        assignedToIds={assignedToIds}
                                        onSelect={(ids) => setAssignedToIds(ids)}
                                    >
                                        <button
                                            type="button"
                                            className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/25 bg-transparent text-white/60 hover:bg-white/5 hover:text-white",
                                                assignedToIds.length > 0 && "border-white/40 text-white"
                                            )}
                                            aria-label="Assignees"
                                        >
                                            <UserPlus className="h-4 w-4" />
                                        </button>
                                    </AssigneePicker>

                                    <PriorityPicker
                                        priority={priority === "" ? undefined : priority}
                                        onSelect={(p) => setPriority(p ? (p as PriorityLevel) : "")}
                                    >
                                        <button
                                            type="button"
                                            className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/25 bg-transparent text-white/60 hover:bg-white/5 hover:text-white",
                                                priority && "border-white/40 text-white"
                                            )}
                                            aria-label="Priority"
                                        >
                                            <Flag
                                                className={cn(
                                                    "h-4 w-4",
                                                    priority === "urgent"
                                                        ? "fill-red-500 text-red-500"
                                                        : priority === "high"
                                                            ? "fill-amber-500 text-amber-500"
                                                            : priority === "normal"
                                                                ? "fill-blue-500 text-blue-500"
                                                                : ""
                                                )}
                                            />
                                        </button>
                                    </PriorityPicker>

                                    <Button
                                        type="button"
                                        onClick={handleSaveCard}
                                        disabled={!newCardTitle.trim() || !selectedStageId || isReadOnly}
                                        className="h-9 rounded-md bg-[#2e2e3a] px-4 text-xs font-semibold uppercase tracking-wide text-white hover:bg-[#3a3a48] disabled:opacity-50"
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}