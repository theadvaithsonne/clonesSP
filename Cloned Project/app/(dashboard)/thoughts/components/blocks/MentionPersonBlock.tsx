"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { User, Search, Loader2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface OrgUser {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

function getOrgId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("garage_org_id") || "";
}

function MentionPersonRenderer({ block, editor }: { block: any; editor: any }) {
  const organizationId = getOrgId();
  const personName = block.props?.personName || "";
  const personId = block.props?.personId || "";
  const personAvatar = block.props?.personAvatar || "";

  const [showCombobox, setShowCombobox] = useState(!personId);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<OrgUser[]>([]);
  const [results, setResults] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load org team list when picker opens
  useEffect(() => {
    if (!showCombobox || !organizationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api<{ members: any[] }>(
          `/team/list?orgId=${organizationId}`,
          {},
          getToken() || undefined
        );
        if (cancelled) return;
        const mapped: OrgUser[] = (data.members || []).map((m: any) => ({
          _id: m._id || m.id || m.userId || "",
          name: m.name || m.fullName || m.displayName || "",
          email: m.email || "",
          profilePicture: m.profilePicture || m.avatar || m.photoURL || "",
        })).filter((u) => u._id);
        setMembers(mapped);
        setResults(mapped.slice(0, 20));
      } catch {
        if (!cancelled) {
          setMembers([]);
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [showCombobox, organizationId]);

  // Filter locally + optional remote search
  useEffect(() => {
    if (!showCombobox) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim().toLowerCase();
    if (!q) {
      setResults(members.slice(0, 20));
      return;
    }

    const local = members.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
    setResults(local.slice(0, 20));

    if (!organizationId || local.length > 0) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api<{ success: boolean; users: OrgUser[] }>(
          `/org/${organizationId}/users/search?q=${encodeURIComponent(query.trim())}&limit=10`
        );
        if (data.success) setResults(data.users || []);
      } catch {
        // keep local results
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, members, showCombobox, organizationId]);

  useEffect(() => {
    if (!showCombobox) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCombobox(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCombobox]);

  useEffect(() => {
    if (showCombobox) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showCombobox]);

  const selectPerson = useCallback(
    (user: OrgUser) => {
      editor.updateBlock(block, {
        props: {
          personName: user.name || user.email,
          personId: user._id,
          personEmail: user.email,
          personAvatar: user.profilePicture || "",
        },
      });
      setShowCombobox(false);
      setQuery("");
    },
    [editor, block]
  );

  const displayName = personName || "Someone";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-full">
      <div className="relative inline-flex" ref={containerRef}>
        <span
          onClick={() => setShowCombobox(!showCombobox)}
          className={`inline-flex items-center gap-1.5 border rounded-full px-2 py-0.5 cursor-pointer transition-colors ${
            personId
              ? "bg-blue-900/30 border-blue-800/40 hover:bg-blue-900/50"
              : "bg-zinc-800/70 border-zinc-700/50 hover:bg-zinc-750"
          }`}
        >
          {personAvatar ? (
            <img
              src={personAvatar}
              alt=""
              className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
              <span className="text-[6px] text-white font-bold">
                {personId ? initials : <User className="h-2 w-2 text-white" />}
              </span>
            </span>
          )}
          <span className="text-[11px] text-blue-200 font-medium">
            @{personId ? displayName : "mention someone"}
          </span>
        </span>

        {showCombobox && (
          <div className="absolute top-full left-0 mt-1 z-[99999] w-72 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden">
            <div className="px-2 pt-2 pb-1">
              <div className="flex items-center gap-1.5 bg-zinc-900 rounded px-2 py-1.5">
                <Search className="h-3 w-3 text-zinc-500" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people..."
                  className="flex-1 bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder-zinc-500"
                />
                {loading && <Loader2 className="h-3 w-3 text-zinc-500 animate-spin" />}
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto px-1 pb-1">
              {!organizationId && (
                <div className="text-[10px] text-zinc-500 px-2 py-2">
                  Organization not found — can't load teammates.
                </div>
              )}
              {organizationId && !loading && results.length === 0 && (
                <div className="text-[10px] text-zinc-500 px-2 py-2">
                  {query.trim() ? "No people found" : "No teammates available"}
                </div>
              )}
              {results.map((user) => {
                const userInitials = (user.name || user.email)
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => selectPerson(user)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-300 hover:text-blue-300 hover:bg-zinc-700/50 rounded transition-colors"
                  >
                    {user.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="h-5 w-5 rounded-full bg-purple-600/30 flex items-center justify-center shrink-0">
                        <span className="text-[8px] text-purple-300 font-semibold">
                          {userInitials || "?"}
                        </span>
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] text-zinc-200 truncate">
                        {user.name || "—"}
                      </span>
                      <span className="block text-[9px] text-zinc-500 truncate">
                        {user.email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const mentionPersonBlock = createReactBlockSpec(
  {
    type: "mentionPerson" as const,
    propSchema: {
      personName: { default: "", type: "string" },
      personId: { default: "", type: "string" },
      personEmail: { default: "", type: "string" },
      personAvatar: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <MentionPersonRenderer block={block} editor={editor} />;
    },
  }
);
