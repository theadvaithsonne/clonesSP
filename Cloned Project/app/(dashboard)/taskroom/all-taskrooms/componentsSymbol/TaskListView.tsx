import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Calendar, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { useListViewDetailStore } from '@/store/taskroom/listViewDetailStore';

// Types
interface Subtask {
  id?: string;
  _id?: string;
  title: string;
  assignedToId?: string;
  isCompleted?: boolean;
}

interface Task {
  _id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  tags?: string[];
  assignedToId?: string;
  userId?: string;
  dueDate?: string | number;
  columnId?: string;
}

interface Column {
  _id: string;
  name: string;
  color: string;
  tasks: Task[];
  taskCount?: number;
}

interface Employee {
  id: string;
  name: string;
}

interface TaskListViewProps {
  columns: Column[];
  employees: Employee[];
  onTaskClick?: (task: Task) => void;
  onAddTask: (columnId: string) => void;
  fetchTasksForStage: (stageId: string) => Promise<void>;
  stageExhausted: Record<string, boolean>;
  baseurl: string;
  authToken: string;
}

// Task Row Component
const TaskRow = ({
  task,
  columnName,
  columnColor,
  employees,
  onClick,
  onSubtaskToggle,
  expandedTaskId,
  subtasks,
  isLoadingSubtasks
}: {
  task: Task;
  columnName: string;
  columnColor: string;
  employees: Employee[];
  onClick?: () => void;
  onSubtaskToggle?: () => void;
  expandedTaskId?: string | null;
  subtasks?: Subtask[];
  isLoadingSubtasks?: boolean;
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getEmployeeName = (id: string): string => {
    const employee = employees?.find(emp => emp?.id === id);
    return employee ? employee.name : 'Unassigned';
  };

  const checkIfOverdue = (dueDate?: string | number) => {
    if (!dueDate) {
      return { formattedDueDate: 'N/A', isOverdue: false };
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return { formattedDueDate: 'Invalid Date', isOverdue: false };
    }

    const today = new Date();
    parsedDueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const isOverdue = parsedDueDate.getTime() < today.getTime();
    const formattedDueDate = parsedDueDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return { formattedDueDate, isOverdue };
  };

  const { formattedDueDate, isOverdue } = checkIfOverdue(task?.dueDate);
  const isExpanded = expandedTaskId === task._id;

  return (
    <>
      <div className="group hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-transparent cursor-pointer transition-all duration-200 border-b border-[#e5e7eb29]">
        {/* Desktop View */}
        <div onClick={onSubtaskToggle} className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-4 items-center">
          <div className="col-span-3">
            <div className="font-semibold text-sm text-white mb-1 group-hover:text-blue-400 transition-colors">
              {task.title}
            </div>
            <div className="text-xs text-gray-400 line-clamp-2">{task.description}</div>
          </div>

          <div className="col-span-2">
            <div
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm"
              style={{ backgroundColor: columnColor }}
            >
              {columnName}
            </div>
          </div>

          <div className="col-span-2">
            <Badge
              variant="outline"
              className={`text-xs px-3 py-1 font-medium border border-[#e5e7eb29] bg-[#1e1e2d] text-white`}
            >
              {task.priority}
            </Badge>
          </div>

          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 border-2 border-[#e5e7eb29] shadow-sm">
                <AvatarFallback className="text-xs bg-gradient-to-br from-blue-400 to-blue-600 text-white font-semibold">
                  {task.assignedToId ? getEmployeeName(task.assignedToId)?.[0]?.toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-300 font-medium truncate">
                {task.assignedToId ? getEmployeeName(task.assignedToId) : 'Unassigned'}
              </span>
            </div>
          </div>

          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isOverdue ? 'bg-red-50' : 'bg-green-50'}`}>
                <Calendar className={`h-3.5 w-3.5 ${isOverdue ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <span
                className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}
              >
                {formattedDueDate}
              </span>
            </div>
          </div>

          <div className="col-span-1">
            <div className="flex flex-wrap gap-1">
              {task?.tags?.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 bg-[#1e1e2d] text-gray-300 hover:text-white border border-[#e5e7eb29] transition-colors"
                >
                  {tag}
                </Badge>
              ))}
              {task?.tags && task.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tablet View */}
        <div onClick={onSubtaskToggle} className="hidden md:grid lg:hidden grid-cols-8 gap-3 px-4 py-3 items-center">
          <div className="col-span-3">
            <div className="font-semibold text-sm text-white mb-1">{task.title}</div>
            <div className="text-xs text-gray-400 line-clamp-1">{task.description}</div>
          </div>
          <div className="col-span-2">
            <div
              className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: columnColor }}
            >
              {columnName}
            </div>
          </div>
          <div className="col-span-1">
            <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority[0].toUpperCase()}
            </Badge>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-blue-500 text-white">
                  {task.assignedToId ? getEmployeeName(task.assignedToId)?.[0]?.toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-gray-700 truncate">
                {task.assignedToId ? getEmployeeName(task.assignedToId).split(' ')[0] : 'Unassigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile View - Horizontal Scrollable */}
        <div onClick={onSubtaskToggle} className="md:hidden">
          <div className="grid grid-cols-[minmax(140px,2fr)_minmax(90px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)_minmax(90px,1fr)] gap-3 px-4 py-3 items-center">
            <div className="min-w-0">
              <div className="font-semibold text-xs text-white mb-0.5 truncate">{task.title}</div>
              <div className="text-xs text-gray-400 line-clamp-1">{task.description}</div>
            </div>

            <div className="min-w-0">
              <div
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap"
                style={{ backgroundColor: columnColor }}
              >
                {columnName}
              </div>
            </div>

            <div className="min-w-0">
              <Badge className={`text-xs whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </Badge>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-blue-500 text-white">
                    {task.assignedToId ? getEmployeeName(task.assignedToId)?.[0]?.toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-600 truncate">
                  {task.assignedToId ? getEmployeeName(task.assignedToId).split(' ')[0] : 'N/A'}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600' : 'text-green-600'} whitespace-nowrap`}>
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{formattedDueDate}</span>
              </div>
            </div>
          </div>

          {task?.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 px-4 pb-3">
              {task.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2 py-0.5">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subtasks Section */}
      {isExpanded && (
        <div className="bg-[#0e0e12] border-b border-[#e5e7eb29]">
          {isLoadingSubtasks ? (
            <div className="px-6 py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading subtasks...</p>
            </div>
          ) : subtasks && subtasks.length > 0 ? (
            <div className="px-6 py-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <ChevronDown className="w-4 h-4" />
                Subtasks ({subtasks.length})
              </h4>
              <div className="bg-[#1e1e2d] rounded-lg shadow-sm border border-[#e5e7eb29] overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-[#0e0e12] border-b border-[#e5e7eb29]">
                  <div className="col-span-1 text-xs font-semibold text-gray-300">Status</div>
                  <div className="col-span-7 text-xs font-semibold text-gray-300">Title</div>
                  <div className="col-span-4 text-xs font-semibold text-gray-300">Assigned To</div>
                </div>

                {subtasks.map((subtask) => (
                  <div
                    key={subtask._id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 border-b border-[#e5e7eb29] last:border-0 hover:bg-[#0e0e12] transition-colors cursor-pointer"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const id = subtask._id || subtask.id;
                      if (id) {
                        await fetchSubtaskDetail(id);
                      }
                      onClick?.();
                    }}
                  >
                    <div className="col-span-1 flex items-center">
                      <div className={`flex items-center justify-center w-5 h-5 rounded border-2 ${subtask.isCompleted
                        ? 'bg-green-500 border-green-500'
                        : 'bg-transparent border-gray-600'
                        }`}>
                        {subtask.isCompleted && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    <div className="col-span-7">
                      <span className={`text-sm ${subtask.isCompleted ? 'line-through text-gray-500' : 'text-white'}`}>
                        {subtask.title}
                      </span>
                    </div>

                    <div className="col-span-4 flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-[#e5e7eb29]">
                        <AvatarFallback className="text-xs bg-gradient-to-br from-purple-400 to-purple-600 text-white font-semibold">
                          {subtask.assignedToId ? getEmployeeName(subtask.assignedToId)?.[0]?.toUpperCase() : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-400 truncate">
                        {subtask.assignedToId ? getEmployeeName(subtask.assignedToId) : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 py-6 text-center">
              <p className="text-sm text-gray-400">No subtasks available</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

// Main List View Component
export function TaskListView({
  columns,
  employees,
  onTaskClick,
  onAddTask,
  fetchTasksForStage,
  stageExhausted,
  baseurl,
  authToken
}: TaskListViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({});
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);
  const isFetchingRef = useRef<Record<string, boolean>>({});
  const isFetchingSubtaskRef = useRef<string | null>(null);

  const fetchTaskDetail = useListViewDetailStore((s) => s.fetchTaskDetail);
  const fetchSubtaskDetail = useListViewDetailStore((s) => s.fetchSubtaskDetail);

  useEffect(() => {
    setExpandedColumns(new Set(columns.map(col => col._id)));
  }, []);

  const toggleColumn = (columnId: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const loadMoreTasks = async (columnId: string) => {
    if (isFetchingRef.current[columnId] || stageExhausted[columnId]) return;

    isFetchingRef.current[columnId] = true;
    setIsLoading(true);

    try {
      await fetchTasksForStage(columnId);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current[columnId] = false;
    }
  };

  const fetchSubtasks = async (taskId: string) => {
    if (isFetchingSubtaskRef.current === taskId) return;

    isFetchingSubtaskRef.current = taskId;
    setIsLoadingSubtasks(true);

    try {
      // New structure: load subtasks from `tasks/detail/:id`
      const detail: any = await fetchTaskDetail(taskId);
      const subtasks: Subtask[] =
        (detail?.subtasks as Subtask[]) ||
        (detail?.subTasks as Subtask[]) ||
        (detail?.sub_tasks as Subtask[]) ||
        (detail?.data?.subtasks as Subtask[]) ||
        [];
      setSubtasksMap((prev) => ({ ...prev, [taskId]: Array.isArray(subtasks) ? subtasks : [] }));
    } catch (err) {
      console.error("Failed to load subtasks", err);
      setSubtasksMap(prev => ({ ...prev, [taskId]: [] }));
    } finally {
      setIsLoadingSubtasks(false);
      isFetchingSubtaskRef.current = null;
    }
  };

  const toggleTaskSubtasks = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
      if (!subtasksMap[taskId]) {
        fetchSubtasks(taskId);
      }
    }
  };

  const filteredColumns = columns?.map(column => {
    if (!searchTerm) return column;

    const filteredTasks = column.tasks.filter(task =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return { ...column, tasks: filteredTasks };
  });

  return (
    <div className="w-full h-full bg-[#0e0e12] flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="min-w-full inline-block align-middle">
          <Card className="m-4 md:m-6 mt-4 shadow-lg border-0 overflow-hidden bg-[#0e0e12]">
            <div className="overflow-x-auto">
              <div className="bg-[#0e0e12] min-w-[700px] md:min-w-0">
                {filteredColumns?.map((column) => {
                  const uniqueTasks = Array.from(
                    new Map(
                      column?.tasks?.map((task) => [task._id, task]) || []
                    ).values()
                  );

                  const isExpanded = expandedColumns.has(column._id);

                  return (
                    <div key={column._id} className="border-b border-[#e5e7eb29] last:border-0">
                      <div className="bg-gradient-to-r from-[#1e1e2d] to-transparent hover:from-[#1e1e2d]/80 transition-all duration-200">
                        <div className="px-4 md:px-6 py-4 flex items-center justify-between">
                          <button
                            onClick={() => toggleColumn(column._id)}
                            className="flex items-center gap-3 flex-1 text-left group"
                          >
                            <div className="transition-transform duration-200">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-white" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white" />
                              )}
                            </div>
                            <div
                              className="w-4 h-4 rounded-full shadow-sm"
                              style={{ backgroundColor: column.color }}
                            />
                            <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                              {column.name}
                            </h3>
                            <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/20">
                              {column.taskCount ?? uniqueTasks.length}
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAddTask(column._id)}
                            className="h-9 px-3 hover:bg-[#1e1e2d] text-gray-400 hover:text-white transition-all duration-200"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Add Task</span>
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div>
                          {uniqueTasks.length > 0 && (
                            <>
                              <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3 bg-[#0e0e12] border-b border-[#e5e7eb29]">
                                <div className="col-span-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Task</div>
                                <div className="col-span-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">Status</div>
                                <div className="col-span-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">Priority</div>
                                <div className="col-span-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">Assigned To</div>
                                <div className="col-span-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">Due Date</div>
                                <div className="col-span-1 text-xs font-semibold text-gray-300 uppercase tracking-wider">Tags</div>
                              </div>

                              <div className="hidden md:grid lg:hidden grid-cols-8 gap-3 px-4 py-3 bg-[#0e0e12] border-b border-[#e5e7eb29]">
                                <div className="col-span-3 text-xs font-semibold text-gray-300 uppercase">Task</div>
                                <div className="col-span-2 text-xs font-semibold text-gray-300 uppercase">Status</div>
                                <div className="col-span-1 text-xs font-semibold text-gray-300 uppercase">Priority</div>
                                <div className="col-span-2 text-xs font-semibold text-gray-300 uppercase">Assigned</div>
                              </div>

                              <div className="md:hidden grid grid-cols-[minmax(140px,2fr)_minmax(90px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)_minmax(90px,1fr)] gap-3 px-4 py-2 bg-[#0e0e12] border-b border-[#e5e7eb29]">
                                <div className="text-xs font-semibold text-gray-300 uppercase">Task</div>
                                <div className="text-xs font-semibold text-gray-300 uppercase">Status</div>
                                <div className="text-xs font-semibold text-gray-300 uppercase">Priority</div>
                                <div className="text-xs font-semibold text-gray-300 uppercase">Assigned</div>
                                <div className="text-xs font-semibold text-gray-300 uppercase">Due Date</div>
                              </div>
                            </>
                          )}

                          {uniqueTasks.map((task) => (
                            <TaskRow
                              key={task._id}
                              task={task}
                              columnName={column.name}
                              columnColor={column.color}
                              employees={employees}
                              onClick={() => onTaskClick?.(task)}
                              onSubtaskToggle={() => toggleTaskSubtasks(task._id)}
                              expandedTaskId={expandedTaskId}
                              subtasks={subtasksMap[task._id]}
                              isLoadingSubtasks={isLoadingSubtasks && expandedTaskId === task._id}
                            />
                          ))}

                          {!stageExhausted[column._id] && uniqueTasks.length >= 30 && (
                            <div className="px-6 py-4 text-center bg-[#0e0e12]">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadMoreTasks(column._id)}
                                disabled={isLoading}
                                className="bg-transparent border-[#e5e7eb29] text-gray-400 hover:text-white hover:bg-[#1e1e2d] transition-all duration-200"
                              >
                                {isLoading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                                    Loading...
                                  </>
                                ) : (
                                  'Load More Tasks'
                                )}
                              </Button>
                            </div>
                          )}

                          {stageExhausted[column._id] && uniqueTasks.length > 0 && (
                            <div className="px-6 py-3 text-center bg-[#0e0e12]">
                              <p className="text-xs text-gray-400 font-medium">
                                ✓ All tasks loaded
                              </p>
                            </div>
                          )}

                          {uniqueTasks.length === 0 && (
                            <div className="px-6 py-12 text-center bg-[#0e0e12]">
                              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1e1e2d] mb-4 border border-[#e5e7eb29]">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              </div>
                              <p className="text-sm text-gray-400 font-medium">No tasks yet</p>
                              <p className="text-xs text-gray-500 mt-1">Click Add Task to create one</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}