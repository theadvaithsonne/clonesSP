"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Flag,
  Sparkles,
  UserPlus,
  X,
  Check,
  Layers,
  Loader2,
} from "lucide-react";

import { useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useCardStore } from "@/store/athena/cardStore";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AssigneePicker } from "./assignee-picker";
import { CustomDatePicker } from "./custom-date-picker";
import { PriorityPicker, type PriorityLevel } from "./priority-picker";
import { TagPicker } from "./tag-picker";

const ACCENT = "#FACC15";
const DROPDOWN_BG = "bg-[#161616]";
const STAGE_PAGE_SIZE = 20;
const PARENT_TASK_PAGE_SIZE = 10;

const STAGE_TYPE_ORDER: Record<string, number> = { tostart: 0, active: 1, done: 2, closed: 3 };

function sortStages(stages: Stage[]) {
  return [...stages].sort(
    (a, b) => (STAGE_TYPE_ORDER[a?.stageType ?? ""] ?? 99) - (STAGE_TYPE_ORDER[b?.stageType ?? ""] ?? 99)
  );
}

type Stage = {
  _id: string;
  name?: string;
  color?: string;
  stageType?: string;
};

type RoomOption = {
  _id: string;
  name?: string;
  spaceId?: string;
  bgImage?: string;
};

function capitalizeName(value?: string) {
  if (!value) return "Untitled Room";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type CreateTab = "task" | "subtask";

export type CreateTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDueDateMs?: number | null;
  initialStartDateMs?: number | null;
  onCreated?: () => void;
  hideSubtaskTab?: boolean;
  defaultToCurrentRoom?: boolean;
};

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

function stageStatusLabel(stage?: Stage) {
  if (!stage) return "Select status";
  if (stage.stageType === "tostart") return stage.name || "To Do";
  if (stage.stageType === "done") return stage.name || "Done";
  if (stage.stageType === "closed") return stage.name || "Closed";
  return stage.name || "In Progress";
}

function priorityLabel(priority: PriorityLevel | "") {
  if (priority === "urgent") return "Urgent";
  if (priority === "high") return "High";
  if (priority === "normal") return "Normal";
  if (priority === "low") return "Low";
  return "Set priority";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-medium text-white/45 mb-1.5">{children}</p>;
}

