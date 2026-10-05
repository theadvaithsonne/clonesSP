// lib/hooks/useIsAdmin.ts
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";

type Member = {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: "founder" | "stakeholder";
  fullAccess?: boolean;
};

type UseIsAdminResult = {
  me?: Member;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useIsAdmin(): UseIsAdminResult {
  const meId = getUserIdFromToken() || "";
  const [members, setMembers] = useState<Member[] | null>(null);
  const loading = members === null;

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ members: Member[] }>(
        "/team/list",
        {},
        getToken()!
      );
      setMembers(res.members || []);
    } catch {
      setMembers([]); // avoid spinner forever on error
    }
  }, []);

  useEffect(() => {
    refresh();
    const onReload = () => refresh();
    window.addEventListener("team:reload", onReload as any);
    return () => window.removeEventListener("team:reload", onReload as any);
  }, [refresh]);

  const me = useMemo(() => {
    if (!meId || !members) return undefined;
    return members.find((m) => (m._id ?? m.id) === meId);
  }, [members, meId]);

  // console.log("zzzzzzzzzzzzzzz", me?.role === "founder");

  return { me, isAdmin: me?.role === "founder" || me?.fullAccess === true, loading, refresh };
}
