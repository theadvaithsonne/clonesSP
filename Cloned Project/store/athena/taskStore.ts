import { create } from "zustand";
import Cookies from "js-cookie";
import { toast } from "sonner";

export interface Task {
    _id: string;
    userId?: string;
    orgId?: string;
    name: string;
    cardId: string;
    childCount: number;
    completedChildCount: number;
    status: string;
    createdAt?: string;
    updatedAt?: string;
    checklistData: Array<{
        _id: string;
        description: string;
        isCompleted: boolean;
        taskId: string;
        boardId: string;
    }>;
}

interface TaskStore {
    tasks: Task[];
    isLoading: boolean;
    error: string | null;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
    isCreatingTask: boolean;
    activeCardId: string | null;

    fetchTasks: (cardId: string, page?: number, append?: boolean) => Promise<void>;
    createTask: (cardId: string, name: string, socketId: string) => Promise<void>;
    updateTask: (taskId: string, updates: { name: string; socketId?: string }) => Promise<void>;
    deleteTask: (taskId: string, socketId?: string | null) => Promise<void>;
    addTaskFromSocket: (task: Task) => void;
    socketAddTask: (task: Task) => void;
    updateTaskFromSocket: (task: Task) => void;
    deleteTaskFromSocket: (taskId: string) => void;
    addChecklistItemFromSocket: (item: any, taskObj?: any) => void;
    updateChecklistItemFromSocket: (item: any, taskObj?: any) => void;
    deleteChecklistItemFromSocket: (checklistId: string, taskId: string) => void;
}

const API_BASE_URL = "https://uatapi.garage.app/flowboard/v1/tasks";

