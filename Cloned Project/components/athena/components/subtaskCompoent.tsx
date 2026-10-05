import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AssigneePicker } from "./assignee-picker";
import { CustomDatePicker } from "./custom-date-picker";
import { PriorityPicker } from "./priority-picker";
import { TagPicker } from "./tag-picker";
import { toast } from "sonner"

import {
    X, Trash2, Tag, Users, Calendar, CheckSquare, Paperclip, Plus, PlayCircle, Flag,
    AlignLeft, Check, Copy, Archive, Clock, CreditCard, ChevronDown, CalendarRange, Download, Eye, ChevronLeft,
    MoreHorizontal, Bell, Link2, Timer, Zap, Hash, Maximize2, ChevronRight, CircleDot, AlignJustify
} from "lucide-react"
import { CardModal } from "./card-modal"
import { useDashboardStore } from "@/store/athena/dashboardStore";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";
import { tree } from "next/dist/build/templates/app-page";
const INDENT_STEPS = [0, 22, 44, 66, 88, 110, 132, 154, 176, 198, 220];
const clampIndentStep = (px) => {
    const index = Math.round((px || 0) / 22);
    return Math.max(0, Math.min(index, INDENT_STEPS.length - 1));
};
const INDENT_WIDTH_CLASS = [
    "w-0", "w-[22px]", "w-[44px]", "w-[66px]", "w-[88px]", "w-[110px]",
    "w-[132px]", "w-[154px]", "w-[176px]", "w-[198px]", "w-[220px]",
];
const EDIT_INDENT_CLASS = [
    "pl-2", "pl-[30px]", "pl-[52px]", "pl-[74px]", "pl-[96px]", "pl-[118px]",
    "pl-[140px]", "pl-[162px]", "pl-[184px]", "pl-[206px]", "pl-[228px]",
];


const TASKROOM_API_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "https://uatapi.garage.app/taskroomv2/v2/";

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconCircle = ({ checked = false }) => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
        {checked ? (
            <>
                <circle cx="8" cy="8" r="7" stroke="#7c3aed" strokeWidth="1.5" fill="rgba(124,58,237,0.15)" />
                <path d="M5 8l2 2 4-4" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </>
        ) : (
            <circle cx="8" cy="8" r="7" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
        )}
    </svg>
);

const IconChevron = ({ open }) => (
    <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"}`}
    >
        <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IconPlus = () => (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

const IconTrash = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M2 4h10M5 4V2.5h4V4M5.5 7v4M8.5 7v4M3 4l.8 8h6.4L11 4"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IconEdit = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const IconSubtask = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M2 2v7h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="5" y="7" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
);

const IconFlag = ({ className = "" }) => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M3 2v12M3 2h9l-2.5 4L12 10H3"
            stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none" />
    </svg>
);

const IconTag = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M2 2h5.5l6.5 6.5-5 5L2.5 7V2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
    </svg>
);

const IconCalendar = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

const IconUsers = () => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M1.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M14.5 13c0-1.8-1.1-3-2.5-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

const IconSort = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

const IconSuggest = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="#a78bfa" strokeWidth="1.3" />
        <path d="M5 5.5C5 4.1 6 3.5 7 3.5s2 .7 2 1.7c0 1-1 1.5-1.5 2V8.5" stroke="#a78bfa" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="10.5" r=".6" fill="#a78bfa" />
    </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITIES = [
    { value: "urgent", label: "Urgent", color: "#ef4444" },
    { value: "high", label: "High", color: "#f59e0b" },
    { value: "normal", label: "Normal", color: "#3b82f6" },
    { value: "medium", label: "Medium", color: "#3b82f6" },
    { value: "low", label: "Low", color: "rgba(255,255,255,0.3)" },
];


const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null;

const normalizeTask = (task) => ({
    _id: task?._id || `${Math.random()}`,
    title: task?.title || task?.name || "Untitled task",
    isCompleted: !!task?.isCompleted,
    assignedToIds: Array.isArray(task?.assigneeData) ? task.assigneeData : [],
    priority: task?.priority || "",
    tags: Array.isArray(task?.tagData) ? task.tagData : [],
    startDate: task?.startDate ?? null,
    dueDate: task?.dueDate ?? null,
    subTaskCount:
        typeof task?.subTaskCount === "number"
            ? task.subTaskCount
            : (typeof task?.TaskDataCount?.totalChildCount === "number" ? task.TaskDataCount.totalChildCount : undefined),
    subtasks: Array.isArray(task?.subtasks) ? task?.subtasks?.map(normalizeTask) : [],
});

// Normalize into the shape `ListView.tsx` expects inside `columns`
const normalizeForDashboard = (task: any) => {
    const id = task?._id ?? `${Math.random()}`;
    const members = Array.isArray(task?.assigneeData)
        ? task.assigneeData
        : (Array.isArray(task?.members) ? task.members : []);
    const assignedToIds = Array.isArray(task?.assignedToIds)
        ? task.assignedToIds
        : (Array.isArray(members) ? members.map((m: any) => m?._id).filter(Boolean) : []);

    return {
        _id: id,
        id,
        name: task?.title ?? task?.name ?? "Untitled task",
        title: task?.title ?? task?.name ?? "Untitled task",
        members: Array.isArray(members) ? members : [],
        assignedToIds,
        tagData: Array.isArray(task?.tagData) ? task.tagData : [],
        tags: Array.isArray(task?.tags) ? task.tags : [],
        startDate: task?.startDate ?? null,
        dueDate: task?.dueDate ?? null,
        priority: task?.priority ?? "",
        isCompleted: !!task?.isCompleted,
        status: task?.status,
        type: task?.type ?? "subtask",
        parentId: task?.parentId,
        subTaskCount:
            typeof task?.subTaskCount === "number"
                ? task.subTaskCount
                : (typeof task?.TaskDataCount?.totalChildCount === "number" ? task.TaskDataCount.totalChildCount : 0),
        subtasks: Array.isArray(task?.subtasks) ? task.subtasks : [],
    };
};

