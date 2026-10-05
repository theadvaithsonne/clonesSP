"use client";
import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Task, Column, User, DragEvent, Employee, Department, Member } from "./types/kanban"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { jwtDecode } from 'jwt-decode'   // ← import here
import {
  Plus,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  Users,
  Calendar,
  Activity
} from "lucide-react";
import Cookies from 'js-cookie';

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import SearchList from "../all-taskrooms/components/search-list"
// Mock data - replace with actual data from your API/state management
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
  members: number
  dueDate: string
  createdAt: string
}
const baseurl = "https://uatapi.garage.app/taskroom"
export default function TaskroomOverviewPage() {

  const [stageSearch, setStageSearch] = useState("")
  const [columns, setColumns] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true);
  const [IsRoomLoading, setIsRoomLoading] = useState(true);
  const [taskOverDue, settaskOverDue] = useState("")
  const [hasMore, setHasMore] = useState(true)
  const [stagesByRoom, setStagesByRoom] = useState<Column[]>([])
  const [stageId, setStageId] = useState<string>("")
  const [taskRooms, setTaskRooms] = useState<TaskRoom[]>([])
  const [activeTab, setActiveTab] = useState("today")
  const [userId, setUserId] = useState<string>("")
  const [isTasksFetching, setIsTasksFetching] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>("")
  const [query, setQuery] = useState("")
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
  useEffect(() => {
    const userData = localStorage.getItem("garage_tok")

    if (userData) {
      const payload = jwtDecode<JwtPayload>(userData)
      console.log("payload", payload)
      // setDecoded(payload)
      try {
        if (payload?.orgId && payload?.userId) {
          setOrganizationId(payload.orgId)
          setUserId(payload.userId)
          fetchTasks(payload?.userId, "today")
        }
        if (payload?.userId && payload?.organizationId) {
          fetchTaskRooms(payload?.orgId, payload?.userId)
        }
      } catch (error) {
        console.error("Error parsing userData:", error)
      }
    }
  }, [])


  useEffect(() => {
    const userData = localStorage.getItem("garage_tok")

    if (userData) {
      const payload = jwtDecode<JwtPayload>(userData)
      console.log("payload", payload)
      // setDecoded(payload)
      try {
        if (payload?.orgId && payload?.userId) {
          setOrganizationId(payload.orgId)
          setUserId(payload.userId)
          fetchTasks(payload?.userId, "today")
        }
        if (payload?.userId && payload?.orgId) {
          fetchTaskRooms(payload?.orgId, payload?.userId)
        }
      } catch (error) {
        console.error("Error parsing userData:", error)
      }
    }
  }, [])



  const fetchStagesRoom = async (roomId: string) => {
    setIsRoomLoading(true);
    try {
      let allStages: Column[] = [];
      let stagePage = 1;
      let stageTotalPages = 1;


      const response = await fetch(
        `${baseurl}/v1/stages?roomId=${roomId}&status=active&size=200&page=${stagePage}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data?.data?.length > 0) {
        allStages = [...allStages, ...data.data];
        setStagesByRoom(allStages);
        settaskOverDue(data?.overDueCount)
        //   setIsRoomLoading(false);
      }
      if (data?.metadata) {
        stageTotalPages = data.metadata.totalPages;
        stagePage = data.metadata.nextPage || stagePage + 1;
      } else {
        setIsRoomLoading(false);

      }

    } catch (error) {
      //setIsRoomLoading(false);
      console.error(`Failed to fetch stages for roomId ${roomId}:`, error);
    }
    finally {
      setIsRoomLoading(false);
    }
  };

  console.log("213zxc3245fs", stagesByRoom)
  const fetchTaskRooms = async (orgid: string, userId: string) => {

    try {
      let allTaskRooms: TaskRoom[] = []; // Adjust type as needed, e.g., TaskRoom[]
      let currentPage = 1;
      let totalPages = 1;


      const response = await fetch(
        `${baseurl}/v1/rooms?orgId=${orgid}&page=${currentPage}&size=200&userId=${userId}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data?.data?.length > 0) {
        allTaskRooms = [...allTaskRooms, ...data.data];
        setTaskRooms(allTaskRooms);
        if (!stageId) {
          console.log("jdfsjhfsdhjf", data?.data)
          fetchStagesRoom(data?.data?.[0]?._id)
          setStageId(data?.data?.[0]?._id)
          // setIsRoomLoading(false);
        }
        //  setIsRoomLoading(false);
      }
      if (data?.metadata) {
        totalPages = Number(data.metadata.totalPages) || 1;
        //  settotaltaskRooms(Number(data.metadata.count) || 0);
        currentPage = data.metadata.nextPage || currentPage + 1;
      } else {
        setIsRoomLoading(false)

      }

    } catch (error) {
      console.error(`Failed to fetch task rooms for orgId ${orgid}:`, error);
      // setTotalPages(1);
      //settotaltaskRooms(0);
      setIsRoomLoading(false);
      toast.error('Invalid task room response');
    }
    finally {
      setIsRoomLoading(false);
    }
  };

  console.log("2342342423423", taskRooms)

  const fetchTasks = async (id: string, filter: string) => {

    setIsTasksFetching(true);
    // setColumns([]); // Keep existing tasks while loading for better UX
    try {
      let allTasks: Column[] = [];
      let stagePage = 1;
      let stageTotalPages = 1;
      const dateRoom = new Date();
      dateRoom.setHours(0, 0, 0, 0)


      console.log("3fsddfd", dateRoom)

      const response = await fetch(
        `${baseurl}/v1/tasks/assigned/${id}?size=500&page=${stagePage}&dueIn=${filter}&currentDate=${dateRoom?.getTime()}`
      );
      if (!response.ok) toast(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data?.data?.length > 0) {
        allTasks = [...allTasks, ...data.data];
        setColumns(allTasks);
      }
      if (data?.metadata) {
        stageTotalPages = data.metadata.totalPages;
        stagePage = data.metadata.nextPage || stagePage + 1;
      }


    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setIsTasksFetching(false);
      setIsLoading(false);
    } finally {
      setIsTasksFetching(false);
      setIsLoading(false);
    }
  };

  console.log("432423423423423423", stagesByRoom)
  // const countOverDueTasks = (tasks) => {
  //   return columns?.filter(task => task?.isOverDue === true).length;

  // };
  // const overdueCount = countOverDueTasks(columns);
  // const totalTasks = stagesByRoom?.length;
  const totalTasks = stagesByRoom.reduce((sum, col) => {
    return sum + (col.taskCount ?? 0);
  }, 0);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();


  const overdueCount = columns.filter((task) => {
    if (!task?.dueDate) return false;

    const dueDateMs = Number(task.dueDate); // Convert string → number
    if (isNaN(dueDateMs)) return false;     // Safety: invalid date

    return dueDateMs < todayMidnight && !task.isCompleted;
  }).length;
  const completed = stagesByRoom[stagesByRoom.length - 1]?.taskCount ?? 0;
  // const completed = columns.filter((task) => task?.stageData?.name === "Done").length;
  const incompletePercentagse =
    totalTasks > 0 ? Math.round(((totalTasks - completed) / totalTasks) * 100) : 0
  const incompletePercentage =
    totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0); // Reset time to 00:00:00
  const todayTimestamp = todayDate.getTime();

  // Filter tasks where todayDate > startDate
  const filtered = columns.filter((task) => {
    if (!task.startDate) {
      console.warn(`Missing startDate for task ${task._id}`);
      return false;
    }

    let startDateTimestamp: number;

    if (typeof task.startDate === 'string') {
      startDateTimestamp = Date.parse(task.startDate);
      if (isNaN(startDateTimestamp)) {
        console.warn(`Invalid startDate for task ${task._id}: ${task.startDate}`);
        return false;
      }
    } else {
      startDateTimestamp = task.startDate;
      if (isNaN(startDateTimestamp)) {
        console.warn(`Invalid startDate for task ${task._id}: ${task.startDate}`);
        return false;
      }
    }

    return startDateTimestamp > todayTimestamp;
  });
  console.log('filtereddasdasdas', filtered)
  //setFilteredTasks(filtered);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-700 border-green-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }
  const filteredStages = taskRooms.filter((stage) =>
    stage.name.toLowerCase().includes(stageSearch.toLowerCase())
  );

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (userId) {
      fetchTasks(userId, tabId);
    }
  };
  return (
    <div
      className="w-full"
      style={{
        height: "100vh",
        overflow: "hidden"
      }}
    >


      <div className="p-6 min-h-screen space-y-6 bg-[#0e0e12] text-white"
        style={{
               height: "100vh",
          overflow: "scroll"
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Overview</h1>
            <p className="text-gray-400">Your task management dashboard</p>
          </div>
          {/* <Button className="bg-[#0e0e12] text-white hover:bg-gray-800">
          <Plus className="w-4 h-4 mr-2" />
          New TaskRoom
        </Button> */}
        </div>
        <div className="mx-full max-w-full  mb-8"
          style={{
            display: "flex",
            justifyContent: "center"
          }}
        >


          <SearchList query={query} setQuery={setQuery} userId={userId} orgId={organizationId} />
        </div>
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-[#e5e7eb29] border bg-[#0e0e12]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tasks
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {
                isLoading ?
                  <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                  :
                  <div className="text-2xl font-bold">{totalTasks}</div>
              }


              <div className="flex items-center mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-800 h-2 rounded-full"
                    style={{ width: `${incompletePercentage}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-xs text-muted-foreground">{incompletePercentage}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e5e7eb29] border bg-[#0e0e12]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Progress
              </CardTitle>
              <Clock className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {
                isLoading ?
                  <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                  :
                  <div className="text-2xl font-bold text-blue-500">{totalTasks - completed}</div>
              }


              <p className="text-xs text-muted-foreground mt-1">
                Active tasks
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#e5e7eb29] border bg-[#0e0e12]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {
                isLoading ?
                  <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                  :
                  <div className="text-2xl font-bold text-green-500">{completed}</div>
              }


              <p className="text-xs text-muted-foreground mt-1">
                All time
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#e5e7eb29] border bg-[#0e0e12]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {
                isLoading ?
                  <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                  :
                  <div className="text-2xl font-bold text-red-500">{taskOverDue}</div>
              }

              <p className="text-xs text-muted-foreground mt-1">
                Need attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 ">
          {/* Task Status */}
          <Card className="max-h-[600px] overflow-y-auto scrollbar-none border-[#e5e7eb29] border bg-[#0e0e12] ">
            <CardHeader className="space-y-4">
              <CardTitle className="flex items-center gap-2 text-base font-normal">
                <div className="p-1 rounded-full border-2 border-[#e5e7eb29]">
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                </div>
                Task Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 space-y-6">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium ml-1">
                  Select TaskRoom
                </label>
                <Select value={stageId}
                  onValueChange={(value) => {
                    console.log('New stageId:', value);
                    setStageId(value);
                    fetchStagesRoom(value)
                  }}
                >
                  <SelectTrigger aria-label="Status" className="w-full border-[#e5e7eb29] border bg-[#0e0e12]  focus:ring-0 rounded-xl px-4 h-11">
                    <SelectValue placeholder="Select status">
                      {stageId && (
                        <div className="flex items-center gap-2">
                          {taskRooms.find((s) => s._id === stageId)?.name}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <div className="flex items-center px-3 pb-2 sticky top-0 bg-[#0e0e12] z-10 pt-2">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <Input
                        placeholder="Search stages..."
                        value={stageSearch}
                        onChange={(e) => setStageSearch(e.target.value)}
                        className="h-8 w-full border-0 p-0 focus:ring-0 border-[#e5e7eb29]  focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredStages.map((stage) => (
                        <SelectItem key={stage._id} value={stage._id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </div>

                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {
                  IsRoomLoading ?
                    <>
                      {
                        [1, 2, 3, 4].map((_, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-xl animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full bg-muted" />
                              <div className="h-4 w-24 bg-muted rounded" />
                            </div>
                            <div className="h-6 w-8 bg-muted rounded" />
                          </div>
                        ))
                      }
                    </>
                    :
                    <>
                      {
                        stagesByRoom?.length > 0 ?
                          <>
                            {stagesByRoom.map((stat, index) => (
                              <div key={index} className="flex items-center justify-between p-4 border rounded-xl border-[#e5e7eb29] transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full`}
                                    style={{ background: `${stat?.color}` }}
                                  />
                                  <span className="text-sm font-medium">{stat.name}</span>
                                </div>
                                <span className={`text-lg font-bold`} style={{ color: stat.color }}>
                                  {stat.taskCount}
                                </span>
                              </div>
                            ))}
                          </>
                          :
                          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <p>No Stages Found</p>
                          </div>
                      }
                    </>
                }
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card className="max-h-[600px] min-h-[600px] overflow-y-auto scrollbar-none bg-[#0e0e12] border-[#e5e7eb29]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Tasks Assigned to Me
                </CardTitle>
                <span className="bg-gray-100 text-gray-900 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {columns?.length || 0}
                </span>
              </div>

              <div className="flex gap-2">
                {[
                  { id: 'today', label: 'Due Today' },
                  { id: 'next-two-days', label: 'Due in 2 Days' },
                  { id: 'next-week', label: 'Due Next Week' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.id
                      ? 'bg-white border border-gray-200 shadow-sm text-gray-900'
                      : 'text-gray-500 '
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {
                isLoading || isTasksFetching ?
                  <div className="space-y-4 px-6">
                    {
                      [1, 2, 3, 4].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-xl animate-pulse">
                          <div className="flex gap-4 w-full">
                            <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                            <div className="space-y-2 flex-1">
                              <div className="h-4 w-1/3 bg-muted rounded" />
                              <div className="h-3 w-1/4 bg-muted rounded" />
                            </div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                  :
                  <div className="space-y-4 px-0">
                    {
                      columns?.length > 0 ?
                        <>
                          {columns?.map((task, i) => (
                            <div key={i} className="group flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors border-b last:border-0 cursor-pointer">
                              <div className="shrink-0 pt-1">
                                <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-background`}
                                  style={{
                                    background: `${task?.stageData?.color || '#e2e8f0'}`,
                                    boxShadow: `0 0 0 1px ${task?.stageData?.color || '#e2e8f0'}`
                                  }}
                                />
                              </div>

                              <div className="flex-1 min-w-0 grid gap-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-medium leading-none truncate">{task.title}</h3>
                                  {task.priority && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${task.priority === 'high' ? 'bg-red-100 text-red-700' :
                                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                      {task.priority}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {task.startDate && (
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5" />
                                      <span>Starts {formatDate(task.startDate)}</span>
                                    </div>
                                  )}
                                  {task.dueDate && (
                                    <div className={`flex items-center gap-1.5 ${new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
                                      ? 'text-red-500 font-medium'
                                      : ''
                                      }`}>
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>Due {formatDate(task.dueDate)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted">
                                  <svg
                                    className="w-4 h-4 text-muted-foreground"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>

                        :
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="bg-muted/50 p-4 rounded-full mb-4">
                            <Users className="w-8 h-8 text-muted-foreground/50" />
                          </div>
                          <h3 className="text-sm font-medium text-foreground mb-1">No tasks found</h3>
                          <p className="text-xs text-muted-foreground max-w-[200px]">
                            You don&apos;t have any tasks assigned for this period.
                          </p>
                        </div>
                    }
                  </div>
              }
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockData.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className={`w-2 h-2 rounded-full ${activity.status === "in progress" ? "bg-blue-500" :
                  activity.status === "review" ? "bg-yellow-500" :
                    "bg-green-500"
                  }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{activity.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${activity.status === "in progress"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-yellow-100 text-yellow-700"
                      }`}>
                      {activity.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {activity.assignee}
                    </div>
                    <div className="flex gap-1">
                      {activity.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card> */}
      </div >
    </div>
  );
}