function FieldButton({
  children,
  className,
  showChevron = true,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { showChevron?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-[#161616] px-3 py-2.5 text-left text-[14px] text-white/80 transition-colors hover:bg-[#161616]",
        className
      )}
      {...props}
    >
      {children}
      {showChevron && <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-white/35" />}
    </button>
  );
}

function StageStatusPicker({
  stages,
  selectedStageId,
  onSelect,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
}: {
  stages: Stage[];
  selectedStageId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selected = stages.find((s) => s._id === selectedStageId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          onLoadMore();
        }
      },
      { root, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, isLoading, isLoadingMore, onLoadMore, stages.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore || isLoading || isLoadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      onLoadMore();
    }
  };

  return (
    <div ref={ref} className="relative">
      <FieldButton onClick={() => setOpen((o) => !o)}>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: selected?.color || "#6366f1" }}
        />
        <span className="truncate">{stageStatusLabel(selected)}</span>
      </FieldButton>
      {open && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-56 overflow-hidden rounded-xl border border-white/10 bg-[#161616] shadow-2xl">
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-56 overflow-y-auto py-1"
          >
            {stages.length === 0 && isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            ) : (
              stages.map((stage) => (
                <button
                  key={stage._id}
                  type="button"
                  onClick={() => {
                    onSelect(stage._id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color || "#64748b" }}
                  />
                  <span className="flex-1 truncate text-sm text-white/85">{stage.name}</span>
                  {stage._id === selectedStageId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-white/60" />
                  )}
                </button>
              ))
            )}
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            )}
            {hasMore && !isLoadingMore && <div ref={sentinelRef} className="h-2 w-full shrink-0" />}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomPicker({
  spaceId,
  rooms,
  isLoading,
  hasMore,
  selectedRoom,
  onSelect,
  onLoadMore,
  onOpen,
  disabled = false,
}: {
  spaceId: string;
  rooms: RoomOption[];
  isLoading: boolean;
  hasMore: boolean;
  selectedRoom: RoomOption | null;
  onSelect: (room: RoomOption) => void;
  onLoadMore: () => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    onOpen();
  }, [open, onOpen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { root, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, isLoading, onLoadMore, rooms.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore || isLoading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      onLoadMore();
    }
  };

  const displayName = capitalizeName(selectedRoom?.name);

  return (
    <div ref={ref} className="relative">
      <FieldButton
        type="button"
        disabled={disabled}
        showChevron={!disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        className={disabled ? "cursor-default opacity-90 hover:bg-[#161616]" : undefined}
      >
        {selectedRoom?.bgImage ? (
          <img
            src={selectedRoom.bgImage}
            alt={displayName}
            className="h-4 w-4 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#e11d48] text-[9px] font-bold text-white">
            {displayName.charAt(0)}
          </span>
        )}
        <span className="truncate font-medium">{displayName}</span>
      </FieldButton>
      {!disabled && open && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-56 overflow-hidden rounded-xl border border-white/10 bg-[#161616] shadow-2xl">
          <div className="border-b border-white/8 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Rooms</p>
          </div>
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-48 overflow-y-auto py-1"
          >
            {!spaceId ? (
              <p className="px-3 py-2 text-sm text-white/40">No space selected</p>
            ) : rooms.length === 0 && isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            ) : rooms.length === 0 ? (
              <p className="px-3 py-2 text-sm italic text-white/40">No rooms found</p>
            ) : (
              rooms.map((room) => {
                const name = capitalizeName(room.name);
                const isSelected = room._id === selectedRoom?._id;
                return (
                  <button
                    key={room._id}
                    type="button"
                    onClick={() => {
                      onSelect(room);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5",
                      isSelected && "bg-white/[0.04]"
                    )}
                  >
                    {room.bgImage ? (
                      <img
                        src={room.bgImage}
                        alt={name}
                        className="h-4 w-4 shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#e11d48] text-[9px] font-bold text-white">
                        {name.charAt(0)}
                      </span>
                    )}
                    <span className="flex-1 truncate text-sm text-white/85">{name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-white/60" />}
                  </button>
                );
              })
            )}
            {isLoading && rooms.length > 0 && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            )}
            {hasMore && !isLoading && <div ref={sentinelRef} className="h-2 w-full shrink-0" />}
          </div>
        </div>
      )}
    </div>
  );
}

type ParentTaskOption = {
  _id: string;
  name: string;
  stageId: string;
  rootId?: string;
};

