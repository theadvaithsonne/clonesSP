"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Globe,
  Link,
  ChevronDown,
  Check,
  Trash2,
  Loader2,
  Copy,
  Search,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import { useUser } from "@/context/UserContext";
import { getTeamMembers } from "@/lib/feed-api";
import { buildNoteMemberUrl, buildNotePublicUrl } from "@/lib/thoughts-events";

type ShareRole = "Full access" | "Can edit" | "Can comment" | "Can view";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface ShareUser {
  id: string;
  name: string;
  email: string;
  role: ShareRole;
  isOwner?: boolean;
}

interface NoteSharePopoverProps {
  noteId: string;
  noteTitle: string;
  trigger: React.ReactNode;
}

const ROLES: ShareRole[] = ["Full access", "Can edit", "Can comment", "Can view"];

export default function NoteSharePopover({
  noteId,
  noteTitle,
  trigger,
}: NoteSharePopoverProps) {
  const {
    organizationId,
    name: currentUserName,
    email: currentUserEmail,
    userId: currentUserId,
  } = useUser();
  const [activeTab, setActiveTab] = useState<"share" | "publish">("share");

  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedUsersToInvite, setSelectedUsersToInvite] = useState<OrgUser[]>([]);
  const [inviteRole, setInviteRole] = useState<ShareRole>("Can edit");
  const [sharedUsers, setSharedUsers] = useState<ShareUser[]>([]);

  const [isPublished, setIsPublished] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [allowEditing, setAllowEditing] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuplicate, setAllowDuplicate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  const ownerEntry: ShareUser = {
    id: currentUserId || "owner",
    name: currentUserName || "You",
    email: currentUserEmail || "",
    role: "Full access",
    isOwner: true,
  };

  const loadShareSettings = useCallback(async () => {
    if (!noteId || noteId.startsWith("local-")) return;
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`notes/${noteId}/share`),
        { method: "GET" }
      );
      if (!response.ok) return;
      const data = await response.json();
      setShareToken(data.shareToken || null);
      setIsPublished(Boolean(data.isShared));
      setAllowEditing(Boolean(data.allowEditing));
      setAllowComments(data.allowComments !== false);
      setAllowDuplicate(data.allowDuplicate !== false);

      const collaborators: ShareUser[] = (data.collaborators || []).map((c: any) => ({
        id: c.userId || c.id,
        name: c.name || c.email || "Member",
        email: c.email || "",
        role: c.role || "Can edit",
      }));
      setSharedUsers([ownerEntry, ...collaborators]);
    } catch (err) {
      console.error("Error loading share settings:", err);
      setSharedUsers([ownerEntry]);
    }
  }, [noteId, currentUserId, currentUserName, currentUserEmail]);

  useEffect(() => {
    void loadShareSettings();
  }, [loadShareSettings]);

  useEffect(() => {
    if (!organizationId) return;

    const fetchUsersList = async () => {
      setFetchingUsers(true);
      try {
        let usersList: any[] = [];
        try {
          usersList = await getTeamMembers(organizationId);
        } catch (teamErr) {
          console.warn("team/list failed, falling back to CRM organization-users:", teamErr);
        }

        if (!Array.isArray(usersList) || usersList.length === 0) {
          const response = await authenticatedFetch(
            buildExternalUrl(`/crm/organization-users?organizationId=${organizationId}&limit=1000`),
            { method: "GET" }
          );
          const result = await response.json();
          usersList =
            result?.users ||
            result?.members ||
            result?.data?.users ||
            result?.data?.members ||
            result?.data ||
            result ||
            [];
        }

        if (Array.isArray(usersList)) {
          setOrgUsers(
            usersList.map((user: any) => {
              const id = user._id || user.id || user.userId || "";
              const name =
                (typeof user.name === "string" && user.name.trim()) ||
                [user.firstName, user.lastName]
                  .filter((p) => typeof p === "string" && p.trim())
                  .join(" ")
                  .trim() ||
                (typeof user.username === "string" && user.username.trim()) ||
                (typeof user.email === "string" && user.email.trim()) ||
                "";
              return {
                id,
                name,
                email: user.email || "",
                profilePicture: user.profilePicture || "",
              };
            })
          );
        }
      } catch (err) {
        console.error("Failed to load organization users:", err);
      } finally {
        setFetchingUsers(false);
      }
    };

    void fetchUsersList();
  }, [organizationId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsersToInvite.length === 0 || noteId.startsWith("local-")) return;

    setInviting(true);
    const noteUrl = buildNoteMemberUrl(noteId);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`notes/${noteId}/share/invite`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invites: selectedUsersToInvite.map((u) => ({
              userId: u.id,
              id: u.id,
              name: u.name,
              email: u.email,
              role: inviteRole,
            })),
            noteUrl,
            inviterName: currentUserName || currentUserEmail || "A team member",
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to invite collaborators");
      }

      const data = await response.json();
      const collaborators: ShareUser[] = (data.collaborators || []).map((c: any) => ({
        id: c.userId || c.id,
        name: c.name || c.email,
        email: c.email || "",
        role: c.role || inviteRole,
      }));
      setSharedUsers([ownerEntry, ...collaborators]);
      setSelectedUsersToInvite([]);
      setSearchQuery("");

      const invited = data.invited ?? selectedUsersToInvite.length;
      const emailsSent = data.emailsSent ?? 0;
      if (emailsSent > 0) {
        toast.success(`Invited ${invited} member(s) — ${emailsSent} email(s) sent`);
      } else {
        toast.success(`Invited ${invited} member(s)`);
      }
    } catch (err: any) {
      console.error("Failed to invite:", err);
      toast.error(err.message || "Failed to send invitations");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (
    id: string,
    role: ShareRole | "Remove"
  ) => {
    if (noteId.startsWith("local-")) return;

    try {
      const response = await authenticatedFetch(
        buildExternalUrl(
          role === "Remove"
            ? `notes/${noteId}/share/collaborators/${id}`
            : `notes/${noteId}/share/collaborators/${id}`
        ),
        {
          method: role === "Remove" ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: role === "Remove" ? undefined : JSON.stringify({ role }),
        }
      );
      if (!response.ok) throw new Error("Failed to update access");

      if (role === "Remove") {
        setSharedUsers((prev) => prev.filter((u) => u.id !== id));
        toast.success("User removed from access list");
      } else {
        setSharedUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role } : u))
        );
        toast.success(`Role updated to ${role}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update access");
    }
  };

  const handlePublishToggle = async (checked: boolean) => {
    if (noteId.startsWith("local-")) {
      toast.error("Please save the note online before publishing");
      return;
    }
    setLoading(true);
    try {
      if (checked) {
        const response = await authenticatedFetch(
          buildExternalUrl(`notes/${noteId}/share`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              allowEditing,
              allowComments,
              allowDuplicate,
            }),
          }
        );
        if (!response.ok) throw new Error("Failed to publish");
        const data = await response.json();
        setShareToken(data.shareToken || null);
        setIsPublished(true);
        toast.success("Note published to the web");
      } else {
        const response = await authenticatedFetch(
          buildExternalUrl(`notes/${noteId}/share`),
          { method: "DELETE" }
        );
        if (!response.ok) throw new Error("Failed to unpublish");
        setIsPublished(false);
        toast.success("Note unpublished from the web");
      }
    } catch (err) {
      console.error("Error publishing note:", err);
      toast.error("An error occurred during publishing");
    } finally {
      setLoading(false);
    }
  };

  const persistPublishSettings = async (patch: {
    allowEditing?: boolean;
    allowComments?: boolean;
    allowDuplicate?: boolean;
  }) => {
    if (!isPublished || noteId.startsWith("local-")) return;
    try {
      await authenticatedFetch(buildExternalUrl(`notes/${noteId}/share`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      console.error("Failed to save link settings:", err);
    }
  };

  const getPublicUrl = () => (shareToken ? buildNotePublicUrl(shareToken) : "");

  const handleCopyLink = async () => {
    const url = buildNoteMemberUrl(noteId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const filteredSuggestions = orgUsers.filter((user) => {
    const alreadyInvited = sharedUsers.some((u) => u.id === user.id);
    const alreadySelected = selectedUsersToInvite.some((u) => u.id === user.id);
    if (alreadyInvited || alreadySelected || user.id === currentUserId) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[480px] bg-[#1a1a1a] border border-zinc-800/85 rounded-xl p-0 shadow-2xl text-zinc-300 overflow-hidden z-[99999]"
      >
        <div className="flex border-b border-zinc-800/60 px-4 pt-2 bg-[#161616]">
          <button
            onClick={() => setActiveTab("share")}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === "share"
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Share
          </button>
          <button
            onClick={() => setActiveTab("publish")}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === "publish"
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Publish
          </button>
        </div>

        <div className="p-4 min-h-[280px] max-h-[400px] overflow-y-auto">
          {activeTab === "share" ? (
            <div className="space-y-4">
              <form onSubmit={handleInvite} className="space-y-3">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  Search Workspace Members
                </label>

                <div className="flex gap-2 items-end">
                  <div className="flex-1 min-w-0 relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                      <Input
                        placeholder="Search by name or email in organization…"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        className="w-full pl-8 h-10 bg-[#222222] border-zinc-800 text-sm text-white placeholder-zinc-500 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                      />
                      {fetchingUsers && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-zinc-500" />
                      )}
                    </div>

                    {showDropdown && (searchQuery.trim() !== "" || filteredSuggestions.length > 0) && (
                      <div className="absolute top-full mt-1 left-0 right-0 bg-[#161616] border border-zinc-800 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 py-1">
                        {filteredSuggestions.length === 0 ? (
                          <div className="p-3 text-xs text-zinc-500 text-center">
                            No matching organization users
                          </div>
                        ) : (
                          filteredSuggestions.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUsersToInvite((prev) => [...prev, u]);
                                setSearchQuery("");
                                setShowDropdown(false);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                            >
                              {u.profilePicture ? (
                                <img
                                  src={u.profilePicture}
                                  alt=""
                                  className="h-7 w-7 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <span className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-[10px] text-zinc-300 font-medium shrink-0">
                                  {u.name[0]?.toUpperCase()}
                                </span>
                              )}
                              <span className="flex-1 min-w-0">
                                <span className="block text-xs font-semibold text-white truncate">
                                  {u.name}
                                </span>
                                <span className="block text-[10px] text-zinc-500 truncate font-mono">
                                  {u.email}
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-[#222222] border-zinc-800 hover:bg-zinc-800 text-xs px-2.5 h-10 font-normal text-zinc-300"
                      >
                        {inviteRole} <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1f1f1f] border-zinc-800 text-white text-xs min-w-[120px] z-[999999]">
                      {ROLES.map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={() => setInviteRole(r)}
                          className="hover:bg-white/5 cursor-pointer flex items-center justify-between"
                        >
                          <span>{r}</span>
                          {inviteRole === r && <Check className="h-3 w-3 text-blue-500" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    type="submit"
                    disabled={selectedUsersToInvite.length === 0 || inviting}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 h-10 rounded-lg transition-colors shadow-lg shadow-blue-600/10 shrink-0"
                  >
                    {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Invite"}
                  </Button>
                </div>

                {selectedUsersToInvite.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedUsersToInvite.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-300 text-[10px] font-medium"
                      >
                        <span>{u.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUsersToInvite((prev) =>
                              prev.filter((user) => user.id !== u.id)
                            )
                          }
                          className="text-zinc-500 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </form>

              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                  People with access
                </span>
                {sharedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-sm font-medium text-white select-none">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white truncate">
                          {user.name}{" "}
                          {user.isOwner && (
                            <span className="text-zinc-500 font-normal ml-0.5">(You)</span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate">{user.email}</span>
                      </div>
                    </div>

                    {user.isOwner ? (
                      <span className="text-[11px] font-medium text-zinc-500 pr-2">Full access</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 hover:bg-white/5 text-zinc-400 hover:text-white text-[11px] font-medium px-2"
                          >
                            {user.role} <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#1f1f1f] border-zinc-800 text-white text-xs min-w-[120px] z-[999999]">
                          {ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => void handleUpdateRole(user.id, r)}
                              className="hover:bg-white/5 cursor-pointer flex items-center justify-between"
                            >
                              <span>{r}</span>
                              {user.role === r && <Check className="h-3 w-3 text-blue-500" />}
                            </DropdownMenuItem>
                          ))}
                          <div className="h-px bg-zinc-800 my-1" />
                          <DropdownMenuItem
                            onClick={() => void handleUpdateRole(user.id, "Remove")}
                            className="hover:bg-red-500/10 text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer flex items-center gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove access</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#1f1f1f] p-3 rounded-lg border border-zinc-800/40">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">Publish to Web</span>
                    <span className="text-[10px] text-zinc-500">Make this page public to anyone</span>
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                ) : (
                  <Switch
                    checked={isPublished}
                    onCheckedChange={(checked) => void handlePublishToggle(checked)}
                    className="data-[state=checked]:bg-blue-600"
                  />
                )}
              </div>

              {!isPublished ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-xs text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                    Publish this page to the web so anyone can view it. You can control edit,
                    comment, and template replication access.
                  </p>
                  <Button
                    onClick={() => void handlePublishToggle(true)}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-5 h-8.5 rounded-lg transition-colors"
                  >
                    Publish Page
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 animate-fadeIn">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                      Public Link
                    </span>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={getPublicUrl()}
                        className="bg-[#222222] border-zinc-800 text-[11px] font-mono text-zinc-300 rounded-lg select-all flex-1 h-8.5"
                      />
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(getPublicUrl());
                            toast.success("Public link copied to clipboard");
                          } catch {
                            toast.error("Failed to copy link");
                          }
                        }}
                        size="icon"
                        className="bg-[#222222] hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 h-8.5 w-8.5 shrink-0 rounded-lg"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                      Link settings
                    </span>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">Allow editing</span>
                        <span className="text-[10px] text-zinc-500">Anyone with the link can edit</span>
                      </div>
                      <Switch
                        checked={allowEditing}
                        onCheckedChange={(checked) => {
                          setAllowEditing(checked);
                          void persistPublishSettings({ allowEditing: checked });
                        }}
                        className="data-[state=checked]:bg-blue-600 scale-90"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">Allow comments</span>
                        <span className="text-[10px] text-zinc-500">Anyone with the link can comment</span>
                      </div>
                      <Switch
                        checked={allowComments}
                        onCheckedChange={(checked) => {
                          setAllowComments(checked);
                          void persistPublishSettings({ allowComments: checked });
                        }}
                        className="data-[state=checked]:bg-blue-600 scale-90"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">Allow duplicate as template</span>
                        <span className="text-[10px] text-zinc-500">Anyone can duplicate this as a template</span>
                      </div>
                      <Switch
                        checked={allowDuplicate}
                        onCheckedChange={(checked) => {
                          setAllowDuplicate(checked);
                          void persistPublishSettings({ allowDuplicate: checked });
                        }}
                        className="data-[state=checked]:bg-blue-600 scale-90"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/60 flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => void handlePublishToggle(false)}
                      disabled={loading}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs px-3 h-8 rounded-lg"
                    >
                      Unpublish
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-4 py-3 bg-[#131313] border-t border-zinc-800/80">
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="h-8 bg-[#1f1f1f] border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-300 text-xs gap-1.5 rounded-lg px-3 font-normal"
          >
            <Link className="h-3.5 w-3.5" />
            <span>Copy link</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
