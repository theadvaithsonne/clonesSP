"use client"

import * as React from "react"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import Cookies from "js-cookie"
import type { Task, Employee } from "../types/kanban"

interface TaskSearchProps {
    roomId: string
    onTaskClick: (task: Task) => void
    employees: Employee[]
}

export function TaskSearch({ roomId, onTaskClick, employees }: TaskSearchProps) {
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<Task[]>([])
    const [loading, setLoading] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                handleSearch(query)
            } else {
                setResults([])
                setIsOpen(false)
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [query])

    // Close on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSearch = async (term: string) => {
        setLoading(true)
        try {
            const token = localStorage.getItem("garage_tok")
            // https://uatapi.garage.app/taskroom/v1/stages/task?roomId=68ff6c3c5aba2374f32522a7&search=%22%22
            const response = await fetch(
                `https://uatapi.garage.app/taskroom/v1/stages/task?roomId=${roomId}&search=${encodeURIComponent(term)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            const data = await response.json()
            if (data.status && Array.isArray(data.data)) {
                setResults(data.data)
                setIsOpen(true)
            }
        } catch (error) {
            console.error("Search failed:", error)
        } finally {
            setLoading(false)
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case "high":
                return "bg-red-500"
            case "medium":
                return "bg-yellow-500"
            case "low":
                return "bg-green-500"
            default:
                return "bg-gray-300"
        }
    }

    const getEmployeeInitial = (id?: string) => {
        if (!id) return "?"
        const emp = employees.find(e => e._id === id)
        return emp ? (emp.avatar || emp.name.charAt(0).toUpperCase()) : "?"
    }

    const getEmployeeColor = (id?: string) => {
        if (!id) return ""
        const emp = employees.find(e => e._id === id)
        return emp?.color || ""
    }

    return (
        <div ref={containerRef} className="relative w-full max-w-md">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="pl-9 bg-[#1e1e2d] border-[#e5e7eb29] text-white placeholder:text-gray-500 focus-visible:ring-offset-0 focus-visible:ring-gray-600 transition-colors"
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
            </div>

            {isOpen && query.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0e0e12] text-white rounded-lg border border-[#e5e7eb29] shadow-lg overflow-hidden z-50 max-h-[400px] overflow-y-auto">

                    <div className="p-2 space-y-1">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            <span className="shrink-0"><Search className="h-3 w-3" /></span>
                            <span>TASKS ({results.length})</span>
                        </div>

                        {results.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No tasks found
                            </div>
                        ) : (
                            results.map((task) => (
                                <div
                                    key={task._id}
                                    onClick={() => {
                                        onTaskClick(task)
                                        setIsOpen(false)
                                    }}
                                    className="flex items-start gap-3 p-2 rounded-md hover:bg-[#1e1e2d] cursor-pointer transition-colors group"
                                >
                                    {/* <div className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", getPriorityColor(task.priority))} /> */}

                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="text-sm font-medium leading-none truncate text-white group-hover:text-blue-400 transition-colors">
                                            {task.title}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            {/* Status/Stage Badge - Since we don't have stage name readily available in task object usually, we might skip or show tags */}
                                            {/* For now showing tags if available */}
                                            {task.tags && task.tags.length > 0 && (
                                                <div className="flex gap-1">
                                                    {task.tags.slice(0, 2).map(tag => (
                                                        <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[10px] bg-[#1e1e2d] font-normal border-transparent group-hover:border-[#e5e7eb29]">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}

                                            {task.dueDate && (
                                                <span className="text-[10px] whitespace-nowrap">
                                                    Due {format(new Date(task.dueDate), "MM/dd/yyyy")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {task.userId && (
                                        <div
                                            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] text-white shrink-0"
                                            style={{ backgroundColor: getEmployeeColor(task.userId) || "#6b7280" }}
                                        >
                                            {getEmployeeInitial(task.userId)}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
