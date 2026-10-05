"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import { useSearchParams } from "next/navigation";
import { isRoomObserver, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { CardModal } from "./card-modal"
import { useBoardStore } from "@/store/athena/boardStore";

const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
import { useCardStore } from "@/store/athena/cardStore";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface Card {
  _id: string
  name: string
  userId?: string
  isOverDue?: boolean
  isCompleted?: boolean
  description: string
  tags: string[]
  tagData: Array<{ _id: string; name: string; color: string }>
  members: Array<{ _id: string; name: string; email: string }>
  dueDate?: string | number | undefined;
  startDate?: string | number | undefined;
  checklist?: { completed: number; total: number }
  commentCount?: number
  comments?: Array<{
    id: string
    user: { name: string; initials: string; bg: string }
    text: string
    createdAt: string
  }>
  priority?: string
  stageId: string
  assignedToIds?: string[]
  TaskDataCount?: {
    totalChildCount?: number
    totalCompletedChildCount?: number
  }
  attachments?: Array<{
    fileLink?: string
    fileName?: string
    fileType?: "document" | "image" | "video"
    comment?: string

    dueDate?: string | number;

  }>
}
type CalendarViewMode = "month" | "week" | "fourDays" | "day";

type CalendarTaskApi = {
  _id: string;
  title: string;
  tagData?: Array<{ _id: string; name: string; color: string }>
  description?: string;
  priority?: string;
  tags?: string[];
  assignedToIds?: string[];
  roomId?: string;
  stageId?: string;
  userId?: string;
  startDate?: number | null;
  dueDate?: number | null;
  convertedStartDate?: string | null;
  convertedDueDate?: string | null;
  stageData?: { _id: string; name?: string; color?: string } | null;
};

type AthenaCalendarEvent = {
  id: string;
  title: string;
  priority?: string;
  stageColor?: string;
  stageName?: string;
  tags?: string[];
  isAllDay: boolean;
  startMs?: number | null;
  endMs?: number | null;
  startDayMs: number;
  endDayMs: number;
};

// For month-view spanning layout
type PlacedEvent = {
  ev: AthenaCalendarEvent;
  colStart: number;
  colSpan: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
};

type WeekRow = {
  days: Date[];
  placed: PlacedEvent[];
  maxLane: number;
};

// Optimistic preview while dragging/resizing
type DragGhost = {
  id: string;
  startDayMs: number;
  endDayMs: number;
  startMs: number | null;
  endMs: number | null;
};

const DAY_MS = 86_400_000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function priorityToDotClass(priority?: string) {
  if (priority === "urgent") return "bg-red-500";
  if (priority === "high") return "bg-amber-500";
  if (priority === "normal") return "bg-blue-500";
  if (priority === "low") return "bg-slate-400";
  return "bg-slate-400";
}

function parseHexColor(hex?: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 8) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function stageColorBorder(stageColor?: string) {
  const rgb = parseHexColor(stageColor);
  if (!rgb) return "rgba(148,163,184,0.8)";
  return `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
}

function stageColorBg(stageColor?: string, alpha = 0.18) {
  const rgb = parseHexColor(stageColor);
  if (!rgb) return `rgba(148,163,184,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

const CALENDAR_ACCENT = "#FACC15";
const CALENDAR_VIEW_OPTIONS: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

function isDateOnlyDueLocal(d: Date): boolean {
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const ms = d.getMilliseconds();
  if (h === 0 && m === 0 && s === 0 && ms === 0) return true;
  if (h === 23 && m === 59 && s === 59) return true;
  return false;
}

function buildMonthLayout(monthDays: Date[], events: AthenaCalendarEvent[]): WeekRow[] {
  const weeks: Date[][] = [];
  for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));

  return weeks.map((days) => {
    const weekStartMs = startOfDay(days[0]).getTime();
    const weekEndMs = startOfDay(days[6]).getTime();

    const visible = events
      .filter((ev) => ev.startDayMs <= weekEndMs && ev.endDayMs >= weekStartMs)
      .slice()
      .sort((a, b) => {
        const aSpan = a.endDayMs - a.startDayMs;
        const bSpan = b.endDayMs - b.startDayMs;
        if (bSpan !== aSpan) return bSpan - aSpan;
        return a.startDayMs - b.startDayMs;
      });

    const laneBusyUntil: number[] = [];
    const placed: PlacedEvent[] = [];

    for (const ev of visible) {
      const clippedStart = Math.max(ev.startDayMs, weekStartMs);
      const clippedEnd = Math.min(ev.endDayMs, weekEndMs);
      const colStart = Math.round((clippedStart - weekStartMs) / 86_400_000);
      const colEnd = Math.round((clippedEnd - weekStartMs) / 86_400_000);
      const colSpan = colEnd - colStart + 1;

      let lane = 0;
      while ((laneBusyUntil[lane] ?? -1) >= colStart) lane++;
      laneBusyUntil[lane] = colEnd;

      placed.push({
        ev,
        colStart,
        colSpan,
        lane,
        isStart: ev.startDayMs >= weekStartMs,
        isEnd: ev.endDayMs <= weekEndMs,
      });
    }

    const maxLane = placed.length ? Math.max(...placed.map((p) => p.lane)) : -1;
    return { days, placed, maxLane };
  });
}

function buildAllDayLayout(
  rangeDays: Date[],
  events: AthenaCalendarEvent[]
): PlacedEvent[] {
  const rangeStartMs = startOfDay(rangeDays[0]).getTime();
  const rangeEndMs = startOfDay(rangeDays[rangeDays.length - 1]).getTime();
  const totalCols = rangeDays.length;

  const visible = events
    .filter((ev) => ev.isAllDay && ev.startDayMs <= rangeEndMs && ev.endDayMs >= rangeStartMs)
    .slice()
    .sort((a, b) => {
      const aSpan = a.endDayMs - a.startDayMs;
      const bSpan = b.endDayMs - b.startDayMs;
      if (bSpan !== aSpan) return bSpan - aSpan;
      return a.startDayMs - b.startDayMs;
    });

  const laneBusyUntil: number[] = [];
  const placed: PlacedEvent[] = [];

  for (const ev of visible) {
    const clippedStart = Math.max(ev.startDayMs, rangeStartMs);
    const clippedEnd = Math.min(ev.endDayMs, rangeEndMs);
    const colStart = Math.round((clippedStart - rangeStartMs) / 86_400_000);
    const colEnd = Math.min(
      Math.round((clippedEnd - rangeStartMs) / 86_400_000),
      totalCols - 1
    );
    const colSpan = colEnd - colStart + 1;

    let lane = 0;
    while ((laneBusyUntil[lane] ?? -1) >= colStart) lane++;
    laneBusyUntil[lane] = colEnd;

    placed.push({
      ev,
      colStart,
      colSpan,
      lane,
      isStart: ev.startDayMs >= rangeStartMs,
      isEnd: ev.endDayMs <= rangeEndMs,
    });
  }

  return placed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CalendarView() {
  const { currentRoomDetail, memberData: roomMemberData } = useTaskroomWorkspacetore();
  const searchParams = useSearchParams();
  const roomId = (searchParams.get("shareTask") ? searchParams.get("roomId") : currentRoomDetail?._id) || "";

  const { fetchBoardDetails } = useBoardStore();
  const { updateCard } = useCardStore();

  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()));
  const calendarMonthAnchor = useMemo(() => startOfMonth(anchorDate), [anchorDate]);

  const [events, setEvents] = useState<AthenaCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [showModal, setShowModal] = useState(false);
  const lastBoundsKeyRef = useRef<string>("");
  const columns = useTaskroomWorkspacetore((state) => state.columns);
  const setColumns = useTaskroomWorkspacetore((state) => state.setColumns);
  const { memberData } = useBoardStore();

  const isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData);

  const openCreateTaskDialog = useCallback(
    (dueDateMs?: number | null) => {
      if (isReadOnly) {
        toast.error("Observers can only view this board");
        return;
      }
      window.dispatchEvent(
        new CustomEvent("taskroom:open-create-task", {
          detail: {
            dueDateMs: dueDateMs ?? null,
            hideSubtask: true,
            defaultToCurrentRoom: true,
          },
        })
      );
    },
    [isReadOnly]
  );

  const openDraftForDate = useCallback(
    (date: Date) => {
      openCreateTaskDialog(startOfDay(date).getTime());
    },
    [openCreateTaskDialog]
  );

  const openCreateSheetForSlot = useCallback(
    (date: Date, timeIndex: number) => {
      const dayStartMs = startOfDay(date).getTime();
      const slotDueMs = dayStartMs + timeIndex * 30 * 60_000;
      openCreateTaskDialog(slotDueMs);
    },
    [openCreateTaskDialog]
  );

  // ── Calendar bounds & events ──────────────────────────────────────────────

  const computeMonthBounds = useCallback((anchor: Date) => {
    const s = startOfDay(startOfMonth(anchor));
    const e = endOfDay(endOfMonth(anchor));
    return { sBound: s.getTime(), eBound: e.getTime() };
  }, []);

  const currentMonthBounds = useMemo(
    () => computeMonthBounds(calendarMonthAnchor),
    [calendarMonthAnchor, computeMonthBounds]
  );

  const fetchCalendarEvents = useCallback(
    async (bounds: { sBound: number; eBound: number }) => {
      if (!roomId) return;
      const token = localStorage.getItem("garage_tok");
      setIsLoadingEvents(true);
      try {
        const url = `${TASKROOM_API_URL}rooms/detail/calendar/${roomId}?sBound=${bounds.sBound}&eBound=${bounds.eBound}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        const data = await res.json();
        if (!res.ok || data?.status === false) {
          throw new Error(data?.message || "Failed to load calendar tasks");
        }

        const apiTasks: CalendarTaskApi[] = Array.isArray(data?.data) ? data.data : [];

        const mapped: AthenaCalendarEvent[] = apiTasks
          .filter((t) => !!t?._id && !!t?.title)
          .map((task) => {
            const startDate = task.startDate ?? null;
            const dueDate = task.dueDate ?? null;

            const convertedStartMs = task.convertedStartDate
              ? new Date(task.convertedStartDate).getTime()
              : null;
            const convertedDueMs = task.convertedDueDate
              ? new Date(task.convertedDueDate).getTime()
              : null;

            const stageColor = task.stageData?.color ?? undefined;
            const priorityVal = task.priority ?? undefined;
            const stageName = task.stageData?.name ?? undefined;
            const tags = task.tags ?? [];

            const noStartDate = startDate === null || startDate === undefined;

            if (noStartDate) {
              const dueMsRaw =
                convertedDueMs ?? (dueDate !== null && dueDate !== undefined ? Number(dueDate) : null);
              const dueMs = dueMsRaw != null && !Number.isNaN(dueMsRaw) ? dueMsRaw : null;
              const due = dueMs != null ? new Date(dueMs) : new Date();
              const day = startOfDay(due).getTime();

              if (dueMs != null && !isDateOnlyDueLocal(due)) {
                const MIN_DURATION_MS = 30 * 60 * 1000;
                return {
                  id: task._id,
                  title: task.title,
                  priority: priorityVal,
                  stageColor,
                  stageId: task.stageData?._id,
                  stageName,
                  tagData: task?.tagData,
                  tags,
                  isAllDay: false,
                  startMs: dueMs,
                  endMs: dueMs + MIN_DURATION_MS,
                  startDayMs: day,
                  endDayMs: day,
                };
              }

              return {
                id: task._id,
                title: task.title,
                priority: priorityVal,
                stageColor,
                stageName,
                tagData: task?.tagData,
                stageId: task.stageData?._id,
                tags,
                isAllDay: true,
                startMs: null,
                endMs: null,
                startDayMs: day,
                endDayMs: day,
              };
            }

            const startMs = (convertedStartMs ??
              (startDate !== null ? Number(startDate) : null)) as number | null;
            let endMs = (convertedDueMs ??
              (dueDate !== null ? Number(dueDate) : null)) as number | null;
            if (endMs === null) endMs = startMs;

            const MIN_DURATION_MS = 30 * 60 * 1000;
            if (startMs && endMs !== null && endMs <= startMs) {
              endMs = startMs + MIN_DURATION_MS;
            }

            const endForDay = (endMs ?? startMs ?? Date.now()) as number;

            const localStart = startMs ? new Date(startMs) : null;
            const localEnd = endForDay ? new Date(endForDay) : null;

            const startIsMidnight =
              !!localStart &&
              localStart.getHours() === 0 &&
              localStart.getMinutes() === 0 &&
              localStart.getSeconds() === 0 &&
              localStart.getMilliseconds() === 0;

            const endIsEndOfDay =
              !!localEnd &&
              localEnd.getHours() === 23 &&
              localEnd.getMinutes() === 59 &&
              localEnd.getSeconds() === 59;

            const startDayMs = startMs
              ? startOfDay(new Date(startMs)).getTime()
              : startOfDay(new Date()).getTime();
            const endDayMs = startOfDay(new Date(endForDay)).getTime();

            const treatAsAllDayRange = startIsMidnight && endIsEndOfDay && endDayMs >= startDayMs;

            return {
              id: task._id,
              title: task.title,
              priority: priorityVal,
              stageColor,
              stageName,
              tags,
              isAllDay: treatAsAllDayRange,
              tagData: task?.tagData,
              stageId: task.stageData?._id,
              startMs: treatAsAllDayRange ? null : startMs,
              endMs: treatAsAllDayRange ? null : endMs,
              startDayMs,
              endDayMs,
            };
          });

        setEvents(mapped);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load calendar tasks.");
      } finally {
        setIsLoadingEvents(false);
      }
    },
    [roomId]
  );

  const applyDateUpdate = useCallback(
    async (cardId: string, payload: { startDate: number | null; dueDate: number | null }) => {
      if (isReadOnly) {
        toast.error("Observers can only view this board");
        return;
      }
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== cardId) return ev;

          const nextStartMs = payload.startDate;
          const nextEndMs = payload.dueDate;

          const nextStartDayMs =
            nextStartMs != null
              ? startOfDay(new Date(nextStartMs)).getTime()
              : ev.startDayMs;
          const nextEndDayMs =
            nextEndMs != null
              ? startOfDay(new Date(nextEndMs)).getTime()
              : nextStartMs != null
                ? startOfDay(new Date(nextStartMs)).getTime()
                : ev.endDayMs;

          return {
            ...ev,
            startMs: nextStartMs,
            endMs: nextEndMs,
            startDayMs: nextStartDayMs,
            endDayMs: nextEndDayMs,
          };
        })
      );

      try {
        await updateCard(cardId, { ...payload, socketId: undefined } as any);
      } catch (e) {
        console.error(e);
        toast.error("Failed to update task dates.");
        fetchCalendarEvents(currentMonthBounds);
      }
    },
    [updateCard, fetchCalendarEvents, currentMonthBounds, isReadOnly]
  );

  useEffect(() => {
    if (!roomId) return;
    const key = `${currentMonthBounds.sBound}-${currentMonthBounds.eBound}`;
    if (lastBoundsKeyRef.current === key) return;
    lastBoundsKeyRef.current = key;
    fetchCalendarEvents(currentMonthBounds);
  }, [currentMonthBounds, fetchCalendarEvents, roomId]);

  // ── Layout constants ───────────────────────────────────────────────────────
  const SLOT_HEIGHT = 48;
  const startHour = 0;
  const endHour = 24;

  useEffect(() => {
    const handleTaskCreated = () => {
      fetchCalendarEvents(currentMonthBounds);
    };
    window.addEventListener("taskroom:task-created", handleTaskCreated);
    return () => window.removeEventListener("taskroom:task-created", handleTaskCreated);
  }, [currentMonthBounds, fetchCalendarEvents]);

  const toggle = async (data: any) => {
    const normalized = {
      ...data,                    // shallow copy
      startDate: data.startDayMs,   // use original `data.` to be safe
      dueDate: data?.endDayMs,     // or data.endDayMs - 1 if you want end of previous day
      name: data.title,
      _id: data?.id
      // delete any old fields you don't want (optional)
      // startDateMs: undefined,   // if you want to clean up
      // ttitle: undefined,
    };

    await setActiveCard(normalized);
    await setShowModal(true);
  };

  // ── Drag & drop (month) ────────────────────────────────────────────────────

  const dragEventIdRef = useRef<string | null>(null);
  const dragOffsetDaysRef = useRef<number>(0);
  const updateTaskAndCardCounts = () => {

  }
  const handleEventDragStart = useCallback(
    (e: React.DragEvent, ev: AthenaCalendarEvent, grabDayMs: number) => {
      if (isReadOnly) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      dragEventIdRef.current = ev.id;
      dragOffsetDaysRef.current = Math.round((grabDayMs - ev.startDayMs) / DAY_MS);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", ev.id);

      setDragGhost({
        id: ev.id,
        startDayMs: ev.startDayMs,
        endDayMs: ev.endDayMs,
        startMs: ev.startMs ?? null,
        endMs: ev.endMs ?? null,
      });
    },
    [isReadOnly]
  );

  const handleDragEnd = useCallback(() => {
    dragEventIdRef.current = null;
    setDragGhost(null);
  }, []);

  const handleWeekRowDragOver = useCallback(
    (e: React.DragEvent, weekStartDayMs: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const id = dragEventIdRef.current;
      if (!id) return;
      const ev = events.find((x) => x.id === id);
      if (!ev) return;

      const rowEl = e.currentTarget as HTMLElement;
      const rect = rowEl.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width - 1);
      const col = clamp(Math.floor((x / rect.width) * 7), 0, 6);
      const dayMs = weekStartDayMs + col * DAY_MS;

      const span = ev.endDayMs - ev.startDayMs;
      const newStartDayMs = dayMs - dragOffsetDaysRef.current * DAY_MS;
      const newEndDayMs = newStartDayMs + span;

      if (ev.isAllDay) {
        setDragGhost({
          id: ev.id,
          startDayMs: newStartDayMs,
          endDayMs: newEndDayMs,
          startMs: null,
          endMs: null,
        });
        return;
      }

      setDragGhost({
        id: ev.id,
        startDayMs: newStartDayMs,
        endDayMs: newEndDayMs,
        startMs: ev.startMs ? newStartDayMs + (ev.startMs - ev.startDayMs) : null,
        endMs: ev.endMs ? newStartDayMs + (ev.endMs - ev.startDayMs) : null,
      });
    },
    [events]
  );

  const handleWeekRowDrop = useCallback(
    async (e: React.DragEvent, weekStartDayMs: number) => {
      e.preventDefault();
      const id = dragEventIdRef.current;
      dragEventIdRef.current = null;
      if (!id) return;
      const ev = events.find((x) => x.id === id);
      if (!ev) {
        setDragGhost(null);
        return;
      }

      const rowEl = e.currentTarget as HTMLElement;
      const rect = rowEl.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width - 1);
      const col = clamp(Math.floor((x / rect.width) * 7), 0, 6);
      const dayMs = weekStartDayMs + col * DAY_MS;

      const span = ev.endDayMs - ev.startDayMs;
      const newStartDayMs = dayMs - dragOffsetDaysRef.current * DAY_MS;
      const newEndDayMs = newStartDayMs + span;

      setDragGhost(null);

      if (ev.isAllDay) {
        await applyDateUpdate(id, {
          startDate: startOfDay(new Date(newStartDayMs)).getTime(),
          dueDate: endOfDay(new Date(newEndDayMs)).getTime(),
        });
        return;
      }

      const newStartMs = ev.startMs
        ? newStartDayMs + (ev.startMs - ev.startDayMs)
        : newStartDayMs;
      const newDueMs = ev.endMs
        ? newStartDayMs + (ev.endMs - ev.startDayMs)
        : newEndDayMs;
      await applyDateUpdate(id, { startDate: newStartMs, dueDate: newDueMs });
    },
    [events, applyDateUpdate, isReadOnly]
  );

  const resizeMonthRef = useRef<{
    id: string;
    origEndDayMs: number;
    origStartDayMs: number;
    startX: number;
    colW: number;
  } | null>(null);

  const handleMonthResizeMouseDown = useCallback(
    (e: React.MouseEvent, ev: AthenaCalendarEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isReadOnly) return;

      const rowEl = (e.currentTarget as HTMLElement).closest(
        '[data-week-row="true"]'
      ) as HTMLElement | null;
      const colW = rowEl ? rowEl.getBoundingClientRect().width / 7 : 140;

      resizeMonthRef.current = {
        id: ev.id,
        origEndDayMs: ev.endDayMs,
        origStartDayMs: ev.startDayMs,
        startX: e.clientX,
        colW,
      };

      setDragGhost({
        id: ev.id,
        startDayMs: ev.startDayMs,
        endDayMs: ev.endDayMs,
        startMs: ev.startMs ?? null,
        endMs: ev.endMs ?? null,
      });

      const onMove = (me: MouseEvent) => {
        if (!resizeMonthRef.current) return;
        const { origEndDayMs, origStartDayMs, startX, colW } = resizeMonthRef.current;

        const hit = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
        const cell = hit?.closest?.("[data-day-ms]") as HTMLElement | null;
        const hoveredDayMs = cell?.dataset?.dayMs ? Number(cell.dataset.dayMs) : null;

        const fallbackDeltaDays = Math.round((me.clientX - startX) / colW);
        const fallbackEnd = origEndDayMs + fallbackDeltaDays * DAY_MS;
        const newEndDayMs = Math.max(origStartDayMs, hoveredDayMs ?? fallbackEnd);
        setDragGhost((g) => (g ? { ...g, endDayMs: newEndDayMs } : null));
      };

      const onUp = async (me: MouseEvent) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        const ref = resizeMonthRef.current;
        resizeMonthRef.current = null;
        if (!ref) return;

        const { id, origEndDayMs, origStartDayMs, startX, colW } = ref;

        const hit = document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
        const cell = hit?.closest?.("[data-day-ms]") as HTMLElement | null;
        const hoveredDayMs = cell?.dataset?.dayMs ? Number(cell.dataset.dayMs) : null;

        const fallbackDeltaDays = Math.round((me.clientX - startX) / colW);
        const fallbackEnd = origEndDayMs + fallbackDeltaDays * DAY_MS;
        const newEndDayMs = Math.max(origStartDayMs, hoveredDayMs ?? fallbackEnd);

        setDragGhost(null);
        if (newEndDayMs === origEndDayMs) return;

        const evObj = events.find((x) => x.id === id);
        if (!evObj) return;

        if (evObj.isAllDay) {
          await applyDateUpdate(id, {
            startDate: startOfDay(new Date(evObj.startDayMs)).getTime(),
            dueDate: endOfDay(new Date(newEndDayMs)).getTime(),
          });
          return;
        }

        const newDueMs = endOfDay(new Date(newEndDayMs)).getTime();
        await applyDateUpdate(id, {
          startDate: evObj.startMs ?? evObj.startDayMs,
          dueDate: newDueMs,
        });
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [events, applyDateUpdate, isReadOnly]
  );

  const timedDragRef = useRef<{
    id: string;
    type: "move" | "resize-start" | "resize-end";
    origStart: number;
    origEnd: number;
    startY: number;
  } | null>(null);
  const dragGhostRef = useRef<DragGhost | null>(null);

  const handleTimedMouseDown = useCallback(
    (
      e: React.MouseEvent,
      ev: AthenaCalendarEvent,
      type: "move" | "resize-start" | "resize-end"
    ) => {
      e.stopPropagation();
      e.preventDefault();
      if (isReadOnly || ev.startMs == null || ev.endMs == null) return;

      timedDragRef.current = {
        id: ev.id,
        type,
        origStart: ev.startMs,
        origEnd: ev.endMs,
        startY: e.clientY,
      };

      const initialGhost: DragGhost = {
        id: ev.id,
        startDayMs: ev.startDayMs,
        endDayMs: ev.endDayMs,
        startMs: ev.startMs,
        endMs: ev.endMs,
      };
      dragGhostRef.current = initialGhost;
      setDragGhost(initialGhost);

      const MIN_DUR = 15 * 60_000;
      const SNAP = 15 * 60_000;
      const minsPerPx = 30 / SLOT_HEIGHT;
      const snap = (ms: number) => Math.round(ms / SNAP) * SNAP;

      const onMove = (me: MouseEvent) => {
        if (!timedDragRef.current) return;
        const { type, origStart, origEnd, startY, id } = timedDragRef.current;
        const rawDeltaMs = (me.clientY - startY) * minsPerPx * 60_000;
        const deltaMs = snap(rawDeltaMs);

        let next: DragGhost;
        if (type === "move") {
          const ns = origStart + deltaMs;
          const ne = origEnd + deltaMs;
          next = {
            id,
            startDayMs: startOfDay(new Date(ns)).getTime(),
            endDayMs: startOfDay(new Date(ne)).getTime(),
            startMs: ns,
            endMs: ne,
          };
        } else if (type === "resize-end") {
          const ne = Math.max(origStart + MIN_DUR, origEnd + deltaMs);
          const prev = dragGhostRef.current!;
          next = { ...prev, endMs: ne, endDayMs: startOfDay(new Date(ne)).getTime() };
        } else {
          const ns = Math.min(origEnd - MIN_DUR, origStart + deltaMs);
          const prev = dragGhostRef.current!;
          next = { ...prev, startMs: ns, startDayMs: startOfDay(new Date(ns)).getTime() };
        }
        dragGhostRef.current = next;
        setDragGhost(next);
      };

      const onUp = async () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        const ref = timedDragRef.current;
        timedDragRef.current = null;
        if (!ref) return;

        const g = dragGhostRef.current;
        dragGhostRef.current = null;
        setDragGhost(null);
        if (!g) return;

        const ns = g.startMs ?? ref.origStart;
        const ne = g.endMs ?? ref.origEnd;
        if (ns === ref.origStart && ne === ref.origEnd) return;
        await applyDateUpdate(ref.id, { startDate: ns, dueDate: ne });
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [SLOT_HEIGHT, applyDateUpdate, isReadOnly]
  );

  const eventsForRender = useMemo(() => {
    if (!dragGhost) return events;
    return events.map((ev) =>
      ev.id === dragGhost.id
        ? {
          ...ev,
          startDayMs: dragGhost.startDayMs,
          endDayMs: dragGhost.endDayMs,
          startMs: dragGhost.startMs,
          endMs: dragGhost.endMs,
        }
        : ev
    );
  }, [events, dragGhost]);

  // ── Derived calendar data ──────────────────────────────────────────────────

  const startOfWeekSunday = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
  };

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonthAnchor);
    const monthEnd = endOfMonth(calendarMonthAnchor);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1))
      days.push(new Date(d));
    return days;
  }, [calendarMonthAnchor]);

  const rangeDays = useMemo(() => {
    if (viewMode === "month") return [];
    if (viewMode === "day") return [startOfDay(anchorDate)];
    if (viewMode === "fourDays") {
      return Array.from({ length: 4 }, (_, i) => addDays(startOfDay(anchorDate), i));
    }
    const start = startOfWeekSunday(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate, viewMode]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  }, []);

  const weekRows = useMemo(
    () => (viewMode === "month" ? buildMonthLayout(monthDays, eventsForRender) : []),
    [monthDays, eventsForRender, viewMode]
  );

  const allDayPlaced = useMemo(
    () =>
      viewMode !== "month" && rangeDays.length > 0
        ? buildAllDayLayout(rangeDays, eventsForRender)
        : [],
    [rangeDays, eventsForRender, viewMode]
  );
  const allDayMaxLane = allDayPlaced.length
    ? Math.max(...allDayPlaced.map((p) => p.lane))
    : -1;

  const navLabel = useMemo(() => {
    if (viewMode === "month") return format(calendarMonthAnchor, "MMMM yyyy");
    if (viewMode === "day") return format(anchorDate, "EEEE, MMMM d yyyy");
    if (rangeDays.length === 0) return "";
    const first = rangeDays[0];
    const last = rangeDays[rangeDays.length - 1];
    if (first.getMonth() === last.getMonth())
      return `${format(first, "MMM d")} – ${format(last, "d, yyyy")}`;
    return `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
  }, [viewMode, calendarMonthAnchor, anchorDate, rangeDays]);

  const handlePrev = () => {
    if (viewMode === "month") setAnchorDate((d) => startOfDay(addMonths(d, -1)));
    else if (viewMode === "week") setAnchorDate((d) => addDays(d, -7));
    else if (viewMode === "fourDays") setAnchorDate((d) => addDays(d, -4));
    else setAnchorDate((d) => addDays(d, -1));
  };

  const handleNext = () => {
    if (viewMode === "month") setAnchorDate((d) => startOfDay(addMonths(d, 1)));
    else if (viewMode === "week") setAnchorDate((d) => addDays(d, 7));
    else if (viewMode === "fourDays") setAnchorDate((d) => addDays(d, 4));
    else setAnchorDate((d) => addDays(d, 1));
  };

  const LANE_H = 26;
  const LANE_GAP = 2;
  const DAY_NUM_H = 36;
  const DAY_EVENT_GAP = 4;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-black overflow-hidden pb-16 md:pb-0">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-6 py-3 border-b border-white/10 bg-black shrink-0 relative z-50">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="h-8 w-8 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-8 w-8 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="text-sm sm:text-base font-semibold text-white min-w-0 truncate">
            {navLabel}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchorDate(startOfDay(new Date()))}
            className="h-8 px-3 rounded-lg border border-white/10 text-white/80 hover:text-white hover:bg-white/5 text-[13px]"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
            {CALENDAR_VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                className={cn(
                  "px-3 py-1.5 text-[13px] font-medium transition-colors",
                  viewMode === opt.id
                    ? "bg-[#FACC15] text-black"
                    : "bg-[#141414] text-white/50 hover:text-white/80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                const targetDate = viewMode === "month" ? new Date() : anchorDate;
                openCreateTaskDialog(startOfDay(targetDate).getTime());
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
              style={{ backgroundColor: CALENDAR_ACCENT }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        <div className="h-full bg-black">

          {/* ══════════════════════════════════════════════════════════════════
              MONTH VIEW
          ══════════════════════════════════════════════════════════════════ */}
          {viewMode === "month" && (
            <div className="h-full overflow-auto px-2 sm:px-4 py-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <div className="grid grid-cols-7 border border-white/10">
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-medium text-white/40 py-2 border-b border-white/10 bg-black"
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="flex flex-col border-x border-b border-white/10">
                {weekRows.map((week, wi) => {
                  const rowMinH = Math.max(
                    DAY_NUM_H + DAY_EVENT_GAP + (week.maxLane + 1) * (LANE_H + LANE_GAP) + 10,
                    100
                  );

                  return (
                    <div
                      key={wi}
                      data-week-row="true"
                      className="relative grid grid-cols-7 border-b border-white/10 last:border-b-0"
                      style={{ minHeight: rowMinH }}
                      onDragOver={(e) =>
                        handleWeekRowDragOver(
                          e,
                          startOfDay(week.days[0]).getTime()
                        )
                      }
                      onDrop={(e) =>
                        handleWeekRowDrop(e, startOfDay(week.days[0]).getTime())
                      }
                    >
                      {week.days.map((day) => {
                        const dayStartMs = startOfDay(day).getTime();
                        const isCurrentMonth =
                          day.getMonth() === calendarMonthAnchor.getMonth();
                        const isTodayDate =
                          dayStartMs === startOfDay(new Date()).getTime();

                        return (
                          <div
                            key={dayStartMs}
                            data-day-ms={dayStartMs}
                            role="button"
                            tabIndex={0}
                            onClick={() => openDraftForDate(day)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openDraftForDate(day);
                            }}
                            className={cn(
                              "relative bg-black border-r border-white/10 last:border-r-0 cursor-pointer select-none group/cell",
                              !isCurrentMonth && "opacity-40"
                            )}
                            style={{ minHeight: rowMinH }}
                          >
                            <div
                              className="relative z-20 flex items-start justify-between px-2 pt-2 bg-black"
                              style={{ height: DAY_NUM_H }}
                            >
                              <div
                                className={cn(
                                  "text-[13px] font-medium",
                                  isTodayDate
                                    ? "w-7 h-7 rounded-full flex items-center justify-center text-black font-semibold"
                                    : isCurrentMonth
                                      ? "text-white/80 px-1"
                                      : "text-white/30 px-1"
                                )}
                                style={isTodayDate ? { backgroundColor: CALENDAR_ACCENT } : undefined}
                              >
                                {day.getDate()}
                              </div>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDraftForDate(day);
                                  }}
                                  className="opacity-0 group-hover/cell:opacity-100 md:opacity-0 md:group-hover/cell:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
                                  aria-label="Add task"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {week.placed.map((p, pi) => {
                        const { ev, colStart, colSpan, lane, isStart, isEnd } = p;
                        const bg = stageColorBg(ev.stageColor, 0.28);
                        const border = stageColorBorder(ev.stageColor);
                        const timeText =
                          ev.isAllDay || !ev.startMs
                            ? ""
                            : format(new Date(ev.startMs), "h:mm a");
                        const showTime = isStart && !!timeText;

                        const leftPct = (colStart / 7) * 100;
                        const widthPct = (colSpan / 7) * 100;
                        const top = DAY_NUM_H + DAY_EVENT_GAP + lane * (LANE_H + LANE_GAP);

                        return (
                          <div
                            key={`${ev.id}-${wi}-${pi}`}
                            draggable={!isReadOnly}
                            onDragStart={(e) =>
                              handleEventDragStart(
                                e,
                                ev,
                                startOfDay(week.days[0]).getTime() +
                                colStart * DAY_MS
                              )
                            }
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggle(p?.ev)
                            }
                            }
                            title={ev.title}
                            className={cn(
                              "absolute z-10 overflow-hidden select-none group rounded-md",
                              dragGhost?.id === ev.id ? "opacity-60" : "opacity-100"
                            )}
                            style={{
                              left: `calc(${leftPct}% + 3px)`,
                              width: `calc(${widthPct}% - 6px)`,
                              top,
                              height: LANE_H,
                              backgroundColor: bg,
                              cursor: isReadOnly ? "pointer" : "grab",
                            }}
                          >
                            <div className="flex h-full min-w-0">
                              {isStart && (
                                <div className="w-1 shrink-0 rounded-l-md" style={{ backgroundColor: border }} />
                              )}
                              <div className="min-w-0 flex-1 flex items-center gap-1.5 px-2 py-0.5">
                                <span className="truncate text-[11px] font-medium text-white/90">
                                  {showTime ? `${timeText} ${ev.title}` : ev.title}
                                </span>
                              </div>
                            </div>

                            {isEnd && !isReadOnly && (
                              <div
                                draggable={false}
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-white/25 transition-opacity rounded-r"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleMonthResizeMouseDown(e, ev);
                                }}
                                onDragStart={(e) => e.preventDefault()}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              WEEK / 4-DAY / DAY VIEW
          ══════════════════════════════════════════════════════════════════ */}
          {viewMode !== "month" && (
            <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
              style={{
                paddingBottom: "0.5rem"
              }}
            >
              <div className="sticky top-0 z-20 bg-[#111116] border-b border-[#e5e7eb29]">
                <div
                  className="grid border-b border-[#e5e7eb29]"
                  style={{
                    gridTemplateColumns: `60px repeat(${rangeDays.length}, 1fr)`,
                  }}
                >
                  <div className="border-r border-[#e5e7eb29] h-16" />
                  {rangeDays.map((day) => {
                    const dayStartMs = startOfDay(day).getTime();
                    const isTodayDate =
                      dayStartMs === startOfDay(new Date()).getTime();
                    return (
                      <div
                        key={dayStartMs}
                        className={cn(
                          "px-2 py-3 border-r border-[#e5e7eb29] select-none group/col",
                          isTodayDate && "bg-[#343439]"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="cursor-pointer"
                            onClick={() => openDraftForDate(day)}
                          >
                            <div className="text-xs text-white/50 uppercase tracking-wide">
                              {day.toLocaleDateString("en-US", {
                                weekday: "short",
                              })}
                            </div>
                            <div
                              className={cn(
                                "text-2xl font-semibold mt-0.5",
                                isTodayDate
                                  ? "text-yellow-400"
                                  : "text-white/50"
                              )}
                            >
                              {day.getDate().toString().padStart(2, "0")}
                            </div>
                            {isTodayDate && (
                              <div className="text-[10px] text-yellow-400 font-medium">
                                TODAY
                              </div>
                            )}
                          </div>
                          {/* + Add task button on hover */}
                          {!isReadOnly && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDraftForDate(day);
                            }}
                            className="opacity-0 group-hover/col:opacity-100 transition-opacity mt-1 w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
                            aria-label="Add task"
                          >
                            <span className="text-lg leading-none">+</span>
                          </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {allDayPlaced.length > 0 && (
                  <div
                    className="relative"
                    style={{
                      gridTemplateColumns: `60px repeat(${rangeDays.length}, 1fr)`,
                      height:
                        (allDayMaxLane + 1) * (LANE_H + LANE_GAP) + 8,
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 border-r border-[#e5e7eb29] text-[10px] text-white/50 flex items-start pt-1 px-1"
                      style={{ width: 60, height: "100%" }}
                    >
                      ALL DAY
                    </div>

                    {rangeDays.map((day, ci) => (
                      <div
                        key={ci}
                        className="absolute top-0 bottom-0 border-r border-[#e5e7eb29]"
                        style={{
                          left: `calc(60px + ${(ci / rangeDays.length) * 100}% * (100% - 60px) / 100)`,
                          width: `calc((100% - 60px) / ${rangeDays.length})`,
                        }}
                      />
                    ))}

                    {allDayPlaced.map((p, pi) => {
                      const { ev, colStart, colSpan, lane, isStart, isEnd } = p;
                      const bg = stageColorBg(ev.stageColor, 0.22);
                      const border = stageColorBorder(ev.stageColor);
                      const colW = `calc((100% - 60px) / ${rangeDays.length})`;
                      const top = 4 + lane * (LANE_H + LANE_GAP);

                      return (
                        <button
                          key={`allday-${ev.id}-${pi}`}
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          title={ev.title}
                          className="absolute z-10 flex items-center gap-1.5 px-2 text-xs font-medium hover:brightness-110 transition overflow-hidden cursor-pointer"
                          style={{
                            left: `calc(60px + ${colStart} * ${colW} + 2px)`,
                            width: `calc(${colSpan} * ${colW} - 4px)`,
                            top,
                            height: LANE_H,
                            backgroundColor: bg,
                            borderTop: `1.5px solid ${border}`,
                            borderBottom: `1.5px solid ${border}`,
                            borderLeft: isStart
                              ? `3px solid ${border}`
                              : "none",
                            borderRight: isEnd
                              ? `1.5px solid ${border}`
                              : "none",
                            borderRadius:
                              isStart && isEnd
                                ? 5
                                : isStart
                                  ? "5px 0 0 5px"
                                  : isEnd
                                    ? "0 5px 5px 0"
                                    : 0,
                            color: "rgba(255,255,255,0.9)",
                          }}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              priorityToDotClass(ev.priority)
                            )}
                          />
                          <span className="truncate">
                            {ev.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `60px repeat(${rangeDays.length}, 1fr)`,
                    gridAutoRows: `${SLOT_HEIGHT}px`,
                  }}
                >
                  {timeSlots.map((time, timeIndex) => {
                    const isHour = time.endsWith(":00");
                    return (
                      <React.Fragment key={`${time}-${timeIndex}`}>
                        <div
                          className={cn(
                            "border-r border-[#e5e7eb29] px-2 text-right",
                            isHour
                              ? "border-t border-[#e5e7eb29]"
                              : "border-t border-[#e5e7eb29]"
                          )}
                        >
                          {isHour && (
                            <span className="text-xs text-white/50 -mt-2 inline-block">
                              {time}
                            </span>
                          )}
                        </div>
                        {rangeDays.map((day) => {
                          const dayStartMs = startOfDay(day).getTime();
                          return (
                            <div
                              key={`${dayStartMs}-${timeIndex}`}
                              className={cn(
                                "border-r border-[#e5e7eb29] relative",
                                isHour
                                  ? "border-t border-[#e5e7eb29]"
                                  : "border-t border-[#e5e7eb29]"
                              )}
                              onClick={() =>
                                openCreateSheetForSlot(day, timeIndex)
                              }
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div
                  className="absolute top-0 left-[60px] right-0 pointer-events-none"
                  style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                >
                  <div
                    className="relative h-full"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${rangeDays.length}, 1fr)`,
                    }}
                  >
                    {rangeDays.map((day) => {
                      const dayStartMs = startOfDay(day).getTime();
                      const dayStartHourMs = dayStartMs + startHour * 3600_000;
                      const dayEndHourMs = dayStartMs + endHour * 3600_000;

                      const timedEvents = eventsForRender.filter(
                        (ev) =>
                          !ev.isAllDay &&
                          ev.startMs != null &&
                          ev.endMs != null &&
                          ev.startMs < dayEndHourMs &&
                          ev.endMs > dayStartHourMs
                      );

                      type TimedPlaced = {
                        ev: AthenaCalendarEvent;
                        col: number;
                        totalCols: number;
                      };
                      const placed2: TimedPlaced[] = [];
                      const colEnds: number[] = [];
                      for (const ev of timedEvents) {
                        const s = ev.startMs!;
                        let col = 0;
                        while (col < colEnds.length && colEnds[col] > s) col++;
                        colEnds[col] = ev.endMs!;
                        placed2.push({ ev, col, totalCols: 1 });
                      }
                      const maxCol = placed2.length
                        ? Math.max(...placed2.map((p) => p.col)) + 1
                        : 1;
                      placed2.forEach((p) => {
                        p.totalCols = maxCol;
                      });

                      return (
                        <div
                          key={dayStartMs}
                          className="relative pointer-events-none"
                        >
                          {placed2.map(({ ev, col, totalCols }) => {
                            const s = ev.startMs!;
                            const e = ev.endMs!;
                            const displayStart = Math.max(s, dayStartHourMs);
                            const displayEnd = Math.min(e, dayEndHourMs);
                            if (displayEnd <= displayStart) return null;

                            const topMinutes =
                              (displayStart - dayStartHourMs) / 60_000;
                            const durationMinutes =
                              (displayEnd - displayStart) / 60_000;
                            const top = (topMinutes / 30) * SLOT_HEIGHT;
                            const height = Math.max(
                              (durationMinutes / 30) * SLOT_HEIGHT,
                              SLOT_HEIGHT
                            );

                            const bg = stageColorBg(ev.stageColor, 0.22);
                            const border = stageColorBorder(ev.stageColor);

                            const startTimeText = new Date(
                              displayStart
                            ).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: false,
                            });

                            const widthPct = 100 / totalCols;
                            const leftPct = col * widthPct;

                            return (
                              <div
                                key={ev.id}
                                role="button"
                                tabIndex={0}
                                onClick={(e2) => e2.stopPropagation()}
                                onMouseDown={(me) =>
                                  handleTimedMouseDown(me, ev, "move")
                                }
                                className={cn(
                                  "absolute pointer-events-auto rounded-md border hover:brightness-110 transition select-none group",
                                  dragGhost?.id === ev.id
                                    ? "opacity-60"
                                    : "opacity-100"
                                )}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${widthPct}% - 4px)`,
                                  backgroundColor: bg,
                                  borderColor: border,
                                  borderLeft: `4px solid ${border}`,
                                  cursor: isReadOnly ? "pointer" : "grab",
                                }}
                                title={ev.title}
                              >
                                {!isReadOnly && (
                                <div
                                  className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity rounded-t"
                                  onMouseDown={(me) => {
                                    me.stopPropagation();
                                    handleTimedMouseDown(
                                      me,
                                      ev,
                                      "resize-start"
                                    );
                                  }}
                                />
                                )}

                                <div className="px-2 py-1 h-full flex flex-col justify-start pointer-events-none overflow-hidden">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full shrink-0",
                                        priorityToDotClass(ev.priority)
                                      )}
                                    />
                                    <span className="text-[11px] font-medium text-white/50/90 truncate">
                                      {startTimeText} {ev.title}
                                    </span>
                                  </div>
                                  {height > SLOT_HEIGHT && ev.stageName && (
                                    <span className="text-[10px] text-white/50/50 truncate mt-0.5 pl-3">
                                      {ev.stageName}
                                    </span>
                                  )}
                                </div>

                                {!isReadOnly && (
                                <div
                                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity rounded-b flex items-center justify-center"
                                  onMouseDown={(me) => {
                                    me.stopPropagation();
                                    handleTimedMouseDown(me, ev, "resize-end");
                                  }}
                                >
                                  <div className="w-8 h-0.5 rounded bg-white/30" />
                                </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isLoadingEvents && (
          <div className="absolute inset-0 bg-black/10 pointer-events-none flex items-center justify-center">
            <div className="text-white/50/60 text-sm">Loading…</div>
          </div>
        )}
      </div>

      {showModal && <CardModal connected={false} updateTaskAndCardCounts={updateTaskAndCardCounts} card={activeCard} userId={"userId"} onClose={() => setShowModal(false)} boardId={roomId} orgId={"orgId"} setColumns={setColumns} isReadOnly={isReadOnly} />}

    </div>
  );
}
