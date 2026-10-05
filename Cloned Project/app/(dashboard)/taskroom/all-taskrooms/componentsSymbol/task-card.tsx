"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, MessageCircle, Trash } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Employee, Task, Column } from "../types/kanban"
// import type { DragEvent } from "@/types/drag"
import { format } from 'date-fns';


interface TaskCardProps {
    task: Task
    index: number
    isDragging?: boolean
    activeDrag?: DragEvent
    onClick?: () => void
    employees: Employee[]
    stageList: Column[]

}
type DragEvent = {
    userName: string // The name of the user performing the drag
    userColor: string // A color associated with the user (used for styling)
    // Potentially other properties related to the drag event
}

export function TaskCard({ task, index, isDragging = false, activeDrag, onClick, employees, stageList }: TaskCardProps) {
    // if (!task._id) {
    //     throw new Error("Task ID is undefined");
    // }
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,

    } = useSortable({
        id: task._id ? task._id : "",
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "bg-red-500/20 text-red-400 border-red-500/30"
            case "medium":
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
            case "low":
                return "bg-green-500/20 text-green-400 border-green-500/30"
            default:
                return "bg-gray-800 text-gray-400 border-gray-700"
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        })
    }

    const handleClick = (e: React.MouseEvent) => {
        if (!isSortableDragging && onClick) {
            e.stopPropagation()
            onClick()
        }
    }
    console.log("4234234", employees)
    const getEmployeeName = (id: string): string => {

        const employee = employees?.find(emp => emp?.id === id);
        if (!employee) {
            return "Unassigned";
        }
        return `${employee.name} `;
    };
    console.log("task12312312312column", task)
    const getStageName = (id: string) => {

        if (stageList?.length > 0) {
            const ColumnName = stageList?.find(emp => emp._id == id);
            if (!ColumnName) {
                return "Unassigned";
            }
            return `${ColumnName.name} `;
        }

    }
    const checkIfOverdue = (dueDate?: string | number) => {
        if (!dueDate) {
            return {
                formattedDueDate: 'dd-MM-yyyy',
                isOverdue: false,
            };
        }

        // Safely parse the due date (handles both string and number)
        const parsedDueDate = new Date(dueDate);

        if (isNaN(parsedDueDate.getTime())) {
            // Invalid date input
            return {
                formattedDueDate: 'Invalid Date',
                isOverdue: false,
            };
        }

        const today = new Date();
        parsedDueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const isOverdue = parsedDueDate.getTime() < today.getTime();

        // Use browser locale to format automatically (preferred)
        const formattedDueDate = parsedDueDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });

        return { formattedDueDate, isOverdue };
    };
    const { formattedDueDate, isOverdue } = checkIfOverdue(task?.dueDate);

    return (
        <Card
            ref={setNodeRef}
            // style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}

            className={`p-4 bg-card relative border border-[#e5e7eb29] hover:shadow-lg hover:border-gray-700 transition-all cursor-pointer active:cursor-grabbing ${isSortableDragging || isDragging ? "opacity-50 shadow-lg scale-105" : ""
                } ${activeDrag ? "ring-2 ring-opacity-50" : ""}
           
                `}
            style={{
                ...style,
                ...(activeDrag && {
                    borderColor: activeDrag.userColor,
                    boxShadow: `0 0 0 2px ${activeDrag.userColor}40`,
                    overflow: "hidden"
                }

                ),
            }}
        >
            {/* {activeDrag && (
                <div
                    className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs text-white shadow-lg"
                    style={{ backgroundColor: activeDrag.userColor }}
                >
                    {activeDrag.userName} is moving this
                </div>
            )} */}
            <div className="mb-3 absolute top-2  right-2 ">
                <Badge variant="outline" className={`text-xs px-2 py-1 ${task?.priority && getPriorityColor(task?.priority)}`}>
                    {task.priority}
                </Badge>
            </div>
            {/* Task Title */}
            <h4
                className="font-medium text-sm text-white mb-2 leading-tight inline-block relative [word-break:break-word]"
                style={{
                    // Apply pr-14 to the first line using a pseudo-element
                    position: 'relative',
                    paddingRight: '3.5rem', // equivalent to pr-14
                }}
            >{task?.title}</h4>

            {/* Task Description */}
            <p className="text-xs text-gray-400 mb-3 leading-relaxed break-words">
                {task?.description}</p>

            {/* Priority Badge */}


            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-3">
                {task?.tags?.map((tag) => (
                    <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs px-2 py-1 bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                    >
                        {tag}
                    </Badge>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 z-1">
                        <AvatarFallback className="text-xs bg-gray-800 text-gray-300">{task.assignedToId && getEmployeeName(task.assignedToId)?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-gray-400">{task?.assignedToId && getEmployeeName(task?.assignedToId)}</span>
                </div>
                {/* 
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-red-500">{task?.dueDate && formatDate(task?.dueDate)}</span>
                    </div>


                </div> */}


            </div>
            <div className="mt-6 pt-2 border-t border-[#e5e7eb29]">
                <div className="flex items-center gap-1">

                    {/* <p>Status: {isOverdue ? 'Overdue' : 'On Time'}</p> */}


                    {
                        task?.stageId == "690894bbc17656bc8b009fc4" ?
                            <span className="text-xs "
                                style={{
                                    color: `${task?.isOverDue ? "red" : "green"}`
                                }}
                            >Status: {task?.isOverDue ? 'Overdue' : 'Completed'}</span>
                            :
                            <span className="text-xs  "
                                style={{
                                    color: `${task?.isOverDue ? "red" : "green"}`
                                }}
                            >Status: {task?.isOverDue ? 'Overdue' : 'On Time'}</span>

                    }



                </div>
                <span className="text-xs text-gray-400">Created By: {task?.userId && getEmployeeName(task?.userId)}</span>
            </div>
            {/* Status indicators */}
            {/* {task.columnId === "review" && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">Ready for review</span>
                    </div>
                </div>
            )} */}
        </Card>
    )
}
