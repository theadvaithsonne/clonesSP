import React, { useMemo, useEffect, useRef, useState } from "react";
import { CustomDatePicker } from "./custom-date-picker";
import { PriorityPicker, PriorityLevel } from "./priority-picker";
import { AssigneePicker } from "./assignee-picker";
import { StatusPicker, StatusValue } from "./status-picker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button as UIButton } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Filter,
  GripVertical,
  CheckSquare,
  Square,
  Pencil,
  Trash2,
  User,
  Calendar,
  Tag,
  ChevronDown,
  ChevronRight,
  Package,
  Sparkles,
  Users,
  CalendarPlus,
  Flag,
  FileText,
  HelpCircle,
  ArrowLeft,
  Hash,
  Type,
  CalendarDays,
  ChevronLeft,
} from "lucide-react";

export type TaskStatus = any;
export type TaskPriority = PriorityLevel;
export type TaskType = "task" | "subtask";

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
  id: string; // Keep for backward compatibility if needed, but primarily use _id
  name: string;
  status?: TaskStatus;
  assignee?: string;
  assignedToIds?: string[];
  members?: any[];
  startDate?: string;
  dueDate?: string;
  priority?: TaskPriority;
  tags?: string[];
  subtasks?: Task[];
  checklists?: Checklist[];
  parentId?: string;
  // type?: TaskType;
  customFields?: Record<string, string | number | null | undefined>;
}

export interface TaskGroup {
  id: string;
  status: string;
  color?: string;
  tasks: Task[];
  type?: string;
}

// A Mongo ObjectId starts with its creation time, so ordering by _id orders by
// when the task was created. Newest first keeps freshly added tasks on top,
// including after a reload. Items without an ObjectId sink to the bottom.
// Non-array input (a malformed API field) yields [] rather than throwing.
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;
export const sortNewestFirst = <T extends { _id?: string }>(list: T[]): T[] => {
  if (!Array.isArray(list)) return [];
  const key = (item: T) => {
    const id = item?._id;
    return typeof id === "string" && OBJECT_ID_RE.test(id) ? id.toLowerCase() : "";
  };
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
};

interface ListViewProps {
  tasks: TaskGroup[];
  onChangeTasks: (tasks: TaskGroup[]) => void;
  onOpenTask?: (task: Task) => void;
  roomId?: string;
}

interface DraftTask {
  groupKey: string;
  name: string;
  parentId?: string;
  type?: TaskType;
  priority?: TaskPriority;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  tags?: string[];
}

type CustomFieldType = "number" | "text" | "date";

interface CustomColumn {
  id: string;
  name: string;
  type: CustomFieldType;
}

export const ListView: React.FC<ListViewProps> = ({
  tasks,
  onChangeTasks,
  onOpenTask,
  roomId,
}) => {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [inlineDraft, setInlineDraft] = useState<DraftTask | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    () => new Set()
  );
  const desktopHScrollRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [desktopScrollLeft, setDesktopScrollLeft] = useState(0);
