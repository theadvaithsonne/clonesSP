import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { CustomDatePicker } from "./custom-date-picker";
import { PriorityPicker, PriorityLevel } from "./priority-picker";
import { AssigneePicker } from "./assignee-picker";
import { StatusPicker, StatusValue } from "./status-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button as UIButton } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isRoomObserver, useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { useCardStore } from "@/store/athena/cardStore";
import { useTaskStore } from "@/store/athena/taskStore";
import { useBoardStore } from "@/store/athena/boardStore";
import { useUserStore } from '@/store/athena/userStore';
import { Clock, Columns, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton";
import { TagPicker, TagChip } from "./tag-picker";
import axios from "axios";
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { format, isValid } from "date-fns"
import { toast } from "sonner";
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useStageStore } from "@/store/athena/stageStore"
import { useWorkspaceStore } from "@/store/taskroom/workspaceStore"
import { CardModal } from "./card-modal"
import { useMemberStore } from "@/store/athena/memberStore"
import {
    Plus, MoreHorizontal, Filter, GripVertical, CheckSquare, Square, TagIcon, Check,
    Pencil, Trash2, User, Calendar, Tag, ChevronDown, ChevronRight,
    Users, CalendarPlus, Flag, ArrowLeft, Hash, Type, CalendarDays, X,
    MessageSquare, ListTree,
} from "lucide-react";
const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";

// ─── Types ────────────────────────────────────────────────────────────────────
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
export type TaskStatus = any;
export type TaskPriority = PriorityLevel;
export type TaskType = "task" | "subtask";
type CustomFieldType = "number" | "text" | "date" | "dropdown" | "textarea" | "labels";

interface CustomFieldOption {
    label: string;
    color: string;
}

interface RoomCustomFieldDef {
    _id: string;
    name: string;
    type: string;
    options?: Array<string | { label?: string; name?: string; value?: string; color?: string }>;
}

const CUSTOM_FIELD_OPTION_COLORS = ["#7c5cff", "#e24b4a", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899"];

const normalizeCustomFieldType = (type: string): CustomFieldType => {
    switch (type) {
        case "dropdown":
        case "select":
            return "dropdown";
        case "labels":
        case "multiselect":
            return "labels";
        case "textarea":
            return "textarea";
        case "number":
            return "number";
        case "date":
            return "date";
        default:
            return "text";
    }
};

const normalizeCustomFieldOptions = (options?: RoomCustomFieldDef["options"]): CustomFieldOption[] => {
    if (!options?.length) return [];
    return options.map((opt, index) => {
        if (typeof opt === "string") {
            return { label: opt, color: CUSTOM_FIELD_OPTION_COLORS[index % CUSTOM_FIELD_OPTION_COLORS.length] };
        }
        const label = opt.label ?? opt.name ?? opt.value ?? "";
        return {
            label,
            color: opt.color ?? CUSTOM_FIELD_OPTION_COLORS[index % CUSTOM_FIELD_OPTION_COLORS.length],
        };
    }).filter((opt) => opt.label);
};

const mapRoomCustomFields = (fields?: RoomCustomFieldDef[]): CustomColumn[] => {
    if (!fields?.length) return [];
    return fields.map((field) => ({
        id: field._id,
        name: field.name,
        type: normalizeCustomFieldType(field.type),
        options: normalizeCustomFieldOptions(field.options),
    }));
};

const parseCardCustomFields = (card: any): Record<string, string | number | null | undefined> => {
    const result: Record<string, string | number | null | undefined> = {};

    if (card?.customFields && typeof card.customFields === "object" && !Array.isArray(card.customFields)) {
        Object.assign(result, card.customFields);
    }

    const valueArrays = [card?.customFieldData, card?.customFieldValues, card?.fieldValues];
    for (const arr of valueArrays) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
            const fieldId = item?.fieldId ?? item?._id ?? item?.customFieldId;
            const value = item?.value ?? item?.fieldValue ?? item?.textValue ?? item?.name;
            if (fieldId != null) result[String(fieldId)] = value ?? null;
        }
    }

    return result;
};

const transformCard = (card: any, stageId: string) => ({
    _id: card?._id,
    id: card?._id,
    name: card?.title,
    userId: card?.userId,
    description: card?.description || "",
    tags: card?.tags || [],
    tagData: card?.tagData || [],
    members: card?.assigneeData ? card.assigneeData : [],
    dueDate: card?.dueDate,
    startDate: card?.startDate,
    checklist: card?.checklist ? card.checklist || [] : [],
    isOverDue: card?.isOverDue,
    isCompleted: card?.isCompleted,
    priority: card?.priority,
    comments: [],
    commentCount: card?.commentCount,
    createdAt: card?.createdAt,
    stageId: stageId,
    assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
    timeEstimate: card?.timeEstimate,
    TaskDataCount: {
        totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
        totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
    },
    customFields: parseCardCustomFields(card),
});

const transformStage = (stage: any) => ({
    _id: stage._id,
    name: stage.name,
    userId: stage?.userId,
    roomId: stage?.roomId,
    cards: (stage.cardData || []).map((card: any) => transformCard(card, stage._id)),
    taskCount: stage.taskCount || 0,
    localCardCount: stage.taskCount || 0,
    stageType: stage?.stageType,
    orderId: stage?.orderId,
    color: stage?.color
});

export interface ChecklistItem {
    _id?: string;
    description: string;
    isCompleted: boolean;
    orderId?: number;
    assignee?: string;
}

export interface Checklist {
    _id?: string;
    name: string;
    checklistData: ChecklistItem[];
    cardId?: string;
    childCount?: number;
    completedChildCount?: number;
}

export interface Task {
    _id?: string;
    type?: string;
    id: string;
    name: string;
    description?: string;
    isOverDue?: boolean
    status?: TaskStatus;
    assignee?: string;
    assignedToIds?: string[];
    tagData?: Array<{ _id: string; name: string; color: string }>
    members?: any[];
    startDate?: string;
    dueDate?: string;
    priority?: TaskPriority;
    tags?: string[];
    subtasks?: Task[];
    localCardCount?: number;
    checklists?: Checklist[];
    parentId?: string;
    isCompleted?: Boolean
    customFields?: Record<string, string | number | null | undefined>;
    subTaskCount?: number;
    commentCount?: number;
}

export interface TaskGroup {
    id: string;
    _id?: string;
    status: string;
    stageType?: string
    name?: string;
    color?: string;
    columns?: Task[];
    cards?: Task[];
    type?: string;
    taskCount?: number;
    localCardCount?: number;
}

interface CustomColumn {
    id: string;
    name: string;
    type: CustomFieldType;
    options?: CustomFieldOption[];
}

// ─── New Task Draft Shapes ─────────────────────────────────────────────────────

interface NewTaskDraft {
    targetGroupId: string;
    taskName: string;
    assigneeId?: string;
    priority?: TaskPriority;
    startDate?: string;
    dueDate?: string;
    tags?: string[];
}

interface NewSubtaskDraft {
    parentTaskId: string;
    parentGroupId: string;
    taskName: string;
    assigneeId?: string;
    priority?: TaskPriority;
    startDate?: string;
    dueDate?: string;
    tags?: string[];
}

// ─── Tree Helpers ──────────────────────────────────────────────────────────────
const transformCardCustom = (card: any, stageId: string) => ({
    _id: card?._id,
    id: card?._id,
    name: card?.title,
    userId: card?.userId,
    description: card?.description || "",
    tags: card?.tags?.map(item => item?._id) || [],
    tagData: card?.tags || [],
    members: card?.assignedToIds ? card.assignedToIds : [],
    dueDate: card?.dueDate,
    priority: card?.priority,
    startDate: card?.startDate,
    checklist: card?.checklist ? card.checklist || [] : [],
    isOverDue: card?.isOverDue,
    isCompleted: card?.isCompleted,
    comments: [],
    timeEstimate: card?.timeEstimate,
    commentCount: card?.commentCount,
    createdAt: card?.createdAt,
    subTaskCount: card?.subTaskCount,
    stageId: stageId,
    assignedToIds: card?.assignedToIds ? card.assignedToIds || [] : [],
    TaskDataCount: {
        totalChildCount: card?.TaskDataCount?.totalChildCount ?? 0,
        totalCompletedChildCount: card?.TaskDataCount?.totalCompletedChildCount ?? 0
    },
    customFields: parseCardCustomFields(card),
});

const getOptionColor = (options: CustomFieldOption[] | undefined, label: string) =>
    options?.find((opt) => opt.label === label)?.color ?? CUSTOM_FIELD_OPTION_COLORS[0];

const getAllTaskIds = (tasks: Task[]): string[] =>
    tasks.flatMap((t) => [t.id, ...getAllTaskIds(t.subtasks ?? [])]);

const getExpandableTaskIds = (tasks: Task[]): string[] =>
    tasks.flatMap((t) =>
        (t.subtasks?.length ?? 0) > 0
            ? [t.id, ...getExpandableTaskIds(t.subtasks ?? [])]
            : []
    );

const findTaskInTree = (tasks: Task[], taskId: string): Task | undefined =>
    tasks.reduce<Task | undefined>(
        (found, task) =>
            found ?? ((task._id === taskId || task.id === taskId) ? task : findTaskInTree(task.subtasks ?? [], taskId)),
        undefined
    );

const findTaskInGroups = (groups: TaskGroup[], taskId: string): Task | undefined =>
    groups.reduce<Task | undefined>(
        (found, g) => found ?? findTaskInTree(g.columns ?? g.cards ?? [], taskId),
        undefined
    );

const LIST_VIEW_TEXT = "text-[13px]";
const META_COL_WIDTH = 100;
const META_COL_HEADER_CLASS = "flex min-w-0 items-center justify-center px-2 py-2.5";
const META_COL_CELL_CLASS = "flex min-w-0 items-center justify-center px-2 py-1.5";
const COUNT_NUMBER_CLASS = cn(LIST_VIEW_TEXT, "tabular-nums px-1 text-center");
const COUNT_BADGE_CLASS =
    "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1a] px-1.5 text-[13px] font-medium text-white/50 tabular-nums";
const formatPriorityLabel = (priority?: string) =>
    priority ? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() : "";
const STICKY_SUBTASK_DRAFT_ROW_CLASS =
    "sticky top-10 z-[24] w-full max-w-full bg-[#0a0a0d] border-b border-white/5 shadow-[0_8px_16px_rgba(0,0,0,0.35)] md:top-11";

const updateTaskInTree = (tasks: Task[], taskId: string, updater: (t: Task) => Task): Task[] =>
    tasks.map((task) =>
        (task._id === taskId || task.id === taskId)
            ? updater(task)
            : { ...task, subtasks: updateTaskInTree(task.subtasks ?? [], taskId, updater) }
    );

const updateTaskInGroups = (groups: TaskGroup[], taskId: string, updater: (t: Task) => Task): TaskGroup[] =>
    groups.map((g) => ({
        ...g,
        columns: updateTaskInTree(g.columns ?? g.cards ?? [], taskId, updater),
        cards: updateTaskInTree(g.cards ?? g.columns ?? [], taskId, updater),
    }));

const addTaskToGroup = (groups: TaskGroup[], groupId: string, newTask: Task): TaskGroup[] =>
    groups.map((g) =>
        g.id !== groupId && g._id !== groupId
            ? g
            : { ...g, columns: [...(g.columns ?? g.cards ?? []), newTask], cards: [...(g.cards ?? g.columns ?? []), newTask] }
    );

const addSubtaskToParent = (groups: TaskGroup[], parentTaskId: string, newSubtask: Task): TaskGroup[] =>
    updateTaskInGroups(groups, parentTaskId, (parent) => ({
        ...parent,
        subTaskCount:
            (typeof parent.subTaskCount === "number"
                ? parent.subTaskCount
                : (parent.subtasks?.length ?? 0)) + 1,
        subtasks: [newSubtask, ...(parent.subtasks ?? [])],
    }));

const getRootTaskId = (groups: TaskGroup[], taskId: string): string | null => {
    for (const group of groups) {
        const tasks = group.columns ?? group.cards ?? [];
        for (const rootTask of tasks) {
            if (rootTask.id === taskId) return rootTask.id;
            if (findTaskInTree(rootTask.subtasks ?? [], taskId)) return rootTask.id;
        }
    }
    return null;
};

