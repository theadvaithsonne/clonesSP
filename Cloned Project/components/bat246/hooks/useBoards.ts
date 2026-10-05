"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { BoardSummary } from "../types";

const API      = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const POLL_MS  = 15_000;
const CACHE_NS = "bat246_boards";

function readCache(key: string): { boards: BoardSummary[]; completed: BoardSummary[] } | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(key: string, data: { boards: BoardSummary[]; completed: BoardSummary[] }) {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export function useBoards(mine = false) {
  const cacheKey = `${CACHE_NS}${mine ? "_mine" : ""}`;

  const seed = useMemo(() => readCache(cacheKey), [cacheKey]);

  const [boards,    setBoards]    = useState<BoardSummary[]>(seed?.boards    ?? []);
  const [completed, setCompleted] = useState<BoardSummary[]>(seed?.completed ?? []);
  const [loading,   setLoading]   = useState(!seed);   // skip spinner when cache hit
  const [error,     setError]     = useState<string | null>(null);

  const fetchBoards = useCallback(async () => {
    try {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("garage_tok") ?? ""
        : "";
      const params = mine ? "?mine=true" : "";
      const res = await fetch(`${API}/bat246/boards${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const next = { boards: data.boards ?? [], completed: data.completed ?? [] };
      setBoards(next.boards);
      setCompleted(next.completed);
      writeCache(cacheKey, next);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mine, cacheKey]);

  useEffect(() => {
    fetchBoards();
    const id = setInterval(fetchBoards, POLL_MS);
    return () => clearInterval(id);
  }, [fetchBoards]);

  return { boards, completed, loading, error, refetch: fetchBoards };
}
