"use client"

import { useState, useEffect } from "react"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskRoomCard } from "./taskroom-card"
import { CreateTaskRoomModal } from "./create-taskroom-modal"
import Cookies from "js-cookie"
import { toast } from "sonner"
import { EditTaskRoomModal } from "./edit-taskroom-modal"
import { DeleteConfirmationModal } from "./delete-confirmation-modal"
import { MigrationWizardModal } from "./migration-wizard-modal"
import SkeletonCard from "./SkeletonCard"
import SearchList from "./search-list"
import { jwtDecode } from 'jwt-decode'   // ← import here
import { useRouter } from "next/navigation"
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
interface TaskRoom {
    id: string
    _id: string
    name: string
    description: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
    progress: {
        completed: number
        total: number
    }
    userId: string
    members: number
    dueDate: string
    createdAt: string
    conversationId: string
    taskCount: number
    competedStageData: {
        taskCount: number
    }
    roomUsers: RoomData[]
}
interface RoomData {

    _id: string

}
interface CreateTaskRoomRequest {
    name: string
    description: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
    orgId?: string
    userId: string
}

interface UpdateTaskRoomRequest {
    name: string
    description: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
}

interface UserData {
    employeeId: string
    role: string
    id: string
    orgId: string
}
const API_URL = "https://uatapi.garage.app"
async function removeMemberFromTaskroomChat(conversationId: string) {
    const token = localStorage.getItem("garage_tok"); // Using Cookies instead of localStorage to match existing code

    try {
        const response = await fetch(
            `${API_URL}/api/chat/conversations/${conversationId}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error("Failed to remove member from chat");
        }

        return await response.json();
    } catch (error) {
        console.error("Error removing member from chat:", error);
        toast.error("Failed to remove member from chat");
        throw error;
    }
}
export default function TaskRoomsDashboard() {
    const [taskRooms, setTaskRooms] = useState<TaskRoom[]>([])
    const [filteredTaskRooms, setFilteredTaskRooms] = useState<TaskRoom[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false)
    const [selectedTaskRoom, setSelectedTaskRoom] = useState<TaskRoom | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [orgId, setOrganizationId] = useState<string>("")
    const [userId, setUserId] = useState<string>("")
    const baseUrl = "https://uatapi.garage.app/taskroom/v1/rooms"
    // const [employees, setEmployees] = useState<Employee[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalTaskRooms, setTotalTaskRooms] = useState(0)
    const [userRole, setUserRole] = useState("")
    const pageSize = 30
    const [activeTab, setActiveTab] = useState<"created" | "assigned">("created")
    const [query, setQuery] = useState("")
    const router = useRouter()
    useEffect(() => {
        if (searchQuery.trim() === "") {
            setFilteredTaskRooms(taskRooms)
        } else {
            const filtered = taskRooms.filter(
                (room) =>
                    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    room.description.toLowerCase().includes(searchQuery.toLowerCase())
            )
            setFilteredTaskRooms(filtered)
        }
    }, [taskRooms, searchQuery])

    useEffect(() => {
        const userData = localStorage.getItem("garage_tok")
        if (userData) {
            const payload = jwtDecode<JwtPayload>(userData)
            console.log("payload", payload)
            // setDecoded(payload)
            try {
                if (payload?.orgId && payload?.userId) {
                    setOrganizationId(payload?.orgId)
                    setUserId(payload?.userId)
                    fetchTaskRooms(payload?.orgId, payload.userId, currentPage, pageSize)
                }
                if (payload?.role) {
                    setUserRole(payload.role)
                }
            } catch (error) {
                console.error("Error parsing userData:", error)
            }
        }
    }, [currentPage, activeTab])

    const fetchTaskRooms = async (orgId: string, userId: string, page: number, size: number) => {
        setIsLoading(true)
        try {
            const endpoint = `${baseUrl}/detail?orgId=${orgId}&page=${page}&size=${size}&userId=${userId}`
            const response = await fetch(endpoint, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("garage_tok")}`,
                },
            })
            if (response.ok) {
                const data = await response.json()
                setTaskRooms(data?.data || [])
                const apiTotalPages = Number(data.metadata?.totalPages) || 1
                const apiTotalTaskRooms = Number(data.metadata?.count) || 0
                setTotalPages(apiTotalPages)
                setTotalTaskRooms(apiTotalTaskRooms)
                setFilteredTaskRooms(data?.data || [])
            } else {
                setTaskRooms([])
                setFilteredTaskRooms([])
                setTotalPages(1)
                setTotalTaskRooms(0)
                toast.error("Invalid task room response")
            }
        } catch (error) {
            console.error(`Failed to fetch TaskRooms for ${activeTab}:`, error)
            toast.error("Failed to fetch task rooms. Please try again.")
            setTaskRooms([])
            setFilteredTaskRooms([])
            setTotalPages(1)
            setTotalTaskRooms(0)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateTaskRoom = async (data: CreateTaskRoomRequest) => {
        setIsSubmitting(true)
        try {
            // Step 1: Verify the token
            const token = localStorage.getItem("garage_tok")
            const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (tokenResponse.ok) {
                const user = await tokenResponse.json()
                console.log('Token is valid!', user)

                // Step 2: Create the task room
                const response = await fetch(`${baseUrl}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(data),
                })

                if (response.ok) {
                    const newTaskRoom = await response.json()
                    // Fetch updated task rooms to ensure correct pagination
                    await fetchTaskRooms(orgId, userId, currentPage, pageSize)
                    // createTaskroomChat(newTaskRoom?.data?.data)
                    toast.success("Task room created successfully!")
                    // Navigate to the last page if the current page is full
                    const newTotalTaskRooms = totalTaskRooms + 1
                    const newTotalPages = Math.ceil(newTotalTaskRooms / pageSize)
                    if (taskRooms.length >= pageSize && currentPage < newTotalPages) {
                        setCurrentPage(newTotalPages)
                    }
                } else {
                    let errorMessage = "An unexpected error occurred."
                    try {
                        const errorData = await response.json()
                        errorMessage = errorData?.message || errorMessage
                    } catch (jsonError) {
                        console.warn("Failed to parse error response:", jsonError)
                    }
                    toast.error(errorMessage)
                }
            } else {
                console.log('Token is invalid or expired')
                toast.error("Token is invalid or expired. Please log in again.")
            }
        } catch (error) {
            console.error("Failed to create TaskRoom:", error)
            toast.error("Failed to create task room. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    
    const createTaskroomChat = async (taskroomData) => {
        const token = localStorage.getItem("garage_tok")
        try {
            const response = await fetch(`${API_URL}/api/chat/conversations/group`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: taskroomData?.name,
                    description: taskroomData?.description || `Chat for taskroom: ${taskroomData?.description}`,
                    participants: [taskroomData?.userId],
                    taskroomId: taskroomData?._id,
                }),
            })

            if (!response.ok) {
                toast.error("Failed to create taskroom chat")
            }

            const data = await response.json()
            await handleEditTaskRoomForConversationId(data?.data?._id, taskroomData?._id)
        } catch (error) {
            console.error("Error creating taskroom chat:", error)
            toast.error("Error creating taskroom chat")
        }
    }

    const handleEditTaskRoomForConversationId = async (data: string, id: string) => {
        //  setIsSubmitting(true)
        try {
            const response = await fetch(`${baseUrl}/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("garage_tok")}`,
                },
                body: JSON.stringify({
                    conversationId: data,
                }),
            })

            if (response.ok) {
                //  fetchTaskRooms(orgId, userId, currentPage, pageSize)
                setIsEditModalOpen(false)
                setSelectedTaskRoom(null)
            } else {
                throw new Error("Failed to update TaskRoom")
            }
        } catch (error) {
            console.error("Failed to update TaskRoom:", error)
            toast.error("Failed to update task room. Please try again.")
        } finally {
            //  setIsSubmitting(false)
        }
    }

    const handleEditTaskRoom = async (data: UpdateTaskRoomRequest) => {
        if (!selectedTaskRoom) return

        setIsSubmitting(true)
        try {
            const response = await fetch(`${baseUrl}/${selectedTaskRoom._id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("garage_tok")}`,
                },
                body: JSON.stringify(data),
            })

            if (response.ok) {
                fetchTaskRooms(orgId, userId, currentPage, pageSize)
                setIsEditModalOpen(false)
                setSelectedTaskRoom(null)
            } else {
                throw new Error("Failed to update TaskRoom")
            }
        } catch (error) {
            console.error("Failed to update TaskRoom:", error)
            toast.error("Failed to update task room. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteTaskRoom = async () => {
        if (!selectedTaskRoom) return;

        setIsSubmitting(true);
        try {
            // Step 1: Verify the token
            const token = localStorage.getItem("garage_tok");
            const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (tokenResponse.ok) {
                const user = await tokenResponse.json();
                console.log("Token is valid!", user);

                // Step 2: Delete the task room
                const response = await fetch(`${baseUrl}/${selectedTaskRoom._id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    // Step 3: Remove member from task room chat
                    if (selectedTaskRoom.conversationId) {
                        try {
                            // await removeMemberFromTaskroomChat(selectedTaskRoom.conversationId);
                        } catch (error) {
                            // Log the error but don't fail the entire operation
                            console.warn("Failed to remove member from chat, continuing with deletion");
                        }
                    }

                    // Update task rooms and pagination
                    const newTotalTaskRooms = totalTaskRooms - 1;
                    const newTotalPages = Math.ceil(newTotalTaskRooms / pageSize);
                    if (currentPage > newTotalPages && newTotalPages > 0) {
                        setCurrentPage(newTotalPages);
                    } else {
                        fetchTaskRooms(orgId, userId, currentPage, pageSize);
                    }
                    setIsDeleteModalOpen(false);
                    setSelectedTaskRoom(null);
                    toast.success("Task room deleted successfully!");
                } else {
                    toast.error("Failed to delete TaskRoom");
                }
            } else {
                console.log("Token is invalid or expired");
                toast.error("Token is invalid or expired. Please log in again.");
            }
        } catch (error) {
            console.error("Failed to delete TaskRoom:", error);
            toast.error("Failed to delete task room. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (taskRoom: TaskRoom) => {
        setSelectedTaskRoom(taskRoom)
        setIsEditModalOpen(true)
    }

    const handleDeleteClick = (taskRoom: TaskRoom) => {
        setSelectedTaskRoom(taskRoom)
        setIsDeleteModalOpen(true)
    }

    const handleTaskRoomClick = (taskRoom: TaskRoom) => {
        console.log("Navigate to TaskRoom:", taskRoom.id)
    }

    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return
        setCurrentPage(page)
        fetchTaskRooms(orgId, userId, page, pageSize)
    }
    console.log("filteredTaskRooms", filteredTaskRooms)
    return (
        <div className="min-h-screen bg-[#0e0e12] text-white px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-between"
            style={{
                height: "100vh",
                overflow: "scroll"
            }}
        >
            <div className="w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">My TaskRooms</h1>
                        <p className="text-gray-400">Manage and access all your TaskRooms in one place</p>
                    </div>

                    <div className="flex items-center gap-3">

                        <Button
                            onClick={() => setIsMigrationModalOpen(true)}
                            className="bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Migrate
                        </Button>
                        <Button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            New TaskRoom
                        </Button>
                    </div>
                </div>
                <div className="mx-full max-w-full  mb-8"
                    style={{
                        display: "flex",
                        justifyContent: "center"
                    }}
                >


                    <SearchList query={query} setQuery={setQuery} userId={userId} orgId={orgId} />
                </div>
                {/* <div className="flex gap-2 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("created")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === "created" ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Created by me
          </button>
          <button
            onClick={() => setActiveTab("assigned")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === "assigned" ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            Shared by others
          </button>
        </div> */}

                {/* <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search taskrooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
        </div> */}

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((item, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                ) : (
                    <>
                        {filteredTaskRooms.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-gray-500 mb-4">
                                    {searchQuery
                                        ? "No TaskRooms found matching your search."
                                        : activeTab === "created"
                                            ? "No TaskRooms yet."
                                            : "No TaskRooms assigned to you."}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTaskRooms.map((taskRoom) => (
                                    <TaskRoomCard
                                        key={taskRoom?._id}
                                        taskRoom={taskRoom}
                                        onEdit={handleEditClick}
                                        onDelete={handleDeleteClick}
                                        userId={userId}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                <CreateTaskRoomModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={handleCreateTaskRoom}
                    organizationId={orgId}
                    userId={userId}
                />

                <EditTaskRoomModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false)
                        setSelectedTaskRoom(null)
                    }}
                    onSubmit={handleEditTaskRoom}
                    taskRoom={selectedTaskRoom}
                    isLoading={isSubmitting}
                />

                <DeleteConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => {
                        setIsDeleteModalOpen(false)
                        setSelectedTaskRoom(null)
                    }}
                    onConfirm={handleDeleteTaskRoom}
                    taskRoom={selectedTaskRoom}
                    isLoading={isSubmitting}
                />

                <MigrationWizardModal
                    isOpen={isMigrationModalOpen}
                    onClose={() => setIsMigrationModalOpen(false)}
                />
            </div>

            {totalPages > 1 && (
                <footer className="mt-auto pt-6">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            Showing page {currentPage} of {totalPages} • Total {totalTaskRooms} task rooms
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => handlePageChange(1)} disabled={currentPage === 1 || isLoading}>
                                « First
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1 || isLoading}
                            >
                                ‹ Previous
                            </Button>
                            {currentPage > 2 && <span className="px-2">...</span>}
                            {[currentPage - 1, currentPage, currentPage + 1]
                                .filter((p) => p > 0 && p <= totalPages)
                                .map((pageNum) => (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? "default" : "outline"}
                                        className={currentPage === pageNum ? "bg-[#0e0e12]" : ""}
                                        onClick={() => handlePageChange(pageNum)}
                                        disabled={isLoading}
                                    >
                                        {pageNum}
                                    </Button>
                                ))}
                            {currentPage < totalPages - 1 && <span className="px-2">...</span>}
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || isLoading}
                            >
                                Next ›
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(totalPages)}
                                disabled={currentPage === totalPages || isLoading}
                            >
                                Last »
                            </Button>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    )
}