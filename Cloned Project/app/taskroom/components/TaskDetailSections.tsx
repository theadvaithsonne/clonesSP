import React, { useState } from "react";
import {
    ChevronRight, ChevronDown, MoreHorizontal, Plus,
    User as UserIcon, Calendar, Flag, Link2, CheckCircle2, Circle,
    ArrowUpDown, Maximize2, Sparkles, Trash2, UserPlus, Check // Added Trash2, UserPlus, Check
} from "lucide-react";
import { Task, Checklist, ChecklistItem, TaskPriority } from "./ListView";
import { cn } from "@/lib/utils";
import { AssigneePicker } from "./assignee-picker";

// --- Subtasks Component ---

interface TaskSubtasksProps {
    subtasks: Task[];
    onAddSubtask: () => void;
}

export const TaskSubtasks: React.FC<TaskSubtasksProps> = ({ subtasks, onAddSubtask }) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggleExpand = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const completedCount = subtasks.filter(t => t.status === "Done" || t.status === "Complete").length;
    const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

    return (
        <div className="mb-8">
            {/* Main Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">Subtasks</h3>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-400" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-400">{completedCount}/{subtasks.length}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <button className="flex items-center gap-1 hover:text-gray-900"><ArrowUpDown className="h-3 w-3" /> Sort</button>
                    <button className="hover:text-gray-900">Expand all</button>
                    <button className="hover:text-gray-900"><Maximize2 className="h-3 w-3" /></button>
                    <button className="flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium">
                        <Sparkles className="h-3 w-3" /> Suggest subtasks
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_80px_80px_100px_40px] items-center bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-medium text-gray-500">
                    <div>Name</div>
                    <div>Assignee</div>
                    <div>Priority</div>
                    <div>Due date</div>
                    <div className="flex justify-center"><Plus className="h-3.5 w-3.5 cursor-pointer hover:text-gray-900" /></div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-100">
                    {subtasks.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-400">No subtasks yet</div>
                    ) : (
                        subtasks.map(task => (
                            <SubtaskRow key={task.id} task={task} expanded={expanded} toggleExpand={toggleExpand} depth={0} />
                        ))
                    )}
                </div>

                {/* Footer Add Button */}
                <button
                    onClick={onAddSubtask}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Add Task
                </button>
            </div>
        </div>
    );
};

const SubtaskRow: React.FC<{
    task: Task;
    expanded: Record<string, boolean>;
    toggleExpand: (id: string) => void;
    depth: number;
}> = ({ task, expanded, toggleExpand, depth }) => {
    const hasChildren = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expanded[task.id];

    return (
        <>
            <div className="grid grid-cols-[1fr_80px_80px_100px_40px] items-center px-4 py-2 hover:bg-gray-50 group transition-colors">
                {/* Name Column */}
                <div className="flex items-center gap-2 overflow-hidden" style={{ paddingLeft: `${depth * 20}px` }}>
                    <button
                        onClick={() => toggleExpand(task.id)}
                        className={cn("p-0.5 rounded hover:bg-gray-200 text-gray-400", !hasChildren && "invisible")}
                    >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>

                    <div className="h-4 w-4 rounded-full border border-dashed border-gray-400 flex-shrink-0"></div>
                    <span className="text-sm text-gray-700 truncate font-medium">{task.name}</span>
                    {/* Mock link icon/count from screenshot */}
                    <div className="flex items-center gap-0.5 text-xs text-gray-400 ml-2">
                        <Link2 className="h-3 w-3" />
                        <span>2</span>
                    </div>
                </div>

                {/* Assignee */}
                <div className="flex justify-center sm:justify-start">
                    {task.assignee ? (
                        <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white">
                            {task.assignee.substring(0, 2).toUpperCase()}
                        </div>
                    ) : (
                        <div className="h-6 w-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 cursor-pointer">
                            <UserIcon className="h-3 w-3" />
                        </div>
                    )}
                </div>

                {/* Priority */}
                <div className="flex justify-center sm:justify-start">
                    <Flag className={cn("h-4 w-4",
                        task.priority === 'urgent' ? "text-red-500 fill-red-500" :
                            task.priority === 'high' ? "text-orange-500" : "text-gray-300"
                    )} />
                </div>

                {/* Due Date */}
                <div className="flex justify-center sm:justify-start">
                    <Calendar className="h-4 w-4 text-gray-300 hover:text-gray-500 cursor-pointer" />
                </div>

                {/* Actions */}
                <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-gray-200 rounded text-gray-500">
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Recursive Children */}
            {isExpanded && hasChildren && task.subtasks!.map(sub => (
                <SubtaskRow key={sub.id} task={sub} expanded={expanded} toggleExpand={toggleExpand} depth={depth + 1} />
            ))}
        </>
    );
};


// --- Checklists Component ---

