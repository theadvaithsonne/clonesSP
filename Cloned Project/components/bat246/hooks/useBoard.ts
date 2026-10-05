"use client";

import { useEffect, useState, useCallback } from "react";
import { BoardData } from "../types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const POLL_MS = 10_000;

export function useBoard(boardId: string | null) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("garage_tok") ?? ""
        : "";
      const res = await fetch(`${API}/bat246/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBoard(data.board);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    setLoading(true);
    fetchBoard();
    const id = setInterval(fetchBoard, POLL_MS);
    return () => clearInterval(id);
  }, [fetchBoard]);

  return { board, loading, error, refetch: fetchBoard };
}
