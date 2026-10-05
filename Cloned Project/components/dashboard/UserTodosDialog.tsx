"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { CheckSquare, Plus, X, User, Trash2 } from "lucide-react";

interface UserTodosDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    email: string;
  };
}

interface Todo {
  _id: string;
  task: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export function UserTodosDialog({
  isOpen,
  onClose,
  targetUser,
}: UserTodosDialogProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchTodos = async () => {
    // Guard against missing targetUser
    if (!targetUser?.id) return;
    try {
      setLoading(true);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        console.error("No organization selected");
        return;
      }

      const response = await api<{ todos: Todo[] }>(
        `/todos/user/${targetUser.id}?orgId=${orgId}`
      );
      setTodos(response.todos);
    } catch (error) {
      console.error("Failed to fetch todos:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async () => {
    if (!newTask.trim() || !targetUser?.id) return;

    setIsAdding(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        console.error("No organization selected");
        return;
      }

      const response = await api<{ todo: Todo }>(`/todos?orgId=${orgId}`, {
        method: "POST",
        body: JSON.stringify({
          task: newTask.trim(),
          targetUserId: targetUser.id,
        }),
      });
      setTodos((prev) => [response.todo, ...prev]);
      setNewTask("");
    } catch (error) {
      console.error("Failed to add todo:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        console.error("No organization selected");
        return;
      }

      await api(`/todos/${todoId}?orgId=${orgId}`, {
        method: "DELETE",
      });
      setTodos((prev) => prev.filter((todo) => todo._id !== todoId));
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  useEffect(() => {
    if (isOpen && targetUser?.id) {
      fetchTodos();
    }
  }, [isOpen, targetUser?.id]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTodo();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && targetUser && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2a2a35]">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-purple-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Todos for {targetUser.name || targetUser.email}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {todos.length} assigned todo{todos.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Button
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-white/10"
              >
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            </div>

            {/* Add Todo Input */}
            <div className="p-4 border-b border-[#2a2a35]">
              <div className="flex gap-2">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a todo for this user..."
                  className="flex-1 bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-400 focus:border-purple-400"
                  disabled={isAdding}
                />
                <Button
                  onClick={addTodo}
                  disabled={!newTask.trim() || isAdding}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
                >
                  <motion.div
                    animate={{ rotate: isAdding ? 360 : 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Plus className="h-4 w-4" />
                  </motion.div>
                </Button>
              </div>
            </div>

            {/* Todos List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <motion.div
                    className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <span className="ml-2 text-sm text-gray-400">
                    Loading todos...
                  </span>
                </div>
              ) : todos.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No todos assigned yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Add your first todo above
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {todos.map((todo, index) => (
                      <motion.div
                        key={todo._id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.05,
                          layout: { duration: 0.2 },
                        }}
                        className="group bg-[#1a1a20]/50 border border-[#2a2a35] rounded-lg p-3 hover:bg-[#1a1a20]/70 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm break-words">
                              {todo.task}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-500">
                                {new Date(todo.createdAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-purple-400">
                                by {todo.createdBy.name || todo.createdBy.email}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => deleteTodo(todo._id)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
