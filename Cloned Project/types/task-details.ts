import type { Task, Subtask } from "./pipeline"

export interface APIChecklistItem {
  _id: string;
  name: string;
  description: string;
  priority: number;
  minTAT?: number;
  maxTAT?: number;
  userId: string;
  pipelineId: string;
  stagelineId: string;
  taskId: string;
  subTaskId: string;
  orderId: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtendedSubtask extends Subtask {
  checklists?: APIChecklistItem[];
  userId?: string;
  pipelineId?: string;
  stagelineId?: string;
  taskId?: string;
  priority?: number;
}

export interface ExtendedTask extends Task {
  pipelineId: string;
  stagelineId: string;
  createdBy: string;
  subtasks: ExtendedSubtask[];
  userId: string;
  _id: string;
  jobCount?: number;
} 