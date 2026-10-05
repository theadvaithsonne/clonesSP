"use client"

import type React from "react"
import { ChevronRight, Users, MoreVertical, Edit, Trash2, Search, X } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import Cookies from 'js-cookie';
const BASE_URL = "https://uatapi.garage.app/taskroom"
import { toast } from "sonner"
export interface TaskRoom {
    id: string
    _id: string
    name: string
    description: string
    userId: string
    color: "blue" | "green" | "purple" | "orange" | "pink"
    progress: { completed: number; total: number }
    members: number
    dueDate: string
    createdAt: string
    conversationId: string
    taskCount: number
    competedStageData: { taskCount: number }
    roomUsers: { _id: string }[]
}

interface Employee {
    id: string
    name: string
    email: string
    avatar?: string
}

interface TaskRoomCardProps {
    taskRoom: TaskRoom
    onEdit?: (taskRoom: TaskRoom) => void
    onDelete?: (taskRoom: TaskRoom) => void
    userId: string
}



const colorStyles = {
    blue: { indicator: "bg-blue-500", progress: "bg-blue-500", progressBg: "bg-blue-100" },
    green: { indicator: "bg-green-500", progress: "bg-green-500", progressBg: "bg-green-100" },
    purple: { indicator: "bg-purple-500", progress: "bg-purple-500", progressBg: "bg-purple-100" },
    orange: { indicator: "bg-orange-500", progress: "bg-orange-500", progressBg: "bg-orange-100" },
    pink: { indicator: "bg-pink-500", progress: "bg-pink-500", progressBg: "bg-pink-100" },
} as const

