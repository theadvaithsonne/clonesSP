import React, { useMemo, useEffect, useRef, useState } from "react";
import { CustomDatePicker } from "./custom-date-picker";
import { PriorityPicker, PriorityLevel } from "./priority-picker";
import { AssigneePicker } from "./assignee-picker";
import { StatusPicker, StatusValue } from "./status-picker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  MoreHorizontal,
  Filter,
  ArrowUpDown,
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
  type?:string;
  id: string; // Keep for backward compatibility if needed, but primarily use _id
  name: string;
  status?: TaskStatus;
  assignee?: string;
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

interface ListViewProps {
  tasks: TaskGroup[];
  onChangeTasks: (tasks: TaskGroup[]) => void;
  onOpenTask?: (task: Task) => void;
}

interface DraftTask {
  groupKey: string;
  name: string;
  parentId?: string;
  type?: TaskType;
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
}) => {
  const [search, setSearch] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set()
  );
  const [sortBy, setSortBy] = useState<keyof Task | "name">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

  const collectExpandedByDefault = (list: Task[], out: Set<string>) => {
    for (const t of list) {
      if ((t.subtasks?.length ?? 0) > 0) {
        out.add(t.id);
        collectExpandedByDefault(t.subtasks || [], out);
      }
    }
  };

  // Expand all tasks-with-children by default (nested view).
  useEffect(() => {
    const next = new Set<string>();
    for (const g of tasks) {
      collectExpandedByDefault(g.tasks || [], next);
    }
    // Only add missing expanded ids; don't collapse user-collapsed ones on re-render.
    setExpandedTaskIds((prev) => {
      if (prev.size === 0) return next;
      const merged = new Set(prev);
      for (const id of Array.from(next)) merged.add(id);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const filterTaskTree = (list: Task[], q: string): Task[] => {
    return list
      .map((t) => {
        const children = t.subtasks?.length ? filterTaskTree(t.subtasks, q) : [];
        const selfMatches = t.name.toLowerCase().includes(q);
        const include = selfMatches || children.length > 0;
        if (!include) return null;
        return {
          ...t,
          subtasks: children,
        };
      })
      .filter(Boolean) as Task[];
  };

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tasks;
    return tasks
      .map((g) => ({
        ...g,
        tasks: filterTaskTree(g.tasks || [], q),
      }))
      .filter((g) => g.tasks.length > 0);
  }, [tasks, search]);

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [fieldsStep, setFieldsStep] = useState<"list" | "config">("list");
  const [selectedFieldType, setSelectedFieldType] = useState<CustomFieldType | null>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [fieldsSearch, setFieldsSearch] = useState("");

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



  const sortTaskList = (list: Task[]): Task[] => {
    const sorted = [...list].sort((a, b) => {
      const av = (a as any)[sortBy] ?? "";
      const bv = (b as any)[sortBy] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted.map((t) => ({
      ...t,
      subtasks: t.subtasks?.length ? sortTaskList(t.subtasks) : t.subtasks,
    }));
  };

  const sortedGroups = useMemo(() => {
    return filteredGroups.map((g) => ({
      ...g,
      tasks: sortTaskList(g.tasks || []),
    }));
  }, [filteredGroups, sortBy, sortDir]);

  const flattenTaskIds = (list: Task[]): string[] => {
    const ids: string[] = [];
    for (const t of list) {
      ids.push(t.id);
      if (t.subtasks?.length) ids.push(...flattenTaskIds(t.subtasks));
    }
    return ids;
  };

  const allRenderedTaskIds = useMemo(() => {
    return sortedGroups.flatMap((g) => flattenTaskIds(g.tasks || []));
  }, [sortedGroups]);

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

  const handleSortChange = (col: keyof Task | "name") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
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

  const addSubtaskInGroups = (groups: TaskGroup[], parentId: string, subtask: Task) => {
    return updateTaskInGroups(groups, parentId, (parent) => ({
      ...parent,
      subtasks: [...(parent.subtasks || []), subtask],
    }));
  };

  const addTaskToGroup = (groups: TaskGroup[], groupId: string, newTask: Task) => {
    return groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        tasks: [...(g.tasks || []), newTask],
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

  const toggleTaskExpanded = (id: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const commitInlineAdd = () => {
    if (isCommitting || !inlineDraft) {
      return;
    }
    if (!inlineDraft.name.trim()) {
      setInlineDraft(null);
      setAddingSubtaskTo(null);
      setIsCommitting(false);
      return;
    }
    setIsCommitting(true);
    const baseStatus: TaskStatus = "To Do";

    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: inlineDraft.name.trim(),
      status: baseStatus,
      priority: "normal",
      type: inlineDraft.type || "task",
      parentId: inlineDraft.parentId,
    };

    if (inlineDraft.parentId) {
      // Add as subtask to parent (works at any depth: task → subtask → subtask → …)
      onChangeTasks(addSubtaskInGroups(tasks, inlineDraft.parentId, newTask));
    } else {
      // Add to the group represented by groupKey (we store group id when clicking "Add task")
      const targetGroupId =
        inlineDraft.groupKey === "quick-add"
          ? (tasks[0]?.id || inlineDraft.groupKey)
          : inlineDraft.groupKey;
      onChangeTasks(addTaskToGroup(tasks, targetGroupId, newTask));
    }

    setInlineDraft(null);
    setAddingSubtaskTo(null);
    setIsCommitting(false);
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
          className="group border-b border-[#e5e7eb29] bg-[#111116] text-sm hover:bg-[#1a1a24] items-center"
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

        {/* Render children recursively only when expanded */}
        {
          isExpanded &&
          task.subtasks &&
          task.subtasks.map((subtask) => renderTaskRow(subtask, depth + 1, groupKey))
        }

        {/* Inline add subtask row (converted to div) */}
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
                        placeholder="Task Name or type '/' for commands"
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
                        className="w-full border-0 bg-transparent px-2 py-1 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                      />
                    </div>

                    {/* Quick Action Icons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="Link task"
                      >
                        <Package className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="AI features"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
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
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="Add description"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                        aria-label="More options"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelInlineAdd}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-[#1a1a24]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={commitInlineAdd}
                        className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
                      >
                        Save
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
        <article className="flex flex-col gap-2 px-3 py-2 text-sm">
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
    sortable?: boolean;
    field?: keyof Task | "name";
    align?: "left" | "center" | "right";
  }> = ({ label, sortable = true, field, align = "left" }) => {
    const isActive = field && sortBy === field;
    return (
      <button
        type="button"
        onClick={field ? () => handleSortChange(field) : undefined}
        className={`flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
          } ${sortable && field ? "hover:text-slate-200" : ""}`}
        aria-label={sortable && field ? `Sort by ${label}` : label}
      >
        <span>{label}</span>
        {sortable && field && (
          <ArrowUpDown
            className={`h-3 w-3 transition ${isActive ? "text-purple-500" : "text-slate-400"
              }`}
          />
        )}
      </button>
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
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
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
            <div className="relative flex-1 max-w-md">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="h-8 w-full rounded-full border border-[#e5e7eb29] bg-[#111116] px-3 pl-8 text-xs text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:bg-[#111116] focus:outline-none focus:ring-2 focus:ring-purple-100"
                aria-label="Search tasks"
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              >
                <path
                  fill="currentColor"
                  d="M8.5 3a5.5 5.5 0 0 1 4.384 8.857l2.63 2.63a1 1 0 0 1-1.414 1.415l-2.63-2.631A5.5 5.5 0 1 1 8.5 3Zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
                />
              </svg>
            </div>

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
    console.log("Sorted groups:", sortedGroups);
  }, [tasks, sortedGroups]);

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
                    className="h-10 w-full rounded-xl border border-[#e5e7eb29] bg-[#111116] px-3 text-sm text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
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
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-[#1a1a24]"
                          onClick={() => openFieldConfig("number")}
                        >
                          <Hash className="h-4 w-4 text-slate-300" />
                          <span>Number</span>
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-[#1a1a24]"
                          onClick={() => openFieldConfig("text")}
                        >
                          <Type className="h-4 w-4 text-slate-300" />
                          <span>Text</span>
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-[#1a1a24]"
                          onClick={() => openFieldConfig("date")}
                        >
                          <CalendarDays className="h-4 w-4 text-slate-300" />
                          <span>Date</span>
                        </button>
                      </div>
                    </TabsContent>
                    <TabsContent value="existing" className="mt-4">
                      <div className="rounded-xl border border-dashed border-[#e5e7eb29] p-4 text-sm text-slate-400">
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
                    <div className="text-sm font-semibold text-slate-200">
                      {selectedFieldType === "number" ? "Number" : "Field"}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-4">
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Field name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Enter name..."
                    className="h-10 w-full rounded-xl border border-[#e5e7eb29] bg-[#111116] px-3 text-sm text-slate-200 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    aria-label="Field name"
                  />
                </div>

                <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#e5e7eb29] px-4 py-4">
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-[#e5e7eb29] bg-[#111116] px-4 text-sm font-medium text-slate-300 hover:bg-[#1a1a24]"
                    onClick={closeFieldsDrawer}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
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

        {sortedGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <p className="text-sm text-slate-400">No tasks yet. Click "Add task" to get started!</p>
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
                {sortedGroups.map((group) => {
                  const groupKey = group.id;
                  const groupTasks = group.tasks || [];
                  const expanded = expandedGroups[groupKey] ?? true;
                  // Show inline draft if it matches this group, or if it's "quick-add" and this is the first group
                  const showInlineDraft = inlineDraft && (
                    (inlineDraft.groupKey === groupKey && !inlineDraft.parentId) ||
                    (inlineDraft.groupKey === "quick-add" && sortedGroups[0]?.id === groupKey && !inlineDraft.parentId)
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
                              Add task
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
                              <ColumnHeader label="Name" field="name" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Status" field="status" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Assignee" field="assignee" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Due date" field="dueDate" />
                            </div>
                            <div className="w-32 min-w-[8rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Priority" field="priority" align="center" />
                            </div>
                            <div className="w-40 min-w-[10rem] px-2 py-2 font-medium">
                              <ColumnHeader label="Tags" sortable={false} />
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

                        {expanded &&
                          groupTasks.map((task) => renderTaskRow(task, 0, groupKey))}

                        {expanded && showInlineDraft && (
                          <div className="border-b border-[#e5e7eb29] bg-[#111116]">
                            <div className="min-w-[1220px] bg-[#111116] px-3 py-2 align-middle backdrop-blur">
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
                                    placeholder="Task Name or type '/' for commands"
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
                                    className="w-full border-0 bg-transparent px-2 py-1 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                                  />
                                </div>

                                {/* Quick Action Icons */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                    aria-label="Link task"
                                  >
                                    <Package className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                    aria-label="AI features"
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                  </button>
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
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                    aria-label="Add description"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                    aria-label="More options"
                                  >
                                    <HelpCircle className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelInlineAdd}
                                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-[#1a1a24]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={commitInlineAdd}
                                    className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
                                  >
                                    Save
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-3 lg:hidden">
              {sortedGroups.map((group) => {
                const groupKey = group.id;
                const groupTasks = group.tasks || [];
                const expanded = expandedGroups[groupKey] ?? true;
                return (
                  <section
                    key={groupKey}
                    className="rounded-2xl border border-[#e5e7eb29] bg-[#111116] shadow-sm"
                  >
                    <button
                      type="button"
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
                    </button>

                    {expanded && (
                      <div className="divide-y divide-slate-100">
                        {groupTasks.map((task) => renderMobileTask(task, 0))}

                        {(inlineDraft && inlineDraft.groupKey === groupKey) ||
                          (inlineDraft &&
                            inlineDraft.groupKey === "quick-add" &&
                            sortedGroups[0]?.id === groupKey) ? (
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
                                  placeholder="Task Name or type '/' for commands"
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
                                  className="w-full border-0 bg-transparent px-2 py-1 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                                />
                              </div>
                            </div>

                            {/* Quick Action Icons Row */}
                            <div className="flex flex-wrap items-center gap-1 pl-7">
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                aria-label="Link task"
                              >
                                <Package className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                aria-label="AI features"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </button>
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
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                aria-label="Add description"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb29] bg-[#111116] text-slate-400 hover:bg-[#1a1a24]"
                                aria-label="More options"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-2 pl-7">
                              <button
                                type="button"
                                onClick={cancelInlineAdd}
                                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-[#1a1a24]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={commitInlineAdd}
                                className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
                              >
                                Save
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : null}
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

