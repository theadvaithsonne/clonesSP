export type PipelineStatus = "active" | "archived" | "draft"
export type JobPriority = 4 | 3 | 2 | 1
export type TaskStatus = "not_started" | "in_progress" | "completed" | "blocked"
export type AutomationType =
  | "send_email"
  | "create_task"
  | "update_metadata"
  | "assign_team"
  | "send_form"
  | "log_time"
  | "transition_pipeline"
  | "trigger_billing"
  | "assign_ai_agent"

export interface Pipeline {
  id: string
  _id?: string
  userId?: string
  name: string
  description: string
  status: PipelineStatus
  stages: Stage[]
  createdAt: string
  updatedAt: string
  createdBy: string
  tags: string[]
  customFields: CustomField[]
  isRecurring: boolean
  recurringInterval?: string
  permissions: PipelinePermission[]
}

export interface Stage {
  id: string
  name: string
  description: string
  order: number
  automations: Automation[]
  jobs: Job[]
  color?: string
  autoMove: boolean
}

export interface Automation {
  id: string
  type: AutomationType
  name: string
  description: string
  config: Record<string, any>
  isActive: boolean
}

export interface Job {
  id: string
  title: string
  description: string
  stageId: string
  priority: JobPriority
  dueDate?: string
  assignedTo: string[]
  tags: string[]
  customFieldValues: CustomFieldValue[]
  tasks: Task[]
  createdAt: string
  updatedAt: string
  createdBy: string
  isRecurring: boolean
  recurringInterval?: string
  templateId?: string
  progress: number
  clientFirm?: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  dueDate?: string
  assignedTo: string[]
  priority: JobPriority
  createdAt: string
  updatedAt: string
  createdBy: string
  completedAt?: string
  completedBy?: string
  subtasks: Subtask[]
  minTAT?: number
  maxTAT?: number
  aiAgent?: string
  checklist?: ChecklistItem[]
  reminderSchedule?: {
    frequency: "daily" | "weekly" | "custom"
    time?: string
    days?: string[]
    lastSent?: string
  }
  deadline?: string
  assignedBy?: string
  clientPOC?: string
  logs?: Log[]
}

export interface Log {
  id: string
  timestamp: string
  action: string
  details: string
}

export interface Subtask {
  id: string
  _id: string
  title: string
  description?: string
  status: TaskStatus
  assignedTo: string[]
  dueDate?: string
  completedAt?: string
  completedBy?: string
  minTAT?: number
  maxTAT?: number
  clientPOC?: string
  deadline?: string
  assignedBy?: string
  checklist?: ChecklistItem[]
  aiAgent?: string
}

export interface CustomField {
  id: string
  name: string
  type: "text" | "number" | "date" | "select" | "multiselect" | "checkbox"
  options?: string[]
  required: boolean
}

export interface CustomFieldValue {
  fieldId: string
  value: string | number | boolean | Date | string[] | null
}

export interface PipelinePermission {
  userId: string
  role: "viewer" | "editor" | "admin"
}

export interface PipelineTemplate {
  id: string
  name: string
  description: string
  stages: Omit<Stage, "jobs">[]
  customFields: CustomField[]
  tags: string[]
}

export interface JobTemplate {
  id: string
  name: string
  description: string
  tasks: Omit<Task, "id" | "createdAt" | "updatedAt" | "createdBy" | "completedAt" | "completedBy">[]
  customFieldValues: CustomFieldValue[]
  tags: string[]
}

export interface AIAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  isActive: boolean
}

export interface AIQuery {
  id: string
  jobId: string
  agentId: string
  query: string
  status: "open" | "in_progress" | "resolved" | "dismissed"
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
  resolution?: string
  priority: "low" | "medium" | "high"
  category: string
}

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface TaskLog {
  id: string
  timestamp: string
  action: string
  details: string
}