export const useTaskStore = create<TaskStore>((set, get) => ({
    tasks: [],
    isLoading: false,
    error: null,
    currentPage: 1,
    totalPages: 1,
    hasMore: true,
    isCreatingTask: false,

    activeCardId: null,

    // Paginated fetch. Does NOT auto-loop pages.
    // Call with page=1 for initial load, and with
    // higher page numbers (append=true) on scroll.
    fetchTasks: async (cardId, page = 1, append = false) => {
        // For first page, reset state and show main loading
        if (page === 1) {
            set({
                activeCardId: cardId, // Set the active card ID
                isLoading: true,
                error: null,
                currentPage: 1,
                totalPages: 1,
                hasMore: true,
                tasks: [],
            });
        } else {
            // For subsequent pages, keep isLoading flag but don't clear tasks
            set({ isLoading: true, error: null });
        }
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups?taskId=${cardId}&size=5&page=${page}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to fetch tasks");
            }
            const pageTasks: Task[] = Array.isArray(data?.data?.data) ? data.data?.data : [];
            const metadata = data.metadata || {};
            const currentPage = metadata.currentPage ?? page;
            const totalPages = metadata.totalPages ?? currentPage;
            const hasMore = currentPage < totalPages;

            set((state) => ({
                tasks: append ? [...state.tasks, ...pageTasks] : pageTasks,
                isLoading: false,
                currentPage,
                totalPages,
                hasMore,
                error: null,
            }));
        } catch (error: any) {
            console.error("Fetch tasks error:", error);
            set({ error: error.message, isLoading: false });
        }
    },

    createTask: async (cardId, name, socketId) => {
        set({ isCreatingTask: true });
        try {
            const token = localStorage.getItem("garage_tok");
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name,
                    taskId: cardId,
                    checklist: [], // Prompt requirement: task = [] // string array

                }),
            });

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to create task");
            }

            // Optimistic or just re-fetch? Or append.
            const newTask = data?.data?.data;

            set((state) => {
                const exists = state.tasks.some(t => t._id === newTask._id);
                if (exists) {
                    return { isCreatingTask: false }; // Already added via socket
                }
                return {
                    tasks: [newTask, ...state.tasks], // Add to top matching socket behavior
                    isCreatingTask: false
                };
            });

            toast.success("Task created");
        } catch (error: any) {
            console.error("Create task error:", error);
            set({ isCreatingTask: false });
            toast.error(error.message || "Failed to create task");
        }
    },

    socketAddTask: async (playload) => {
        set((state) => {
            // const exists = state.tasks.some(t => t._id === newTask._id);
            // if (exists) {
            //     return { isCreatingTask: false }; // Already added via socket
            // }
            return {
                tasks: [playload, ...state.tasks], // Add to top matching socket behavior
                isCreatingTask: false
            };
        });
    },

    updateTask: async (taskId, updates) => {
        // Optimistic
       // alert("kamal")
        const previousTasks = get().tasks;
        set((state) => ({
            tasks: state.tasks.map((t) => t._id === taskId ? { ...t, ...updates } : t)
        }));

        try {
            const token = localStorage.getItem("garage_tok");
            // URL: baseurl+/v1/tasks/:id
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/${taskId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updates),
            });

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to update task");
            }
        } catch (error: any) {
            console.error("Update task error:", error);
            set({ tasks: previousTasks }); // Revert
            toast.error(error.message || "Failed to update task");
        }
    },

    deleteTask: async (taskId: string, socketId?: string | null | undefined) => {
        // Optimistic
       // alert(taskId)
        const previousTasks = get().tasks;
        set((state) => ({
            tasks: state.tasks.filter((t) => t._id !== taskId)
        }));

        try {
            const token = localStorage.getItem("garage_tok");
            // URL: baseurl+/v1/tasks/:id
            const response = await fetch(`${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/${taskId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (!response.ok || data.status === false) {
                throw new Error(data.message || "Failed to delete task");
            }
            toast.success("Task deleted");
        } catch (error: any) {
            console.error("Delete task error:", error);
            set({ tasks: previousTasks });
            toast.error(error.message || "Failed to delete task");
        }
    },

    addTaskFromSocket: (newTask: Task) => {
        set((state) => {
            // Check if task already exists (avoid duplicates)
            const existingTask = state.tasks.find(t => t._id === newTask._id);
            if (existingTask) {
                return state; // Already exists, don't add again
            }
            // Add new task at the beginning
            return {
                tasks: [newTask, ...state.tasks],
                pendingTaskId: null
            };
        });
    },

    updateTaskFromSocket: (updatedTask: Task) => {
        set((state) => ({
            tasks: state.tasks.map((t) => t._id === updatedTask._id ? { ...t, ...updatedTask } : t)
        }));
        // set((state) => ({
        //     tasks: state.tasks.map((t) =>
        //         t._id === updatedTask._id ? { ...t, ...updatedTask } : t
        //     )
        // }));
    },

    deleteTaskFromSocket: (taskId: string) => {
        set((state) => ({
            tasks: state.tasks.filter((t) => t._id !== taskId)
        }));
    },

    addChecklistItemFromSocket: (newItem: any, taskObj?: any) => {

        // const newTask = data.data;
        // set((state) => {
        //     const exists = state.tasks.some(t => t._id === newTask._id);
        //     if (exists) {
        //         return { isCreatingTask: false }; // Already added via socket
        //     }
        //     return {
        //         tasks: [newTask, ...state.tasks], // Add to top matching socket behavior
        //         isCreatingTask: false
        //     };
        // });
        set((state) => {
            return {
                tasks: state.tasks.map((t) => {
                    if (t._id === newItem.taskId) {
                        // Avoid duplicates
                        const exists = t.checklistData?.some(i => i._id === newItem._id);
                        if (exists) return t;

                        const currentChecklist = t.checklistData || [];

                        // Calculate fallback counts if taskObj is missing
                        const fallbackChildCount = (t.childCount || 0) + 1;
                        const fallbackCompletedCount = (t.completedChildCount || 0) + (newItem.isCompleted ? 1 : 0);

                        return {
                            ...t,
                            checklistData: [...currentChecklist, newItem],
                            childCount: fallbackChildCount,
                            completedChildCount: taskObj?.completedChildCount ?? fallbackCompletedCount
                        };
                    }
                    return t;
                })
            };
        });
    },

    updateChecklistItemFromSocket: (updatedItem: any, taskObj?: any) => {
        set((state) => {
            return {
                tasks: state.tasks.map((t) => {
                    // Try to find if this task contains the checklist item
                    const currentChecklist = t.checklistData || [];
                    const itemExists = currentChecklist.some(i => i._id === updatedItem._id);

                    // If taskId matches OR item exists in this task
                    if (t._id === updatedItem.taskId || itemExists) {
                        let completedCountChange = 0;

                        const newChecklistData = currentChecklist.map(item => {
                            if (item._id === updatedItem._id) {
                                // Check if completion status changed (only if not using taskObj)
                                if (!taskObj && updatedItem.isCompleted !== undefined && item.isCompleted !== updatedItem.isCompleted) {
                                    completedCountChange = updatedItem.isCompleted ? 1 : -1;
                                }
                                return { ...item, ...updatedItem };
                            }
                            return item;
                        });

                        return {
                            ...t,
                            checklistData: newChecklistData,
                            childCount: taskObj?.childCount ?? t.childCount,
                            completedChildCount: taskObj?.completedChildCount ?? ((t.completedChildCount || 0) + completedCountChange)
                        };
                    }
                    return t;
                })
            };
        });
    },

    deleteChecklistItemFromSocket: (checklistId: string, taskId: string) => {
        set((state) => {
            return {
                tasks: state.tasks.map((t) => {
                    if (t._id === taskId) {
                        const currentChecklist = t.checklistData || [];
                        const itemToDelete = currentChecklist.find(i => i._id === checklistId);

                        // If item not found, return task as is
                        if (!itemToDelete) return t;

                        const completedCountChange = itemToDelete.isCompleted ? -1 : 0;

                        return {
                            ...t,
                            checklistData: currentChecklist.filter(i => i._id !== checklistId),
                            childCount: Math.max((t.childCount || 0) - 1, 0),
                            completedChildCount: Math.max((t.completedChildCount || 0) + completedCountChange, 0)
                        };
                    }
                    return t;
                })
            };
        });
    }
}));