const parseCustomFieldValue = (type: CustomFieldType, raw: string): string | number | null => {
    if (raw === "") return null;
    if (type === "number") return Number.isFinite(Number(raw)) ? Number(raw) : null;
    return raw;
};

const formatDateDisplay = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });

// ─── Inline Draft Row Component ───────────────────────────────────────────
interface InlineDraftRowProps {
    draftName: string;
    onNameChange: (name: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onSave: () => void;
    onCancel: () => void;
    indentPx?: number;
    isSubtask?: boolean;
    assigneeId?: string;
    onAssigneeChange: (id: string) => void;
    priority?: TaskPriority;
    onPriorityChange: (p: TaskPriority) => void;
    startDate?: string;
    dueDate?: string;
    onDateChange: (start?: string, due?: string) => void;
    tags?: string[];
    onTagsChange: (ids: string[]) => void;
    roomId?: string;
    spaceId?: string;
    className?: string;
}

const InlineDraftRow = ({
    draftName,
    onNameChange,
    onKeyDown,
    onSave,
    onCancel,
    indentPx = 0,
    isSubtask = false,
    assigneeId,
    onAssigneeChange,
    priority,
    onPriorityChange,
    startDate,
    dueDate,
    onDateChange,
    tags = [],
    onTagsChange,
    roomId,
    spaceId,
    className,
}: InlineDraftRowProps) => (
    <div className={cn("bg-[#0a0a0d] border-b border-white/5", isSubtask ? "w-full max-w-full" : "w-full", className)}>
        <div className={cn(isSubtask ? "py-2" : "w-full px-3 py-3 md:px-6")}>
            <div className="w-full rounded-sm bg-white/5 px-3 py-2 min-w-0">
                <div
                    className="flex min-w-0 flex-row items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ paddingLeft: indentPx > 0 ? `${indentPx}px` : undefined }}
                >
                    {isSubtask && (
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                            <ChevronRight className="h-3 w-3 text-white/50" />
                        </span>
                    )}
                    <input
                        autoFocus
                        value={draftName}
                        placeholder="Task name"
                        onChange={(e) => onNameChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            "min-w-[120px] flex-1 border-0 bg-transparent px-2 py-1 pl-1 text-[13px] text-white/50 placeholder:text-[13px] placeholder:text-white/50 focus:outline-none focus:ring-0 md:pl-4",
                            LIST_VIEW_TEXT
                        )}
                    />
                    <div className="flex shrink-0 flex-row flex-nowrap items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <AssigneePicker
                            assignedToIds={assigneeId ? [assigneeId] : []}
                            onSelect={(ids) => onAssigneeChange(ids[0] || "")}
                        >
                            <button
                                type="button"
                                style={{ whiteSpace: "nowrap" }}
                                className={cn(
                                    "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 transition-colors group hover:bg-[#0a0a0d]",
                                    assigneeId ? "bg-[#1a1a24] text-white/50" : "text-white/50 hover:text-white/50"
                                )}>
                                <div className="rounded border border-[#e5e7eb10] bg-[#1a1a24] p-1 px-1.5 transition-colors group-hover:bg-[#2e2e3a]">
                                    <Users className="h-3.5 w-3.5" />
                                </div>
                                <span className={cn(LIST_VIEW_TEXT, "hidden font-normal sm:inline")}>
                                    {assigneeId ? `1 Assignee` : "Add assignee"}
                                </span>
                            </button>
                        </AssigneePicker>
                        <CustomDatePicker
                            startDate={startDate ? new Date(startDate) : undefined}
                            dueDate={dueDate ? new Date(dueDate) : undefined}
                            onSelect={({ start, due }) => onDateChange(start?.toISOString(), due?.toISOString())}
                        >
                            <button
                                type="button"
                                className={cn(
                                    "flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1 transition-colors group hover:bg-[#1a1a24]",
                                    dueDate ? "bg-[#1a1a24] text-white/50" : "text-white/50 hover:text-white/50"
                                )}
                                style={{ whiteSpace: "nowrap" }}
                            >
                                <div className="rounded border border-[#e5e7eb10] bg-[#1a1a24] p-1 px-1.5 transition-colors group-hover:bg-[#2e2e3a]">
                                    <Calendar className={cn("h-3.5 w-3.5", dueDate && "text-white/50")} />
                                </div>
                                <span className={cn(LIST_VIEW_TEXT, "hidden truncate font-normal sm:inline")}>
                                    {(() => {
                                        if (startDate && dueDate) {
                                            return `${new Date(startDate).toLocaleDateString()} - ${new Date(dueDate).toLocaleDateString()}`;
                                        }
                                        if (startDate) return new Date(startDate).toLocaleDateString();
                                        if (dueDate) return new Date(dueDate).toLocaleDateString();
                                        return "Date";
                                    })()}
                                </span>
                            </button>
                        </CustomDatePicker>
                        <PriorityPicker priority={priority} onSelect={onPriorityChange}>
                            <button
                                type="button"
                                style={{ whiteSpace: "nowrap" }}
                                className={cn(
                                    "flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1 transition-colors group hover:bg-[#1a1a24]",
                                    priority ? "bg-[#1a1a24] text-white/50" : "text-white/50 hover:text-white/50"
                                )}>
                                <div className="rounded border border-[#e5e7eb10] bg-[#1a1a24] p-1 px-1.5 transition-colors group-hover:bg-[#2e2e3a]">
                                    <Flag className={cn("h-3.5 w-3.5", priority === "urgent" ? "fill-red-500 text-red-500" : (priority === "high" ? "fill-amber-500 text-amber-500" : ""))} />
                                </div>
                                <span className={cn(LIST_VIEW_TEXT, "hidden font-normal sm:inline")}>
                                    {priority ? formatPriorityLabel(priority) : "Add priority"}
                                </span>
                            </button>
                        </PriorityPicker>
                        <TagPicker boardId={roomId || ""} selectedTagIds={tags} onSelect={onTagsChange} Idspace={spaceId || ""}>
                            <button
                                type="button"
                                style={{ whiteSpace: "nowrap" }}
                                className={cn(
                                    "flex shrink-0 items-center gap-2.5 rounded-md px-2 py-1 transition-colors group hover:bg-[#1a1a24]",
                                    tags.length > 0 ? "bg-[#1a1a24] text-white/50" : "text-white/50 hover:text-white/50"
                                )}>
                                <div className="rounded border border-[#e5e7eb10] bg-[#1a1a24] p-1 px-1.5 transition-colors group-hover:bg-[#2e2e3a]">
                                    <TagIcon className="h-3.5 w-3.5" />
                                </div>
                                <span className={cn(LIST_VIEW_TEXT, "hidden font-normal sm:inline")}>
                                    {tags.length > 0 ? `${tags.length} Tags` : "Add tags"}
                                </span>
                            </button>
                        </TagPicker>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        <button type="button" onClick={onCancel} className={cn("rounded-md px-3 py-1.5 font-semi text-white/50 hover:bg-[#0a0a0d]", LIST_VIEW_TEXT)}>Cancel</button>
                        <button
                            type="button"
                            onClick={onSave}
                            style={{ whiteSpace: "nowrap" }}
                            className={cn("flex cursor-pointer items-center gap-1 rounded-md border border-[#e5e7eb29] px-3 py-1 font-semi text-white/50 shadow-sm transition-colors hover:bg-[#0a0a0d]", LIST_VIEW_TEXT)}
                        >
                            Save
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const STAGE_PRESET_COLORS = [
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
    "#f97316", "#6366f1", "#14b8a6", "#a855f7",
];

export const ListView: React.FC = () => {
    const isMobile = useIsMobile();
    const columns = useTaskroomWorkspacetore((state) => state.columns) as TaskGroup[];
    const setColumns = useTaskroomWorkspacetore((state) => state.setColumns);
    const [showModal, setShowModal] = useState(false);
    const { createCard, updateCard, deleteCard, fetchCardsForStage } = useCardStore();
    const { createTask } = useTaskStore();
    const { fetchBoardDetails, incrementListCount, memberData } = useBoardStore();
    const isUserProfileFetched = useUserStore((state) => state.isUserProfileFetched);

    const { stages, createStage, updateStage, deleteStage } = useStageStore()
    const { currentWorkspace } = useWorkspaceStore();
    const { currentRoomDetail, refreshCurrentRoomDetail, memberData: roomMemberData } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const roomId = (searchParams.get("shareTask") ? searchParams.get('roomId') : currentRoomDetail?._id) || "";
    const spaceId = (searchParams.get("shareTask") ? searchParams.get('spaceId') : currentRoomDetail?.spaceId) || "";
    const workspaceId = (searchParams.get("shareTask") ? searchParams.get('workspaceId') : currentWorkspace?._id) || "";
    const isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData);
    const sortOrder = searchParams.get('sort') || "new-to-old";
    const sortOrderdetail = sortOrder === "old-to-new" ? "asc" : "desc";

    // ── Pagination / loading state ─────────────────────────────────────────────
    const [loadingStageId, setLoadingStageId] = useState<string | null>(null);
    const [stagePageStatus, setStagePageStatus] = useState<Record<string, number>>({});
    const [stageTotalPages, setStageTotalPages] = useState<Record<string, number>>({});
    const loadMoreStages = useTaskroomWorkspacetore((state) => state.loadMoreStages);

    // ── Subtask pagination state ──────────────────────────────────────────────
    // Tracks current page fetched for each taskId
    const [subtaskPageStatus, setSubtaskPageStatus] = useState<Record<string, number>>({});
    // Tracks totalPages returned from the API for each taskId
    const [subtaskTotalPages, setSubtaskTotalPages] = useState<Record<string, number>>({});
    // Tracks which tasks are currently loading a subtask page
    const [loadingSubtaskPageIds, setLoadingSubtaskPageIds] = useState<Set<string>>(new Set());
    // In-flight guard to prevent duplicate concurrent fetches per task
    const subtaskFetchInFlightRef = useRef<Record<string, boolean>>({});
    // Sentinel refs for per-task subtask infinite scroll
    const subtaskSentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const subtaskObserverRef = useRef<IntersectionObserver | null>(null);

    // ── Inline "New status" UI state ───────────────────────────────────────────
    const [isAddingStageInline, setIsAddingStageInline] = useState(false);
    const [newStageInlineName, setNewStageInlineName] = useState("");
    const [newStageInlineColor, setNewStageInlineColor] = useState<string>("#8b5cf6");
    const [isCreatingStageInline, setIsCreatingStageInline] = useState(false);
    // Legacy loading state kept for first-page skeleton display
    const [loadingSubtaskIds, setLoadingSubtaskIds] = useState<Set<string>>(new Set());
    const updateTaskAndCardCounts = () => { };

