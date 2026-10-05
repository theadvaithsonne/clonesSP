"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTodos } from "@/lib/hooks/useTodos";
import {
  CheckSquare,
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
  Clock,
} from "lucide-react";

interface TodoMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TodoMenu({ isOpen, onClose }: TodoMenuProps) {
  const { todos, loading, addTodo, updateTodo, deleteTodo, refetch } =
    useTodos();
  const [newTask, setNewTask] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "assigned">(
    "personal"
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Separate personal and assigned todos
  const personalTodos = todos.filter((todo) => todo.isPersonal);
  const assignedTodos = todos.filter((todo) => !todo.isPersonal);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }

    if (isOpen) {
      refetch();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleAddTodo = async () => {
    if (!newTask.trim()) return;

    setIsAdding(true);
    try {
      await addTodo(newTask.trim());
      setNewTask("");
    } catch (error) {
      console.error("Failed to add todo:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditTodo = async (id: string) => {
    if (!editingTask.trim()) return;

    try {
      await updateTodo(id, editingTask.trim());
      setEditingId(null);
      setEditingTask("");
    } catch (error) {
      console.error("Failed to update todo:", error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodo(id);
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  const startEdit = (todo: { _id: string; task: string }) => {
    setEditingId(todo._id);
    setEditingTask(todo.task);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTask("");
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            data-todo-modal
            className="bg-[#0e0e12]/95 backdrop-blur-xl border border-[#2a2a35] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[#2a2a35]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-violet-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Reminders
                  </h2>
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

              {/* Smaller Tabs */}
              <div className="flex gap-1 bg-[#1a1a20] rounded-md p-0.5">
                <Button
                  onClick={() => setActiveTab("personal")}
                  variant="ghost"
                  className={cn(
                    "flex-1 h-6 text-xs transition-all px-2",
                    activeTab === "personal"
                      ? "bg-violet-600 hover:bg-violet-900 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  Personal ({personalTodos.length})
                </Button>
                <Button
                  onClick={() => setActiveTab("assigned")}
                  variant="ghost"
                  className={cn(
                    "flex-1 h-6 text-xs transition-all px-2",
                    activeTab === "assigned"
                      ? "bg-violet-600 hover:bg-violet-900 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  Assigned ({assignedTodos.length})
                </Button>
              </div>
            </div>

            {/* Add Todo Input */}
            <div className="p-4 border-b border-[#2a2a35]">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleAddTodo)}
                  placeholder="Add a new todo..."
                  className="flex-1 bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-400 focus:border-violet-400"
                  disabled={isAdding}
                />
                <Button
                  onClick={handleAddTodo}
                  disabled={!newTask.trim() || isAdding}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
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
                    className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full"
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
              ) : (
                (() => {
                  const currentTodos =
                    activeTab === "personal" ? personalTodos : assignedTodos;
                  return currentTodos.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                      <p className="text-gray-400">
                        {activeTab === "personal"
                          ? "No personal todos yet"
                          : "No assigned todos yet"}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {activeTab === "personal"
                          ? "Add your first todo above"
                          : "Others can assign you todos using the Todos button"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {currentTodos.map((todo, index) => (
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
                            {editingId === todo._id ? (
                              <div className="flex gap-2">
                                <Input
                                  ref={editInputRef}
                                  value={editingTask}
                                  onChange={(e) =>
                                    setEditingTask(e.target.value)
                                  }
                                  onKeyPress={(e) =>
                                    handleKeyPress(e, () =>
                                      handleEditTodo(todo._id)
                                    )
                                  }
                                  className="flex-1 bg-[#0e0e12] border-[#2a2a35] text-white"
                                />
                                <Button
                                  onClick={() => handleEditTodo(todo._id)}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-500"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={cancelEdit}
                                  size="sm"
                                  variant="ghost"
                                  className="hover:bg-red-600/20"
                                >
                                  <X className="h-4 w-4 text-red-400" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm break-words">
                                    {todo.task}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-gray-500">
                                      {new Date(
                                        todo.createdAt
                                      ).toLocaleDateString()}
                                    </p>
                                    {!todo.isPersonal && (
                                      <p className="text-xs text-purple-400">
                                        by{" "}
                                        {todo.createdBy?.name ||
                                          todo.createdBy?.email}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {todo.isPersonal && (
                                    <Button
                                      onClick={() => startEdit(todo)}
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 hover:bg-violet-600/20"
                                    >
                                      <Edit2 className="h-3 w-3 text-violet-400" />
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => handleDeleteTodo(todo._id)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 hover:bg-red-600/20"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  );
                })()
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