interface TaskChecklistsProps {
    checklists: Checklist[];
    onAddChecklist: (title: string) => void;
    onAddItem: (checklistId: string, text: string) => void;
    onToggleItem: (itemId: string, currentVal: boolean) => void;
    onDeleteItem: (itemId: string) => void;
}

export const TaskChecklists: React.FC<TaskChecklistsProps> = ({ checklists, onAddChecklist, onAddItem, onToggleItem, onDeleteItem }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [checklistTitle, setChecklistTitle] = useState("");

    // Calculate total progress
    const totalItems = checklists.reduce((acc, c) => acc + (c.checklistData?.length || 0), 0);
    const totalCompleted = checklists.reduce((acc, c) => acc + (c.checklistData?.filter(i => i.isCompleted).length || 0), 0);
    const totalProgress = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0;

    const handleAddChecklist = () => {
        if (checklistTitle.trim()) {
            onAddChecklist(checklistTitle);
            setChecklistTitle("");
            setIsAdding(false);
        }
    };

    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Checklists</h3>
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-12 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400" style={{ width: `${totalProgress}%` }}></div>
                    </div>
                    <span className="text-xs text-gray-400">{totalCompleted}/{totalItems}</span>
                </div>
            </div>

            <div className="space-y-6">
                {checklists.map(checklist => (
                    <ChecklistGroup
                        key={checklist._id || checklist.name}
                        checklist={checklist}
                        onAddItem={(text) => onAddItem(checklist._id || "", text)}
                        onToggle={(itemId, currentVal) => onToggleItem(itemId, currentVal)}
                        onDelete={(itemId) => onDeleteItem(itemId)}
                    />
                ))}
            </div>

            {isAdding ? (
                <div className="mt-4 bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Checklist name"
                        className="w-full text-sm font-medium text-gray-900 focus:outline-none placeholder:text-gray-400"
                        value={checklistTitle}
                        onChange={(e) => setChecklistTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddChecklist();
                            if (e.key === 'Escape') setIsAdding(false);
                        }}
                        onBlur={() => {
                            if (!checklistTitle.trim()) setIsAdding(false);
                            else handleAddChecklist();
                        }}
                    />
                </div>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className="mt-4 flex items-center gap-2 px-0 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Add checklist
                </button>
            )}
        </div>
    );
}

const ChecklistGroup: React.FC<{
    checklist: Checklist;
    onAddItem: (text: string) => void;
    onToggle: (itemId: string, currentVal: boolean) => void;
    onDelete: (itemId: string) => void;
}> = ({ checklist, onAddItem, onToggle, onDelete }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newItemText, setNewItemText] = useState("");

    const items = checklist.checklistData || [];
    const completed = items.filter(i => i.isCompleted).length;
    const total = items.length;

    const handleAddItem = () => {
        if (newItemText.trim()) {
            onAddItem(newItemText);
            setNewItemText("");
            setIsAdding(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    {checklist.name}
                    <span className="text-gray-400 font-normal text-sm">{completed} of {total}</span>
                </h4>
            </div>

            <div className="space-y-3">
                {items.map(item => (
                    <div key={item._id} className="group flex items-center gap-3 py-1.5">
                        <button
                            onClick={() => onToggle(item._id || "", item.isCompleted)}
                            className={cn(
                                "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all",
                                item.isCompleted
                                    ? "bg-zinc-900 border-zinc-900"
                                    : "border-gray-300 hover:border-gray-400 bg-white"
                            )}>
                            {item.isCompleted && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </button>
                        <span className={cn("text-sm flex-1", item.isCompleted ? "text-gray-400 line-through" : "text-gray-700")}>
                            {item.description}
                        </span>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onDelete(item._id || "")}
                                className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <AssigneePicker
                                assignee={item.assignee}
                                onSelect={(name) => {
                                    // Update assignee logic would go here
                                    console.log("Selected assignee:", name);
                                }}
                            >
                                {item.assignee ? (
                                    <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white cursor-pointer ring-2 ring-white shadow-sm hover:scale-110 transition-transform">
                                        {item.assignee.substring(0, 2).toUpperCase()}
                                    </div>
                                ) : (
                                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                                        <UserPlus className="h-4 w-4" />
                                    </button>
                                )}
                            </AssigneePicker>
                        </div>
                    </div>
                ))}

                {isAdding ? (
                    <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md -mx-3">
                        <div className="h-5 w-5 border border-gray-300 rounded-full bg-white flex-shrink-0"></div>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Add item"
                            className="flex-1 text-sm text-gray-700 focus:outline-none placeholder:text-gray-400 bg-transparent"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddItem();
                                if (e.key === 'Escape') setIsAdding(false);
                            }}
                            onBlur={() => {
                                if (!newItemText.trim()) setIsAdding(false);
                            }}
                        />
                        <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full">
                            <UserPlus className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 px-0"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Add item</span>
                    </button>
                )}
            </div>
        </div>
    )
}