    // ─────────────────────────────────────────────────────────────────────────
    // Core subtask page fetcher
    // Fetches `page` for `taskId`, appends results, updates page/totalPages state.
    // Returns true when more pages remain, false when done.
    // ─────────────────────────────────────────────────────────────────────────
    const fetchSubtaskPage = useCallback(
        async (taskId: string, page: number): Promise<boolean> => {
            if (subtaskFetchInFlightRef.current[taskId]) return false;
            subtaskFetchInFlightRef.current[taskId] = true;

            setLoadingSubtaskPageIds((prev) => new Set(prev).add(taskId));

            try {
                const token = localStorage.getItem("garage_tok");
                const res = await fetch(
                    `${TASKROOM_API_URL}tasks/detail/sub/${taskId}?size=30&page=${page}`,
                    {
                        method: "GET",
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    }
                );

                if (!res.ok) return false;

                const json = await res.json();
                const fetchedSubtasks: any[] = json?.data ?? [];
                const metadata = json?.metadata ?? {};
                const totalPages: number = metadata?.totalPages ?? 1;
                const currentPage: number = metadata?.currentPage ?? page;

                // Update pagination trackers
                setSubtaskPageStatus((prev) => ({ ...prev, [taskId]: currentPage }));
                setSubtaskTotalPages((prev) => ({ ...prev, [taskId]: totalPages }));

                if (fetchedSubtasks.length === 0) {
                    // No subtasks on this page — open inline creation if it's page 1
                    if (page === 1 && !isReadOnly) openNewSubtaskForm(taskId);
                    return false;
                }

                const normalizedSubtasks: Task[] = fetchedSubtasks.map((st: any) => ({
                    _id: st._id,
                    id: st._id,
                    name: st.title ?? st.name,
                    description: st.description || "",
                    status: st.status,
                    assignedToIds: st.assignedToIds ?? [],
                    tagData: st.tagData || [],
                    startDate: st.startDate,
                    dueDate: st.dueDate,
                    priority: st.priority,
                    tags: st.tags || [],
                    subtasks: [],
                    subTaskCount: st?.subTaskCount,
                    parentId: taskId,
                    type: "subtask",
                    members: st.assigneeData ?? [],
                    customFields: parseCardCustomFields(st),
                }));

                setColumns((prev) =>
                    updateTaskInGroups(prev as TaskGroup[], taskId, (t) => ({
                        ...t,
                        // Page 1: replace. Page 2+: append, deduplicating by _id
                        subtasks:
                            page === 1
                                ? normalizedSubtasks
                                : [
                                    ...(t.subtasks ?? []),
                                    ...normalizedSubtasks.filter(
                                        (ns) =>
                                            !(t.subtasks ?? []).some(
                                                (ex) => (ex._id ?? ex.id) === (ns._id ?? ns.id)
                                            )
                                    ),
                                ],
                    }))
                );

                return currentPage < totalPages;
            } catch (err) {
                console.error("Failed to fetch subtask page:", err);
                return false;
            } finally {
                subtaskFetchInFlightRef.current[taskId] = false;
                setLoadingSubtaskPageIds((prev) => {
                    const next = new Set(prev);
                    next.delete(taskId);
                    return next;
                });
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [setColumns, isReadOnly]
    );

    // Fetch an additional page of cards for a given stage (used by infinite scroll)
    const handleFetchPage = useCallback(
        async (columnId: string, page: number) => {
            if (loadingStageId) return;
            setLoadingStageId(columnId);
            try {
                const { cards: newCards, totalPages } = await fetchCardsForStage(columnId, page);
                if (newCards) {
                    setColumns(prev => prev.map(col => {
                        if (col._id === columnId || col.id === columnId) {
                            const existingIds = new Set((col.cards || col.columns || []).map(c => c._id || c.id));
                            const uniqueNewCards = newCards
                                .filter((c: any) => !existingIds.has(c._id))
                                .map((c: any) => transformCard(c, columnId));

                            return {
                                ...col,
                                cards: [...(col.cards || []), ...uniqueNewCards],
                                columns: [...(col.columns || []), ...uniqueNewCards],
                            };
                        }
                        return col;
                    }));
                    setStagePageStatus(prev => ({ ...prev, [columnId]: page }));
                    if (totalPages) {
                        setStageTotalPages(prev => ({ ...prev, [columnId]: totalPages }));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch cards:", error);
            } finally {
                setLoadingStageId(null);
            }
        },
        [fetchCardsForStage, loadingStageId, setColumns]
    );

    const {        members: boardMembers,
        fetchMembers,
        cardMembers,
        removeMembersForCards,
        fetchMembersForCards,
        removeAssignedMember,
        fetchAssignForCards,
        setAssignedMembers,
        assignCardMemberlist,
        isLoadingAssign
    } = useMemberStore();

    // ─── States for Inline Assignee Popover (Logic from CardModal) ───────────
    const [memberSearchTerm, setMemberSearchTerm] = useState("");
    const [isMembersLoading, setIsMembersLoading] = useState(false);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [searchedMembers, setSearchedMembers] = useState<any[]>([]);
    const [togglingMemberIds, setTogglingMemberIds] = useState<Set<string>>(new Set());
    const [activeCard, setActiveCard] = useState<Card | null>(null)
    // Search logic for members
    https://uatapi.garage.app/taskroomv2/v2/tasks/69ca51da7b54d19deaa9e5b1/members?size=50

    useEffect(() => {
        if (memberSearchTerm.trim()) {
            const delayDebounceFn = setTimeout(async () => {
                setIsSearchingMembers(true);
                try {
                    const token = localStorage.getItem("garage_tok");
                    // Using a dummy taskId or a generic one if per-row is difficult for global state.
                    // Using a dummy taskId or a generic one if per-row is difficult for global state.
                    const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${activeCard?._id}/members?searchData=${memberSearchTerm}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.status) setSearchedMembers(data.data);
                } catch (error) {
                    console.error("Search error", error);
                } finally {
                    setIsSearchingMembers(false);
                }
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchedMembers([]);
        }
    }, [memberSearchTerm]);

    const toggleMemberInline = async (taskId: string, member: any, currentAssignedToIds: string[]) => {
        if (isReadOnly) return;
        const memberId = member?._id || member?.id;
        if (!memberId || togglingMemberIds.has(memberId)) return;

        setTogglingMemberIds(prev => new Set(prev).add(memberId));

        try {
            const isRemoving = currentAssignedToIds.includes(memberId);
            let updatedIds: string[];

            if (isRemoving) {
                updatedIds = currentAssignedToIds.filter(id => id !== memberId);
            } else {
                updatedIds = Array.from(new Set([...currentAssignedToIds, memberId]));
            }

            const socketId = undefined;
            await updateCard(taskId, {
                assignedToIds: updatedIds as any,
                socketId,
                [isRemoving ? 'userRemoveAssignedToIds' : 'userAssignedToIds']: memberId
            });

            // Update local state
            setColumns(prev => updateTaskInGroups(prev as any, taskId, (t) => {
                const memberObj = { _id: memberId, name: member.name, email: member.email, userId: memberId };
                const updatedMembers = isRemoving
                    ? (t.members || []).filter(m => (m._id || m.userId) !== memberId)
                    : [...(t.members || []), memberObj];

                return {
                    ...t,
                    assignedToIds: updatedIds,
                    members: updatedMembers
                };
            }));

            toast.success(isRemoving ? "Member removed" : "Member assigned");
        } catch (error) {
            console.error("Error toggling member:", error);
            toast.error("Failed to update member");
        } finally {
            setTogglingMemberIds(prev => {
                const next = new Set(prev);
                next.delete(memberId);
                return next;
            });
        }
    };





    const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(() => new Set());

    // ── Group collapse ─────────────────────────────────────────────────────────
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({});

    // ── Task expand (show subtasks) ────────────────────────────────────────────
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());

    // ── Inline task creation ───────────────────────────────────────────────────
    const [newTaskDraft, setNewTaskDraft] = useState<NewTaskDraft | null>(null);
    const [newSubtaskDraft, setNewSubtaskDraft] = useState<NewSubtaskDraft | null>(null);
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    // ── Inline name editing ────────────────────────────────────────────────────
    const [taskBeingEditedId, setTaskBeingEditedId] = useState<string | null>(null);
    const [editedTaskName, setEditedTaskName] = useState("");

    // ── Custom columns (from room customFields) ───────────────────────────────
    const customColumns = useMemo(
        () => mapRoomCustomFields(currentRoomDetail?.customFields),
        [currentRoomDetail?.customFields]
    );
    const customFieldSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // ── Stage creation ─────────────────────────────────────────────────────────
    const [isCreateStageModalOpen, setIsCreateStageModalOpen] = useState(false);
    const [newStageName, setNewStageName] = useState("");
    const [newStageType, setNewStageType] = useState<string>("tostart");
    const [isCreatingStage, setIsCreatingStage] = useState(false);

    // ── Horizontal scroll tracking (desktop) ──────────────────────────────────
    const desktopScrollRef = useRef<HTMLDivElement | null>(null);
    const headerScrollRef = useRef<HTMLDivElement | null>(null);
    const mainListScrollRef = useRef<HTMLDivElement | null>(null);
    const isSyncingHorizontalScroll = useRef(false);

    const handleBodyHorizontalScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const groupId = el.dataset.stageScroll;
        if (!groupId || isSyncingHorizontalScroll.current) return;

        isSyncingHorizontalScroll.current = true;
        const scrollLeft = el.scrollLeft;
        desktopScrollRef.current = el;

        if (headerScrollRef.current && headerScrollRef.current !== el) {
            headerScrollRef.current.scrollLeft = scrollLeft;
        }
        mainListScrollRef.current
            ?.querySelectorAll<HTMLDivElement>(`[data-stage-scroll="${groupId}"]`)
            .forEach((node) => {
                if (node !== el) node.scrollLeft = scrollLeft;
            });

        requestAnimationFrame(() => {
            isSyncingHorizontalScroll.current = false;
        });
    }, []);

    const handleHeaderHorizontalScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollLeft = e.currentTarget.scrollLeft;
        if (isSyncingHorizontalScroll.current) return;

        isSyncingHorizontalScroll.current = true;
        mainListScrollRef.current
            ?.querySelectorAll<HTMLDivElement>("[data-stage-scroll]")
            .forEach((node) => {
                node.scrollLeft = scrollLeft;
            });

        requestAnimationFrame(() => {
            isSyncingHorizontalScroll.current = false;
        });
    }, []);

    // ── Infinite scroll helpers for per-stage cards ───────────────────────────
    const observerRef = useRef<IntersectionObserver | null>(null);
    const sentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const cardsFetchInFlightRef = useRef<Record<string, boolean>>({});

    // Reset per-workspace UI state so task expansion/pagination
    // never leaks across workspace navigation.
    useEffect(() => {
        setExpandedTaskIds(new Set());
        setCheckedTaskIds(new Set());
        setNewTaskDraft(null);
        setNewSubtaskDraft(null);

        setStagePageStatus({});
        setStageTotalPages({});

        setSubtaskPageStatus({});
        setSubtaskTotalPages({});
        setLoadingSubtaskPageIds(new Set());
        setLoadingSubtaskIds(new Set());
        subtaskFetchInFlightRef.current = {};
        subtaskSentinelRefs.current = {};

        subtaskObserverRef.current?.disconnect();
        subtaskObserverRef.current = null;

        desktopScrollRef.current = null;

        // Important: do NOT clear `columns` here. Columns are owned by the
        // dashboard store and should continue to render while the new workspace
        // data loads; we only reset expansion/pagination state to prevent
        // leaking page status across workspaces.
    }, [roomId, spaceId, sortOrderdetail, setColumns]);

