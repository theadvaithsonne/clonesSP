

import { useState, Dispatch, SetStateAction, RefObject, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Plus, Settings, LayoutGrid, List, Baseline as Timeline, FileText, Users } from "lucide-react"
import {
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
} from "@dnd-kit/core"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, Mail, Lock, Info } from "lucide-react"
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import type { Column, Task, User, DragEvent, Employee, Member, Subtask } from "../types/kanban"
import { KanbanColumn } from "./kanban-column"
import { TaskCard } from "./task-card"
import { CreateTaskDialog } from "./create-task-dialog"
import { ManageStagesDialog } from "./manage-stages-dialog"
import { EditTaskRoom } from "./edit-task-dialog"
import { toast } from "sonner"
import RightSidePanel from "./right-side-panel"
import { PanelLeftOpen } from "lucide-react"
// import { TaskDetailsDialog } from "./task-details-dialog"
import { TimelineView } from "./timeline-view"
import { FilesView } from "./files-view"
import { ChatView } from "./chat-view"
import { ListView } from "./list-view"
import DocumentManager from "./DocumentManager"
import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import TaskroomGroupChat from "./taskroom-chat/taskroom-group-chat"
import Link from "next/link"
import { TaskSearch } from "./task-search"
import { TaskListView } from './TaskListView'
import { AICopilot } from "./ai-copilot"
import { useRouter } from 'next/navigation';  // ✅ Correct for App Router
import { usePathname } from 'next/navigation';
// import CalendarView from './clanderView'
// import { TimelineGanttView } from './timeline-gantt-chart/TimelineGanttView'
// import { GanttChart } from './Grant-Task/gantt-chart'
interface KanbanBoardProps {
    columns: Column[]
    Listcolumns: Task[]
    onTaskMove: (taskId: string, newColumnId: string, newIndex: number) => void
    onAddTask: (columnId: string) => void
    onDragStart: (taskId: string) => void
    onDragEnd: () => void
    isConnected: boolean
    currentUser: User
    collaboration: {
        onlineUsers: User[]
        activeDrags: DragEvent[]
    }
    onCreateTask: (task: Omit<Task, "id">) => void
    onUpdateColumns: (columns: Column[]) => void
    onUpdateTask: (task: Task) => void

    users: User[]
    setnewCountMenmbers: Dispatch<SetStateAction<number>>
    setColumns: Dispatch<SetStateAction<Column[]>>
    userId: string
    userRole: string
    newCountMenmbers: number
    // 

    // lastElementRef: (node: HTMLElement | null) => void; // Add this line
    currentPage: number

    isStageLoading: boolean
    loadingStages: (id: string, page: number) => void

    setHasMore: Dispatch<SetStateAction<boolean>>

    setCurrentPage: Dispatch<SetStateAction<number>>
    taskRoomId: string
    // 
    employees: Employee[]
    isLoadingEmployees: boolean
    setManageStagesOpen: Dispatch<SetStateAction<boolean>>
    manageStagesOpen: boolean

    createTaskOpen: boolean
    setCreateTaskOpen: Dispatch<SetStateAction<boolean>>
    workspaceUserId: string | undefined

    setMembers: Dispatch<SetStateAction<Member[]>>
    members: Member[]
    fetchTasksForStage: (stageId: string) => Promise<void>
    setListcolumns: Dispatch<SetStateAction<Task[]>>
    conversationId: string | undefined
    tasksList: Task[]
    stageExhausted: Record<string, boolean>


    stagecolumns: Task[];
    setStagecolumns: React.Dispatch<React.SetStateAction<Task[]>>;
    fetchListView: (page: number) => Promise<void>;
    hasMore: boolean;
    isFetching: boolean;
    nextPageToFetch: number;



    fetchMembers: (page: number, append: boolean) => Promise<void>;
    observerPage: number
    observerHasMore: boolean
    observerLoading: boolean
    subtasks: Subtask[]
    setSubtasks: React.Dispatch<React.SetStateAction<Subtask[]>>;
}

