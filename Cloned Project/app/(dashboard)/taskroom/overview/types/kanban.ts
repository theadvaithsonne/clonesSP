export interface Task {
    _id?: string
    id?: string
    title?: string
    description?: string
    priority?: "high" | "medium" | "low"
    tags?: string[]
    assignee?: string
    stageId?: string
    dueDate?: string
    comments?: number
    columnId?: string
    lastModified?: number
    roomId?: string
    userId?: string
    assignedToId?: string
    createdAt?: string
    timeLoggedHours?: number
    updatedAt?: string
    startDate?: string
    isOverDue?: boolean
    stageData?: Column
    taskCount?: number
    isCompleted?: boolean
}



export interface Member {
    // userRole membership id returned from POST /v1/users/roles
    _id?: string,
    roomId?: string,
    userId?: string,
    role?: string,
    status?: string,
    createdAt?: string,
    updatedAt?: string,
    __v?: number
}
export interface Column {
    _id: string
    tasks: Task[]
    color: string
    name: string
    taskCount?: number
}

export interface DragItem {
    id: string
    type: string
    columnId: string
}

export interface User {
    id: string
    name: string
    avatar: string
    color: string
}
export interface Employee {
    _id: string
    id: string
    name: string
    firstName: string
    email: string
    avatar?: string
    color?: string
    departmentId?: string
    department?: Department
    lastName?: string
}
export interface DragEvent {
    userId: string
    userName: string
    userColor: string
    taskId: string
    timestamp: number
}
export interface Department {
    id: string
    name: string
}