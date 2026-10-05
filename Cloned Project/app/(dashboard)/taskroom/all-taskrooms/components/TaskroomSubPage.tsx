"use client"

import { useEffect, useState, useCallback, useRef } from "react"

import { KanbanBoard } from "../componentsSymbol/kanban-board"
import { Skeleton } from '@/components/ui/skeleton'; // Assuming shadcn/ui Skeleton component
import { useRouter } from "next/navigation"
import { ManageStagesDialog } from "../componentsSymbol/manage-stages-dialog"
import type { Task, Column, User, DragEvent, Employee, Department, Member, Subtask } from "../types/kanban"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import Cookies from 'js-cookie';
import { useInView } from 'react-intersection-observer'
import { useParams } from "next/navigation"
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { AlertCircle, Clock } from "lucide-react"
import { useSearchParams } from 'next/navigation';
// import { useAuthStore } from "@/store/authStore";
import { jwtDecode } from 'jwt-decode'   // ← import here
interface JwtPayload {
    // Adjust these fields according to YOUR actual JWT payload
    sub?: string        // user id
    name?: string
    email?: string
    role?: string
    exp?: number
    orgId?: string
    iat?: number
    userId?: string
    // ... add any custom claims like garageId, permissions, etc.
    [key: string]: any
}
import {
    Plus,
    Settings,
    Star,
    ChevronLeft,
    ChevronLeft as ChatBubbleOvalLeft,
    List,
    Baseline as Timeline,
    Folder,
    KanbanIcon,
} from "lucide-react"
const initialColumns: Column[] = [
    { _id: "backlog", name: "Backlog", tasks: [], color: "bg-gray-500" },
    { _id: "in-progress", name: "In Progress", tasks: [], color: "bg-blue-500" },
    { _id: "review", name: "Review", tasks: [], color: "bg-yellow-500" },
    { _id: "done", name: "Done", tasks: [], color: "bg-green-500" },
]

const initialTasks: Task[] = [
    // ... (your existing initialTasks array remains unchanged)
]

interface CollaborationState {
    onlineUsers: User[]
    activeDrags: DragEvent[]
}

const generateAccessibleColor = () => {
    const accessibleColors = [
        "hsl(220, 70%, 45%)",
        "hsl(340, 70%, 45%)",
        "hsl(160, 70%, 35%)",
        "hsl(280, 70%, 45%)",
        "hsl(25, 70%, 45%)",
        "hsl(200, 70%, 40%)",
        "hsl(300, 60%, 40%)",
        "hsl(120, 60%, 35%)",
    ]
    return accessibleColors[Math.floor(Math.random() * accessibleColors.length)]
}

const sampleUsers: User[] = [
    // ... (your existing sampleUsers array remains unchanged)
]

const baseurl = "https://uatapi.garage.app/taskroom"

const currentUser: User = {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    name: `User ${Math.floor(Math.random() * 1000)}`,
    avatar: `U${Math.floor(Math.random() * 100)}`,
    color: generateAccessibleColor(),
}
interface Workspace {
    _id: string;
    name: string;
    description: string;
    color: string;
    isFavorite: boolean;
    orgId: string;
    userId: string;
    finalStageId: string;
    taskCount: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
    conversationId: string
    roomUsers: []
}