console.log("inlineDraft",inlineDraft)
  const collectExpandedByDefault = (list: Task[], out: Set<string>) => {
    for (const t of list) {
      if ((t.subtasks?.length ?? 0) > 0) {
        out.add(t.id);
        collectExpandedByDefault(t.subtasks || [], out);
      }
    }
  };

  // Expand all tasks-with-children by default (nested view). Each id is
  // auto-expanded only the first time it's seen, so a parent the user collapsed
  // doesn't pop back open on the next edit (every edit produces a new `tasks`).
  const autoExpandedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const g of tasks) {
      collectExpandedByDefault(g.tasks || [], next);
    }
    const fresh = Array.from(next).filter((id) => !autoExpandedIdsRef.current.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) autoExpandedIdsRef.current.add(id);
    setExpandedTaskIds((prev) => {
      const merged = new Set(prev);
      for (const id of fresh) merged.add(id);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [fieldsStep, setFieldsStep] = useState<"list" | "config">("list");
  const [selectedFieldType, setSelectedFieldType] = useState<CustomFieldType | null>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [fieldsSearch, setFieldsSearch] = useState("");

  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageType, setNewStageType] = useState<string>("tostart");
  const [isCreatingStage, setIsCreatingStage] = useState(false);

  const handleCreateStage = async () => {
    if (!newStageName.trim() || !roomId) {
      if (!roomId) toast.error("Missing Room ID");
      return;
    }

    setIsCreatingStage(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_TASKROOM_URL}stages`,
        {
          name: newStageName.trim(),
          color: "#008080",
          stageType: newStageType,
          type: "custom",
          orderId: tasks.length + 1,
          roomId: roomId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data?.status || response.data?.success) {
        toast.success("Stage created successfully");
        setIsStageDialogOpen(false);
        setNewStageName("");
        setNewStageType("tostart");
        // Trigger a refresh of the page (parent should handle this, or we can use the store)
        window.location.reload();
      } else {
        toast.error(response.data?.message || "Failed to create stage");
      }
    } catch (error: any) {
      console.error("Failed to create stage:", error);
      toast.error(error.response?.data?.message || error.message || "Failed to create stage");
    } finally {
      setIsCreatingStage(false);
    }
  };
  console.log("2dtasks", tasks)
  const baseGridParts = useMemo(
    () => [
      "42px", // checkbox
      "28px", // grip
      "minmax(300px, 1fr)", // name
      "150px", // status
      "160px", // assignee
      "150px", // due date
      "110px", // priority
      "150px", // tags
    ],
    []
  );
  const actionsWidth = "42px";
  const customColWidth = "160px";
  const gridTemplate = useMemo(() => {
    return [...baseGridParts, ...customColumns.map(() => customColWidth), actionsWidth].join(" ");
  }, [baseGridParts, customColumns]);

  const openFieldConfig = (type: CustomFieldType) => {
    setSelectedFieldType(type);
    setNewFieldName("");
    setFieldsStep("config");
  };

  const closeFieldsDrawer = () => {
    setIsFieldsOpen(false);
    setFieldsStep("list");
    setSelectedFieldType(null);
    setNewFieldName("");
  };

  const createCustomField = () => {
    const name = newFieldName.trim();
    if (!name || !selectedFieldType) return;
    const next: CustomColumn = {
      id: `cf-${Date.now()}`,
      name,
      type: selectedFieldType,
    };
    setCustomColumns((prev) => [...prev, next]);
    closeFieldsDrawer();
  };



  const flattenTaskIds = (list: Task[]): string[] => {
    const ids: string[] = [];
    for (const t of list) {
      ids.push(t.id);
      if (t.subtasks?.length) ids.push(...flattenTaskIds(t.subtasks));
    }
    return ids;
  };

  const allRenderedTaskIds = useMemo(() => {
    return tasks.flatMap((g) => flattenTaskIds(g.tasks || []));
  }, [tasks]);

  const allSelected = useMemo(
    () =>
      allRenderedTaskIds.length > 0 &&
      allRenderedTaskIds.every((id) => selectedTaskIds.has(id)),
    [allRenderedTaskIds, selectedTaskIds]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(allRenderedTaskIds));
    }
  };

  const toggleSelectOne = (id: string) => {

    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupCollapse = (key: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Recursively find a task by id anywhere in a task tree
  const findTaskInTree = (taskList: Task[], taskId: string): Task | undefined => {
    for (const task of taskList) {
      if (task.id === taskId) return task;
      if (task.subtasks?.length) {
        const found = findTaskInTree(task.subtasks, taskId);
        if (found) return found;
      }
    }
    return undefined;
  };

  // Recursively find and update a task anywhere in the tree (supports n-level subtasks)
  const updateTaskInTree = (
    taskList: Task[],
    taskId: string,
    updater: (task: Task) => Task
  ): Task[] => {
    return taskList.map((task) => {
      if (task.id === taskId) {
        return updater(task);
      }
      if (task.subtasks && task.subtasks.length > 0) {
        return {
          ...task,
          subtasks: updateTaskInTree(task.subtasks, taskId, updater),
        };
      }
      return task;
    });
  };

  const updateTaskInGroups = (groups: TaskGroup[], taskId: string, updater: (task: Task) => Task) => {
    return groups.map((g) => ({
      ...g,
      tasks: updateTaskInTree(g.tasks || [], taskId, updater),
    }));
  };

  const findTaskInGroups = (groups: TaskGroup[], taskId: string): Task | undefined => {
    for (const g of groups) {
      const found = findTaskInTree(g.tasks || [], taskId);
      if (found) return found;
    }
    return undefined;
  };

  // New tasks and subtasks go to the top of their list (newest first). Any
  // existing copy with the same id is dropped so a double insert can't duplicate.
  const addSubtaskInGroups = (groups: TaskGroup[], parentId: string, subtask: Task) => {
    return updateTaskInGroups(groups, parentId, (parent) => ({
      ...parent,
      subtasks: [subtask, ...(parent.subtasks || []).filter((st) => st.id !== subtask.id)],
    }));
  };

  const addTaskToGroup = (groups: TaskGroup[], groupId: string, newTask: Task) => {
    return groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        tasks: [newTask, ...(g.tasks || []).filter((t) => t.id !== newTask.id)],
      };
    });
  };

  const updateCustomFieldValue = (
    taskId: string,
    fieldId: string,
    type: CustomFieldType,
    rawValue: string
  ) => {
    let parsed: string | number | null;
    if (rawValue === "") {
      parsed = null;
    } else if (type === "number") {
      parsed = Number.isFinite(Number(rawValue)) ? Number(rawValue) : null;
    } else {
      parsed = rawValue;
    }

    const updated = updateTaskInGroups(tasks, taskId, (t) => ({
      ...t,
      customFields: {
        ...(t.customFields || {}),
        [fieldId]: parsed,
      },
    }));
    onChangeTasks(updated);
  };

  const toggleTaskExpanded = async (id: string) => {
    const isExpanding = !expandedTaskIds.has(id);
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (isExpanding) {
      const task = findTaskByIdInGroups(tasks, id);
      if (task && (!task.subtasks || task.subtasks.length === 0)) {
        const fetchedSubtasks = await fetchSubtasks(task);
        if (fetchedSubtasks && fetchedSubtasks.length > 0) {
          const updatedTasks = updateTaskInGroups(tasks, id, (t) => ({
            ...t,
            subtasks: fetchedSubtasks,
          }));
          onChangeTasks(updatedTasks);
        }
      }
    }
  };

  // Loads a task's subtasks from the server, newest first. null on failure.
  const fetchSubtasks = async (task: Task): Promise<Task[] | null> => {
    try {
      const token = localStorage.getItem("garage_tok");
      const type = task.type === "subtask" ? "subtask" : "task";
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_TASKROOM_URL}${type}/${task.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!(response.data?.status || response.data?.success)) return null;
      const data = response.data.data;
      return sortNewestFirst<any>(data?.subtasks || data?.cardData || []).map((st: any) => ({
        _id: st._id,
        id: st._id,
        name: st.title || st.name,
        status: st.status,
        assignedToIds: st.assignedToIds || [st.assignedToId],
        startDate: st.startDate,
        dueDate: st.dueDate,
        priority: st.priority,
        tags: st.tags,
        subtasks: [],
        parentId: task.id,
        type: "subtask",
        members: st.assigneeData || [],
      }));
    } catch (error) {
      console.error("Failed to fetch subtasks:", error);
      return null;
    }
  };

  const ensureTaskExpanded = (id: string) => {
    setExpandedTaskIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const beginInlineAdd = (
    groupKey: string,
    parentId?: string,
    type?: TaskType
  ) => {
    // If there's already a draft, cancel it first
    if (inlineDraft) {
      setInlineDraft(null);
    }
    // The draft row only renders inside an expanded group, so open it.
    const targetGroup = groupKey === "quick-add" ? tasks[0]?.id : groupKey;
    if (!parentId && targetGroup) {
      setExpandedGroups((prev) =>
        prev[targetGroup] === false ? { ...prev, [targetGroup]: true } : prev
      );
    }
    // Use setTimeout to ensure the previous draft is cleared
    setTimeout(() => {
      setInlineDraft({ groupKey, name: "", parentId, type });
    }, 0);
  };

  const beginAddSubtask = (parentId: string) => {
    setAddingSubtaskTo(parentId);
    ensureTaskExpanded(parentId);
    const parentTask = findTaskInGroups(tasks, parentId);
    if (parentTask) {
      // groupKey is the current visible group id when adding subtasks isn't known;
      // we still store the parentId to attach correctly on save.
      beginInlineAdd("subtask", parentId, "subtask");
    }
  };

  const findTaskByIdInList = (list: Task[], id: string): Task | null => {
    for (const t of list) {
      if (t.id === id) return t;
      if (t.subtasks?.length) {
        const found = findTaskByIdInList(t.subtasks, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findTaskByIdInGroups = (groups: TaskGroup[], id: string): Task | null => {
    for (const group of groups) {
      const found = findTaskByIdInList(group.tasks || [], id);
      if (found) return found;
    }
    return null;
  };

  const getRootTaskId = (id: string): string | null => {
    for (const group of tasks) {
      for (const t of group.tasks) {
        if (t.id === id) return t.id;
        if (t.subtasks && findTaskByIdInList(t.subtasks, id)) return t.id;
      }
    }
    return null;
  };

  const handleAddTask = async (taskName: string, draft: DraftTask) => {
    setIsCommitting(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const targetGroupId =
        draft.groupKey === "quick-add"
          ? (tasks[0]?.id || draft.groupKey)
          : draft.groupKey;

      const payload = {
        title: taskName,
        roomId: roomId,
        stageId: targetGroupId,
        priority: draft.priority || "normal",
        assignedToIds: draft.assignee ? [draft.assignee] : [],
        startDate: draft.startDate,
        dueDate: draft.dueDate,
        tags: draft.tags || [],
      };

      const res = await axios.post(`${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.status || res.data?.success) {
        const t = res.data.data?.data || res.data.data;
        const newTask: Task = {
          _id: t?._id,
          id: t?._id,
          name: t?.title || t?.name,
          status: t?.status,
          assignedToIds: [t?.assignedToId],
          startDate: t?.startDate,
          dueDate: t?.dueDate,
          priority: t?.priority,
          tags: t?.tags,
          subtasks: [],
          parentId: t?.parentId,
          type: "task",
          members: t.assigneeData ? (t.assigneeData || []) : [],
        };
        onChangeTasks(addTaskToGroup(tasks, targetGroupId, newTask));
        toast.success("Task created");
      } else {
        toast.error(res.data?.message || "Failed to create task");
      }
    } catch (err: any) {
      console.error("Task Error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to create task");
    } finally {
      setIsCommitting(false);
      setInlineDraft(null);
      setAddingSubtaskTo(null);
    }
  };

  const handleAddSubtask = async (taskName: string, draft: DraftTask) => {
    if (!draft.parentId) return;
    setIsCommitting(true);
    try {
      const token = localStorage.getItem("garage_tok");
      const targetGroupId = draft.groupKey;

      const rootId = getRootTaskId(draft.parentId);
      const payload: any = {
        title: taskName,
        roomId: roomId,
        stageId: targetGroupId,
        priority: draft.priority || "normal",
        assignedToIds: draft.assignee ? [draft.assignee] : [],
        startDate: draft.startDate,
        dueDate: draft.dueDate,
        tags: draft.tags || [],
        taskId: rootId,
      };

      if (rootId !== draft.parentId) {
        payload.subtaskId = draft.parentId;
      }

      const res = await axios.post(`${process.env.NEXT_PUBLIC_TASKROOM_URL}subtasks`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.status || res.data?.success) {
        const t = res.data.data?.data || res.data.data;
        const newTask: Task = {
          _id: t?._id,
          id: t?._id,
          name: t?.title || t?.name,
          status: t?.status,
          assignedToIds: [t?.assignedToId],
          startDate: t?.startDate,
          dueDate: t?.dueDate,
          priority: t?.priority,
          tags: t?.tags,
          subtasks: [],
          parentId: draft.parentId,
          type: "subtask",
          members: t.assigneeData ? (t.assigneeData || []) : [],
        };
        let groups = tasks;
        const parent = findTaskInGroups(tasks, draft.parentId);
        if (parent && !parent.subtasks?.length) {
          // The parent's existing subtasks may never have been loaded. Load them
          // first, otherwise the new subtask becomes the whole list and expanding
          // the parent later won't fetch the rest (it only fetches when empty).
          const existing = await fetchSubtasks(parent);
          if (existing?.length) {
            groups = updateTaskInGroups(groups, draft.parentId, (p) => ({ ...p, subtasks: existing }));
          }
        }
        onChangeTasks(addSubtaskInGroups(groups, draft.parentId, newTask));
        toast.success("Subtask created");
      } else {
        toast.error(res.data?.message || "Failed to create subtask");
      }
    } catch (err: any) {
      console.error("Subtask Error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to create subtask");
    } finally {
      setIsCommitting(false);
      setInlineDraft(null);
      setAddingSubtaskTo(null);
    }
  };

  const commitInlineAdd = async () => {
    if (isCommitting || !inlineDraft) return;
    const taskName = inlineDraft.name.trim();
    if (!taskName) {
      cancelInlineAdd();
      return;
    }
    const isSubtask = inlineDraft.type === "subtask" || inlineDraft.parentId;
    if (isSubtask && inlineDraft.parentId) {
      await handleAddSubtask(taskName, inlineDraft);
    } else {
      await handleAddTask(taskName, inlineDraft);
    }
  };

  const cancelInlineAdd = () => {
    setInlineDraft(null);
    setAddingSubtaskTo(null);
  };

  const beginEditTaskName = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingName(task.name);
  };

  const commitEditTaskName = () => {
    if (!editingTaskId) return;
    const name = editingName.trim();
    if (!name) {
      setEditingTaskId(null);
      return;
    }
    const updated = updateTaskInGroups(tasks, editingTaskId, (t) => ({
      ...t,
      name,
    }));
    onChangeTasks(updated);
    setEditingTaskId(null);
  };

  const updateSelectedTasks = (updater: (task: Task) => Task) => {
    // Apply to all selected tasks across all groups, including subtasks
    let updatedGroups = tasks;
    for (const id of Array.from(selectedTaskIds)) {
      updatedGroups = updateTaskInGroups(updatedGroups, id, updater);
    }
    onChangeTasks(updatedGroups);
  };

  const hasSelection = selectedTaskIds.size > 0;

  // Recursive function to render task rows with subtasks
  const renderTaskRow = (task: Task, depth: number = 0, groupKey: string) => {
    const selected = selectedTaskIds.has(task.id);
    const isEditing = editingTaskId === task.id;
    const isAddingSubtask = addingSubtaskTo === task.id;
    const indentLevel = depth * 24; // 24px per level
    const hasChildren = (task.subtasks?.length ?? 0) > 0;
    const isExpanded = expandedTaskIds.has(task.id);
    const isExpandable = hasChildren;

    return (
      <div key={task.id}>
        <div
          className="group border-b border-[#e5e7eb29] bg-[#111116] text-xs hover:bg-[#1a1a24] items-center"
          style={{ display: "grid", gridTemplateColumns: gridTemplate }}
        >
          <div
            className="sticky left-0 z-20 bg-[#111116] px-3 py-1.5 flex items-center justify-center group-hover:bg-[#1a1a24]"
            style={{ boxShadow: "8px 0 12px -12px rgba(15,23,42,0.25)" }}
          >
            <button
              type="button"
              onClick={() => toggleSelectOne(task.id)}
              className={`flex h-4 w-4 items-center justify-center rounded border text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${selected
                ? "border-purple-500 bg-purple-50"
                : "border-[#e5e7eb29] bg-[#111116]"
                }`}
              aria-label={
                selected
                  ? `Deselect task ${task.status}`
                  : `Select task ${task.status}`
              }
            >
              {selected ? (
                <CheckSquare className="h-3 w-3 fill-purple-600 text-purple-600" />
              ) : (
                <Square className="h-3 w-3" />
              )}
            </button>
          </div>
          <div
            className="sticky z-20 bg-[#111116] px-1 py-1.5 flex items-center justify-center group-hover:bg-[#1a1a24]"
            style={{ left: 42, boxShadow: "8px 0 12px -12px rgba(15,23,42,0.25)" }}
          >
            <button
              type="button"
              className="cursor-grab text-slate-300 hover:text-slate-400"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
          <div
            className="sticky z-20 bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24] relative"
            style={{ left: 70, boxShadow: "12px 0 14px -14px rgba(15,23,42,0.35)" }}
          >
            <div className="flex items-center gap-1.5 w-full" style={{ paddingLeft: `${indentLevel}px` }}>
              {isExpandable ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskExpanded(task.id);
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-[#20202b] hover:text-slate-300 shrink-0"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center shrink-0">
                  {depth > 0 ? (
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                  ) : null}
                </span>
              )}
              <button
                type="button"
                className="flex-1 truncate text-left font-medium text-slate-200 group-hover:text-purple-600 focus:outline-none"
                onClick={() => {
                  if (isEditing) return;
                  if (isExpandable) {
                    toggleTaskExpanded(task.id);
                    return;
                  }
                  onOpenTask?.(task);
                }}
              >

                {isEditing ? (
                  <input
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitEditTaskName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEditTaskName();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingTaskId(null);
                      }
                    }}
                    className="w-full rounded border border-purple-300 bg-[#111116] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                ) : (
                  <span className="truncate">{task.name}</span>
                )}
              </button>
              <div className="hidden flex items-center gap-1 opacity-0 group-hover:flex group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => beginAddSubtask(task.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:text-purple-600 hover:border-purple-300"
                  aria-label="Add subtask"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTask && onOpenTask(task)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#111116] text-slate-400 shadow-sm hover:text-slate-300"
                  aria-label="Open task details"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]">
            <StatusPicker
              status={task.status}
              initialTasks={tasks}
              onSelect={(s) => {
                onChangeTasks(updateTaskInGroups(tasks, task.id, (t) => ({ ...t, status: s as TaskStatus })));
              }}
            >
              <button
                className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:opacity-80 transition-opacity w-fit
                        ${(!task.status || task.status === "To Do") ? "bg-[#20202b] text-slate-300 border-[#e5e7eb29]" : ""}
                        ${task.status === "In Progress" ? "bg-blue-500 text-white border-blue-600" : ""}
                        ${task.status === "Test" ? "bg-purple-500 text-white border-purple-600" : ""}
                        ${(task.status === "Done" || task.status === "Complete") ? "bg-emerald-500 text-white border-emerald-600" : ""}
                    `}
                type="button"
              >
                <span className={`h-1.5 w-1.5 rounded-sm bg-current opacity-60 mr-0.5`} />
                {task.status || "TO DO"}
              </button>
            </StatusPicker>
          </div>
          <div className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]">
            <AssigneePicker
              assignee={task.assignee}
              onSelect={(assignee) => {
                onChangeTasks(updateTaskInGroups(tasks, task.id, (t) => ({ ...t, assignee })));
              }}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#e5e7eb29] bg-[#111116] px-2 py-0.5 text-xs text-slate-400 hover:border-[#e5e7eb29] hover:bg-[#111116]"
              >
                <User className="h-3.5 w-3.5 text-slate-400" />
                {task.assignee || "Unassigned"}
              </button>
            </AssigneePicker>
          </div>
          <div className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]">
            <CustomDatePicker
              defaultTab="due"
              startDate={task.startDate ? new Date(task.startDate) : undefined}
              dueDate={task.dueDate ? new Date(task.dueDate) : undefined}
              onSelect={({ start, due }) => {
                const newStartStr = start ? start.toLocaleDateString("en-US", {
                  month: 'numeric',
                  day: 'numeric',
                  year: '2-digit'
                }) : undefined;

                const newDueStr = due ? due.toLocaleDateString("en-US", {
                  month: 'numeric',
                  day: 'numeric',
                  year: '2-digit'
                }) : undefined;

                const updatedTasks = updateTaskInGroups(tasks, task.id, (t) => ({
                  ...t,
                  startDate: newStartStr,
                  dueDate: newDueStr,
                }));
                onChangeTasks(updatedTasks);
              }}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#e5e7eb29] bg-[#111116] px-2 py-0.5 text-xs text-slate-400 hover:border-[#e5e7eb29] hover:bg-[#111116]"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {task.dueDate ? (
                  <span>
                    {task.startDate ? `${task.startDate} - ` : ''}
                    {task.dueDate}
                  </span>
                ) : (
                  "Set dates"
                )}
              </button>
            </CustomDatePicker>
          </div>
          <div className="bg-[#111116] px-2 py-1.5 flex items-center justify-center group-hover:bg-[#1a1a24]">
            <PriorityPicker
              priority={task.priority}
              onSelect={(p) => {
                const updatedTasks = updateTaskInGroups(tasks, task.id, (t) => ({ ...t, priority: p }));
                onChangeTasks(updatedTasks);
              }}
            >
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[#20202b]"
              >
                {task.priority === "urgent" && <Flag className="h-4 w-4 fill-red-600 text-red-600" />}
                {task.priority === "high" && <Flag className="h-4 w-4 fill-amber-500 text-amber-500" />}
                {task.priority === "normal" && <Flag className="h-4 w-4 fill-blue-500 text-blue-500" />}
                {task.priority === "low" && <Flag className="h-4 w-4 fill-slate-500 text-slate-400" />}
                {!task.priority && <Flag className="h-4 w-4 text-slate-300" />}
              </button>
            </PriorityPicker>
          </div>
          <div className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]">
            <div className="flex flex-wrap items-center gap-1">
              {task.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1a1a24] px-2 py-0.5 text-[11px] text-slate-300"
                >
                  <Tag className="h-3 w-3 text-slate-400" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {customColumns.map((col) => {
            const rawValue = task.customFields?.[col.id];
            const displayValue =
              rawValue === null || rawValue === undefined ? "" : String(rawValue);

            if (col.type === "number") {
              return (
                <div
                  key={col.id}
                  className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]"
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    value={displayValue}
                    onChange={(e) =>
                      updateCustomFieldValue(task.id, col.id, "number", e.target.value)
                    }
                    className="h-7 w-full rounded-md border border-[#e5e7eb29] bg-[#111116] px-2 text-xs text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    placeholder="—"
                    aria-label={`${col.name} value`}
                  />
                </div>
              );
            }

            if (col.type === "text") {
              return (
                <div
                  key={col.id}
                  className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]"
                >
                  <input
                    type="text"
                    value={displayValue}
                    onChange={(e) =>
                      updateCustomFieldValue(task.id, col.id, "text", e.target.value)
                    }
                    className="h-7 w-full rounded-md border border-[#e5e7eb29] bg-[#111116] px-2 text-xs text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    placeholder="Type…"
                    aria-label={`${col.name} text`}
                  />
                </div>
              );
            }

            if (col.type === "date") {
              const dateValue = displayValue ? new Date(displayValue) : undefined;
              return (
                <div
                  key={col.id}
                  className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]"
                >
                  <CustomDatePicker
                    defaultTab="due"
                    startDate={undefined}
                    dueDate={dateValue}
                    onSelect={({ due }) => {
                      const newDueStr = due
                        ? due.toLocaleDateString("en-US", {
                          month: "numeric",
                          day: "numeric",
                          year: "2-digit",
                        })
                        : "";
                      updateCustomFieldValue(task.id, col.id, "date", newDueStr);
                    }}
                  >
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-between gap-1 rounded-full border border-dashed border-[#e5e7eb29] bg-[#111116] px-2 py-0.5 text-xs text-slate-400 hover:border-[#e5e7eb29] hover:bg-[#111116]"
                      aria-label={`${col.name} date`}
                    >
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">
                        {displayValue || "Set date"}
                      </span>
                    </button>
                  </CustomDatePicker>
                </div>
              );
            }

            return (
              <div
                key={col.id}
                className="bg-[#111116] px-2 py-1.5 flex items-center group-hover:bg-[#1a1a24]"
              />
            );
          })}

          <div className="bg-[#111116] px-2 py-1.5 flex items-center justify-end group-hover:bg-[#1a1a24]">
            <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:text-slate-300"
                aria-label="Duplicate task"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#111116] text-rose-400 hover:text-rose-600"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:text-slate-300"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Inline add subtask row, above the children where the new subtask will appear */}
        {
          isAddingSubtask &&
          inlineDraft &&
          inlineDraft.parentId === task.id && (
            <div className="border-b border-[#e5e7eb29] bg-[#111116]">
              <div
                className="items-center"
                style={{ display: "grid", gridTemplateColumns: gridTemplate }}
              >
                {/* Sticky empty checkbox column */}
                <div
                  className="sticky left-0 z-20 bg-[#111116] px-3 py-2"
                  style={{ boxShadow: "8px 0 12px -12px rgba(15,23,42,0.25)" }}
                />

                {/* Sticky empty grip column */}
                <div
                  className="sticky z-20 bg-[#111116] px-1 py-2"
                  style={{ left: 42, boxShadow: "8px 0 12px -12px rgba(15,23,42,0.25)" }}
                />

                {/* Sticky Name/editor column (matches normal row) */}
                <div
                  className="sticky z-20 bg-[#111116] px-3 py-2"
                  style={{
                    left: 70,
                    boxShadow: "12px 0 14px -14px rgba(15,23,42,0.35)",
                  }}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${indentLevel + 24}px` }}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center">
                      <ChevronRight className="h-3 w-3 text-slate-300" />
                    </span>
                    {/* Checkbox */}
                    <div className="flex h-5 w-5 items-center justify-center">
                      <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-[#111116]">
                        <div className="h-full w-full rounded-full bg-blue-500/10" />
                      </div>
                    </div>

                    {/* Input Field */}
                    <div className="flex-1">
                      <input
                        autoFocus
                        value={inlineDraft.name}
                        placeholder="Task Name"
                        onChange={(e) =>
                          setInlineDraft({
                            ...inlineDraft,
                            name: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitInlineAdd();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInlineAdd();
                          }
                        }}
                        className="w-[50px] border-0 bg-transparent placeholder:text-xs px-2 py-1 placeholder:text-xs text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                      />
                    </div>

                    {/* Quick Action Icons */}
                    <div className="flex items-center gap-1">
                     
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="Assign task"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="Set due date"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="Set priority"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="Add tags"
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </button>
                  
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelInlineAdd}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#1a1a24]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={commitInlineAdd}
                        className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-700"
                      >
                        Save jjh
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Non-sticky placeholder cells to keep grid alignment */}
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                <div className="px-2 py-2" />
                {customColumns.map((col) => (
                  <div key={col.id} className="px-2 py-2" />
                ))}
                <div className="px-2 py-2" />
              </div>
            </div>
          )
        }

        {/* Render children recursively only when expanded */}
        {
          isExpanded &&
          task.subtasks &&
          task.subtasks.map((subtask) => renderTaskRow(subtask, depth + 1, groupKey))
        }

      </div >
    );
  };

  const renderMobileTask = (task: Task, depth: number = 0) => {
    const selected = selectedTaskIds.has(task.id);
    const hasChildren = (task.subtasks?.length ?? 0) > 0;
    const isExpanded = expandedTaskIds.has(task.id);
    const indent = depth * 16;

    return (
      <div key={task.id}>
        <article className="flex flex-col gap-2 px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => toggleSelectOne(task.id)}
              className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${selected
                ? "border-purple-500 bg-purple-50"
                : "border-[#e5e7eb29] bg-[#111116]"
                }`}
              aria-label={
                selected ? `Deselect task ${task.name}` : `Select task ${task.name}`
              }
              style={{ marginLeft: indent }}
            >
              {selected ? (
                <CheckSquare className="h-3 w-3 fill-purple-600 text-purple-600" />
              ) : (
                <Square className="h-3 w-3" />
              )}
            </button>

            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleTaskExpanded(task.id)}
                className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-400 hover:bg-[#20202b]"
                aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="mt-0.5 inline-flex h-5 w-5" />
            )}

            <div className="flex-1 space-y-1">
              <button
                type="button"
                className="block text-left text-[13px] font-medium text-slate-200 hover:text-purple-600"
                onClick={() => {
                  if (hasChildren) {
                    toggleTaskExpanded(task.id);
                    return;
                  }
                  onOpenTask?.(task);
                }}
              >
                {task.name}
              </button>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                {renderStatusPill(task.status)}
                <span className="inline-flex items-center gap-1 rounded-full bg-[#111116] px-2 py-0.5">
                  <User className="h-3 w-3 text-slate-400" />
                  {task.assignee || "Unassigned"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#111116] px-2 py-0.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  {task.dueDate || "Set date"}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7eb29] bg-[#111116] text-slate-400"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pl-6" style={{ paddingLeft: indent + 24 }}>
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1a1a24] px-2 py-0.5 text-[11px] text-slate-300"
                >
                  <Tag className="h-3 w-3 text-slate-400" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {hasChildren && isExpanded && (
          <div className="border-l border-[#e5e7eb29]">
            {(task.subtasks || []).map((st) => renderMobileTask(st, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderStatusPill = (status: TaskStatus | undefined) => {
    const s = status ?? "To Do";
    const colorMap: Record<TaskStatus, string> = {
      "To Do": "bg-[#1a1a24] text-slate-300 border-[#e5e7eb29]",
      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
      Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Test: "bg-purple-50 text-purple-700 border-purple-200",
      Complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
    return (
      <button
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorMap[s]} hover:shadow-sm transition`}
        aria-label={`Change status (current: ${s})`}
        type="button"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${s === "Done"
            ? "bg-emerald-500"
            : s === "In Progress"
              ? "bg-blue-500"
              : "bg-slate-400"
            }`}
        />
        {s}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
    );
  };

  const ColumnHeader: React.FC<{
    label: string;
    align?: "left" | "center" | "right";
  }> = ({ label, align = "left" }) => {
    return (
      <div
        className={`flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}
      >
        <span>{label}</span>
      </div>
    );
  };

  const BulkButton = React.forwardRef<HTMLButtonElement, { label: string; destructive?: boolean; onClick?: () => void; className?: string; }>((
    { label, destructive, onClick, className, ...props }, ref
  ) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition hover:shadow ${destructive
        ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
        : "border-[#e5e7eb29] bg-[#111116] text-slate-300 hover:bg-[#1a1a24]"
        } ${className || ""}`}
      {...props}
    >
      {label}
    </button>
  ));
  BulkButton.displayName = "BulkButton";

  const BulkToolbar: React.FC = () => {
    if (!hasSelection) return null;
    return (
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-5xl items-center justify-between gap-3 rounded-full border border-[#e5e7eb29] bg-[#111116] px-3 py-2 shadow-lg shadow-slate-900/10 backdrop-blur">
          <div className="flex items-center gap-2 text-xs sm:text-xs text-slate-300">
            <CheckSquare className="h-4 w-4 text-purple-500" />
            <span className="font-medium">
              {selectedTaskIds.size} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <StatusPicker onSelect={(s) => updateSelectedTasks(t => ({ ...t, status: s as TaskStatus }))}>
              <BulkButton label="Status" />
            </StatusPicker>
            <AssigneePicker onSelect={(assignee) => updateSelectedTasks(t => ({ ...t, assignee }))}>
              <BulkButton label="Assignee" />
            </AssigneePicker>
            <CustomDatePicker defaultTab="due" onSelect={({ start, due }) => {
              const newStartStr = start ? start.toLocaleDateString("en-US", { month: 'numeric', day: 'numeric', year: '2-digit' }) : undefined;
              const newDueStr = due ? due.toLocaleDateString("en-US", { month: 'numeric', day: 'numeric', year: '2-digit' }) : undefined;
              updateSelectedTasks(t => ({ ...t, ...(newStartStr !== undefined ? { startDate: newStartStr } : {}), dueDate: newDueStr }));
            }}>
              <BulkButton label="Due date" />
            </CustomDatePicker>
            <PriorityPicker onSelect={(p) => updateSelectedTasks(t => ({ ...t, priority: p }))}>
              <BulkButton label="Priority" />
            </PriorityPicker>
            <BulkButton label="Tags" />
            <BulkButton label="Move to list" />
            <BulkButton label="Convert to subtask" />
            <BulkButton label="Archive" />
            <BulkButton label="Delete" destructive />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-400 hover:bg-[#1a1a24]"
            >
              More
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };


  const Toolbar: React.FC = () => {
    return (
      <header className="flex flex-col gap-3 border-b border-[#e5e7eb29] bg-[#111116] px-3 pb-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#e5e7eb29] bg-[#111116] px-1 py-1 text-xs">
            <button
              type="button"
              className="rounded-full bg-[#111116] px-3 py-1 text-xs font-medium text-slate-200 shadow-sm"
            >
              List
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:bg-[#111116]"
            >
              Board
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:bg-[#111116]"
            >
              Calendar
            </button>
            <button
              type="button"
              className="hidden rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:bg-[#111116] sm:inline-flex"
            >
              Gantt
            </button>

            <button
              type="button"
              className="hidden rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:bg-[#111116] sm:inline-flex"
            >
              Docs
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb29] bg-[#111116] px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm hover:bg-[#1a1a24]"
              aria-label="Customize view"
            >
              Customize
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb29] bg-[#111116] px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm hover:bg-[#1a1a24]"
              aria-label="Filter tasks"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1"
            aria-label="Add task"
            onClick={() => beginInlineAdd("quick-add")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        </div>
      </header>
    );
  };

  // Debug: Log when component renders
  useEffect(() => {
    console.log("ListView rendered with groups:", tasks.length);
  }, [tasks]);

  return (
    <section className="flex h-full w-full flex-col overflow-hidden bg-[#111116]">
      <Toolbar />
      <div className="relative flex-1 overflow-y-auto overflow-x-auto bg-[#111116]">
        <button
          type="button"
          onClick={() => setIsFieldsOpen(true)}
          className="group fixed right-6 top-28 z-30 inline-flex h-9 items-center gap-2 rounded-full border border-[#e5e7eb29] bg-[#111116] px-3 text-xs font-medium text-slate-300 shadow-sm hover:bg-[#1a1a24]"
          aria-label="Add a Column"
          title="Add a Column"
        >
          <Plus className="h-4 w-4 text-slate-300" />
          <span className="hidden sm:inline">Add a Column</span>
        </button>

        <button
          type="button"
          onClick={() => setIsStageDialogOpen(true)}
          className="group fixed right-[150px] top-28 z-30 inline-flex h-9 items-center gap-2 rounded-full border border-[#e5e7eb29] bg-[#111116] px-3 text-xs font-medium text-slate-300 shadow-sm hover:bg-[#1a1a24]"
          aria-label="Create Stage"
          title="Create Stage"
        >
          <Plus className="h-4 w-4 text-slate-300" />
          <span className="hidden sm:inline">Create Stage</span>
        </button>

        <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-[#111116] border-[#e5e7eb29] text-white">
            <DialogHeader>
              <DialogTitle>Create New Stage</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-right text-xs">
                  Stage Name
                </Label>
                <Input
                  id="name"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Enter stage name"
                  className="bg-[#1a1a24] border-[#e5e7eb29] focus:ring-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stageType" className="text-right text-xs">
                  Stage Type
                </Label>
                <Select value={newStageType} onValueChange={setNewStageType}>
                  <SelectTrigger className="bg-[#1a1a24] border-[#e5e7eb29]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111116] border-[#e5e7eb29] text-white">
                    <SelectItem value="tostart">tostart</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="done">done</SelectItem>
                    <SelectItem value="closed">closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <UIButton
                variant="outline"
                onClick={() => setIsStageDialogOpen(false)}
                className="bg-transparent border-[#e5e7eb29] text-white hover:bg-[#343439]"
              >
                Cancel
              </UIButton>
              <UIButton
                onClick={handleCreateStage}
                disabled={isCreatingStage || !newStageName.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isCreatingStage ? "Creating..." : "Create Stage"}
              </UIButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet
          open={isFieldsOpen}
          onOpenChange={(open) => {
            if (!open) closeFieldsDrawer();
            else setIsFieldsOpen(true);
          }}
        >
          <SheetContent side="right" className="w-[420px] max-w-[92vw] p-0">
            {fieldsStep === "list" ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-[#e5e7eb29] px-4 py-3">
                  <SheetTitle className="text-base font-semibold text-slate-200">Fields</SheetTitle>
                </div>

                <div className="px-4 py-3">
                  <input
                    value={fieldsSearch}
                    onChange={(e) => setFieldsSearch(e.target.value)}
                    placeholder="Search for new or existing fields"
                    className="h-10 w-full rounded-xl border border-[#e5e7eb29] bg-[#111116] px-3 text-xs text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    aria-label="Search fields"
                  />
                </div>

                <div className="px-4">
                  <Tabs defaultValue="create" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="create">Create new</TabsTrigger>
                      <TabsTrigger value="existing">Add existing</TabsTrigger>
                    </TabsList>
                    <TabsContent value="create" className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        All
                      </div>
                      <div className="mt-3 space-y-1">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-[#1a1a24]"
                          onClick={() => openFieldConfig("number")}
                        >
                          <Hash className="h-4 w-4 text-slate-300" />
                          <span>Number</span>
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-[#1a1a24]"
                          onClick={() => openFieldConfig("text")}
                        >
                          <Type className="h-4 w-4 text-slate-300" />
                          <span>Text</span>
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-[#1a1a24]"
                          onClick={() => openFieldConfig("date")}
                        >
                          <CalendarDays className="h-4 w-4 text-slate-300" />
                          <span>Date</span>
                        </button>
                      </div>
                    </TabsContent>
                    <TabsContent value="existing" className="mt-4">
                      <div className="rounded-xl border border-dashed border-[#e5e7eb29] p-4 text-xs text-slate-400">
                        No existing fields yet.
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-[#e5e7eb29] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFieldsStep("list");
                        setSelectedFieldType(null);
                        setNewFieldName("");
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#1a1a24]"
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-4 w-4 text-slate-300" />
                    </button>
                    <div className="text-xs font-semibold text-slate-200">
                      {selectedFieldType === "number" ? "Number" : "Field"}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <label className="mb-2 block text-xs font-medium text-slate-200">
                    Field name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Enter name..."
                    className="h-10 w-full rounded-xl border border-[#e5e7eb29] bg-[#111116] px-3 text-xs text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    aria-label="Field name"
                  />
                </div>

                <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#e5e7eb29] px-4 py-4">
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-[#e5e7eb29] bg-[#111116] px-4 text-xs font-medium text-slate-300 hover:bg-[#1a1a24]"
                    onClick={closeFieldsDrawer}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-purple-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={createCustomField}
                    disabled={!newFieldName.trim()}
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <p className="text-xs text-slate-400">No tasks yet. Click "Add task" to get started!</p>
            </div>
          </div>
        ) : (
          <>
            {/* Track scrollLeft so group headers stay fixed on horizontal scroll */}
            <div
              ref={desktopHScrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                  setDesktopScrollLeft(el.scrollLeft);
                });
              }}
              className="overflow-x-auto pb-20"
            >
              <div className="flex flex-col">
                {tasks.map((group) => {
                  const groupKey = group.id;
                  const groupTasks = group.tasks || [];
                  const expanded = expandedGroups[groupKey] ?? true;
                  // Show inline draft if it matches this group, or if it's "quick-add" and this is the first group
                  const showInlineDraft = inlineDraft && (
                    (inlineDraft.groupKey === groupKey && !inlineDraft.parentId) ||
                    (inlineDraft.groupKey === "quick-add" && tasks[0]?.id === groupKey && !inlineDraft.parentId)
                  );
                  return (
                    <React.Fragment key={groupKey}>
                      {/* Group Header (sticky + NOT affected by horizontal scrolling) */}
                      <div
                        className="bg-[#111116]/80 mt-2 sticky top-0 left-0 z-30"
                        style={{
                          transform: `translateX(${desktopScrollLeft}px)`,
                          willChange: "transform",
                        }}
                      >
                        <div className="w-full bg-[#111116]/95 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapse(groupKey)}
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-[#20202b]"
                            >
                              {expanded ? (
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                              )}
                              <span
                                className="rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
                                style={{
                                  backgroundColor: group.color || "#64748b",
                                }}
                              >
                                {group.status}
                              </span>
                              <span className="rounded-full bg-[#20202b] px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                {groupTasks.length}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => beginInlineAdd(groupKey)}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-400 hover:bg-[#20202b]"
                            >
                              <Plus className="h-3 w-3 text-purple-500" />
                              Add task dasd
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Wide grid area (can scroll horizontally) */}
                      <div style={{ minWidth: "1200px" }}>
                        {expanded && (
                          <div
                            className="border-b border-[#e5e7eb29] bg-[#111116]/40 text-left text-xs uppercase tracking-wide text-slate-400 font-medium"
                            style={{ display: "grid", gridTemplateColumns: gridTemplate }}
                          >
                            <div
                              className="sticky left-0 z-20 w-10 min-w-[2.5rem] bg-[#111116]/95 px-3 py-2 flex items-center font-medium"
                              style={{ boxShadow: "8px 0 12px -12px rgba(15,23,42,0.25)" }}
                            >
                              <button
                                type="button"
                                onClick={toggleSelectAll}
                                className="flex h-4 w-4 items-center justify-center rounded border border-[#e5e7eb29] bg-[#111116] text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                                aria-label={allSelected ? "Deselect all tasks" : "Select all tasks"}
                              >
                                {allSelected ? (
                                  <CheckSquare className="h-3 w-3 fill-purple-600 text-purple-600" />
                                ) : (
                                  <Square className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <div
                              className="sticky z-20 w-5 min-w-[1.5rem] bg-[#111116]/95 px-1 py-2 font-medium"
                              aria-hidden="true"
                              style={{ left: 42, boxShadow: "8px 0 12px -12px rgba(15,23,42,0.25)" }}
                            />
                            <div
                              className="sticky z-20 min-w-[280px] bg-[#111116]/95 px-2 py-2 font-medium"
                              style={{ left: 70, boxShadow: "12px 0 14px -14px rgba(15,23,42,0.35)" }}
                            >
                              <ColumnHeader label="Name" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Status" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Assignee" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Due date" />
                            </div>
                            <div className="w-32 min-w-[8rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Priority" align="center" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Tags" />
                            </div>
                            {customColumns.map((col) => (
                              <div key={col.id} className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                                <span className="flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                                  {col.name}
                                </span>
                              </div>
                            ))}
                            <div className="w-10 min-w-[2.5rem] px-2 py-2 font-medium" aria-label="More" />
                          </div>
                        )}

                        {/* Draft row sits above the list, where the new task will appear */}
                        {expanded && showInlineDraft && (
                          <div className="border-b border-[#e5e7eb29] bg-[#111116]">
                            <div className="max-w-[600px] bg-[#111116] px-3 py-2 align-middle backdrop-blur">
                              <div className="flex items-center gap-2">
                                {/* Checkbox */}
                                <div className="flex h-5 w-5 items-center justify-center">
                                  <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-[#111116]">
                                    <div className="h-full w-full rounded-full bg-blue-500/10" />
                                  </div>
                                </div>

                                {/* Input Field */}
                                <div className="flex-1">
                                  <input
                                    autoFocus
                                    value={inlineDraft.name}
                                    placeholder="Task Name"
                                    onChange={(e) =>
                                      setInlineDraft({
                                        ...inlineDraft,
                                        name: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitInlineAdd();
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelInlineAdd();
                                      }
                                    }}
                                    className="w-full border-0 bg-transparent placeholder:text-xs  px-2 py-1 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                                  />
                                </div>

                                  {/* Quick Action Icons */}
                                  <div className="flex items-center gap-1">
                                    <AssigneePicker
                                      assignee={inlineDraft.assignee}
                                      onSelect={(assignee) => setInlineDraft({ ...inlineDraft, assignee })}
                                    >
                                      <button
                                        type="button"
                                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                        aria-label="Assign task"
                                      >
                                        <Users className="h-3.5 w-3.5" />
                                      </button>
                                    </AssigneePicker>

                                    <CustomDatePicker
                                      startDate={inlineDraft.startDate ? new Date(inlineDraft.startDate) : undefined}
                                      dueDate={inlineDraft.dueDate ? new Date(inlineDraft.dueDate) : undefined}
                                      onSelect={({ start, due }) => {
                                        setInlineDraft({
                                          ...inlineDraft,
                                          startDate: start?.toISOString(),
                                          dueDate: due?.toISOString(),
                                        });
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                        aria-label="Set due date"
                                      >
                                        <CalendarPlus className="h-3.5 w-3.5" />
                                      </button>
                                    </CustomDatePicker>

                                    <PriorityPicker
                                      priority={inlineDraft.priority}
                                      onSelect={(p) => setInlineDraft({ ...inlineDraft, priority: p })}
                                    >
                                      <button
                                        type="button"
                                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                        aria-label="Set priority"
                                      >
                                        <Flag className="h-3.5 w-3.5" />
                                      </button>
                                    </PriorityPicker>

                                    <button
                                      type="button"
                                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                      aria-label="Add tags"
                                    >
                                      <Tag className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelInlineAdd}
                                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#1a1a24]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={commitInlineAdd}
                                    className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-700"
                                  >
                                    Save
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {expanded &&
                          groupTasks.map((task) => renderTaskRow(task, 0, groupKey))}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-3 lg:hidden">
              {tasks.map((group) => {
                const groupKey = group.id;
                const groupTasks = group.tasks || [];
                const expanded = expandedGroups[groupKey] ?? true;
                return (
                  <section
                    key={groupKey}
                    className="rounded-2xl border border-[#e5e7eb29] bg-[#111116] shadow-sm"
                  >
                    <div

                      onClick={() => toggleGroupCollapse(groupKey)}
                      className="flex w-full items-center justify-between gap-2 rounded-t-2xl bg-[#111116]/80 px-3 py-2 text-left text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        {expanded ? (
                          <ChevronDown className="h-3 w-3 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        )}
                        <span className="font-semibold text-slate-200">
                          {group.status}
                        </span>
                        <span className="rounded-full bg-[#20202b] px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                          {groupTasks.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          beginInlineAdd(groupKey);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-[#111116] px-2 py-1 text-[11px] font-medium text-slate-300 shadow-sm"
                      >
                        <Plus className="h-3 w-3 text-purple-500" />
                        Add
                      </button>
                    </div>

                    {expanded && (
                      <div className="divide-y divide-slate-100">
                        {/* Draft row sits above the list, where the new task will appear */}
                        {(inlineDraft && inlineDraft.groupKey === groupKey) ||
                          (inlineDraft &&
                            inlineDraft.groupKey === "quick-add" &&
                            tasks[0]?.id === groupKey) ? (
                          <div className="flex flex-col gap-2 border-t border-[#e5e7eb29] px-3 py-3">
                            <div className="flex items-center gap-2">
                              {/* Checkbox */}
                              <div className="flex h-5 w-5 items-center justify-center">
                                <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-[#111116]">
                                  <div className="h-full w-full rounded-full bg-blue-500/10" />
                                </div>
                              </div>

                              {/* Input Field */}
                              <div className="flex-1">
                                <input
                                  autoFocus
                                  value={inlineDraft.name}
                                  placeholder="Task Name"
                                  onChange={(e) =>
                                    setInlineDraft({
                                      ...inlineDraft,
                                      name: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitInlineAdd();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelInlineAdd();
                                    }
                                  }}
                                  className="w-full border-0 placeholder:text-xs bg-transparent px-2 py-1 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                                />
                              </div>
                            </div>

                            {/* Quick Action Icons Row */}
                            <div className="flex flex-wrap items-center gap-1 pl-7">
                              <AssigneePicker
                                assignee={inlineDraft.assignee}
                                onSelect={(assignee) => setInlineDraft({ ...inlineDraft, assignee })}
                              >
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                  aria-label="Assign task"
                                >
                                  <Users className="h-3.5 w-3.5" />
                                </button>
                              </AssigneePicker>

                              <CustomDatePicker
                                startDate={inlineDraft.startDate ? new Date(inlineDraft.startDate) : undefined}
                                dueDate={inlineDraft.dueDate ? new Date(inlineDraft.dueDate) : undefined}
                                onSelect={({ start, due }) => {
                                  setInlineDraft({
                                    ...inlineDraft,
                                    startDate: start?.toISOString(),
                                    dueDate: due?.toISOString(),
                                  });
                                }}
                              >
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                  aria-label="Set due date"
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                </button>
                              </CustomDatePicker>

                              <PriorityPicker
                                priority={inlineDraft.priority}
                                onSelect={(p) => setInlineDraft({ ...inlineDraft, priority: p })}
                              >
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                  aria-label="Set priority"
                                >
                                  <Flag className="h-3.5 w-3.5" />
                                </button>
                              </PriorityPicker>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-2 pl-7">
                              <button
                                type="button"
                                onClick={cancelInlineAdd}
                                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#1a1a24]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={commitInlineAdd}
                                className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-700"
                              >
                                Save
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {groupTasks.map((task) => renderMobileTask(task, 0))}
                      </div>

                    )
                    }
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
      <BulkToolbar />
    </section>
  );
};

