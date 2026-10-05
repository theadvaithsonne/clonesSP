// lib/sidebar-collapse-context.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";

type Ctx = {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggle: () => void;
};

const SidebarCollapseCtx = createContext<Ctx | null>(null);

function useLocalStorageBoolean(key: string, fallback: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

export function SidebarCollapseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useLocalStorageBoolean(
    "dashboard.sidebar.collapsed",
    false
  );
  const toggle = useCallback(() => setCollapsed((v) => !v), [setCollapsed]);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, toggle }),
    [collapsed, setCollapsed, toggle]
  );
  return (
    <SidebarCollapseCtx.Provider value={value}>
      {children}
    </SidebarCollapseCtx.Provider>
  );
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseCtx);
  if (!ctx)
    throw new Error(
      "useSidebarCollapse must be used within <SidebarCollapseProvider>"
    );
  return ctx;
}