// ─── Dashboard store tree helpers (mirror ListView behavior) ───────────────────
const updateTaskInTreeAny = (items: any[], taskId: string, updater: (t: any) => any): any[] =>
    (items || []).map((it) => {
        const itId = it?._id ?? it?.id;
        if (itId === taskId) return updater(it);
        const children = Array.isArray(it?.subtasks) ? it.subtasks : [];
        if (children.length > 0) return { ...it, subtasks: updateTaskInTreeAny(children, taskId, updater) };
        return it;
    });

const updateTaskInDashboardColumns = (cols: any[], taskId: string, updater: (t: any) => any): any[] =>
    (cols || []).map((col) => {
        // Most store shapes have `cards`, some have `columns`
        const cards = col?.cards ?? col?.columns ?? [];
        const nextCards = updateTaskInTreeAny(cards, taskId, updater);
        return {
            ...col,
            cards: col?.cards ? nextCards : col?.cards,
            columns: col?.columns ? nextCards : col?.columns,
        };
    });

// ─── EditRow (shared for new & edit) ─────────────────────────────────────────
function EditRow({ title, setTitle, assignees, setAssignees, priority, setPriority,
    tags, setTags, startDate, setStartDate, dueDate, setDueDate,
    onSave, onCancel, loading, indent = 0, placeholder = "Task name…", boardId, Idspace }) {
    const indentStep = clampIndentStep(indent);
    return (
        <div className={` py-[9px] pt-0 pr-[14px] animate-[slideIn_.14s_ease] ${EDIT_INDENT_CLASS[indentStep]} sticky left-0 z-20`}>
            {/* Absolute background element to simulate opacity layer inside sticky node */}
            <div className="absolute inset-0  pointer-events-none z-0" />
            <div className="relative z-10">
                <div className="flex items-center gap-2">

                    <input
                        autoFocus
                        className="flex-1 bg-transparent border-none outline-none placeholder:text-[12px] text-[12px] text-white/50 caret-brand placeholder:text-white/50"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={placeholder}
                        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
                    />
                </div>
                <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                        <AssigneePicker assignedToIds={assignees} onSelect={setAssignees}>
                            <button className={`relative flex items-center justify-center w-7 h-7 rounded-md border transition-all ${assignees.length > 0 ? "bg-brand/20 border-brand/40 text-brand" : "bg-white/5 border-white/10 text-white/50/35 hover:bg-white/10 hover:text-white/50 hover:border-white/20"}`} title="Assignees">
                                <IconUsers />
                                {assignees.length > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold bg-brand text-white/50 border border-[#e5e7eb29]] flex items-center justify-center">{assignees.length}</span>}
                            </button>
                        </AssigneePicker>

                        <CustomDatePicker
                            startDate={startDate ? new Date(startDate) : undefined}
                            dueDate={dueDate ? new Date(dueDate) : undefined}
                            onSelect={({ start, due }) => {
                                setStartDate(start ? start.getTime() : null);
                                setDueDate(due ? due.getTime() : null);
                            }}
                        >
                            <button className={`relative flex items-center justify-center w-7 h-7 rounded-md border transition-all ${dueDate ? "bg-brand/20 border-brand/40 text-brand" : "bg-white/5 border-white/10 text-white/50/35 hover:bg-white/10 hover:text-white/50 hover:border-white/20"}`} title="Date">
                                <IconCalendar />
                            </button>
                        </CustomDatePicker>

                        <PriorityPicker priority={priority} onSelect={setPriority}>
                            <button className={`relative flex items-center justify-center w-7 h-7 rounded-md border transition-all ${priority ? "bg-brand/20 border-brand/40 text-brand" : "bg-white/5 border-white/10 text-white/50/35 hover:bg-white/10 hover:text-white/50 hover:border-white/20"}`} title="Priority">
                                <IconFlag className={priority ? "text-white/50/35" : "text-white/50/35"} />
                            </button>
                        </PriorityPicker>

                        <TagPicker boardId={boardId} selectedTagIds={tags} onSelect={setTags} Idspace={Idspace}>
                            <button className={`relative flex items-center justify-center w-7 h-7 rounded-md border transition-all ${tags.length > 0 ? "bg-brand/20 border-brand/40 text-brand" : "bg-white/5 border-white/10 text-white/50/35 hover:bg-white/10 hover:text-white/50 hover:border-white/20"}`} title="Tags">
                                <IconTag />
                                {tags.length > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold bg-brand text-white/50 border border-[#e5e7eb29]] flex items-center justify-center">{tags.length}</span>}
                            </button>
                        </TagPicker>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button className="px-2.5 py-1.5 rounded-md border border-white/15 text-white/50/45 text-[12.5px] hover:bg-white/5 hover:text-white/50/75 transition-all" onClick={onCancel}>Cancel</button>
                        <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand text-brand-foreground text-[12.5px] font-medium hover:bg-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors" onClick={onSave} disabled={loading || !title.trim()}>
                            {loading ? "Saving…" : <>Save </>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── NewTaskRow ───────────────────────────────────────────────────────────────
function NewTaskRow({ roomId, stageId, parentId, rootId, indent = 0, onSave, onCancel, boardId, Idspace, cardId, onTaskAdded }) {
    const [title, setTitle] = useState("");
    const [assignees, setAssignees] = useState([]);
    const [priority, setPriority] = useState("");
    const [tags, setTags] = useState([]);
    const [startDate, setStartDate] = useState(null);
    const [dueDate, setDueDate] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!title.trim()) return;

        setLoading(true);
        const token = localStorage.getItem("garage_tok");
        try {
            const response = await fetch(`${TASKROOM_API_URL}tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: title.trim(), roomId, stageId,
                    assignedToIds: assignees, priority: priority || undefined,
                    tags, startDate: startDate || undefined, dueDate: dueDate || undefined,
                    parentId: parentId || cardId, rootId: rootId || cardId
                }),
            });
            if (!response.ok) throw new Error("Failed to create task");

            const result = await response.json();
            if (result?.status && result.data) {
                console.log("onTaskAdded", result.data)
                if (onTaskAdded) {
                    onTaskAdded(result.data);
                }
                setTitle("");
                setAssignees([]);
                setPriority("");
                setTags([]);
                setStartDate(null);
                setDueDate(null);
                if (onSave) {
                    onSave(result.data);
                }
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <EditRow
            title={title} setTitle={setTitle}
            assignees={assignees} setAssignees={setAssignees}
            priority={priority} setPriority={setPriority}
            tags={tags} setTags={setTags}
            startDate={startDate} setStartDate={setStartDate}
            dueDate={dueDate} setDueDate={setDueDate}
            onSave={handleSave} onCancel={onCancel}
            loading={loading} indent={indent}
            boardId={boardId}
            Idspace={Idspace}
            placeholder="Task Name or type '/' for commands"
        />
    );
}
// ─── TaskRowSkeleton ───────────────────────────────────────────────────────────
function TaskRowSkeleton({ indent = 0 }) {
    const indentStep = clampIndentStep(indent);
    return (
        <div className="grid grid-cols-[minmax(250px,1fr)_120px_110px_145px_150px_72px] px-2 border-b border-white/[0.03] min-h-9 items-center group">
            {/* COL 1 */}
            <div className="flex items-center gap-2 py-[5px] pr-2 pl-0.5 sticky left-0 z-10 bg-[#e5e7eb29]]">
                <div className="absolute inset-0 bg-white/[0.012] pointer-events-none z-0" />
                <span className={`shrink-0 ${INDENT_WIDTH_CLASS[indentStep]} relative z-10`} />
                <div className="w-[18px] h-[18px] rounded bg-white/5 animate-pulse shrink-0 relative z-10" />
                <div className="w-[15px] h-[15px] rounded-full bg-white/5 animate-pulse shrink-0 relative z-10" />
                <div className="h-[14px] w-32 bg-white/5 rounded animate-pulse relative z-10" />
            </div>
            {/* COL 2 */}
            <div className="flex items-center justify-center py-[5px] px-2"><div className="w-[22px] h-[22px] rounded-full bg-white/5 animate-pulse" /></div>
            {/* COL 3 */}
            <div className="flex items-center justify-center py-[5px] px-2"><div className="w-12 h-4 rounded-[20px] bg-white/5 animate-pulse" /></div>
            {/* COL 4 */}
            <div className="flex items-center justify-center py-[5px] px-2"><div className="w-16 h-3 rounded bg-white/5 animate-pulse" /></div>
            {/* COL 5 */}
            <div className="flex items-center justify-center py-[5px] px-2"><div className="w-12 h-4 rounded-[20px] bg-white/5 animate-pulse" /></div>
            {/* COL 6 */}
            <div className="flex items-center justify-center gap-1 py-[5px] px-2">
                <div className="w-[22px] h-[22px] rounded-[5px] bg-white/5 animate-pulse" />
                <div className="w-[22px] h-[22px] rounded-[5px] bg-white/5 animate-pulse" />
                <div className="w-[22px] h-[22px] rounded-[5px] bg-white/5 animate-pulse" />
            </div>
        </div>
    );
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────
function TaskRow({ task: initialTask, depth = 0, roomId, stageId, rootId, boardId, Idspace, cardId, onDelete, scrollRoot = null, isReadOnly = false }) {
    const [localTask, setLocalTask] = useState(initialTask);
    const [subtasks, setSubtasks] = useState(initialTask.subtasks || []);
    const [isDeleted, setIsDeleted] = useState(false);
    const columns = useDashboardStore((state) => state.columns);
    const setColumns = useDashboardStore((state) => state.setColumns);
    console.log("subtasks", initialTask)
    useEffect(() => {
        setLocalTask(initialTask);
        setSubtasks(initialTask.subtasks || []);
    }, [initialTask]);

    const [expanded, setExpanded] = useState(false);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [loadingMoreSubtasks, setLoadingMoreSubtasks] = useState(false);
    const [subtaskPage, setSubtaskPage] = useState(0);
    const [subtaskTotalPages, setSubtaskTotalPages] = useState(1);
    const subtaskSentinelRef = useRef<HTMLDivElement | null>(null);
    const subtaskObserverRef = useRef<IntersectionObserver | null>(null);
    const subtaskFetchInFlightRef = useRef(false);
    const [addingSub, setAddingSub] = useState(false);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [eTitle, setETitle] = useState(localTask.title);
    const [eAssign, setEAssign] = useState(localTask.assignedToIds || []);
    const [ePriority, setEPriority] = useState(localTask.priority || "");
    const [eTags, setETags] = useState(localTask.tags || []);
    const [eStart, setEStart] = useState(localTask.startDate || null);
    const [eDue, setEDue] = useState(localTask.dueDate || null);

    const assignUsers = localTask.assignedToIds;
    const indent = depth * 22;
    const indentStep = clampIndentStep(indent);
    const effectiveRoot = rootId;
    const hasSubtasks = (localTask?.subTaskCount ?? subtasks?.length ?? 0) > 0;
    const hasMoreSubtasks = subtaskPage > 0 && subtaskPage < subtaskTotalPages;
    //   const effectiveRoot = rootId || localTask._id;

    const fetchSubtaskPage = useCallback(
        async (taskId: string, page: number) => {
            if (!taskId) return false;
            if (subtaskFetchInFlightRef.current) return false;
            subtaskFetchInFlightRef.current = true;

            // page 1 uses legacy skeleton state; next pages use a small spinner
            if (page === 1) setLoadingSubtasks(true);
            else setLoadingMoreSubtasks(true);

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
                const fetched: any[] = json?.data ?? [];
                const metadata = json?.metadata ?? {};
                const totalPages: number = metadata?.totalPages ?? 1;
                const currentPage: number = metadata?.currentPage ?? page;

                setSubtaskPage(currentPage);
                setSubtaskTotalPages(totalPages);

                const normalized = fetched.map(normalizeTask);
                setSubtasks((prev: any[]) => {
                    if (page === 1) return normalized;
                    const existingIds = new Set(prev.map((t) => t?._id));
                    return [...prev, ...normalized.filter((n: any) => !existingIds.has(n?._id))];
                });

                // Keep parent count concept aligned with ListView (prefer server count when present)
                setLocalTask((prev: any) => {
                    const prevCount = typeof prev?.subTaskCount === "number" ? prev.subTaskCount : (prev?.subtasks?.length ?? 0);
                    const nextCount =
                        typeof initialTask?.subTaskCount === "number"
                            ? initialTask.subTaskCount
                            : (typeof prev?.subTaskCount === "number" ? prev.subTaskCount : prevCount);
                    return { ...prev, subTaskCount: typeof nextCount === "number" ? nextCount : prevCount };
                });

                return currentPage < totalPages;
            } catch (e) {
                console.error("Failed to fetch subtasks on expand", e);
                return false;
            } finally {
                subtaskFetchInFlightRef.current = false;
                setLoadingSubtasks(false);
                setLoadingMoreSubtasks(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialTask?.subTaskCount]
    );

    useEffect(() => {
        if (!expanded) return;
        if (!hasMoreSubtasks) return;
        const el = subtaskSentinelRef.current;
        if (!el) return;

        if (subtaskObserverRef.current) {
            subtaskObserverRef.current.disconnect();
        }

        subtaskObserverRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                if (subtaskFetchInFlightRef.current) return;
                fetchSubtaskPage(localTask._id, subtaskPage + 1).then((more) => {
                    if (!more && subtaskSentinelRef.current) {
                        subtaskObserverRef.current?.unobserve(subtaskSentinelRef.current);
                    }
                });
            },
            { root: scrollRoot ?? null, threshold: 0.15, rootMargin: "220px" }
        );

        subtaskObserverRef.current.observe(el);
        return () => subtaskObserverRef.current?.disconnect();
    }, [expanded, fetchSubtaskPage, hasMoreSubtasks, localTask._id, scrollRoot, subtaskPage]);

    const handleToggle = async () => {
        const token = localStorage.getItem("garage_tok");
        if (!token) { toast.error("Authentication token missing"); return }
        try {
            const response = await fetch(`${TASKROOM_API_URL}tasks/${localTask._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ isCompleted: !localTask.isCompleted }),
            });
            const result = await response.json();
            if (result?.status) {
                // If API returns data, use it; otherwise toggle optimistically
                if (result.data) {
                    const normalized = normalizeTask(result.data);
                    setLocalTask((prev: any) => ({
                        ...prev,
                        ...normalized,
                        subTaskCount: typeof normalized?.subTaskCount === "number" ? normalized.subTaskCount : prev?.subTaskCount,
                    }));
                } else {
                    // Optimistic update: toggle the completion state
                    setLocalTask((prev: any) => ({
                        ...prev,
                        isCompleted: !prev.isCompleted,
                    }));
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this task?")) return;
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${TASKROOM_API_URL}tasks/${localTask._id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            const result = await response.json();
            if (result?.status) {
                setIsDeleted(true);
                if (onDelete) onDelete(localTask._id);
            }
        } catch (e) { console.error(e); }
    };

    const handleEditSave = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${TASKROOM_API_URL}tasks/${localTask._id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: eTitle, assignedToIds: eAssign,
                    priority: ePriority, tags: eTags, startDate: eStart, dueDate: eDue,
                }),
            });
            const result = await response.json();
            if (result?.status && result.data) {
                const normalized = normalizeTask(result.data);
                setLocalTask((prev: any) => ({
                    ...prev,
                    ...normalized,
                    subTaskCount: typeof normalized?.subTaskCount === "number" ? normalized.subTaskCount : prev?.subTaskCount,
                }));
            }
            setEditing(false);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const updateTaskAndCardCounts = () => {

    }
    if (isDeleted) return null;



    if (editing) {
        return (
            <>
                <EditRow
                    title={eTitle} setTitle={setETitle}
                    assignees={eAssign} setAssignees={setEAssign}
                    priority={ePriority} setPriority={setEPriority}
                    tags={eTags} setTags={setETags}
                    startDate={eStart} setStartDate={setEStart}
                    dueDate={eDue} setDueDate={setEDue}
                    onSave={handleEditSave} onCancel={() => setEditing(false)}
                    loading={loading} indent={indent}
                    boardId={boardId}
                    Idspace={Idspace}
                />
                {subtasks.map((s) => (
                    <TaskRow key={s._id} task={s} depth={depth + 1} roomId={roomId} stageId={stageId} rootId={effectiveRoot} boardId={boardId} cardId={cardId} Idspace={Idspace} onDelete={(deletedId) => setSubtasks(prev => prev.filter(st => st._id !== deletedId))} />
                ))}
            </>
        );
    }
    const normalized = {
        ...localTask,                    // shallow copy

        name: localTask.title,

        // delete any old fields you don't want (optional)
        // startDateMs: undefined,   // if you want to clean up
        // ttitle: undefined,
    };
    return (
        <>
            <div className="grid grid-cols-[minmax(250px,1fr)_120px_110px_145px_150px_72px] px-2 border-b border-white/[0.03] min-h-9 transition-colors group hover:bg-[#14141d]">

                {/* COL 1 — Name */}
                <div className="flex items-center cursor-pointer gap-1 py-[5px] pr-2 pl-0.5 min-w-0 sticky left-0 z-10 bg-[#e5e7eb29]] group-hover:bg-[#14141d]"

                >
                    <span className={`shrink-0 ${INDENT_WIDTH_CLASS[indentStep]}`} />
                    <button className="flex items-center justify-center w-[18px] h-[18px] shrink-0 bg-transparent border-none text-white/50/25 rounded transition-colors hover:text-white/50 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none"
                        onClick={async () => {
                            if (!hasSubtasks && subtasks.length === 0) return;
                            const willExpand = !expanded;
                            setExpanded(willExpand);
                            // Only fetch page 1 if we haven't fetched any pages yet
                            if (willExpand && subtasks.length === 0 && subtaskPage === 0 && localTask._id) {
                                fetchSubtaskPage(localTask._id, 1);
                            }
                        }}
                        aria-hidden={false}
                        disabled={!hasSubtasks && subtasks.length === 0}
                    >
                        <IconChevron open={expanded} />
                    </button>
                    <button className="complete-btn" onClick={handleToggle}>
                        <IconCircle checked={localTask.isCompleted} />
                    </button>
                    <span className={`text-[13px] text-white/50 whitespace-normal break-words flex-1 min-w-0 ${localTask.isCompleted ? "line-through opacity-35" : ""}`}
                        onClick={() => setShowModal(true)}
                    >
                        {localTask.title}
                    </span>
                </div>

                {/* COL 2 — Assignee */}
                <div className="flex items-center justify-center py-[5px] px-2">
                    {assignUsers && assignUsers.length > 0 ? (
                        <div className="flex">
                            {assignUsers.slice(0, 3).map((u) => (
                                <span key={u._id || u.id || u} className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold text-white/50 border border-[#e5e7eb29]  shrink-0 first:ml-0 -ml-[5px] `} title={u.name || "User"}>{u.name ? u.name[0].toUpperCase() : "?"}</span>
                            ))}
                            {assignUsers.length > 3 && (
                                <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] bg-white/15 text-white/50 border-[1.5px] border-[#e5e7eb29]] shrink-0 -ml-[5px]">+{assignUsers.length - 3}</span>
                            )}
                        </div>
                    ) : <span className="text-white/50/15 text-[13px]">—</span>}
                </div>

                {/* COL 3 — Priority */}
                <div className="flex items-center justify-center py-[5px] px-2">
                    {localTask.priority ? (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-[20px] text-[11px] font-medium whitespace-nowrap bg-white/10 border border-white/20`} style={{ color: PRIORITIES.find(p => p.value === localTask.priority)?.color || '#fff' }}>
                            <IconFlag />
                            <span className="capitalize">{localTask.priority}</span>
                        </span>
                    ) : <span className="text-white/50/15 text-[13px]">—</span>}
                </div>

                {/* COL 4 — Date */}
                <div className="flex items-center justify-center py-[5px] px-2">
                    {localTask.dueDate ? (
                        <span className="flex items-center gap-[5px] text-[11px] text-white/50/45 whitespace-nowrap">
                            <IconCalendar />
                            <span>
                                {localTask.startDate ? `${fmtDate(localTask.startDate)} – ${fmtDate(localTask.dueDate)}` : fmtDate(localTask.dueDate)}
                            </span>
                        </span>
                    ) : <span className="text-white/50/15 text-[13px]">—</span>}
                </div>

                {/* COL 5 — Tags */}
                <div className="flex items-center justify-center py-[5px] px-2">
                    {(localTask.tags || []).length > 0 ? (
                        <div className="flex gap-[3px] shrink-0 flex-wrap justify-center">
                            {(localTask.tags || []).map((t) => {
                                return t ? (
                                    <span key={t._id || t.id || t} className={`text-[10px] px-1.5 py-0.5 rounded-[5px] font-medium whitespace-nowrap bg-opacity-20 text-white/50 ${t.color || "bg-white/10 border border-white/15"}`}>
                                        {t.name || t.label || t}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    ) : <span className="text-white/50/15 text-[13px]">—</span>}
                </div>

                {/* COL 6 — Actions */}
                <div className="flex items-center justify-center gap-px py-[5px] px-2 [&>button]:opacity-0 hover:[&>button]:opacity-100">
                    {/* <button className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] text-white/50/35 hover:bg-white/10 hover:text-white/50 transition-all" title="Edit" ><IconEdit /></button> */}
                    {!isReadOnly && (
                    <button className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] text-white/50/35 hover:bg-white/10 hover:text-white/50 transition-all" title="Add subtask"
                        onClick={() => { setExpanded(true); setAddingSub(true); }}>
                        <IconSubtask />
                    </button>
                    )}
                    <button className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] text-white/50/35 hover:bg-red-500/20 hover:text-red-400 transition-all" title="Delete" onClick={handleDelete}><IconTrash /></button>
                </div>
            </div>

            {/* Subtasks */}
            {expanded && subtasks.map((s) => (
                <TaskRow
                    key={s._id}
                    task={s}
                    depth={depth + 1}
                    roomId={roomId}
                    stageId={stageId}
                    cardId={cardId}
                    rootId={effectiveRoot}
                    boardId={boardId}
                    Idspace={Idspace}
                    scrollRoot={scrollRoot}
                    isReadOnly={isReadOnly}
                    onDelete={(deletedId) => {
                        setSubtasks((prev) => prev.filter((st) => st._id !== deletedId));
                        setLocalTask((prev: any) => {
                            const prevCount = typeof prev?.subTaskCount === "number" ? prev.subTaskCount : (subtasks?.length ?? 0);
                            return { ...prev, subTaskCount: Math.max(0, prevCount - 1) };
                        });

                        // Keep dashboard store in sync (decrement count + remove child)
                        setColumns((prev: any[]) =>
                            updateTaskInDashboardColumns(prev, localTask._id, (t) => ({
                                ...t,
                                subTaskCount: Math.max(
                                    0,
                                    (typeof t?.subTaskCount === "number" ? t.subTaskCount : (t?.subtasks?.length ?? 0)) - 1
                                ),
                                subtasks: (t?.subtasks ?? []).filter((st: any) => (st?._id ?? st?.id) !== deletedId),
                            }))
                        );
                    }}
                />
            ))}

            {/* Skeleton Loading Subtasks */}
            {expanded && loadingSubtasks && (
                <TaskRowSkeleton indent={indent + 22} />
            )}

            {/* Infinite scroll sentinel for nested subtasks */}
            {expanded && hasMoreSubtasks && (
                <div ref={subtaskSentinelRef} className="h-px w-full" aria-hidden="true" />
            )}

            {expanded && loadingMoreSubtasks && (
                <div className="px-2 py-2 text-[11px] text-white/50/35" style={{ paddingLeft: `${indent + 44}px` }}>
                    Loading subtasks…
                </div>
            )}

            {/* Add subtask input — ONLY shown on explicit click */}
            {addingSub && !isReadOnly && (
                <NewTaskRow
                    roomId={roomId} stageId={stageId}
                    parentId={localTask._id} rootId={effectiveRoot}
                    indent={indent + 22}
                    boardId={boardId}
                    Idspace={Idspace}
                    cardId={cardId}
                    onTaskAdded={(newTask) => {
                        if (newTask) {
                            const normalized = normalizeForDashboard(newTask);
                            // Newest first, same as the dashboard store copy below
                            setSubtasks((prev) => [normalized, ...prev.filter((st: any) => st?._id !== normalized?._id)]);
                            setLocalTask((prev: any) => ({
                                ...prev,
                                subTaskCount:
                                    (typeof prev?.subTaskCount === "number" ? prev.subTaskCount : (subtasks?.length ?? 0)) + 1,
                            }));

                            // Keep dashboard store in sync (ListView relies on this)
                            setColumns((prev: any[]) =>
                                updateTaskInDashboardColumns(prev, localTask._id, (t) => ({
                                    ...t,
                                    subTaskCount:
                                        (typeof t?.subTaskCount === "number" ? t.subTaskCount : (t?.subtasks?.length ?? 0)) + 1,
                                    subtasks: [normalized, ...(t?.subtasks ?? [])],
                                }))
                            );
                        }
                    }}
                    onSave={() => setAddingSub(false)}
                    onCancel={() => setAddingSub(false)}
                />
            )}

            {showModal && (
                <CardModal
                    connected={false}
                    updateTaskAndCardCounts={updateTaskAndCardCounts}
                    card={normalized as any}
                    userId={"userId"}
                    onClose={() => setShowModal(false)}
                    boardId={roomId}
                    orgId={"orgId"}
                    setColumns={setColumns}
                    isReadOnly={isReadOnly}
                    onCardPatched={(patch) => {
                        const patchId = (patch as any)?._id
                        if (!patchId) return

                        const applyPatchToTree = (items: any[]): any[] =>
                            (items || []).map((it) => {
                                const itId = it?._id ?? it?.id
                                if (itId === patchId) {
                                    const nextTitle = (patch as any).title ?? (patch as any).name ?? it.title ?? it.name
                                    return { ...it, ...patch, title: nextTitle, name: nextTitle }
                                }
                                if (Array.isArray(it?.subtasks) && it.subtasks.length > 0) {
                                    return { ...it, subtasks: applyPatchToTree(it.subtasks) }
                                }
                                return it
                            })

                        if ((localTask as any)?._id === patchId) {
                            setLocalTask((prev: any) => {
                                const nextTitle = (patch as any).title ?? (patch as any).name ?? prev.title ?? prev.name
                                return { ...prev, ...patch, title: nextTitle, name: nextTitle }
                            })
                        }

                        setSubtasks((prev: any[]) => applyPatchToTree(prev))
                    }}
                />
            )}

        </>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SubtaskManager({ roomId, stageId, cardId, isReadOnly = false }) {
    const { currentRoomDetail } = useTaskroomWorkspacetore();
    const searchParams = useSearchParams();
    const boardId = roomId;
    const Idspace = searchParams.get("shareTask") ? searchParams.get('spaceId') : currentRoomDetail?.spaceId;
    const [tasks, setTasks] = useState([]);
    const [adding, setAdding] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);
    const [taskPage, setTaskPage] = useState(0);
    const [taskTotalPages, setTaskTotalPages] = useState(1);
    const tasksSentinelRef = useRef<HTMLDivElement | null>(null);
    const tasksObserverRef = useRef<IntersectionObserver | null>(null);
    const tasksFetchInFlightRef = useRef(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    const openCount = tasks?.filter((t) => !t.isCompleted).length;
    const setColumns = useDashboardStore((state) => state.setColumns);

    const hasMoreTasks = taskPage > 0 && taskPage < taskTotalPages;

    const fetchTasksPage = useCallback(async (id: string, page: number) => {
        if (!id) return false;
        if (tasksFetchInFlightRef.current) return false;
        tasksFetchInFlightRef.current = true;

        if (page === 1) setLoadingTasks(true);
        else setLoadingMoreTasks(true);

        try {
            const token = localStorage.getItem("garage_tok");
            const res = await fetch(`${TASKROOM_API_URL}tasks/detail/sub/${id}?size=30&page=${page}`, {
                method: "GET",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });

            if (!res.ok) {
                if (page === 1) setTasks([]);
                return false;
            }

            const json = await res.json();
            const payload: any[] = json?.data ?? [];
            const metadata = json?.metadata ?? {};
            const totalPages: number = metadata?.totalPages ?? 1;
            const currentPage: number = metadata?.currentPage ?? page;

            setTaskPage(currentPage);
            setTaskTotalPages(totalPages);

            const normalized = payload.map(normalizeTask);
            setTasks((prev: any[]) => {
                if (page === 1) return normalized;
                const existingIds = new Set(prev.map((t) => t?._id));
                return [...prev, ...normalized.filter((n: any) => !existingIds.has(n?._id))];
            });

            return currentPage < totalPages;
        } catch (error) {
            console.error("Failed to fetch subtasks", error);
            if (page === 1) setTasks([]);
            return false;
        } finally {
            tasksFetchInFlightRef.current = false;
            setLoadingTasks(false);
            setLoadingMoreTasks(false);
        }
    }, []);

    const fetchTasks = async (cardId) => {
        if (!cardId) {
            setTasks([]);
            setLoadingTasks(false);
            setTaskPage(0);
            setTaskTotalPages(1);
            return;
        }
        setTaskPage(0);
        setTaskTotalPages(1);
        await fetchTasksPage(cardId, 1);
    };

    useEffect(() => {
        fetchTasks(cardId);
    }, [cardId]);

    useEffect(() => {
        if (!hasMoreTasks) return;
        const el = tasksSentinelRef.current;
        if (!el) return;

        if (tasksObserverRef.current) tasksObserverRef.current.disconnect();

        tasksObserverRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                if (tasksFetchInFlightRef.current) return;
                fetchTasksPage(cardId, taskPage + 1).then((more) => {
                    if (!more && tasksSentinelRef.current) {
                        tasksObserverRef.current?.unobserve(tasksSentinelRef.current);
                    }
                });
            },
            { root: scrollRootRef.current ?? null, threshold: 0.15, rootMargin: "260px" }
        );

        tasksObserverRef.current.observe(el);
        return () => tasksObserverRef.current?.disconnect();
    }, [cardId, fetchTasksPage, hasMoreTasks, taskPage]);

    const renderContent = () => (
        <div className={`w-full ${isFullScreen ? "h-full flex flex-col" : ""}`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors cursor-pointer"
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    {expanded
                        ? <ChevronDown size={15} className="text-white/80" />
                        : <ChevronRight size={15} className="text-white/80" />}
                    {/* <CheckSquare className="w-4 h-4 text-white/80" /> */}
                    SubTasks
                </button>
                <div className="ml-auto flex items-center gap-2">
                    {!isReadOnly && (
                    <button
                        onClick={() => { setExpanded(true); setAdding(true); }}
                        className="w-5 h-5 cursor-pointer rounded bg-[#252530] hover:bg-[#2e2e3a] flex items-center justify-center transition"
                    >
                        <Plus className="w-3 h-3 text-text-white/80" />
                    </button>
                    )}
                    <button
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="w-5 h-5 cursor-pointer rounded bg-[#252530] hover:bg-[#2e2e3a] flex items-center justify-center transition"
                    >
                        {isFullScreen ? <X className="w-3 h-3 text-white/80" /> : <Maximize2 className="w-3 h-3 text-white/50" />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className={`overflow-x-auto ${isFullScreen ? "flex-1 pb-10" : ""}`}>
                    <div className="min-w-full relative">
                        {/* Column headers */}
                        {(tasks.length > 0 || loadingTasks) ? (
                            <>
                                <div className="grid grid-cols-[minmax(250px,1fr)_120px_110px_145px_150px_72px] px-2 border-b border-white/[0.055] bg-white/[0.012]">
                                    <div className="px-2 py-1.5 text-[10.5px] font-semibold text-white/50 tracking-[0.06em] uppercase flex items-center sticky left-0 z-10 bg-[#e5e7eb29]]">
                                        <div className="absolute inset-0 bg-white/[0.012] pointer-events-none z-0" />
                                        <span className="relative z-10">Name</span>
                                    </div>
                                    <div className="px-2 py-1.5 text-[10.5px] font-semibold text-white/50 tracking-[0.06em] uppercase flex items-center justify-center">Assignee</div>
                                    <div className="px-2 py-1.5 text-[10.5px] font-semibold text-white/50 tracking-[0.06em] uppercase flex items-center justify-center">Priority</div>
                                    <div className="px-2 py-1.5 text-[10.5px] font-semibold text-white/50 tracking-[0.06em] uppercase flex items-center justify-center">Due Date</div>
                                    <div className="px-2 py-1.5 text-[10.5px] font-semibold text-white/50 tracking-[0.06em] uppercase flex items-center justify-center">Tags</div>
                                    <div className="px-2 py-1.5 text-[10.5px] font-semibold text-white/50 tracking-[0.06em] uppercase flex items-center justify-center">Actions</div>
                                </div>

                                {loadingTasks ? (
                                    <>
                                        <TaskRowSkeleton indent={0} />
                                        <TaskRowSkeleton indent={0} />
                                        <TaskRowSkeleton indent={0} />
                                    </>
                                ) : (
                                    tasks.length === 0 && !adding ? (
                                        <div className="py-10 pb-0 text-center rounded-xl bg-white/[0.005]">
                                            <div className="w-10 h-10 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-3">
                                                <CheckSquare className="w-4 h-4 text-white/20" />
                                            </div>
                                            <p className="text-xs font-medium text-white/40 tracking-wide">No subtasks yet</p>
                                            {!isReadOnly && (
                                            <>
                                            <p className="text-xs text-white/20 mt-0.5">Add a subtask to break this task down.</p>
                                            <button
                                                type="button"
                                                onClick={() => setAdding(true)}
                                                className="mt-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded transition"
                                            >
                                                Add Subtask
                                            </button>
                                            </>
                                            )}
                                        </div>
                                    ) : (
                                        tasks.map((t) => (
                                            <TaskRow
                                                key={t._id}
                                                task={t}
                                                roomId={roomId}
                                                stageId={stageId}
                                                rootId={null}
                                                cardId={cardId}
                                                boardId={boardId}
                                                Idspace={Idspace}
                                                scrollRoot={scrollRootRef.current}
                                                isReadOnly={isReadOnly}
                                                onDelete={(deletedId) => setTasks(prev => prev.filter(st => st._id !== deletedId))}
                                            />
                                        ))
                                    )
                                )}
                            </>
                        ) : (
                            !adding && !loadingTasks && (
                                <div className="py-10 text-center rounded-xl bg-white/[0.005]">
                                    <div className="w-10 h-10 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-3">
                                        <CheckSquare className="w-4 h-4 text-white/20" />
                                    </div>
                                    <p className="text-xs font-medium text-white/40 tracking-wide">No subtasks yet</p>
                                    {!isReadOnly && (
                                    <>
                                    <p className="text-xs text-white/20 mt-0.5">Add a subtask to break this task down.</p>
                                    <button
                                        type="button"
                                        onClick={() => { setExpanded(true); setAdding(true); }}
                                        className="mt-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/70 rounded transition"
                                    >
                                        Add Subtask
                                    </button>
                                    </>
                                    )}
                                </div>
                            )
                        )}

                        {/* Infinite scroll sentinel for main list */}
                        {hasMoreTasks && (
                            <div ref={tasksSentinelRef} className="h-px w-full" aria-hidden="true" />
                        )}

                        {loadingMoreTasks && (
                            <div className="py-2 text-center text-[11px] text-white/50/35">Loading more…</div>
                        )}

                        {adding && !isReadOnly && (
                            <NewTaskRow
                                roomId={roomId} stageId={stageId}
                                parentId={null} rootId={null} indent={0}
                                boardId={boardId}
                                Idspace={Idspace}
                                cardId={cardId}
                                onTaskAdded={(newTask) => {
                                    if (newTask) {
                                        const normalized = normalizeForDashboard(newTask);
                                        // Newest first, same as the dashboard store copy below
                                        setTasks((prev) => [normalized, ...prev.filter((st: any) => st?._id !== normalized?._id)]);

                                        // Root parent for these "subtasks list" is `cardId`
                                        setColumns((prev: any[]) =>
                                            updateTaskInDashboardColumns(prev, cardId, (t) => ({
                                                ...t,
                                                subTaskCount:
                                                    (typeof t?.subTaskCount === "number" ? t.subTaskCount : (t?.subtasks?.length ?? 0)) + 1,
                                                subtasks: [normalized, ...(t?.subtasks ?? [])],
                                            }))
                                        );
                                    }
                                }}
                                onSave={() => setAdding(false)}
                                onCancel={() => setAdding(false)}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div
            ref={scrollRootRef}
            className={isFullScreen ? "fixed inset-0 z-[100] bg-[#111116] p-8 overflow-y-auto" : ""}
        >
            <div className={isFullScreen ? "max-w-7xl mx-auto" : ""}>
                {renderContent()}
            </div>
        </div>
    );
}