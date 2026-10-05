"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
// ActivityTracker disabled with Team Activity retirement (task_created
// rows it wrote were only read by the panel we hid).
// import { ActivityTracker } from "@/lib/activity-tracker";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, User, Calendar, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// --- TYPES ---
type Member = { id: string; name?: string; email: string };
type Task = {
  _id: string;
  title: string;
  status: "todo" | "inprogress" | "done";
  assignedTo?: { _id: string; name?: string; email: string };
  dueDate?: string;
};

// --- HELPER COMPONENTS ---

// Dialog for Creating/Editing a Task
function TaskDialog({
  members,
  onSave,
  trigger,
  taskToEdit,
}: {
  members: Member[];
  onSave: (taskData: Partial<Task> & { title: string }) => void;
  trigger: React.ReactNode;
  taskToEdit?: Task | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(taskToEdit?.title || "");
      // FIX 2: Default to "unassigned" if there's no assignee.
      setAssignedTo(taskToEdit?.assignedTo?._id || "unassigned");
      setDueDate(taskToEdit?.dueDate ? new Date(taskToEdit.dueDate).toISOString().substring(0, 10) : "");
    }
  }, [open, taskToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      _id: taskToEdit?._id,
      title: title.trim(),
      // FIX 3: Convert "unassigned" back to null for the API.
      assignedTo: assignedTo === "unassigned" ? null : assignedTo,
      dueDate: dueDate || null,
    } as any);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>{taskToEdit ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Task title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent border border-[#2a2a35] text-white"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="bg-transparent border border-[#2a2a35] text-white">
                <SelectValue placeholder="Assign to..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                {/* FIX 1: Use "unassigned" instead of an empty string for the value. */}
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent border border-[#2a2a35] text-white"
            />
          </div>
          <Button type="submit" className="w-full bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground">
            {taskToEdit ? "Save Changes" : "Create Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Card representing a single task
function TaskCard({ task, members, onUpdate, onDelete }: { task: Task; members: Member[]; onUpdate: (task: Task) => void; onDelete: (taskId: string) => void; }) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleUpdateStatus = async (status: Task['status']) => {
    try {
        const res = await api<{task: Task}>(`/tasks/${task._id}`, { method: 'PATCH', body: JSON.stringify({ status })}, getToken()!);
        onUpdate(res.task);
    } catch {
        toast.error("Failed to update status");
    }
  };

  const initials = (task.assignedTo?.name || task.assignedTo?.email || "?").slice(0, 2).toUpperCase();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && new Date(dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);

  return (
    <div className="bg-[#14141a] border border-[#2c2c3a] rounded-lg p-3 space-y-3">
        <div className="flex justify-between items-start">
            <p className="text-sm text-white font-medium">{task.title}</p>
             <TaskDialog
                taskToEdit={editingTask}
                members={members}
                onSave={async (data) => {
                    try {
                        const res = await api<{ task: Task }>(`/tasks/${task._id}`, { method: 'PATCH', body: JSON.stringify(data) }, getToken()!);
                        onUpdate(res.task);
                        setEditingTask(null);
                        toast.success("Task updated!");
                    } catch {
                        toast.error("Failed to update task.");
                    }
                }}
                trigger={
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                            <DropdownMenuItem onClick={() => setEditingTask(task)} className="hover:bg-white/10 cursor-pointer"><Edit2 className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(task._id)} className="text-red-400 hover:bg-red-500/10 cursor-pointer focus:text-red-400 focus:bg-red-500/10"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus('todo')} disabled={task.status === 'todo'} className="cursor-pointer">Move to To-Do</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus('inprogress')} disabled={task.status === 'inprogress'} className="cursor-pointer">Move to In Progress</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus('done')} disabled={task.status === 'done'} className="cursor-pointer">Move to Done</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
            <div className="flex items-center gap-2">
                {task.assignedTo ? (
                    <Avatar className="h-6 w-6 border-2 border-gray-600">
                        <AvatarFallback className="text-xs bg-[#2a1752] text-[#e6d7ff]">{initials}</AvatarFallback>
                    </Avatar>
                ) : <User className="h-5 w-5 p-0.5 rounded-full bg-gray-700"/>}
                <span>{task.assignedTo?.name || "Unassigned"}</span>
            </div>
            {dueDate && (
                <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
                    <Calendar className="h-4 w-4"/>
                    <span>{dueDate.toLocaleDateString()}</span>
                </div>
            )}
        </div>
    </div>
  );
}


// --- MAIN PAGE COMPONENT ---

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, membersRes] = await Promise.all([
        api<{ tasks: Task[] }>("/tasks", {}, getToken()!),
        api<{ members: any[] }>("/team/list", {}, getToken()!),
      ]);
      setTasks(tasksRes.tasks || []);
      setMembers(membersRes.members.map(m => ({...m, id: m._id})) || []);
    } catch (err) {
      console.error("Failed to load tasks or members:", err);
      toast.error("Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreate = async (data: any) => {
    try {
      const response = await api<{ task: Task }>("/tasks", { method: 'POST', body: JSON.stringify(data) }, getToken()!);
      fetchAll();
      toast.success("Task created!");
      
      // Task-creation tracking disabled with Team Activity retirement.
      // const currentUser = getToken() ? JSON.parse(atob(getToken()!.split('.')[1])) : null;
      // if (currentUser?.userId) {
      //   ActivityTracker.taskCreated(response.task._id, response.task.title, currentUser.userId, currentUser.name);
      // }
    } catch {
      toast.error("Failed to create task.");
    }
  };
  
  const handleUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
  };

  const handleDelete = async (taskId: string) => {
      if (!confirm("Are you sure you want to delete this task?")) return;
      try {
        await api(`/tasks/${taskId}`, { method: 'DELETE' }, getToken()!);
        setTasks(prev => prev.filter(t => t._id !== taskId));
        toast.success("Task deleted.");
      } catch {
        toast.error("Failed to delete task.");
      }
  };

  const columns = useMemo(() => ({
    todo: tasks.filter((t) => t.status === "todo"),
    inprogress: tasks.filter((t) => t.status === "inprogress"),
    done: tasks.filter((t) => t.status === "done"),
  }), [tasks]);

  const Column = ({ title, tasks }: { title: string; tasks: Task[] }) => (
    <div className="flex-1 bg-[#111116] p-3 rounded-lg">
        <h3 className="text-sm font-semibold text-white mb-3 px-1">{title} ({tasks.length})</h3>
        <div className="space-y-2">
            {tasks.map(task => <TaskCard key={task._id} task={task} members={members} onUpdate={handleUpdate} onDelete={handleDelete}/>)}
            {loading && <p className="text-xs text-gray-400">Loading...</p>}
        </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-[#a5a6bf] mt-1">
            Manage and assign tasks for your team.
          </p>
        </div>
        <TaskDialog
            members={members}
            onSave={handleCreate}
            trigger={
                <Button className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground">
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Task
                </Button>
            }
        />
      </div>
      <div className="flex gap-4">
            <Column title="To-Do" tasks={columns.todo} />
            <Column title="In Progress" tasks={columns.inprogress} />
            <Column title="Done" tasks={columns.done} />
      </div>
    </div>
  );
}