    // ── Subtask sentinel IntersectionObserver ─────────────────────────────────
    // Watches the sentinel div placed at the bottom of every expanded subtask list.
    // When it becomes visible, fetches the next page for that taskId.
    useEffect(() => {
        const root = mainListScrollRef.current;
        if (!root) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const el = entry.target as HTMLElement;
                    const taskId = el.dataset.taskId;
                    if (!taskId) return;

                    const currentPage = subtaskPageStatus[taskId] ?? 0;
                    const totalPages = subtaskTotalPages[taskId] ?? 1;

                    if (currentPage >= totalPages) {
                        observer.unobserve(el);
                        return;
                    }

                    if (subtaskFetchInFlightRef.current[taskId]) return;

                    fetchSubtaskPage(taskId, currentPage + 1).then((hasMore) => {
                        if (!hasMore) observer.unobserve(el);
                    });
                });
            },
            {
                root,
                rootMargin: "0px 0px 200px 0px",
                threshold: 0.1,
            }
        );

        subtaskObserverRef.current = observer;

        // Observe all currently registered sentinels
        Object.entries(subtaskSentinelRefs.current).forEach(([taskId, el]) => {
            if (el) {
                el.dataset.taskId = taskId;
                observer.observe(el);
            }
        });

        return () => {
            observer.disconnect();
            subtaskObserverRef.current = null;
        };
    }, [fetchSubtaskPage, subtaskPageStatus, subtaskTotalPages]);

    // Helper to register/unregister subtask sentinel elements
    const registerSubtaskSentinel = useCallback(
        (taskId: string) => (el: HTMLDivElement | null) => {
            const observer = subtaskObserverRef.current;
            const prev = subtaskSentinelRefs.current[taskId];
            if (prev && observer) observer.unobserve(prev);

            subtaskSentinelRefs.current[taskId] = el;

            if (el && observer) {
                el.dataset.taskId = taskId;
                observer.observe(el);
            }
        },
        []
    );

    const handleMainScroll = useCallback(() => {
        if (!mainListScrollRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = mainListScrollRef.current;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 300;

        // The store pages the current room's stages and ignores calls while a
        // page is loading or none are left. New stages start at card page 1.
        if (isNearBottom) void loadMoreStages();
    }, [loadMoreStages]);

    const handleListScroll = useCallback(() => {
        handleMainScroll();
    }, [handleMainScroll]);

    // ── IntersectionObserver for per-group infinite scroll (stage cards) ──────
    useEffect(() => {
        if (!mainListScrollRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const target = entry.target as HTMLElement & { dataset: { groupId?: string } };
                    const groupId = target.dataset.groupId;
                    if (!groupId) return;

                    const group = (columns || []).find(
                        (g) => (g._id ?? g.id) === groupId
                    );
                    if (!group) return;

                    const currentPage = stagePageStatus[groupId] || 1;
                    const totalPages =
                        stageTotalPages[groupId] ||
                        Math.ceil((group.taskCount || 0) / 10);

                    if (currentPage >= totalPages) {
                        observer.unobserve(target);
                        return;
                    }

                    if (cardsFetchInFlightRef.current[groupId]) return;
                    cardsFetchInFlightRef.current[groupId] = true;
                    handleFetchPage(groupId, currentPage + 1);
                    window.setTimeout(() => {
                        cardsFetchInFlightRef.current[groupId] = false;
                    }, 250);
                });
            },
            {
                root: mainListScrollRef.current,
                rootMargin: "0px 0px 300px 0px",
                threshold: 0.1,
            }
        );

        observerRef.current = observer;

        Object.entries(sentinelRefs.current).forEach(([groupId, el]) => {
            if (el) {
                (el as any).dataset.groupId = groupId;
                observer.observe(el);
            }
        });

        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [columns, stagePageStatus, handleFetchPage, stageTotalPages]);

    const registerGroupSentinel = (groupId: string) => (el: HTMLDivElement | null) => {
        const observer = observerRef.current;
        const prev = sentinelRefs.current[groupId];
        if (prev && observer) observer.unobserve(prev);

        sentinelRefs.current[groupId] = el;

        if (el && observer) {
            (el as any).dataset.groupId = groupId;
            observer.observe(el);
        }
    };

    // ── Grid template ──────────────────────────────────────────────────────────
    const LIST_GRID_MIN_WIDTH = 1200;
    const CUSTOM_FIELD_COL_WIDTH = 160;

    const baseGridColumns = useMemo(
        () => ["minmax(0, 3fr)", "minmax(0, 1fr)", "minmax(0, 1fr)", "minmax(0, 1fr)", "minmax(0, 1fr)", `${META_COL_WIDTH}px`, `${META_COL_WIDTH}px`],
        []
    );
    const gridTemplate = useMemo(
        () => [
            ...baseGridColumns.slice(0, 5),
            ...customColumns.map(() => `${CUSTOM_FIELD_COL_WIDTH}px`),
            ...baseGridColumns.slice(5),
        ].join(" "),
        [baseGridColumns, customColumns]
    );
    const listGridMinWidth = useMemo(
        () => LIST_GRID_MIN_WIDTH + customColumns.length * CUSTOM_FIELD_COL_WIDTH,
        [customColumns.length]
    );

    // ── Derived selection state ────────────────────────────────────────────────
    const allRenderedTaskIds = useMemo(
        () => columns.flatMap((g) => getAllTaskIds(g.columns ?? g.cards ?? [])),
        [columns]
    );
    const areAllTasksChecked = useMemo(
        () => allRenderedTaskIds.length > 0 && allRenderedTaskIds.every((id) => checkedTaskIds.has(id)),
        [allRenderedTaskIds, checkedTaskIds]
    );
    const hasCheckedTasks = checkedTaskIds.size > 0;

    // ─── Selection handlers ────────────────────────────────────────────────────

    const toggleCheckAllTasks = () => {
        setCheckedTaskIds(areAllTasksChecked ? new Set() : new Set(allRenderedTaskIds));
    };

    const toggleCheckOneTask = (taskId: string) => {
        setCheckedTaskIds((prev) => {
            const next = new Set(prev);
            next.has(taskId) ? next.delete(taskId) : next.add(taskId);
            return next;
        });
    };

    const toggleGroupExpanded = (groupId: string) => {
        setCollapsedGroupIds((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // ─────────────────────────────────────────────────────────────────────────
    // toggleTaskSubtasksVisible
    // - On first open: fetches page 1. If API returns more pages, the
    //   IntersectionObserver on the sentinel will fetch subsequent pages.
    // - On close: just collapses the subtask section.
    // ─────────────────────────────────────────────────────────────────────────
    const toggleTaskSubtasksVisible = useCallback(
        async (taskId: string) => {
            const isOpening = !expandedTaskIds.has(taskId);

            setExpandedTaskIds((prev) => {
                const next = new Set(prev);
                next.has(taskId) ? next.delete(taskId) : next.add(taskId);
                return next;
            });

            if (!isOpening) return;

            // Only fetch page 1 if we haven't fetched any pages yet
            const alreadyFetched = (subtaskPageStatus[taskId] ?? 0) > 0;
            const task = findTaskInGroups(columns, taskId);

            if (alreadyFetched && (task?.subtasks?.length ?? 0) > 0) {
                // Already have data — the sentinel will handle loading more if needed
                return;
            }

            setLoadingSubtaskIds((prev) => new Set(prev).add(taskId));
            try {
                await fetchSubtaskPage(taskId, 1);
            } finally {
                setLoadingSubtaskIds((prev) => {
                    const next = new Set(prev);
                    next.delete(taskId);
                    return next;
                });
            }
        },
        [expandedTaskIds, subtaskPageStatus, columns, fetchSubtaskPage]
    );

    const ensureTaskSubtasksVisible = (taskId: string) => {
        setExpandedTaskIds((prev) => prev.has(taskId) ? prev : new Set([...prev, taskId]));
    };

    // ─── New Task (top-level) ─────────────────────────────────────────────────

    const openNewTaskForm = (groupId: string) => {
        if (isReadOnly) return;
        setNewSubtaskDraft(null);
        setTimeout(() => setNewTaskDraft({ targetGroupId: groupId, taskName: "" }), 0);
    };

    const cancelNewTask = () => {
        setNewTaskDraft(null)
    };

    const cancelNewStage = () => {
        setIsAddingStageInline(false);
        setNewStageInlineName("");
        setNewStageInlineColor("#8b5cf6");
    };

    const submitNewStage = async () => {
        if (isReadOnly || isCreatingStageInline || !newStageInlineName.trim() || !roomId) return;

        setIsCreatingStageInline(true);
        try {
            const newStage = await createStage({
                name: newStageInlineName.trim(),
                color: newStageInlineColor,
                stageType: "active",
                orderId: 0,
                roomId,
            });

            if (newStage) {
                setColumns(prev => [...prev, transformStage(newStage)]);
                incrementListCount(roomId);
                cancelNewStage();
            }
        } finally {
            setIsCreatingStageInline(false);
        }
    };

    const submitNewTask = async () => {
        if (!newTaskDraft || isSubmittingTask) return;
        const name = newTaskDraft.taskName.trim();
        if (!name) { cancelNewTask(); return; }

        const resolvedGroupId =
            newTaskDraft.targetGroupId === "quick-add"
                ? (columns[0]?.id ?? columns[0]?._id ?? newTaskDraft.targetGroupId)
                : newTaskDraft.targetGroupId;

        setIsSubmittingTask(true);
        try {
            const startDate = newTaskDraft.startDate ? new Date(newTaskDraft.startDate).getTime() : null;
            const dueDate = newTaskDraft.dueDate ? new Date(newTaskDraft.dueDate).getTime() : null;

            const newCard = await createCard({
                stageId: resolvedGroupId,
                title: name,
                roomId: roomId,
                startDate: (startDate && !isNaN(startDate)) ? startDate : null,
                dueDate: (dueDate && !isNaN(dueDate)) ? dueDate : null,
                description: "",
                priority: newTaskDraft.priority ? newTaskDraft.priority : "normal",
                tags: newTaskDraft.tags || [],
                assignedToIds: newTaskDraft.assigneeId ? [newTaskDraft.assigneeId] : [],
            });

            if (newCard) {
                setColumns(prev => prev.map(col => {
                    if (col._id === resolvedGroupId) {
                        return {
                            ...col,
                            cards: [transformCardCustom(newCard, resolvedGroupId), ...col.cards],
                            localCardCount: (col.localCardCount || 0) + 1
                        }
                    }
                    return col;
                }));
                cancelNewTask();
            }
        } catch (err: any) {
            console.error("Failed to create task", err);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    // ─── New Subtask (child of an existing task) ──────────────────────────────

    const openNewSubtaskForm = (parentTaskId: string) => {
        if (isReadOnly) return;
        setNewTaskDraft(null);

        setExpandedTaskIds((prev) => new Set([...prev, parentTaskId]));

        const parentGroup = columns.find((g) =>
            findTaskInTree(g.columns ?? g.cards ?? [], parentTaskId)
        );
        const parentGroupId = parentGroup?._id ?? parentGroup?.id ?? "";

        setTimeout(() => setNewSubtaskDraft({ parentTaskId, parentGroupId, taskName: "" }), 0);
    };

    const cancelNewSubtask = () => setNewSubtaskDraft(null);

    const submitNewSubtask = async () => {
        if (isReadOnly || !newSubtaskDraft || isSubmittingTask) return;
        const name = newSubtaskDraft.taskName.trim();
        if (!name) { cancelNewSubtask(); return; }

        const { parentTaskId, parentGroupId } = newSubtaskDraft;
        const rootTaskId = getRootTaskId(columns, parentTaskId);

        setIsSubmittingTask(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const startDate = newSubtaskDraft.startDate ? new Date(newSubtaskDraft.startDate).getTime() : null;
            const dueDate = newSubtaskDraft.dueDate ? new Date(newSubtaskDraft.dueDate).getTime() : null;

            const body = {
                title: name,
                roomId,
                stageId: parentGroupId,
                assignedToIds: newSubtaskDraft.assigneeId ? [newSubtaskDraft.assigneeId] : [],
                priority: newSubtaskDraft.priority || undefined,
                tags: newSubtaskDraft.tags || [],
                startDate: (startDate && !isNaN(startDate)) ? startDate : undefined,
                dueDate: (dueDate && !isNaN(dueDate)) ? dueDate : undefined,
                parentId: parentTaskId,
                rootId: rootTaskId || parentTaskId,
            };

            const response = await fetch(`${TASKROOM_API_URL}tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error("Failed to create subtask");

            const result = await response.json();
            if (result?.status && result.data) {
                const t = result.data;
                const createdSubtask: Task = {
                    _id: t._id,
                    id: t._id,
                    name: t.title ?? t.name,
                    status: t.status,
                    assignedToIds: t.assignedToIds || [],
                    tagData: t.tags || [],
                    startDate: t.startDate,
                    dueDate: t.dueDate,
                    priority: t.priority,
                    tags: t.tags || [],
                    subtasks: [],
                    parentId: parentTaskId,
                    type: "subtask",
                    members: t.assignedToIds ?? [],
                };
                setColumns(addSubtaskToParent(columns, parentTaskId, createdSubtask));
                cancelNewSubtask();
            }
        } catch (err: any) {
            console.error("Failed to create subtask:", err);
            toast.error("Failed to create subtask");
        } finally {
            setIsSubmittingTask(false);
        }
    };

    // ─── Inline Updates (Logic from CardModal) ────────────────────────────────

    const handleInlineUpdateAssignee = async (taskId: string, memberIds: string[]) => {
        if (isReadOnly) return;
        try {
            await updateCard(taskId, { assignedToIds: memberIds as any });
            setColumns(prev => updateTaskInGroups(prev as any, taskId, (t) => ({
                ...t,
                assignedToIds: memberIds,
                // We update members array for immediate UI feedback. 
                // Note: The actual member data (name, initials) comes from memberData or a re-fetch,
                // but if we want to remove an item locally, we can filter the existing members.
                members: (t.members || []).filter(m => memberIds.includes(m._id || m.userId))
            })));
        } catch (error) {
            console.error("Failed to update assignee:", error);
        }
    };

    const handleInlineUpdatePriority = async (taskId: string, priority: TaskPriority) => {
        if (isReadOnly) return;
        try {
            await updateCard(taskId, { priority });
            setColumns(prev => updateTaskInGroups(prev as any, taskId, (t) => ({ ...t, priority })));
        } catch (error) {
            console.error("Failed to update priority:", error);
        }
    };

    const handleInlineUpdateDates = async (taskId: string, start?: string, due?: string) => {
        if (isReadOnly) return;
        try {
            const startDate = start ? new Date(start).getTime() : null;
            const dueDate = due ? new Date(due).getTime() : null;
            await updateCard(taskId, { startDate, dueDate } as any);
            setColumns(prev => updateTaskInGroups(prev as any, taskId, (t) => ({
                ...t,
                startDate: start,
                dueDate: due,
                isOverDue: due ? new Date(due) < new Date() : false
            })));
        } catch (error) {
            console.error("Failed to update dates:", error);
        }
    };

    const handleInlineUpdateTags = async (
        taskId: string,
        tagIds: string[],
        selectedTags?: Array<{ _id: string; name: string; color: string }>,
        addedTagId?: string
    ) => {
        if (isReadOnly) return;
        try {
            await updateCard(taskId, {
                tags: tagIds,
                ...(addedTagId ? { tagItemIds: addedTagId } : {}),
            } as any);
            setColumns(prev => updateTaskInGroups(prev as any, taskId, (t) => ({
                ...t,
                tags: tagIds,
                tagData: selectedTags ?? (t.tagData || []).filter(tag => tagIds.includes(tag._id)),
            })));
        } catch (error) {
            console.error("Failed to update tags:", error);
            toast.error("Failed to update tags");
        }
    };



    // ─── Inline name edit ─────────────────────────────────────────────────────

    const startEditingTaskName = (task: Task) => {
        setTaskBeingEditedId(task._id);
        setEditedTaskName(task.name);
    };

    const commitTaskNameEdit = () => {
        if (!taskBeingEditedId) return;
        const name = editedTaskName.trim();
        if (name) setColumns(updateTaskInGroups(columns, taskBeingEditedId, (t) => ({ ...t, name })));
        setTaskBeingEditedId(null);
    };

    // ─── Bulk update ──────────────────────────────────────────────────────────

    const applyUpdaterToCheckedTasks = (updater: (task: Task) => Task) => {
        const updated = [...checkedTaskIds].reduce(
            (groups, id) => updateTaskInGroups(groups, id, updater),
            columns
        );
        setColumns(updated);
    };

    // ─── Custom field update ──────────────────────────────────────────────────

    const persistCustomFieldValue = useCallback(async (taskId: string, fieldId: string, value: string | number | null) => {
        if (isReadOnly) return;
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${taskId}/update/custom/field`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    fieldId,
                    fieldValue: value ?? "",
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data?.status === false) {
                throw new Error(data?.message || "Failed to update custom field");
            }

            const updatedRoom = data?.data?.data ?? data?.data ?? data?.room;
            if (updatedRoom && typeof updatedRoom === "object" && roomId) {
                useTaskroomWorkspacetore.getState().syncRoom(roomId, updatedRoom);
                if (!updatedRoom.customFields) {
                    await refreshCurrentRoomDetail(roomId);
                }
            }
        } catch (error) {
            console.error("Failed to update custom field:", error);
            toast.error("Failed to update custom field");
        }
    }, [isReadOnly, roomId, refreshCurrentRoomDetail]);
    const updateCustomFieldValue = (taskId: string, fieldId: string, type: CustomFieldType, rawValue: string, immediate = false) => {
        const parsed = parseCustomFieldValue(type, rawValue);
        setColumns(updateTaskInGroups(columns, taskId, (t) => ({
            ...t,
            customFields: { ...(t.customFields ?? {}), [fieldId]: parsed },
        })));
        if (isReadOnly) return;

        const timerKey = `${taskId}:${fieldId}`;
        if (customFieldSaveTimers.current[timerKey]) {
            clearTimeout(customFieldSaveTimers.current[timerKey]);
            delete customFieldSaveTimers.current[timerKey];
        }

        if (immediate) {
            void persistCustomFieldValue(taskId, fieldId, parsed);
            return;
        }

        const delay = type === "text" || type === "textarea" || type === "number" ? 500 : 0;
        customFieldSaveTimers.current[timerKey] = setTimeout(() => {
            void persistCustomFieldValue(taskId, fieldId, parsed);
            delete customFieldSaveTimers.current[timerKey];
        }, delay);
    };

    const updateDropdownFieldValue = (taskId: string, fieldId: string, value: string | null) => {
        setColumns(updateTaskInGroups(columns, taskId, (t) => ({
            ...t,
            customFields: { ...(t.customFields ?? {}), [fieldId]: value },
        })));
        if (!isReadOnly) {
            void persistCustomFieldValue(taskId, fieldId, value);
        }
    };

    // ─── Stage creation ───────────────────────────────────────────────────────

    const submitCreateStage = async () => {
        if (!newStageName.trim() || !roomId) {
            if (!roomId) toast.error("Missing Room ID");
            return;
        }
        setIsCreatingStage(true);
        try {
            const token = localStorage.getItem("garage_tok");
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}stages`,
                {
                    name: newStageName.trim(), color: "#008080",
                    stageType: newStageType, type: "custom",
                    orderId: columns.length + 1, roomId,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data?.status || res.data?.success) {
                toast.success("Stage created successfully");
                setIsCreateStageModalOpen(false);
                setNewStageName("");
                setNewStageType("tostart");
                window.location.reload();
            } else {
                toast.error(res.data?.message ?? "Failed to create stage");
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message ?? err.message ?? "Failed to create stage");
        } finally {
            setIsCreatingStage(false);
        }
    };

    // ─── Render helpers ───────────────────────────────────────────────────────

    const onOpenTask = (task: Task) => { /* handled by parent */ };

    const sortedStatuses = [...columns]?.sort((a, b) => {
        const order = { tostart: 0, active: 1, done: 2, closed: 3 };
        return order[a?.stageType] - order[b?.stageType];
    });

    // ─── Task Row ─────────────────────────────────────────────────────────────

    const renderTaskRow = (task: Task, depth: number, groupId: string) => {
        const taskId = task._id ?? task.id;
        const isChecked = checkedTaskIds.has(taskId);
        const isEditingName = taskBeingEditedId === taskId;
        const hasSubtasks = (task.subTaskCount ?? task.subtasks?.length ?? 0) > 0;
        const isSubtasksVisible = expandedTaskIds.has(taskId);
        const indentPx = depth * (isMobile ? 16 : 24);
        const isAddingSubtaskHere = newSubtaskDraft?.parentTaskId === taskId;

        // Subtask pagination state for this task
        const subtaskCurrentPage = subtaskPageStatus[taskId] ?? 0;
        const subtaskPages = subtaskTotalPages[taskId] ?? 1;
        const hasMoreSubtasks = subtaskCurrentPage > 0 && subtaskCurrentPage < subtaskPages;
        const isLoadingMoreSubtasks = loadingSubtaskPageIds.has(taskId);

        const toggle = async (data: any) => {
            await setActiveCard(data);
            await setShowModal(true);
        };

        return (
            <div key={taskId} className="w-full">
                {isAddingSubtaskHere && newSubtaskDraft && !isReadOnly && (
                    <div className={STICKY_SUBTASK_DRAFT_ROW_CLASS}>
                        <div
                            className="pr-3 md:pr-6"
                            style={{ paddingLeft: `${(isMobile ? 16 : 32) + (depth + 1) * (isMobile ? 16 : 24)}px` }}
                        >
                            <InlineDraftRow
                                draftName={newSubtaskDraft.taskName}
                                onNameChange={(name) => setNewSubtaskDraft({ ...newSubtaskDraft, taskName: name })}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); submitNewSubtask(); }
                                    else if (e.key === "Escape") { e.preventDefault(); cancelNewSubtask(); }
                                }}
                                onSave={submitNewSubtask}
                                onCancel={cancelNewSubtask}
                                indentPx={0}
                                isSubtask
                                className="border-0 bg-transparent shadow-none"
                                assigneeId={newSubtaskDraft.assigneeId}
                                onAssigneeChange={(id) => setNewSubtaskDraft({ ...newSubtaskDraft, assigneeId: id })}
                                priority={newSubtaskDraft.priority}
                                onPriorityChange={(p) => setNewSubtaskDraft({ ...newSubtaskDraft, priority: p })}
                                startDate={newSubtaskDraft.startDate}
                                dueDate={newSubtaskDraft.dueDate}
                                onDateChange={(start, due) => setNewSubtaskDraft({ ...newSubtaskDraft, startDate: start, dueDate: due })}
                                tags={newSubtaskDraft.tags}
                                onTagsChange={(ids) => setNewSubtaskDraft({ ...newSubtaskDraft, tags: ids })}
                                roomId={roomId}
                                spaceId={spaceId}
                            />
                        </div>
                    </div>
                )}
                <div
                    {...(!isMobile ? { "data-stage-scroll": groupId, onScroll: handleBodyHorizontalScroll } : {})}
                    className={cn(
                        isMobile
                            ? "w-full max-w-full overflow-hidden"
                            : "overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    )}
                >
                    <div className={isMobile ? "w-full" : undefined} style={!isMobile ? { minWidth: listGridMinWidth } : undefined}>
                {/* Main task row */}
                <div
                    className={cn(
                        "cursor-pointer bg-[#0a0a0d] text-[13px]",
                        isMobile ? "border-b border-white/5" : "items-center"
                    )}
                    style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : gridTemplate }}
                >
                    {/* Name */}
                    <div
                        className={cn(
                            "group/name flex min-w-0 items-start overflow-hidden",
                            isMobile ? "px-3 py-2.5" : "sticky z-20 bg-[#0a0a0d] px-2 pl-8 py-1.5"
                        )}
                        style={!isMobile ? { left: 0, boxShadow: "12px 0 14px -14px rgba(15,23,42,0.35)" } : undefined}
                    >
                        {depth > 0 && (
                            <div
                                className="absolute h-[1px] bg-[#e5e7eb15]"
                                style={{
                                    left: `${(depth - 1) * (isMobile ? 16 : 24) + (isMobile ? 27 : 39)}px`,
                                    width: '12px',
                                    top: '50%'
                                }}
                            />
                        )}
                        <div className="flex w-full items-start gap-1.5" style={{ paddingLeft: `${indentPx}px` }}>
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const nextCompleted = !task.isCompleted;

                                    // Optimistic UI update (and avoid stale `columns` snapshot)
                                    setColumns((prev) =>
                                        updateTaskInGroups(prev as any, taskId, (t) => ({ ...t, isCompleted: nextCompleted }))
                                    );
                                    try {
                                        const token = localStorage.getItem("garage_tok");
                                        const response = await fetch(`${TASKROOM_API_URL}tasks/${taskId}`, {
                                            method: "PUT",
                                            headers: {
                                                "Content-Type": "application/json",
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify({ isCompleted: nextCompleted }),
                                        });
                                        const result = await response.json().catch(() => null);
                                        if (!response.ok || result?.status === false) {
                                            throw new Error(result?.message || "Failed to update task");
                                        }
                                        toast("Updated The Task")
                                    } catch (err) {
                                        console.error("Failed to toggle task completion:", err);
                                        // Revert optimistic update
                                        setColumns((prev) =>
                                            updateTaskInGroups(prev as any, taskId, (t) => ({ ...t, isCompleted: !nextCompleted }))
                                        );
                                    }
                                }}
                                className="flex cursor-pointer h-4 w-4 shrink-0 items-center justify-center rounded-full  hover:border-green-500 transition-colors"
                            >
                                {task.isCompleted ? <div
                                    style={{
                                        background: "green",
                                        display: 'flex',
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                    className="h-4 w-4 border-2 border-[#000] rounded-full bg-red" >
                                    <div
                                        style={{
                                            background: "green"
                                        }}
                                        className="h-2 w-2 border-2 border-[#000] rounded-full bg-red" >

                                    </div>
                                </div>


                                    : <div className="h-4 w-4 border border-[#e5e7eb29] rounded-full bg-transparent" />}
                            </button>

                            {hasSubtasks ? (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleTaskSubtasksVisible(taskId); }}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white"
                                >
                                    {isSubtasksVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                            ) : (
                                <span className="inline-flex h-6 w-6 shrink-0" />
                            )}

                            <button type="button"
                                className="min-w-0 flex-1 text-left focus:outline-none"
                                onClick={(e) => { e.stopPropagation(); if (!isEditingName) onOpenTask(task); }}>
                                {isEditingName ? (
                                    <input value={editedTaskName} autoFocus
                                        onChange={(e) => setEditedTaskName(e.target.value)}
                                        onBlur={commitTaskNameEdit}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") { e.preventDefault(); commitTaskNameEdit(); }
                                            else if (e.key === "Escape") { e.preventDefault(); setTaskBeingEditedId(null); }
                                        }}
                                        className="w-full rounded border border-orange-300 bg-[#0a0a0d] px-2 py-1 text-[13px] focus:outline-none"
                                    />
                                ) : (
                                    <div
                                        className="flex min-w-0 flex-col gap-0.5"
                                        onClick={(e) => { e.stopPropagation(); toggle(task) }}
                                    >
                                        <span className={cn(
                                            "whitespace-normal break-words font-semibold text-white",
                                            task.isCompleted && "text-white/50 line-through"
                                        )}>
                                            {task.name}
                                        </span>
                                        {task.description?.trim() ? (
                                            <span className={cn(
                                                "whitespace-normal break-words text-[12px] leading-snug text-white/45",
                                                task.isCompleted && "text-white/30 line-through"
                                            )}>
                                                {task.description}
                                            </span>
                                        ) : null}
                                    </div>
                                )}
                            </button>

                            {/* Hover actions — always visible on mobile */}
                            <div className="flex items-center gap-1 md:hidden">
                                {!isReadOnly && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); openNewSubtaskForm(taskId); }}
                                    className="cursor-pointer inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#0a0a0d] text-white/50"
                                    aria-label="Add subtask">
                                    <Plus className="h-3 w-3" />
                                </button>
                                )}
                                <button type="button"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm("Are you sure you want to delete this task?")) {
                                            try {
                                                const token = localStorage.getItem("garage_tok");
                                                const response = await fetch(`${TASKROOM_API_URL}tasks/${taskId}`, {
                                                    method: "DELETE",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                        Authorization: `Bearer ${token}`,
                                                    },
                                                });
                                                if (response.ok) {
                                                    setColumns(prev => prev.map(col => {
                                                        if (col._id === groupId || col.id === groupId) {
                                                            const remainingColumns = (col.columns || []).filter(t => (t._id ?? t.id) !== taskId);
                                                            const remainingCards = (col.cards || []).filter(t => (t._id ?? t.id) !== taskId);
                                                            return {
                                                                ...col,
                                                                columns: remainingColumns,
                                                                cards: remainingCards,
                                                                localCardCount: Math.max((col.localCardCount || 0) - 1, 0)
                                                            };
                                                        }
                                                        return col;
                                                    }));
                                                    toast.success("Task deleted");
                                                }
                                            } catch (err) {
                                                console.error("Failed to delete task", err);
                                            }
                                        }
                                    }}
                                    className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#0a0a0d] text-white/50 hover:text-red-500"
                                    aria-label="Delete task">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                            <div className="hidden md:flex items-center gap-1 shrink-0 opacity-0 transition-opacity group-hover/name:opacity-100">
                                {!isReadOnly && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); openNewSubtaskForm(taskId); }}
                                    className="cursor-pointer inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#0a0a0d] text-white/50 hover:text-white/50 hover:border-orange-300"
                                    aria-label="Add subtask">
                                    <Plus className="h-3 w-3" />
                                </button>
                                )}
                                {/* <button type="button" onClick={(e) => { e.stopPropagation(); toggle(task); }}
                                    className="cursor-pointer inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#0a0a0d] text-white/50 hover:text-white/50"
                                    aria-label="Edit task">
                                    <Pencil className="h-3 w-3" />
                                </button> */}
                                <button type="button"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm("Are you sure you want to delete this task?")) {
                                            try {
                                                const token = localStorage.getItem("garage_tok");
                                                const response = await fetch(`${TASKROOM_API_URL}tasks/${taskId}`, {
                                                    method: "DELETE",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                        Authorization: `Bearer ${token}`,
                                                    },
                                                });
                                                if (response.ok) {
                                                    setColumns(prev => prev.map(col => {
                                                        if (col._id === groupId || col.id === groupId) {
                                                            const remainingColumns = (col.columns || []).filter(t => (t._id ?? t.id) !== taskId);
                                                            const remainingCards = (col.cards || []).filter(t => (t._id ?? t.id) !== taskId);
                                                            return {
                                                                ...col,
                                                                columns: remainingColumns,
                                                                cards: remainingCards,
                                                                localCardCount: Math.max((col.localCardCount || 0) - 1, 0)
                                                            };
                                                        }
                                                        return col;
                                                    }));
                                                    toast.success("Task deleted");
                                                }
                                            } catch (err) {
                                                console.error("Failed to delete task", err);
                                            }
                                        }
                                    }}
                                    className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#0a0a0d] text-white/50 hover:text-red-500"
                                    aria-label="Delete task">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className={cn(
                            isMobile && "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-3 pt-1 border-t border-white/5",
                            !isMobile && "contents"
                        )}
                    >
                        {/* Assignee */}
                        <div className={cn("bg-[#0a0a0d] flex items-center", isMobile ? "py-0" : "px-2 py-1.5")}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {task?.members?.length > 0 && (
                                    <div className="flex -space-x-1">
                                        {task?.members?.slice(0, 5)?.map((member, idx) => {
                                            const initials = member.name
                                                ? member.name.split(" ").slice(0, 2).map(n => n[0]?.toUpperCase()).join("")
                                                : (member.email ? member.email.substring(0, 2).toUpperCase() : "??");

                                            return (
                                                <div key={idx} className="relative group/avatar">
                                                    <div
                                                        className={`text-[13px] bg-[#0a0a0d] cursor-pointer font-semi rounded-full w-6 h-6 flex items-center justify-center text-white/50 border border-[#e5e7eb29]`}
                                                        title={member.name || member.email}
                                                    >
                                                        {initials}
                                                    </div>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (isReadOnly) return;
                                                            toggleMemberInline(taskId, member, task.assignedToIds || []);
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/avatar:opacity-100 bg-[#2a2a3a] border border-[#e5e7eb29] rounded-full w-3.5 h-3.5 flex items-center justify-center transition z-10"
                                                    >
                                                        <X className="w-2 h-2 text-white/50" />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {(task?.assignedToIds?.length ?? 0) > 5 && (
                                            <div className="flex w-6 h-6 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#0a0a0d] text-[13px] font-semi text-white/50">
                                                +{(task?.assignedToIds?.length ?? 0) - 5}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Popover onOpenChange={async (open) => {
                                    if (open) {
                                        setIsMembersLoading(true);
                                        setMemberSearchTerm("");
                                        setSearchedMembers([]);
                                        await fetchMembersForCards(taskId); // Re-using taskId for context
                                        setIsMembersLoading(false);
                                    } else {
                                        setMemberSearchTerm("");
                                        setSearchedMembers([]);
                                    }
                                }}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="w-6 h-6 rounded-full border border-dashed border-[#e5e7eb29] flex items-center justify-center text-white/30 hover:text-white/50 hover:border-[#666] transition"
                                            disabled={isReadOnly}
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="bottom" align="start" className={cn("w-[min(calc(100vw-2rem),16rem)] sm:w-64 p-0 bg-[#0a0a0d] border-[#e5e7eb29] shadow-xl", LIST_VIEW_TEXT)} sideOffset={6}>
                                        <div className="p-3">
                                            <input
                                                type="text"
                                                placeholder="Search members..."
                                                value={memberSearchTerm}
                                                onChange={(e) => setMemberSearchTerm(e.target.value)}
                                                className="w-full px-2.5 py-1.5  border border-[#e5e7eb29] rounded text-[13px] placeholder:text-[13px] text-white/50 mb-2 focus:outline-none focus:border-[#e5e7eb29]"
                                            />
                                            <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar">
                                                {isMembersLoading || isSearchingMembers ? (
                                                    Array.from({ length: 4 }).map((_, i) => (
                                                        <div key={i} className="flex items-center gap-2 p-2">
                                                            <Skeleton className="w-6 h-6 rounded-full bg-white/5" />
                                                            <Skeleton className="h-3 w-24 bg-white/5" />
                                                        </div>
                                                    ))
                                                ) : memberSearchTerm.trim() ? (
                                                    searchedMembers.length > 0 ? searchedMembers.map((member) => (
                                                        <button
                                                            key={member._id || member.id}
                                                            className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded transition text-[13px] group"
                                                            onClick={() => toggleMemberInline(taskId, member, task.assignedToIds || [])}
                                                            disabled={togglingMemberIds.has(member._id || member.id)}
                                                        >

                                                            <div className="flex items-center gap-2">
                                                                {member.image ? (
                                                                    <img
                                                                        src={member.image}
                                                                        alt={member.name}
                                                                        className="h-7 w-7 rounded-full object-cover shadow-sm"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                                            if (fallback) fallback.style.display = 'flex';
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div
                                                                    style={{ display: member.image ? 'none' : 'flex' }}

                                                                    className="w-6 h-6 rounded-full bg-[#0a0a0d] flex items-center justify-center text-[13px] font-bold text-white/50 shrink-0">
                                                                    {(member?.name || member?.email || "?")?.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <span className="text-white/50 truncate max-w-[140px]">{member?.name || member?.email || "Unknown"}</span>
                                                            </div>
                                                            {(task.assignedToIds || []).includes(member._id || member.id) && <Check className="w-3.5 h-3.5 text-white/50" />}
                                                        </button>
                                                    )) : <div className="text-[13px] text-white/50 text-center py-3">No members found</div>
                                                ) : (
                                                    cardMembers?.map((member) => (
                                                        <button
                                                            key={member.id || member._id}
                                                            className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded transition text-[13px] group"
                                                            onClick={() => toggleMemberInline(taskId, member, task.assignedToIds || [])}
                                                            disabled={togglingMemberIds.has(member._id || member.id)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-[#0a0a0d] flex items-center justify-center text-[13px] font-bold text-white/50 shrink-0">
                                                                    {(member?.name || "?")?.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <span className="text-white/50 truncate max-w-[140px]">{member?.name || member?.email}</span>
                                                            </div>
                                                            {(task.assignedToIds || []).includes(member._id || member.id) && <Check className="w-3.5 h-3.5 text-white/50" />}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>



                        {/* Due date */}
                        <div className={cn("flex items-center", isMobile ? "py-0" : "px-2 py-1.5")}>
                            <CustomDatePicker
                                startDate={task.startDate ? new Date(task.startDate) : undefined}
                                dueDate={task.dueDate ? new Date(task.dueDate) : undefined}
                                onSelect={({ start, due }) => handleInlineUpdateDates(taskId, start?.toISOString(), due?.toISOString())}
                            >
                                <div className="cursor-pointer min-h-[24px] min-w-[24px] flex items-center">
                                    {task?.dueDate ? (
                                        <div className={cn(
                                            "flex items-center gap-1 py-0.5 rounded text-[13px] font-semi transition-colors",
                                            task?.isOverDue ? "text-red-500" : "text-white/50"
                                        )}>
                                            <Clock className="w-3 h-3" />
                                            <span>{isValid(new Date(task?.dueDate)) ? format(new Date(task?.dueDate), isMobile ? "MMM d, yy" : "MMM d") : "No date"}</span>
                                            {task?.isOverDue && <span className="ml-1 font-semi hidden sm:inline">Overdue</span>}
                                        </div>
                                    ) : <div className="flex items-center justify-center text-white/30 hover:text-white/50 transition-colors">
                                        <Calendar className="w-4 h-4" />
                                    </div>}
                                </div>
                            </CustomDatePicker>
                        </div>

                        {/* Priority */}
                        <div className={cn("flex items-center", isMobile ? "py-0" : "px-2 py-1.5")}>
                            <PriorityPicker
                                priority={task.priority}
                                onSelect={(p) => handleInlineUpdatePriority(taskId, p)}
                            >
                                <button type="button" className="cursor-pointer min-h-[24px] min-w-[24px] flex items-center">
                                    {task.priority ? (
                                        <div className={cn(
                                            "flex items-center gap-1 py-0.5 rounded text-[13px] font-semi",
                                            "text-white/50"
                                        )}
                                            title={formatPriorityLabel(task.priority)}
                                        >
                                            <Flag className={cn("h-3.5 w-3.5",
                                                task.priority === "urgent" ? "fill-red-500" :
                                                    task.priority === "high" ? "fill-amber-500" :
                                                        task.priority === "normal" ? "fill-blue-500" : ""
                                            )} />
                                            <span>{formatPriorityLabel(task.priority)}</span>
                                        </div>
                                    ) : <div className="flex items-center justify-center text-white/30 hover:text-white/50 transition-colors">
                                        <Flag className="w-4 h-4" />
                                    </div>}
                                </button>
                            </PriorityPicker>
                        </div>

                        {/* Tags */}
                        <div className={cn("bg-[#0a0a0d] flex items-center min-w-0", isMobile ? "py-0" : "px-2 py-1.5")}>
                            <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                                {task.tagData?.map((label) => (
                                    <TagChip
                                        key={label._id}
                                        label={label}
                                        maxWidthClass="max-w-[80px]"
                                        disabled={isReadOnly}
                                        onRemove={() => {
                                            const updatedIds = (task.tags || []).filter((tid) => tid !== label._id);
                                            const updatedTagData = (task.tagData || []).filter((t) => t._id !== label._id);
                                            handleInlineUpdateTags(taskId, updatedIds, updatedTagData);
                                        }}
                                    />
                                ))}

                                <TagPicker
                                    boardId={roomId || ""}
                                    selectedTagIds={task.tags || []}
                                    onSelect={(tagIds, selectedTags) => {
                                        const addedTagId = tagIds.find((id) => !(task.tags || []).includes(id));
                                        handleInlineUpdateTags(taskId, tagIds, selectedTags, addedTagId);
                                    }}
                                    Idspace={spaceId || ""}
                                >
                                    <button
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        disabled={isReadOnly}
                                        className="h-6 min-w-6 px-1.5 rounded-md border border-dashed border-white/15 flex items-center justify-center text-white/35 hover:text-white/60 hover:border-white/30 hover:bg-white/[0.03] transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Manage tags"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </TagPicker>
                            </div>
                        </div>




                        {/* Custom fields */}
                        {customColumns.map((col) => {
                            const raw = task.customFields?.[col.id];
                            const display = raw == null ? "" : String(raw);

                            if (col.type === "dropdown" || col.type === "labels") {
                                const selectedLabel = display || null;
                                const selectedColor = selectedLabel ? getOptionColor(col.options, selectedLabel) : undefined;
                                return (
                                    <div key={col.id} className={cn("bg-[#0a0a0d] flex items-center", isMobile ? "py-0 w-full" : "px-2 py-1.5")}>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    disabled={isReadOnly}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={cn(
                                                        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-medium transition",
                                                        selectedLabel
                                                            ? "border-transparent text-white"
                                                            : "border-dashed border-[#e5e7eb29] text-white/40"
                                                    )}
                                                    style={selectedLabel && selectedColor ? { backgroundColor: selectedColor } : undefined}
                                                >
                                                    <span className="truncate">{selectedLabel || "—"}</span>
                                                    <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align="start"
                                                className={cn("w-56 p-0 border border-[#e5e7eb29] bg-[#141516] text-white shadow-xl", LIST_VIEW_TEXT)}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="p-2 border-b border-[#e5e7eb29]">
                                                    <input
                                                        placeholder="Search or add options..."
                                                        className="w-full rounded-md border border-[#e5e7eb29] bg-[#0a0a0d] px-2 py-1.5 text-[13px] text-white/80 placeholder:text-white/35 outline-none focus:border-white/30"
                                                        readOnly
                                                    />
                                                </div>
                                                <div className="max-h-52 overflow-y-auto py-1">
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center px-3 py-2 text-left text-[13px] text-white/50 hover:bg-white/5"
                                                        onClick={() => updateDropdownFieldValue(taskId, col.id, null)}
                                                    >
                                                        —
                                                    </button>
                                                    {(col.options ?? []).map((opt) => {
                                                        const isSelected = selectedLabel === opt.label;
                                                        return (
                                                            <button
                                                                key={opt.label}
                                                                type="button"
                                                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5"
                                                                onClick={() => updateDropdownFieldValue(taskId, col.id, opt.label)}
                                                            >
                                                                <span
                                                                    className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[13px] font-medium text-white"
                                                                    style={{ backgroundColor: opt.color }}
                                                                >
                                                                    <span className="truncate">{opt.label}</span>
                                                                </span>
                                                                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-white/70" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                );
                            }

                            if (col.type === "number") return (
                                <div key={col.id} className={cn("bg-[#0a0a0d] flex items-center", isMobile ? "py-0 w-full" : "px-2 py-1.5")}>
                                    <input type="number" inputMode="numeric" value={display} readOnly={isReadOnly}
                                        onChange={(e) => updateCustomFieldValue(taskId, col.id, "number", e.target.value)}
                                        onBlur={(e) => updateCustomFieldValue(taskId, col.id, "number", e.target.value, true)}
                                        className="h-7 w-full rounded-md border border-[#e5e7eb29] bg-[#0a0a0d] px-2 text-[13px] text-white/50 placeholder:text-white/50 focus:border-orange-400 focus:outline-none"
                                        placeholder="—" />
                                </div>
                            );
                            if (col.type === "text" || col.type === "textarea") return (
                                <div key={col.id} className={cn("bg-[#0a0a0d] flex items-center", isMobile ? "py-0 w-full" : "px-2 py-1.5")}>
                                    <input type="text" value={display} readOnly={isReadOnly}
                                        onChange={(e) => updateCustomFieldValue(taskId, col.id, col.type, e.target.value)}
                                        onBlur={(e) => updateCustomFieldValue(taskId, col.id, col.type, e.target.value, true)}
                                        className="h-7 w-full rounded-md border border-[#e5e7eb29] bg-[#0a0a0d] px-2 text-[13px] text-white/50 placeholder:text-white/50 focus:border-orange-400 focus:outline-none"
                                        placeholder="—" />
                                </div>
                            );
                            if (col.type === "date") return (
                                <div key={col.id} className={cn("bg-[#0a0a0d] flex items-center", isMobile ? "py-0" : "px-2 py-1.5")}>
                                    <CustomDatePicker defaultTab="due" dueDate={display ? new Date(display) : undefined}
                                        onSelect={({ due }) => updateCustomFieldValue(taskId, col.id, "date", due ? formatDateDisplay(due) : "", true)}>
                                        <button type="button" disabled={isReadOnly} className="inline-flex w-full items-center gap-1 rounded-full border border-dashed border-[#e5e7eb29] bg-[#0a0a0d] px-2 py-0.5 text-[13px] text-white/50">
                                            <Calendar className="h-3.5 w-3.5 text-white/50" />
                                            <span className="truncate">{display || "Set date"}</span>
                                        </button>
                                    </CustomDatePicker>
                                </div>
                            );
                            return <div key={col.id} className={cn("bg-[#0a0a0d]", isMobile ? "py-0" : "px-2 py-1.5")} />;
                        })}

                        {/* Comments */}
                        <div className={cn(META_COL_CELL_CLASS, isMobile && "py-0")}>
                            <div className="inline-flex items-center justify-center gap-1 text-white/50">
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                <span className={COUNT_NUMBER_CLASS}>{task.commentCount ?? 0}</span>
                            </div>
                        </div>

                        {/* Subtasks */}
                        <div className={cn(META_COL_CELL_CLASS, isMobile && "py-0")}>
                            <div className="inline-flex items-center justify-center gap-1 text-white/50">
                                <ListTree className="h-3.5 w-3.5 shrink-0" />
                                <span className={COUNT_NUMBER_CLASS}>{task.subTaskCount ?? 0}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Subtask loading skeleton (first page load) ─────────────── */}
                {loadingSubtaskIds.has(taskId) && (
                    <div className="flex flex-col gap-1 py-1" style={{ paddingLeft: `${indentPx + (isMobile ? 40 : 56)}px` }}>
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-4 py-2 opacity-50">
                                <Skeleton className="h-4 w-4 rounded" />
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-4 w-24 ml-auto" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        ))}
                    </div>
                )}

                    </div>
                </div>

                {/*
                 * ── Expanded subtask block ──────────────────────────────────────
                 * Renders existing subtask rows recursively, then:
                 *   1. A "load more" sentinel div for infinite scroll pagination
                 *   2. A subtle spinner row while the next page is loading
                 */}
                {isSubtasksVisible && (
                    <div className="relative w-full">
                        {/* Vertical nesting guide line */}
                        <div
                            className="absolute top-0 bottom-0 w-[1px] bg-[#e5e7eb15]"
                            style={{ left: `${indentPx + (isMobile ? 27 : 39)}px` }}
                        />
                        {/* Existing subtask rows rendered recursively */}
                        {(task.subtasks ?? []).map((subtask) => renderTaskRow(subtask, depth + 1, groupId))}

                        {/*
                         * Infinite scroll sentinel — sits at the bottom of the
                         * rendered subtask list. IntersectionObserver fires when
                         * it scrolls into view and fetches the next page.
                         * Only rendered when there are more pages to load.
                         */}
                        {hasMoreSubtasks && (
                            <div
                                ref={registerSubtaskSentinel(taskId)}
                                data-task-id={taskId}
                                className="h-px w-full"
                                aria-hidden="true"
                            />
                        )}

                        {/* Loading indicator for subsequent pages */}
                        {isLoadingMoreSubtasks && (
                            <div
                                className="flex items-center gap-2 py-2 text-[13px] text-white/30"
                                style={{ paddingLeft: `${(depth + 1) * (isMobile ? 16 : 24) + (isMobile ? 40 : 56)}px` }}
                            >
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading subtasks…</span>
                            </div>
                        )}


                    </div>
                )}
            </div>
        );
    };

    // ─── Sub-components ───────────────────────────────────────────────────────

    const ColumnHeader: React.FC<{ label: string; align?: "left" | "center" | "right" }> = ({ label, align = "left" }) => (
        <div className={`flex w-full items-center gap-1 ${LIST_VIEW_TEXT} font-semibold uppercase tracking-wider text-white/50 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
            <span>{label}</span>
        </div>
    );

    const BulkActionButton = React.forwardRef<HTMLButtonElement, { label: string; destructive?: boolean; onClick?: () => void; className?: string }>(
        ({ label, destructive, onClick, className, ...props }, ref) => (
            <button ref={ref} type="button" onClick={onClick}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[13px] font-semi shadow-sm transition hover:shadow ${destructive ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100" : "border-[#e5e7eb29] bg-[#0a0a0d] text-white/50 hover:bg-[#0a0a0d]"} ${className ?? ""}`}
                {...props}>{label}</button>
        )
    );
    BulkActionButton.displayName = "BulkActionButton";

    const BulkActionsToolbar: React.FC = () => {
        if (!hasCheckedTasks) return null;
        return (
            <div className="fixed inset-x-0 bottom-3 md:bottom-4 z-40 flex justify-center px-3 sm:px-6 lg:px-8">
                <div className="flex w-full max-w-5xl flex-col gap-2 rounded-2xl border border-[#e5e7eb29] bg-[#0a0a0d] px-3 py-2 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between md:rounded-full md:gap-3">
                    <div className="flex items-center gap-2 text-[13px] text-white/50 shrink-0">
                        <CheckSquare className="h-4 w-4 text-white/50" />
                        <span className="font-semi">{checkedTaskIds.size} selected</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-0.5 md:pb-0">
                        <StatusPicker onSelect={(s) => applyUpdaterToCheckedTasks((t) => ({ ...t, status: s as TaskStatus }))}>
                            <BulkActionButton label="Status" />
                        </StatusPicker>
                        <AssigneePicker onSelect={(ids) => applyUpdaterToCheckedTasks((t) => ({ ...t, assignee: ids[0] || "", assignedToIds: ids }))}>
                            <BulkActionButton label="Assignee" />
                        </AssigneePicker>
                        <CustomDatePicker defaultTab="due" onSelect={({ start, due }) => {
                            applyUpdaterToCheckedTasks((t) => ({
                                ...t,
                                ...(start ? { startDate: formatDateDisplay(start) } : {}),
                                dueDate: due ? formatDateDisplay(due) : t.dueDate,
                            }));
                        }}>
                            <BulkActionButton label="Due date" />
                        </CustomDatePicker>
                        <PriorityPicker onSelect={(p) => applyUpdaterToCheckedTasks((t) => ({ ...t, priority: p }))}>
                            <BulkActionButton label="Priority" />
                        </PriorityPicker>
                        <BulkActionButton label="Tags" />
                        <BulkActionButton label="Move to list" className="hidden sm:inline-flex" />
                        <BulkActionButton label="Convert to subtask" className="hidden lg:inline-flex" />
                        <BulkActionButton label="Archive" className="hidden md:inline-flex" />
                        <BulkActionButton label="Delete" destructive />
                        <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semi text-white/50 hover:bg-[#0a0a0d] md:hidden">
                            More <MoreHorizontal className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ─── Main render ──────────────────────────────────────────────────────────

    return (
        <section
            className={cn(
                "flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0a0a0d]",
                LIST_VIEW_TEXT,
                "[&_input]:text-[13px] [&_input::placeholder]:text-[13px]",
                "[&_textarea]:text-[13px] [&_textarea::placeholder]:text-[13px]",
                "[&_button]:text-[13px]",
                "[&_[role=menuitem]]:text-[13px]"
            )}
        >
            {/* Column header — fixed above scroll area */}
            {sortedStatuses?.length > 0 && (
                <div
                    ref={headerScrollRef}
                    onScroll={handleHeaderHorizontalScroll}
                    className="hidden md:block shrink-0 mt-4 overflow-x-auto bg-[#161616] border-b border-white/5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    <div
                        className="grid"
                        style={{ gridTemplateColumns: gridTemplate, minWidth: listGridMinWidth }}
                    >
                        <div
                            className="sticky z-50 bg-[#161616] px-2 pl-8 py-2.5 min-w-0 overflow-hidden"
                            style={{ left: 0, boxShadow: "12px 0 14px -14px rgba(15,23,42,0.35)" }}
                        >
                            <ColumnHeader label="Name" />
                        </div>
                        <div className="px-2 py-2.5"><ColumnHeader label="Assignee" /></div>
                        <div className="px-2 py-2.5"><ColumnHeader label="Due date" /></div>
                        <div className="px-2 py-2.5"><ColumnHeader label="Priority" /></div>
                        <div className="px-2 py-2.5"><ColumnHeader label="Tags" /></div>
                        {customColumns.map((col) => (
                            <div key={col.id} className="px-2 py-2.5">
                                <span className="flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider text-white/50">{col.name}</span>
                            </div>
                        ))}
                        <div className={META_COL_HEADER_CLASS}>
                            <ColumnHeader label="Comments" align="center" />
                        </div>
                        <div className={META_COL_HEADER_CLASS}>
                            <ColumnHeader label="Subtasks" align="center" />
                        </div>
                    </div>
                </div>
            )}

            <div
                ref={mainListScrollRef}
                onScroll={handleListScroll}
                className="relative flex-1 min-h-0 mt-4 md:mt-0 overflow-y-auto overflow-x-hidden bg-[#0a0a0d] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-20"
            >
                {sortedStatuses?.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-8">
                        <p className="text-[13px] text-white/50">No columns yet. Click "Add task" to get started!</p>
                    </div>
                ) : (
                    <div className="flex flex-col w-full">
                        {sortedStatuses?.map((group, stageIndex) => {
                                    const groupId = group._id ?? group.id;
                                    const groupTasks = group.cards ?? group.columns ?? [];
                                    const isGroupExpanded = collapsedGroupIds[groupId] !== true;
                                    const showNewTaskDraftInThisGroup = newTaskDraft && (
                                        newTaskDraft.targetGroupId === groupId ||
                                        (newTaskDraft.targetGroupId === "quick-add" && (columns[0]?._id ?? columns[0]?.id) === groupId)
                                    );

                                    // ── Dynamic stage colors (same system as KanbanColumn) ──────────
                                    const stageColor = group.color || "#8b5cf6";

                                    return (
                                        <React.Fragment key={groupId}>
                                            {/* Group header */}


                                            {/* Stage section */}
                                            <div className="w-full">
                                                {/* Sticky stage bar — full width, stays pinned while scrolling */}
                                                <div
                                                    className={cn(
                                                        "sticky top-0 z-30 w-full bg-transparent px-3 md:px-6 py-2 border-b border-white/5",
                                                        stageIndex === 0 ? "mt-0" : "mt-0"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[13px] w-full min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleGroupExpanded(groupId)}
                                                            className="inline-flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 max-w-full"
                                                        >
                                                            {isGroupExpanded ? (
                                                                <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
                                                            ) : (
                                                                <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
                                                            )}
                                                            <span
                                                                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 py-1 min-w-0 max-w-[calc(100vw-5.5rem)] sm:max-w-none"
                                                                style={{ backgroundColor: stageColor }}
                                                            >
                                                                <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                                                                <span className="text-[13px] font-semibold text-white truncate">
                                                                    {group.name ?? group.status}
                                                                </span>
                                                            </span>
                                                            <span className={COUNT_BADGE_CLASS}>
                                                                {group.localCardCount ?? group.taskCount ?? 0}
                                                            </span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {isGroupExpanded && (
                                                    <>
                                                        {groupTasks.map((task) => renderTaskRow(task, 0, groupId))}

                                                        {(group.taskCount || 0) > (groupTasks.length || 0) && (
                                                            <div
                                                                ref={registerGroupSentinel(groupId)}
                                                                className="flex items-center justify-center text-[13px] text-white/40"
                                                            >
                                                                {loadingStageId === groupId ? (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                        Loading more tasks…
                                                                    </span>
                                                                ) : ""}
                                                            </div>
                                                        )}

                                                        {showNewTaskDraftInThisGroup && newTaskDraft && (
                                                            <div className="w-full border-t border-white/5">
                                                                <InlineDraftRow
                                                                    draftName={newTaskDraft.taskName}
                                                                    onNameChange={(name) => setNewTaskDraft({ ...newTaskDraft, taskName: name })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") { e.preventDefault(); submitNewTask(); }
                                                                        else if (e.key === "Escape") { e.preventDefault(); cancelNewTask(); }
                                                                    }}
                                                                    onSave={submitNewTask}
                                                                    onCancel={cancelNewTask}
                                                                    assigneeId={newTaskDraft.assigneeId}
                                                                    onAssigneeChange={(id) => setNewTaskDraft({ ...newTaskDraft, assigneeId: id })}
                                                                    priority={newTaskDraft.priority}
                                                                    onPriorityChange={(p) => setNewTaskDraft({ ...newTaskDraft, priority: p })}
                                                                    startDate={newTaskDraft.startDate}
                                                                    dueDate={newTaskDraft.dueDate}
                                                                    onDateChange={(start, due) => setNewTaskDraft({ ...newTaskDraft, startDate: start, dueDate: due })}
                                                                    tags={newTaskDraft.tags}
                                                                    onTagsChange={(ids) => setNewTaskDraft({ ...newTaskDraft, tags: ids })}
                                                                    roomId={roomId}
                                                                    spaceId={spaceId}
                                                                />
                                                            </div>
                                                        )}

                                                        {!isReadOnly && !showNewTaskDraftInThisGroup && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openNewTaskForm(groupId)}
                                                                className="flex w-full items-center gap-2 px-3 md:px-6 md:pl-8 py-2.5 text-[13px] text-white/50 hover:text-white/70 transition-colors border-t border-white/5 cursor-pointer touch-manipulation"
                                                            >
                                                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                                                <span>Add Task</span>
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {/* Add new status — matches kanban-column stage popover */}
                                <div className="mt-4 md:mt-6 mb-2 px-3 md:px-4 relative">
                                    {!isAddingStageInline ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isReadOnly) return;
                                                setIsAddingStageInline(true);
                                                setNewStageInlineName("");
                                            }}
                                            className="inline-flex items-center cursor-pointer gap-2 text-[13px] text-white hover:text-white"
                                            disabled={isReadOnly}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            <span>New status</span>
                                        </button>
                                    ) : (
                                        <div className="relative">
                                            <div
                                                className="w-[calc(100vw-1.5rem)] max-w-sm md:w-64 rounded-xl shadow-2xl border overflow-hidden"
                                                style={{
                                                    backgroundColor: "rgba(18, 18, 26, 0.97)",
                                                    borderColor: newStageInlineColor,
                                                    backdropFilter: "blur(20px)",
                                                }}
                                            >
                                                <div
                                                    className="px-2 py-3 pb-0 flex items-center justify-between"
                                                    style={{ borderColor: newStageInlineColor }}
                                                >
                                                    <span className="text-[13px] font-semibold text-white/90 tracking-wide">Add Status</span>
                                                    <button
                                                        type="button"
                                                        onClick={cancelNewStage}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors text-base leading-none cursor-pointer"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                <div className="p-3 pt-0 space-y-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[13px] mb-1 font-semibold text-white/40 uppercase tracking-widest">
                                                            Status Name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={newStageInlineName}
                                                            onChange={(e) => setNewStageInlineName(e.target.value)}
                                                            autoFocus
                                                            placeholder="Enter status name..."
                                                            className="w-full px-3 py-2 rounded-lg placeholder:text-[13px] text-[13px] text-white bg-white/5 border border-white/10 focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") submitNewStage();
                                                                if (e.key === "Escape") cancelNewStage();
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-semibold text-white/40 uppercase tracking-widest">
                                                            Status Color
                                                        </label>
                                                        <div className="grid grid-cols-12 gap-1.5">
                                                            {STAGE_PRESET_COLORS.map((color) => (
                                                                <button
                                                                    key={color}
                                                                    type="button"
                                                                    onClick={() => setNewStageInlineColor(color)}
                                                                    className="w-4 h-4 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 flex items-center justify-center"
                                                                    style={{
                                                                        backgroundColor: color,
                                                                        boxShadow: newStageInlineColor === color
                                                                            ? `0 0 0 2px #12121a, 0 0 0 3.5px ${color}`
                                                                            : "none",
                                                                    }}
                                                                    title={color}
                                                                >
                                                                    {newStageInlineColor === color && (
                                                                        <svg className="w-3.5 h-3.5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                            <polyline points="20 6 9 17 4 12" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        <div
                                                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer hover:border-white/20 transition-colors"
                                                            style={{ borderColor: newStageInlineColor, backgroundColor: "rgba(255,255,255,0.03)" }}
                                                            onClick={() => document.getElementById("listview-add-status-color-picker")?.click()}
                                                        >
                                                            <div
                                                                className="w-6 h-6 rounded-md flex-shrink-0 border border-white/20"
                                                                style={{ backgroundColor: newStageInlineColor }}
                                                            />
                                                            <span className="text-[13px] text-white/50 flex-1">Custom color</span>
                                                            <span className="text-[13px] font-mono text-white/30">{newStageInlineColor.toUpperCase()}</span>
                                                            <input
                                                                id="listview-add-status-color-picker"
                                                                type="color"
                                                                value={newStageInlineColor}
                                                                onChange={(e) => setNewStageInlineColor(e.target.value)}
                                                                className="sr-only"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    className="px-4 py-3 flex items-center justify-end gap-2 border-t"
                                                    style={{ borderColor: newStageInlineColor }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={cancelNewStage}
                                                        className="px-3 cursor-pointer py-1.5 rounded-lg text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors border border-[#e5e7eb0f]"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={submitNewStage}
                                                        disabled={!newStageInlineName.trim() || isCreatingStageInline}
                                                        className="px-4 cursor-pointer py-1.5 rounded-lg text-[13px] font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                                        style={{ backgroundColor: newStageInlineColor }}
                                                    >
                                                        {isCreatingStageInline ? "Creating..." : "Add status"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                    </div>
                )}
            </div>

            <BulkActionsToolbar />

            {showModal && (
                <CardModal
                    connected={false}
                    updateTaskAndCardCounts={updateTaskAndCardCounts}
                    card={activeCard}
                    userId={"userId"}
                    onClose={() => setShowModal(false)}
                    boardId={roomId}
                    orgId={"orgId"}
                    setColumns={setColumns}
                    isReadOnly={isReadOnly}
                />
            )}
        </section>
    );
};