export function TaskRoomCard({ taskRoom, onEdit, onDelete, userId }: TaskRoomCardProps) {
    const [showMenu, setShowMenu] = useState(false)
    const [showTransferDialog, setShowTransferDialog] = useState(false)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
    const [loading, setLoading] = useState(false)
    const [transferring, setTransferring] = useState(false)
    const router = useRouter()
    const styles = colorStyles[taskRoom.color]

    const progressPercentage =
        taskRoom.taskCount && taskRoom.competedStageData?.taskCount
            ? (taskRoom.competedStageData.taskCount / taskRoom.taskCount) * 100
            : 0

    // Fetch employees when transfer dialog opens
    useEffect(() => {
        const authtoken = localStorage.getItem("garage_tok");
        if (showTransferDialog) {
            if (authtoken) {
                fetchEmployees(authtoken)
            }

        }
    }, [showTransferDialog])

    // Filter employees on search
    useEffect(() => {
        const filtered = employees.filter(
            (emp) =>
                emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                emp.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setFilteredEmployees(filtered)
    }, [searchQuery, employees])


    const fetchEmployees = async (authtoken: string) => {

        try {
            setLoading(true);
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

            }
            console.log("jvcxkvjxncvxcv", result)


        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }

       
    };

    // const fetchEmployees = async () => {
    //     setLoading(true)

    //     try {
    //         // const response = await fetch(
    //         //     `https://uatapi.garage.app/api/`
    //         // )
    //         const response = await authenticatedFetch(buildExternalUrl(`users/taskroom?limit=500`))
    //         if (!response.ok) throw new Error("Failed to fetch employees")

    //         const employeesData = await response.json()
    //         setEmployees(employeesData?.users)
    //         // fetchDepartments(employeesData)
    //     } catch (error) {
    //         console.error("Error fetching employees:", error)
    //     } finally {
    //         setLoading(false)
    //     }
    // }
    const handleTransferClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        setShowTransferDialog(true)
    }

    const handleEmployeeSelect = (employee: Employee) => {
        setSelectedEmployee(employee)
        setShowTransferDialog(false)
        setShowConfirmDialog(true)
    }
    console.log("selectedEmployee", selectedEmployee)
    const confirmTransfer = async () => {
        if (!selectedEmployee) return

        setTransferring(true)
        try {
            const payload = {
                userId: userId, // assuming first user is owner
                transferToId: selectedEmployee.id,
            }

            await axios.put(`${BASE_URL}/v1/rooms/transfer/${taskRoom._id}`, payload)

            toast("Task room transferred successfully!")
            setShowConfirmDialog(false)
            setSelectedEmployee(null)
            // Optionally refresh or redirect
            window.location.reload()
        } catch (error: any) {
            console.error("Transfer failed", error)
            alert(error.response?.data?.message || "Transfer failed. Please try again.")
        } finally {
            setTransferring(false)
        }
    }

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu((v) => !v)
    }

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        onEdit?.(taskRoom)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        setShowMenu(false)
        onDelete?.(taskRoom)
    }
    console.log("taskRoom", taskRoom)


    function SkeletonEmployeeItem() {
        return (
            <div className="w-full px-3 py-2 rounded-lg flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-300 rounded-full" />
                <div className="flex-1 space-y-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
            </div>
        )
    }
    return (
        <div className="relative">
            {/* Fixed Height Card */}
            <div
                className="bg-[#1e1e2d] rounded-lg border border-gray-800 p-6 hover:shadow-md hover:border-gray-700 transition-all cursor-pointer group h-54 flex flex-col"
                onClick={() => router.push(`/taskroom/all-taskrooms?taskroomId=${taskRoom._id}`)}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`min-w-3 min-h-3 rounded-full ${styles.indicator}`} />
                        <h3
                            className="font-semibold text-white group-hover:text-gray-200 transition-colors line-clamp-2 text-md leading-tight"
                            title={taskRoom.name}
                        >
                            {taskRoom.name}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMenuClick}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                </div>

                {/* Description - Fixed 2 lines */}
                <p
                    className="text-gray-400 text-sm mb-4 line-clamp-2 flex-1 min-h-10"
                    title={taskRoom.description}
                >
                    {taskRoom.description}
                </p>

                {/* Progress Section */}
                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-300">Progress</span>
                        <span className="text-xs text-gray-400">
                            {taskRoom.competedStageData?.taskCount}/{taskRoom.taskCount} tasks
                        </span>
                    </div>
                    <div className={`w-full h-2 ${styles.progressBg} rounded-full overflow-hidden`}>
                        <div
                            className={`h-full ${styles.progress} transition-all duration-300`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Footer - Always at bottom */}
                <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
                    <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{taskRoom.roomUsers?.length} members</span>
                    </div>
                    <div>fsdf</div>
                </div>
            </div>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="absolute top-12 right-6 bg-[#1e1e2d] border border-gray-800 rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
                    <button
                        onClick={handleEdit}
                        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 flex items-center gap-2"
                    >
                        <Edit className="w-4 h-4" />
                        Edit
                    </button>
                    <button
                        onClick={handleDelete}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                    {
                        taskRoom?.userId == userId &&
                        <button
                            onClick={handleTransferClick}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            Transfer
                        </button>
                    }

                </div>
            )}

            {/* Transfer Dialog */}
            {showTransferDialog && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#1e1e2d] border border-gray-800 rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden text-white">
                            <div className="p-4 border-b border-gray-800">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Transfer TasksRoom</h3>
                                    <button
                                        onClick={() => {
                                            setShowTransferDialog(false)
                                            setSearchQuery("")
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search employees..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                                    />
                                </div>

                                <div className="max-h-64 overflow-y-auto">
                                    {loading ? (
                                        <div className="space-y-1 py-2">
                                            {[...Array(5)].map((_, i) => (
                                                <SkeletonEmployeeItem key={i} />
                                            ))}
                                        </div>
                                    ) : filteredEmployees?.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No employees found</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {filteredEmployees?.map((emp) => (
                                                <button
                                                    key={emp.id}
                                                    onClick={() => handleEmployeeSelect(emp)}
                                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-3 transition-colors"
                                                >
                                                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-medium border border-gray-700">
                                                        {emp.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm text-gray-100">{emp.name}</p>
                                                        <p className="text-xs text-gray-500">{emp.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Confirmation Dialog */}
            {showConfirmDialog && selectedEmployee && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1e1e2d] border border-gray-800 rounded-lg shadow-2xl p-6 max-w-sm w-full text-white">
                        <h3 className="text-lg font-semibold mb-2">Confirm Transfer</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Are you sure you want to transfer <strong>{taskRoom.name}</strong> to{" "}
                            <strong>{selectedEmployee.name}</strong>?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowConfirmDialog(false)
                                    setSelectedEmployee(null)
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                                disabled={transferring}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmTransfer}
                                disabled={transferring}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                            >
                                {transferring ? "Transferring..." : "Transfer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop for menu */}
            {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
        </div>
    )
}