interface PaginationMeta {
    currentPage: number;
    totalPages: number;
    nextPage: number | null;
    prevPage: number | null;
    totalItems?: number;
    pageSize?: number;
}
interface ApiResponse {
    status: boolean;
    data: Workspace;
}
export default function Home() {
    const [subtasks, setSubtasks] = useState<Subtask[]>([])
    const [columns, setColumns] = useState<Column[]>([])
    const [Listcolumns, setListcolumns] = useState<Task[]>([])
    const [tasks, setTasks] = useState<Task[]>(initialTasks)
    const [tasksList, settasksList] = useState<Task[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [isStageLoading, setIsStageLoading] = useState(false)
    const [isTaskLoading, setisTaskLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [userId, setuserId] = useState("")
    const [createTaskOpen, setCreateTaskOpen] = useState(false)
    const [stageExhausted, setStageExhausted] = useState<Record<string, boolean>>({});
    // 
    const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    // 
    const [manageStagesOpen, setManageStagesOpen] = useState(false)
    const searchParams = useSearchParams();
    const taskRoomId = searchParams.get('taskroomId');
    // const { symbol } = useParams()
    // const taskRoomId = symbol as string
    const [stageTotalPages, setStageTotalPages] = useState(1);
    const [taskTotalPages, setTaskTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [stagePage, setStagePage] = useState(1);
    const [taskPage, setTaskPage] = useState(1);
    const observer = useRef<IntersectionObserver | null>(null);
    // const allStages = useRef<Column[]>([]);
    const allTasks = useRef<Task[]>([]);
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [stagePages, setStagePages] = useState<{ [stageId: string]: number }>({})  // Per-stage page tracking
    const [listviewPagination, setlistviewPagination] = useState(1);
    const [members, setMembers] = useState<Member[]>([]
    )
    const [mounted, setMounted] = useState(false)
    const [newCountMenmbers, setnewCountMenmbers] = useState(0)
    const [stagecolumns, setStagecolumns] = useState<Task[]>([]);
    const [nextPageToFetch, setNextPageToFetch] = useState<number>(1);
    // const [hasMore, setHasMore] = useState<boolean>(true);
    const [isFetching, setIsFetching] = useState<boolean>(false)
    // 
    const [stageMeta, setStageMeta] = useState<Record<string, PaginationMeta>>({});      // keep the whole metadata object
    const [collaboration, setCollaboration] = useState<CollaborationState>({
        onlineUsers: [],
        activeDrags: [],
    })

    const [observerPage, setObserverPage] = useState(1)
    const [observerHasMore, setObserverHasMore] = useState(true)
    const [observerLoading, setObserverLoading] = useState(false)

    const [userRole, setuserRole] = useState("")
    console.log("4234234", columns)
    const { ref: ref, inView } = useInView({
        threshold: 0,
        rootMargin: '100px',
    })
    console.log("current", currentPage)
    const router = useRouter()
    // const {
    //     user,
    //     logout,
    // } = useAuthStore();
    const [isManageDialogOpen, setIsManageDialogOpen] = useState(false)
    const colorStyles = {
        blue: {
            indicator: "bg-blue-500",
            progress: "bg-blue-500",
            progressBg: "bg-blue-100",
        },
        green: {
            indicator: "bg-green-500",
            progress: "bg-green-500",
            progressBg: "bg-green-100",
        },
        purple: {
            indicator: "bg-purple-500",
            progress: "bg-purple-500",
            progressBg: "bg-purple-100",
        },
        orange: {
            indicator: "bg-orange-500",
            progress: "bg-orange-500",
            progressBg: "bg-orange-100",
        },
        pink: {
            indicator: "bg-pink-500",
            progress: "bg-pink-500",
            progressBg: "bg-pink-100",
        },
    }

    console.log("members234234234taskRoomId", taskRoomId)
    console.log("nmvxcnvmxnvbxmncvxcvxcvxcv", columns)




    useEffect(() => {
        const userData = localStorage.getItem("garage_tok")
        if (userData) {
            const payload = jwtDecode<JwtPayload>(userData)
            console.log("payload", payload)
            // setDecoded(payload)
            try {
                if (payload?.orgId && payload?.userId) {

                    fetchEmployees();
                    setuserId(payload.userId)
                    fetchWorkspace(payload.orgId, payload.userId);
                }
                if (payload?.role) {
                    setuserRole(payload.role)
                }
            } catch (error) {
                console.error("Error parsing userData:", error)
            }
        }
    }, [router])










    console.log("vkcvxcvxcv", members)
    const fetchWorkspace = async (id: string, userId: string) => {
        try {

            const response = await fetch(`https://uatapi.garage.app/taskroom/v1/rooms/detail?orgId=${id}&roomId=${taskRoomId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                toast('Failed to fetch Taskrom data')
            }

            const result: ApiResponse = await response.json();
            if (result?.status) {
                setWorkspace(result.data?.[0]);
                const roomUsers = result.data[0].roomUsers;




                const isAuthorized =
                    roomUsers.some(user => user.userId === userId) ||
                    result.data[0].userId === userId;
                setLoading(false);
                if (isAuthorized) {
                    // Allow access
                } else {
                    // Deny access (unauthorized)
                    toast("Unauthorized access");
                    router.push(`/all-taskrooms`)
                }

            }
            else {
                toast('Failed to fetch Taskrom data')
            }

        } catch (err) {

            setLoading(false);
        }
    };


    const handleLogout = async () => {
        // await logout();
        router.push("/login");
    };
    // Intersection Observer callback


    // Fetch data when page changes
    console.log('listcolumns', Listcolumns)
    // ─────────────────────────────────────────────────────────────────────
    // 1. FETCH STAGES – Parallel, One-Time, No Re-renders
    // ─────────────────────────────────────────────────────────────────────
    // ... (all your existing imports)

    // ... (rest of your state)

    // ─────────────────────────────────────────────────────────────────────
    // 1. FETCH STAGES – Parallel, One-Time, No Re-renders
    // ─────────────────────────────────────────────────────────────────────
    const fetchStagesAndTasks = useCallback(async () => {
        setIsLoading(true);

        try {
            const firstRes = await fetch(`${baseurl}/v1/stages/task?roomId=${taskRoomId}&size=30`);

            if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
            const firstJson = await firstRes.json();
            const totalPages = firstJson.totalPages ?? 1;
            const allStages: Column[] = (firstJson.data ?? []) as Column[];
            const initializedColumns = allStages.map((col) => ({
                ...col,
                tasks: col?.paginatedTaskRecords || [], // Tasks loaded lazily
            }));

            setColumns(initializedColumns);

            // Initialize stagePages to 2 (assuming /stages/task loads page 0 or first page)
            const newStagePages: { [stageId: string]: number } = {};
            initializedColumns.forEach(col => {
                newStagePages[col._id] = 1;
            });
            setStagePages(newStagePages);

            // Pre-load the second page for each stage to set default to 2
            // await Promise.all(initializedColumns.map(col => fetchTasksForStage(col._id)));
        } catch (error: any) {
            console.error("[fetchStagesAndTasks] Error:", error);
            toast.error("Failed to load stages");
        } finally {
            setIsLoading(false);
        }
    }, [taskRoomId, baseurl]);



    const fetchTasksForStage = useCallback(
        async (stageId: string) => {
            const col = columns.find(c => c._id === stageId);
            if (!col) return;

            // Guard – already exhausted?
            if (stageExhausted[stageId]) return;

            try {
                const pageSize = 30;
                const currentPg = stagePages[stageId] ?? 1;
                const nextPg = currentPg + 1;

                // Optimistic stop – we already know there is no next page
                const cachedMeta = stageMeta[stageId];
                if (cachedMeta && (cachedMeta.nextPage === null || nextPg > cachedMeta.totalPages)) {
                    setStageExhausted(prev => ({ ...prev, [stageId]: true }));
                    return;
                }

                const resp = await fetch(
                    `${baseurl}/v1/tasks?roomId=${taskRoomId}&stageId=${stageId}` +
                    `&status=active&size=${pageSize}&page=${nextPg}`
                );

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const payload = await resp.json();
                const moreTasks: Task[] = payload.data ?? [];
                const responseMeta = payload.metadata ?? {};

                // Store meta for the *next* call
                setStageMeta(prev => ({ ...prev, [stageId]: responseMeta }));
                setStagePages(prev => ({ ...prev, [stageId]: nextPg }));

                // No more data → mark exhausted
                if (moreTasks.length === 0 || responseMeta.nextPage === null) {
                    setStageExhausted(prev => ({ ...prev, [stageId]: true }));
                }

                // Append tasks
                setColumns(prev =>
                    prev.map(c =>
                        c._id === stageId
                            ? { ...c, tasks: [...(c.tasks ?? []), ...moreTasks] }
                            : c
                    )
                );
            } catch (err) {
                console.error(`[fetchTasksForStage] ${stageId}`, err);
                toast.error("Failed to load more tasks");
            }
        },
        [
            columns,
            stageExhausted,
            stagePages,
            stageMeta,
            taskRoomId,
            setStageExhausted,
            setStageMeta,
            setStagePages,
            setColumns,
        ]
    );
    //    list

    useEffect(() => {
        fetchListView(1);
    }, [])


    const fetchMembers = async (page: number, append = false) => {
        if (!taskRoomId) return;

        setObserverLoading(true);
        try {
            const url = new URL("https://uatapi.garage.app/taskroom/v1/users/roles");
            url.searchParams.set("roomId", taskRoomId);
            url.searchParams.set("size", "50");
            url.searchParams.set("page", page.toString());

            const res = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) throw new Error("Network error");
            const { status, data, metadata } = await res.json();

            if (status && data) {
                const newItems: Member[] = data;
                const meta = metadata ?? {
                    count: 0,
                    totalPages: 1,
                    currentPage: 1,
                    nextPage: null,
                };

                setObserverHasMore(!!meta.nextPage);
                setObserverPage(meta.currentPage);
                setnewCountMenmbers(data?.length)
                setMembers((prev) => (append ? [...prev, ...newItems] : newItems));
            } else {
                toast("Failed to fetch member data");
            }
        } catch (err) {
            console.error(err);
            toast("Failed to fetch member data");
        } finally {
            setObserverLoading(false);
        }
    };

    useEffect(() => {
        if (taskRoomId) fetchMembers(1, false);
    }, [taskRoomId, columns, subtasks]);


    // useEffect(() => {
    //     if (taskRoomId) fetchMembers(1, false);
    // }, [taskRoomId]);




    const fetchListView = async (page: number) => {
        if (isFetching || !hasMore) return;

        setIsFetching(true);
        try {
            const response = await fetch(
                `https://uatapi.garage.app/taskroom/v1/tasks?roomId=${taskRoomId}&size=50&page=${page}`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();
            const moreTasks: Task[] = json.data ?? [];
            const metadata = json.metadata ?? {};

            const { nextPage, totalPages, currentPage } = metadata;

            // Append new tasks
            setStagecolumns((prev) => [...prev, ...moreTasks]);

            // Update next page
            if (nextPage && currentPage < totalPages) {
                setNextPageToFetch(nextPage);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error("[fetchListView]", err);
            toast.error("Failed to load more tasks");
        } finally {
            setIsFetching(false);
        }
    };
    console.log("settasksList", tasksList)

    const loadingStages = async () => {
        if (isStageLoading) return;

        setIsStageLoading(true);
        try {
            let currentPage = 1;
            let totalPages = 1;

            while (currentPage <= totalPages) {
                const response = await fetch(
                    `${baseurl}/v1/stages?roomId=${taskRoomId}&status=active&size=15&page=${currentPage}`
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data?.data?.length > 0) {
                    // setColumns(prev => [
                    //     ...prev,
                    //     ...data.data.map(item => ({ tasks: [item] }))
                    // ]);
                    // setColumns(prev => [
                    //     ...prev,
                    //     ...data.data.map(item => ({ ...item, tasks: [] }))
                    // ]);
                }

                if (data?.metadata) {
                    totalPages = data.metadata.totalPages;
                    currentPage = data.metadata.nextPage || currentPage + 1;
                } else {
                    break;
                }

                // Add a small delay to prevent performance issues
                if (currentPage <= totalPages) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            //setHasMore(currentPage <= totalPages);
        } catch (error) {
            console.error("Failed to fetch pipelines:", error);
        } finally {
            setIsStageLoading(false);
        }
    };





    useEffect(() => {
        fetchStagesAndTasks()

    }, [])



    const fetchEmployees = async () => {
        try {
            setIsLoadingEmployees(true);
            const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null;

            if (!orgId) {
                toast("orgId not found in localStorage");
                // Optional: handle missing orgId case
            }

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/organizations/${orgId}/users`, {
                method: 'GET',
                // headers: {
                //     'Authorization': `Bearer ${authtoken}`, // Adjust prefix if needed (e.g., 'Token ')
                //     'Content-Type': 'application/json', // Optional, but good practice
                // },
            });

            console.log("response5345", response)
            // if (!response.ok) {
            //     throw new Error(`HTTP error! Status: ${response.status}`);
            // }

            const result = await response.json();
            console.log("2response5345", result)
            if (result?.success) {
                const transformedUsers = (result.data?.users || []).map((user: any) => {
                    const { _id, ...rest } = user;
                    return {
                        id: _id,           // ← rename _id to id
                        ...rest,
                    };
                });

                setEmployees(transformedUsers);
            }

            else {
                toast("Expired token")
                setEmployees([])
                setMounted(true)
            }
            console.log("jvcxkvjxncvxcv", result)


        } catch (err) {
            console.log(err);
        } finally {
            setIsLoadingEmployees(false);
        }
    };





    const handleTaskMove = async (
        taskId: string,
        newColumnId: string,
        newIndex: number
    ) => {
        // Snapshots for rollback
        let prevColumns: Column[] = [];
        let prevListTasks: Task[] = [];

        try {
            // 1. Optimistically update UI + taskCount
            setColumns((curr) => {
                prevColumns = [...curr]; // deep copy for rollback

                const sourceIdx = curr.findIndex((col) =>
                    col.tasks.some((t) => t._id === taskId)
                );
                if (sourceIdx === -1) return curr;

                const destIdx = curr.findIndex((col) => col._id === newColumnId);
                if (destIdx === -1) return curr;

                const sourceCol = curr[sourceIdx];
                const taskIdx = sourceCol.tasks.findIndex((t) => t._id === taskId);
                if (taskIdx === -1) return curr;

                // Same column → only re-order (no count change, no API)
                if (sourceIdx === destIdx) {
                    const newTasks = [...sourceCol.tasks];
                    const [moved] = newTasks.splice(taskIdx, 1);
                    newTasks.splice(newIndex, 0, moved);

                    const newCols = [...curr];
                    newCols[sourceIdx] = { ...sourceCol, tasks: newTasks };
                    return newCols;
                }

                // ---- CROSS-COLUMN MOVE ----
                const taskToMove = { ...sourceCol.tasks[taskIdx], stageId: newColumnId };

                // Build new columns array
                const newCols = [...curr];

                // Source: remove task & -1 count
                newCols[sourceIdx] = {
                    ...sourceCol,
                    tasks: sourceCol.tasks.filter((_, i) => i !== taskIdx),
                    taskCount: (sourceCol.taskCount ?? 0) - 1,
                };

                // Destination: insert task at newIndex & +1 count
                const destCol = newCols[destIdx];
                const destTasks = [...destCol.tasks];
                destTasks.splice(newIndex, 0, taskToMove);

                newCols[destIdx] = {
                    ...destCol,
                    tasks: destTasks,
                    taskCount: (destCol.taskCount ?? 0) + 1,
                };

                return newCols;
            });

            // 2. Update flat list (listcolumns)
            setStagecolumns((prev) => {
                prevListTasks = [...prev];
                return prev.map((t) =>
                    t._id === taskId ? { ...t, stageId: newColumnId } : t
                );
            });

            // 3. Early exit if same column (no API needed)
            const isSameColumn = prevColumns.find((c) =>
                c.tasks.some((t) => t._id === taskId)
            )?._id === newColumnId;

            if (isSameColumn) return;

            // 4. API call
            const res = await fetch(`${baseurl}/v1/tasks/move/${taskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stageId: newColumnId }),
            });

            if (!res.ok) throw new Error("API failed");

            const data = await res.json();
            if (!data?.status) throw new Error("API status false");

            toast("Task moved successfully");
        } catch (err) {
            // ---- ROLLBACK ----
            setColumns(() => prevColumns);
            setStagecolumns(() => prevListTasks);
            toast("Failed to move task");
            console.error(err);
        }
    };

    console.log("colume55555555555555555555555555555555555555s", columns)
    // const handleTaskMove = (taskId: string, newColumnId: string, newIndex: number) => {
    //     const timestamp = Date.now()
    //     console.log("taskId234324",taskId,newColumnId)
    //     setTasks((prevTasks) =>
    //         prevTasks.map((task) =>
    //             task.id === taskId ? { ...task, columnId: newColumnId, lastModified: timestamp } : task
    //         )
    //     )
    //     alert()
    //     if (socket && isConnected) {
    //         socket.emit("move-task", { taskId, newColumnId, newIndex, userId: currentUser.id, timestamp })
    //     }
    // }

    const handleAddTask = (columnId: string) => {
        // const newTask: Task = {
        //     id: Math.random().toString(36).substr(2, 9),
        //     title: "New Task",
        //     description: "Click to edit this task",
        //     priority: "medium",
        //     tags: [],
        //     assignee: currentUser,
        //     dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        //     comments: 0,
        //     columnId,
        //     lastModified: Date.now(),
        // }
        // setTasks((prevTasks) => [...prevTasks, newTask])
        // if (socket && isConnected) {
        //     socket.emit("task-added", newTask)
        // }
    }
    console.log("1vcx23vcx234234234", Listcolumns)
    // const handleCreateTask = (taskData: Omit<Task, "id">) => {

    //     setColumns((prevColumns) =>
    //         prevColumns.map((stage) => {
    //             if (stage._id === taskData.stageId) {
    //                 return {
    //                     ...stage,
    //                     tasks: [...stage.tasks, taskData],
    //                 };
    //             }
    //             return stage;
    //         })
    //     );
    //     setListcolumns((prevColumns) => [...prevColumns, taskData]);


    // }

    const handleCreateTask = (taskData: Omit<Task, "id">) => {
        setColumns((prevColumns) =>
            prevColumns.map((stage) => {
                if (stage._id === taskData.stageId) {
                    return {
                        ...stage,
                        tasks: [...stage.tasks, taskData],
                        taskCount: (stage.taskCount ?? 0) + 1, // Safe increment
                    };
                }
                return stage;
            })
        );

        setStagecolumns((prevColumns) => [...prevColumns, taskData]);
    };

    const handleUpdateColumns = (newColumns: Column[]) => {

        setColumns(newColumns)
        console.log("cxv342fsd", newColumns)
        setTasks((prevTasks) =>
            prevTasks.map((task) => {
                const columnExists = newColumns.some((col) => col._id === task.columnId)
                if (!columnExists && newColumns.length > 0) {
                    return { ...task, columnId: newColumns[0]._id }
                }
                return task
            }))

        ///  setListcolumns(listcolumnsPrivous)



    }

    const handleDragStart = (taskId: string) => {

    }

    const handleDragEnd = () => {

    }

    const handleUpdateTask = (updatedTask: Task) => {
        const timestamp = Date.now()
        const taskWithTimestamp = { ...updatedTask, lastModified: timestamp }
        setTasks((prevTasks) => prevTasks.map((task) => (task.id === updatedTask.id ? taskWithTimestamp : task)))

    }
    const styles = workspace?.color ? colorStyles[workspace.color] : "";
    console.log("workspace", workspace)
    const doneStage = columns.find(stage => stage.name === "Done");

    const lastColumn = columns[columns.length - 1];
    const doneTaskCount = lastColumn?.taskCount;

    //setTasksLength(doneStage ? doneStage.tasks.length : 0);

    console.log("cvkvckvcxjkvcxvcx", columns)
    const totalTasks = columns.reduce((sum, stage) => sum + (stage.taskCount ?? 0), 0);





    const percentage = totalTasks > 0 ? ((doneTaskCount ?? 0) / totalTasks) * 100 : 0;
    const uniqueAssignees = Array.from(
        new Map(
            columns?.flatMap((stage) => stage?.tasks).map((task) => [task?.assignedToId, task])
        ).values()
    );

    const isInputDisabled = workspace?.userId !== userId
    console.log("czczjxcbzhjxbczxc", columns)
    if (mounted)
        return <main className="flex-1 bg-[#0e0e12] text-foreground flex items-center justify-center px-4 min-h-0">
            <div className="w-full max-w-md">
                {/* Error Icon */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full"></div>
                        <div className="relative bg-red-500/10 border border-red-500/30 rounded-full p-6">
                            <AlertCircle className="w-12 h-12 text-red-500" />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="text-center space-y-3 mb-8">
                    <h1 className="text-3xl font-bold text-balance">Session Expired</h1>
                    <p className="text-muted-foreground">
                        Your authentication token has expired. Please log in again to continue.
                    </p>
                </div>

                {/* Timer Info */}
                <div className="bg-secondary/50 border border-border rounded-lg p-4 mb-8 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">Your session expired due to inactivity.</p>
                        <p>For security reasons, sessions automatically expire after a period of time.</p>
                    </div>
                </div>

                {/* Error Code */}
                <div className="bg-muted/30 border border-border rounded-lg p-3 mb-8">
                    <p className="text-xs text-muted-foreground font-mono">Error Code: TOKEN_EXPIRED</p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Button
                        onClick={handleLogout}
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                    >
                        Sign In Again
                    </Button>

                </div>

                {/* Footer Info */}
                {/* <p className="text-xs text-muted-foreground text-center mt-6">
                    Need help?{" "}
                    <a href="/support" className="text-primary hover:underline">
                        Contact support
                    </a>
                </p> */}
            </div>
        </main>

    return (



        <div className="min-h-screen bg-[#0e0e12] flex flex-col" ref={ref}
            style={{
                height: "100vh",
                overflow: "hidden"
            }}
        >
            {
                loading ?
                    <header className="w-full p-6 pt-8">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChevronLeft className="h-4 w-4" aria-hidden />
                            <Skeleton className="h-4 w-32" />
                        </div>


                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-48" />
                                    <Skeleton className="h-4 w-4 rounded-full" />
                                </div>
                                <Skeleton className="mt-2 h-4 w-64" />

                                <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-2 w-2 rounded-full" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-20" />
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-2 w-28 rounded-full" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Skeleton className="h-8 w-32 rounded-md" />
                                <Skeleton className="h-8 w-36 rounded-md" />
                            </div>
                        </div>
                    </header>
                    :
                    <header className="w-full p-6 pt-8 ">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChevronLeft className="h-4 w-4" aria-hidden />
                            <button className="underline-offset-4 hover:underline"
                                onClick={() => router.push(`/taskroom/all-taskrooms`)}
                            >Back to My TaskRooms</button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                            <div className="w-full">
                                <div className="flex items-center gap-2 justify-between w-full">
                                    <h1 className="text-balance text-2xl font-semibold leading-tight">{workspace?.name}</h1>

                                    <div className="flex items-center gap-3 ">
                                        <Button size="sm" variant="outline" className="gap-2 bg-transparent text-white border-[#e5e7eb29] hover:bg-gray-800"
                                            onClick={() => setCreateTaskOpen(true)}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add New Task
                                        </Button>
                                        <Button size="sm" variant="outline" className="gap-2 border-[#e5e7eb29] hover:bg-gray-800 bg-transparent"
                                            onClick={() => setManageStagesOpen(true)}
                                        >
                                            <Settings className="h-4 w-4" />
                                            Customize Stages
                                        </Button>
                                    </div>


                                </div>

                                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                                    {workspace?.description}
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${styles?.indicator}`} aria-hidden />
                                        {/* {(workspace?.roomUsers?.length ?? 0) + newCountMenmbers} members */}
                                        {newCountMenmbers} members
                                    </div>
                                    <div>{totalTasks} tasks</div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative h-2 w-28 overflow-hidden rounded-full bg-[#1e1e2d] border border-[#e5e7eb29]">
                                            <div className={`absolute inset-y-0 left-0 rounded-full ${styles?.indicator}`}
                                                style={{ width: `${percentage}%` }} />
                                        </div>
                                        <span className="text-gray-400">{Math.ceil(percentage)}% complete</span>
                                    </div>
                                </div>
                            </div>


                        </div>

                        {/* <nav className="mt-6 flex items-center gap-2">
                    <SegmentedItem active icon={<KanbanIcon className="h-4 w-4" />} label="Kanban" />
                    <SegmentedItem icon={<List className="h-4 w-4" />} label="List" />
                    <SegmentedItem icon={<Timeline className="h-4 w-4" />} label="Timeline" />
                    <SegmentedItem icon={<Folder className="h-4 w-4" />} label="Files" />
                    <SegmentedItem icon={<ChatBubbleOvalLeft className="h-4 w-4" />} label="Chat" />
                </nav> */}
                    </header>
            }


            {/* <Button onClick={() => setIsManageDialogOpen(true)} className="m-4">
                Manage Stages
            </Button> */}
            {
                isLoading &&
                <div className="flex-1 flex flex-col bg-[#0e0e12] min-h-0">
                    {/* Header with tabs and buttons */}
                    <div className="flex items-center justify-between p-6 pt-0 border-b border-[#e5e7eb29]">
                        <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, index) => (
                                <Skeleton
                                    key={index}
                                    className="h-8 w-24 rounded-md"
                                />
                            ))}
                        </div>
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>

                    {/* Main content area */}
                    <div className="flex-1 flex relative min-h-0">
                        <div className="flex-1 overflow-hidden">
                            <div className="h-full p-6">
                                <div className="flex gap-8 h-full overflow-x-auto scrollbar-hidden">
                                    {/* Columns */}
                                    {[...Array(4)].map((_, colIndex) => (
                                        <div key={colIndex} className="flex-shrink-0 w-80">
                                            {/* Column header */}
                                            <Skeleton className="h-10 w-full mb-4 rounded-md" />
                                            {/* Tasks */}
                                            {[...Array(3)].map((_, taskIndex) => (
                                                <Skeleton
                                                    key={taskIndex}
                                                    className="h-24 w-full mb-2 rounded-md"
                                                />
                                            ))}
                                            {/* Add task button */}
                                            <Skeleton className="h-8 w-full rounded-md" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right side panel */}
                        {/* <div className="w-[300px] border-l">
                            <div className="p-4">
                                <Skeleton className="h-8 w-3/4 mb-4" />
                                {[...Array(3)].map((_, index) => (
                                    <div key={index} className="flex items-center gap-2 mb-2">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <Skeleton className="h-6 w-1/2" />
                                    </div>
                                ))}
                            </div>
                        </div> */}
                    </div>
                </div>
            }
            <KanbanBoard
                columns={columns}
                onTaskMove={handleTaskMove}
                onAddTask={handleAddTask}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isConnected={isConnected}
                currentUser={currentUser}
                collaboration={collaboration}
                onCreateTask={handleCreateTask}
                onUpdateColumns={handleUpdateColumns}
                onUpdateTask={handleUpdateTask}
                users={sampleUsers}
                setColumns={setColumns}
                loadingStages={loadingStages}
                currentPage={currentPage}
                hasMore={hasMore}
                isStageLoading={isStageLoading}
                userId={userId}
                isLoadingEmployees={isLoadingEmployees}
                fetchTasksForStage={fetchTasksForStage}
                employees={employees}
                setHasMore={setHasMore}
                setCurrentPage={setCurrentPage}
                taskRoomId={taskRoomId}
                setManageStagesOpen={setManageStagesOpen}
                manageStagesOpen={manageStagesOpen}
                createTaskOpen={createTaskOpen}
                setCreateTaskOpen={setCreateTaskOpen}
                userRole={userRole}
                workspaceUserId={workspace?.userId}
                setMembers={setMembers}
                members={members}
                Listcolumns={Listcolumns}
                setListcolumns={setListcolumns}
                conversationId={workspace?.conversationId}
                tasksList={tasksList}
                fetchListView={fetchListView}
                stageExhausted={stageExhausted}
                stagecolumns={stagecolumns}
                setStagecolumns={setStagecolumns}
                setnewCountMenmbers={setnewCountMenmbers}
                isFetching={isFetching}
                nextPageToFetch={nextPageToFetch}
                fetchMembers={fetchMembers}
                observerPage={observerPage}
                observerHasMore={observerHasMore}
                observerLoading={observerLoading}
                newCountMenmbers={newCountMenmbers}

                subtasks={subtasks}
                setSubtasks={setSubtasks}
            />
            {/* <TaskGenerator/> */}

        </div>

    )
}