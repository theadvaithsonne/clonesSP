"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X, Camera, UserMinus } from "lucide-react";

type Member = {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
  role?: string;
};

type GroupData = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  createdBy: string;
  members: Array<{
    userId: string | { toString(): string };
    role?: string;
  }>;
};

export default function EditGroupDialog({
  groupId,
  onClose,
  onUpdated,
}: {
  groupId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const me = getUserIdFromToken()!;
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picture, setPicture] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [currentMembers, setCurrentMembers] = useState<Member[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isAdmin = useMemo(() => {
    if (!groupData) return false;
    const meMember = groupData.members.find(
      (m) =>
        (typeof m.userId === "string" ? m.userId : m.userId.toString()) === me
    );
    return groupData.createdBy === me || meMember?.role === "admin" || false;
  }, [groupData, me]);

  // Load group data
  useEffect(() => {
    if (!groupId) return;
    (async () => {
      try {
        const res = await api<GroupData>(`/groups/${groupId}`, {}, getToken()!);
        setGroupData(res);
        setName(res.name);
        setDescription(res.description || "");
        setPicture(res.picture || null);
        setPicturePreview(res.picture || null);

        // Load current members details
        const orgId = localStorage.getItem("garage_org_id");
        const teamRes = await api<{
          members: {
            id?: string;
            _id?: string;
            email: string;
            name?: string;
            profilePicture?: string;
          }[];
        }>("/team/list?orgId=" + orgId, {}, getToken()!);

        const memberMap: Record<string, Member> = {};
        (teamRes.members || []).forEach((m) => {
          const id = (m.id || (m as any)._id) as string;
          if (id) {
            memberMap[id] = {
              id,
              name: m.name,
              email: m.email,
              profilePicture: m.profilePicture,
            };
          }
        });

        // Map group members
        const members: Member[] = res.members.map((m) => {
          const userId =
            typeof m.userId === "string" ? m.userId : m.userId.toString();
          return {
            ...(memberMap[userId] || { id: userId, email: userId }),
            role: m.role,
          };
        });

        setCurrentMembers(members);

        // Set available members (not already in group, excluding me)
        const memberIds = new Set(members.map((m) => m.id));
        const available = Object.values(memberMap).filter(
          (m) => !memberIds.has(m.id) && m.id !== me
        );
        setAvailableMembers(available);
      } catch (error) {
        console.error("Failed to load group:", error);
      }
    })();
  }, [groupId, me]);

  // Handle picture file selection
  const handlePictureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setPictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload picture
  const uploadPicture = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const result = await response.json();
    return result.url;
  };

  const filteredAvailableMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return availableMembers;
    }
    return availableMembers.filter(
      (m) =>
        m.name?.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [availableMembers, searchQuery]);

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Upload picture if new file selected
      let pictureUrl = picture;
      if (pictureFile) {
        setUploading(true);
        try {
          pictureUrl = await uploadPicture(pictureFile);
        } catch (error) {
          console.error("Picture upload failed:", error);
          setUploading(false);
          setLoading(false);
          return;
        }
        setUploading(false);
      }

      // Update group name/picture/description
      if (
        isAdmin &&
        (name.trim() !== groupData?.name ||
          pictureUrl !== picture ||
          description.trim() !== (groupData?.description || ""))
      ) {
        await api(
          `/groups/${groupId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim() || null,
              picture: pictureUrl,
            }),
          },
          getToken()!
        );
      }

      // Add new members
      const memberIdsToAdd = Object.entries(selectedToAdd)
        .filter(([, v]) => v)
        .map(([k]) => k);

      if (memberIdsToAdd.length > 0) {
        await api(
          `/groups/${groupId}/members`,
          {
            method: "POST",
            body: JSON.stringify({ memberIds: memberIdsToAdd }),
          },
          getToken()!
        );
      }

      onClose();
      onUpdated?.();
      window.dispatchEvent(new CustomEvent("groups:reload"));
    } catch (error) {
      console.error("Failed to update group:", error);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the group?")) return;

    try {
      await api(
        `/groups/${groupId}/members/${memberId}`,
        { method: "DELETE" },
        getToken()!
      );
      setCurrentMembers((prev) => prev.filter((m) => m.id !== memberId));
      // Add back to available members if not the current user
      const removed = currentMembers.find((m) => m.id === memberId);
      if (removed && removed.id !== me) {
        setAvailableMembers((prev) => [...prev, removed]);
      }
      onUpdated?.();
      window.dispatchEvent(new CustomEvent("groups:reload"));
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  }

  const canRemoveMember = (memberId: string) => {
    if (!isAdmin) return memberId === me; // Can only remove self if not admin
    return memberId !== groupData?.createdBy; // Can't remove creator
  };

  return (
    <div className="flex flex-col h-full w-full md:w-[380px] bg-[#141418] border-l border-[#2E2E2E]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2E2E2E]">
        <div className="text-sm font-semibold text-white">Edit Group</div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#999] hover:text-white hover:bg-[#2E2E2E]"
          aria-label="Close edit group"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {/* Group Picture */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="w-24 h-24 border-2 border-[#2a2a35]">
                <AvatarImage src={picturePreview || undefined} />
                <AvatarFallback className="text-2xl text-brand-foreground font-semibold bg-gradient-to-br from-brand to-brand-2">
                  {name?.charAt(0) || "G"}
                </AvatarFallback>
              </Avatar>
              {isAdmin && (
                <label className="absolute bottom-0 right-0 p-2 bg-brand-2 rounded-full cursor-pointer hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] transition-colors">
                  <Camera className="h-4 w-4 text-brand-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {isAdmin && (
              <p className="text-xs text-[#9fa0b8] text-center">
                Click camera icon to change picture
              </p>
            )}
          </div>

          {/* Group Name */}
          <div>
            <label className="text-sm text-[#c7c7da] mb-1 block">
              Group Name
            </label>
            <Input
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="text-sm text-[#c7c7da] mb-1 block">
              Description {!isAdmin && "(Admin only)"}
            </label>
            <textarea
              placeholder="Group description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAdmin}
              maxLength={500}
              rows={3}
              className="w-full bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8] rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-2/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isAdmin && (
              <p className="text-xs text-[#9fa0b8] mt-1">
                {description.length}/500 characters
              </p>
            )}
          </div>

          {/* Current Members */}
          <div>
            <label className="text-sm text-[#c7c7da] mb-2 block">
              Members ({currentMembers.length})
            </label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-[#2a2a35] p-2 space-y-1">
              {currentMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#15151b] group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="w-8 h-8 border border-[#2f2f3b]">
                      <AvatarImage src={m.profilePicture} />
                      <AvatarFallback className="text-xs text-brand-foreground font-semibold bg-gradient-to-br from-brand to-brand-2">
                        {m.name?.charAt(0) || m.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {m.name || m.email}
                        {m.id === me && (
                          <span className="text-[#9fa0b8] ml-1">(You)</span>
                        )}
                        {m.role === "admin" && (
                          <span className="text-brand-2 ml-1 text-xs">
                            (Admin)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9fa0b8] truncate">
                        {m.email}
                      </div>
                    </div>
                  </div>
                  {canRemoveMember(m.id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveMember(m.id)}
                      className="h-7 w-7 p-0 text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Members Section */}
          {isAdmin && (
            <div>
              <label className="text-sm text-[#c7c7da] mb-2 block">
                Add Members
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                <Input
                  placeholder="Search members to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8] pl-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-[#2a2a35] p-2">
                {filteredAvailableMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#15151b]"
                  >
                    <Checkbox
                      checked={!!selectedToAdd[m.id]}
                      onCheckedChange={(v) =>
                        setSelectedToAdd((s) => ({ ...s, [m.id]: !!v }))
                      }
                    />
                    <Avatar className="w-8 h-8 border border-[#2f2f3b]">
                      <AvatarImage src={m.profilePicture} />
                      <AvatarFallback className="text-xs text-brand-foreground font-semibold bg-gradient-to-br from-brand to-brand-2">
                        {m.name?.charAt(0) || m.email?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {m.name || m.email}
                      </div>
                      <div className="text-[11px] text-[#9fa0b8] truncate">
                        {m.email}
                      </div>
                    </div>
                  </label>
                ))}
                {filteredAvailableMembers.length === 0 && (
                  <div className="text-xs text-[#9fa0b8] px-2 py-2">
                    {searchQuery
                      ? "No members found."
                      : "No available members to add."}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer — sticky action row */}
      <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2E2E2E] bg-[#141418]">
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-[#9fa0b8] hover:text-white"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            !name.trim() ||
            loading ||
            uploading ||
            (name.trim() === groupData?.name &&
              description.trim() === (groupData?.description || "") &&
              pictureFile === null &&
              Object.keys(selectedToAdd).length === 0)
          }
          className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] text-brand-foreground"
        >
          {uploading
            ? "Uploading..."
            : loading
            ? "Saving..."
            : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