function ParentTaskPicker({
  tasks,
  selectedId,
  onSelect,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onOpen,
}: {
  tasks: ParentTaskOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selected = tasks.find((t) => t._id === selectedId);

  useEffect(() => {
    if (!open) return;
    onOpen();
  }, [open, onOpen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          onLoadMore();
        }
      },
      { root, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, isLoading, isLoadingMore, onLoadMore, tasks.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore || isLoading || isLoadingMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      onLoadMore();
    }
  };

  return (
    <div ref={ref} className="relative">
      <FieldButton onClick={() => setOpen((o) => !o)}>
        <Layers className="h-4 w-4 shrink-0 text-white/50" />
        <span className="truncate">{selected?.name || "Select parent task"}</span>
      </FieldButton>
      {open && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-48 overflow-hidden rounded-xl border border-white/10 bg-[#161616] shadow-2xl">
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-48 overflow-y-auto py-1"
          >
            {tasks.length === 0 && isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="px-3 py-2 text-sm text-white/40">No tasks available</div>
            ) : (
              tasks.map((task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => {
                    onSelect(task._id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/5"
                >
                  <span className="truncate">{task.name}</span>
                  {task._id === selectedId && (
                    <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-white/60" />
                  )}
                </button>
              ))
            )}
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              </div>
            )}
            {hasMore && !isLoadingMore && <div ref={sentinelRef} className="h-2 w-full shrink-0" />}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  initialDueDateMs = null,
  initialStartDateMs = null,
  onCreated,
  hideSubtaskTab = false,
  defaultToCurrentRoom = false,
}: CreateTaskDialogProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const {
    currentRoomDetail,
    currentWorkspace: taskroomWorkspace,
    spaceData,
    columns,
    setColumns,
    rooms,
    roomMetadata,
    fetchRooms,
    loadingSpaces,
    activeSpaceId,
  } = useTaskroomWorkspacetore();
  const searchParams = useSearchParams();
  const { createCard } = useCardStore();

  const workspaceId =
    (searchParams.get("shareTask") ? searchParams.get("workspaceId") : currentWorkspace?._id) || "";
  const defaultSpaceId =
    (searchParams.get("shareTask")
      ? searchParams.get("spaceId")
      : activeSpaceId || currentRoomDetail?.spaceId || searchParams.get("spaceId")) || "";

  const [selectedRoom, setSelectedRoom] = useState<RoomOption | null>(null);
  const selectedSpaceId = defaultSpaceId;
  const selectedRoomId =
    selectedRoom?._id && selectedRoom.spaceId === selectedSpaceId ? selectedRoom._id : "";

  const spaceRooms = selectedSpaceId ? rooms[selectedSpaceId] || [] : [];
  const spaceRoomMeta = selectedSpaceId
    ? roomMetadata?.[selectedSpaceId] || { totalPages: 1, currentPage: 1 }
    : { totalPages: 1, currentPage: 1 };
  const roomsLoading = selectedSpaceId ? !!loadingSpaces[selectedSpaceId] : false;
  const roomsHasMore = spaceRoomMeta.currentPage < spaceRoomMeta.totalPages;

  const [activeTab, setActiveTab] = useState<CreateTab>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<PriorityLevel | "">("");
  const [startDateMs, setStartDateMs] = useState<number | null>(null);
  const [dueDateMs, setDueDateMs] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [parentTaskId, setParentTaskId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [stages, setStages] = useState<Stage[]>([]);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageLoadingMore, setStageLoadingMore] = useState(false);
  const [stagePage, setStagePage] = useState(1);
  const [stageHasMore, setStageHasMore] = useState(false);
  const isFetchingStagesRef = useRef(false);

  const [parentTasks, setParentTasks] = useState<ParentTaskOption[]>([]);
  const [parentTaskLoading, setParentTaskLoading] = useState(false);
  const [parentTaskLoadingMore, setParentTaskLoadingMore] = useState(false);
  const [parentTaskPage, setParentTaskPage] = useState(1);
  const [parentTaskHasMore, setParentTaskHasMore] = useState(false);
  const isFetchingParentTasksRef = useRef(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const workspaceName = useMemo(() => {
    const ws = taskroomWorkspace || currentWorkspace;
    return ws?.name || ws?.workspacename || "";
  }, [taskroomWorkspace, currentWorkspace]);

  const spaceName = useMemo(() => {
    const spaces = workspaceId ? spaceData[workspaceId] || [] : [];
    const space = spaces.find((s) => s._id === selectedSpaceId);
    return space?.name || space?.workspacename || "";
  }, [workspaceId, spaceData, selectedSpaceId]);

  const roomName = useMemo(
    () => selectedRoom?.name || currentRoomDetail?.name || "",
    [selectedRoom?.name, currentRoomDetail?.name]
  );

  const resetForm = useCallback(() => {
    setActiveTab("task");
    setTitle("");
    setDescription("");
    setAssignedToIds([]);
    setPriority("");
    setStartDateMs(initialStartDateMs);
    setDueDateMs(initialDueDateMs);
    setSelectedTagIds([]);
    setParentTaskId("");
  }, [initialDueDateMs, initialStartDateMs]);

  useEffect(() => {
    if (!open) return;
    resetForm();
    if (hideSubtaskTab) {
      setActiveTab("task");
    }
  }, [open, resetForm, hideSubtaskTab]);

  useEffect(() => {
    if (!open || !defaultToCurrentRoom || !currentRoomDetail?._id) return;
    setActiveTab("task");
    setSelectedRoom({
      _id: currentRoomDetail._id,
      name: currentRoomDetail.name,
      spaceId: currentRoomDetail.spaceId || defaultSpaceId,
      bgImage: currentRoomDetail.bgImage,
    });
    if (currentRoomDetail.spaceId || defaultSpaceId) {
      fetchRooms(currentRoomDetail.spaceId || defaultSpaceId, 1, true);
    }
  }, [
    open,
    defaultToCurrentRoom,
    currentRoomDetail?._id,
    currentRoomDetail?.name,
    currentRoomDetail?.spaceId,
    currentRoomDetail?.bgImage,
    defaultSpaceId,
    fetchRooms,
  ]);

  useEffect(() => {
    if (!defaultSpaceId) {
      setSelectedRoom(null);
      return;
    }

    setSelectedRoom((prev) => {
      if (prev?.spaceId && prev.spaceId !== defaultSpaceId) return null;
      if (
        currentRoomDetail?._id &&
        (currentRoomDetail.spaceId || defaultSpaceId) === defaultSpaceId
      ) {
        return {
          _id: currentRoomDetail._id,
          name: currentRoomDetail.name,
          spaceId: defaultSpaceId,
          bgImage: currentRoomDetail.bgImage,
        };
      }
      if (prev?.spaceId === defaultSpaceId) return prev;
      return null;
    });

    setSelectedStageId(null);
    setStages([]);
    setAssignedToIds([]);
    setSelectedTagIds([]);
    setParentTaskId("");
    setParentTasks([]);
    setParentTaskPage(1);
    setParentTaskHasMore(false);
    setStagePage(1);
    setStageHasMore(false);
    fetchRooms(defaultSpaceId, 1, true);
  }, [
    defaultSpaceId,
    currentRoomDetail?._id,
    currentRoomDetail?.spaceId,
    currentRoomDetail?.name,
    currentRoomDetail?.bgImage,
    fetchRooms,
  ]);

  const handleRoomsOpen = useCallback(() => {
    if (!selectedSpaceId) return;
    fetchRooms(selectedSpaceId, 1, true);
  }, [fetchRooms, selectedSpaceId]);

  const handleLoadMoreRooms = useCallback(() => {
    if (!selectedSpaceId || !roomsHasMore || roomsLoading) return;
    fetchRooms(selectedSpaceId, spaceRoomMeta.currentPage + 1);
  }, [fetchRooms, roomsHasMore, roomsLoading, selectedSpaceId, spaceRoomMeta.currentPage]);

  const handleRoomSelect = useCallback((room: RoomOption) => {
    setSelectedRoom({ ...room, spaceId: room.spaceId || defaultSpaceId });
    setSelectedStageId(null);
    setStages([]);
    setAssignedToIds([]);
    setSelectedTagIds([]);
    setParentTaskId("");
    setParentTasks([]);
    setParentTaskPage(1);
    setParentTaskHasMore(false);
    setStagePage(1);
    setStageHasMore(false);
  }, [defaultSpaceId]);

  const fetchParentTasks = useCallback(async (page: number, isLoadMore = false) => {
    if (!selectedRoomId || isFetchingParentTasksRef.current) return;
    isFetchingParentTasksRef.current = true;
    if (isLoadMore) setParentTaskLoadingMore(true);
    else setParentTaskLoading(true);

    try {
      const token = localStorage.getItem("garage_tok");
      const baseUrl =
        process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
      const params = new URLSearchParams({
        roomId: selectedRoomId,
        page: String(page),
        size: String(PARENT_TASK_PAGE_SIZE),
      });
      const url = `${baseUrl}tasks/?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await response.json();
      if (response.ok && (json.status || json.success)) {
        const raw = Array.isArray(json.data) ? json.data : [];
        const mapped: ParentTaskOption[] = raw
          .filter((t: { _id?: string }) => !!t?._id)
          .map((t: { _id: string; title?: string; name?: string; stageId?: string; rootId?: string }) => ({
            _id: t._id,
            name: t.title || t.name || "Untitled task",
            stageId: t.stageId || "",
            rootId: t.rootId || t._id,
          }));

        if (isLoadMore) {
          setParentTasks((prev) => {
            const merged = [...prev, ...mapped.filter((t) => !prev.some((p) => p._id === t._id))];
            return merged;
          });
        } else {
          setParentTasks(mapped);
          if (mapped.length > 0) {
            setParentTaskId((current) => current || mapped[0]._id);
          }
        }

        if (json.metadata) {
          const totalPages = json.metadata.totalPages || 1;
          setParentTaskHasMore(page < totalPages);
          setParentTaskPage(page);
        } else {
          setParentTaskHasMore(mapped.length >= PARENT_TASK_PAGE_SIZE);
          setParentTaskPage(page);
        }
      } else {
        throw new Error(json?.message || "Failed to load tasks.");
      }
    } catch (err) {
      console.error("Failed to fetch parent tasks", err);
      if (!isLoadMore) {
        setParentTasks([]);
      }
      setParentTaskHasMore(false);
    } finally {
      setParentTaskLoading(false);
      setParentTaskLoadingMore(false);
      isFetchingParentTasksRef.current = false;
    }
  }, [selectedRoomId]);

  const handleParentTasksOpen = useCallback(() => {
    if (!selectedRoomId) return;
    if (parentTasks.length === 0) {
      fetchParentTasks(1, false);
    }
  }, [selectedRoomId, parentTasks.length, fetchParentTasks]);

  const handleLoadMoreParentTasks = useCallback(() => {
    if (!parentTaskHasMore || parentTaskLoading || parentTaskLoadingMore) return;
    fetchParentTasks(parentTaskPage + 1, true);
  }, [
    parentTaskHasMore,
    parentTaskLoading,
    parentTaskLoadingMore,
    parentTaskPage,
    fetchParentTasks,
  ]);

  const fetchStages = useCallback(async (page: number, isLoadMore = false) => {
    if (!selectedRoomId || isFetchingStagesRef.current) return;
    isFetchingStagesRef.current = true;
    if (isLoadMore) setStageLoadingMore(true);
    else setStageLoading(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const baseUrl =
        process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
      const url = `${baseUrl}stages/room/${selectedRoomId}?page=${page}&size=${STAGE_PAGE_SIZE}`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await response.json();
      if (response.ok && (json.status || json.success) && json.data) {
        const fetchedStages = (Array.isArray(json.data) ? json.data : []) as Stage[];
        const sorted = sortStages(fetchedStages);

        if (isLoadMore) {
          setStages((prev) => {
            const merged = [...prev, ...sorted.filter((s) => !prev.some((p) => p._id === s._id))];
            return sortStages(merged);
          });
        } else {
          setStages(sorted);
          if (sorted.length > 0) setSelectedStageId(sorted[0]._id);
        }

        if (json.metadata) {
          const totalPages = json.metadata.totalPages || 1;
          setStageHasMore(page < totalPages);
          setStagePage(page);
        } else {
          setStageHasMore(fetchedStages.length >= STAGE_PAGE_SIZE);
          setStagePage(page);
        }
      } else {
        throw new Error(json?.message || "Failed to load stages.");
      }
    } catch (err) {
      console.error("Failed to fetch stages", err);
      if (!isLoadMore) {
        toast.error("Failed to load stages.");
        setStages([]);
      }
      setStageHasMore(false);
    } finally {
      setStageLoading(false);
      setStageLoadingMore(false);
      isFetchingStagesRef.current = false;
    }
  }, [selectedRoomId]);

  const handleLoadMoreStages = useCallback(() => {
    if (!stageHasMore || stageLoading || stageLoadingMore) return;
    fetchStages(stagePage + 1, true);
  }, [stageHasMore, stageLoading, stageLoadingMore, stagePage, fetchStages]);

  useEffect(() => {
    if (!open || !selectedRoomId) return;
    setStagePage(1);
    setStageHasMore(false);
    setStages([]);
    fetchStages(1, false);
  }, [open, selectedRoomId, fetchStages]);

  useEffect(() => {
    if (!open || activeTab !== "subtask" || !selectedRoomId) return;
    setParentTaskPage(1);
    setParentTaskHasMore(false);
    setParentTasks([]);
    setParentTaskId("");
    fetchParentTasks(1, false);
  }, [open, activeTab, selectedRoomId, fetchParentTasks]);

  const handleWriteWithAi = async () => {
    if (!title.trim()) {
      toast.error("Enter a task name first.");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const res = await fetch("/api/taskroom/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("garage_tok") || ""}`,
        },
        body: JSON.stringify({
          taskName: title.trim(),
          workspaceName: workspaceName || undefined,
          spaceName: spaceName || undefined,
          roomName: roomName || undefined,
          taskType: activeTab,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate description.");
      }

      setDescription(data.description || "");
    } catch (err) {
      console.error("Failed to generate task description", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to generate description."
      );
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Task name is required.");
      return;
    }
    if (!selectedRoomId) {
      toast.error("No project selected.");
      return;
    }
    if (!selectedStageId) {
      toast.error("Please select a status.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === "subtask") {
        const parent = parentTasks.find((t) => t._id === parentTaskId);
        if (!parent) {
          toast.error("Please select a parent task.");
          return;
        }
        const parentStageId = parent.stageId || selectedStageId;
        if (!parentStageId) {
          toast.error("Parent task is missing a stage.");
          return;
        }

        const token = localStorage.getItem("garage_tok");
        const body = {
          title: title.trim(),
          roomId: selectedRoomId,
          stageId: parentStageId,
          assignedToIds,
          priority: priority || undefined,
          tags: selectedTagIds,
          startDate: startDateMs ?? undefined,
          dueDate: dueDateMs ?? undefined,
          parentId: parentTaskId,
          rootId: parent.rootId || parentTaskId,
          description: description.trim(),
        };

        const baseUrl = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";
        const response = await fetch(`${baseUrl}tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("Failed to create subtask");
        const result = await response.json();
        if (!result?.status) throw new Error(result?.message || "Failed to create subtask");

        toast.success("Subtask created.");
      } else {
        const created = await createCard({
          stageId: selectedStageId,
          title: title.trim(),
          roomId: selectedRoomId,
          startDate: startDateMs,
          dueDate: dueDateMs,
          description: description.trim(),
          priority: priority || "normal",
          tags: selectedTagIds,
          assignedToIds,
        } as any);

        if (!created) throw new Error("Failed to create task");

        if (selectedRoomId === currentRoomDetail?._id) {
          setColumns((prev) =>
            prev.map((col) => {
              if (col._id === selectedStageId) {
                return {
                  ...col,
                  // Newest first, matching the server's createdAt-desc order
                  cards: [transformCardCustom(created, selectedStageId), ...(col.cards ?? [])],
                  localCardCount: (col.localCardCount || 0) + 1,
                };
              }
              return col;
            })
          );
        }
        toast.success("Task created.");
      }

      onOpenChange(false);
      onCreated?.();
      window.dispatchEvent(new CustomEvent("taskroom:task-created"));
    } catch (err) {
      console.error(err);
      toast.error("Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(calc(100dvh-2rem),820px)] w-[min(calc(100vw-1.5rem),440px)] flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d10] p-0 shadow-2xl sm:max-w-[440px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-4">
          <DialogTitle className="text-[18px] font-semibold text-white">Create Task</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/8 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!hideSubtaskTab && (
          <div className="flex shrink-0 border-b border-white/8 px-5">
            {(["task", "subtask"] as CreateTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative px-1 py-3 mr-5 text-[14px] font-medium capitalize transition-colors",
                  activeTab === tab ? "text-white" : "text-white/40 hover:text-white/65"
                )}
              >
                {tab === "task" ? "Task" : "Subtask"}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: ACCENT }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 custom-scrollbar">
          <div>
            <RoomPicker
              key={selectedSpaceId}
              spaceId={selectedSpaceId}
              rooms={spaceRooms}
              isLoading={roomsLoading}
              hasMore={roomsHasMore}
              selectedRoom={selectedRoom}
              onSelect={handleRoomSelect}
              onLoadMore={handleLoadMoreRooms}
              onOpen={handleRoomsOpen}
              disabled={defaultToCurrentRoom}
            />
          </div>

          {activeTab === "subtask" && (
            <div>
              <FieldLabel>Task Name</FieldLabel>
              <ParentTaskPicker
                tasks={parentTasks}
                selectedId={parentTaskId}
                onSelect={setParentTaskId}
                isLoading={parentTaskLoading}
                isLoadingMore={parentTaskLoadingMore}
                hasMore={parentTaskHasMore}
                onLoadMore={handleLoadMoreParentTasks}
                onOpen={handleParentTasksOpen}
              />
            </div>
          )}

          <div>
            <FieldLabel>{activeTab === "subtask" ? "Subtask Name" : "Task Name"}</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name or type '/' for commands"
              className="w-full rounded-lg border border-white/10 bg-[#161616] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-white/20"
              autoFocus
            />
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <div className="relative rounded-lg border border-white/10 bg-[#161616]">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description, or write with ✨ AI"
                rows={4}
                className="w-full resize-none bg-transparent px-3 py-2.5 pb-10 text-[14px] text-white placeholder:text-white/30 outline-none"
              />
              <button
                type="button"
                onClick={handleWriteWithAi}
                disabled={isGeneratingDescription || !title.trim()}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#161616] px-2 py-1 text-[11px] font-medium text-white/55 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingDescription ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {isGeneratingDescription ? "Writing..." : "Write with AI"}
              </button>
            </div>
          </div>

          <div>
            <FieldLabel>Status</FieldLabel>
            <StageStatusPicker
              stages={stages}
              selectedStageId={selectedStageId}
              onSelect={setSelectedStageId}
              isLoading={stageLoading}
              isLoadingMore={stageLoadingMore}
              hasMore={stageHasMore}
              onLoadMore={handleLoadMoreStages}
            />
          </div>

          <div>
            <FieldLabel>Assignee</FieldLabel>
            <AssigneePicker
              key={selectedRoomId}
              assignedToIds={assignedToIds}
              onSelect={setAssignedToIds}
              roomId={selectedRoomId}
              contentClassName={DROPDOWN_BG}
            >
              <FieldButton>
                <UserPlus className="h-4 w-4 shrink-0 text-white/45" />
                <span className="truncate">
                  {assignedToIds.length > 0
                    ? `${assignedToIds.length} assignee${assignedToIds.length > 1 ? "s" : ""}`
                    : "Add assignee"}
                </span>
              </FieldButton>
            </AssigneePicker>
          </div>

          <div>
            <FieldLabel>Due date</FieldLabel>
            <CustomDatePicker
              startDate={startDateMs ? new Date(startDateMs) : null}
              dueDate={dueDateMs ? new Date(dueDateMs) : null}
              defaultTab="due"
              contentClassName={DROPDOWN_BG}
              onSelect={(range) => {
                setStartDateMs(range.start ? range.start.getTime() : null);
                setDueDateMs(range.due ? range.due.getTime() : null);
              }}
            >
              <FieldButton>
                <CalendarIcon className="h-4 w-4 shrink-0 text-red-400/80" />
                <span className="truncate">
                  {dueDateMs ? format(new Date(dueDateMs), "MMM d, yyyy h:mm a") : "Select date"}
                </span>
              </FieldButton>
            </CustomDatePicker>
          </div>

          <div>
            <FieldLabel>Priority</FieldLabel>
            <PriorityPicker
              priority={priority || undefined}
              onSelect={(p) => setPriority(p || "")}
              contentClassName={DROPDOWN_BG}
            >
              <FieldButton>
                <Flag
                  className={cn(
                    "h-4 w-4 shrink-0",
                    priority === "urgent"
                      ? "fill-red-500 text-red-500"
                      : priority === "high"
                        ? "fill-amber-500 text-amber-500"
                        : priority === "normal"
                          ? "fill-blue-500 text-blue-500"
                          : "text-white/45"
                  )}
                />
                <span className="truncate">{priorityLabel(priority)}</span>
              </FieldButton>
            </PriorityPicker>
          </div>

          <div>
            <FieldLabel>Tags</FieldLabel>
            <TagPicker
              boardId={workspaceId}
              selectedTagIds={selectedTagIds}
              onSelect={setSelectedTagIds}
              Idspace={selectedSpaceId}
              contentClassName={DROPDOWN_BG}
            >
              <FieldButton>
                <span className="text-white/45">#</span>
                <span className="truncate">
                  {selectedTagIds.length > 0
                    ? `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""}`
                    : "Add tags"}
                </span>
              </FieldButton>
            </TagPicker>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-white/8 px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-[14px] font-medium text-white/45 transition-colors hover:text-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitting || !title.trim() || !selectedStageId}
            className="rounded-lg px-5 py-2.5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
          >
            {isSubmitting ? "Creating…" : "Create Task"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
