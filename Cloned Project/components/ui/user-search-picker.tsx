"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";

export interface PickedUser {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

interface UserSearchPickerProps {
  scope: "platform" | "org";
  orgId?: string;
  /** Bearer token to authorize the search request (admin or founder JWT). */
  authToken?: string;
  selected: PickedUser[];
  onChange: (users: PickedUser[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function UserSearchPicker({
  scope,
  orgId,
  authToken,
  selected,
  onChange,
  placeholder = "Search by name or email…",
  className,
  disabled,
}: UserSearchPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const path =
    scope === "org"
      ? `/org/${orgId}/users/search`
      : `/garage-admin/users/search`;

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}${path}?q=${encodeURIComponent(query.trim())}&limit=10`,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          }
        );
        const data = await res.json();
        if (data.success) {
          const selectedIds = new Set(selected.map((u) => u._id));
          setResults(
            (data.users || []).filter((u: PickedUser) => !selectedIds.has(u._id))
          );
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, path, authToken, selected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addUser = (u: PickedUser) => {
    onChange([...selected, u]);
    setQuery("");
    setResults([]);
  };

  const removeUser = (id: string) => {
    onChange(selected.filter((u) => u._id !== id));
  };

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u._id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-brand/10 text-brand text-xs"
            >
              {u.profilePicture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={u.profilePicture}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : (
                <span className="h-4 w-4 rounded-full bg-brand/20 flex items-center justify-center text-[8px]">
                  {(u.name || u.email)[0]?.toUpperCase()}
                </span>
              )}
              <span className="truncate max-w-[180px]">{u.name || u.email}</span>
              <button
                type="button"
                onClick={() => removeUser(u._id)}
                disabled={disabled}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b80]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-8 h-10 text-sm rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors"
        />
        {open && (query.trim() || loading) && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-[#0a0a0e] border border-[#2a2a35] rounded-lg shadow-xl max-h-64 overflow-y-auto z-50">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-[#6b6b80]" />
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs text-[#6b6b80] text-center">
                No matching users
              </div>
            ) : (
              results.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => addUser(u)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#1a1a22] transition-colors text-left"
                >
                  {u.profilePicture ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={u.profilePicture}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-brand/10 flex items-center justify-center text-[10px] text-brand shrink-0">
                      {(u.name || u.email)[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">
                      {u.name || "—"}
                    </span>
                    <span className="block text-xs text-[#6b6b80] truncate">
                      {u.email}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
