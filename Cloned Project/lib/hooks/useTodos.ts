import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface Todo {
  _id: string;
  task: string;
  orgId: string;
  userId: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setError("No organization selected");
        return;
      }

      const response = await api<{ todos: Todo[] }>(`/todos?orgId=${orgId}`);
      setTodos(response.todos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  }, []);

  const addTodo = useCallback(async (task: string, targetUserId?: string) => {
    try {
      setError(null);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setError("No organization selected");
        return;
      }

      const response = await api<{ todo: Todo }>(`/todos?orgId=${orgId}`, {
        method: "POST",
        body: JSON.stringify({ task, targetUserId }),
      });
      setTodos((prev) => [response.todo, ...prev]);
      return response.todo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add todo");
      throw err;
    }
  }, []);

  const addTodoForUser = useCallback(
    async (task: string, targetUserId: string) => {
      try {
        setError(null);
        const orgId = localStorage.getItem("garage_org_id");
        if (!orgId) {
          setError("No organization selected");
          return;
        }

        const response = await api<{ todo: Todo }>(`/todos?orgId=${orgId}`, {
          method: "POST",
          body: JSON.stringify({ task, targetUserId }),
        });
        return response.todo;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to add todo for user"
        );
        throw err;
      }
    },
    []
  );

  const updateTodo = useCallback(async (id: string, task: string) => {
    try {
      setError(null);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setError("No organization selected");
        return;
      }

      const response = await api<{ todo: Todo }>(
        `/todos/${id}?orgId=${orgId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ task }),
        }
      );
      setTodos((prev) =>
        prev.map((todo) => (todo._id === id ? response.todo : todo))
      );
      return response.todo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
      throw err;
    }
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    try {
      setError(null);
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        setError("No organization selected");
        return;
      }

      await api(`/todos/${id}?orgId=${orgId}`, {
        method: "DELETE",
      });
      setTodos((prev) => prev.filter((todo) => todo._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return {
    todos,
    loading,
    error,
    addTodo,
    addTodoForUser,
    updateTodo,
    deleteTodo,
    refetch: fetchTodos,
  };
}
