"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { encodeContact } from "@/lib/chat-markers";
import { cn } from "@/lib/utils";

export interface ContactCandidate {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
  role?: string;
}

interface ContactShareButtonProps {
  members: ContactCandidate[];
  excludeIds?: string[];
  onShare: (encoded: string) => void;
  className?: string;
}

export function ContactShareButton({
  members,
  excludeIds = [],
  onShare,
  className,
}: ContactShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const skip = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m && m.id && !skip.has(m.id))
      .filter((m) => {
        if (!q) return true;
        return (
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [members, excludeIds, query]);

  const pick = (m: ContactCandidate) => {
    const encoded = encodeContact({
      id: m.id,
      name: m.name || m.email,
      email: m.email,
      avatar: m.profilePicture,
      role: m.role,
    });
    onShare(encoded);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md",
          className
        )}
        title="Share a contact"
      >
        <UserPlus className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#15151b] border border-[#2E2E2E] rounded-lg w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2E2E2E]">
              <div className="flex items-center gap-2 text-white text-xs font-medium">
                <UserPlus className="h-3.5 w-3.5 text-blue-400" />
                Share a contact
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded text-[#9fa0b8] hover:text-white hover:bg-[#2E2E2E]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-[#2E2E2E]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0e0e12] border border-[#2E2E2E]">
                <Search className="h-3 w-3 text-[#6E6E6E]" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search members…"
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-[#6E6E6E] outline-none"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-[#6E6E6E]">
                  No members found
                </div>
              ) : (
                filtered.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => pick(m)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1F1F1F] text-left"
                  >
                    <Avatar className="h-7 w-7 border border-[#2E2E2E]">
                      <AvatarImage src={m.profilePicture || ""} />
                      <AvatarFallback className="text-[10px] text-white bg-[#2E2E2E]">
                        {m.name?.charAt(0) || m.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">
                        {m.name || m.email}
                      </div>
                      {m.name && (
                        <div className="text-[10px] text-[#6E6E6E] truncate">
                          {m.email}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
