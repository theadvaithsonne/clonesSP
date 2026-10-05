"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import type { Task, Employee, Subtask } from "./types/kanban"
import Cookies from 'js-cookie'
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { EditTaskRoom } from "./components/edit-task-dialog"
import { Search, Filter, Calendar, Tag, AlertCircle, Clock, ChevronDown } from "lucide-react"
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { jwtDecode } from 'jwt-decode'   // ← import here
const baseurl = "https://uatapi.garage.app/taskroom"

function normalizeStatus(s?: string) {
  if (!s) return undefined
  const v = s.toLowerCase().replace(/[_-]/g, " ").trim()
  return v === "active" ? "in progress" : v
}

function normalizePriority(p?: string): "low" | "medium" | "high" | undefined {
  if (!p) return undefined
  const v = p.toLowerCase().trim()
  return ["low", "medium", "high"].includes(v) ? v as any : undefined
}

type StatusOption = "All Status" | "Backlog" | "In Progress" | "Review" | "Done"
type PriorityOption = "All Priority" | "High" | "Medium" | "Low"
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
export default function Page() {
  // Search & Filters
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All Status")
  const [priorityFilter, setPriorityFilter] = useState<PriorityOption>("All Priority")

  // Infinite scroll
  const [tasksPage, setTasksPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)

  // Data
  const [columns, setColumns] = useState<Task[]>([])
  const [stagesByRoom, setStagesByRoom] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  // User & Dialog
  const [userId, setUserId] = useState("")
  const [userRole, setUserRole] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [open, setOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [mounted, setMounted] = useState(false)
  const observer = useRef<IntersectionObserver | null>(null)
  const router = useRouter()
  // Fetch employees once
  const fetchEmployees = async () => {

    try {

      const orgId = typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null;

      if (!orgId) {
        toast("orgId not found in localStorage");
     
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/organizations/${orgId}/users`, {
        method: 'GET',
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

    }


  };


  // Main fetch function (single source of truth)
  const fetchTasks = async (id: string, page: number, append: boolean) => {
    try {
      const res = await fetch(`${baseurl}/v1/tasks/assigned/${id}?size=50&page=${page}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      const newTasks: Task[] = json.data || []

      setColumns(prev => append ? [...prev, ...newTasks] : newTasks)
      setHasMore(newTasks.length === 50)
      setError(null)
    } catch (err) {
      console.error("Fetch error:", err)
      toast.error("Failed to load tasks")
      setError("Failed to load tasks")
    }
  }

  // Single effect: handles initial load, filters, and infinite scroll
  useEffect(() => {
    if (!userId) return

    // Reset on filter/search change
    const filterChanged = query || statusFilter !== "All Status" || priorityFilter !== "All Priority"
    if (filterChanged && tasksPage !== 1) {
      setTasksPage(1)
      return // Will re-run with page 1
    }

    if (tasksPage === 1) {
      setIsLoading(true)
      setColumns([])
      setHasMore(true)
      setError(null)
    } else if (isFetchingMore || !hasMore) {
      return
    } else {
      setIsFetchingMore(true)
    }

    fetchTasks(userId, tasksPage, tasksPage > 1)
      .finally(() => {
        setIsLoading(false)
        setIsFetchingMore(false)
      })
  }, [userId, tasksPage, query, statusFilter, priorityFilter])

  // Load user data once

  useEffect(() => {
    const userData = localStorage.getItem("garage_tok")

    if (userData) {
      const payload = jwtDecode<JwtPayload>(userData)
      console.log("payload", payload)
      // setDecoded(payload)
      try {
        if (payload?.orgId && payload?.userId) {

          setUserId(payload.userId)
          fetchEmployees()
        }
        if (payload?.role) {
          setUserRole(payload.role)
        }
      } catch (error) {
        console.error("Error parsing userData:", error)
      }
    }
  }, [])



  console.log("selectedTask", selectedTask)
  // Intersection Observer for infinite scroll
  const lastTaskRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isFetchingMore) return
    if (observer.current) observer.current.disconnect()

    observer.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          setTasksPage(prev => prev + 1)
        }
      },
      { rootMargin: "100px" }
    )

    if (node) observer.current.observe(node)
  }, [isLoading, isFetchingMore, hasMore])

  // Cleanup
  useEffect(() => {
    return () => observer.current?.disconnect()
  }, [])

  // Dynamic status options
  const uniqueStatusOptions = useMemo(() => {
    const set = new Set<string>(["All Status"])
    columns.forEach(t => t.stageData?.name && set.add(t.stageData.name))
    return Array.from(set).sort()
  }, [columns])

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return columns.filter(task => {
      const matchesQuery = !query || task.title?.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = statusFilter === "All Status" || task.stageData?.name === statusFilter
      const matchesPriority = priorityFilter === "All Priority" ||
        normalizePriority(task.priority)?.toLowerCase() === priorityFilter.toLowerCase().replace(" priority", "")

      return matchesQuery && matchesStatus && matchesPriority
    })
  }, [columns, query, statusFilter, priorityFilter])

  // Helpers
  const getPriorityColor = (p?: string) => {
    switch (p?.toLowerCase()) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/30"
      case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/30"
      case "low": return "bg-green-500/20 text-green-400 border-green-500/30"
      default: return "bg-gray-800 text-gray-400 border-gray-700"
    }
  }

  const getStatusColor = (s?: string) => {
    const v = normalizeStatus(s)
    switch (v) {
      case "done": return "bg-green-500/20 text-green-400 border-green-500/30"
      case "in progress": return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "review": return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "backlog": return "bg-gray-800 text-gray-400 border-gray-700"
      default: return "bg-gray-800 text-gray-400 border-gray-700"
    }
  }

  const checkIfOverdue = (dueDate?: string | number) => {
    if (!dueDate) return { formattedDueDate: "No due date", isOverdue: false }
    const d = new Date(dueDate)
    if (isNaN(d.getTime())) return { formattedDueDate: "Invalid", isOverdue: false }

    const today = new Date()
    d.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0)
    const isOverdue = d.getTime() < today.getTime()

    return {
      isOverdue,
      formattedDueDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  const fetchStages = async (roomId: string) => {
    try {
      const res = await fetch(`${baseurl}/v1/stages?roomId=${roomId}&status=active&size=50`)
      if (res.ok) {
        const data = await res.json()
        setStagesByRoom(data.data || [])
      }
    } catch (err) {
      console.error("Failed to load stages")
    }
  }

  const handleTaskClick = async (task: Task) => {
    setSelectedTask(task)
    if (task.roomId) await fetchStages(task.roomId)
    setOpen(true)
  }
  // const {
  //   user,
  //   logout,
  // } = useAuthStore();
  const handleLogout = async () => {
    // await logout();
    router.push("/login");
  };



  const TaskSkeleton = () => (
    <>
      <div className="hidden lg:grid grid-cols-[3fr_1.3fr_1fr_2fr_1fr] gap-6 py-4 px-6 border-b border-gray-800 animate-pulse bg-black">
        <div className="space-y-2">
          <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          <div className="h-3 bg-gray-900 rounded w-1/2"></div>
        </div>
        <div className="h-6 bg-gray-800 rounded-full w-24"></div>
        <div className="h-6 bg-gray-800 rounded-full w-20"></div>
        <div className="h-4 bg-gray-800 rounded w-24"></div>
        <div className="flex gap-2">
          <div className="h-6 bg-gray-800 rounded-full w-16"></div>
          <div className="h-6 bg-gray-800 rounded-full w-12"></div>
        </div>
      </div>
      <div className="lg:hidden p-4 border-b border-gray-800 space-y-3 animate-pulse bg-black">
        <div className="h-5 bg-gray-800 rounded w-2/3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-800 rounded w-full"></div>
          <div className="h-3 bg-gray-800 rounded w-4/5"></div>
        </div>
      </div>
    </>
  )
  console.log("filteredTasks", filteredTasks)


  if (mounted)
    return <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
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
    <div
      className="w-full"
      style={{
        height: "100vh",
        overflow: "hidden"
      }}
    >


      <div className="min-h-screen w-full bg-[#0e0e12] p-4 md:p-6 lg:p-8 text-white"
        style={{
          height: "100vh",
          overflow: "scroll"
        }}
      >
        <div className="max-w-[1800px] mx-auto">
          <header className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Assigned to Me
                </h1>
                {/* <p className="text-sm text-gray-600 mt-1">
                {filteredTasks.length} of {columns.length} tasks
              </p> */}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:min-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="pl-10 h-10 border-gray-700 bg-gray-900 text-white focus:border-gray-500 focus:ring-0 rounded placeholder:text-gray-500"
                  />
                </div>

                <div className="flex gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-10 min-w-[130px] justify-between bg-gray-900 border-gray-700 hover:bg-gray-800 text-white rounded">
                        <span className="text-sm text-gray-300">{statusFilter}</span>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-gray-300">
                      {uniqueStatusOptions.map(s => (
                        <DropdownMenuItem key={s} onClick={() => setStatusFilter(s as StatusOption)}>
                          {s}
                          {statusFilter === s && <span className="ml-auto text-gray-900">✓</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-10 min-w-[130px] justify-between bg-gray-900 border-gray-700 hover:bg-gray-800 text-white rounded">
                        <span className="text-sm text-gray-300">{priorityFilter}</span>
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-gray-300">
                      {(["All Priority", "High", "Medium", "Low"] as PriorityOption[]).map(p => (
                        <DropdownMenuItem key={p} onClick={() => setPriorityFilter(p)}>
                          {p}
                          {priorityFilter === p && <span className="ml-auto text-gray-900">✓</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          <section className="bg-[#0e0e12] rounded-lg border border-[#e5e7eb29] overflow-hidden">
            <div className="hidden lg:grid grid-cols-[3fr_1.3fr_1fr_2fr_1fr] gap-6 bg-[#1e1e2d] border-b border-[#e5e7eb29] py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <div>Task</div>
              <div>Status</div>
              <div>Priority</div>
              <div>Due Date</div>
              <div>Tags</div>
            </div>

            {isLoading && columns.length === 0 ? (
              Array(8).fill(0).map((_, i) => <TaskSkeleton key={i} />)
            ) : error ? (
              <div className="p-16 text-center text-red-600">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p className="text-sm">{error}</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-16 text-center text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="text-sm">No tasks found</p>
              </div>
            ) : (
              <>
                {filteredTasks.map((task, index) => {
                  const isLast = index === filteredTasks.length - 1
                  const { isOverdue, formattedDueDate } = checkIfOverdue(task.dueDate)
                  const isDone = task.stageData?.name === "Done"

                  return (
                    <div key={task._id} ref={isLast ? lastTaskRef : null}>
                      {/* Desktop Row */}
                      <div
                        onClick={() => handleTaskClick(task)}
                        className="hidden lg:grid grid-cols-[3fr_1.3fr_1fr_2fr_1fr] gap-6 py-4 px-6 border-b border-[#e5e7eb29] cursor-pointer hover:bg-gray-900 transition-colors items-center"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {isDone ? (
                              <div className="w-5 h-5 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center">
                                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : task.isOverDue ? (
                              <div className="w-5 h-5 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center">
                                <Clock className="w-3 h-3 text-red-600" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-500"></div>
                            )}
                          </div>
                          <div className="flex-1 ">
                            <p className={`text-sm font-medium text-gray-100 mb-1 ${isDone ? 'line-through text-gray-500' : ''}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-gray-400 ">{task.description}</p>
                            )}
                          </div>
                        </div>

                        <Badge className={`${getStatusColor(task.stageData?.name)} border-0 text-xs font-medium w-fit px-3 py-1 rounded-full`}>
                          {task.stageData?.name || "—"}
                        </Badge>

                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${task.priority?.toLowerCase() === 'high' ? 'bg-red-500' :
                            task.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}></div>
                          <span className="text-sm text-gray-300">{task.priority || "Low"}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {task.isOverDue && (
                            <Badge className="bg-red-500 text-white border-0 text-xs font-medium px-2 py-0.5 rounded">
                              Overdue
                            </Badge>
                          )}
                          <span className="text-sm text-gray-300">{formattedDueDate}</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(task.tags || []).slice(0, 3).map(t => (
                            <span key={t} className="px-2.5 py-1 text-xs bg-gray-800 rounded text-gray-300 border border-gray-700">
                              {t}
                            </span>
                          ))}
                          {task.tags && task.tags.length > 3 && (
                            <span className="px-2 py-1 text-xs text-gray-600 font-medium">
                              +{task.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card */}
                      <div
                        onClick={() => handleTaskClick(task)}
                        className="lg:hidden p-4 border-b border-[#e5e7eb29] cursor-pointer hover:bg-gray-900 transition-colors"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="mt-1">
                            {isDone ? (
                              <div className="w-5 h-5 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center">
                                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : task.isOverDue ? (
                              <div className="w-5 h-5 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center">
                                <Clock className="w-3 h-3 text-red-600" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 border-2 border-blue-500"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <h3 className={`text-sm font-medium flex-1 ${isDone ? 'line-through text-gray-500' : 'text-gray-100'}`}>
                                {task.title}
                              </h3>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className={`w-2 h-2 rounded-full ${task.priority?.toLowerCase() === 'high' ? 'bg-red-500' :
                                  task.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}></div>
                                <span className="text-xs text-gray-600">{task.priority || "Low"}</span>
                              </div>
                            </div>

                            {task.description && (
                              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{task.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge className={`${getStatusColor(task.stageData?.name)} border-0 font-medium px-2.5 py-1 rounded-full`}>
                                {task.stageData?.name || "—"}
                              </Badge>
                              {task.isOverDue && (
                                <Badge className="bg-red-500 text-white border-0 font-medium px-2 py-0.5 rounded">
                                  Overdue
                                </Badge>
                              )}
                              <span className="text-gray-400">{formattedDueDate}</span>
                            </div>

                            {task.tags?.length ? (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {task.tags.slice(0, 3).map(t => (
                                  <span key={t} className="px-2 py-0.5 text-xs bg-gray-800 rounded text-gray-300 border border-gray-700">
                                    {t}
                                  </span>
                                ))}
                                {task.tags.length > 3 && (
                                  <span className="text-xs text-gray-600 font-medium">
                                    +{task.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Loading More */}
                {isFetchingMore && (
                  <div className="py-8 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-900"></div>
                      Loading more...
                    </div>
                  </div>
                )}

                {!hasMore && filteredTasks.length > 0 && (
                  <div className="py-8 text-center text-sm text-gray-500">
                    No more tasks
                  </div>
                )}
              </>
            )}
          </section>
        </div>











        {/* Edit Dialog */}
        {selectedTask && (
          <EditTaskRoom
            open={open}
            onOpenChange={setOpen}
            task={selectedTask}
            userId={userId}
            columns={columns}
            onCancel={() => setOpen(false)}
            setColumns={setColumns}
            roomId={selectedTask.roomId}
            workspaceUserId={selectedTask.userId}
            stagesByRoom={stagesByRoom}
            employees={employees}

            userRole={userRole}
            subtasks={subtasks}
            setSubtasks={setSubtasks}
            conversationId={selectedTask?.roomData?.conversationId}
          />
        )}
      </div>
    </div>
  )
}