export function KanbanBoard({
    columns,
    onTaskMove,
    onAddTask,
    onDragStart,
    onDragEnd,
    isConnected,
    currentUser,
    collaboration,
    onCreateTask,
    onUpdateColumns,
    onUpdateTask,
    users, setColumns,
    currentPage,
    userId, stageExhausted,
    observerPage,
    observerHasMore, fetchMembers, setSubtasks, subtasks,
    observerLoading, setnewCountMenmbers, newCountMenmbers,
    Listcolumns, conversationId, fetchTasksForStage, tasksList, fetchListView, stagecolumns, setStagecolumns, hasMore, isFetching, nextPageToFetch,
    isStageLoading, loadingStages, taskRoomId, userRole, workspaceUserId, setMembers, members, setListcolumns,
    setHasMore, setCurrentPage, employees, isLoadingEmployees, setManageStagesOpen, manageStagesOpen, createTaskOpen, setCreateTaskOpen
}: KanbanBoardProps) {
    const [activeTab, setActiveTab] = useState("kanban")
    const [activeTask, setActiveTask] = useState<Task | null>(null)
    const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
    const [overColumnId, setOverColumnId] = useState<string | null>(null)
    const [open, setOpen] = useState(false)

    const [panelOpen, setPanelOpen] = useState(false)

    const [taskDetailsOpen, setTaskDetailsOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [defaultColumnId, setDefaultColumnId] = useState<string>("")
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeftStart = useRef(0);
    const savedScrollPosition = useRef<number>(0);
    const shouldRestoreScroll = useRef<boolean>(false);
    const [tasks, setTasks] = useState<Task[]>([])
    // 
    const handleTaskUpdate = (updatedTask: Task) => {
        setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t))
    }
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const code = searchParams.get('card');
    const taskParams = searchParams.get('task');
    console.log("zxczxcz24234234234", code, taskParams)
    // Demo users; replace with your taskroom members
    const users1 = useMemo(
        () => [
            { id: "sarah", name: "Sarah Chen", avatar: "SC", color: "hsl(210, 80%, 45%)" },
            { id: "alex", name: "Alex Rivera", avatar: "AR", color: "hsl(12, 85%, 45%)" },
            { id: "mike", name: "Mike Johnson", avatar: "MJ", color: "hsl(140, 60%, 40%)" },
            { id: "system", name: "System", avatar: "SYS", color: "hsl(0, 0%, 40%)" },
        ],
        [],
    )

    const currentUsesr: User = users1[0]
    const onlineUsers: User[] = users1.slice(0, 3)
    console.log("column", columns)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },

        }),
    )

    useEffect(() => {


        if (code) {
            setTaskDetailsOpen(true)
            setOpen(true)
            // Do something, e.g., set state
            // setIsValidCode(true);
        } else {
            // setIsValidCode(false);
        }
    }, [searchParams]);
    const handleDragEndmouse = () => {
        isDragging.current = false;
        // Reset cursor with null check
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };
    const handleDragStartMouse = useCallback((e: MouseEvent | TouchEvent) => {
        const isTouch = e.type === 'touchstart';
        const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;

        isDragging.current = true;
        startX.current = clientX;
        if (scrollContainerRef.current) {
            scrollLeftStart.current = scrollContainerRef.current.scrollLeft; // Remove optional chaining
            // Change cursor to grabbing
            scrollContainerRef.current.style.cursor = 'grabbing';
        }
    }, []);
    const handleDragMove = (e) => {
        if (!isDragging.current) return;

        e.preventDefault(); // Prevent text selection or other default behaviors
        const isTouch = e.type === 'touchmove';
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;

        const deltaX = clientX - startX.current; if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollLeftStart.current - deltaX;
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;

        // Mouse events
        if (container) {
            container.addEventListener('mousedown', handleDragStartMouse);
            container.addEventListener('mousemove', handleDragMove);
            container.addEventListener('mouseup', handleDragEndmouse);
            container.addEventListener('mouseleave', handleDragEndmouse); // Stop dragging if mouse leaves

            // Touch events
            container.addEventListener('touchstart', handleDragStartMouse);
            container.addEventListener('touchmove', handleDragMove, { passive: false });
            container.addEventListener('touchend', handleDragEndmouse);
        }
        // Cleanup event listeners on unmount
        return () => {
            if (container) {
                container.removeEventListener('mousedown', handleDragStartMouse);
                container.removeEventListener('mousemove', handleDragMove);
                container.removeEventListener('mouseup', handleDragEndmouse);
                container.removeEventListener('mouseleave', handleDragEndmouse);
                container.removeEventListener('touchstart', handleDragStartMouse);
                container.removeEventListener('touchmove', handleDragMove);
                container.removeEventListener('touchend', handleDragEndmouse);
            }
        };
    }, [handleDragStartMouse, handleDragMove, handleDragEndmouse]);

    // ──────────────────────────────────────────────────────────────
    // Preserve horizontal scroll position when columns update
    // This prevents scroll from jumping to the left when new data loads
    // Similar to how Trello handles it - works with fetch API
    // ──────────────────────────────────────────────────────────────

    // Save scroll position on scroll events (debounced to avoid excessive saves)
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let scrollTimeout: NodeJS.Timeout;
        const handleScroll = () => {
            // Clear previous timeout
            clearTimeout(scrollTimeout);

            // Debounce: save scroll position after user stops scrolling
            scrollTimeout = setTimeout(() => {
                if (container) {
                    const currentScroll = container.scrollLeft;
                    // Only save if we have a meaningful scroll position
                    if (currentScroll > 0) {
                        savedScrollPosition.current = currentScroll;
                        shouldRestoreScroll.current = true;
                    }
                }
            }, 150);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            container.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimeout);
        };
    }, []);

    // Restore scroll position after columns update (when new data loads via fetch API)
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !shouldRestoreScroll.current) return;

        // Check if scroll was unexpectedly reset (common when React re-renders)
        const currentScroll = container.scrollLeft;
        const wasReset = currentScroll === 0 && savedScrollPosition.current > 0;

        // Use requestAnimationFrame to ensure DOM has updated
        // Double RAF ensures layout is complete (Trello's approach)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (container && shouldRestoreScroll.current) {
                    // Only restore if we detect a reset or if position is significantly different
                    if (wasReset || Math.abs(container.scrollLeft - savedScrollPosition.current) > 50) {
                        container.scrollLeft = savedScrollPosition.current;
                    }
                    // Reset flag after restoration attempt
                    shouldRestoreScroll.current = false;
                }
            });
        });
    }, [columns]);

    const tabs = [
        { id: "kanban", label: "Kanban", icon: LayoutGrid },
        { id: "list", label: "List", icon: List },
        { id: "timeline", label: "Timeline", icon: Timeline },
        { id: "files", label: "Files", icon: FileText },
        // { id: "chat", label: "Chat", icon: Users },
    ]

    const baseurl = "https://uatapi.garage.app/taskroom"

    const handleDragStart = (event: DragStartEvent) => {
        // alert()
        const { active } = event
        console.log("active", active)

        // Check if it's a column being dragged
        if (active.data.current?.type === "column") {
            setActiveColumnId(active.id as string)
            return;
        }

        const task = columns.flatMap((col) => col.tasks).find((task) => task?._id === active?.id)
        console.log("task23423432", task)

        // if (task?.userId !== userId) {
        //     toast("Permission Denied");
        //     setActiveTask(null);
        //     return;
        // }
        if (task && task?._id) {

            setActiveTask(task)
            onDragStart(task?._id)
        }


    }
    console.log("activeTask", activeTask)
    const handleDragOver = (event: DragOverEvent) => {
        //  alert()
        const { active, over } = event

        if (!over) {
            setOverColumnId(null)
            return
        }

        // Check if it's a column being dragged
        if (active.data.current?.type === "column") {
            const overId = over.id as string
            // Only highlight if it's a valid column and not the last one
            const overColumn = columns.find((col) => col._id === overId)
            const lastColumnIndex = columns.length - 1
            const overColumnIndex = columns.findIndex((col) => col._id === overId)

            if (overColumn && overColumnIndex !== lastColumnIndex) {
                setOverColumnId(overId)
            } else {
                setOverColumnId(null)
            }
            return
        }

        console.log("active1", active, over)
        const activeId = active.id as string
        const overId = over.id as string

        const activeTask = columns.flatMap((col) => col.tasks).find((task) => task._id === activeId)
        if (!activeTask) return

        console.log("activeTask", activeTask)
        const overColumn = columns.find((col) => col._id === overId)
        const overTask = columns.flatMap((col) => col.tasks).find((task) => task._id === overId)
        console.log(overTask, "overTask")
        if (!overColumn && !overTask) return

        const targetColumnId = overColumn ? overColumn._id : overTask?._id
        if (!targetColumnId || activeTask._id === targetColumnId) return
    }

    const handleColumnDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        // Clear highlighting
        setActiveColumnId(null)
        setOverColumnId(null)

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the dragged column
        const activeColumnIndex = columns.findIndex((col) => col._id === activeId);
        const overColumnIndex = columns.findIndex((col) => col._id === overId);

        // Don't proceed if columns are the same or if either is not found
        if (activeColumnIndex === -1 || overColumnIndex === -1 || activeColumnIndex === overColumnIndex) {
            return;
        }

        // Prevent moving the last column
        const lastColumnIndex = columns.length - 1;
        if (activeColumnIndex === lastColumnIndex || overColumnIndex === lastColumnIndex) {
            return;
        }

        // Store original order for rollback
        const originalColumns = [...columns];

        // Reorder columns
        const updatedColumns = [...columns];
        const [draggedColumn] = updatedColumns.splice(activeColumnIndex, 1);
        updatedColumns.splice(overColumnIndex, 0, draggedColumn);

        // Update state optimistically
        setColumns(updatedColumns);

        // Create position map: { _id: index + 1 } (1-based indexing)
        const positionMap: Record<string, number> = {};
        updatedColumns.forEach((stage, index) => {
            positionMap[stage._id] = index + 1;
        });

        const positionData = {
            positionData: { ...positionMap },
        };

        try {
            const response = await fetch(`${baseurl}/v1/stages/reposition/${taskRoomId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(positionData),
            });

            if (response.ok) {
                const updatedStage = await response.json();
                if (updatedStage?.status) {
                    toast("Stages reordered successfully");
                } else {
                    // Revert on failure
                    setColumns(originalColumns);
                    toast("Failed to update stage positions");
                }
            } else {
                // Revert on HTTP error
                setColumns(originalColumns);
                toast("Failed to update stage positions");
            }
        } catch (error) {
            // Revert on network error
            setColumns(originalColumns);
            console.error("Failed to update stages:", error);
            toast("Failed to update stage positions");
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // Check if it's a column being dragged
        if (active.data.current?.type === "column") {
            handleColumnDragEnd(event);
            return;
        }

        // Clear column highlighting (in case it was set)
        setActiveColumnId(null)
        setOverColumnId(null)

        setActiveTask(null);
        onDragEnd();

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeTask = columns.flatMap((col) => col.tasks).find((task) => task._id === activeId);
        if (!activeTask) return;
        console.log("activeTask4232342342342344", workspaceUserId, userId)
        if (userRole != "admin") {
            // if (workspaceUserId !== userId) {
            //     toast("Permission Denied");
            //     setActiveTask(null);
            //     return;
            // }

            // else if (activeTask?.assignedToId !== activeTask?.assignedToId || workspaceUserId !== userId) {
            //     toast("Permission Denied1");
            //     setActiveTask(null);
            //     return;
            // }

        }
        // if (workspaceUserId !== userId) {
        //     if (activeTask?.assignedToId !== userId) {
        //         toast("Permission Denied");
        //         setActiveTask(null);
        //         return;
        //     }
        // }
        let targetColumnId: string | null = null; // Initialize as null
        let targetIndex = 0;

        const overColumn = columns.find((col) => col._id === overId);
        const overTask = columns.flatMap((col) => col.tasks).find((task) => task._id === overId);

        if (overColumn) {
            targetColumnId = overColumn._id; // _id is guaranteed to be string
            targetIndex = overColumn.tasks.length;
        } else if (overTask && overTask.stageId) { // Check if stageId exists
            targetColumnId = overTask.stageId; // stageId is string if it exists
            const targetColumn = columns.find((col) => col._id === targetColumnId);
            if (targetColumn) {
                targetIndex = targetColumn.tasks.findIndex((task) => task._id === overId);
            }
        } else {
            return;
        }

        if (activeTask.columnId !== targetColumnId) {
            onTaskMove(activeId, targetColumnId, targetIndex);
        }
    };

    const [initialStageId, setInitialStageId] = useState<string | undefined>(undefined)

    const handleGlobalAddTask = () => {
        // setDefaultColumnId(columns[0]?._id || "backlog")
        setInitialStageId(undefined)
        setCreateTaskOpen(true)
    }

    const handleColumnAddTask = (columnId: string) => {
        // setDefaultColumnId(columnId)
        setInitialStageId(columnId)
        setCreateTaskOpen(true)
    }

    const handleTaskClick = (task: Task) => {
        // alert(task)


        setSelectedTask(task)
        setTaskDetailsOpen(true)
        setOpen(true)
    }

    const handleTaskSave = (updatedTask: Task) => {
        onUpdateTask(updatedTask)
    }




    const handleRemoveShare = () => {
        // Create a mutable copy of the current search params
        const params = new URLSearchParams(searchParams.toString());

        // Remove the 'share' parameter
        params.delete('card');
        params.delete('task');
        // Update the URL (use replace to avoid adding to history, or push if you want to)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    const closeEditTaskRoom = () => {
        if (code) {
            handleRemoveShare()
        }

        setOpen(false)
    }
    const getTextColor = (backgroundColor: string) => {
        const hslMatch = backgroundColor.match(/hsl$$(\d+),\s*(\d+)%,\s*(\d+)%$$/)
        if (!hslMatch) return "text-white"

        const [, h, s, l] = hslMatch.map(Number)

        return l > 60 ? "text-gray-900" : "text-white"
    }
    console.log("1234234423", columns)
    function handleUpdateTask(updated) {
        // eslint-disable-next-line no-console
        console.log("[v0] Task updated:", updated)
    }
    console.log("cxnzjkmfduytfsd", columns)













    return (
        <div className="flex-1 flex flex-col bg-[#0e0e12] w-full min-h-0"
            style={{
                marginBottom: "0px"
            }}
        >
            <div className="flex items-center justify-between p-6 pt-0 border-b border-[#e5e7eb29]">
                <div className="flex items-center gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <Button
                                key={tab.id}
                                variant={activeTab === tab.id ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setActiveTab(tab.id)}
                                className={activeTab === tab.id ? "text-white bg-[#1e1e2d] flex items-center gap-2 text-sm border border-[#e5e7eb29]" : "flex items-center gap-2 text-sm text-gray-400 hover:text-white hover:bg-[#1e1e2d]"}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </Button>
                        )
                    })}
                    {/* <div className="w-full max-w-sm">
                        <TaskSearch
                            roomId={taskRoomId}
                            onTaskClick={handleTaskClick}
                            employees={employees}
                        />
                    </div> */}
                </div>
                {!panelOpen && (
                    <Button
                        aria-label="Open Project Panel"
                        onClick={() => setPanelOpen(true)}
                        className="fixed right-8 top-4 z-50 rounded-full shadow bg-[#0e0e12] border-[#e5e7eb29] text-gray-400 hover:text-white"
                        variant="outline"
                        size="icon"
                    >
                        <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                )}
                {/* <div className="flex items-center gap-4">




                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setManageStagesOpen(true)}
                    >
                        <Settings className="h-4 w-4" />
                        Stages
                    </Button>

                    <Button
                        size="sm"
                        className="flex items-center gap-2 bg-black text-white hover:bg-gray-800"
                        onClick={handleGlobalAddTask}
                    >
                        <Plus className="h-4 w-4" />
                        Add Task
                    </Button>
                </div> */}
            </div>
            <div className="flex-1 flex relative min-h-0">
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === "kanban" && (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="h-full p-6">
                                <SortableContext
                                    items={columns.map((col) => col._id)}
                                    strategy={horizontalListSortingStrategy}
                                >
                                    <div className="flex gap-8 h-full overflow-x-auto scrollbar-hidden"
                                        // ref={index === columns.length - 1 ? lastElementRef : null}

                                        ref={scrollContainerRef}
                                        style={{
                                            msOverflowStyle: 'none', // IE and Edge
                                            scrollbarWidth: 'none', // Firefox
                                            cursor: 'grab', // Initial cursor style
                                            userSelect: 'none', // Prevent text selection during drag
                                        }}
                                    >

                                        {/* {columns?.map((column) => (
                                            <SortableContext
                                                key={column?._id}

                                                items={column?.tasks?.map((task) => task._id).filter((id): id is string => id !== undefined) || []}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <KanbanColumn
                                                    column={column}
                                                    activeDrags={collaboration.activeDrags}
                                                    onAddTask={handleColumnAddTask}
                                                    onTaskClick={handleTaskClick}
                                                    employees={employees}
                                                    stageList={columns}
                                                    fetchTasksForStage={fetchTasksForStage}
                                                />
                                            </SortableContext>
                                        ))} */}

                                        {columns?.map((column, index) => {
                                            // Deduplicate tasks by _id
                                            const uniqueTasks = Array.from(
                                                new Map(
                                                    column?.tasks?.map((task) => [task._id, task]) || []
                                                ).values()
                                            );

                                            const taskIds = uniqueTasks
                                                .map((task) => task._id)
                                                .filter((id): id is string => !!id);

                                            const isLastColumn = index === columns.length - 1;
                                            const isDragOver = overColumnId === column._id;
                                            const isDragging = activeColumnId === column._id;

                                            return (
                                                <SortableContext
                                                    key={column._id}
                                                    items={taskIds}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    <KanbanColumn
                                                        column={{
                                                            ...column,
                                                            tasks: uniqueTasks, // Pass deduplicated tasks to child
                                                        }}
                                                        activeDrags={collaboration.activeDrags}
                                                        onAddTask={handleColumnAddTask}
                                                        onTaskClick={handleTaskClick}
                                                        employees={employees}
                                                        stageList={columns}
                                                        fetchTasksForStage={fetchTasksForStage}
                                                        stageExhausted={stageExhausted}
                                                        isSortable={true}
                                                        isLastColumn={isLastColumn}
                                                        isDragOver={isDragOver}
                                                        isDragging={isDragging}
                                                    />
                                                </SortableContext>
                                            );
                                        })}
                                    </div>
                                </SortableContext>
                            </div>

                            <DragOverlay>
                                {activeTask ? (
                                    <div className="rotate-3 opacity-90">
                                        <TaskCard stageList={columns} task={activeTask} index={0} isDragging employees={employees} />
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                    {activeTab === "timeline" &&
                        // <GanttChart tasks={tasks} onTaskUpdate={handleTaskUpdate} />


                        // <TimelineGanttView
                        //     stagecolumns={stagecolumns}
                        // />

                        <TimelineView
                            columns={columns}
                            stagecolumns={stagecolumns}
                            // onCreateTask={onCreateTask}
                            employees={employees}
                            fetchListView={fetchListView}
                            hasMore={hasMore}
                            isFetching={isFetching}
                            nextPageToFetch={nextPageToFetch}
                            onTaskClick={handleTaskClick}
                        />
                    }

                    {activeTab === "list" &&

                        // <TaskListView
                        //     columns={columns}
                        //     activeDrags={collaboration.activeDrags}
                        //     onAddTask={handleColumnAddTask}
                        //     onTaskClick={handleTaskClick}
                        //     employees={employees}
                        //     stageList={columns}
                        //     fetchTasksForStage={fetchTasksForStage}
                        //     stageExhausted={stageExhausted}

                        // />



                        <ListView

                            fetchListView={fetchListView} onTaskMove={onTaskMove}
                            columns={columns}
                            users={users}
                            employees={employees}
                            stagecolumns={stagecolumns}
                            setStagecolumns={setStagecolumns}
                            hasMore={hasMore}
                            isFetching={isFetching}
                            nextPageToFetch={nextPageToFetch}



                        />
                    }
                    {activeTab === "chat" && (

                        <TaskroomGroupChat conversationId={conversationId}
                            currentUser={userId}
                            employees={employees}
                        />
                        // <ChatView users={users1} employees={employees} currentUser={userId} onlineUsers={onlineUsers} conversationId={conversationId} />
                    )}
                    {activeTab === "files" && <FilesView employees={employees} taskRoomId={taskRoomId} currentUser={userId} />}
                    {/* {activeTab === "files" && <DocumentManager />} */}

                    {activeTab !== "kanban" &&
                        activeTab !== "timeline" &&
                        activeTab !== "files" &&
                        activeTab !== "chat" &&
                        activeTab !== "list" && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <div className="text-lg font-medium mb-2">Coming Soon</div>
                                    <div className="text-sm">{tabs.find((t) => t.id === activeTab)?.label} view is under development</div>
                                </div>
                            </div>
                        )}
                </div>
                {
                    activeTab != "chat" &&
                    <>
                        {panelOpen ? (
                            <div className={`w-full max-w-[300px] w-[300px] border-l`}>
                                <RightSidePanel
                                    fetchMembers={fetchMembers}
                                    observerPage={observerPage}
                                    observerHasMore={observerHasMore}
                                    observerLoading={observerLoading}
                                    setnewCountMenmbers={setnewCountMenmbers}
                                    setColumns={setColumns}
                                    setStagecolumns={setStagecolumns}
                                    columns={columns}
                                    newCountMenmbers={newCountMenmbers}
                                    employees={employees} roomId={taskRoomId} userId={userId} workspaceUserId={workspaceUserId} conversationId={conversationId} setMembers={setMembers} members={members} onClose={() => setPanelOpen(false)} />
                            </div>
                        ) : null}
                    </>
                }


            </div>
            <ManageStagesDialog
                open={manageStagesOpen}
                onOpenChange={setManageStagesOpen}
                columns={columns}
                onUpdateColumns={onUpdateColumns}
                setColumns={setColumns}
                currentPage={currentPage}
                hasMore={hasMore}
                isStageLoading={isStageLoading}
                userId={userId}

                setHasMore={setHasMore}
                setCurrentPage={setCurrentPage}
                taskRoomId={taskRoomId}
            />


            <CreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                columns={columns}
                userId={userId}
                onCreateTask={onCreateTask}
                taskRoomId={taskRoomId}
                employees={employees}
                isLoadingEmployees={isLoadingEmployees}
                conversationId={conversationId}
                setMembers={setMembers}
                members={members}
                initialStageId={initialStageId}
            />

            <EditTaskRoom
                open={open}
                onOpenChange={setOpen}
                task={selectedTask}
                userId={userId}
                columns={columns}
                employees={employees}
                onCancel={closeEditTaskRoom}
                setColumns={setColumns}
                roomId={taskRoomId}
                workspaceUserId={workspaceUserId}
                userRole={userRole}
                conversationId={conversationId}
                subtasks={subtasks}
                setSubtasks={setSubtasks}
                setStagecolumns={setStagecolumns}
            />
            {/* 

   

      <TaskDetailsDialog
        task={selectedTask}
        isOpen={taskDetailsOpen}
        onClose={() => setTaskDetailsOpen(false)}
        onSave={handleTaskSave}
        users={users}
        columns={columns}
      /> */}
            <AICopilot
                columns={columns}
                setColumns={setColumns}
                userId={userId}
                taskRoomId={taskRoomId}
                stagecolumns={stagecolumns}
                setStagecolumns={setStagecolumns}
                hasMore={hasMore}
                isFetching={isFetching}
                fetchListView={fetchListView}
                nextPageToFetch={nextPageToFetch}
            />
        </div>
    )
}
