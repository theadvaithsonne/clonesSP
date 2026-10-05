import { useState, useCallback } from "react";
import { connectSocket } from "@/lib/socket";
import { TodoNotification } from "../types";

export function useTodoNotifications() {
  const [todoNotification, setTodoNotification] =
    useState<TodoNotification | null>(null);

  const handleTodoNotification = useCallback(
    (notification: TodoNotification) => {
      setTodoNotification(notification);
    },
    []
  );

  const dismissTodoNotification = useCallback(() => {
    setTodoNotification(null);
  }, []);

  return {
    todoNotification,
    handleTodoNotification,
    dismissTodoNotification,
    setTodoNotification,
  };
}
