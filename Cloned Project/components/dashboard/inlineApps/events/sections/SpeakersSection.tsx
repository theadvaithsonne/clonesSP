"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic2,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  GOLD,
  Label,
  Modal,
  TextArea,
  TextInput,
  Toggle,
  useConfirm,
  useConsoleAction,
} from "../ui";
import { getOrgId } from "@/lib/auth";
import { getTeamMembers, type TeamMember } from "@/lib/feed-api";
import { uploadEventImage } from "../api";
import {
  createSpeaker,
  deleteSpeaker,
  listSessions,
  listSpeakers,
  updateSpeaker,
} from "../api";
import type { AgendaSession, EventSpeaker } from "../types";

interface Draft {
  name: string;
  role: string;
  company: string;
  bio: string;
  avatarUrl: string;
  twitter: string;
  linkedin: string;
  website: string;
  isKeynote: boolean;
}

const empty: Draft = {
  name: "",
  role: "",
  company: "",
  bio: "",
  avatarUrl: "",
  twitter: "",
  linkedin: "",
  website: "",
  isKeynote: false,
};

export default function SpeakersSection({ eventId }: { eventId: string }) {
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventSpeaker | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  // Picking an existing colleague beats retyping their details, so the form
  // opens on the roster and falls back to blank entry for outside speakers.
  const [source, setSource] = useState<"member" | "manual">("member");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function uploadAvatar(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await uploadEventImage(eventId, file, "speakers");
      setDraft((d) => ({ ...d, avatarUrl: res.url }));
    } catch (err: any) {
      toast.error(err?.message || "Could not upload that photo");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Sessions come along so each card can show the talks assigned to that
      // speaker without a second fetch per card.
      const [s, a] = await Promise.all([listSpeakers(eventId), listSessions(eventId)]);
      setSpeakers(s.speakers || []);
      setSessions(a.sessions || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load speakers");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setDraft(empty);
    setEditing(null);
    setSource("member");
    setMemberSearch("");
    setOpen(true);
    void loadMembers();
  }

  const loadMembers = useCallback(async () => {
    if (members.length || membersLoading) return;
    const orgId = getOrgId();
    if (!orgId) return;
    setMembersLoading(true);
    try {
      setMembers(await getTeamMembers(orgId));
    } catch {
      // Not fatal — manual entry still works, and that is the fallback the
      // picker offers anyway.
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [members.length, membersLoading]);

  /** Pull what the profile already knows, then let the organizer top it up. */
  function pickMember(m: TeamMember) {
    setDraft({
      ...empty,
      name: m.name || "",
      role: m.role || "",
      avatarUrl: m.profilePicture || "",
    });
    setSource("manual");
  }

  // "Add speaker" lives in the bottom bar, not on the page.
  useConsoleAction("speakers:add", openCreate);

  function openEdit(s: EventSpeaker) {
    setDraft({
      name: s.name,
      role: s.role || "",
      company: s.company || "",
      bio: s.bio || "",
      avatarUrl: s.avatarUrl || "",
      twitter: s.socials?.twitter || "",
      linkedin: s.socials?.linkedin || "",
      website: s.socials?.website || "",
      isKeynote: !!s.isKeynote,
    });
    setEditing(s);
    // Editing an existing speaker is always the detail form — the roster is
    // only a shortcut for filling in a new one.
    setSource("manual");
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      role: draft.role.trim() || undefined,
      company: draft.company.trim() || undefined,
      bio: draft.bio.trim() || undefined,
      avatarUrl: draft.avatarUrl.trim() || undefined,
      socials: {
        twitter: draft.twitter.trim() || undefined,
        linkedin: draft.linkedin.trim() || undefined,
        website: draft.website.trim() || undefined,
      },
      isKeynote: draft.isKeynote,
    };
    try {
      if (editing) await updateSpeaker(eventId, editing._id, payload);
      else await createSpeaker(eventId, payload);
      toast.success(editing ? "Speaker updated" : "Speaker added");
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not save the speaker");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: EventSpeaker) {
    const ok = await confirm({
      title: `Remove ${s.name}?`,
      message:
        "They come off the public page and any sessions they were listed on. You can add them again later.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await deleteSpeaker(eventId, s._id);
      toast.success("Speaker removed");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not remove the speaker");
    }
  }

  return (
    <div className="px-8 py-8">
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
        </div>
      ) : speakers.length === 0 ? (
        <EmptyState
          icon={<Mic2 className="h-10 w-10" strokeWidth={1.25} />}
          title="No speakers yet"
          description="Add your line-up — they appear on the public page automatically."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add speaker
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {speakers.map((s) => {
            const talks = sessions.filter((x) => x.speakerIds?.includes(s._id));
            return (
              <Card key={s._id} className="overflow-hidden">
                {/* Photo leads, at the full width of the card. A 56px thumbnail
                    next to three short lines left most of the card empty and
                    made the one thing you actually recognise a speaker by the
                    smallest element on it. */}
                <div className="relative aspect-[4/3] w-full bg-[#1A1A1A]">
                  {s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-[#33333f]">
                      {s.name.slice(0, 1)}
                    </div>
                  )}

                  {s.isKeynote && (
                    <span
                      className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#141418]"
                      style={{ background: GOLD }}
                    >
                      <Star className="h-2.5 w-2.5" fill="currentColor" />
                      Keynote
                    </span>
                  )}

                  {/* Name over the image rather than under it — one less block
                      of chrome, and it reads as a headshot caption. */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
                    <h3 className="truncate font-medium text-white">{s.name}</h3>
                    <p className="truncate text-xs text-[#c7c7da]">
                      {[s.role, s.company].filter(Boolean).join(" · ") || "Speaker"}
                    </p>
                  </div>
                </div>

                <div className="px-3.5 pt-3">
                  {s.bio && (
                    <p className="line-clamp-2 text-xs leading-5 text-[#9fa0b8]">
                      {s.bio}
                    </p>
                  )}

                  {talks.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {talks.slice(0, 2).map((t) => (
                        <span
                          key={t._id}
                          className="max-w-full truncate rounded-full border border-[#2a2a35] px-2 py-0.5 text-[11px] text-[#c7c7da]"
                        >
                          {t.title}
                        </span>
                      ))}
                      {talks.length > 2 && (
                        <span className="px-1 py-0.5 text-[11px] text-[#61627a]">
                          +{talks.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end gap-1 border-t border-[#1c1c24] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-[#9fa0b8] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    className="rounded-lg p-2 text-[#7c7d94] transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit speaker" : "Add speaker"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {(editing || source === "manual") && (
              <Button loading={saving} disabled={!draft.name.trim()} onClick={save}>
                {editing ? "Save changes" : "Add speaker"}
              </Button>
            )}
          </>
        }
      >
        {/* Two ways in: pick someone already in the org and pull their profile,
            or type an outside speaker in by hand. */}
        {!editing && source === "member" ? (
          <div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input
                autoFocus
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search your organization"
                className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-brand"
              />
            </div>

            {membersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
              </div>
            ) : (
              <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
                {members
                  .filter((m) =>
                    (m.name || m.email || "")
                      .toLowerCase()
                      .includes(memberSearch.trim().toLowerCase())
                  )
                  .map((m) => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => pickMember(m)}
                      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[#262626] hover:bg-[#1A1A1A]"
                    >
                      {m.profilePicture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.profilePicture}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#262626] text-[11px] font-bold text-zinc-400">
                          {(m.name || m.email || "?").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">
                          {m.name || m.email}
                        </span>
                        {m.role && (
                          <span className="block truncate text-xs text-zinc-500">
                            {m.role}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                {members.length === 0 && (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    No one else is in this organization yet.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSource("manual")}
              className="mt-3 w-full rounded-xl border border-dashed border-[#262626] py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:border-brand hover:text-brand"
            >
              + Enter an outside speaker manually
            </button>
          </div>
        ) : (
        <div className="space-y-4">
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setSource("member");
                void loadMembers();
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            >
              <Users className="h-3.5 w-3.5" />
              Pick from your organization instead
            </button>
          )}
          <TextInput
            label="Name"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Role"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              placeholder="CTO"
            />
            <TextInput
              label="Company"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </div>
          {/* Upload is the primary path — most organizers have the headshot
              as a file, not a hosted URL. The URL box stays for the case where
              they do. */}
          <div>
            <Label>Photo</Label>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-dashed border-[#262626] bg-[#1A1A1A] transition-colors hover:border-brand disabled:opacity-50"
              >
                {draft.avatarUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Replace
                    </span>
                  </>
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-500">
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="text-[10px]">Upload</span>
                  </span>
                )}
              </button>

              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={draft.avatarUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, avatarUrl: e.target.value })
                  }
                  placeholder="…or paste an image URL"
                  className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-brand"
                />
                {draft.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, avatarUrl: "" })}
                    className="text-[11px] text-zinc-500 transition-colors hover:text-[#f87171]"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void uploadAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <TextArea
            label="Bio"
            rows={3}
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-3">
            <TextInput
              label="X / Twitter"
              value={draft.twitter}
              onChange={(e) => setDraft({ ...draft, twitter: e.target.value })}
            />
            <TextInput
              label="LinkedIn"
              value={draft.linkedin}
              onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })}
            />
            <TextInput
              label="Website"
              value={draft.website}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
          </div>
          <div className="border-t border-[#1c1c24] pt-3">
            <Toggle
              checked={draft.isKeynote}
              onChange={(v) => setDraft({ ...draft, isKeynote: v })}
              label="Keynote speaker"
              description="Pinned to the top of the speaker grid."
            />
          </div>
        </div>
        )}
      </Modal>

      {confirmDialog}
    </div>
  );
}
