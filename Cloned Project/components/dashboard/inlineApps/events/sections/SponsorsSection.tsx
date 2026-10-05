"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  Label,
  Modal,
  TextInput,
  useConfirm,
  useConsoleAction,
} from "../ui";
import {
  createSponsor,
  deleteSponsor,
  listSponsors,
  updateSponsor,
  uploadEventImage,
} from "../api";
import type { EventSponsor, SponsorTier } from "../types";

/**
 * Sponsors are one flat list.
 *
 * The platinum / gold / silver / community banding is gone from every surface:
 * it forced the organizer to rank their partners before they could add one,
 * and it drove three different logo sizes on the public page. `tier` is still
 * on the record and still sent on create so existing data keeps its value —
 * nothing reads it any more.
 */
const LEGACY_TIER: SponsorTier = "gold";

interface Draft {
  name: string;
  logoUrl: string;
  boothNumber: string;
  websiteUrl: string;
}

const empty: Draft = {
  name: "",
  logoUrl: "",
  boothNumber: "",
  websiteUrl: "",
};

export default function SponsorsSection({ eventId }: { eventId: string }) {
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventSponsor | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function uploadLogo(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    setUploadingLogo(true);
    try {
      const res = await uploadEventImage(eventId, file, "sponsors");
      setDraft((d) => ({ ...d, logoUrl: res.url }));
    } catch (err: any) {
      toast.error(err?.message || "Could not upload that logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSponsors(eventId);
      setSponsors(res.sponsors || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load sponsors");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(
    () => [...sponsors].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [sponsors]
  );

  function openCreate() {
    setDraft(empty);
    setEditing(null);
    setOpen(true);
  }

  // "Add sponsor" lives in the bottom bar, not on the page.
  useConsoleAction("sponsors:add", openCreate);

  function openEdit(s: EventSponsor) {
    setDraft({
      name: s.name,
      logoUrl: s.logoUrl || "",
      boothNumber: s.boothNumber || "",
      websiteUrl: s.websiteUrl || "",
    });
    setEditing(s);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      // Sent unchanged so an existing sponsor keeps whatever band it was
      // filed under; new ones land on the schema's own default.
      tier: editing?.tier || LEGACY_TIER,
      logoUrl: draft.logoUrl.trim() || undefined,
      boothNumber: draft.boothNumber.trim() || undefined,
      websiteUrl: draft.websiteUrl.trim() || undefined,
    };
    try {
      if (editing) await updateSponsor(eventId, editing._id, payload);
      else await createSponsor(eventId, payload);
      toast.success(editing ? "Sponsor updated" : "Sponsor added");
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not save the sponsor");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: EventSponsor) {
    const ok = await confirm({
      title: `Remove ${s.name}?`,
      message: "This sponsor comes off the public page. You can add them again later.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await deleteSponsor(eventId, s._id);
      toast.success("Sponsor removed");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not remove the sponsor");
    }
  }

  return (
    <div className="px-8 py-8">
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
        </div>
      ) : sponsors.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" strokeWidth={1.25} />}
          title="No sponsors yet"
          description="Add partners and exhibitors, with booth numbers if you have a floor plan."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add sponsor
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ordered.map((s) => (
            <Card key={s._id} className="p-5">
              {/* One height, one logo box, whatever the sponsor paid. */}
              <div className="flex h-20 items-center justify-center rounded-lg bg-[#101014]">
                {s.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.logoUrl}
                    alt={s.name}
                    className="max-h-12 max-w-[70%] object-contain"
                  />
                ) : (
                  <span className="text-sm text-[#4f5065]">{s.name}</span>
                )}
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-white">{s.name}</h3>
                  <p className="mt-0.5 text-xs text-[#7c7d94]">
                    {s.boothNumber ? `Booth ${s.boothNumber}` : "No booth"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
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
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit sponsor" : "Add sponsor"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!draft.name.trim()} onClick={save}>
              {editing ? "Save changes" : "Add sponsor"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Sponsor name"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {/* Upload leads: a sponsor sends over a logo file, not a URL. The
              URL box stays for the case where they do have one hosted. */}
          <div>
            <Label>Logo</Label>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-dashed border-[#262626] bg-[#1A1A1A] transition-colors hover:border-brand disabled:opacity-50"
              >
                {draft.logoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.logoUrl}
                      alt=""
                      className="h-full w-full object-contain p-2"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Replace
                    </span>
                  </>
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-500">
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="text-[10px]">Upload logo</span>
                  </span>
                )}
              </button>

              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={draft.logoUrl}
                  onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                  placeholder="…or paste an image URL"
                  className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-brand"
                />
                <p className="text-[11px] leading-4 text-zinc-500">
                  A transparent PNG or SVG sits best on the sponsor wall.
                </p>
                {draft.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, logoUrl: "" })}
                    className="text-[11px] text-zinc-500 transition-colors hover:text-[#f87171]"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void uploadLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Booth number"
              value={draft.boothNumber}
              onChange={(e) => setDraft({ ...draft, boothNumber: e.target.value })}
              placeholder="B-12"
            />
            <TextInput
              label="Website"
              value={draft.websiteUrl}
              onChange={(e) => setDraft({ ...draft, websiteUrl: e.target.value })}
              placeholder="https://…"
            />
          </div>
        </div>
      </Modal>

      {confirmDialog}
    </div>
  );
}
